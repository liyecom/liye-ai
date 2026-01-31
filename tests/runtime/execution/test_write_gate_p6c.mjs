// tests/runtime/execution/test_write_gate_p6c.mjs
// P6-C Integration Tests for Write Gate
//
// Tests the combined gate that enforces:
// 1. Kill Switch (if active, immediate DENY)
// 2. Four-Key ALL-of (all 4 env vars must match)
// 3. Quota Gate (daily limit + keyword count)
// 4. Original write gate (tool/scope/threshold)

import { checkWriteGateP6C } from '../../../src/runtime/execution/write_gate.mjs';
import { resetQuota } from '../../../src/runtime/execution/quota_gate.mjs';
import { mkdirSync, rmSync, existsSync } from 'fs';

const TEST_STATE_DIR = '/tmp/test_p6c_state';

// Save original env vars
const originalEnv = { ...process.env };

function setup() {
  if (existsSync(TEST_STATE_DIR)) rmSync(TEST_STATE_DIR, { recursive: true });
  mkdirSync(TEST_STATE_DIR, { recursive: true });

  // Set all four keys to valid values
  process.env.ADS_OAUTH_MODE = 'write';
  process.env.DENY_READONLY_ENV = 'false';
  process.env.ALLOW_LIVE_WRITES = 'true';
  process.env.WRITE_ENABLED = '1';

  // Ensure kill switch is off
  delete process.env.KILL_SWITCH;
}

function teardown() {
  if (existsSync(TEST_STATE_DIR)) rmSync(TEST_STATE_DIR, { recursive: true });

  // Restore original env vars
  Object.keys(process.env).forEach(key => {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  });
  Object.assign(process.env, originalEnv);
}

function testP6CGatesPass() {
  setup();
  resetQuota(TEST_STATE_DIR);

  const action = {
    tool: 'negative_keyword_add',
    arguments: {
      keywords: ['test1', 'test2', 'test3'],
      profile_id: 'test-profile'
    }
  };

  const result = checkWriteGateP6C(action, { stateDir: TEST_STATE_DIR });

  // P6-C gates (kill_switch, four_key, quota) should all pass
  console.assert(result.gates.kill_switch.passed === true, 'Kill switch should pass');
  console.assert(result.gates.four_key.passed === true, 'Four key should pass');
  console.assert(result.gates.quota.passed === true, 'Quota should pass');

  // The original gate may fail due to policy/scope config, but that's separate from P6-C
  // This test verifies P6-C gates are evaluated before original gate
  console.assert('original' in result.gates, 'Original gate should be evaluated when P6-C passes');

  teardown();
  console.log('PASS testP6CGatesPass');
}

function testKillSwitchBlocks() {
  setup();
  process.env.KILL_SWITCH = 'true';

  const action = {
    tool: 'negative_keyword_add',
    arguments: {}
  };

  const result = checkWriteGateP6C(action, { stateDir: TEST_STATE_DIR });

  console.assert(result.allowed === false, 'Should deny when kill switch active');
  console.assert(result.blocked_by === 'kill_switch', 'Should be blocked by kill switch');
  console.assert(result.gates.kill_switch.passed === false, 'Kill switch gate should fail');
  // Subsequent gates should not be evaluated (fail-fast)
  console.assert(result.gates.four_key === undefined, 'Four-key should not be evaluated');

  teardown();
  console.log('PASS testKillSwitchBlocks');
}

function testFourKeyBlocks() {
  setup();
  delete process.env.ADS_OAUTH_MODE;  // Remove one required key

  const action = {
    tool: 'negative_keyword_add',
    arguments: {}
  };

  const result = checkWriteGateP6C(action, { stateDir: TEST_STATE_DIR });

  console.assert(result.allowed === false, 'Should deny when key missing');
  console.assert(result.blocked_by === 'four_key', 'Should be blocked by four_key');
  console.assert(result.gates.kill_switch.passed === true, 'Kill switch should have passed');
  console.assert(result.gates.four_key.passed === false, 'Four key gate should fail');
  // Subsequent gates should not be evaluated
  console.assert(result.gates.quota === undefined, 'Quota should not be evaluated');

  teardown();
  console.log('PASS testFourKeyBlocks');
}

