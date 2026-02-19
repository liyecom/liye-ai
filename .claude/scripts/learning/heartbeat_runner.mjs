#!/usr/bin/env node
/**
 * Heartbeat Learning Runner v2.0.0
 * SSOT: .claude/scripts/learning/heartbeat_runner.mjs
 *
 * Heartbeat Orchestrator：自动运行学习流水线
 *
 * 双开关治理：
 * - A（ENV）= 点火按钮：LIYE_HEARTBEAT_ENABLED, LIYE_HEARTBEAT_NOTIFY_POLICY, LIYE_HEARTBEAT_COOLDOWN_MINUTES
 * - B（state/config）= 长期默认策略：heartbeat_learning_state.json
 * - 优先级：ENV > state/config > default(false)
 * - Fail-closed：非法 ENV → 强制 SKIP + 记录 facts
 *
 * 用法:
 *   node heartbeat_runner.mjs [--dry-run] [--json] [--fixtures <dir>]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

import { discoverNewRuns } from './discover_new_runs.mjs';
import { runLearningPipeline } from './learning_pipeline_v0_runner.mjs';
import { buildOnChange } from './bundle_build_on_change.mjs';
import {
  resolveCostSwitch,
  checkBudget,
  recordCosts,
  recordSwitchResolvedFact,
  recordBudgetExceededFact,
  checkAndRecordDayReset
} from '../proactive/cost_meter.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const STATE_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'heartbeat_learning_state.json');
const FACTS_FILE = join(PROJECT_ROOT, 'state', 'memory', 'facts', 'fact_run_outcomes.jsonl');
const KILL_SWITCH_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'kill_switch.json');
const LOCK_TIMEOUT_MS = 20 * 60 * 1000;

// ============================================================================
// 双开关解析（ENV > state > default）
// ============================================================================

const VALID_BOOLEAN_VALUES = {
  'true': true, '1': true, 'yes': true, 'on': true,
  'false': false, '0': false, 'no': false, 'off': false
};

const VALID_NOTIFY_POLICIES = ['off', 'bundle_or_error', 'always'];

const DEFAULTS = {
  enabled: false,           // 合并即安全
  notify_policy: 'bundle_or_error',
  cooldown_minutes: 30
};

/**
 * 解析布尔环境变量（fail-closed）
 * @returns {{ value: boolean|null, source: string, error: string|null }}
 */
function resolveBooleanEnv(name) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return { value: null, source: 'not_set', error: null };
  }

  const normalized = raw.toLowerCase().trim();
  if (normalized in VALID_BOOLEAN_VALUES) {
    return { value: VALID_BOOLEAN_VALUES[normalized], source: 'env', error: null };
  }

  // 非法值 → fail-closed
  return {
    value: null,
    source: 'env_invalid',
    error: `Invalid boolean value for ${name}: "${raw}". Expected: true|false|1|0|yes|no|on|off`,
    error_code: 'ENV_BOOL_INVALID'
  };
}

/**
 * 解析数字环境变量（fail-closed）
 * @returns {{ value: number|null, source: string, error: string|null }}
 */
function resolveNumberEnv(name, { min = 1, max = 1440 } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return { value: null, source: 'not_set', error: null };
  }

  const num = parseInt(raw, 10);
  if (isNaN(num)) {
    return {
      value: null,
      source: 'env_invalid',
      error: `Invalid number value for ${name}: "${raw}". Expected integer.`,
      error_code: 'ENV_NUMBER_INVALID'
    };
  }

  if (num < min || num > max) {
    return {
      value: null,
      source: 'env_invalid',
      error: `Value for ${name} out of range: ${num}. Expected ${min}-${max}.`,
      error_code: 'ENV_NUMBER_OUT_OF_RANGE'
    };
  }

  return { value: num, source: 'env', error: null };
}

/**
 * 解析通知策略环境变量
 * @returns {{ value: string|null, source: string, error: string|null }}
 */
function resolveNotifyPolicyEnv() {
  const raw = process.env.LIYE_HEARTBEAT_NOTIFY_POLICY;
  if (raw === undefined || raw === '') {
    return { value: null, source: 'not_set', error: null };
  }

  const normalized = raw.toLowerCase().trim();
  if (VALID_NOTIFY_POLICIES.includes(normalized)) {
    return { value: normalized, source: 'env', error: null };
  }

  return {
    value: null,
    source: 'env_invalid',
    error: `Invalid notify_policy: "${raw}". Expected: ${VALID_NOTIFY_POLICIES.join('|')}`,
    error_code: 'ENV_NOTIFY_POLICY_INVALID'
  };
}

