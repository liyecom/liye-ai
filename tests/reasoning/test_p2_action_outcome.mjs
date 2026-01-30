/**
 * P2.2 ActionOutcomeEvent Tests
 *
 * Validates the feedback loop event creation and recording:
 * - Event structure validation
 * - Delta calculation
 * - Success/failure recording
 * - File persistence
 */

import { strict as assert } from 'assert';
import { existsSync, rmSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  createActionOutcomeEvent,
  recordActionOutcome,
  recordSuccess,
  recordFailure,
  recordWithMetrics
} from '../../src/reasoning/feedback/action_outcome.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_OUTPUT_DIR = join(__dirname, '../../traces/test_outcomes');

// Clean up test directory before/after
function cleanup() {
  if (existsSync(TEST_OUTPUT_DIR)) {
    rmSync(TEST_OUTPUT_DIR, { recursive: true });
  }
}

// Test 1: Event creation with required fields
function testEventCreation() {
  console.log('Test 1: Event creation...');

  const event = createActionOutcomeEvent({
    trace_id: 'trace-001',
    observation_id: 'ACOS_TOO_HIGH',
    action_id: 'REDUCE_BID',
    success: true
  });

  assert(event.event_id, 'event_id should exist');
  assert(event.event_id.startsWith('aoe_'), 'event_id should have correct prefix');
  assert(event.trace_id === 'trace-001', 'trace_id should match');
  assert(event.observation_id === 'ACOS_TOO_HIGH', 'observation_id should match');
  assert(event.action_id === 'REDUCE_BID', 'action_id should match');
  assert(event.success === true, 'success should be true');
  assert(event.timestamp, 'timestamp should exist');
  assert(event.evaluator === 'auto', 'evaluator should default to auto');

  console.log(`  - Event ID: ${event.event_id}`);
  console.log('  ✅ Test 1 passed');
}

// Helper for floating point comparison
function approxEqual(a, b, epsilon = 0.0001) {
  return Math.abs(a - b) < epsilon;
}

// Test 2: Delta calculation from before/after metrics
function testDeltaCalculation() {
  console.log('Test 2: Delta calculation...');

  const event = createActionOutcomeEvent({
    trace_id: 'trace-002',
    observation_id: 'ACOS_TOO_HIGH',
    action_id: 'REDUCE_BID',
    before_metrics: {
      window: '7d',
      values: { acos: 0.45, cpc: 1.8, impressions: 1000 }
    },
    after_metrics: {
      window: '7d',
      values: { acos: 0.35, cpc: 1.4, impressions: 800 }
    },
    success: true
  });

  assert(event.delta, 'delta should exist');
  assert(approxEqual(event.delta.acos, -0.1), 'acos delta should be ~-0.1');
  assert(approxEqual(event.delta.cpc, -0.4), 'cpc delta should be ~-0.4');
  assert(event.delta.impressions === -200, 'impressions delta should be -200');

  console.log(`  - Delta: ${JSON.stringify(event.delta)}`);
  console.log('  ✅ Test 2 passed');
}

// Test 3: Event recording to file
function testEventRecording() {
  console.log('Test 3: Event recording...');

  cleanup();

  const event = createActionOutcomeEvent({
    trace_id: 'trace-003',
    observation_id: 'CTR_TOO_LOW',
    action_id: 'UPGRADE_MAIN_IMAGE',
    success: true,
    notes: 'Image improved CTR by 15%'
  });

  const result = recordActionOutcome(event, { outputDir: TEST_OUTPUT_DIR });

  assert(result.success === true, 'recording should succeed');
  assert(existsSync(result.path), 'output file should exist');

  // Read and verify content
  const content = readFileSync(result.path, 'utf-8');
  const recorded = JSON.parse(content.trim());
  assert(recorded.trace_id === 'trace-003', 'recorded trace_id should match');

  console.log(`  - Recorded to: ${result.path}`);
  console.log('  ✅ Test 3 passed');

  cleanup();
}

// Test 4: Quick success helper
function testRecordSuccess() {
  console.log('Test 4: recordSuccess helper...');

  cleanup();

  const event = recordSuccess(
    'trace-004',
    'SEARCH_TERM_WASTE_HIGH',
    'ADD_NEGATIVE_KEYWORDS',
    { wasted_spend_ratio: -0.15 },
    'Added 50 negative keywords'
  );

  assert(event.success === true, 'success should be true');
  assert(event.delta.wasted_spend_ratio === -0.15, 'delta should be set');
  assert(event.notes.includes('50 negative keywords'), 'notes should be included');

  console.log(`  - Event: ${event.event_id}`);
  console.log('  ✅ Test 4 passed');

  cleanup();
}

// Test 5: Quick failure helper
function testRecordFailure() {
  console.log('Test 5: recordFailure helper...');

  cleanup();

  const event = recordFailure(
    'trace-005',
    'CVR_TOO_LOW',
    'CREATE_A_PLUS_CONTENT',
    'No significant CVR improvement after 14 days'
  );

  assert(event.success === false, 'success should be false');
  assert(event.actual_outcome.includes('No significant'), 'actual_outcome should be set');

  console.log(`  - Failure reason: ${event.actual_outcome}`);
  console.log('  ✅ Test 5 passed');

  cleanup();
}

// Test 6: Full metrics recording with auto success evaluation
function testRecordWithMetrics() {
  console.log('Test 6: recordWithMetrics...');

  cleanup();

  // Case 1: Metric went down as expected
  const event1 = recordWithMetrics({
    trace_id: 'trace-006a',
    observation_id: 'ACOS_TOO_HIGH',
    action_id: 'REDUCE_BID',
    cause_id: 'BID_TOO_HIGH',
    before: { window: '7d', values: { acos: 0.45 } },
    after: { window: '7d', values: { acos: 0.35 } },
    primary_metric: 'acos',
    expected_direction: 'down'
  });

  assert(event1.success === true, 'should succeed when metric goes down as expected');

  // Case 2: Metric went up when expected down (failure)
  const event2 = recordWithMetrics({
    trace_id: 'trace-006b',
    observation_id: 'ACOS_TOO_HIGH',
    action_id: 'REDUCE_BID',
    cause_id: 'BID_TOO_HIGH',
    before: { window: '7d', values: { acos: 0.35 } },
    after: { window: '7d', values: { acos: 0.40 } },
    primary_metric: 'acos',
    expected_direction: 'down'
  });

  assert(event2.success === false, 'should fail when metric goes wrong direction');

  console.log(`  - Expected down, went down: ${event1.success}`);
  console.log(`  - Expected down, went up: ${event2.success}`);
  console.log('  ✅ Test 6 passed');

  cleanup();
}

// Run all tests
async function runTests() {
  console.log('=== P2.2 ActionOutcomeEvent Tests ===\n');

  try {
    cleanup();

    testEventCreation();
    testDeltaCalculation();
    testEventRecording();
    testRecordSuccess();
    testRecordFailure();
    testRecordWithMetrics();

    cleanup();

    console.log('\n=== All tests passed! ===');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    cleanup();
    process.exit(1);
  }
}

runTests();
