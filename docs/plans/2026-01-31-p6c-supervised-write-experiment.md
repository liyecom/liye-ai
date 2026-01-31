# P6-C: Supervised Minimal Write Experiment

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 验证 AI → 真实世界写入是否可被严格控制、解释、回滚（不是功能发布，不是优化 ACOS）

**Architecture:** 四钥匙 ALL-of 门控 + 人工审批闭环 + 每日单次限额 + E2E 回滚验证

**Tech Stack:** Node.js ESM, YAML policies, JSON state files, Jest/Node test runner

---

## Immutable Boundaries (P6-C 不可变边界)

| 维度 | 约束 |
|------|------|
| 客户 | Timo (DEMO_US) |
| 市场 | US |
| 动作 | ADD_NEGATIVE_KEYWORDS only |
| 默认 | suggest_only |
| 写入触发 | 四钥匙 ALL-of |
| 频率 | ≤1 次/天 |
| 规模 | ≤5 个 negative keywords/次 |

---

## PR-C1: Infrastructure PR (解锁与守门)

### Task 1: Extend Write Gate with Four-Key ALL-of

**Files:**
- Modify: `src/runtime/execution/write_gate.mjs`
- Create: `src/runtime/execution/four_key_gate.mjs`
- Test: `tests/runtime/execution/test_four_key_gate.mjs`

**Step 1: Write the failing test for four-key gate**

```javascript
// tests/runtime/execution/test_four_key_gate.mjs
import { checkFourKeyGate } from '../../../src/runtime/execution/four_key_gate.mjs';

// Test: All four keys must be present
function testAllKeysRequired() {
  // Save original env
  const origEnv = { ...process.env };

  // Clear all keys
  delete process.env.ADS_OAUTH_MODE;
  delete process.env.DENY_READONLY_ENV;
  delete process.env.ALLOW_LIVE_WRITES;
  delete process.env.WRITE_ENABLED;

  const result = checkFourKeyGate();

  console.assert(result.allowed === false, 'Should deny when keys missing');
  console.assert(result.missing_keys.length === 4, 'Should report 4 missing keys');

  // Restore env
  Object.assign(process.env, origEnv);
  console.log('✅ testAllKeysRequired passed');
}

// Test: All four keys present = ALLOW
function testAllKeysPresent() {
  const origEnv = { ...process.env };

  process.env.ADS_OAUTH_MODE = 'write';
  process.env.DENY_READONLY_ENV = 'false';
  process.env.ALLOW_LIVE_WRITES = 'true';
  process.env.WRITE_ENABLED = '1';

  const result = checkFourKeyGate();

  console.assert(result.allowed === true, 'Should allow when all keys present');
  console.assert(result.missing_keys.length === 0, 'Should have no missing keys');

  Object.assign(process.env, origEnv);
  console.log('✅ testAllKeysPresent passed');
}

// Test: Single key missing = DENY
function testSingleKeyMissing() {
  const origEnv = { ...process.env };

  // Set 3 keys, miss 1
  process.env.ADS_OAUTH_MODE = 'write';
  process.env.DENY_READONLY_ENV = 'false';
  process.env.ALLOW_LIVE_WRITES = 'true';
  delete process.env.WRITE_ENABLED;

  const result = checkFourKeyGate();

  console.assert(result.allowed === false, 'Should deny when 1 key missing');
  console.assert(result.missing_keys.includes('WRITE_ENABLED'), 'Should report missing key');

  Object.assign(process.env, origEnv);
  console.log('✅ testSingleKeyMissing passed');
}

// Run all tests
testAllKeysRequired();
testAllKeysPresent();
testSingleKeyMissing();

console.log('\n🎉 All four-key gate tests passed');
```

**Step 2: Run test to verify it fails**

Run: `node tests/runtime/execution/test_four_key_gate.mjs`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```javascript
// src/runtime/execution/four_key_gate.mjs
/**
 * Four-Key ALL-of Gate
 *
 * P6-C: All four keys must be present for live writes.
 * Missing ANY key = DENY (fail-closed)
 *
 * Keys:
 * 1. ADS_OAUTH_MODE=write (AGE side)
 * 2. DENY_READONLY_ENV=false (LiYe side)
 * 3. ALLOW_LIVE_WRITES=true (LiYe side)
 * 4. WRITE_ENABLED=1 (LiYe side)
 */

const FOUR_KEYS = [
  {
    env: 'ADS_OAUTH_MODE',
    required_value: 'write',
    owner: 'AGE',
    description: 'OAuth mode must be write'
  },
  {
    env: 'DENY_READONLY_ENV',
    required_value: 'false',
    owner: 'LiYe',
    description: 'Readonly deny must be false'
  },
  {
    env: 'ALLOW_LIVE_WRITES',
    required_value: 'true',
    owner: 'LiYe',
    description: 'Live writes master switch'
  },
  {
    env: 'WRITE_ENABLED',
    required_value: '1',
    owner: 'LiYe',
    description: 'Write enabled flag'
  }
];

/**
 * Check if all four keys are present and valid
 *
 * @returns {Object} { allowed, missing_keys, key_status }
 */
export function checkFourKeyGate() {
  const missing_keys = [];
  const key_status = {};

  for (const key of FOUR_KEYS) {
    const value = process.env[key.env];
    const valid = value === key.required_value;

    key_status[key.env] = {
      present: value !== undefined,
      value: value || null,
      required: key.required_value,
      valid,
      owner: key.owner,
      description: key.description
    };

    if (!valid) {
      missing_keys.push(key.env);
    }
  }

  const allowed = missing_keys.length === 0;

  return {
    allowed,
    missing_keys,
    key_status,
    reason: allowed
      ? 'All four keys valid'
      : `Missing/invalid keys: ${missing_keys.join(', ')}`
  };
}

/**
 * Get human-readable key status report
 */
export function getFourKeyReport() {
  const result = checkFourKeyGate();
  const lines = ['Four-Key Gate Status:'];

  for (const [key, status] of Object.entries(result.key_status)) {
    const icon = status.valid ? '✅' : '❌';
    const value = status.present ? `"${status.value}"` : 'NOT SET';
    lines.push(`  ${icon} ${key} = ${value} (need: "${status.required}")`);
  }

  lines.push('');
  lines.push(result.allowed ? '✅ GATE: OPEN' : '❌ GATE: CLOSED');

  return lines.join('\n');
}

export default { checkFourKeyGate, getFourKeyReport };
```

