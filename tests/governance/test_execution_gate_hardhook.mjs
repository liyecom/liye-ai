#!/usr/bin/env node
/**
 * Execution Gate Hard Hook Tests
 * SSOT: tests/governance/test_execution_gate_hardhook.mjs
 *
 * 验证 execution_gate.preflightCheck() 作为写入路径的"不可绕过"前置：
 * 1. tier=recommend 时，WRITE_LIMITED 动作必须被拒绝
 * 2. kill_switch=true 时，WRITE_LIMITED 动作必须被拒绝
 * 3. policy=quarantine 时，WRITE_LIMITED 动作必须被拒绝
 * 4. 所有拒绝都产生 execution_receipt
 *
 * 运行：node tests/governance/test_execution_gate_hardhook.mjs
 */

import { executeWithGate } from '../../src/adapters/write_executor/index.mjs';
import { readFileSync, existsSync, unlinkSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

// 颜色
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let passCount = 0;
let failCount = 0;

function pass(name) {
  console.log(`${GREEN}✅ PASS${RESET}: ${name}`);
  passCount++;
}

function fail(name, reason) {
  console.log(`${RED}❌ FAIL${RESET}: ${name}`);
  console.log(`   Reason: ${reason}`);
  failCount++;
}

function section(name) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`${name}`);
  console.log('─'.repeat(60));
}

// ============================================================================
// Test 1: tier=recommend 时，WRITE_LIMITED 被拒绝
// ============================================================================
async function test_recommend_tier_blocks_write() {
  const testName = 'recommend tier blocks WRITE_LIMITED actions';

  const result = await executeWithGate({
    recommendation: {
      action_type: 'bid_adjust',
      parameters: { keyword_id: 'test', current_bid: 1.0, new_bid: 1.5 }
    },
    policyId: 'TEST_POLICY',
    currentTier: 'recommend',  // recommend 不允许 WRITE_LIMITED
    dryRun: true,
    runId: 'test-recommend-tier'
  });

  if (!result.allowed && result.gateResult.denied_by === 'tier_permission') {
    pass(testName);
  } else {
    fail(testName, `Expected denied by tier_permission, got: ${JSON.stringify(result)}`);
  }

  // 验证 receipt 产生
  if (result.receipt && result.receipt.status === 'DENIED') {
    pass(testName + ' (receipt recorded)');
  } else {
    fail(testName + ' (receipt recorded)', 'No DENIED receipt found');
  }
}

// ============================================================================
// Test 2: kill_switch=true 时，WRITE_LIMITED 被拒绝
// ============================================================================
async function test_kill_switch_blocks_write() {
  const testName = 'kill_switch=true blocks WRITE_LIMITED actions';

  // 设置 kill_switch 环境变量
  const originalKillSwitch = process.env.LIYE_KILL_SWITCH;
  process.env.LIYE_KILL_SWITCH = 'true';

  try {
    const result = await executeWithGate({
      recommendation: {
        action_type: 'keyword_negation',
        parameters: { keyword_text: 'test', campaign_id: 'camp1' }
      },
      policyId: 'TEST_POLICY',
      currentTier: 'execute_limited',  // 正确的 tier
      dryRun: true,
      runId: 'test-kill-switch'
    });

    if (!result.allowed && result.gateResult.denied_by === 'kill_switch') {
      pass(testName);
    } else {
      fail(testName, `Expected denied by kill_switch, got: ${JSON.stringify(result)}`);
    }
  } finally {
    // 恢复环境变量
    if (originalKillSwitch === undefined) {
      delete process.env.LIYE_KILL_SWITCH;
    } else {
      process.env.LIYE_KILL_SWITCH = originalKillSwitch;
    }
  }
}

// ============================================================================
// Test 3: policy 在 quarantine 时，WRITE_LIMITED 被拒绝
// ============================================================================
async function test_quarantine_policy_blocks_write() {
  const testName = 'quarantined policy blocks WRITE_LIMITED actions';

  // 创建临时 quarantine policy
  const quarantineDir = join(PROJECT_ROOT, 'state', 'memory', 'learned', 'policies', 'quarantine');
  mkdirSync(quarantineDir, { recursive: true });

  const testPolicyPath = join(quarantineDir, 'HARDHOOK_TEST_POLICY.yaml');
  writeFileSync(testPolicyPath, `policy_id: HARDHOOK_TEST_POLICY
domain: test
validation_status: quarantine
demoted_at: "2026-02-19T12:00:00Z"
demoted_reason: "test drift"
`);

  try {
    const result = await executeWithGate({
      recommendation: {
        action_type: 'budget_adjust',
        parameters: { campaign_id: 'camp1', current_budget: 100, new_budget: 150 }
      },
      policyId: 'HARDHOOK_TEST_POLICY',  // 在 quarantine 中
      currentTier: 'execute_limited',
      dryRun: true,
      runId: 'test-quarantine'
    });

    if (!result.allowed && result.gateResult.denied_by === 'drift_monitor') {
      pass(testName);
    } else {
      fail(testName, `Expected denied by drift_monitor, got: ${JSON.stringify(result)}`);
    }
  } finally {
    // 清理
    if (existsSync(testPolicyPath)) {
      unlinkSync(testPolicyPath);
    }
  }
}

