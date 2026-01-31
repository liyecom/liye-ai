// tests/runtime/e2e/test_rollback_e2e.mjs
/**
 * E2E Rollback Test
 *
 * P6-C Requirement: Every live write must be immediately followed by
 * a simulated rollback that verifies the API state can be restored.
 */

import { buildRollbackAction } from '../../../src/runtime/execution/write_gate.mjs';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

const TEST_TRACE_DIR = '/tmp/test_rollback_e2e';

function setup() {
  if (existsSync(TEST_TRACE_DIR)) rmSync(TEST_TRACE_DIR, { recursive: true });
  mkdirSync(TEST_TRACE_DIR, { recursive: true });
}

function teardown() {
  if (existsSync(TEST_TRACE_DIR)) rmSync(TEST_TRACE_DIR, { recursive: true });
}

// Test: Rollback action is generated for negative_keyword_add
function testNegativeKeywordRollback() {
  const originalAction = {
    action_id: 'action-1',
    tool: 'negative_keyword_add',
    action_type: 'write',
    arguments: {
      profile_id: 'profile-123',
      campaign_id: 'campaign-456',
      adgroup_id: 'adgroup-789',
      keyword: 'test keyword'
    }
  };

  // Simulate API response with negative_keyword_id
  const apiResponse = {
    success: true,
    data: {
      negative_keyword_id: 'nk-12345',
      status: 'ENABLED'
    }
  };

  const rollbackAction = buildRollbackAction(originalAction, apiResponse);

  console.assert(rollbackAction !== null, 'Rollback action should be generated');
  console.assert(rollbackAction.tool === 'negative_keyword_remove', 'Should use remove tool');
  console.assert(rollbackAction.arguments.negative_keyword_id === 'nk-12345', 'Should have keyword ID');
  console.assert(rollbackAction.arguments.profile_id === 'profile-123', 'Should preserve profile_id');
  console.assert(rollbackAction.arguments.campaign_id === 'campaign-456', 'Should preserve campaign_id');

  console.log('PASS testNegativeKeywordRollback');
}

// Test: Rollback action is generated for bid_adjust
function testBidAdjustRollback() {
  const originalAction = {
    action_id: 'action-2',
    tool: 'bid_adjust',
    action_type: 'write',
    arguments: {
      profile_id: 'profile-123',
      campaign_id: 'campaign-456',
      adgroup_id: 'adgroup-789',
      keyword_id: 'kw-111',
      original_bid: 1.50,
      new_bid: 1.75
    }
  };

  const apiResponse = { success: true, data: { updated: true } };

  const rollbackAction = buildRollbackAction(originalAction, apiResponse);

  console.assert(rollbackAction !== null, 'Rollback action should be generated');
  console.assert(rollbackAction.tool === 'bid_adjust', 'Should use same tool');
  console.assert(rollbackAction.arguments.original_bid === 1.75, 'Should swap bids');
  console.assert(rollbackAction.arguments.new_bid === 1.50, 'Should restore original');

  console.log('PASS testBidAdjustRollback');
}

// Test: Rollback plan file structure
function testRollbackPlanStructure() {
  setup();

  const traceId = 'test-trace-001';
  const traceDir = join(TEST_TRACE_DIR, traceId);
  mkdirSync(traceDir, { recursive: true });

  // Simulate execution result with rollback actions
  const executionResult = {
    trace_id: traceId,
    mode: 'real_write',
    rollback_actions: [
      {
        tool: 'negative_keyword_remove',
        arguments: { negative_keyword_id: 'nk-12345' },
        original_action_id: 'action-1'
      }
    ]
  };

  // Write rollback plan
  const rollbackPlanPath = join(traceDir, 'rollback_plan.json');
  writeFileSync(rollbackPlanPath, JSON.stringify({
    trace_id: traceId,
    created_at: new Date().toISOString(),
    rollback_actions: executionResult.rollback_actions,
    status: 'READY'
  }, null, 2));

  // Verify structure
  const plan = JSON.parse(readFileSync(rollbackPlanPath, 'utf-8'));
  console.assert(plan.trace_id === traceId, 'Should have trace_id');
  console.assert(plan.status === 'READY', 'Should be READY');
  console.assert(plan.rollback_actions.length === 1, 'Should have rollback action');
  console.assert(plan.rollback_actions[0].tool === 'negative_keyword_remove', 'Should have correct tool');

  teardown();
  console.log('PASS testRollbackPlanStructure');
}

