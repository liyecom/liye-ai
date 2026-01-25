/**
 * Tests for explain_observation unified entry point
 */

import { strict as assert } from 'assert';
import {
  explainObservation,
  explainObservationMarkdown,
  isObservationSupported,
  getSupportedObservations
} from '../../src/domain/amazon-growth/runtime/explanation/explain_observation.mjs';

// Test fixtures
const VALID_CONTEXT = {
  signals: {
    acos: 0.45,
    days_since_launch: 30,
    review_count: 15,
    ctr: 0.002,
    unit_session_pct: 0.03
  },
  targets: {
    max_acos: 0.30
  },
  trace_id: 'test-trace-001'
};

// Test 1: Supported observation returns SUCCESS
function testSupportedObservation() {
  console.log('Test 1: Supported observation...');

  const result = explainObservation('ACOS_TOO_HIGH', VALID_CONTEXT);

  assert(result.status === 'SUCCESS', 'Status should be SUCCESS');
  assert(result.explanation, 'Should have explanation');
  assert(result.explanation.observation_id === 'ACOS_TOO_HIGH', 'observation_id should match');
  assert(result.explanation.top_causes.length >= 1, 'Should have at least 1 cause');
  assert(result.explanation.trace_id === 'test-trace-001', 'trace_id should propagate');

  console.log('  - Status:', result.status);
  console.log('  - Top causes:', result.explanation.top_causes.length);
  console.log('  ✅ Test 1 passed');
}

// Test 2: Unsupported observation returns UNSUPPORTED_OBSERVATION
function testUnsupportedObservation() {
  console.log('Test 2: Unsupported observation...');

  const result = explainObservation('UNKNOWN_OBSERVATION', { trace_id: 'test-trace-002' });

  assert(result.status === 'UNSUPPORTED_OBSERVATION', 'Status should be UNSUPPORTED_OBSERVATION');
  assert(result.observation_id === 'UNKNOWN_OBSERVATION', 'observation_id should match');
  assert(result.message.includes('No playbook found'), 'Should have explanatory message');
  assert(Array.isArray(result.supported_observations), 'Should list supported observations');
  assert(result.trace_id === 'test-trace-002', 'trace_id should be preserved');

  console.log('  - Message:', result.message);
  console.log('  - Supported:', result.supported_observations);
  console.log('  ✅ Test 2 passed');
}

// Test 3: Markdown output for supported observation
function testMarkdownOutput() {
  console.log('Test 3: Markdown output...');

  const markdown = explainObservationMarkdown('ACOS_TOO_HIGH', VALID_CONTEXT);

  assert(typeof markdown === 'string', 'Should return string');
  assert(markdown.includes('# Explanation: ACOS_TOO_HIGH'), 'Should have title');
  assert(markdown.includes('## Top Root Causes'), 'Should have causes section');

  console.log('  - Markdown length:', markdown.length);
  console.log('  ✅ Test 3 passed');
}

// Test 4: Markdown output for unsupported observation
function testMarkdownUnsupported() {
  console.log('Test 4: Markdown unsupported...');

  const markdown = explainObservationMarkdown('UNKNOWN_OBSERVATION', {});

  assert(markdown.includes('# Explanation Unavailable'), 'Should indicate unavailable');
  assert(markdown.includes('UNSUPPORTED_OBSERVATION'), 'Should show status');

  console.log('  ✅ Test 4 passed');
}

// Test 5: Helper functions work correctly
function testHelperFunctions() {
  console.log('Test 5: Helper functions...');

  assert(isObservationSupported('ACOS_TOO_HIGH') === true, 'ACOS_TOO_HIGH should be supported');
  assert(isObservationSupported('UNKNOWN') === false, 'UNKNOWN should not be supported');

  const supported = getSupportedObservations();
  assert(Array.isArray(supported), 'getSupportedObservations should return array');
  assert(supported.includes('ACOS_TOO_HIGH'), 'Should include ACOS_TOO_HIGH');

  console.log('  - Supported observations:', supported);
  console.log('  ✅ Test 5 passed');
}

// Test 6: Empty context is handled gracefully
function testEmptyContext() {
  console.log('Test 6: Empty context...');

  const result = explainObservation('ACOS_TOO_HIGH', {});

  assert(result.status === 'SUCCESS', 'Should still succeed with empty context');
  assert(result.explanation, 'Should have explanation');
  // With no signals, all causes should have low confidence
  const allLowMedium = result.explanation.top_causes.every(
    c => c.confidence === 'low' || c.confidence === 'medium'
  );
  assert(allLowMedium, 'All causes should have low/medium confidence with no signals');

  console.log('  - Top causes confidence:', result.explanation.top_causes.map(c => c.confidence));
  console.log('  ✅ Test 6 passed');
}

// Run all tests
async function runTests() {
  console.log('=== explain_observation Tests ===\n');

  try {
    testSupportedObservation();
    testUnsupportedObservation();
    testMarkdownOutput();
    testMarkdownUnsupported();
    testHelperFunctions();
    testEmptyContext();

    console.log('\n=== All tests passed! ===');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
