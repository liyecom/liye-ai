/**
 * P3-A Action Proposal Tests
 *
 * Tests for proposal building, eligibility checking, and safety limits.
 */

import { strict as assert } from 'assert';
import {
  buildProposal,
  buildProposalsFromExplanation,
  checkEligibility,
  checkSafetyLimits,
  loadActionPlaybook,
  loadExecutionFlags
} from '../../src/reasoning/execution/build_action_proposal.mjs';

// Test fixtures
const MOCK_EXPLANATION = {
  observation_id: 'SEARCH_TERM_WASTE_HIGH',
  trace_id: 'trace-test-001',
  rule_version: 'SEARCH_TERM_WASTE_HIGH.yaml@v0.1',
  top_causes: [
    {
      cause_id: 'BROAD_MATCH_OVERUSE',
      description: '广泛匹配带来大量不相关点击',
      confidence: 'high'
    }
  ],
  cause_evidence_map: {
    'BROAD_MATCH_OVERUSE': [
      { evidence_id: 'ev1', name: 'wasted_spend_ratio', value: 0.35, source: 'ENGINE', confidence: 'high' },
      { evidence_id: 'ev2', name: 'clicks', value: 50, source: 'ENGINE', confidence: 'high' }
    ]
  },
  next_best_actions: [
    {
      action_id: 'ADD_NEGATIVE_KEYWORDS',
      risk_level: 'LOW',
      execution_mode: 'auto_if_safe'
    },
    {
      action_id: 'REDUCE_BID',
      risk_level: 'LOW',
      execution_mode: 'suggest_only'
    }
  ]
};

const MOCK_SIGNALS_ELIGIBLE = {
  wasted_spend_ratio: 0.35,  // >= 0.30 ✓
  clicks: 50,                 // >= 20 ✓
  orders: 0,                  // == 0 ✓
  spend: 25                   // >= 15 ✓
};

const MOCK_SIGNALS_INELIGIBLE = {
  wasted_spend_ratio: 0.20,  // < 0.30 ✗
  clicks: 10,                 // < 20 ✗
  orders: 2,                  // != 0 ✗
  spend: 8                    // < 15 ✗
};

// Test 1: Load action playbook
function testLoadActionPlaybook() {
  console.log('Test 1: Load action playbook...');

  const playbook = loadActionPlaybook('ADD_NEGATIVE_KEYWORDS');

  assert(playbook, 'Should load ADD_NEGATIVE_KEYWORDS playbook');
  assert(playbook.action_id === 'ADD_NEGATIVE_KEYWORDS', 'action_id should match');
  assert(playbook.version === 'v0.2', 'version should be v0.2 (P4 profiles)');
  assert(playbook.execution_mode_default === 'suggest_only', 'default mode should be suggest_only');
  assert(playbook.eligibility, 'Should have eligibility section');
  assert(playbook.safety_limits, 'Should have safety_limits section');
  assert(playbook.rollback, 'Should have rollback section');

  console.log(`  - Playbook loaded: ${playbook.action_id}@${playbook.version}`);
  console.log('  ✅ Test 1 passed');
}

// Test 2: Load execution flags
function testLoadExecutionFlags() {
  console.log('Test 2: Load execution flags...');

  const flags = loadExecutionFlags();

  assert(flags, 'Should load execution flags');
  assert(flags.auto_execution, 'Should have auto_execution section');
  assert(flags.auto_execution.enabled === false, 'auto_execution should be disabled by default');
  assert(Array.isArray(flags.auto_execution.allow_actions), 'Should have allow_actions list');
  assert(flags.auto_execution.allow_actions.includes('ADD_NEGATIVE_KEYWORDS'), 'Should allow ADD_NEGATIVE_KEYWORDS');
  assert(flags.dry_run?.enabled === true, 'dry_run should be enabled by default');

  console.log(`  - Auto execution enabled: ${flags.auto_execution.enabled}`);
  console.log(`  - Dry run: ${flags.dry_run?.enabled}`);
  console.log('  ✅ Test 2 passed');
}

