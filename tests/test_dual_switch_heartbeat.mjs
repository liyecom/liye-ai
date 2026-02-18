#!/usr/bin/env node
/**
 * Dual-Switch Heartbeat Tests v1.0.0
 * SSOT: tests/test_dual_switch_heartbeat.mjs
 *
 * 覆盖 6 个核心用例：
 * 1. state enabled=false 且无 ENV → SKIP（默认安全）
 * 2. state enabled=false + LIYE_HEARTBEAT_ENABLED=true → RUN（ENV 点火成功）
 * 3. state enabled=true + LIYE_HEARTBEAT_ENABLED=false → SKIP（ENV 强制熄火）
 * 4. LIYE_HEARTBEAT_NOTIFY_POLICY=off → 不投递（但仍可跑学习/打包）
 * 5. LIYE_HEARTBEAT_ENABLED=maybe（非法）→ fail-closed：SKIP + facts 记录 config_error
 * 6. kill switch active → 永远 SKIP + 记录 source=kill_switch
 */

import { strict as assert } from 'assert';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const STATE_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'heartbeat_learning_state.json');
const KILL_SWITCH_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'kill_switch.json');
const EVIDENCE_DIR = join(PROJECT_ROOT, 'evidence');
const FIXTURES_DIR = join(__dirname, 'fixtures', 'heartbeat_learning');

// Backup and restore utilities
function backupState() {
  const backup = {};
  if (existsSync(STATE_FILE)) {
    backup.state = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  }
  if (existsSync(KILL_SWITCH_FILE)) {
    backup.killSwitch = JSON.parse(readFileSync(KILL_SWITCH_FILE, 'utf-8'));
  }
  return backup;
}

function restoreState(backup) {
  if (backup.state) {
    writeFileSync(STATE_FILE, JSON.stringify(backup.state, null, 2));
  }
  if (backup.killSwitch) {
    writeFileSync(KILL_SWITCH_FILE, JSON.stringify(backup.killSwitch, null, 2));
  }
}

function setTestState(stateOverrides = {}, killSwitchOverrides = null) {
  const defaultState = {
    version: 1,
    enabled: false,
    notify_policy: 'bundle_or_error',
    cooldown_minutes: 30,
    last_run_at: '2026-01-01T00:00:00Z',  // 绕过 cooldown
    last_window_end: '2026-01-01T00:00:00Z',
    last_processed_run_id: null,
    lock: { locked_at: null, lock_id: null },
    bundle: { last_content_sha: null, last_version: '0.4.0', last_artifact_path: null }
  };

  const dir = dirname(STATE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify({ ...defaultState, ...stateOverrides }, null, 2));

  if (killSwitchOverrides !== null) {
    writeFileSync(KILL_SWITCH_FILE, JSON.stringify(killSwitchOverrides, null, 2));
  } else {
    // 默认启用（learning_heartbeat: true）
    writeFileSync(KILL_SWITCH_FILE, JSON.stringify({ learning_heartbeat: true }, null, 2));
  }
}

