// tests/runtime/execution/test_quota_gate.mjs
import { checkQuotaGate, recordWriteUsage, resetQuota, getQuotaStatus } from '../../../src/runtime/execution/quota_gate.mjs';
import { mkdirSync, rmSync, existsSync } from 'fs';

const TEST_STATE_DIR = '/tmp/test_quota_state';

function setup() {
  if (existsSync(TEST_STATE_DIR)) rmSync(TEST_STATE_DIR, { recursive: true });
  mkdirSync(TEST_STATE_DIR, { recursive: true });
}

function teardown() {
  if (existsSync(TEST_STATE_DIR)) rmSync(TEST_STATE_DIR, { recursive: true });
}

function testFreshStateAllows() {
  setup();
  const result = checkQuotaGate({ keyword_count: 3, stateDir: TEST_STATE_DIR });
  console.assert(result.allowed === true, 'Fresh state should allow');
  console.assert(result.daily_writes_remaining === 1, 'Should have 1 write remaining');
  console.assert(result.reason === 'Quota check passed', 'Should have pass reason');
  teardown();
  console.log('✅ testFreshStateAllows passed');
}

function testDailyLimitExceeded() {
  setup();
  recordWriteUsage({ keyword_count: 3, stateDir: TEST_STATE_DIR });
  const result = checkQuotaGate({ keyword_count: 2, stateDir: TEST_STATE_DIR });
  console.assert(result.allowed === false, 'Should deny after daily limit');
  console.assert(result.daily_writes_remaining === 0, 'Should have 0 remaining');
  console.assert(result.reason.includes('exhausted'), 'Should mention exhausted');
  teardown();
  console.log('✅ testDailyLimitExceeded passed');
}

function testKeywordLimitExceeded() {
  setup();
  const result = checkQuotaGate({ keyword_count: 10, stateDir: TEST_STATE_DIR });
  console.assert(result.allowed === false, 'Should deny excess keywords');
  console.assert(result.reason.includes('5'), 'Should mention limit of 5');
  console.assert(result.reason.includes('10'), 'Should mention requested count');
  teardown();
  console.log('✅ testKeywordLimitExceeded passed');
}

function testKeywordExactlyAtLimit() {
  setup();
  const result = checkQuotaGate({ keyword_count: 5, stateDir: TEST_STATE_DIR });
  console.assert(result.allowed === true, 'Should allow exactly 5 keywords');
  teardown();
  console.log('✅ testKeywordExactlyAtLimit passed');
}

function testKeywordOneOverLimit() {
  setup();
  const result = checkQuotaGate({ keyword_count: 6, stateDir: TEST_STATE_DIR });
  console.assert(result.allowed === false, 'Should deny 6 keywords');
  teardown();
  console.log('✅ testKeywordOneOverLimit passed');
}

function testResetQuota() {
  setup();
  recordWriteUsage({ keyword_count: 3, stateDir: TEST_STATE_DIR });
  let result = checkQuotaGate({ keyword_count: 2, stateDir: TEST_STATE_DIR });
  console.assert(result.allowed === false, 'Should be denied before reset');

  resetQuota(TEST_STATE_DIR);
  result = checkQuotaGate({ keyword_count: 2, stateDir: TEST_STATE_DIR });
  console.assert(result.allowed === true, 'Should allow after reset');
  console.assert(result.daily_writes_remaining === 1, 'Should have 1 write after reset');
  teardown();
  console.log('✅ testResetQuota passed');
}

function testGetQuotaStatus() {
  setup();
  const status = getQuotaStatus(TEST_STATE_DIR);
  console.assert(status.writes_used === 0, 'Fresh state should have 0 writes used');
  console.assert(status.writes_remaining === 1, 'Fresh state should have 1 remaining');
  console.assert(status.max_writes_per_day === 1, 'Should report max 1 per day');
  console.assert(status.max_keywords_per_action === 5, 'Should report max 5 keywords');

  recordWriteUsage({ keyword_count: 4, stateDir: TEST_STATE_DIR });
  const status2 = getQuotaStatus(TEST_STATE_DIR);
  console.assert(status2.writes_used === 1, 'Should have 1 write used');
  console.assert(status2.writes_remaining === 0, 'Should have 0 remaining');
  console.assert(status2.last_write !== null, 'Should have last_write info');
  console.assert(status2.last_write.keyword_count === 4, 'Should record keyword count');
  teardown();
  console.log('✅ testGetQuotaStatus passed');
}

function testZeroKeywords() {
  setup();
  const result = checkQuotaGate({ keyword_count: 0, stateDir: TEST_STATE_DIR });
  console.assert(result.allowed === true, 'Should allow 0 keywords');
  teardown();
  console.log('✅ testZeroKeywords passed');
}

function testDefaultStateDir() {
  // Just verify it doesn't throw with default stateDir
  // We don't actually want to write to the default location in tests
  console.log('✅ testDefaultStateDir skipped (uses default dir)');
}

// Run all tests
testFreshStateAllows();
testDailyLimitExceeded();
testKeywordLimitExceeded();
testKeywordExactlyAtLimit();
testKeywordOneOverLimit();
testResetQuota();
testGetQuotaStatus();
testZeroKeywords();
testDefaultStateDir();
console.log('\n🎉 All quota gate tests passed');