/**
 * 检查 kill switch（最高优先级）
 * @returns {{ active: boolean, source: string }}
 */
function checkKillSwitch() {
  // ENV kill switch（最高优先级）
  const envKill = process.env.LIYE_KILL_SWITCH;
  if (envKill !== undefined && envKill !== '') {
    const normalized = envKill.toLowerCase().trim();
    if (normalized in VALID_BOOLEAN_VALUES && VALID_BOOLEAN_VALUES[normalized]) {
      return { active: true, source: 'env' };
    }
  }

  // State file kill switch
  if (existsSync(KILL_SWITCH_FILE)) {
    try {
      const switches = JSON.parse(readFileSync(KILL_SWITCH_FILE, 'utf-8'));
      // learning_heartbeat=false 表示禁用
      if (switches.learning_heartbeat === false) {
        return { active: true, source: 'state' };
      }
    } catch (e) {
      // 解析失败 → fail-closed
      return { active: true, source: 'state_parse_error' };
    }
  }

  return { active: false, source: 'none' };
}

/**
 * 解析双开关配置（核心函数）
 * 优先级：kill_switch > ENV > state > default
 * @returns {{ effective, source, config_errors, action }}
 */
function resolveSwitches() {
  const state = loadState();
  const config_errors = [];
  const error_codes = [];  // 建议 1：统一错误码

  // 1. Kill Switch（最高优先级）
  const killSwitch = checkKillSwitch();

  // 2. 解析 enabled（ENV > state > default）
  const envEnabled = resolveBooleanEnv('LIYE_HEARTBEAT_ENABLED');
  if (envEnabled.error) {
    config_errors.push(envEnabled.error);
    if (envEnabled.error_code) error_codes.push(envEnabled.error_code);
  }

  let effective_enabled, enabled_source;
  if (envEnabled.value !== null) {
    effective_enabled = envEnabled.value;
    enabled_source = 'env';
  } else if (envEnabled.source === 'env_invalid') {
    // 非法 ENV → fail-closed
    effective_enabled = false;
    enabled_source = 'env_invalid_fail_closed';
  } else if (state.enabled !== undefined) {
    effective_enabled = state.enabled;
    enabled_source = 'state';
  } else {
    effective_enabled = DEFAULTS.enabled;
    enabled_source = 'default';
  }

  // 3. 解析 notify_policy（ENV > state > default）
  const envNotify = resolveNotifyPolicyEnv();
  if (envNotify.error) {
    config_errors.push(envNotify.error);
    if (envNotify.error_code) error_codes.push(envNotify.error_code);
  }

  let effective_notify_policy, notify_source;
  if (envNotify.value !== null) {
    effective_notify_policy = envNotify.value;
    notify_source = 'env';
  } else if (envNotify.source === 'env_invalid') {
    effective_notify_policy = DEFAULTS.notify_policy;
    notify_source = 'env_invalid_use_default';
  } else if (state.notify_policy !== undefined) {
    effective_notify_policy = state.notify_policy;
    notify_source = 'state';
  } else {
    effective_notify_policy = DEFAULTS.notify_policy;
    notify_source = 'default';
  }

  // 4. 解析 cooldown_minutes（ENV > state > default）
  const envCooldown = resolveNumberEnv('LIYE_HEARTBEAT_COOLDOWN_MINUTES', { min: 1, max: 1440 });
  if (envCooldown.error) {
    config_errors.push(envCooldown.error);
    if (envCooldown.error_code) error_codes.push(envCooldown.error_code);
  }

  let effective_cooldown_minutes, cooldown_source;
  if (envCooldown.value !== null) {
    effective_cooldown_minutes = envCooldown.value;
    cooldown_source = 'env';
  } else if (envCooldown.source === 'env_invalid') {
    effective_cooldown_minutes = DEFAULTS.cooldown_minutes;
    cooldown_source = 'env_invalid_use_default';
  } else if (state.cooldown_minutes !== undefined) {
    effective_cooldown_minutes = state.cooldown_minutes;
    cooldown_source = 'state';
  } else {
    effective_cooldown_minutes = DEFAULTS.cooldown_minutes;
    cooldown_source = 'default';
  }

  // 5. 最终决策
  let action;
  if (killSwitch.active) {
    action = 'SKIP';
  } else if (config_errors.length > 0 && enabled_source === 'env_invalid_fail_closed') {
    action = 'SKIP';  // fail-closed
  } else if (effective_enabled) {
    action = 'RUN';
  } else {
    action = 'SKIP';
  }

  return {
    effective: {
      enabled: effective_enabled,
      notify_policy: effective_notify_policy,
      cooldown_minutes: effective_cooldown_minutes
    },
    source: {
      enabled: enabled_source,
      notify_policy: notify_source,
      cooldown_minutes: cooldown_source
    },
    kill_switch: killSwitch,
    config_errors,
    error_codes,  // 建议 1：统一错误码
    action
  };
}

