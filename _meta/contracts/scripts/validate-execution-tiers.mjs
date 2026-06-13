#!/usr/bin/env node
/**
 * Execution Tiers Validator v1.0.0
 * SSOT: _meta/contracts/scripts/validate-execution-tiers.mjs
 *
 * 校验 .claude/config/execution_tiers.yaml：
 * - 三层是否齐全（observe, recommend, execute_limited）
 * - 字段类型正确
 * - allowed_actions 在白名单内
 * - execute_limited.require_approval 必须为 true（安全底线）
 *
 * 任一失败 → exit(1)（fail-closed）
 *
 * 运行：node _meta/contracts/scripts/validate-execution-tiers.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const CONFIG_PATH = join(PROJECT_ROOT, '.claude', 'config', 'execution_tiers.yaml');

// 颜色输出
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

let errorCount = 0;
let warningCount = 0;
let passCount = 0;

function logError(context, message) {
  console.error(`${RED}❌ ${context}${RESET}: ${message}`);
  errorCount++;
}

function logWarning(context, message) {
  console.warn(`${YELLOW}⚠️  ${context}${RESET}: ${message}`);
  warningCount++;
}

function logPass(context) {
  console.log(`${GREEN}✅ ${context}${RESET}`);
  passCount++;
}

// 必须存在的三个层级
const REQUIRED_TIERS = ['observe', 'recommend', 'execute_limited'];

// 动作白名单（默认，可被配置文件覆盖）
const DEFAULT_ACTION_WHITELIST = [
  'READ_ONLY',
  'DETECT_PATTERN',
  'GENERATE_EVIDENCE',
  'RECOMMEND',
  'NOTIFY_OPERATOR',
  'WRITE_LIMITED'
];

// 状态转移 token 白名单（EVO-C D-5 / ADR-Learning-Stack-Generations §D-09）
// 来源 = transitions[].requires 真枚举的 live tokens（7 个）。
// tier_manager_approval 随 §D-A2 取代为 orphan，已从 execution_tiers.yaml 删除；
// 任何不在本白名单的 orphan token fail-closed（errorCount++ → exit 1），防止 superseded 模块死配置静默残留。
const LIVE_TRANSITION_TOKENS = [
  'criteria_met',
  'operator_explicit_approval',
  'drift_detected',
  'operator_request',
  'consecutive_failures',
  'kill_switch_active',
  'drift_critical'
];

/**
 * 加载配置文件
 */
function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    logError('Config', `File not found: ${CONFIG_PATH}`);
    return null;
  }

  try {
    const content = readFileSync(CONFIG_PATH, 'utf-8');
    return parseYaml(content);
  } catch (e) {
    logError('Config', `Failed to parse YAML: ${e.message}`);
    return null;
  }
}

/**
 * 校验版本字段
 */
function validateVersion(config) {
  if (!config.version) {
    logError('version', 'Missing required field: version');
    return;
  }

  if (typeof config.version !== 'string') {
    logError('version', `Must be string, got ${typeof config.version}`);
    return;
  }

  if (!/^\d+\.\d+\.\d+$/.test(config.version)) {
    logWarning('version', `Should be SemVer format (x.y.z), got "${config.version}"`);
  } else {
    logPass('version');
  }
}

/**
 * 校验三层是否齐全
 */
function validateRequiredTiers(config) {
  if (!config.tiers) {
    logError('tiers', 'Missing required field: tiers');
    return false;
  }

  if (typeof config.tiers !== 'object') {
    logError('tiers', `Must be object, got ${typeof config.tiers}`);
    return false;
  }

  let allPresent = true;
  for (const tier of REQUIRED_TIERS) {
    if (!config.tiers[tier]) {
      logError('tiers', `Missing required tier: ${tier}`);
      allPresent = false;
    }
  }

  if (allPresent) {
    logPass('tiers (all 3 tiers present)');
  }

  return allPresent;
}

/**
 * 校验单个 tier 的字段
 */
