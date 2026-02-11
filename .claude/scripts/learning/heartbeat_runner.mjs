#!/usr/bin/env node
/**
 * Heartbeat Learning Runner v1.0.0
 * SSOT: .claude/scripts/learning/heartbeat_runner.mjs
 *
 * Heartbeat Orchestrator：自动运行学习流水线
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const STATE_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'heartbeat_learning_state.json');
const FACTS_FILE = join(PROJECT_ROOT, 'state', 'memory', 'facts', 'fact_run_outcomes.jsonl');
const KILL_SWITCH_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'kill_switches.json');
const LOCK_TIMEOUT_MS = 20 * 60 * 1000;

function loadState() {
  if (!existsSync(STATE_FILE)) {
    return {
      version: 1,
      enabled: true,
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

function checkKillSwitch(key = 'learning_heartbeat') {
  if (!existsSync(KILL_SWITCH_FILE)) return { enabled: true, reason: null };
  try {
    const switches = JSON.parse(readFileSync(KILL_SWITCH_FILE, 'utf-8'));
    if (switches[key] === false) return { enabled: false, reason: `kill_switch:${key}` };
    return { enabled: true, reason: null };
  } catch (e) {
    return { enabled: true, reason: null };
  }
}

function checkCooldown(state) {
  if (!state.last_run_at) return { passed: true, remaining_minutes: 0 };
  const lastRun = new Date(state.last_run_at);
  const now = new Date();
  const elapsedMinutes = (now - lastRun) / (1000 * 60);
  const cooldownMinutes = state.cooldown_minutes || 30;
  if (elapsedMinutes < cooldownMinutes) {
    return { passed: false, remaining_minutes: Math.ceil(cooldownMinutes - elapsedMinutes) };
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

function appendHeartbeatFact(fact) {
  const dir = dirname(FACTS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const record = { event_type: 'heartbeat_learning_run', timestamp: new Date().toISOString(), ...fact };
  appendFileSync(FACTS_FILE, JSON.stringify(record) + '\n');
}

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

  const state = loadState();

  // Step 1: Kill Switch
  console.error('[heartbeat] Step 1: Kill switch check...');
  const killCheck = checkKillSwitch('learning_heartbeat');
  result.steps.kill_switch = killCheck;
  if (!killCheck.enabled) {
    result.action = 'skipped';
    result.steps.skip_reason = 'kill_switch';
    return result;
  }

  // Step 2: Cooldown
  console.error('[heartbeat] Step 2: Cooldown check...');
  const cooldownCheck = checkCooldown(state);
  result.steps.cooldown = cooldownCheck;
  if (!cooldownCheck.passed) {
    result.action = 'skipped';
    result.steps.skip_reason = 'cooldown';
    return result;
  }

  // Step 3: Lock
  console.error('[heartbeat] Step 3: Acquiring lock...');
  const lockResult = tryAcquireLock(state);
  result.steps.lock = lockResult;
  if (!lockResult.acquired) {
    result.action = 'skipped';
    result.steps.skip_reason = 'lock_held';
    return result;
  }
  if (!dryRun) saveState(state);

  try {
    // Step 4: Discover
    console.error('[heartbeat] Step 4: Discovering new runs...');
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

    // Step 5: Pipeline
    console.error('[heartbeat] Step 5: Running pipeline...');
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
      appendHeartbeatFact({ status: 'error', error: pipelineResult.error });
      return result;
    }

    // Step 6: Bundle
    console.error('[heartbeat] Step 6: Building bundle on change...');
    const bundleResult = buildOnChange({
      baseVersion: state.bundle.last_version,
      dryRun
    });
    result.steps.bundle = bundleResult;

    // Step 7: Facts
    console.error('[heartbeat] Step 7: Recording facts...');
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

    // Step 8: Notification
    result.steps.notification = { should_notify: bundleResult.content_sha_changed };

    // Step 9: Update state
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
