/**
 * P3.1 Patches Tests
 *
 * Tests for:
 * - Patch-1: DENY_UNSUPPORTED_ACTION status + outcome emission
 * - Patch-2: Candidate filtering diagnostics
 */

import { strict as assert } from 'assert';
import {
  executeAction,
  ExecutionStatus
} from '../../src/reasoning/execution/execute_action.mjs';
import {
  selectCandidates,
  selectCandidatesWithDiagnostics
} from '../../src/reasoning/execution/actions/add_negative_keywords.mjs';
import { loadActionPlaybook } from '../../src/reasoning/execution/build_action_proposal.mjs';

// ============================================================
// PATCH-1 TESTS: DENY_UNSUPPORTED_ACTION
// ============================================================

// Test 1: Non-whitelisted action returns DENY_UNSUPPORTED_ACTION
async function testDenyUnsupportedAction() {
  console.log('Patch-1 Test 1: Non-whitelisted action returns DENY...');

  const proposal = {
    proposal_id: 'patch1-test-001',
    trace_id: 'trace-patch1-001',
    observation_id: 'SOME_OBSERVATION',
    action_id: 'UNSUPPORTED_ACTION_XYZ',  // Not in whitelist
    execution_mode: 'auto_if_safe',
    rule_version: 'v0.1'
  };

  const result = await executeAction(proposal, {}, {}, {});

  // Verify status is DENY_UNSUPPORTED_ACTION
  assert(result.status === ExecutionStatus.DENY_UNSUPPORTED_ACTION,
    `Expected DENY_UNSUPPORTED_ACTION, got ${result.status}`);

  // Verify notes explain the denial
  assert(result.notes.some(n => n.includes('not in allow list')),
    'Notes should mention not in allow list');

  console.log(`  [✓] Status: ${result.status}`);
  console.log(`  [✓] Notes: ${result.notes[0]}`);
  console.log('  ✅ Patch-1 Test 1 passed');
}

// Test 2: DENY also writes OutcomeEvent
async function testDenyWritesOutcomeEvent() {
  console.log('Patch-1 Test 2: DENY writes OutcomeEvent...');

  const proposal = {
    proposal_id: 'patch1-test-002',
    trace_id: 'trace-patch1-002',
    observation_id: 'SOME_OBSERVATION',
    cause_id: 'SOME_CAUSE',
    action_id: 'ANOTHER_UNSUPPORTED_ACTION',  // Not in whitelist
    execution_mode: 'auto_if_safe',
    rule_version: 'v0.1'
  };

  const result = await executeAction(proposal, {}, {}, {});

  // Verify outcome event was created
  assert(result.outcome_event !== null, 'OutcomeEvent should be created for DENY');

  // Verify outcome event has correct fields
  const event = result.outcome_event;
  assert(event.trace_id === proposal.trace_id, 'OutcomeEvent should have trace_id');
  assert(event.action_id === proposal.action_id, 'OutcomeEvent should have action_id');
  assert(event.success === null, 'OutcomeEvent success should be null for denied');
  assert(event.notes.includes('denied') || event.notes.includes('whitelist'),
    'OutcomeEvent notes should mention denial reason');

  console.log(`  [✓] OutcomeEvent created: ${event !== null}`);
  console.log(`  [✓] trace_id: ${event.trace_id}`);
  console.log(`  [✓] success: ${event.success}`);
  console.log(`  [✓] notes: ${event.notes}`);
  console.log('  ✅ Patch-1 Test 2 passed');
}

// ============================================================
// PATCH-2 TESTS: Candidate Filtering Diagnostics
// ============================================================

