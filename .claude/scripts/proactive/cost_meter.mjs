#!/usr/bin/env node
/**
 * Cost Meter v1.0.0
 * SSOT: .claude/scripts/proactive/cost_meter.mjs
 *
 * Purpose: Cost metering for heartbeat learning pipeline
 * - Records cost events to append-only facts
 * - Manages daily budget tracking
 * - Provides preflight budget check and post-run cost recording
 *
 * Architecture:
 * - LiYe OS = Control Plane: owns cost metering, budget gate
 * - fail-closed: config errors → SKIP + record facts
 * - append-only: facts never rewritten, SKIP paths also record
 *
 * ENV Variables (priority: kill_switch > ENV > state > default):
 * - LIYE_COST_METER_ENABLED: true|false
 * - LIYE_COST_DAILY_BUDGET_UNITS: number (1-10000)
 * - LIYE_COST_DENY_ACTION: skip_all|skip_notify_only
 * - LIYE_COST_NOTIFY_POLICY: off|bundle_or_error|always
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const CONFIG_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'cost_meter.json');
const STATE_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'cost_meter_state.json');
const FACTS_FILE = join(PROJECT_ROOT, 'data', 'facts', 'fact_cost_events.jsonl');

// ============================================================================
// Defaults
// ============================================================================

const DEFAULTS = {
  enabled_default: false,
  daily_budget_units: 200,
  deny_action: 'skip_notify_only',
  notify_policy: 'bundle_or_error',
  cost_weights: {
    discover_runs: 1,
    learning_pipeline: 2,
    bundle_build: 3,
    validate_bundle: 2,
    notifier: 5,
    operator_callback: 1,
    business_probe: 2
  },
  error_policy: 'fail_closed',
  window_timezone: 'UTC'
};

const VALID_BOOLEAN_VALUES = {
  'true': true, '1': true, 'yes': true, 'on': true,
  'false': false, '0': false, 'no': false, 'off': false
};

const VALID_DENY_ACTIONS = ['skip_all', 'skip_notify_only'];
const VALID_NOTIFY_POLICIES = ['off', 'bundle_or_error', 'always'];

// ============================================================================
// Config Loading
// ============================================================================

function loadConfig() {
  if (!existsSync(CONFIG_FILE)) {
    return { ...DEFAULTS };
  }
  try {
    const content = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    return { ...DEFAULTS, ...content };
  } catch (e) {
    // Config parse error → return defaults but mark error
    return { ...DEFAULTS, _parse_error: e.message };
  }
}

function loadState() {
  const today = new Date().toISOString().slice(0, 10);
  const defaultState = {
    version: 1,
    current_date_utc: today,
    daily_used_units: 0,
    last_reset_at: new Date().toISOString(),
    last_event_id: null,
    total_events_today: 0
  };

  if (!existsSync(STATE_FILE)) {
    return defaultState;
  }

  try {
    const state = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));

    // Check if we need to reset (new day)
    if (state.current_date_utc !== today) {
      return {
        ...defaultState,
        current_date_utc: today,
        daily_used_units: 0,
        last_reset_at: new Date().toISOString(),
        total_events_today: 0
      };
    }

    return state;
  } catch (e) {
    return defaultState;
  }
}

function saveState(state) {
  const dir = dirname(STATE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ============================================================================
// ENV Resolution
// ============================================================================

function resolveBooleanEnv(name) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return { value: null, source: 'not_set', error: null };
  }

  const normalized = raw.toLowerCase().trim();
  if (normalized in VALID_BOOLEAN_VALUES) {
    return { value: VALID_BOOLEAN_VALUES[normalized], source: 'env', error: null };
  }

  return {
    value: null,
    source: 'env_invalid',
    error: `Invalid boolean value for ${name}: "${raw}"`,
    error_code: 'ENV_BOOL_INVALID'
  };
}

function resolveNumberEnv(name, { min = 1, max = 10000 } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return { value: null, source: 'not_set', error: null };
  }

  const num = parseInt(raw, 10);
  if (isNaN(num)) {
    return {
      value: null,
      source: 'env_invalid',
      error: `Invalid number value for ${name}: "${raw}"`,
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

function resolveEnumEnv(name, validValues) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return { value: null, source: 'not_set', error: null };
  }

  const normalized = raw.toLowerCase().trim();
  if (validValues.includes(normalized)) {
    return { value: normalized, source: 'env', error: null };
  }

  return {
    value: null,
    source: 'env_invalid',
    error: `Invalid value for ${name}: "${raw}". Expected: ${validValues.join('|')}`,
    error_code: 'ENV_ENUM_INVALID'
  };
}

// ============================================================================
// Switch Resolution
// ============================================================================

/**
 * Resolve cost meter switches (priority: kill_switch > ENV > state > default)
 * @returns {{ effective, source, config_errors, error_codes, action }}
 */