function validateTierFields(tierName, tier, actionWhitelist) {
  let hasErrors = false;

  // description
  if (!tier.description) {
    logWarning(`tiers.${tierName}`, 'Missing description field');
  }

  // allowed_actions
  if (!tier.allowed_actions) {
    logError(`tiers.${tierName}`, 'Missing required field: allowed_actions');
    hasErrors = true;
  } else if (!Array.isArray(tier.allowed_actions)) {
    logError(`tiers.${tierName}.allowed_actions`, `Must be array, got ${typeof tier.allowed_actions}`);
    hasErrors = true;
  } else {
    // 检查每个 action 是否在白名单中
    for (const action of tier.allowed_actions) {
      if (!actionWhitelist.includes(action)) {
        logError(`tiers.${tierName}.allowed_actions`, `Unknown action "${action}" not in whitelist`);
        hasErrors = true;
      }
    }
  }

  // allow_write
  if (tier.allow_write === undefined) {
    logError(`tiers.${tierName}`, 'Missing required field: allow_write');
    hasErrors = true;
  } else if (typeof tier.allow_write !== 'boolean') {
    logError(`tiers.${tierName}.allow_write`, `Must be boolean, got ${typeof tier.allow_write}`);
    hasErrors = true;
  }

  return !hasErrors;
}

/**
 * 校验 execute_limited 的安全约束
 */
function validateExecuteLimitedSafety(config) {
  const tier = config.tiers?.execute_limited;
  if (!tier) {
    return; // 已在 validateRequiredTiers 中报错
  }

  // 安全底线：require_approval 必须为 true
  if (tier.require_approval !== true) {
    logError(
      'tiers.execute_limited.require_approval',
      `SAFETY VIOLATION: Must be true (got ${tier.require_approval}). Production writes require approval.`
    );
    return;
  }

  logPass('tiers.execute_limited.require_approval = true (safety baseline)');

  // 检查 allow_write = true（逻辑一致性）
  if (tier.allow_write !== true) {
    logWarning(
      'tiers.execute_limited.allow_write',
      `Expected true for execute_limited tier, got ${tier.allow_write}`
    );
  }

  // 检查 WRITE_LIMITED 在 allowed_actions 中
  if (tier.allowed_actions && !tier.allowed_actions.includes('WRITE_LIMITED')) {
    logWarning(
      'tiers.execute_limited.allowed_actions',
      'WRITE_LIMITED not in allowed_actions for execute_limited tier'
    );
  }

  // 检查 constraints 存在
  if (!tier.constraints) {
    logWarning('tiers.execute_limited', 'Missing constraints field (recommended for safety)');
  } else {
    // 检查关键约束字段
    const expectedConstraints = ['max_actions_per_day', 'mandatory_rollback_plan'];
    for (const constraint of expectedConstraints) {
      if (tier.constraints[constraint] === undefined) {
        logWarning(`tiers.execute_limited.constraints`, `Missing recommended constraint: ${constraint}`);
      }
    }
  }
}

/**
 * 校验 observe 和 recommend 层不允许写入
 */
function validateNoWriteTiers(config) {
  const noWriteTiers = ['observe', 'recommend'];

  for (const tierName of noWriteTiers) {
    const tier = config.tiers?.[tierName];
    if (!tier) continue;

    if (tier.allow_write === true) {
      logError(
        `tiers.${tierName}.allow_write`,
        `SAFETY VIOLATION: Must be false for ${tierName} tier. Only execute_limited can write.`
      );
    }

    if (tier.allowed_actions?.includes('WRITE_LIMITED')) {
      logError(
        `tiers.${tierName}.allowed_actions`,
        `SAFETY VIOLATION: WRITE_LIMITED not allowed in ${tierName} tier`
      );
    }
  }
}

/**
 * 校验 default_tier
 */
function validateDefaultTier(config) {
  if (!config.default_tier) {
    logWarning('default_tier', 'Missing default_tier, will use "observe"');
    return;
  }

  if (!REQUIRED_TIERS.includes(config.default_tier)) {
    logError('default_tier', `Invalid value "${config.default_tier}". Must be one of: ${REQUIRED_TIERS.join(', ')}`);
    return;
  }

  // 安全建议：default_tier 不应该是 execute_limited
  if (config.default_tier === 'execute_limited') {
    logWarning('default_tier', 'Dangerous: default_tier = execute_limited. Consider using observe or recommend.');
  }

  logPass('default_tier');
}

/**
 * 校验 kill_switch_integration
 */