// Test 3: Build single proposal
function testBuildProposal() {
  console.log('Test 3: Build single proposal...');

  const recommendation = {
    action_id: 'ADD_NEGATIVE_KEYWORDS',
    risk_level: 'LOW',
    execution_mode: 'auto_if_safe'
  };

  const context = {
    trace_id: 'trace-test-003',
    observation_id: 'SEARCH_TERM_WASTE_HIGH',
    cause_id: 'BROAD_MATCH_OVERUSE',
    rule_version: 'SEARCH_TERM_WASTE_HIGH.yaml@v0.1',
    evidence_map: MOCK_EXPLANATION.cause_evidence_map
  };

  const proposal = buildProposal(recommendation, context);

  // Required fields
  assert(proposal.proposal_id, 'Should have proposal_id');
  assert(proposal.trace_id === 'trace-test-003', 'trace_id should match');
  assert(proposal.observation_id === 'SEARCH_TERM_WASTE_HIGH', 'observation_id should match');
  assert(proposal.cause_id === 'BROAD_MATCH_OVERUSE', 'cause_id should match');
  assert(proposal.action_id === 'ADD_NEGATIVE_KEYWORDS', 'action_id should match');
  assert(proposal.rule_version, 'Should have rule_version');
  assert(proposal.execution_mode, 'Should have execution_mode');
  assert(proposal.risk_level === 'LOW', 'risk_level should match');
  assert(Array.isArray(proposal.evidence_refs), 'Should have evidence_refs array');

  // Since auto_execution is disabled, mode should be suggest_only
  assert(proposal.execution_mode === 'suggest_only', 'Should degrade to suggest_only when auto disabled');

  console.log(`  - Proposal ID: ${proposal.proposal_id}`);
  console.log(`  - Execution mode: ${proposal.execution_mode}`);
  console.log(`  - Evidence refs: ${proposal.evidence_refs.length}`);
  console.log('  ✅ Test 3 passed');
}

// Test 4: Build proposals from explanation
function testBuildProposalsFromExplanation() {
  console.log('Test 4: Build proposals from explanation...');

  const proposals = buildProposalsFromExplanation(MOCK_EXPLANATION);

  assert(Array.isArray(proposals), 'Should return array');
  assert(proposals.length === 2, 'Should build 2 proposals');

  // First proposal
  const firstProposal = proposals[0];
  assert(firstProposal.action_id === 'ADD_NEGATIVE_KEYWORDS', 'First proposal should be ADD_NEGATIVE_KEYWORDS');
  assert(firstProposal.observation_id === 'SEARCH_TERM_WASTE_HIGH', 'observation_id should match');
  assert(firstProposal.cause_id === 'BROAD_MATCH_OVERUSE', 'Should use first cause');

  // Second proposal
  const secondProposal = proposals[1];
  assert(secondProposal.action_id === 'REDUCE_BID', 'Second proposal should be REDUCE_BID');
  assert(secondProposal.execution_mode === 'suggest_only', 'REDUCE_BID should be suggest_only');

  console.log(`  - Proposals built: ${proposals.length}`);
  console.log(`  - Actions: ${proposals.map(p => p.action_id).join(', ')}`);
  console.log('  ✅ Test 4 passed');
}

// Test 5: Check eligibility - eligible case
function testCheckEligibilityEligible() {
  console.log('Test 5: Check eligibility (eligible)...');

  // Create a proposal with auto_if_safe mode (simulating enabled state)
  const proposal = {
    proposal_id: 'prop-test-005',
    action_id: 'ADD_NEGATIVE_KEYWORDS',
    observation_id: 'SEARCH_TERM_WASTE_HIGH',
    execution_mode: 'auto_if_safe'
  };

  const result = checkEligibility(proposal, MOCK_SIGNALS_ELIGIBLE);

  assert(result.eligible === true, 'Should be eligible with valid signals');
  assert(Array.isArray(result.reasons), 'Should have reasons array');
  assert(result.reasons.length === 0, 'Should have no failure reasons');

  console.log(`  - Eligible: ${result.eligible}`);
  console.log('  ✅ Test 5 passed');
}

// Test 6: Check eligibility - ineligible case
function testCheckEligibilityIneligible() {
  console.log('Test 6: Check eligibility (ineligible)...');

  const proposal = {
    proposal_id: 'prop-test-006',
    action_id: 'ADD_NEGATIVE_KEYWORDS',
    observation_id: 'SEARCH_TERM_WASTE_HIGH',
    execution_mode: 'auto_if_safe'
  };

  const result = checkEligibility(proposal, MOCK_SIGNALS_INELIGIBLE);

  assert(result.eligible === false, 'Should be ineligible with invalid signals');
  assert(result.reasons.length > 0, 'Should have failure reasons');

  console.log(`  - Eligible: ${result.eligible}`);
  console.log(`  - Reasons: ${result.reasons.length}`);
  for (const reason of result.reasons) {
    console.log(`    - ${reason}`);
  }
  console.log('  ✅ Test 6 passed');
}

// Test 7: Check eligibility - wrong execution mode
function testCheckEligibilityWrongMode() {
  console.log('Test 7: Check eligibility (wrong mode)...');

  const proposal = {
    proposal_id: 'prop-test-007',
    action_id: 'ADD_NEGATIVE_KEYWORDS',
    observation_id: 'SEARCH_TERM_WASTE_HIGH',
    execution_mode: 'suggest_only'  // Not auto_if_safe
  };

  const result = checkEligibility(proposal, MOCK_SIGNALS_ELIGIBLE);

  assert(result.eligible === false, 'Should be ineligible with suggest_only mode');
  assert(result.reasons.some(r => r.includes('suggest_only')), 'Should mention mode in reason');

  console.log(`  - Eligible: ${result.eligible}`);
  console.log(`  - Reason: ${result.reasons[0]}`);
  console.log('  ✅ Test 7 passed');
}

