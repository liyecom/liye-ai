#!/usr/bin/env node
/**
 * Execute-Limited Gate v1.0.0
 * SSOT: .claude/scripts/proactive/execute_limited_gate.mjs
 *
 * Week 5 写入能力总闸门（fail-closed）：
 * 执行顺序固定，便于审计：
 * 1. Feature Flag Gate：EXECUTE_LIMITED_ENABLED=false 直接拒绝
 * 2. Contract Gate：schema 已过 + action_type 枚举合法
 * 3. Scope Gate：policy.scope 与 scopeContext 一致
 * 4. Risk Gate：high 风险必须人工批准
 * 5. RateLimit Gate：每 tenant/day 最大写入次数
 * 6. Rollback Requirement Gate：写入动作必须带 rollback plan
 *
 * 任一 gate 失败 → REJECTED
 *
 * 用法：
 *   node execute_limited_gate.mjs --run-id <id>
 *   # 或 programmatic
 *   import { evaluateGates } from './execute_limited_gate.mjs'
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const RUNS_DIR = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'runs');
const RATE_LIMIT_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'rate_limits.json');

// 颜色输出
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// ═══════════════════════════════════════════════════════════
// Gate 配置
// ═══════════════════════════════════════════════════════════

const GATE_CONFIG = {
  // Gate 1: Feature Flag
  feature_flag: {
    env_var: 'EXECUTE_LIMITED_ENABLED',
    default: 'false'  // 默认关闭
  },

  // Gate 2: Contract - 合法 action_type 枚举
  contract: {
    valid_action_types: [
      'bid_adjust',
      'budget_adjust',
      'keyword_pause',
      'campaign_pause',
      'keyword_negation',
      'investigate_metric',
      'no_action'
    ],
    valid_tiers: ['observe', 'recommend', 'execute_limited'],
    valid_risk_levels: ['low', 'medium', 'high']
  },

  // Gate 5: RateLimit
  rate_limit: {
    max_per_tenant_per_day: 5,
    max_global_per_day: 50
  }
};

// ═══════════════════════════════════════════════════════════
// Gate 实现
// ═══════════════════════════════════════════════════════════

/**
 * Gate 1: Feature Flag Gate (使用 Kill Switch 模块)
 * EXECUTE_LIMITED_ENABLED 必须为 true/1
 */
async function evaluateFeatureFlagGate() {
  // 使用 kill_switch 模块统一判断
  let killSwitchStatus;
  try {
    const { isExecuteLimitedEnabled } = await import('./kill_switch.mjs');
    killSwitchStatus = isExecuteLimitedEnabled();
  } catch (e) {
    // fallback 到直接读 ENV
    const envValue = process.env[GATE_CONFIG.feature_flag.env_var] ||
                     GATE_CONFIG.feature_flag.default;
    const enabled = envValue === 'true' || envValue === '1';
    killSwitchStatus = { enabled, source: 'env_fallback' };
  }

  return {
    gate: 'feature_flag',
    passed: killSwitchStatus.enabled,
    reason: killSwitchStatus.enabled
      ? `Feature flag enabled (source: ${killSwitchStatus.source})`
      : `Feature flag disabled (source: ${killSwitchStatus.source}, reason: ${killSwitchStatus.reason || 'N/A'})`
  };
}

/**
 * Gate 2: Contract Gate
 * action_type 必须在枚举中，tier 和 risk_level 合法
 */
function evaluateContractGate(recommendation) {
  const errors = [];

  // action_type 检查
  if (!GATE_CONFIG.contract.valid_action_types.includes(recommendation.action_type)) {
    errors.push(`Invalid action_type: ${recommendation.action_type}. Must be one of: ${GATE_CONFIG.contract.valid_action_types.join(', ')}`);
  }

  // tier 检查
  if (recommendation.tier && !GATE_CONFIG.contract.valid_tiers.includes(recommendation.tier)) {
    errors.push(`Invalid tier: ${recommendation.tier}`);
  }

  // risk_level 检查
  if (recommendation.risk_level && !GATE_CONFIG.contract.valid_risk_levels.includes(recommendation.risk_level)) {
    errors.push(`Invalid risk_level: ${recommendation.risk_level}`);
  }

  return {
    gate: 'contract',
    passed: errors.length === 0,
    reason: errors.length === 0
      ? 'Contract validation passed'
      : errors.join('; ')
  };
}