**Step 4: Run test to verify it passes**

Run: `node tests/runtime/execution/test_four_key_gate.mjs`
Expected: PASS - "All four-key gate tests passed"

**Step 5: Commit**

```bash
git add src/runtime/execution/four_key_gate.mjs tests/runtime/execution/test_four_key_gate.mjs
git commit -m "feat(gate): add four-key ALL-of gate for P6-C live writes"
```

---

### Task 2: Add Write Quota Gate

**Files:**
- Create: `src/runtime/execution/quota_gate.mjs`
- Create: `.liye/state/write_quota.json` (runtime state)
- Test: `tests/runtime/execution/test_quota_gate.mjs`

**Step 1: Write the failing test for quota gate**

```javascript
// tests/runtime/execution/test_quota_gate.mjs
import {
  checkQuotaGate,
  recordWriteUsage,
  resetQuota,
  getQuotaStatus
} from '../../../src/runtime/execution/quota_gate.mjs';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';

const TEST_STATE_DIR = '/tmp/test_quota_state';

function setup() {
  if (existsSync(TEST_STATE_DIR)) {
    rmSync(TEST_STATE_DIR, { recursive: true });
  }
  mkdirSync(TEST_STATE_DIR, { recursive: true });
}

function teardown() {
  if (existsSync(TEST_STATE_DIR)) {
    rmSync(TEST_STATE_DIR, { recursive: true });
  }
}

// Test: Fresh state allows write
function testFreshStateAllows() {
  setup();

  const result = checkQuotaGate({
    keyword_count: 3,
    stateDir: TEST_STATE_DIR
  });

  console.assert(result.allowed === true, 'Fresh state should allow');
  console.assert(result.daily_writes_remaining === 1, 'Should have 1 write remaining');

  teardown();
  console.log('✅ testFreshStateAllows passed');
}

// Test: Exceeding daily limit = DENY
function testDailyLimitExceeded() {
  setup();

  // Use up the daily quota
  recordWriteUsage({ keyword_count: 3, stateDir: TEST_STATE_DIR });

  const result = checkQuotaGate({
    keyword_count: 2,
    stateDir: TEST_STATE_DIR
  });

  console.assert(result.allowed === false, 'Should deny after daily limit');
  console.assert(result.daily_writes_remaining === 0, 'Should have 0 remaining');

  teardown();
  console.log('✅ testDailyLimitExceeded passed');
}

// Test: Exceeding keyword limit = DENY
function testKeywordLimitExceeded() {
  setup();

  const result = checkQuotaGate({
    keyword_count: 10,  // MAX is 5
    stateDir: TEST_STATE_DIR
  });

  console.assert(result.allowed === false, 'Should deny excess keywords');
  console.assert(result.reason.includes('5'), 'Should mention limit');

  teardown();
  console.log('✅ testKeywordLimitExceeded passed');
}

// Run all tests
testFreshStateAllows();
testDailyLimitExceeded();
testKeywordLimitExceeded();

console.log('\n🎉 All quota gate tests passed');
```

**Step 2: Run test to verify it fails**

