#!/usr/bin/env node
/**
 * Execution Gate v1.0.0
 * SSOT: src/governance/learning/execution_gate.mjs
 *
 * 执行管道的 preflight 检查入口：
 * - 解析 execution_tiers.yaml
 * - 检查 kill_switch
 * - 检查 drift 状态
 * - 计算允许的 action set
 *
 * 若 SKIP/deny → 立即停止后续 pipeline，并写 facts
 * 失败/缺配置 → fail-closed → SKIP + facts
 *
 * 运行：node src/governance/learning/execution_gate.mjs [--policy <id>] [--action <type>] [--json]
 */

import { readFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { resolveKillSwitch, recordKillSwitchResolvedFact, recordKillSwitchAppliedFact } from './kill_switch.mjs';
import { isDriftBlocked } from './drift_monitor.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// 配置路径
const TIERS_CONFIG_PATH = join(PROJECT_ROOT, '.claude', 'config', 'execution_tiers.yaml');
const GATE_FACTS_FILE = join(PROJECT_ROOT, 'state', 'memory', 'facts', 'fact_execution_gate.jsonl');

// 颜色输出
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

/**
 * 加载 execution_tiers 配置
 */
function loadTiersConfig() {
  if (!existsSync(TIERS_CONFIG_PATH)) {
    return { error: 'config_not_found', path: TIERS_CONFIG_PATH };
  }

  try {
    return parseYaml(readFileSync(TIERS_CONFIG_PATH, 'utf-8'));
  } catch (e) {
    return { error: 'config_parse_error', message: e.message };
  }
}

/**
 * 记录 gate 决策到 facts
 */
function appendGateFact(fact) {
  const dir = dirname(GATE_FACTS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const record = {
    timestamp: new Date().toISOString(),
    event_type: 'execution_gate_checked',
    ...fact
  };

  appendFileSync(GATE_FACTS_FILE, JSON.stringify(record) + '\n');
}

/**
 * Preflight 检查：在执行任何动作前运行
 *
 * @param {Object} options
 * @param {string} options.policyId - Policy ID（可选）
 * @param {string} options.actionType - 要执行的动作类型
 * @param {string} options.currentTier - 当前执行层级
 * @param {boolean} options.recordFacts - 是否记录 facts
 *
 * @returns {Object} { allowed, reason, resolution }
 */
export function preflightCheck(options = {}) {
  const {
    policyId = null,
    actionType = 'READ_ONLY',
    currentTier = 'observe',
    recordFacts = false
  } = options;

  const result = {
    allowed: true,
    action: 'ALLOW',
    reason: null,
    checks: [],
    denied_by: null,
    timestamp: new Date().toISOString()
  };

  // 1. 加载配置
  const tiersConfig = loadTiersConfig();

  if (tiersConfig.error) {
    result.allowed = false;
    result.action = 'DENY';
    result.reason = `Config error: ${tiersConfig.error}`;
    result.denied_by = 'config_fail_closed';
    result.checks.push({
      check: 'config_load',
      passed: false,
      error: tiersConfig.error
    });

    if (recordFacts) {
      appendGateFact({
        policy_id: policyId,
        action_type: actionType,
        current_tier: currentTier,
        decision: 'DENY',
        reason: result.reason
      });
    }

    return result;
  }

  result.checks.push({ check: 'config_load', passed: true });

  // 2. Kill Switch 检查
  const killSwitchResult = resolveKillSwitch();

  if (recordFacts) {
    recordKillSwitchResolvedFact(killSwitchResult);
  }

  if (killSwitchResult.active) {
    // 检查动作是否被阻断
    if (killSwitchResult.denied_actions.includes(actionType)) {
      result.allowed = false;
      result.action = 'DENY';
      result.reason = `Kill switch active: ${actionType} blocked`;
      result.denied_by = 'kill_switch';
      result.checks.push({
        check: 'kill_switch',
        passed: false,
        resolution: killSwitchResult
      });

      if (recordFacts && policyId) {
        recordKillSwitchAppliedFact(policyId, actionType, 'kill_switch_active');
      }

      if (recordFacts) {
        appendGateFact({
          policy_id: policyId,
          action_type: actionType,
          current_tier: currentTier,
          decision: 'DENY',
          reason: result.reason,
          kill_switch: killSwitchResult
        });
      }

      return result;
    }
  }

  result.checks.push({
    check: 'kill_switch',
    passed: true,
    active: killSwitchResult.active
  });

  // 3. Tier 权限检查
  const tierConfig = tiersConfig.tiers?.[currentTier];

  if (!tierConfig) {
    result.allowed = false;
    result.action = 'DENY';
    result.reason = `Unknown tier: ${currentTier}`;
    result.denied_by = 'tier_unknown';
    result.checks.push({
      check: 'tier_permission',
      passed: false,
      error: `Tier "${currentTier}" not defined`
    });

    if (recordFacts) {
      appendGateFact({
        policy_id: policyId,
        action_type: actionType,
        current_tier: currentTier,
        decision: 'DENY',
        reason: result.reason
      });
    }

    return result;
  }

  // 检查动作是否在允许列表中
  const allowedActions = tierConfig.allowed_actions || [];

  if (!allowedActions.includes(actionType)) {
    result.allowed = false;
    result.action = 'DENY';
    result.reason = `Action "${actionType}" not allowed in tier "${currentTier}"`;
    result.denied_by = 'tier_permission';
    result.checks.push({
      check: 'tier_permission',
      passed: false,
      tier: currentTier,
      allowed_actions: allowedActions,
      requested_action: actionType
    });

    if (recordFacts) {
      appendGateFact({
        policy_id: policyId,
        action_type: actionType,
        current_tier: currentTier,
        decision: 'DENY',
        reason: result.reason
      });
    }

    return result;
  }

  result.checks.push({
    check: 'tier_permission',
    passed: true,
    tier: currentTier,
    allowed_actions: allowedActions
  });

  // 4. 如果是写入动作，检查 require_approval
  if (actionType === 'WRITE_LIMITED') {
    if (!tierConfig.require_approval) {
      // 这不应该发生（validator 应该已经阻止了）
      // 但作为额外的运行时检查
      result.allowed = false;
      result.action = 'DENY';
      result.reason = 'WRITE_LIMITED requires approval but tier config missing require_approval';
      result.denied_by = 'safety_violation';
      result.checks.push({
        check: 'require_approval',
        passed: false
      });

      if (recordFacts) {
        appendGateFact({
          policy_id: policyId,
          action_type: actionType,
          current_tier: currentTier,
          decision: 'DENY',
          reason: result.reason
        });
      }

      return result;
    }

    result.checks.push({ check: 'require_approval', passed: true });
  }

  // 5. Drift 检查（仅当有 policy ID 时）
  if (policyId && actionType === 'WRITE_LIMITED') {
    const driftCheck = isDriftBlocked(policyId);

    if (driftCheck.blocked) {
      result.allowed = false;
      result.action = 'DENY';
      result.reason = `Drift blocked: ${driftCheck.reason}`;
      result.denied_by = 'drift_monitor';
      result.checks.push({
        check: 'drift_monitor',
        passed: false,
        drift_result: driftCheck
      });

      if (recordFacts) {
        appendGateFact({
          policy_id: policyId,
          action_type: actionType,
          current_tier: currentTier,
          decision: 'DENY',
          reason: result.reason,
          drift: driftCheck
        });
      }

      return result;
    }

    result.checks.push({ check: 'drift_monitor', passed: true });
  }

  // 6. 所有检查通过
  result.allowed = true;
  result.action = 'ALLOW';
  result.reason = 'All checks passed';

  if (recordFacts) {
    appendGateFact({
      policy_id: policyId,
      action_type: actionType,
      current_tier: currentTier,
      decision: 'ALLOW',
      reason: result.reason,
      checks_passed: result.checks.length
    });
  }

  return result;
}

/**
 * 获取当前层级允许的所有动作
 */
export function getAllowedActions(currentTier) {
  const tiersConfig = loadTiersConfig();

  if (tiersConfig.error) {
    return { error: tiersConfig.error, actions: [] };
  }

  const tierConfig = tiersConfig.tiers?.[currentTier];

  if (!tierConfig) {
    return { error: `Unknown tier: ${currentTier}`, actions: [] };
  }

  // 检查 kill switch
  const killSwitchResult = resolveKillSwitch();
  let allowedActions = [...(tierConfig.allowed_actions || [])];

  if (killSwitchResult.active) {
    // 移除被 kill switch 阻断的动作
    allowedActions = allowedActions.filter(action =>
      !killSwitchResult.denied_actions.includes(action)
    );
  }

  return {
    tier: currentTier,
    actions: allowedActions,
    kill_switch_active: killSwitchResult.active,
    denied_by_kill_switch: killSwitchResult.active ? killSwitchResult.denied_actions : []
  };
}

// CLI
function parseArgs() {
  const args = process.argv.slice(2);
  const options = { policy: null, action: 'READ_ONLY', tier: 'observe', json: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--policy' && args[i + 1]) options.policy = args[++i];
    if (arg === '--action' && args[i + 1]) options.action = args[++i];
    if (arg === '--tier' && args[i + 1]) options.tier = args[++i];
    if (arg === '--json') options.json = true;
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('           Execution Gate v1.0.0');
  console.log('═══════════════════════════════════════════════════════════');

  console.log(`\n${CYAN}📋 Checking:${RESET}`);
  console.log(`  Policy: ${options.policy || '(none)'}`);
  console.log(`  Action: ${options.action}`);
  console.log(`  Tier: ${options.tier}`);

  const result = preflightCheck({
    policyId: options.policy,
    actionType: options.action,
    currentTier: options.tier,
    recordFacts: false
  });

  console.log(`\n${CYAN}📊 Checks:${RESET}`);
  for (const check of result.checks) {
    const status = check.passed ? GREEN + '✅' + RESET : RED + '❌' + RESET;
    console.log(`  ${status} ${check.check}`);
  }

  console.log(`\n${CYAN}📊 Decision:${RESET}`);
  if (result.allowed) {
    console.log(`  ${GREEN}✅ ALLOWED${RESET}`);
  } else {
    console.log(`  ${RED}❌ DENIED${RESET}`);
    console.log(`  Reason: ${result.reason}`);
    console.log(`  Denied by: ${result.denied_by}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  }

  process.exit(result.allowed ? 0 : 1);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) main();