/**
 * Gate 3: Scope Gate
 * recommendation 的目标 scope 必须与当前运行上下文一致
 */
function evaluateScopeGate(recommendation, scopeContext) {
  if (!scopeContext) {
    return {
      gate: 'scope',
      passed: true,
      reason: 'No scope context provided (skipped)'
    };
  }

  const recScope = recommendation.parameters?.scope || {};
  const errors = [];

  // 检查 tenant_id
  if (scopeContext.tenant_id && recScope.tenant_id &&
      recScope.tenant_id !== scopeContext.tenant_id) {
    errors.push(`Tenant mismatch: ${recScope.tenant_id} vs ${scopeContext.tenant_id}`);
  }

  // 检查 marketplace
  if (scopeContext.marketplace && recScope.marketplace &&
      recScope.marketplace !== scopeContext.marketplace) {
    errors.push(`Marketplace mismatch: ${recScope.marketplace} vs ${scopeContext.marketplace}`);
  }

  // 检查 brand_id
  if (scopeContext.brand_id && recScope.brand_id &&
      recScope.brand_id !== scopeContext.brand_id) {
    errors.push(`Brand mismatch: ${recScope.brand_id} vs ${scopeContext.brand_id}`);
  }

  return {
    gate: 'scope',
    passed: errors.length === 0,
    reason: errors.length === 0
      ? 'Scope validation passed'
      : errors.join('; ')
  };
}

/**
 * Gate 4: Risk Gate
 * high 风险一律需要人工批准
 */
function evaluateRiskGate(recommendation, operatorSignal) {
  const riskLevel = recommendation.risk_level || 'medium';

  if (riskLevel === 'high') {
    // high 风险必须有 operator 批准
    if (!operatorSignal || operatorSignal.decision !== 'approve') {
      return {
        gate: 'risk',
        passed: false,
        reason: `High-risk action requires operator approval. Current: ${operatorSignal?.decision || 'none'}`,
        requires_approval: true
      };
    }
  }

  return {
    gate: 'risk',
    passed: true,
    reason: `Risk level (${riskLevel}) acceptable`
  };
}

/**
 * Gate 5: RateLimit Gate
 * 每 tenant/day 最大写入次数
 */
function evaluateRateLimitGate(tenantId) {
  const today = new Date().toISOString().split('T')[0];
  let rateLimits = {};

  if (existsSync(RATE_LIMIT_FILE)) {
    rateLimits = JSON.parse(readFileSync(RATE_LIMIT_FILE, 'utf-8'));
  }

  // 清理过期数据
  for (const key of Object.keys(rateLimits)) {
    if (!key.startsWith(today)) {
      delete rateLimits[key];
    }
  }

  const tenantKey = `${today}:${tenantId || 'default'}`;
  const globalKey = `${today}:__global__`;

  const tenantCount = rateLimits[tenantKey] || 0;
  const globalCount = rateLimits[globalKey] || 0;

  const tenantExceeded = tenantCount >= GATE_CONFIG.rate_limit.max_per_tenant_per_day;
  const globalExceeded = globalCount >= GATE_CONFIG.rate_limit.max_global_per_day;

  if (tenantExceeded || globalExceeded) {
    return {
      gate: 'rate_limit',
      passed: false,
      reason: tenantExceeded
        ? `Tenant rate limit exceeded: ${tenantCount}/${GATE_CONFIG.rate_limit.max_per_tenant_per_day}`
        : `Global rate limit exceeded: ${globalCount}/${GATE_CONFIG.rate_limit.max_global_per_day}`
    };
  }

  return {
    gate: 'rate_limit',
    passed: true,
    reason: `Rate limit OK: tenant=${tenantCount}/${GATE_CONFIG.rate_limit.max_per_tenant_per_day}, global=${globalCount}/${GATE_CONFIG.rate_limit.max_global_per_day}`,
    increment: { tenantKey, globalKey }
  };
}