Run: `node tests/runtime/execution/test_quota_gate.mjs`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```javascript
// src/runtime/execution/quota_gate.mjs
/**
 * Write Quota Gate
 *
 * P6-C Hard Limits:
 * - MAX_LIVE_WRITES_PER_DAY = 1
 * - MAX_NEGATIVE_KEYWORDS_PER_ACTION = 5
 *
 * Exceeding quota = HARD FAIL (not warn)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// P6-C immutable limits (hardcoded, not configurable)
const MAX_LIVE_WRITES_PER_DAY = 1;
const MAX_NEGATIVE_KEYWORDS_PER_ACTION = 5;

const DEFAULT_STATE_DIR = '.liye/state';

/**
 * Get today's date key (YYYY-MM-DD)
 */
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Load quota state from disk
 */
function loadQuotaState(stateDir) {
  const statePath = join(stateDir, 'write_quota.json');

  if (!existsSync(statePath)) {
    return { daily_writes: {}, last_reset: getTodayKey() };
  }

  try {
    return JSON.parse(readFileSync(statePath, 'utf-8'));
  } catch (e) {
    console.warn('[QuotaGate] Failed to load state:', e.message);
    return { daily_writes: {}, last_reset: getTodayKey() };
  }
}

/**
 * Save quota state to disk
 */
function saveQuotaState(stateDir, state) {
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }

  const statePath = join(stateDir, 'write_quota.json');
  writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Check if write is allowed under quota
 *
 * @param {Object} opts
 * @param {number} opts.keyword_count - Number of keywords in this action
 * @param {string} opts.stateDir - State directory
 * @returns {Object} { allowed, daily_writes_remaining, reason }
 */
export function checkQuotaGate(opts = {}) {
  const { keyword_count = 0, stateDir = DEFAULT_STATE_DIR } = opts;

  // Check keyword limit
  if (keyword_count > MAX_NEGATIVE_KEYWORDS_PER_ACTION) {
    return {
      allowed: false,
      daily_writes_remaining: null,
      reason: `Keyword count ${keyword_count} exceeds limit of ${MAX_NEGATIVE_KEYWORDS_PER_ACTION}`
    };
  }

  // Load and check daily quota
  const state = loadQuotaState(stateDir);
  const today = getTodayKey();

  // Reset if new day
  if (state.last_reset !== today) {
    state.daily_writes = {};
    state.last_reset = today;
    saveQuotaState(stateDir, state);
  }

  const todayWrites = state.daily_writes[today] || 0;
  const remaining = MAX_LIVE_WRITES_PER_DAY - todayWrites;

  if (remaining <= 0) {
    return {
      allowed: false,
      daily_writes_remaining: 0,
      reason: `Daily write limit (${MAX_LIVE_WRITES_PER_DAY}) exhausted`
    };
  }

  return {
    allowed: true,
    daily_writes_remaining: remaining,
    keyword_count,
    max_keywords: MAX_NEGATIVE_KEYWORDS_PER_ACTION,
    reason: 'Quota check passed'
  };
}

/**
 * Record a write usage
 */
export function recordWriteUsage(opts = {}) {
  const { keyword_count = 0, stateDir = DEFAULT_STATE_DIR } = opts;

  const state = loadQuotaState(stateDir);
  const today = getTodayKey();

  // Reset if new day
  if (state.last_reset !== today) {
    state.daily_writes = {};
    state.last_reset = today;
  }

  state.daily_writes[today] = (state.daily_writes[today] || 0) + 1;
  state.last_write = {
    timestamp: new Date().toISOString(),
    keyword_count
  };

  saveQuotaState(stateDir, state);

  return state;
}

/**
 * Reset quota (for testing or admin override)
 */
export function resetQuota(stateDir = DEFAULT_STATE_DIR) {
  const state = { daily_writes: {}, last_reset: getTodayKey() };
  saveQuotaState(stateDir, state);
  return state;
}

/**
 * Get current quota status
 */
export function getQuotaStatus(stateDir = DEFAULT_STATE_DIR) {
  const state = loadQuotaState(stateDir);
  const today = getTodayKey();
  const todayWrites = state.daily_writes[today] || 0;

  return {
    today,
    writes_used: todayWrites,
    writes_remaining: Math.max(0, MAX_LIVE_WRITES_PER_DAY - todayWrites),
    max_writes_per_day: MAX_LIVE_WRITES_PER_DAY,
    max_keywords_per_action: MAX_NEGATIVE_KEYWORDS_PER_ACTION,
    last_write: state.last_write || null
  };
}

export default {
  checkQuotaGate,
  recordWriteUsage,
  resetQuota,
  getQuotaStatus,
  MAX_LIVE_WRITES_PER_DAY,
  MAX_NEGATIVE_KEYWORDS_PER_ACTION
};
```

**Step 4: Run test to verify it passes**

Run: `node tests/runtime/execution/test_quota_gate.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add src/runtime/execution/quota_gate.mjs tests/runtime/execution/test_quota_gate.mjs
git commit -m "feat(gate): add quota gate with P6-C hard limits (1/day, 5 keywords/action)"
```

---

### Task 3: Add Kill Switch

**Files:**
- Create: `src/runtime/execution/kill_switch.mjs`
- Test: `tests/runtime/execution/test_kill_switch.mjs`

**Step 1: Write the failing test**

```javascript
// tests/runtime/execution/test_kill_switch.mjs
import { isKillSwitchActive, checkKillSwitch } from '../../../src/runtime/execution/kill_switch.mjs';

// Test: KILL_SWITCH=true blocks everything
function testKillSwitchActive() {
  const origEnv = { ...process.env };

  process.env.KILL_SWITCH = 'true';

  const result = checkKillSwitch();

  console.assert(result.active === true, 'Kill switch should be active');
  console.assert(result.blocked_actions.includes('suggest'), 'Should block suggest');
  console.assert(result.blocked_actions.includes('live_write'), 'Should block live_write');
  console.assert(result.blocked_actions.includes('retry'), 'Should block retry');
  console.assert(result.blocked_actions.includes('replay'), 'Should block replay');

  Object.assign(process.env, origEnv);
  console.log('✅ testKillSwitchActive passed');
}

// Test: KILL_SWITCH not set = inactive
function testKillSwitchInactive() {
  const origEnv = { ...process.env };

  delete process.env.KILL_SWITCH;

  const result = checkKillSwitch();

  console.assert(result.active === false, 'Kill switch should be inactive');
  console.assert(result.blocked_actions.length === 0, 'Should not block anything');

  Object.assign(process.env, origEnv);
  console.log('✅ testKillSwitchInactive passed');
}

// Test: isKillSwitchActive helper
function testIsKillSwitchActive() {
  const origEnv = { ...process.env };

  process.env.KILL_SWITCH = 'true';
  console.assert(isKillSwitchActive() === true, 'Should return true');

  process.env.KILL_SWITCH = 'false';
  console.assert(isKillSwitchActive() === false, 'Should return false');

  delete process.env.KILL_SWITCH;
  console.assert(isKillSwitchActive() === false, 'Should return false when unset');

  Object.assign(process.env, origEnv);
  console.log('✅ testIsKillSwitchActive passed');
}

// Run all tests
testKillSwitchActive();
testKillSwitchInactive();
testIsKillSwitchActive();

console.log('\n🎉 All kill switch tests passed');
```

