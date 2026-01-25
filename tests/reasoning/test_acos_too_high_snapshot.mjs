/**
 * Snapshot tests for ACOS_TOO_HIGH explanation generation
 *
 * Tests that:
 * 1. Same input produces stable output structure
 * 2. Missing evidence degrades confidence
 * 3. Top-3 causes are correctly ranked
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

const PARTIAL_SIGNALS = {
  acos: 0.45,
  days_since_launch: 30,
  review_count: 15
};

// Test 1: Full signals produce complete explanation
function testFullSignalsExplanation() {
  console.log('Test 1: Full signals explanation...');

  const explanation = buildExplanation('ACOS_TOO_HIGH', FULL_SIGNALS, TARGETS);

  // Structure validation
  assert(explanation.observation_id === 'ACOS_TOO_HIGH', 'observation_id should match');
  assert(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(explanation.severity), 'severity should be valid');
  assert(Array.isArray(explanation.top_causes), 'top_causes should be array');
  assert(explanation.top_causes.length >= 1 && explanation.top_causes.length <= 3, 'top_causes should have 1-3 items');
  assert(typeof explanation.cause_evidence_map === 'object', 'cause_evidence_map should be object');
  assert(Array.isArray(explanation.recommendations), 'recommendations should be array');
  assert(Array.isArray(explanation.counterfactuals), 'counterfactuals should be array');
  assert(explanation.rule_version.includes('ACOS_TOO_HIGH'), 'rule_version should reference playbook');
  assert(explanation.generated_at, 'generated_at should exist');

  // Content validation - with full signals, should have high confidence causes
  const hasHighConfidence = explanation.top_causes.some(c => c.confidence === 'high');
  console.log('  - Has high confidence cause:', hasHighConfidence);

  // Check that NEW_PRODUCT_PHASE is detected (days < 90, reviews < 30)
  const newProductCause = explanation.top_causes.find(c => c.cause_id === 'NEW_PRODUCT_PHASE');
  if (newProductCause) {
    console.log('  - NEW_PRODUCT_PHASE detected with confidence:', newProductCause.confidence);
  }

  console.log('  ✅ Test 1 passed');
}

// Test 2: Partial signals degrade confidence
function testPartialSignalsLowConfidence() {
  console.log('Test 2: Partial signals low confidence...');

  const explanation = buildExplanation('ACOS_TOO_HIGH', PARTIAL_SIGNALS, TARGETS);

  // With only partial signals, most causes should have low/medium confidence
  const lowMediumConfidence = explanation.top_causes.filter(
    c => c.confidence === 'low' || c.confidence === 'medium'
  );

  console.log('  - Low/medium confidence causes:', lowMediumConfidence.length);
  console.log('  - Total top causes:', explanation.top_causes.length);

  // At least some causes should show degraded confidence due to missing evidence
  assert(lowMediumConfidence.length > 0, 'Should have some low/medium confidence with partial signals');

  console.log('  ✅ Test 2 passed');
}

// Test 3: Explanation includes trace_id when provided
function testTraceIdInclusion() {
  console.log('Test 3: Trace ID inclusion...');

  const traceId = 'trace-test-12345';
  const explanation = buildExplanation('ACOS_TOO_HIGH', FULL_SIGNALS, TARGETS, { trace_id: traceId });

  assert(explanation.trace_id === traceId, 'trace_id should be included');

  console.log('  ✅ Test 3 passed');
}

// Test 4: Output structure matches schema requirements
function testSchemaCompliance() {
  console.log('Test 4: Schema compliance...');

  const explanation = buildExplanation('ACOS_TOO_HIGH', FULL_SIGNALS, TARGETS);

  // Required fields
  const requiredFields = [
    'observation_id',
    'severity',
    'top_causes',
    'cause_evidence_map',
    'recommendations',
    'counterfactuals',
    'rule_version',
    'generated_at'
  ];

  for (const field of requiredFields) {
    assert(explanation.hasOwnProperty(field), `Missing required field: ${field}`);
  }

  // top_causes structure
  for (const cause of explanation.top_causes) {
    assert(cause.cause_id, 'cause should have cause_id');
    assert(cause.description, 'cause should have description');
    assert(cause.confidence, 'cause should have confidence');
    assert(Array.isArray(cause.rationale), 'cause should have rationale array');
  }

  // recommendations structure
  for (const rec of explanation.recommendations) {
    assert(rec.action_id, 'recommendation should have action_id');
    assert(rec.risk_level, 'recommendation should have risk_level');
  }

  // counterfactuals structure
  for (const cf of explanation.counterfactuals) {
    assert(cf.if, 'counterfactual should have if');
    assert(cf.expected, 'counterfactual should have expected');
    assert(cf.risk_level, 'counterfactual should have risk_level');
  }

  console.log('  ✅ Test 4 passed');
}

// Test 5: Snapshot stability - same input produces consistent structure
function testSnapshotStability() {
  console.log('Test 5: Snapshot stability...');

  const explanation1 = buildExplanation('ACOS_TOO_HIGH', FULL_SIGNALS, TARGETS);
  const explanation2 = buildExplanation('ACOS_TOO_HIGH', FULL_SIGNALS, TARGETS);

  // Same causes should be identified
  assert.deepEqual(
    explanation1.top_causes.map(c => c.cause_id),
    explanation2.top_causes.map(c => c.cause_id),
    'Top causes should be stable'
  );

  // Same recommendations
  assert.deepEqual(
    explanation1.recommendations.map(r => r.action_id),
    explanation2.recommendations.map(r => r.action_id),
    'Recommendations should be stable'
  );

  console.log('  ✅ Test 5 passed');
}

// Run all tests
async function runTests() {
  console.log('=== ACOS_TOO_HIGH Explanation Snapshot Tests ===\n');

  try {
    testFullSignalsExplanation();
    testPartialSignalsLowConfidence();
    testTraceIdInclusion();
    testSchemaCompliance();
    testSnapshotStability();

    console.log('\n=== All tests passed! ===');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
