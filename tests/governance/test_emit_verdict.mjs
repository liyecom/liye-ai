/**
 * Tests for emit_verdict unified output gateway
 */

import { strict as assert } from 'assert';
import {
  emitVerdict,
  emitVerdictMarkdown,
  isVerdictEnriched,
  getEnrichmentMetadata
} from '../../src/governance/emit_verdict.mjs';

// Test fixtures
const BLOCK_VERDICT = {
  version: '1.0.0',
  trace_id: 'test-trace-001',
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
  trace_id: 'test-trace-002',
  created_at: '2026-01-25T10:00:00Z',
  summary: 'Task approved. All proposed actions passed gate and contract checks.',
  why: ['All checks passed without issues'],
  what_changed: ['Executed: bid_adjustment on campaign-123'],
  what_blocked: [],
  next_steps: ['Proceed with execution'],
  confidence: 1.0
};

// Test 1: BLOCK verdict is enriched
function testBlockVerdictEnrichment() {
  console.log('Test 1: BLOCK verdict enrichment...');

  const result = emitVerdict(BLOCK_VERDICT, {
    context: { proposed_amount: 5000, limit_value: 1000 }
  });

  assert(result.enriched === true, 'Should be enriched');
  assert(result.impact_analysis, 'Should have impact_analysis');
  assert(Array.isArray(result.counterfactual_suggestions), 'Should have counterfactual_suggestions');
  assert(Array.isArray(result.fix_recommendations), 'Should have fix_recommendations');

  // Original fields preserved
  assert(result.trace_id === BLOCK_VERDICT.trace_id, 'trace_id preserved');
  assert(result.summary === BLOCK_VERDICT.summary, 'summary preserved');

  console.log('  - Enriched:', result.enriched);
  console.log('  - Impact analysis:', Object.keys(result.impact_analysis));
  console.log('  ✅ Test 1 passed');
}

// Test 2: ALLOW verdict passes through unchanged
function testAllowVerdictPassthrough() {
  console.log('Test 2: ALLOW verdict passthrough...');

  const result = emitVerdict(ALLOW_VERDICT);

  assert(!result.enriched, 'Should not be enriched');
  assert.deepEqual(result, ALLOW_VERDICT, 'Should be unchanged');

  console.log('  ✅ Test 2 passed');
}

// Test 3: Context values are used in enrichment
function testContextUsage() {
  console.log('Test 3: Context usage...');

  const result = emitVerdict(BLOCK_VERDICT, {
    context: { proposed_amount: 5000, limit_value: 1000 }
  });

  // Check for concrete values
  const reduceCf = result.counterfactual_suggestions?.find(
    cf => cf.if === 'reduce_to_daily_limit'
  );
  if (reduceCf) {
    assert(reduceCf.suggested_value === 1000, 'Should have suggested_value');
    console.log('  - reduce_to_daily_limit suggested_value:', reduceCf.suggested_value);
  }

  const splitCf = result.counterfactual_suggestions?.find(
    cf => cf.if === 'split_into_n_days'
  );
  if (splitCf) {
    assert(splitCf.suggested_days === 5, 'Should have suggested_days');
    console.log('  - split_into_n_days suggested_days:', splitCf.suggested_days);
  }

  console.log('  ✅ Test 3 passed');
}

// Test 4: Helper functions work correctly
function testHelperFunctions() {
  console.log('Test 4: Helper functions...');

  const enriched = emitVerdict(BLOCK_VERDICT);
  const notEnriched = emitVerdict(ALLOW_VERDICT);

  assert(isVerdictEnriched(enriched) === true, 'BLOCK should be enriched');
  assert(isVerdictEnriched(notEnriched) === false, 'ALLOW should not be enriched');

  const metadata = getEnrichmentMetadata(enriched);
  assert(metadata.enriched === true, 'metadata.enriched should be true');
  assert(metadata.has_impact_analysis === true, 'Should have impact_analysis');
  assert(metadata.counterfactual_count >= 2, 'Should have counterfactuals');
  assert(metadata.recommendation_count >= 1, 'Should have recommendations');

  console.log('  - Metadata:', metadata);
  console.log('  ✅ Test 4 passed');
}

// Test 5: Markdown output works for both types
function testMarkdownOutput() {
  console.log('Test 5: Markdown output...');

  const enrichedMd = emitVerdictMarkdown(BLOCK_VERDICT, {
    context: { proposed_amount: 5000, limit_value: 1000 }
  });
  const plainMd = emitVerdictMarkdown(ALLOW_VERDICT);

  assert(enrichedMd.includes('# Enriched Verdict'), 'BLOCK should show enriched');
  assert(enrichedMd.includes('## Impact Analysis'), 'Should have Impact Analysis');
  assert(enrichedMd.includes('## How to Fix'), 'Should have How to Fix');

  assert(plainMd.includes('# Verdict'), 'ALLOW should show plain verdict');
  assert(!plainMd.includes('Enriched'), 'ALLOW should not show enriched');

  console.log('  - Enriched markdown length:', enrichedMd.length);
  console.log('  - Plain markdown length:', plainMd.length);
  console.log('  ✅ Test 5 passed');
}

// Test 6: Unknown violation type still works
function testUnknownViolation() {
  console.log('Test 6: Unknown violation type...');

  const unknownVerdict = {
    ...BLOCK_VERDICT,
    summary: 'Task blocked: unknown_weird_policy violation.',
    why: ['[CONTRACT] unknown_weird_policy: some violation'],
    what_blocked: ['Action blocked due to unknown_weird_policy'] // Clear budget reference
  };

  const result = emitVerdict(unknownVerdict);

  // Should still be marked as enriched with minimal enrichment
  assert(result.enriched === true, 'Should still be enriched');
  assert(result.impact_analysis?.note?.includes('No matching playbook'), 'Should have note');

  console.log('  - Note:', result.impact_analysis?.note);
  console.log('  ✅ Test 6 passed');
}

// Run all tests
async function runTests() {
  console.log('=== emit_verdict Tests ===\n');

  try {
    testBlockVerdictEnrichment();
    testAllowVerdictPassthrough();
    testContextUsage();
    testHelperFunctions();
    testMarkdownOutput();
    testUnknownViolation();

    console.log('\n=== All tests passed! ===');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