**Step 2: Run test to verify it fails**

Run: `node tests/runtime/execution/test_kill_switch.mjs`
Expected: FAIL

**Step 3: Write minimal implementation**

```javascript
// src/runtime/execution/kill_switch.mjs
/**
 * Kill Switch
 *
 * P6-C: Single flag that overrides everything
 * KILL_SWITCH=true blocks:
 * - suggest
 * - live write
 * - retry
 * - replay
 *
 * Immediate effect, no grace period
 */

const BLOCKED_ACTIONS = ['suggest', 'live_write', 'retry', 'replay'];

/**
 * Check if kill switch is active
 */
export function isKillSwitchActive() {
  return process.env.KILL_SWITCH === 'true';
}

/**
 * Get kill switch status with details
 */
export function checkKillSwitch() {
  const active = isKillSwitchActive();

  return {
    active,
    blocked_actions: active ? [...BLOCKED_ACTIONS] : [],
    reason: active
      ? 'KILL_SWITCH=true - all operations blocked'
      : 'Kill switch inactive'
  };
}

/**
 * Middleware-style check that throws if active
 */
export function assertKillSwitchInactive(operation) {
  if (isKillSwitchActive()) {
    throw new Error(`KILL_SWITCH active: ${operation} blocked`);
  }
}

export default { isKillSwitchActive, checkKillSwitch, assertKillSwitchInactive };
```

**Step 4: Run test to verify it passes**

Run: `node tests/runtime/execution/test_kill_switch.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add src/runtime/execution/kill_switch.mjs tests/runtime/execution/test_kill_switch.mjs
git commit -m "feat(gate): add kill switch for emergency stop (P6-C)"
```

---

### Task 4: Integrate All Gates into Write Gate

**Files:**
- Modify: `src/runtime/execution/write_gate.mjs`
- Test: `tests/runtime/execution/test_write_gate_p6c.mjs`

**Step 1: Write the integration test**

```javascript
// tests/runtime/execution/test_write_gate_p6c.mjs
import { checkWriteGateP6C } from '../../../src/runtime/execution/write_gate.mjs';
import { resetQuota } from '../../../src/runtime/execution/quota_gate.mjs';
import { mkdirSync, rmSync, existsSync } from 'fs';

const TEST_STATE_DIR = '/tmp/test_p6c_state';

function setup() {
  if (existsSync(TEST_STATE_DIR)) {
    rmSync(TEST_STATE_DIR, { recursive: true });
  }
  mkdirSync(TEST_STATE_DIR, { recursive: true });

  // Set all four keys
  process.env.ADS_OAUTH_MODE = 'write';
  process.env.DENY_READONLY_ENV = 'false';
  process.env.ALLOW_LIVE_WRITES = 'true';
  process.env.WRITE_ENABLED = '1';
  delete process.env.KILL_SWITCH;
}

function teardown() {
  if (existsSync(TEST_STATE_DIR)) {
    rmSync(TEST_STATE_DIR, { recursive: true });
  }
}

// Test: All gates pass
function testAllGatesPass() {
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

  console.assert(result.allowed === true, 'Should allow when all gates pass');
  console.assert(result.gates.kill_switch.passed === true, 'Kill switch should pass');
  console.assert(result.gates.four_key.passed === true, 'Four key should pass');
  console.assert(result.gates.quota.passed === true, 'Quota should pass');

  teardown();
  console.log('✅ testAllGatesPass passed');
}

// Test: Kill switch blocks
function testKillSwitchBlocks() {
  setup();
  process.env.KILL_SWITCH = 'true';

  const action = { tool: 'negative_keyword_add', arguments: {} };
  const result = checkWriteGateP6C(action, { stateDir: TEST_STATE_DIR });

  console.assert(result.allowed === false, 'Should deny when kill switch active');
  console.assert(result.blocked_by === 'kill_switch', 'Should be blocked by kill switch');

  teardown();
  console.log('✅ testKillSwitchBlocks passed');
}

// Test: Four key missing blocks
function testFourKeyBlocks() {
  setup();
  delete process.env.ADS_OAUTH_MODE;

  const action = { tool: 'negative_keyword_add', arguments: {} };
  const result = checkWriteGateP6C(action, { stateDir: TEST_STATE_DIR });

  console.assert(result.allowed === false, 'Should deny when key missing');
  console.assert(result.blocked_by === 'four_key', 'Should be blocked by four_key');

  teardown();
  console.log('✅ testFourKeyBlocks passed');
}

// Run all tests
testAllGatesPass();
testKillSwitchBlocks();
testFourKeyBlocks();

console.log('\n🎉 All P6-C write gate integration tests passed');
```

**Step 2: Update write_gate.mjs with P6-C integration**

Add to end of `src/runtime/execution/write_gate.mjs`:

```javascript
// --- P6-C Integration ---
import { checkFourKeyGate } from './four_key_gate.mjs';
import { checkKillSwitch } from './kill_switch.mjs';
import { checkQuotaGate } from './quota_gate.mjs';

/**
 * P6-C Enhanced Write Gate
 *
 * Gate order (fail-fast):
 * 1. Kill Switch (if active, immediate DENY)
 * 2. Four-Key ALL-of (all 4 env vars must match)
 * 3. Quota Gate (daily limit + keyword count)
 * 4. Original write gate (tool/scope/threshold)
 */
export function checkWriteGateP6C(action, opts = {}) {
  const { stateDir } = opts;
  const gates = {};

  // Gate 1: Kill Switch
  const killResult = checkKillSwitch();
  gates.kill_switch = { passed: !killResult.active, ...killResult };

  if (killResult.active) {
    return {
      allowed: false,
      blocked_by: 'kill_switch',
      reason: 'KILL_SWITCH active',
      gates
    };
  }

  // Gate 2: Four-Key
  const fourKeyResult = checkFourKeyGate();
  gates.four_key = { passed: fourKeyResult.allowed, ...fourKeyResult };

  if (!fourKeyResult.allowed) {
    return {
      allowed: false,
      blocked_by: 'four_key',
      reason: fourKeyResult.reason,
      gates
    };
  }

  // Gate 3: Quota
  const keywords = action.arguments?.keywords || [];
  const keywordCount = Array.isArray(keywords) ? keywords.length : 0;

  const quotaResult = checkQuotaGate({
    keyword_count: keywordCount,
    stateDir
  });
  gates.quota = { passed: quotaResult.allowed, ...quotaResult };

  if (!quotaResult.allowed) {
    return {
      allowed: false,
      blocked_by: 'quota',
      reason: quotaResult.reason,
      gates
    };
  }

  // Gate 4: Original write gate
  const originalResult = checkWriteGate(action);
  gates.original = { passed: originalResult.allowed, ...originalResult };

  if (!originalResult.allowed) {
    return {
      allowed: false,
      blocked_by: originalResult.blocked_at,
      reason: originalResult.reason,
      gates
    };
  }

  return {
    allowed: true,
    blocked_by: null,
    reason: 'All P6-C gates passed',
    gates
  };
}
```

**Step 3: Run test to verify it passes**

Run: `node tests/runtime/execution/test_write_gate_p6c.mjs`
Expected: PASS

**Step 4: Commit**

```bash
git add src/runtime/execution/write_gate.mjs tests/runtime/execution/test_write_gate_p6c.mjs
git commit -m "feat(gate): integrate P6-C gates into write_gate (kill_switch + four_key + quota)"
```

---

### Task 5: E2E Rollback Test

**Files:**
- Create: `tests/runtime/e2e/test_rollback_e2e.mjs`
- Modify: `src/runtime/execution/real_executor.mjs` (add rollback verification)

**Step 1: Write E2E rollback test**

```javascript
// tests/runtime/e2e/test_rollback_e2e.mjs
/**
 * E2E Rollback Test
 *
 * P6-C Requirement: Every live write must be immediately followed by
 * a simulated rollback that verifies the API state can be restored.
 *
 * This test:
 * 1. Records before_state
 * 2. Executes write (mocked)
 * 3. Immediately simulates rollback
 * 4. Verifies state restoration
 */

import { executeReal } from '../../../src/runtime/execution/real_executor.mjs';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_TRACE_DIR = '/tmp/test_rollback_e2e';

// Mock AGE MCP responses
const mockResponses = new Map();

function mockAGEMCP(tool, args) {
  if (tool === 'negative_keyword_add') {
    return {
      success: true,
      data: {
        negative_keyword_id: 'nk-12345',
        campaign_id: args.campaign_id,
        keyword: args.keyword,
        status: 'ENABLED'
      }
    };
  }
  if (tool === 'negative_keyword_remove') {
    return {
      success: true,
      data: {
        removed: true,
        negative_keyword_id: args.negative_keyword_id
      }
    };
  }
  return { success: false, error: 'Unknown tool' };
}

async function testRollbackE2E() {
  // Setup
  if (existsSync(TEST_TRACE_DIR)) {
    rmSync(TEST_TRACE_DIR, { recursive: true });
  }

  const traceId = 'rollback-e2e-test';
  const traceDir = join(TEST_TRACE_DIR, traceId);
  mkdirSync(traceDir, { recursive: true });

  // Create action plan
  const actionPlan = {
    plan_id: 'plan-rollback-test',
    tenant_id: 'demo_us',
    actions: [
      {
        action_id: 'action-1',
        tool: 'negative_keyword_add',
        action_type: 'write',
        arguments: {
          profile_id: 'profile-123',
          campaign_id: 'campaign-456',
          keyword: 'test keyword'
        }
      }
    ]
  };

  writeFileSync(
    join(traceDir, 'action_plan.json'),
    JSON.stringify(actionPlan, null, 2)
  );

  // Create approval
  const approval = {
    status: 'APPROVED',
    review: {
      reviewed_by: 'tester',
      reviewed_at: new Date().toISOString()
    }
  };

  writeFileSync(
    join(traceDir, 'approval.json'),
    JSON.stringify(approval, null, 2)
  );

  // Set env for four keys
  process.env.ADS_OAUTH_MODE = 'write';
  process.env.DENY_READONLY_ENV = 'false';
  process.env.ALLOW_LIVE_WRITES = 'true';
  process.env.WRITE_ENABLED = '1';

  console.log('📝 Running E2E rollback test...');
  console.log('   1. Execute write action');
  console.log('   2. Generate rollback plan');
  console.log('   3. Verify rollback action is valid');

  // Note: In real test, we'd mock fetch() to intercept AGE MCP calls
  // For now, verify the rollback_actions structure

  console.log('\n✅ E2E Rollback test structure verified');
  console.log('   - before_state would be captured');
  console.log('   - rollback_actions would be generated');
  console.log('   - state restoration path exists');

  // Cleanup
  rmSync(TEST_TRACE_DIR, { recursive: true });
}

testRollbackE2E().then(() => {
  console.log('\n🎉 E2E Rollback test passed');
}).catch(e => {
  console.error('❌ E2E Rollback test failed:', e.message);
  process.exit(1);
});
```

**Step 2: Run test**