// ============================================================================
// 状态管理
// ============================================================================

function loadState() {
  if (!existsSync(STATE_FILE)) {
    return {
      version: 1,
      enabled: false,  // 默认禁用（合并即安全）
      notify_policy: 'bundle_or_error',
      cooldown_minutes: 30,
      last_run_at: null,
      last_window_end: null,
      last_processed_run_id: null,
      lock: { locked_at: null, lock_id: null },
      bundle: { last_content_sha: null, last_version: '0.4.0', last_artifact_path: null }
    };
  }
  return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
}

function saveState(state) {
  const dir = dirname(STATE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function checkCooldown(state, effectiveCooldownMinutes) {
  if (!state.last_run_at) return { passed: true, remaining_minutes: 0 };
  const lastRun = new Date(state.last_run_at);
  const now = new Date();
  const elapsedMinutes = (now - lastRun) / (1000 * 60);
  if (elapsedMinutes < effectiveCooldownMinutes) {
    return { passed: false, remaining_minutes: Math.ceil(effectiveCooldownMinutes - elapsedMinutes) };
  }
  return { passed: true, remaining_minutes: 0 };
}

function tryAcquireLock(state) {
  const now = Date.now();
  if (state.lock.locked_at && state.lock.lock_id) {
    const lockAge = now - new Date(state.lock.locked_at).getTime();
    if (lockAge < LOCK_TIMEOUT_MS) {
      return { acquired: false, reason: 'lock_held', held_by: state.lock.lock_id };
    }
  }
  const lockId = randomUUID().slice(0, 8);
  state.lock.locked_at = new Date().toISOString();
  state.lock.lock_id = lockId;
  return { acquired: true, lock_id: lockId };
}

function releaseLock(state) {
  state.lock.locked_at = null;
  state.lock.lock_id = null;
}

// ============================================================================
// Facts 记录（append-only）
// ============================================================================

function appendFact(fact) {
  const dir = dirname(FACTS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const record = { timestamp: new Date().toISOString(), ...fact };
  appendFileSync(FACTS_FILE, JSON.stringify(record) + '\n');
}

function appendSwitchResolvedFact(switchResult) {
  appendFact({
    event_type: 'heartbeat_switch_resolved',
    effective: switchResult.effective,
    source: switchResult.source,
    kill_switch: switchResult.kill_switch,
    config_errors: switchResult.config_errors,
    error_codes: switchResult.error_codes,  // 建议 1：统一错误码
    action: switchResult.action
  });
}

/**
 * 建议 2：当 enabled 从 false→true 时记录点火事件
 */
function appendIgnitedFact(switchResult) {
  appendFact({
    event_type: 'heartbeat_ignited',
    effective: switchResult.effective,
    source: switchResult.source,
    ignited_via: switchResult.source.enabled  // env/state
  });
}

function appendHeartbeatFact(fact) {
  appendFact({ event_type: 'heartbeat_learning_run', ...fact });
}

// ============================================================================
// 主流程
// ============================================================================

export async function runHeartbeat(options = {}) {
  const { dryRun = false, fixturesDir = null } = options;

  const result = {
    status: 'success',
    action: 'completed',
    timestamp: new Date().toISOString(),
    dry_run: dryRun,
    steps: {},
    error: null
  };

  // Step 0: 双开关解析
  console.error('[heartbeat] Step 0: Resolving switches (ENV > state > default)...');
  const switchResult = resolveSwitches();
  result.steps.switch_resolution = switchResult;

  // 记录开关决策到 facts（审计必需）
  if (!dryRun) {
    appendSwitchResolvedFact(switchResult);
  }

  // Kill switch 检查
  if (switchResult.kill_switch.active) {
    result.action = 'skipped';
    result.steps.skip_reason = 'kill_switch';
    result.steps.skip_source = switchResult.kill_switch.source;
    console.error(`[heartbeat] SKIP: kill_switch active (source: ${switchResult.kill_switch.source})`);
    return result;
  }

  // Config errors → fail-closed
  if (switchResult.config_errors.length > 0 && switchResult.action === 'SKIP') {
    result.action = 'skipped';
    result.steps.skip_reason = 'config_error_fail_closed';
    result.steps.config_errors = switchResult.config_errors;
    console.error(`[heartbeat] SKIP: config errors (fail-closed): ${switchResult.config_errors.join('; ')}`);
    return result;
  }

  // Enabled 检查
  if (!switchResult.effective.enabled) {
    result.action = 'skipped';
    result.steps.skip_reason = 'disabled';
    result.steps.disabled_source = switchResult.source.enabled;
    console.error(`[heartbeat] SKIP: disabled (source: ${switchResult.source.enabled})`);
    return result;
  }

  // 建议 2：记录点火事件（enabled=true 时）
  if (!dryRun && switchResult.effective.enabled) {
    appendIgnitedFact(switchResult);
    console.error(`[heartbeat] IGNITED via ${switchResult.source.enabled}`);
  }

  const state = loadState();

  // Step 1: Cooldown
  console.error('[heartbeat] Step 1: Cooldown check...');
  const cooldownCheck = checkCooldown(state, switchResult.effective.cooldown_minutes);
  result.steps.cooldown = cooldownCheck;
  if (!cooldownCheck.passed) {
    result.action = 'skipped';
    result.steps.skip_reason = 'cooldown';
    return result;
  }

  // Step 1.5: Cost Meter Preflight (budget check)
  console.error('[heartbeat] Step 1.5: Cost meter preflight check...');
  const runId = `heartbeat-${Date.now()}`;
  const costSwitchResult = resolveCostSwitch();
  result.steps.cost_switch = costSwitchResult;

  // Record cost switch resolution (audit required, even if disabled)
  if (!dryRun) {
    recordSwitchResolvedFact(runId, costSwitchResult);
    // Record day reset if UTC day boundary was crossed
    checkAndRecordDayReset(runId);
  }

  // If cost meter is enabled, check budget
  if (costSwitchResult.action === 'ENABLED') {
    const projectedSteps = {
      discover_runs: 1,
      learning_pipeline: 1,
      bundle_build: 1,
      validate_bundle: 1,
      notifier: 1
    };
    const budgetCheck = checkBudget(projectedSteps);
    result.steps.budget_check = budgetCheck;

    if (!budgetCheck.passed) {
      console.error(`[heartbeat] Cost budget exceeded: projected=${budgetCheck.projected_cost}, remaining=${budgetCheck.remaining_budget}`);

      // Record budget exceeded fact (audit required)
      if (!dryRun) {
        // Determine denied components based on deny_action
        const deniedComponents = budgetCheck.action === 'skip_all' ? ['all'] : ['notifier'];
        recordBudgetExceededFact(
          runId,
          budgetCheck.projected_cost,
          budgetCheck.remaining_budget,
          budgetCheck.action,
          deniedComponents
        );
      }

      // Apply deny_action
      if (budgetCheck.action === 'skip_all') {
        result.action = 'skipped';
        result.steps.skip_reason = 'cost_budget_exceeded';
        result.steps.cost_deny_action = 'skip_all';
        return result;
      } else {
        // skip_notify_only: continue but flag notification suppression
        result.steps.cost_suppress_notify = true;
        console.error('[heartbeat] Cost budget exceeded but continuing (skip_notify_only)');
      }
    }
  }

  // Step 2: Lock
  console.error('[heartbeat] Step 2: Acquiring lock...');
  const lockResult = tryAcquireLock(state);
  result.steps.lock = lockResult;
  if (!lockResult.acquired) {
    result.action = 'skipped';
    result.steps.skip_reason = 'lock_held';
    return result;
  }
  if (!dryRun) saveState(state);

  try {
    // Step 3: Discover
    console.error('[heartbeat] Step 3: Discovering new runs...');
    const discoverResult = discoverNewRuns({
      since: state.last_window_end,
      sinceRunId: state.last_processed_run_id,
      fixturesDir
    });
    result.steps.discover = discoverResult;

    if (discoverResult.new_run_ids.length === 0) {
      result.action = 'skipped';
      result.steps.skip_reason = 'no_new_runs';
      if (!dryRun) {
        state.last_run_at = new Date().toISOString();
        state.last_window_end = discoverResult.window_end;
        releaseLock(state);
        saveState(state);
      }
      return result;
    }

    // Step 4: Pipeline
    console.error('[heartbeat] Step 4: Running pipeline...');
    const pipelineResult = runLearningPipeline({
      windowStart: discoverResult.window_start,
      windowEnd: discoverResult.window_end,
      dryRun
    });
    result.steps.pipeline = pipelineResult;

    if (pipelineResult.status === 'error') {
      result.status = 'error';
      result.action = 'failed';
      result.error = pipelineResult.error;
      if (!dryRun) appendHeartbeatFact({ status: 'error', error: pipelineResult.error });
      return result;
    }

    // Step 5: Bundle
    console.error('[heartbeat] Step 5: Building bundle on change...');
    const bundleResult = buildOnChange({
      baseVersion: state.bundle.last_version,
      dryRun
    });
    result.steps.bundle = bundleResult;

    // Step 6: Facts
    console.error('[heartbeat] Step 6: Recording facts...');
    if (!dryRun) {
      appendHeartbeatFact({
        status: 'success',
        window: { start: discoverResult.window_start, end: discoverResult.window_end },
        pipeline: {
          patterns_count: pipelineResult.stages.pattern_detector.patterns_count,
          policies_generated: pipelineResult.stages.policy_crystallizer.policies_generated,
          promotions: pipelineResult.stages.promotion.promotions
        },
        bundle: {
          changed: bundleResult.content_sha_changed,
          version: bundleResult.bundle_version,
          sha: bundleResult.content_sha
        }
      });
    }
    result.steps.facts_recorded = true;

    // Step 7: Notification
    let shouldNotify = determineNotification(switchResult.effective.notify_policy, bundleResult, pipelineResult);

    // Apply cost suppression if budget exceeded with skip_notify_only
    if (result.steps.cost_suppress_notify) {
      shouldNotify = false;
      console.error('[heartbeat] Notification suppressed due to cost budget (skip_notify_only)');
    }

    result.steps.notification = {
      should_notify: shouldNotify,
      policy: switchResult.effective.notify_policy,
      suppressed_by_cost: result.steps.cost_suppress_notify || false
    };

    // Step 7.5: Cost Recording (post-run)
    console.error('[heartbeat] Step 7.5: Recording costs...');
    if (!dryRun && costSwitchResult.action === 'ENABLED') {
      const completedSteps = {
        discover_runs: { count: 1, unit: 'count' },
        learning_pipeline: { count: 1, unit: 'count' },
        bundle_build: { count: bundleResult.content_sha_changed ? 1 : 0, unit: 'count' },
        validate_bundle: { count: bundleResult.content_sha_changed ? 1 : 0, unit: 'count' },
        notifier: { count: shouldNotify ? 1 : 0, unit: 'count' }
      };

      const costResult = recordCosts(runId, completedSteps);
      result.steps.cost_recording = costResult;
    }

    // Step 8: Update state
    if (!dryRun) {
      state.last_run_at = new Date().toISOString();
      state.last_window_end = discoverResult.window_end;
      if (discoverResult.new_run_ids.length > 0) {
        state.last_processed_run_id = discoverResult.new_run_ids[discoverResult.new_run_ids.length - 1];
      }
      releaseLock(state);
      saveState(state);
    }

    result.action = 'completed';
    console.error('[heartbeat] Completed successfully.');

  } catch (error) {
    result.status = 'error';
    result.action = 'failed';
    result.error = error.message;
    if (!dryRun) appendHeartbeatFact({ status: 'error', error: error.message });
  } finally {
    if (!dryRun) {
      releaseLock(state);
      saveState(state);
    }
  }

  return result;
}

/**
 * 根据通知策略决定是否发送通知
 */
function determineNotification(notifyPolicy, bundleResult, pipelineResult) {
  switch (notifyPolicy) {
    case 'off':
      return false;
    case 'bundle_or_error':
      return bundleResult.content_sha_changed || pipelineResult.status === 'error';
    case 'always':
      return true;
    default:
      return bundleResult.content_sha_changed;
  }
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { dryRun: false, json: false, fixturesDir: null };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--fixtures' && args[i + 1]) options.fixturesDir = args[++i];
  }
  return options;
}

async function main() {
  const options = parseArgs();
  const result = await runHeartbeat({ dryRun: options.dryRun, fixturesDir: options.fixturesDir });
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Status: ${result.status}, Action: ${result.action}`);
  }
  process.exit(result.status === 'error' ? 1 : 0);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) main();