export function resolveCostSwitch() {
  const config = loadConfig();
  const config_errors = [];
  const error_codes = [];

  // Check for config parse error
  if (config._parse_error) {
    config_errors.push(`Config parse error: ${config._parse_error}`);
    error_codes.push('CONFIG_PARSE_ERROR');
  }

  // 1. Check kill switch (ENV: LIYE_COST_KILL_SWITCH)
  const envKill = process.env.LIYE_COST_KILL_SWITCH;
  let killSwitchActive = false;
  let killSource = 'none';

  if (envKill !== undefined && envKill !== '') {
    const normalized = envKill.toLowerCase().trim();
    if (normalized in VALID_BOOLEAN_VALUES && VALID_BOOLEAN_VALUES[normalized]) {
      killSwitchActive = true;
      killSource = 'env';
    }
  }

  // 2. Resolve enabled (ENV > config > default)
  const envEnabled = resolveBooleanEnv('LIYE_COST_METER_ENABLED');
  if (envEnabled.error) {
    config_errors.push(envEnabled.error);
    error_codes.push(envEnabled.error_code);
  }

  let effective_enabled, enabled_source;
  if (envEnabled.value !== null) {
    effective_enabled = envEnabled.value;
    enabled_source = 'env';
  } else if (envEnabled.source === 'env_invalid') {
    effective_enabled = false;  // fail-closed
    enabled_source = 'env_invalid_fail_closed';
  } else {
    effective_enabled = config.enabled_default;
    enabled_source = existsSync(CONFIG_FILE) ? 'config' : 'default';
  }

  // 3. Resolve daily_budget_units (ENV > config > default)
  const envBudget = resolveNumberEnv('LIYE_COST_DAILY_BUDGET_UNITS', { min: 1, max: 10000 });
  if (envBudget.error) {
    config_errors.push(envBudget.error);
    error_codes.push(envBudget.error_code);
  }

  let effective_budget, budget_source;
  if (envBudget.value !== null) {
    effective_budget = envBudget.value;
    budget_source = 'env';
  } else if (envBudget.source === 'env_invalid') {
    effective_budget = config.daily_budget_units || DEFAULTS.daily_budget_units;
    budget_source = 'env_invalid_use_default';
  } else {
    effective_budget = config.daily_budget_units || DEFAULTS.daily_budget_units;
    budget_source = existsSync(CONFIG_FILE) ? 'config' : 'default';
  }

  // 4. Resolve deny_action (ENV > config > default)
  const envDenyAction = resolveEnumEnv('LIYE_COST_DENY_ACTION', VALID_DENY_ACTIONS);
  if (envDenyAction.error) {
    config_errors.push(envDenyAction.error);
    error_codes.push(envDenyAction.error_code);
  }

  let effective_deny_action, deny_action_source;
  if (envDenyAction.value !== null) {
    effective_deny_action = envDenyAction.value;
    deny_action_source = 'env';
  } else if (envDenyAction.source === 'env_invalid') {
    effective_deny_action = config.deny_action || DEFAULTS.deny_action;
    deny_action_source = 'env_invalid_use_default';
  } else {
    effective_deny_action = config.deny_action || DEFAULTS.deny_action;
    deny_action_source = existsSync(CONFIG_FILE) ? 'config' : 'default';
  }

  // 5. Resolve notify_policy (ENV > config > default)
  const envNotifyPolicy = resolveEnumEnv('LIYE_COST_NOTIFY_POLICY', VALID_NOTIFY_POLICIES);
  if (envNotifyPolicy.error) {
    config_errors.push(envNotifyPolicy.error);
    error_codes.push(envNotifyPolicy.error_code);
  }

  let effective_notify_policy, notify_policy_source;
  if (envNotifyPolicy.value !== null) {
    effective_notify_policy = envNotifyPolicy.value;
    notify_policy_source = 'env';
  } else if (envNotifyPolicy.source === 'env_invalid') {
    effective_notify_policy = config.notify_policy || DEFAULTS.notify_policy;
    notify_policy_source = 'env_invalid_use_default';
  } else {
    effective_notify_policy = config.notify_policy || DEFAULTS.notify_policy;
    notify_policy_source = existsSync(CONFIG_FILE) ? 'config' : 'default';
  }

  // 6. Get cost weights
  const cost_weights = config.cost_weights || DEFAULTS.cost_weights;

  // 7. Determine action
  let action;
  if (killSwitchActive) {
    action = 'SKIP';
  } else if (config_errors.length > 0 && config.error_policy === 'fail_closed') {
    action = 'SKIP';
  } else if (!effective_enabled) {
    action = 'DISABLED';  // Not an error, just disabled
  } else {
    action = 'ENABLED';
  }

  return {
    effective: {
      enabled: effective_enabled,
      daily_budget_units: effective_budget,
      deny_action: effective_deny_action,
      notify_policy: effective_notify_policy,
      cost_weights
    },
    source: {
      enabled: enabled_source,
      daily_budget_units: budget_source,
      deny_action: deny_action_source,
      notify_policy: notify_policy_source
    },
    kill_switch: { active: killSwitchActive, source: killSource },
    config_errors,
    error_codes,
    action
  };
}