function runHeartbeat(env = {}) {
  const envStr = Object.entries(env)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');

  try {
    const output = execSync(
      `${envStr} node ${join(PROJECT_ROOT, '.claude/scripts/learning/heartbeat_runner.mjs')} --dry-run --json --fixtures ${join(FIXTURES_DIR, 'empty')}`,
      { cwd: PROJECT_ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return JSON.parse(output);
  } catch (error) {
    if (error.stdout) {
      try { return JSON.parse(error.stdout); } catch (e) { /* ignore */ }
    }
    throw error;
  }
}

// ============================================================================
// Test Cases
// ============================================================================

function test1_DefaultDisabled() {
  console.log('Test 1: state enabled=false 且无 ENV → SKIP（默认安全）...');
  setTestState({ enabled: false });

  const result = runHeartbeat({});

  assert.equal(result.action, 'skipped', 'action should be skipped');
  assert.equal(result.steps.skip_reason, 'disabled', 'skip_reason should be disabled');
  assert.equal(result.steps.switch_resolution.effective.enabled, false, 'effective.enabled should be false');
  assert.equal(result.steps.switch_resolution.source.enabled, 'state', 'source should be state');

  console.log('  ✅ Test 1 passed: Default disabled works');
  return result;
}

function test2_EnvOverridesState() {
  console.log('Test 2: state enabled=false + LIYE_HEARTBEAT_ENABLED=true → RUN...');
  setTestState({ enabled: false });

  const result = runHeartbeat({ LIYE_HEARTBEAT_ENABLED: 'true' });

  assert.equal(result.steps.switch_resolution.effective.enabled, true, 'effective.enabled should be true');
  assert.equal(result.steps.switch_resolution.source.enabled, 'env', 'source should be env');
  assert.equal(result.steps.switch_resolution.action, 'RUN', 'action should be RUN');
  // 实际 action 可能是 skipped 因为 no_new_runs，但 switch_resolution.action 应该是 RUN
  assert.ok(['completed', 'skipped'].includes(result.action), 'action should proceed past switch check');

  console.log('  ✅ Test 2 passed: ENV overrides state');
  return result;
}

function test3_EnvForcesDisable() {
  console.log('Test 3: state enabled=true + LIYE_HEARTBEAT_ENABLED=false → SKIP...');
  setTestState({ enabled: true });

  const result = runHeartbeat({ LIYE_HEARTBEAT_ENABLED: 'false' });

  assert.equal(result.action, 'skipped', 'action should be skipped');
  assert.equal(result.steps.skip_reason, 'disabled', 'skip_reason should be disabled');
  assert.equal(result.steps.switch_resolution.effective.enabled, false, 'effective.enabled should be false');
  assert.equal(result.steps.switch_resolution.source.enabled, 'env', 'source should be env');

  console.log('  ✅ Test 3 passed: ENV forces disable');
  return result;
}

function test4_NotifyPolicyOff() {
  console.log('Test 4: LIYE_HEARTBEAT_NOTIFY_POLICY=off → 不投递...');
  setTestState({ enabled: false });

  const result = runHeartbeat({
    LIYE_HEARTBEAT_ENABLED: 'true',
    LIYE_HEARTBEAT_NOTIFY_POLICY: 'off'
  });

  assert.equal(result.steps.switch_resolution.effective.notify_policy, 'off', 'notify_policy should be off');
  assert.equal(result.steps.switch_resolution.source.notify_policy, 'env', 'source should be env');

  console.log('  ✅ Test 4 passed: Notify policy off works');
  return result;
}

function test5_InvalidEnvFailClosed() {
  console.log('Test 5: LIYE_HEARTBEAT_ENABLED=maybe（非法）→ fail-closed SKIP...');
  setTestState({ enabled: false });

  const result = runHeartbeat({ LIYE_HEARTBEAT_ENABLED: 'maybe' });

  assert.equal(result.action, 'skipped', 'action should be skipped');
  assert.equal(result.steps.skip_reason, 'config_error_fail_closed', 'skip_reason should be config_error_fail_closed');
  assert.ok(result.steps.switch_resolution.config_errors.length > 0, 'should have config_errors');
  assert.ok(
    result.steps.switch_resolution.config_errors[0].includes('Invalid boolean value'),
    'error should mention invalid boolean'
  );

  console.log('  ✅ Test 5 passed: Invalid ENV fail-closed');
  return result;
}

function test6_KillSwitchForceSkip() {
  console.log('Test 6: kill switch active → 永远 SKIP...');
  setTestState({ enabled: true }, { learning_heartbeat: false });

  const result = runHeartbeat({ LIYE_HEARTBEAT_ENABLED: 'true' });

  assert.equal(result.action, 'skipped', 'action should be skipped');
  assert.equal(result.steps.skip_reason, 'kill_switch', 'skip_reason should be kill_switch');
  assert.equal(result.steps.switch_resolution.kill_switch.active, true, 'kill_switch should be active');
  assert.equal(result.steps.switch_resolution.kill_switch.source, 'state', 'kill_switch source should be state');

  console.log('  ✅ Test 6 passed: Kill switch forces skip');
  return result;
}

// ============================================================================
// Test Runner
// ============================================================================

async function runAllTests() {
  console.log('\n========================================');
  console.log('Dual-Switch Heartbeat Tests v1.0.0');
  console.log('========================================\n');

  const originalBackup = backupState();
  const results = [];
  let passed = 0, failed = 0;

  const tests = [
    { name: 'default_disabled', fn: test1_DefaultDisabled },
    { name: 'env_overrides_state', fn: test2_EnvOverridesState },
    { name: 'env_forces_disable', fn: test3_EnvForcesDisable },
    { name: 'notify_policy_off', fn: test4_NotifyPolicyOff },
    { name: 'invalid_env_fail_closed', fn: test5_InvalidEnvFailClosed },
    { name: 'kill_switch_forces_skip', fn: test6_KillSwitchForceSkip }
  ];

  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, status: 'passed', result });
      passed++;
    } catch (error) {
      console.error(`  ❌ FAILED: ${error.message}`);
      results.push({ name: test.name, status: 'failed', error: error.message });
      failed++;
    }
  }

  restoreState(originalBackup);

  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  // Write evidence files
  if (!existsSync(EVIDENCE_DIR)) mkdirSync(EVIDENCE_DIR, { recursive: true });

  for (const r of results) {
    if (r.result) {
      const evidenceFile = join(EVIDENCE_DIR, `evidence_switch_${r.name}.json`);
      writeFileSync(evidenceFile, JSON.stringify(r.result, null, 2));
      console.log(`Evidence written: ${evidenceFile}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