// Test 3: Diagnostics show brand/ASIN filtering counts
async function testFilteringDiagnostics() {
  console.log('Patch-2 Test 1: Filtering diagnostics show counts...');

  const playbook = loadActionPlaybook('ADD_NEGATIVE_KEYWORDS');
  const policy = playbook.selection_policy;
  const limits = playbook.safety_limits;

  const searchTerms = [
    { search_term: 'good keyword one', spend: 50, orders: 0 },
    { search_term: 'mybrand product', spend: 45, orders: 0 },      // Brand term
    { search_term: 'B08XYZABC1', spend: 40, orders: 0 },           // ASIN
    { search_term: 'ab', spend: 35, orders: 0 },                   // Too short
    { search_term: 'existing term', spend: 30, orders: 0 },        // Dedupe
    { search_term: 'good keyword two', spend: 25, orders: 0 },
  ];

  const state = {
    brand_terms: ['mybrand'],
    existing_negatives: ['existing term']
  };

  const result = selectCandidatesWithDiagnostics(searchTerms, policy, limits, state);

  // Verify diagnostics structure
  assert(result.diagnostics, 'Should have diagnostics object');
  assert(result.candidates, 'Should have candidates array');

  // Verify filtering counts
  assert(result.diagnostics.candidates_before === 6, 'Should have 6 candidates before');
  assert(result.diagnostics.filtered_brand_terms.length === 1, 'Should filter 1 brand term');
  assert(result.diagnostics.filtered_asin_terms.length === 1, 'Should filter 1 ASIN term');
  assert(result.diagnostics.filtered_too_short.length === 1, 'Should filter 1 too short');
  assert(result.diagnostics.filtered_dedupe.length === 1, 'Should filter 1 dedupe');
  assert(result.diagnostics.final_candidates === 2, 'Should have 2 final candidates');

  console.log(`  [✓] candidates_before: ${result.diagnostics.candidates_before}`);
  console.log(`  [✓] filtered_brand_terms: ${result.diagnostics.filtered_brand_terms.length}`);
  console.log(`  [✓] filtered_asin_terms: ${result.diagnostics.filtered_asin_terms.length}`);
  console.log(`  [✓] filtered_too_short: ${result.diagnostics.filtered_too_short.length}`);
  console.log(`  [✓] filtered_dedupe: ${result.diagnostics.filtered_dedupe.length}`);
  console.log(`  [✓] final_candidates: ${result.diagnostics.final_candidates}`);
  console.log('  ✅ Patch-2 Test 1 passed');
}

// Test 4: Zero candidates explains why
async function testZeroCandidatesExplanation() {
  console.log('Patch-2 Test 2: Zero candidates explains why...');

  const playbook = loadActionPlaybook('ADD_NEGATIVE_KEYWORDS');
  const policy = playbook.selection_policy;
  const limits = playbook.safety_limits;

  // All terms will be filtered
  const searchTerms = [
    { search_term: 'mybrand item', spend: 50, orders: 0 },    // Brand term
    { search_term: 'B08ABCDEFG', spend: 45, orders: 0 },      // ASIN
    { search_term: 'xy', spend: 40, orders: 0 },               // Too short
  ];

  const state = {
    brand_terms: ['mybrand']
  };

  const result = selectCandidatesWithDiagnostics(searchTerms, policy, limits, state);

  // Verify zero candidates
  assert(result.candidates.length === 0, 'Should have 0 candidates');
  assert(result.diagnostics.final_candidates === 0, 'Diagnostics should show 0 final');

  // Verify filter_summary explains the situation
  assert(result.diagnostics.filter_summary.includes('All'),
    'Summary should mention all filtered');
  assert(result.diagnostics.filter_summary.includes('brand_terms') ||
         result.diagnostics.filter_summary.includes('asin') ||
         result.diagnostics.filter_summary.includes('too_short'),
    'Summary should list filter reasons');

  console.log(`  [✓] final_candidates: ${result.diagnostics.final_candidates}`);
  console.log(`  [✓] filter_summary: ${result.diagnostics.filter_summary}`);
  console.log('  ✅ Patch-2 Test 2 passed');
}

// Test 5: Original selectCandidates still returns array (backward compatible)
async function testSelectCandidatesBackwardCompatible() {
  console.log('Patch-2 Test 3: selectCandidates backward compatible...');

  const playbook = loadActionPlaybook('ADD_NEGATIVE_KEYWORDS');
  const policy = playbook.selection_policy;
  const limits = playbook.safety_limits;

  const searchTerms = [
    { search_term: 'good keyword', spend: 50, orders: 0 }
  ];

  // Without returnDiagnostics option, should return array
  const result = selectCandidates(searchTerms, policy, limits, {});

  assert(Array.isArray(result), 'Should return array for backward compatibility');
  assert(result.length === 1, 'Should have 1 candidate');
  assert(result[0] === 'good keyword', 'Should contain the keyword');

  console.log(`  [✓] Returns array: ${Array.isArray(result)}`);
  console.log(`  [✓] Length: ${result.length}`);
  console.log('  ✅ Patch-2 Test 3 passed');
}

// ============================================================
// RUN ALL TESTS
// ============================================================

async function runTests() {
  console.log('=== P3.1 Patches Tests ===\n');

  try {
    // Patch-1 tests
    console.log('--- Patch-1: DENY_UNSUPPORTED_ACTION ---\n');
    await testDenyUnsupportedAction();
    await testDenyWritesOutcomeEvent();

    // Patch-2 tests
    console.log('\n--- Patch-2: Candidate Filtering Diagnostics ---\n');
    await testFilteringDiagnostics();
    await testZeroCandidatesExplanation();
    await testSelectCandidatesBackwardCompatible();

    console.log('\n=== All Patch Tests Passed! (5/5) ===');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