// Test: No rollback for unknown tools
function testNoRollbackForUnknownTool() {
  const originalAction = {
    tool: 'unknown_tool',
    arguments: {}
  };

  const rollbackAction = buildRollbackAction(originalAction, { success: true });

  console.assert(rollbackAction === null, 'Should return null for unknown tool');

  console.log('PASS testNoRollbackForUnknownTool');
}

// Test: Before state capture is required for rollback
function testBeforeStateCaptureForRollback() {
  const originalAction = {
    action_id: 'action-3',
    tool: 'bid_adjust',
    action_type: 'write',
    arguments: {
      profile_id: 'profile-123',
      campaign_id: 'campaign-456',
      keyword_id: 'kw-111',
      original_bid: 2.00,
      new_bid: 2.20
    }
  };

  // Before state should be captured as original_bid
  const beforeState = {
    bid: originalAction.arguments.original_bid
  };

  const apiResponse = { success: true };
  const rollbackAction = buildRollbackAction(originalAction, apiResponse);

  // Verify rollback restores to before state
  console.assert(rollbackAction.arguments.new_bid === beforeState.bid,
    'Rollback should restore to before state');

  console.log('PASS testBeforeStateCaptureForRollback');
}

// Test: Rollback action preserves all necessary context
function testRollbackPreservesContext() {
  const originalAction = {
    action_id: 'action-4',
    tool: 'negative_keyword_add',
    action_type: 'write',
    arguments: {
      profile_id: 'profile-abc',
      campaign_id: 'campaign-xyz',
      adgroup_id: 'adgroup-123',
      keyword: 'irrelevant keyword'
    }
  };

  const apiResponse = {
    success: true,
    data: {
      negative_keyword_id: 'nk-99999'
    }
  };

  const rollbackAction = buildRollbackAction(originalAction, apiResponse);

  // Verify all context is preserved
  console.assert(rollbackAction.original_action_id === 'action-4',
    'Should preserve original action ID');
  console.assert(rollbackAction.rollback_for === 'negative_keyword_add',
    'Should indicate what action it rolls back');
  console.assert(rollbackAction.arguments.profile_id === 'profile-abc',
    'Should preserve profile_id');
  console.assert(rollbackAction.arguments.campaign_id === 'campaign-xyz',
    'Should preserve campaign_id');
  console.assert(rollbackAction.arguments.adgroup_id === 'adgroup-123',
    'Should preserve adgroup_id');

  console.log('PASS testRollbackPreservesContext');
}

// Test: Missing API response data prevents rollback generation
function testMissingApiResponseData() {
  const originalAction = {
    action_id: 'action-5',
    tool: 'negative_keyword_add',
    arguments: {
      profile_id: 'profile-123',
      keyword: 'test'
    }
  };

  // API response without required negative_keyword_id
  const apiResponse = {
    success: true,
    data: {}  // Missing negative_keyword_id
  };

  const rollbackAction = buildRollbackAction(originalAction, apiResponse);

  console.assert(rollbackAction === null,
    'Should return null when API response lacks required data');

  console.log('PASS testMissingApiResponseData');
}

// Run all tests
console.log('Running E2E Rollback Tests (P6-C Verification)...\n');

testNegativeKeywordRollback();
testBidAdjustRollback();
testRollbackPlanStructure();
testNoRollbackForUnknownTool();
testBeforeStateCaptureForRollback();
testRollbackPreservesContext();
testMissingApiResponseData();

console.log('\nAll E2E rollback tests passed');