// Test 8: Check safety limits - within limits
function testCheckSafetyLimitsWithin() {
  console.log('Test 8: Check safety limits (within)...');

  const proposal = {
    action_id: 'ADD_NEGATIVE_KEYWORDS'
  };

  const params = {
    negative_keywords: ['bad keyword 1', 'bad keyword 2', 'bad keyword 3'],
    match_type: 'PHRASE'
  };

  const state = {
    negatives_added_today: 5,
    brand_terms: ['mybrand', 'company']
  };

  const result = checkSafetyLimits(proposal, params, state);

  assert(result.safe === true, 'Should be safe within limits');
  assert(result.violations.length === 0, 'Should have no violations');

  console.log(`  - Safe: ${result.safe}`);
  console.log('  ✅ Test 8 passed');
}

// Test 9: Check safety limits - exceeds limits
function testCheckSafetyLimitsExceeds() {
  console.log('Test 9: Check safety limits (exceeds)...');

  const proposal = {
    action_id: 'ADD_NEGATIVE_KEYWORDS'
  };

  const params = {
    negative_keywords: Array(15).fill('keyword').map((k, i) => `${k}${i}`),  // 15 keywords
    match_type: 'BROAD'  // Not allowed
  };

  const state = {
    negatives_added_today: 10
  };

  const result = checkSafetyLimits(proposal, params, state);

  assert(result.safe === false, 'Should be unsafe when exceeding limits');
  assert(result.violations.length > 0, 'Should have violations');

  console.log(`  - Safe: ${result.safe}`);
  console.log(`  - Violations: ${result.violations.length}`);
  for (const v of result.violations) {
    console.log(`    - ${v}`);
  }
  console.log('  ✅ Test 9 passed');
}

// Test 10: Check safety limits - brand term detection
function testCheckSafetyLimitsBrandTerm() {
  console.log('Test 10: Check safety limits (brand term)...');

  const proposal = {
    action_id: 'ADD_NEGATIVE_KEYWORDS'
  };

  const params = {
    negative_keywords: ['normal keyword', 'mybrand keyword', 'another'],
    match_type: 'EXACT'
  };

  const state = {
    negatives_added_today: 0,
    brand_terms: ['mybrand', 'company']
  };

  const result = checkSafetyLimits(proposal, params, state);

  assert(result.safe === false, 'Should be unsafe with brand term');
  assert(result.violations.some(v => v.includes('Brand term')), 'Should mention brand term');

  console.log(`  - Safe: ${result.safe}`);
  console.log(`  - Violation: ${result.violations.find(v => v.includes('Brand'))}`);
  console.log('  ✅ Test 10 passed');
}

// Test 11: Check safety limits - ASIN detection
function testCheckSafetyLimitsAsin() {
  console.log('Test 11: Check safety limits (ASIN detection)...');

  const proposal = {
    action_id: 'ADD_NEGATIVE_KEYWORDS'
  };

  const params = {
    negative_keywords: ['normal keyword', 'B08XYZABC1', 'another keyword'],  // ASIN-like
    match_type: 'PHRASE'
  };

  const result = checkSafetyLimits(proposal, params, {});

  assert(result.safe === false, 'Should be unsafe with ASIN-like term');
  assert(result.violations.some(v => v.includes('ASIN')), 'Should mention ASIN');

  console.log(`  - Safe: ${result.safe}`);
  console.log(`  - Violation: ${result.violations.find(v => v.includes('ASIN'))}`);
  console.log('  ✅ Test 11 passed');
}

// Test 12: Check safety limits - min term length
function testCheckSafetyLimitsMinLength() {
  console.log('Test 12: Check safety limits (min length)...');

  const proposal = {
    action_id: 'ADD_NEGATIVE_KEYWORDS'
  };

  const params = {
    negative_keywords: ['ok keyword', 'ab', 'x'],  // 'ab' and 'x' too short
    match_type: 'PHRASE'
  };

  const result = checkSafetyLimits(proposal, params, {});

  assert(result.safe === false, 'Should be unsafe with short terms');
  assert(result.violations.some(v => v.includes('too short')), 'Should mention length');

  console.log(`  - Safe: ${result.safe}`);
  console.log(`  - Violations: ${result.violations.filter(v => v.includes('short')).length}`);
  console.log('  ✅ Test 12 passed');
}

// Run all tests
async function runTests() {
  console.log('=== P3-A Action Proposal Tests ===\n');

  try {
    testLoadActionPlaybook();
    testLoadExecutionFlags();
    testBuildProposal();
    testBuildProposalsFromExplanation();
    testCheckEligibilityEligible();
    testCheckEligibilityIneligible();
    testCheckEligibilityWrongMode();
    testCheckSafetyLimitsWithin();
    testCheckSafetyLimitsExceeds();
    testCheckSafetyLimitsBrandTerm();
    testCheckSafetyLimitsAsin();
    testCheckSafetyLimitsMinLength();

    console.log('\n=== All tests passed! (12/12) ===');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