/**
 * Gate 6: Rollback Requirement Gate
 * execute_limited 动作必须带 rollback_plan
 */
function evaluateRollbackRequirementGate(recommendation) {
  const tier = recommendation.tier || 'recommend';

  if (tier === 'execute_limited') {
    const rollbackPlan = recommendation.rollback_plan;

    if (!rollbackPlan) {
      return {
        gate: 'rollback_requirement',
        passed: false,
        reason: 'execute_limited actions must include rollback_plan'
      };
    }

    if (!rollbackPlan.how_to_revert) {
      return {
        gate: 'rollback_requirement',
        passed: false,
        reason: 'rollback_plan.how_to_revert is required'
      };
    }

    if (!rollbackPlan.safe_window_hours || rollbackPlan.safe_window_hours < 1) {
      return {
        gate: 'rollback_requirement',
        passed: false,
        reason: 'rollback_plan.safe_window_hours must be >= 1'
      };
    }
  }

  return {
    gate: 'rollback_requirement',
    passed: true,
    reason: 'Rollback plan validation passed'
  };
}

// ═══════════════════════════════════════════════════════════
// 主评估函数
// ═══════════════════════════════════════════════════════════

/**
 * 评估所有 gates（固定顺序）
 * @param {Object} recommendation - 单条推荐
 * @param {Object} context - 上下文 { scopeContext, operatorSignal, tenantId }
 * @returns {Object} { passed, results[], firstFailedGate }
 */
export async function evaluateGates(recommendation, context = {}) {
  const results = [];
  let passed = true;
  let firstFailedGate = null;

  // Gate 1: Feature Flag (async for kill_switch import)
  const gate1 = await evaluateFeatureFlagGate();
  results.push(gate1);
  if (!gate1.passed) {
    passed = false;
    firstFailedGate = firstFailedGate || 'feature_flag';
  }

  // Gate 2: Contract
  const gate2 = evaluateContractGate(recommendation);
  results.push(gate2);
  if (!gate2.passed) {
    passed = false;
    firstFailedGate = firstFailedGate || 'contract';
  }

  // Gate 3: Scope
  const gate3 = evaluateScopeGate(recommendation, context.scopeContext);
  results.push(gate3);
  if (!gate3.passed) {
    passed = false;
    firstFailedGate = firstFailedGate || 'scope';
  }

  // Gate 4: Risk
  const gate4 = evaluateRiskGate(recommendation, context.operatorSignal);
  results.push(gate4);
  if (!gate4.passed) {
    passed = false;
    firstFailedGate = firstFailedGate || 'risk';
  }

  // Gate 5: RateLimit
  const gate5 = evaluateRateLimitGate(context.tenantId);
  results.push(gate5);
  if (!gate5.passed) {
    passed = false;
    firstFailedGate = firstFailedGate || 'rate_limit';
  }

  // Gate 6: Rollback Requirement
  const gate6 = evaluateRollbackRequirementGate(recommendation);
  results.push(gate6);
  if (!gate6.passed) {
    passed = false;
    firstFailedGate = firstFailedGate || 'rollback_requirement';
  }

  return {
    passed,
    firstFailedGate,
    results,
    evaluated_at: new Date().toISOString()
  };
}

/**
 * 记录 rate limit 增量（执行成功后调用）
 */