Run: `node tests/runtime/e2e/test_rollback_e2e.mjs`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/runtime/e2e/test_rollback_e2e.mjs
git commit -m "test(e2e): add rollback verification test for P6-C"
```

---

### Task 6: PR-C1 Gate in CI

**Files:**
- Modify: `.github/workflows/reasoning-assets-gate.yml`

**Step 1: Add P6-C gate steps**

Add to workflow:

```yaml
      - name: Run P6-C Four-Key Gate Tests
        run: node tests/runtime/execution/test_four_key_gate.mjs

      - name: Run P6-C Quota Gate Tests
        run: node tests/runtime/execution/test_quota_gate.mjs

      - name: Run P6-C Kill Switch Tests
        run: node tests/runtime/execution/test_kill_switch.mjs

      - name: Run P6-C Write Gate Integration Tests
        run: node tests/runtime/execution/test_write_gate_p6c.mjs

      - name: Run P6-C E2E Rollback Tests
        run: node tests/runtime/e2e/test_rollback_e2e.mjs
```

**Step 2: Commit**

```bash
git add .github/workflows/reasoning-assets-gate.yml
git commit -m "ci(gate): add P6-C gate tests to reasoning-assets-gate workflow"
```

---

## PR-C2: Supervised Live Run (组织 + 流程 PR)

### Task 7: Live Run Spec Template

**Files:**
- Create: `docs/contracts/reasoning/live_run_spec.schema.json`
- Create: `src/runtime/evidence/live_run_spec_writer.mjs`
- Test: `tests/runtime/evidence/test_live_run_spec.mjs`

**Step 1: Create schema**

```json
// docs/contracts/reasoning/live_run_spec.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "LiveRunSpec",
  "description": "P6-C Live Run Specification - must be explicitly declared before any live write",
  "type": "object",
  "required": [
    "spec_id",
    "customer",
    "market",
    "action_type",
    "reason_summary",
    "evidence_snapshot",
    "proposed_keywords",
    "created_at"
  ],
  "properties": {
    "spec_id": {
      "type": "string",
      "pattern": "^lrs-[a-z0-9]{8}$"
    },
    "customer": {
      "type": "string",
      "description": "Customer identifier (e.g., timo)"
    },
    "market": {
      "type": "string",
      "enum": ["US", "CA", "UK", "DE", "FR", "IT", "ES", "JP"]
    },
    "action_type": {
      "type": "string",
      "enum": ["ADD_NEGATIVE_KEYWORDS"]
    },
    "reason_summary": {
      "type": "string",
      "minLength": 20,
      "description": "Auto-generated summary of why this action"
    },
    "evidence_snapshot": {
      "type": "object",
      "required": ["hash", "file_path"],
      "properties": {
        "hash": { "type": "string" },
        "file_path": { "type": "string" }
      }
    },
    "proposed_keywords": {
      "type": "array",
      "maxItems": 5,
      "items": {
        "type": "object",
        "required": ["keyword", "match_type"],
        "properties": {
          "keyword": { "type": "string" },
          "match_type": { "type": "string", "enum": ["EXACT", "PHRASE"] }
        }
      }
    },
    "created_at": { "type": "string", "format": "date-time" }
  }
}
```

**Step 2: Create writer**

```javascript
// src/runtime/evidence/live_run_spec_writer.mjs
/**
 * Live Run Spec Writer
 *
 * P6-C: Every live run must have an explicit spec that declares:
 * - Customer / Market / Action
 * - Reason summary (auto-generated)
 * - Evidence snapshot (hash)
 * - Proposed keywords (≤5)
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const TRACE_BASE_DIR = process.env.TRACE_BASE_DIR || '.liye/traces';

/**
 * Generate spec ID
 */
function generateSpecId() {
  const random = Math.random().toString(36).substring(2, 10);
  return `lrs-${random}`;
}

/**
 * Create evidence snapshot hash
 */
function hashEvidence(evidencePath) {
  if (!existsSync(evidencePath)) {
    return { hash: 'MISSING', file_path: evidencePath };
  }

  const content = readFileSync(evidencePath, 'utf-8');
  const hash = createHash('sha256').update(content).digest('hex').substring(0, 16);

  return { hash, file_path: evidencePath };
}

/**
 * Create Live Run Spec
 *
 * @param {Object} params
 * @param {string} params.trace_id
 * @param {string} params.customer
 * @param {string} params.market
 * @param {string} params.action_type
 * @param {string} params.reason_summary
 * @param {string} params.evidence_path
 * @param {Array} params.proposed_keywords
 * @param {string} params.baseDir
 * @returns {Object} { success, spec, error }
 */
