/**
 * P2.1 Presentation Fields Tests
 *
 * Validates the new dashboard-friendly fields:
 * - executive_summary: one-sentence diagnosis
 * - next_best_actions: top 1-3 recommended actions
 * - confidence_overall: high/medium/low
 */

import { strict as assert } from 'assert';
import { buildExplanation } from '../../src/reasoning/explanation/build_explanation.mjs';

// Test fixtures
const FULL_SIGNALS = {
  acos: 0.45,
  days_since_launch: 30,
  review_count: 15,
  ctr: 0.002,
  unit_session_pct: 0.03,
  wasted_spend_ratio: 0.35,
  search_term_relevance_score: 0.5,
  cpc: 1.8,
  category_avg_cpc: 1.0,
  rating: 3.8,
  price_percentile: 0.8
};

const TARGETS = {
  max_acos: 0.30,
  min_ctr: 0.003,
  min_unit_session_pct: 0.05
};

// Test 1: executive_summary is present and meaningful
function testExecutiveSummary() {
  console.log('Test 1: executive_summary field...');

  const explanation = buildExplanation('ACOS_TOO_HIGH', FULL_SIGNALS, TARGETS);

  assert(explanation.executive_summary, 'executive_summary should exist');
  assert(typeof explanation.executive_summary === 'string', 'executive_summary should be string');
  assert(explanation.executive_summary.length > 20, 'executive_summary should be meaningful');
  assert(explanation.executive_summary.includes('ACoS Too High'), 'should include observation name');
  assert(explanation.executive_summary.includes('confidence'), 'should include confidence');

  console.log(`  - Summary: "${explanation.executive_summary.slice(0, 80)}..."`);
  console.log('  ✅ Test 1 passed');
}

// Test 2: next_best_actions contains top 1-3 actions
function testNextBestActions() {
  console.log('Test 2: next_best_actions field...');

  const explanation = buildExplanation('ACOS_TOO_HIGH', FULL_SIGNALS, TARGETS);

  assert(Array.isArray(explanation.next_best_actions), 'next_best_actions should be array');
  assert(explanation.next_best_actions.length >= 1, 'should have at least 1 action');
  assert(explanation.next_best_actions.length <= 3, 'should have at most 3 actions');

  for (const action of explanation.next_best_actions) {
    assert(action.action_id, 'action should have action_id');
    assert(action.risk_level, 'action should have risk_level');
    assert(['LOW', 'MEDIUM', 'HIGH'].includes(action.risk_level), 'risk_level should be valid');
  }

  console.log(`  - Actions: ${explanation.next_best_actions.map(a => a.action_id).join(', ')}`);
  console.log('  ✅ Test 2 passed');
}

// Test 3: confidence_overall reflects cause confidence
function testConfidenceOverall() {
  console.log('Test 3: confidence_overall field...');

  // With full signals, should have high confidence
  const fullExplanation = buildExplanation('ACOS_TOO_HIGH', FULL_SIGNALS, TARGETS);
  assert(fullExplanation.confidence_overall, 'confidence_overall should exist');
  assert(['high', 'medium', 'low'].includes(fullExplanation.confidence_overall),
    'confidence_overall should be valid');
  assert(fullExplanation.confidence_overall === 'high',
    'full signals should yield high confidence');

  // With no signals, should have low confidence
  const emptyExplanation = buildExplanation('ACOS_TOO_HIGH', {}, TARGETS);
  assert(emptyExplanation.confidence_overall === 'low',
    'no signals should yield low confidence');

  console.log(`  - Full signals: ${fullExplanation.confidence_overall}`);
  console.log(`  - Empty signals: ${emptyExplanation.confidence_overall}`);
  console.log('  ✅ Test 3 passed');
}

// Test 4: Presentation fields don't break existing fields
function testBackwardsCompatibility() {
  console.log('Test 4: Backwards compatibility...');

  const explanation = buildExplanation('ACOS_TOO_HIGH', FULL_SIGNALS, TARGETS);

  // All original fields still exist
  assert(explanation.observation_id, 'observation_id should exist');
  assert(explanation.severity, 'severity should exist');
  assert(Array.isArray(explanation.top_causes), 'top_causes should exist');
  assert(typeof explanation.cause_evidence_map === 'object', 'cause_evidence_map should exist');
  assert(Array.isArray(explanation.recommendations), 'recommendations should exist');
  assert(Array.isArray(explanation.counterfactuals), 'counterfactuals should exist');
  assert(explanation.rule_version, 'rule_version should exist');
  assert(explanation.generated_at, 'generated_at should exist');

  console.log('  ✅ Test 4 passed');
}

// Test 5: Multiple observations generate valid presentation fields
function testMultipleObservations() {
  console.log('Test 5: Multiple observations...');

  const observations = [
    'ACOS_TOO_HIGH',
    'CTR_TOO_LOW',
    'CVR_TOO_LOW',
    'SPEND_TOO_HIGH_WITH_LOW_SALES'
  ];

  for (const obs of observations) {
    const explanation = buildExplanation(obs, {}, TARGETS);

    assert(explanation.executive_summary, `${obs} should have executive_summary`);
    assert(Array.isArray(explanation.next_best_actions), `${obs} should have next_best_actions`);
    assert(explanation.confidence_overall, `${obs} should have confidence_overall`);
  }

  console.log(`  - Tested: ${observations.join(', ')}`);
  console.log('  ✅ Test 5 passed');
}

// Run all tests
async function runTests() {
  console.log('=== P2.1 Presentation Fields Tests ===\n');

  try {
    testExecutiveSummary();
    testNextBestActions();
    testConfidenceOverall();
    testBackwardsCompatibility();
    testMultipleObservations();

    console.log('\n=== All tests passed! ===');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