export function incrementRateLimit(tenantId) {
  const today = new Date().toISOString().split('T')[0];
  let rateLimits = {};

  if (existsSync(RATE_LIMIT_FILE)) {
    rateLimits = JSON.parse(readFileSync(RATE_LIMIT_FILE, 'utf-8'));
  }

  const tenantKey = `${today}:${tenantId || 'default'}`;
  const globalKey = `${today}:__global__`;

  rateLimits[tenantKey] = (rateLimits[tenantKey] || 0) + 1;
  rateLimits[globalKey] = (rateLimits[globalKey] || 0) + 1;

  mkdirSync(dirname(RATE_LIMIT_FILE), { recursive: true });
  writeFileSync(RATE_LIMIT_FILE, JSON.stringify(rateLimits, null, 2));
}

/**
 * 从 run 目录加载评估所需数据
 */
function loadRunData(runId) {
  const runIdSanitized = runId.replace(/:/g, '-');
  const runDir = join(RUNS_DIR, runIdSanitized);

  if (!existsSync(runDir)) {
    throw new Error(`Run not found: ${runId}`);
  }

  const playbookIo = JSON.parse(readFileSync(join(runDir, 'playbook_io.json'), 'utf-8'));
  const operatorSignal = JSON.parse(readFileSync(join(runDir, 'operator_signal.json'), 'utf-8'));
  const meta = JSON.parse(readFileSync(join(runDir, 'meta.json'), 'utf-8'));

  return { playbookIo, operatorSignal, meta, runDir };
}

/**
 * 保存 gate 评估结果到 Evidence Package
 */
function saveGateResult(runDir, gateResult, recommendation) {
  const gateResultPath = join(runDir, 'gate_result.json');
  writeFileSync(gateResultPath, JSON.stringify({
    ...gateResult,
    recommendation_action_type: recommendation.action_type,
    recommendation_tier: recommendation.tier,
    recommendation_risk_level: recommendation.risk_level
  }, null, 2));
}

// ═══════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { runId: null, recIndex: 0 };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--run-id' && args[i + 1]) result.runId = args[++i];
    if (args[i] === '--rec-index' && args[i + 1]) result.recIndex = parseInt(args[++i], 10);
  }

  return result;
}

async function main() {
  const args = parseArgs();

  if (!args.runId) {
    console.log('Usage: node execute_limited_gate.mjs --run-id <id> [--rec-index <n>]');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('         Execute-Limited Gate v1.0.0 (Week 5)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  try {
    const { playbookIo, operatorSignal, meta, runDir } = loadRunData(args.runId);

    const recommendations = playbookIo.output?.outputs?.recommendations ||
                            playbookIo.output?.recommendations || [];

    if (recommendations.length === 0) {
      console.log(`${YELLOW}No recommendations to evaluate${RESET}`);
      process.exit(0);
    }

    const recommendation = recommendations[args.recIndex];
    if (!recommendation) {
      console.error(`${RED}Recommendation index ${args.recIndex} not found${RESET}`);
      process.exit(1);
    }

    console.log(`Run ID: ${args.runId}`);
    console.log(`Recommendation: ${recommendation.action_type} (tier=${recommendation.tier}, risk=${recommendation.risk_level})`);
    console.log('');

    // 评估 (async)
    const result = await evaluateGates(recommendation, {
      operatorSignal,
      tenantId: meta.engine_id,
      scopeContext: null // 可从 inputs 提取
    });

    // 输出结果
    for (const gate of result.results) {
      const icon = gate.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
      console.log(`${icon} Gate: ${gate.gate}`);
      console.log(`   ${DIM}${gate.reason}${RESET}`);
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');

    if (result.passed) {
      console.log(`${GREEN}APPROVED: All gates passed${RESET}`);
    } else {
      console.log(`${RED}REJECTED: Failed at gate '${result.firstFailedGate}'${RESET}`);
    }

    // 保存结果
    saveGateResult(runDir, result, recommendation);
    console.log(`\nResult saved: ${runDir}/gate_result.json`);

    process.exit(result.passed ? 0 : 1);
  } catch (e) {
    console.error(`${RED}Error: ${e.message}${RESET}`);
    process.exit(1);
  }
}

// 仅在直接运行时执行 main()
const isDirectRun = process.argv[1]?.endsWith('execute_limited_gate.mjs');
if (isDirectRun) {
  main();
}
