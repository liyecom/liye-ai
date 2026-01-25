/**
 * Snapshot tests for Verdict Enrichment
 *
 * Tests that:
 * 1. BLOCK verdicts are properly enriched with impact/counterfactuals/recommendations
 * 2. Non-BLOCK verdicts pass through unchanged
 * 3. Context values are incorporated into suggestions
 * 4. Missing playbooks produce minimal enrichment
 */

import { strict as assert } from 'assert';
import { enrichVerdict, formatEnrichedVerdictMarkdown } from '../../src/governance/verdict_enricher.mjs';

// Test fixtures
const BLOCK_VERDICT_BUDGET = {
  version: '1.0.0',
  trace_id: 'trace-test-budget-001',
  created_at: '2026-01-25T10:00:00Z',
  summary: 'Task blocked: budget_exceed violation.',
  why: ['[CONTRACT] budget_exceed: proposed spend exceeds daily limit'],
  what_changed: [],
  what_blocked: ['Proposed action: spend $5000 blocked due to budget_exceed'],
  next_steps: ['Review and address blocking issues before retry'],
  confidence: 0.9
};

const ALLOW_VERDICT = {
  version: '1.0.0',
  trace_id: 'trace-test-allow-001',
  created_at: '2026-01-25T10:00:00Z',
  summary: 'Task approved. All proposed actions passed gate and contract checks.',
  why: ['All checks passed without issues'],
  what_changed: ['Executed: bid_adjustment on campaign-123'],
  what_blocked: [],
  next_steps: ['Proceed with execution'],
  confidence: 1.0
};

const BLOCK_VERDICT_UNKNOWN = {
  version: '1.0.0',
  trace_id: 'trace-test-unknown-001',
  created_at: '2026-01-25T10:00:00Z',
  summary: 'Task blocked: unknown_policy violation.',
  why: ['[CONTRACT] unknown_policy: some violation'],
  what_changed: [],
  what_blocked: ['Action blocked due to unknown_policy'],
  next_steps: ['Review violation'],
  confidence: 0.5
};

// Test 1: BLOCK verdict with budget_exceed is enriched
function testBlockVerdictEnrichment() {
  console.log('Test 1: BLOCK verdict enrichment...');

  const enriched = enrichVerdict(BLOCK_VERDICT_BUDGET);

  // Should be marked as enriched
  assert(enriched.enriched === true, 'Should be marked as enriched');
  assert(enriched.enrichment_version, 'Should have enrichment_version');

  // Should have impact_analysis
  assert(enriched.impact_analysis, 'Should have impact_analysis');
  assert(enriched.impact_analysis.financial_risk, 'Should have financial_risk');
  assert(enriched.impact_analysis.operational_risk, 'Should have operational_risk');
  assert(enriched.impact_analysis.compliance_risk, 'Should have compliance_risk');

  console.log('  - Impact analysis:', JSON.stringify(enriched.impact_analysis));

  // Should have counterfactual_suggestions
  assert(Array.isArray(enriched.counterfactual_suggestions), 'Should have counterfactual_suggestions array');
  assert(enriched.counterfactual_suggestions.length >= 2, 'Should have at least 2 counterfactuals');

  console.log('  - Counterfactual count:', enriched.counterfactual_suggestions.length);

  // Should have fix_recommendations
  assert(Array.isArray(enriched.fix_recommendations), 'Should have fix_recommendations array');
  assert(enriched.fix_recommendations.length >= 1, 'Should have at least 1 recommendation');

  console.log('  - Recommendation count:', enriched.fix_recommendations.length);

  // Original fields preserved
  assert(enriched.trace_id === BLOCK_VERDICT_BUDGET.trace_id, 'Original trace_id preserved');
  assert(enriched.summary === BLOCK_VERDICT_BUDGET.summary, 'Original summary preserved');

  console.log('  ✅ Test 1 passed');
}

// Test 2: ALLOW verdict passes through unchanged
function testAllowVerdictPassthrough() {
  console.log('Test 2: ALLOW verdict passthrough...');

  const result = enrichVerdict(ALLOW_VERDICT);

  // Should NOT be enriched (no enriched flag or false)
  assert(!result.enriched, 'ALLOW verdict should not be enriched');

  // Should be unchanged
  assert.deepEqual(result, ALLOW_VERDICT, 'ALLOW verdict should pass through unchanged');

  console.log('  ✅ Test 2 passed');
}

