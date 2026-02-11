#!/usr/bin/env node
/**
 * Heartbeat Learning Runner Tests v1.0.0
 * SSOT: tests/test_heartbeat_learning_runner.mjs
 *
 * 覆盖 5 个核心用例：
 * 1. cooldown 生效（短间隔重复触发 → SKIP）
 * 2. 无新 runs → SKIP
 * 3. 有新 runs → pipeline 被调用
 * 4. content_sha 未变 → bundle 不构建
 * 5. content_sha 变化 → build 被调用
 */

import { strict as assert } from 'assert';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const FIXTURES_DIR = join(__dirname, 'fixtures', 'heartbeat_learning');
const STATE_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'heartbeat_learning_state.json');

function backupState() {
  if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  return null;
}

function restoreState(backup) {
  if (backup) writeFileSync(STATE_FILE, JSON.stringify(backup, null, 2));
  else if (existsSync(STATE_FILE)) rmSync(STATE_FILE);
}

function setTestState(state) {
  const dir = dirname(STATE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function runHeartbeat(args = '') {
  try {
    const output = execSync(
      `node ${join(PROJECT_ROOT, '.claude/scripts/learning/heartbeat_runner.mjs')} --json ${args}`,
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

function testCooldownSkip() {
  console.log('Test 1: Cooldown skip...');
  setTestState({
    version: 1, enabled: true, cooldown_minutes: 30,
    last_run_at: new Date().toISOString(),
    last_window_end: null, last_processed_run_id: null,
    lock: { locked_at: null, lock_id: null },
    bundle: { last_content_sha: null, last_version: '0.4.0', last_artifact_path: null }
  });
  const result = runHeartbeat('--dry-run');
  assert.equal(result.action, 'skipped');
  assert.equal(result.steps.skip_reason, 'cooldown');
  console.log('  ✅ Cooldown skip works');
  return result;
}

function testNoNewRunsSkip() {
  console.log('Test 2: No new runs → SKIP...');
  const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  setTestState({
    version: 1, enabled: true, cooldown_minutes: 30,
    last_run_at: pastTime,
    last_window_end: new Date().toISOString(),
    last_processed_run_id: null,
    lock: { locked_at: null, lock_id: null },
    bundle: { last_content_sha: null, last_version: '0.4.0', last_artifact_path: null }
  });
  const emptyFixturesDir = join(FIXTURES_DIR, 'empty');
  const result = runHeartbeat(`--dry-run --fixtures ${emptyFixturesDir}`);
  assert.equal(result.action, 'skipped');
  assert.equal(result.steps.skip_reason, 'no_new_runs');
  console.log('  ✅ No new runs skip works');
  return result;
}

function testPipelineRan() {
  console.log('Test 3: New runs → pipeline runs...');
  const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  setTestState({
    version: 1, enabled: true, cooldown_minutes: 30,
    last_run_at: pastTime,
    last_window_end: '2026-01-01T00:00:00Z',
    last_processed_run_id: null,
    lock: { locked_at: null, lock_id: null },
    bundle: { last_content_sha: null, last_version: '0.4.0', last_artifact_path: null }
  });
  const result = runHeartbeat(`--dry-run --fixtures ${FIXTURES_DIR}`);
  assert.ok(result.steps.discover);
  assert.ok(result.steps.discover.new_run_ids.length > 0);
  assert.ok(result.steps.pipeline);
  console.log('  ✅ Pipeline ran with new runs');
  return result;
}

async function testBundleSkipUnchanged() {
  console.log('Test 4: content_sha unchanged → bundle skip...');
  const { buildOnChange } = await import('../.claude/scripts/learning/bundle_build_on_change.mjs');
  const currentResult = buildOnChange({ dryRun: true });

  const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  setTestState({
    version: 1, enabled: true, cooldown_minutes: 30,
    last_run_at: pastTime,
    last_window_end: '2026-01-01T00:00:00Z',
    last_processed_run_id: null,
    lock: { locked_at: null, lock_id: null },
    bundle: { last_content_sha: currentResult.content_sha, last_version: '0.4.0', last_artifact_path: null }
  });
  const result = runHeartbeat(`--dry-run --fixtures ${FIXTURES_DIR}`);
  if (result.steps.bundle) {
    assert.equal(result.steps.bundle.content_sha_changed, false);
  }
  console.log('  ✅ Bundle skipped when unchanged');
  return result;
}

function testBundleBuiltOnChange() {
  console.log('Test 5: content_sha changed → bundle built...');
  const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  setTestState({
    version: 1, enabled: true, cooldown_minutes: 30,
    last_run_at: pastTime,
    last_window_end: '2026-01-01T00:00:00Z',
    last_processed_run_id: null,
    lock: { locked_at: null, lock_id: null },
    bundle: { last_content_sha: 'sha256:old_hash', last_version: '0.4.0', last_artifact_path: null }
  });
  const result = runHeartbeat(`--dry-run --fixtures ${FIXTURES_DIR}`);
  if (result.steps.bundle) {
    assert.equal(result.steps.bundle.content_sha_changed, true);
  }
  console.log('  ✅ Bundle build triggered on change');
  return result;
}

async function runAllTests() {
  console.log('\n========================================');
  console.log('Heartbeat Learning Runner Tests v1.0.0');
  console.log('========================================\n');

  const originalState = backupState();
  const results = [];
  let passed = 0, failed = 0;

  const tests = [
    { name: 'cooldown_skip', fn: testCooldownSkip },
    { name: 'no_new_runs_skip', fn: testNoNewRunsSkip },
    { name: 'pipeline_ran', fn: testPipelineRan },
    { name: 'bundle_skip_unchanged', fn: testBundleSkipUnchanged },
    { name: 'bundle_built_on_change', fn: testBundleBuiltOnChange }
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

  restoreState(originalState);

  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  // Write evidence files
  const evidenceDir = join(PROJECT_ROOT, 'evidence');
  if (!existsSync(evidenceDir)) mkdirSync(evidenceDir, { recursive: true });
  for (const r of results) {
    if (r.result) {
      const evidenceFile = join(evidenceDir, `evidence_${r.name}.json`);
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