// ============================================================================
// Facts Recording (append-only)
// ============================================================================

function appendCostFact(fact) {
  const dir = dirname(FACTS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const record = {
    ts: new Date().toISOString(),
    ...fact
  };

  appendFileSync(FACTS_FILE, JSON.stringify(record) + '\n');
  return record;
}

/**
 * Record cost_switch_resolved event (audit required)
 */
export function recordSwitchResolvedFact(runId, switchResult) {
  return appendCostFact({
    event_type: 'cost_switch_resolved',
    run_id: runId,
    component: 'heartbeat_runner',
    quantity: 1,
    unit: 'count',
    cost_units: 0,  // Switch resolution itself is free
    meta: {
      effective: switchResult.effective,
      source: switchResult.source,
      action: switchResult.action,
      config_errors: switchResult.config_errors,
      error_codes: switchResult.error_codes
    }
  });
}

/**
 * Record cost_config_error event (fail-closed audit)
 */
export function recordConfigErrorFact(runId, errors, errorCodes) {
  return appendCostFact({
    event_type: 'cost_config_error',
    run_id: runId,
    component: 'heartbeat_runner',
    quantity: errors.length,
    unit: 'count',
    cost_units: 0,
    meta: {
      config_errors: errors,
      error_codes: errorCodes,
      reason: 'fail_closed'
    }
  });
}

/**
 * Record cost_meter_skipped event (when cost meter is disabled)
 */
export function recordMeterSkippedFact(runId, reason) {
  return appendCostFact({
    event_type: 'cost_meter_skipped',
    run_id: runId,
    component: 'heartbeat_runner',
    quantity: 1,
    unit: 'count',
    cost_units: 0,
    meta: { reason }
  });
}

/**
 * Record cost_budget_exceeded event
 */
export function recordBudgetExceededFact(runId, projectedCost, remainingBudget, denyAction) {
  return appendCostFact({
    event_type: 'cost_budget_exceeded',
    run_id: runId,
    component: 'heartbeat_runner',
    quantity: 1,
    unit: 'count',
    cost_units: 0,
    meta: {
      projected_cost_units: projectedCost,
      remaining_budget_units: remainingBudget,
      deny_action: denyAction,
      reason: 'daily_budget_exceeded'
    }
  });
}

/**
 * Record cost_event_recorded for each step
 */
export function recordCostEventFact(runId, component, quantity, unit, costUnits, inputsHash = null) {
  const state = loadState();
  const eventId = randomUUID().slice(0, 8);

  // Update state
  state.daily_used_units += costUnits;
  state.last_event_id = eventId;
  state.total_events_today += 1;
  saveState(state);

  return appendCostFact({
    event_type: 'cost_event_recorded',
    run_id: runId,
    inputs_hash: inputsHash,
    component,
    quantity,
    unit,
    cost_units: costUnits,
    meta: {
      event_id: eventId,
      remaining_budget_units: state.daily_used_units
    }
  });
}

// ============================================================================
// Budget Check (Preflight)
// ============================================================================

/**
 * Check if we have budget for projected costs
 * @param {Object} projectedSteps - { discover_runs: 1, learning_pipeline: 1, ... }
 * @returns {{ passed: boolean, action: string, projected_cost: number, remaining_budget: number }}
 */
export function checkBudget(projectedSteps = {}) {
  const switchResult = resolveCostSwitch();

  // If cost meter is disabled, always pass
  if (switchResult.action !== 'ENABLED') {
    return {
      passed: true,
      action: 'PASS',
      reason: switchResult.action === 'DISABLED' ? 'cost_meter_disabled' : 'config_error',
      projected_cost: 0,
      remaining_budget: switchResult.effective.daily_budget_units
    };
  }

  const state = loadState();
  const weights = switchResult.effective.cost_weights;

  // Calculate projected cost
  let projectedCost = 0;
  for (const [step, count] of Object.entries(projectedSteps)) {
    if (weights[step]) {
      projectedCost += weights[step] * count;
    }
  }

  const usedBudget = state.daily_used_units;
  const totalBudget = switchResult.effective.daily_budget_units;
  const remainingBudget = totalBudget - usedBudget;

  // Check if we have enough budget
  if (projectedCost > remainingBudget) {
    return {
      passed: false,
      action: switchResult.effective.deny_action,
      reason: 'budget_exceeded',
      projected_cost: projectedCost,
      remaining_budget: remainingBudget,
      daily_used: usedBudget,
      daily_budget: totalBudget
    };
  }

  return {
    passed: true,
    action: 'PASS',
    reason: 'budget_ok',
    projected_cost: projectedCost,
    remaining_budget: remainingBudget,
    daily_used: usedBudget,
    daily_budget: totalBudget
  };
}

// ============================================================================
// Post-Run Cost Recording
// ============================================================================

/**
 * Record costs for completed steps
 * @param {string} runId - Heartbeat run ID
 * @param {Object} steps - { discover_runs: { count: 1, ms: 123 }, ... }
 * @param {string} inputsHash - SHA256 of inputs (optional)
 */
export function recordCosts(runId, steps, inputsHash = null) {
  const switchResult = resolveCostSwitch();

  // Always record switch resolution first
  recordSwitchResolvedFact(runId, switchResult);

  // If disabled, record skip and return
  if (switchResult.action !== 'ENABLED') {
    recordMeterSkippedFact(runId, switchResult.action === 'DISABLED' ? 'cost_meter_disabled' : 'config_error');
    return { recorded: false, reason: switchResult.action };
  }

  const weights = switchResult.effective.cost_weights;
  let totalCost = 0;
  const events = [];

  // Record each step
  for (const [component, data] of Object.entries(steps)) {
    const weight = weights[component] || 1;
    const count = data.count || 1;
    const costUnits = weight * count;
    totalCost += costUnits;

    const event = recordCostEventFact(
      runId,
      component,
      count,
      data.unit || 'count',
      costUnits,
      inputsHash
    );
    events.push(event);
  }

  return {
    recorded: true,
    total_cost: totalCost,
    events_count: events.length
  };
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { action: 'status', runId: null, steps: {} };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === 'status') options.action = 'status';
    else if (arg === 'check') options.action = 'check';
    else if (arg === 'record') options.action = 'record';
    else if (arg === '--run-id' && args[i + 1]) options.runId = args[++i];
    else if (arg === '--json') options.json = true;
  }

  return options;
}

async function main() {
  const options = parseArgs();

  if (options.action === 'status') {
    const switchResult = resolveCostSwitch();
    const state = loadState();

    const status = {
      switch: switchResult,
      state,
      budget: {
        daily_limit: switchResult.effective.daily_budget_units,
        used: state.daily_used_units,
        remaining: switchResult.effective.daily_budget_units - state.daily_used_units
      }
    };

    console.log(JSON.stringify(status, null, 2));
  } else if (options.action === 'check') {
    // Default projected steps for a full heartbeat run
    const projectedSteps = {
      discover_runs: 1,
      learning_pipeline: 1,
      bundle_build: 1,
      validate_bundle: 1,
      notifier: 1
    };

    const result = checkBudget(projectedSteps);
    console.log(JSON.stringify(result, null, 2));

    process.exit(result.passed ? 0 : 1);
  } else if (options.action === 'record') {
    const runId = options.runId || `cost-test-${Date.now()}`;
    const steps = {
      discover_runs: { count: 1, unit: 'count' },
      learning_pipeline: { count: 1, unit: 'count' }
    };

    const result = recordCosts(runId, steps);
    console.log(JSON.stringify(result, null, 2));
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