// Test 3: Context values are incorporated
function testContextIncorporation() {
  console.log('Test 3: Context incorporation...');

  const context = {
    proposed_amount: 5000,
    limit_value: 1000
  };

  const enriched = enrichVerdict(BLOCK_VERDICT_BUDGET, context);

  // Check if suggested_value is added to reduce_to_daily_limit counterfactual
  const reduceCf = enriched.counterfactual_suggestions.find(
    cf => cf.if === 'reduce_to_daily_limit'
  );

  if (reduceCf) {
    console.log('  - reduce_to_daily_limit suggested_value:', reduceCf.suggested_value);
    assert(reduceCf.suggested_value === 1000, 'Should suggest limit value');
  }

  // Check if suggested_days is added to split_into_n_days counterfactual
  const splitCf = enriched.counterfactual_suggestions.find(
    cf => cf.if === 'split_into_n_days'
  );

  if (splitCf) {
    console.log('  - split_into_n_days suggested_days:', splitCf.suggested_days);
    assert(splitCf.suggested_days === 5, 'Should suggest 5 days (5000/1000)');
  }

  // Check if concrete_value is added to REDUCE_AMOUNT recommendation
  const reduceRec = enriched.fix_recommendations.find(
    rec => rec.action_id === 'REDUCE_AMOUNT'
  );

  if (reduceRec) {
    console.log('  - REDUCE_AMOUNT concrete_value:', reduceRec.concrete_value);
    assert(reduceRec.concrete_value === 1000, 'Should have concrete value');
  }

  console.log('  ✅ Test 3 passed');
}

// Test 4: Unknown violation type produces minimal enrichment
function testUnknownViolationMinimalEnrichment() {
  console.log('Test 4: Unknown violation minimal enrichment...');

  const enriched = enrichVerdict(BLOCK_VERDICT_UNKNOWN);

  // Should still be marked as enriched
  assert(enriched.enriched === true, 'Should be marked as enriched');

  // Should have impact_analysis with 'unknown' values
  assert(enriched.impact_analysis, 'Should have impact_analysis');
  assert(enriched.impact_analysis.note, 'Should have note about missing playbook');

  console.log('  - Note:', enriched.impact_analysis.note);

  // Should have empty suggestions/recommendations
  assert(Array.isArray(enriched.counterfactual_suggestions), 'Should have counterfactual_suggestions array');
  assert(Array.isArray(enriched.fix_recommendations), 'Should have fix_recommendations array');

  console.log('  ✅ Test 4 passed');
}

// Test 5: Markdown formatting works
function testMarkdownFormatting() {
  console.log('Test 5: Markdown formatting...');

  const enriched = enrichVerdict(BLOCK_VERDICT_BUDGET, {
    proposed_amount: 5000,
    limit_value: 1000
  });

  const markdown = formatEnrichedVerdictMarkdown(enriched);

  // Should contain key sections
  assert(markdown.includes('# Enriched Verdict'), 'Should have title');
  assert(markdown.includes('## Impact Analysis'), 'Should have Impact Analysis section');
  assert(markdown.includes('## How to Fix'), 'Should have How to Fix section');
  assert(markdown.includes('## Recommendations'), 'Should have Recommendations section');
  assert(markdown.includes('verdict_enricher'), 'Should have enricher attribution');

  console.log('  - Markdown length:', markdown.length, 'chars');

  console.log('  ✅ Test 5 passed');
}

// Test 6: Snapshot stability
function testSnapshotStability() {
  console.log('Test 6: Snapshot stability...');

  const enriched1 = enrichVerdict(BLOCK_VERDICT_BUDGET);
  const enriched2 = enrichVerdict(BLOCK_VERDICT_BUDGET);

  // Same structure (excluding timestamps)
  assert.deepEqual(
    enriched1.counterfactual_suggestions,
    enriched2.counterfactual_suggestions,
    'Counterfactuals should be stable'
  );

  assert.deepEqual(
    enriched1.fix_recommendations,
    enriched2.fix_recommendations,
    'Recommendations should be stable'
  );

  assert.deepEqual(
    enriched1.impact_analysis,
    enriched2.impact_analysis,
    'Impact analysis should be stable'
  );

  console.log('  ✅ Test 6 passed');
}

// Run all tests
async function runTests() {
  console.log('=== Verdict Enrichment Snapshot Tests ===\n');

  try {
    testBlockVerdictEnrichment();
    testAllowVerdictPassthrough();
    testContextIncorporation();
    testUnknownViolationMinimalEnrichment();
    testMarkdownFormatting();
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
