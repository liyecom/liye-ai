#!/usr/bin/env node
/**
 * Kill Switch Governance Module v1.0.0
 * SSOT: src/governance/learning/kill_switch.mjs
 *
 * 与 execution_tiers 协同，实现紧急阻断和审计。
 *
 * 优先级链路：
 * 1. ENV (LIYE_KILL_SWITCH) - 最高优先级
 * 2. State file (kill_switch.json)
 * 3. Default (disabled)
 *
 * 当 kill_switch 激活时：
 * - 所有 WRITE_LIMITED 动作被阻断
 * - 记录 kill_switch_resolved 和 kill_switch_applied facts
 *
 * 运行：node src/governance/learning/kill_switch.mjs [--check] [--json]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// 配置路径
const KILL_SWITCH_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'kill_switch.json');
const TIERS_CONFIG_PATH = join(PROJECT_ROOT, '.claude', 'config', 'execution_tiers.yaml');
const KILL_FACTS_FILE = join(PROJECT_ROOT, 'state', 'memory', 'facts', 'fact_kill_switch_events.jsonl');

// 颜色输出
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

// 有效的布尔值
const VALID_BOOLEAN_VALUES = {
  'true': true, '1': true, 'yes': true, 'on': true,
  'false': false, '0': false, 'no': false, 'off': false
};

/**
 * 解析 ENV kill switch
 */
function resolveEnvKillSwitch() {
  const raw = process.env.LIYE_KILL_SWITCH;
  if (raw === undefined || raw === '') {
    return { active: null, source: 'not_set' };
  }

  const normalized = raw.toLowerCase().trim();
  if (normalized in VALID_BOOLEAN_VALUES) {
    return { active: VALID_BOOLEAN_VALUES[normalized], source: 'env' };
  }

  // 非法值 → fail-closed（激活 kill switch）
  return { active: true, source: 'env_invalid_fail_closed' };
}

/**
 * 解析 state file kill switch
 */
function resolveStateKillSwitch() {
  if (!existsSync(KILL_SWITCH_FILE)) {
    return { active: null, source: 'not_found' };
  }

  try {
    const data = JSON.parse(readFileSync(KILL_SWITCH_FILE, 'utf-8'));

    // 新格式：直接 enabled 字段
    if (data.enabled !== undefined) {
      return { active: data.enabled, source: 'state', reason: data.reason };
    }

    // 旧格式：learning_heartbeat 字段
    if (data.learning_heartbeat !== undefined) {
      return { active: !data.learning_heartbeat, source: 'state_legacy' };
    }

    return { active: null, source: 'state_empty' };
  } catch (e) {
    // 解析失败 → fail-closed
    return { active: true, source: 'state_parse_error', error: e.message };
  }
}

/**
 * 解析 kill switch（完整链路）
 * 优先级：ENV > state > default(false)
 */
export function resolveKillSwitch() {
  const envResult = resolveEnvKillSwitch();
  const stateResult = resolveStateKillSwitch();

  let effective_active, resolved_by, resolution_chain;

  // ENV 最高优先级
  if (envResult.active !== null) {
    effective_active = envResult.active;
    resolved_by = envResult.source;
    resolution_chain = [envResult];
  }
  // State 次之
  else if (stateResult.active !== null) {
    effective_active = stateResult.active;
    resolved_by = stateResult.source;
    resolution_chain = [envResult, stateResult];
  }
  // Default
  else {
    effective_active = false;
    resolved_by = 'default';
    resolution_chain = [envResult, stateResult, { active: false, source: 'default' }];
  }

  // 加载 tiers config 获取 denied_actions
  let denied_actions = [];
  let affected_tiers = [];

  if (effective_active) {
    try {
      if (existsSync(TIERS_CONFIG_PATH)) {
        const tiersConfig = parseYaml(readFileSync(TIERS_CONFIG_PATH, 'utf-8'));
        const ksi = tiersConfig.kill_switch_integration?.when_active;
        if (ksi) {
          denied_actions = ksi.deny_actions || ['WRITE_LIMITED'];
          affected_tiers = [ksi.force_tier || 'recommend'];
        }
      }
    } catch (e) {
      // 配置解析失败，使用默认值
      denied_actions = ['WRITE_LIMITED'];
      affected_tiers = ['execute_limited'];
    }
  }

  return {
    active: effective_active,
    resolved_by,
    resolution_chain,
    denied_actions,
    affected_tiers,
    timestamp: new Date().toISOString()
  };
}

/**
 * 记录 kill_switch_resolved fact
 */