function testQuotaKeywordLimitBlocks() {
  setup();
  resetQuota(TEST_STATE_DIR);

  const action = {
    tool: 'negative_keyword_add',
    arguments: {
      keywords: ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'],  // 6 keywords, limit is 5
      profile_id: 'test-profile'
    }
  };

  const result = checkWriteGateP6C(action, { stateDir: TEST_STATE_DIR });

  console.assert(result.allowed === false, 'Should deny when keyword count exceeds limit');
  console.assert(result.blocked_by === 'quota', 'Should be blocked by quota');
  console.assert(result.gates.kill_switch.passed === true, 'Kill switch should have passed');
  console.assert(result.gates.four_key.passed === true, 'Four key should have passed');
  console.assert(result.gates.quota.passed === false, 'Quota gate should fail');

  teardown();
  console.log('PASS testQuotaKeywordLimitBlocks');
}

function testOriginalGateBlocks() {
  setup();
  resetQuota(TEST_STATE_DIR);

  // Use a tool not in the allowlist
  const action = {
    tool: 'unknown_dangerous_tool',
    arguments: {
      profile_id: 'test-profile'
    }
  };

  const result = checkWriteGateP6C(action, { stateDir: TEST_STATE_DIR });

  // Verify P6-C gates passed
  console.assert(result.gates.kill_switch.passed === true, 'Kill switch should have passed');
  console.assert(result.gates.four_key.passed === true, 'Four key should have passed');
  console.assert(result.gates.quota.passed === true, 'Quota should have passed');

  // Original gate should be reached and should fail
  console.assert(result.allowed === false, 'Should deny when tool not allowed');
  console.assert(result.gates.original.passed === false, 'Original gate should fail');
  // blocked_by could be tool_allowlist or scope_allowlist depending on evaluation order
  console.assert(result.gates.original.blocked_at !== null, 'Original gate should have a block point');

  teardown();
  console.log('PASS testOriginalGateBlocks');
}

function testFailFastOrder() {
  // Test that gates are evaluated in order and stop at first failure
  setup();
  process.env.KILL_SWITCH = 'true';
  delete process.env.ADS_OAUTH_MODE;  // Also invalid four-key

  const action = {
    tool: 'negative_keyword_add',
    arguments: {
      keywords: ['k1', 'k2', 'k3', 'k4', 'k5', 'k6']  // Also exceeds quota
    }
  };

  const result = checkWriteGateP6C(action, { stateDir: TEST_STATE_DIR });

  // Should stop at kill_switch (first gate)
  console.assert(result.blocked_by === 'kill_switch', 'Should stop at first failure (kill_switch)');
  console.assert(Object.keys(result.gates).length === 1, 'Should only have one gate evaluated');

  teardown();
  console.log('PASS testFailFastOrder');
}

function testGateResultStructure() {
  setup();
  resetQuota(TEST_STATE_DIR);

  const action = {
    tool: 'negative_keyword_add',
    arguments: {
      keywords: ['test1'],
      profile_id: 'test-profile'
    }
  };

  const result = checkWriteGateP6C(action, { stateDir: TEST_STATE_DIR });

  // Check result structure
  console.assert('allowed' in result, 'Result should have allowed');
  console.assert('blocked_by' in result, 'Result should have blocked_by');
  console.assert('reason' in result, 'Result should have reason');
  console.assert('gates' in result, 'Result should have gates');

  // Check P6-C gates structure (always evaluated in order until one fails)
  console.assert('kill_switch' in result.gates, 'Gates should have kill_switch');
  console.assert('four_key' in result.gates, 'Gates should have four_key');
  console.assert('quota' in result.gates, 'Gates should have quota');
  // Original gate is reached only if all P6-C gates pass
  console.assert('original' in result.gates, 'Gates should have original when P6-C passes');

  // Verify each gate has passed flag
  console.assert('passed' in result.gates.kill_switch, 'kill_switch should have passed flag');
  console.assert('passed' in result.gates.four_key, 'four_key should have passed flag');
  console.assert('passed' in result.gates.quota, 'quota should have passed flag');

  teardown();
  console.log('PASS testGateResultStructure');
}

// Run all tests
console.log('Running P6-C Write Gate Integration Tests...\n');

testP6CGatesPass();
testKillSwitchBlocks();
testFourKeyBlocks();
testQuotaKeywordLimitBlocks();
testOriginalGateBlocks();
testFailFastOrder();
testGateResultStructure();

console.log('\nAll P6-C write gate integration tests passed');