function validateKillSwitchIntegration(config) {
  if (!config.kill_switch_integration) {
    logWarning('kill_switch_integration', 'Missing kill_switch_integration section');
    return;
  }

  const ksi = config.kill_switch_integration;
  if (!ksi.when_active) {
    logWarning('kill_switch_integration.when_active', 'Missing when_active section');
    return;
  }

  // 检查 deny_actions 包含 WRITE_LIMITED
  if (!ksi.when_active.deny_actions?.includes('WRITE_LIMITED')) {
    logError(
      'kill_switch_integration.when_active.deny_actions',
      'SAFETY VIOLATION: Must include WRITE_LIMITED when kill_switch is active'
    );
    return;
  }

  logPass('kill_switch_integration (WRITE_LIMITED denied when active)');
}

/**
 * 校验 transitions[].requires 的 token（EVO-C D-5 / ADR-Learning-Stack-Generations §D-09）
 * walk 每个 requires entry，对不在 LIVE_TRANSITION_TOKENS 的 orphan token fail-closed
 * （errorCount++ → exit 1）。防止 superseded 模块（如 tier_manager）的死配置 token 静默残留。
 */
function validateTransitionTokens(config) {
  if (!config.transitions) {
    logWarning('transitions', 'Missing transitions section');
    return;
  }

  if (!Array.isArray(config.transitions)) {
    logError('transitions', `Must be array, got ${typeof config.transitions}`);
    return;
  }

  let orphanFound = false;
  for (let i = 0; i < config.transitions.length; i++) {
    const requires = config.transitions[i]?.requires;
    if (requires === undefined) continue;

    if (!Array.isArray(requires)) {
      logError(`transitions[${i}].requires`, `Must be array, got ${typeof requires}`);
      orphanFound = true;
      continue;
    }

    for (const token of requires) {
      if (!LIVE_TRANSITION_TOKENS.includes(token)) {
        logError(
          `transitions[${i}].requires`,
          `Orphan token "${token}" not in live-token allowlist {${LIVE_TRANSITION_TOKENS.join(', ')}}. ` +
          `Superseded-module config tokens must be removed (ADR-Learning-Stack-Generations §D-A2/§D-09).`
        );
        orphanFound = true;
      }
    }
  }

  if (!orphanFound) {
    logPass('transitions[].requires (all tokens in live-token allowlist)');
  }
}

/**
 * 主校验流程
 */
function validate() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           Execution Tiers Validator v1.0.0');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n${CYAN}📋 Validating: ${CONFIG_PATH}${RESET}\n`);

  const config = loadConfig();
  if (!config) {
    return false;
  }

  logPass('Config file loaded');

  // 获取 action_whitelist（使用配置文件中的或默认的）
  const actionWhitelist = config.action_whitelist || DEFAULT_ACTION_WHITELIST;

  // 1. 版本
  console.log('\n--- Version Check ---');
  validateVersion(config);

  // 2. 三层齐全
  console.log('\n--- Required Tiers Check ---');
  const tiersPresent = validateRequiredTiers(config);

  if (tiersPresent) {
    // 3. 每层字段校验
    console.log('\n--- Tier Fields Check ---');
    for (const tierName of REQUIRED_TIERS) {
      const valid = validateTierFields(tierName, config.tiers[tierName], actionWhitelist);
      if (valid) {
        logPass(`tiers.${tierName} (fields valid)`);
      }
    }

    // 4. 安全约束
    console.log('\n--- Safety Constraints Check ---');
    validateExecuteLimitedSafety(config);
    validateNoWriteTiers(config);
  }

  // 5. default_tier
  console.log('\n--- Default Tier Check ---');
  validateDefaultTier(config);

  // 6. kill_switch_integration
  console.log('\n--- Kill Switch Integration Check ---');
  validateKillSwitchIntegration(config);

  // 7. transitions token 白名单（EVO-C D-5 / §D-09：orphan token fail-closed）
  console.log('\n--- Transition Tokens Check ---');
  validateTransitionTokens(config);

  // 汇总
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('           Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  ${GREEN}✅ Passed: ${passCount}${RESET}`);
  console.log(`  ${YELLOW}⚠️  Warnings: ${warningCount}${RESET}`);
  console.log(`  ${RED}❌ Errors: ${errorCount}${RESET}`);
  console.log('═══════════════════════════════════════════════════════════');

  return errorCount === 0;
}

// 主入口
const success = validate();

if (success) {
  console.log(`\n${GREEN}PASSED: Execution tiers configuration is valid.${RESET}\n`);
  process.exit(0);
} else {
  console.log(`\n${RED}FAILED: ${errorCount} error(s) found. Fix before merge.${RESET}\n`);
  process.exit(1);
}