export function recordKillSwitchResolvedFact(resolution) {
  const dir = dirname(KILL_FACTS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const fact = {
    timestamp: new Date().toISOString(),
    event_type: 'kill_switch_resolved',
    resolved_by: resolution.resolved_by,
    effective_value: resolution.active,
    affected_tiers: resolution.affected_tiers,
    denied_actions: resolution.denied_actions,
    resolution_chain: resolution.resolution_chain
  };

  appendFileSync(KILL_FACTS_FILE, JSON.stringify(fact) + '\n');
  return fact;
}

/**
 * 记录 kill_switch_applied fact（当实际阻断动作时）
 */
export function recordKillSwitchAppliedFact(policyId, actionType, blockedReason) {
  const dir = dirname(KILL_FACTS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const fact = {
    timestamp: new Date().toISOString(),
    event_type: 'kill_switch_applied',
    policy_id: policyId,
    action_type: actionType,
    blocked_reason: blockedReason
  };

  appendFileSync(KILL_FACTS_FILE, JSON.stringify(fact) + '\n');
  return fact;
}

/**
 * 检查动作是否被 kill switch 阻断
 */
export function isActionBlocked(actionType, options = {}) {
  const { recordFact = false, policyId = null } = options;

  const resolution = resolveKillSwitch();

  // 记录解析事件
  if (recordFact) {
    recordKillSwitchResolvedFact(resolution);
  }

  if (!resolution.active) {
    return { blocked: false, resolution };
  }

  // 检查动作是否在 denied_actions 中
  if (resolution.denied_actions.includes(actionType)) {
    // 记录阻断事件
    if (recordFact && policyId) {
      recordKillSwitchAppliedFact(policyId, actionType, 'kill_switch_active');
    }

    return {
      blocked: true,
      reason: 'kill_switch_active',
      resolution
    };
  }

  return { blocked: false, resolution };
}

/**
 * 更新 kill switch 状态
 */
export function updateKillSwitch(enabled, reason, updatedBy = 'system') {
  const dir = dirname(KILL_SWITCH_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const data = {
    enabled,
    reason,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy
  };

  writeFileSync(KILL_SWITCH_FILE, JSON.stringify(data, null, 2));
  return data;
}

/**
 * 主函数：显示 kill switch 状态
 */
function showStatus(jsonOutput = false) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           Kill Switch Status v1.0.0');
  console.log('═══════════════════════════════════════════════════════════');

  const resolution = resolveKillSwitch();

  if (jsonOutput) {
    console.log(JSON.stringify(resolution, null, 2));
    return resolution;
  }

  console.log(`\n${CYAN}📊 Resolution:${RESET}`);
  console.log(`  Active: ${resolution.active ? RED + 'YES (BLOCKING)' + RESET : GREEN + 'NO' + RESET}`);
  console.log(`  Resolved by: ${resolution.resolved_by}`);

  if (resolution.active) {
    console.log(`\n${YELLOW}⚠️  Blocked Actions:${RESET}`);
    for (const action of resolution.denied_actions) {
      console.log(`  - ${action}`);
    }

    console.log(`\n${YELLOW}⚠️  Affected Tiers:${RESET}`);
    for (const tier of resolution.affected_tiers) {
      console.log(`  - ${tier}`);
    }
  }

  console.log(`\n${CYAN}📋 Resolution Chain:${RESET}`);
  for (const step of resolution.resolution_chain) {
    const status = step.active === null ? 'N/A' : (step.active ? 'ACTIVE' : 'INACTIVE');
    console.log(`  [${step.source}] → ${status}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');

  return resolution;
}

// CLI
function parseArgs() {
  const args = process.argv.slice(2);
  const options = { check: false, json: false, enable: null, reason: null };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--check') options.check = true;
    if (arg === '--json') options.json = true;
    if (arg === '--enable') options.enable = true;
    if (arg === '--disable') options.enable = false;
    if (arg === '--reason' && args[i + 1]) options.reason = args[++i];
  }

  return options;
}

async function main() {
  const options = parseArgs();

  // 更新 kill switch
  if (options.enable !== null) {
    const reason = options.reason || (options.enable ? 'Manual enable via CLI' : 'Manual disable via CLI');
    const result = updateKillSwitch(options.enable, reason, 'cli');
    console.log(options.json ? JSON.stringify(result, null, 2) : `Kill switch ${options.enable ? 'enabled' : 'disabled'}: ${reason}`);
    process.exit(0);
  }

  // 显示状态
  const resolution = showStatus(options.json);

  // --check 模式：如果 kill switch 激活则返回非零退出码
  if (options.check) {
    process.exit(resolution.active ? 1 : 0);
  }

  process.exit(0);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) main();