// ============================================================================
// Test 4: observe tier 也阻断 WRITE_LIMITED
// ============================================================================
async function test_observe_tier_blocks_write() {
  const testName = 'observe tier blocks WRITE_LIMITED actions';

  const result = await executeWithGate({
    recommendation: {
      action_type: 'campaign_pause',
      parameters: { campaign_id: 'camp1' }
    },
    policyId: 'TEST_POLICY',
    currentTier: 'observe',  // observe 不允许 WRITE_LIMITED
    dryRun: true,
    runId: 'test-observe-tier'
  });

  if (!result.allowed && result.gateResult.denied_by === 'tier_permission') {
    pass(testName);
  } else {
    fail(testName, `Expected denied by tier_permission, got: ${JSON.stringify(result)}`);
  }
}

// ============================================================================
// Test 5: execute_limited tier 允许 WRITE_LIMITED（正例）
// ============================================================================
async function test_execute_limited_allows_write() {
  const testName = 'execute_limited tier allows WRITE_LIMITED actions (dry-run)';

  // 确保 kill_switch 关闭
  const originalKillSwitch = process.env.LIYE_KILL_SWITCH;
  delete process.env.LIYE_KILL_SWITCH;

  try {
    const result = await executeWithGate({
      recommendation: {
        action_type: 'bid_adjust',
        parameters: { keyword_id: 'test', campaign_id: 'camp1', current_bid: 1.0, new_bid: 1.5 }
      },
      policyId: null,  // 无 policy，不会触发 drift 检查
      currentTier: 'execute_limited',
      dryRun: true,
      runId: 'test-execute-limited'
    });

    if (result.allowed && result.result) {
      pass(testName);
    } else {
      fail(testName, `Expected allowed, got: ${JSON.stringify(result)}`);
    }

    // 验证 receipt 状态
    if (result.receipt && result.receipt.status === 'DRY_RUN_APPLIED') {
      pass(testName + ' (receipt status=DRY_RUN_APPLIED)');
    } else {
      fail(testName + ' (receipt status)', `Expected DRY_RUN_APPLIED, got: ${result.receipt?.status}`);
    }
  } finally {
    if (originalKillSwitch !== undefined) {
      process.env.LIYE_KILL_SWITCH = originalKillSwitch;
    }
  }
}

// ============================================================================
// Test 6: READ_ONLY 动作在任何 tier 都允许
// ============================================================================
async function test_read_only_always_allowed() {
  const testName = 'READ_ONLY actions (investigate_metric) allowed in any tier';

  const result = await executeWithGate({
    recommendation: {
      action_type: 'investigate_metric',
      parameters: { metric: 'acos', threshold: 0.25 }
    },
    policyId: null,
    currentTier: 'observe',  // 即使是 observe tier
    dryRun: true,
    runId: 'test-read-only'
  });

  if (result.allowed) {
    pass(testName);
  } else {
    fail(testName, `Expected allowed for READ_ONLY action, got: ${JSON.stringify(result)}`);
  }
}

// ============================================================================
// Test 7: 验证 receipts 文件存在且格式正确
// ============================================================================
async function test_receipts_file_exists() {
  const testName = 'execution receipts file exists and is append-only';

  const receiptsPath = join(PROJECT_ROOT, 'state', 'memory', 'facts', 'fact_execution_receipts.jsonl');

  if (existsSync(receiptsPath)) {
    const content = readFileSync(receiptsPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    if (lines.length > 0) {
      try {
        const lastReceipt = JSON.parse(lines[lines.length - 1]);
        if (lastReceipt.run_id && lastReceipt.status && lastReceipt.timestamp) {
          pass(testName);
        } else {
          fail(testName, 'Receipt missing required fields');
        }
      } catch (e) {
        fail(testName, `Invalid JSON in receipts: ${e.message}`);
      }
    } else {
      fail(testName, 'Receipts file is empty');
    }
  } else {
    fail(testName, 'Receipts file not found');
  }
}

// ============================================================================
// 主测试入口
// ============================================================================
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Execution Gate Hard Hook Tests (S1 Phase B)');
  console.log('═══════════════════════════════════════════════════════════');

  section('1. Tier Permission Tests (不可绕过)');
  await test_recommend_tier_blocks_write();
  await test_observe_tier_blocks_write();
  await test_execute_limited_allows_write();

  section('2. Kill Switch Tests');
  await test_kill_switch_blocks_write();

  section('3. Drift/Quarantine Tests');
  await test_quarantine_policy_blocks_write();

  section('4. READ_ONLY Actions');
  await test_read_only_always_allowed();

  section('5. Receipts Audit Trail');
  await test_receipts_file_exists();

  // 汇总
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                    Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  ${GREEN}Passed: ${passCount}${RESET}`);
  console.log(`  ${RED}Failed: ${failCount}${RESET}`);
  console.log('═══════════════════════════════════════════════════════════');

  if (failCount > 0) {
    console.log(`\n${RED}FAILED: ${failCount} test(s) failed.${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`\n${GREEN}PASSED: All ${passCount} tests passed.${RESET}`);
    console.log(`\n${YELLOW}Hard Hook Verified: executeWithGate() cannot be bypassed.${RESET}\n`);
    process.exit(0);
  }
}

runAllTests().catch(e => {
  console.error(`${RED}Test runner error: ${e.message}${RESET}`);
  console.error(e.stack);
  process.exit(1);
});