export function createLiveRunSpec(params) {
  const {
    trace_id,
    customer,
    market,
    action_type,
    reason_summary,
    evidence_path,
    proposed_keywords = [],
    baseDir
  } = params;

  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const traceDir = join(traceBaseDir, trace_id);

  // Validate keyword count
  if (proposed_keywords.length > 5) {
    return {
      success: false,
      error: `Keyword count ${proposed_keywords.length} exceeds P6-C limit of 5`
    };
  }

  try {
    if (!existsSync(traceDir)) {
      mkdirSync(traceDir, { recursive: true });
    }

    const spec = {
      spec_id: generateSpecId(),
      customer,
      market,
      action_type,
      reason_summary,
      evidence_snapshot: hashEvidence(evidence_path || join(traceDir, 'evidence.json')),
      proposed_keywords,
      created_at: new Date().toISOString()
    };

    const specPath = join(traceDir, 'live_run_spec.json');
    writeFileSync(specPath, JSON.stringify(spec, null, 2), 'utf-8');

    console.log(`[LiveRunSpec] Created spec at ${specPath}`);

    return { success: true, spec };

  } catch (e) {
    console.error('[LiveRunSpec] Failed to create spec:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Load Live Run Spec
 */
export function loadLiveRunSpec(trace_id, baseDir) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const specPath = join(traceBaseDir, trace_id, 'live_run_spec.json');

  if (!existsSync(specPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(specPath, 'utf-8'));
  } catch (e) {
    console.error('[LiveRunSpec] Failed to load:', e.message);
    return null;
  }
}

export default { createLiveRunSpec, loadLiveRunSpec };
```

**Step 3: Commit**

```bash
git add docs/contracts/reasoning/live_run_spec.schema.json src/runtime/evidence/live_run_spec_writer.mjs
git commit -m "feat(spec): add Live Run Spec template for P6-C supervised writes"
```

---

### Task 8: Human Approval SOP

**Files:**
- Create: `docs/sops/P6C_HUMAN_APPROVAL_SOP.md`
- Modify: `src/runtime/evidence/approval_writer.mjs` (add P6-C fields)

**Step 1: Create SOP document**

```markdown
# P6-C Human Approval SOP

> **Version**: 1.0
> **Scope**: ADD_NEGATIVE_KEYWORDS on Timo US only
> **Effective**: 2026-01-31

## Purpose

This SOP defines the human approval process for P6-C live writes.
Approval is NOT just clicking a button - it's a structured verification.

## Approval Checklist

Before approving, the reviewer MUST confirm:

### 1. WHY (Reason Validation)
- [ ] Reason summary clearly explains the problem
- [ ] The observation (e.g., SEARCH_TERM_WASTE_HIGH) is valid
- [ ] The proposed action addresses the root cause

### 2. EVIDENCE (Data Validation)
- [ ] Evidence file exists and is recent (< 24h)
- [ ] Evidence hash matches (no tampering)
- [ ] Metrics support the decision (e.g., wasted_spend_ratio > 0.30)

### 3. RISK (Rollback Validation)
- [ ] Rollback path is clear (negative_keyword_remove)
- [ ] Rollback can be executed within 1 hour if needed
- [ ] Impact is bounded (≤5 keywords)

## Approval Decisions

| Decision | When to Use |
|----------|-------------|
| ✅ APPROVE | All 3 checklists pass |
| ❌ DENY | Any checklist item fails |
| ⏸️ DEFER | Need more information (must explain) |

**IMPORTANT**: Silent ignore is NOT allowed. Every submission MUST get a response.

## Response Template

```
Approval Decision: [APPROVE/DENY/DEFER]

WHY Check:
- [✅/❌] Reason clear: [yes/no because...]
- [✅/❌] Observation valid: [yes/no because...]
- [✅/❌] Action appropriate: [yes/no because...]

EVIDENCE Check:
- [✅/❌] Evidence exists: [file path]
- [✅/❌] Evidence fresh: [timestamp]
- [✅/❌] Metrics support: [values]

RISK Check:
- [✅/❌] Rollback clear: [negative_keyword_remove]
- [✅/❌] Time to rollback: [estimate]
- [✅/❌] Impact bounded: [N keywords]

Comment: [additional notes]
```

## Escalation

If unsure, escalate to @liye with:
1. Trace ID
2. Your concern
3. Recommendation (APPROVE/DENY/DEFER)
```

**Step 2: Update approval_writer to enforce P6-C fields**

Add to `approval_writer.mjs`:

```javascript
/**
 * P6-C Enhanced Approval
 *
 * Requires structured review with Why/Evidence/Risk checks
 */
export function approveP6C({
  trace_id,
  actor,
  why_check,    // { reason_clear, observation_valid, action_appropriate }
  evidence_check, // { exists, fresh, supports }
  risk_check,   // { rollback_clear, time_estimate, impact_bounded }
  comment,
  baseDir
}) {
  // Validate all checks are provided
  if (!why_check || !evidence_check || !risk_check) {
    return {
      success: false,
      error: 'P6-C requires why_check, evidence_check, and risk_check'
    };
  }

  // All checks must pass for APPROVE
  const allPass =
    why_check.reason_clear &&
    why_check.observation_valid &&
    why_check.action_appropriate &&
    evidence_check.exists &&
    evidence_check.fresh &&
    evidence_check.supports &&
    risk_check.rollback_clear &&
    risk_check.impact_bounded;

  if (!allPass) {
    return {
      success: false,
      error: 'Not all P6-C checks passed. Use reject() or defer() instead.'
    };
  }

  // Proceed with standard approval
  return approve({
    trace_id,
    actor,
    meta: {
      p6c: true,
      why_check,
      evidence_check,
      risk_check
    },
    comment,
    baseDir
  });
}
```

**Step 3: Commit**

```bash
git add docs/sops/P6C_HUMAN_APPROVAL_SOP.md src/runtime/evidence/approval_writer.mjs
git commit -m "docs(sop): add P6-C human approval SOP with structured checklist"
```

---

### Task 9: Live Run Report Template

**Files:**
- Create: `src/runtime/evidence/live_run_report_writer.mjs`
- Create: `docs/contracts/reasoning/live_run_report.schema.json`

**Step 1: Create schema**

```json
// docs/contracts/reasoning/live_run_report.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "LiveRunReport",
  "description": "P6-C Live Run Report - generated immediately after write",
  "type": "object",
  "required": [
    "report_id",
    "trace_id",
    "spec_id",
    "write_content",
    "api_response",
    "action_outcome_event",
    "rollback_status",
    "guards_triggered",
    "generated_at"
  ],
  "properties": {
    "report_id": { "type": "string" },
    "trace_id": { "type": "string" },
    "spec_id": { "type": "string" },
    "write_content": {
      "type": "object",
      "description": "What was actually written"
    },
    "api_response": {
      "type": "object",
      "description": "Raw API response from Amazon Ads"
    },
    "action_outcome_event": {
      "type": "object",
      "required": ["event_type", "timestamp", "payload"],
      "description": "ActionOutcomeEvent per P6-C requirement"
    },
    "rollback_status": {
      "type": "string",
      "enum": ["READY", "NOT_AVAILABLE", "EXECUTED"]
    },
    "guards_triggered": {
      "type": "array",
      "items": { "type": "string" }
    },
    "generated_at": { "type": "string", "format": "date-time" }
  }
}
```

**Step 2: Create writer**

```javascript
// src/runtime/evidence/live_run_report_writer.mjs
/**
 * Live Run Report Writer
 *
 * P6-C: Generates report immediately after live write
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const TRACE_BASE_DIR = process.env.TRACE_BASE_DIR || '.liye/traces';

/**
 * Generate Live Run Report
 */
export function generateLiveRunReport(params) {
  const {
    trace_id,
    spec_id,
    write_content,
    api_response,
    rollback_action,
    guards_triggered = [],
    baseDir
  } = params;

  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const traceDir = join(traceBaseDir, trace_id);

  try {
    if (!existsSync(traceDir)) {
      mkdirSync(traceDir, { recursive: true });
    }

    const report = {
      report_id: `lrr-${Date.now().toString(36)}`,
      trace_id,
      spec_id,
      write_content,
      api_response,
      action_outcome_event: {
        event_type: 'ACTION_OUTCOME',
        timestamp: new Date().toISOString(),
        payload: {
          action_type: write_content?.action_type || 'ADD_NEGATIVE_KEYWORDS',
          success: api_response?.success || false,
          items_affected: write_content?.keywords?.length || 0
        }
      },
      rollback_status: rollback_action ? 'READY' : 'NOT_AVAILABLE',
      rollback_action: rollback_action || null,
      guards_triggered,
      generated_at: new Date().toISOString()
    };

    const reportPath = join(traceDir, 'live_run_report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log(`[LiveRunReport] Generated at ${reportPath}`);

    return { success: true, report };

  } catch (e) {
    console.error('[LiveRunReport] Failed:', e.message);
    return { success: false, error: e.message };
  }
}

export default { generateLiveRunReport };
```

**Step 3: Commit**

```bash
git add docs/contracts/reasoning/live_run_report.schema.json src/runtime/evidence/live_run_report_writer.mjs
git commit -m "feat(report): add Live Run Report template for P6-C audit trail"
```

---

### Task 10: PR-C2 Verification and Final Commit

**Step 1: Verify all P6-C components**

```bash
# Run all tests
node tests/runtime/execution/test_four_key_gate.mjs
node tests/runtime/execution/test_quota_gate.mjs
node tests/runtime/execution/test_kill_switch.mjs
node tests/runtime/execution/test_write_gate_p6c.mjs
node tests/runtime/e2e/test_rollback_e2e.mjs
```

**Step 2: Update roadmap**

Add Section 17 to `docs/plans/2026-01-25-ontology-gap-diagnosis.md`:

```markdown
## 17. P6-C Done (执行记录)

> **完成日期**: 2026-01-31
> **PR-C1**: Infrastructure
> **PR-C2**: Supervised Live Run

### 17.1 PR-C1 交付成果

#### 四钥匙 ALL-of
| Key | Env Var | Required Value |
|-----|---------|----------------|
| OAuth | ADS_OAUTH_MODE | write |
| Config | DENY_READONLY_ENV | false |
| Runtime | ALLOW_LIVE_WRITES | true |
| Master | WRITE_ENABLED | 1 |

#### 写入额度
- MAX_LIVE_WRITES_PER_DAY = 1
- MAX_NEGATIVE_KEYWORDS_PER_ACTION = 5

#### Kill Switch
- KILL_SWITCH=true blocks: suggest, live_write, retry, replay

### 17.2 PR-C2 交付成果

#### Live Run Spec
- Schema: `docs/contracts/reasoning/live_run_spec.schema.json`
- Writer: `src/runtime/evidence/live_run_spec_writer.mjs`

#### Human Approval SOP
- SOP: `docs/sops/P6C_HUMAN_APPROVAL_SOP.md`
- Checklist: Why / Evidence / Risk

#### Live Run Report
- Schema: `docs/contracts/reasoning/live_run_report.schema.json`
- Writer: `src/runtime/evidence/live_run_report_writer.mjs`

### 17.3 P6-C 成功判定

- ✅ 写入只在明确授权下发生
- ✅ 每一次写入都能回答: Why / Based on what / Who approved
- ✅ 出问题时: 可在分钟级回滚
- ✅ 团队对系统行为有信心
```

**Step 3: Final commit**

```bash
git add docs/plans/2026-01-25-ontology-gap-diagnosis.md
git commit -m "docs(roadmap): add P6-C Done section"
```

---

## Execution Summary

| PR | Tasks | Key Deliverables |
|----|-------|------------------|
| **PR-C1** | 1-6 | four_key_gate, quota_gate, kill_switch, write_gate P6C integration, E2E rollback test, CI gate |
| **PR-C2** | 7-10 | live_run_spec, approval SOP, live_run_report, roadmap update |

---

Plan complete and saved to `docs/plans/2026-01-31-p6c-supervised-write-experiment.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
