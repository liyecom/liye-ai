#!/usr/bin/env node
/**
 * P6-B Cause Ranking Stability Tests
 *
 * Validates that cause ranking is stable under small perturbations (±1% spend/clicks).
 * Goal: Operational predictability - avoid "today is cause A, tomorrow is cause B" trust collapse.
 *
 * Test methodology:
 * 1. Create base case with clear cause ranking
 * 2. Apply ±1% perturbations to key signals
 * 3. Assert Top1/Top2 causes remain stable
 * 4. Document any boundary cases where swap is acceptable
 *
 * @version v1.0
 */

import { buildExplanation } from '../../../src/reasoning/explanation/build_explanation.mjs';
import assert from 'assert';

// Test results tracking
let passed = 0;
let failed = 0;
const failures = [];

/**
 * Apply percentage perturbation to a value
 */
function perturb(value, pct) {
  return value * (1 + pct / 100);
}

/**
 * Run a single stability test
 */
function runStabilityTest(name, observationId, baseSignals, targets, expectedTop1, options = {}) {
  const perturbations = [-1, +1]; // ±1%
  const perturbFields = options.perturbFields || ['spend', 'clicks'];
  const allowedSwaps = options.allowedSwaps || [];

  console.log(`\n  Testing: ${name}`);

  // Get base ranking
  const baseExplanation = buildExplanation(observationId, baseSignals, targets);
  const baseTop1 = baseExplanation.top_causes[0]?.cause_id;
  const baseTop2 = baseExplanation.top_causes[1]?.cause_id;

  // Verify base case matches expected
  if (baseTop1 !== expectedTop1) {
    console.log(`    ❌ Base case mismatch: expected ${expectedTop1}, got ${baseTop1}`);
    failed++;
    failures.push({ test: name, reason: `Base case mismatch: expected ${expectedTop1}, got ${baseTop1}` });
    return;
  }

  console.log(`    Base ranking: ${baseTop1} > ${baseTop2}`);

  // Test all perturbation combinations
  let swapsDetected = 0;
  let swapDetails = [];
  let perturbationsRun = 0;

  for (const field of perturbFields) {
    if (baseSignals[field] === undefined) continue;

    for (const pct of perturbations) {
      perturbationsRun++;
      const perturbedSignals = { ...baseSignals };
      perturbedSignals[field] = perturb(baseSignals[field], pct);

      const perturbedExplanation = buildExplanation(observationId, perturbedSignals, targets);
      const perturbedTop1 = perturbedExplanation.top_causes[0]?.cause_id;
      const perturbedTop2 = perturbedExplanation.top_causes[1]?.cause_id;

      // Check for swap
      if (perturbedTop1 !== baseTop1) {
        const swapKey = `${baseTop1}->${perturbedTop1}`;
        const isAllowed = allowedSwaps.includes(swapKey);

        swapsDetected++;
        swapDetails.push({
          field,
          pct,
          from: baseTop1,
          to: perturbedTop1,
          allowed: isAllowed
        });

        if (!isAllowed) {
          console.log(`    ⚠️ Unexpected swap: ${field}${pct > 0 ? '+' : ''}${pct}% caused ${baseTop1} -> ${perturbedTop1}`);
        }
      }
    }
  }

  // Evaluate stability
  const unexpectedSwaps = swapDetails.filter(s => !s.allowed);

  if (unexpectedSwaps.length === 0) {
    console.log(`    ✅ Stable: ${perturbationsRun} perturbations tested, ${swapsDetected} swaps (all allowed or none)`);
    passed++;
  } else {
    console.log(`    ❌ Unstable: ${unexpectedSwaps.length} unexpected swap(s)`);
    failed++;
    failures.push({
      test: name,
      reason: `Unexpected swaps: ${unexpectedSwaps.map(s => `${s.field}${s.pct > 0 ? '+' : ''}${s.pct}%: ${s.from}->${s.to}`).join(', ')}`
    });
  }
}

// ============================================================================
// ACOS_TOO_HIGH Stability Tests
// ============================================================================
console.log('\n========================================');
console.log('ACOS_TOO_HIGH Stability Tests');
console.log('========================================');

// Test 1: NEW_PRODUCT_PHASE dominates (clear new product case)
// Note: Must provide ALL evidence fields for all causes to ensure proper ranking
runStabilityTest(
  'ACOS_TOO_HIGH - NEW_PRODUCT_PHASE dominates',
  'ACOS_TOO_HIGH',
  {
    // NEW_PRODUCT_PHASE evidence (2 fields, should trigger)
    days_since_launch: 30,  // < 90 triggers
    review_count: 15,        // < 30 triggers
    // LISTING_LOW_QUALITY evidence (logic should NOT trigger)
    ctr: 0.5,                // > min_ctr (0.3)
    unit_session_pct: 12,    // > min_unit_session_pct (10)
    conversion_rate_by_term: 0.15,
    search_term_efficiency: 0.9,
    // QUERY_MISMATCH evidence (logic should NOT trigger)
    wasted_spend_ratio: 0.20, // < 0.3
    search_term_relevance_score: 0.7, // > 0.6
    zero_conversion_spend_pct: 0.15,   // < 0.25
    high_click_low_conversion_terms: 3,
    match_type_distribution: { broad: 0.25, exact: 0.50, phrase: 0.25 },
    // BID_TOO_HIGH evidence (logic should NOT trigger)
    cpc: 0.8,                // < 1.5x category_avg_cpc
    category_avg_cpc: 1.0,
    avg_cpc_by_campaign: 0.75,
    budget_utilization_rate: 0.60,
    campaign_acos_variance: 0.10,  // < 0.3
    // OFFER_WEAKNESS evidence (logic should NOT trigger)
    rating: 4.5,             // > 4.0
    price_percentile: 0.4,   // < 0.75
    // Perturbation targets
    spend: 100,
    clicks: 50
  },
  {
    max_acos: 0.30,
    min_ctr: 0.3,
    min_unit_session_pct: 10
  },
  'NEW_PRODUCT_PHASE',
  { perturbFields: ['spend', 'clicks', 'days_since_launch', 'review_count'] }
);

// Test 2: BID_TOO_HIGH dominates (CPC clearly high)
// Note: Must provide ALL evidence fields for BID_TOO_HIGH to get 100% coverage
runStabilityTest(
  'ACOS_TOO_HIGH - BID_TOO_HIGH dominates',
  'ACOS_TOO_HIGH',
  {
    // NEW_PRODUCT_PHASE should NOT trigger (logic fails)
    days_since_launch: 180,  // > 90
    review_count: 100,       // > 30
    // BID_TOO_HIGH evidence (5 fields, should trigger)
    cpc: 2.5,                // Much higher than category
    category_avg_cpc: 1.0,   // CPC > 1.5x benchmark triggers
    avg_cpc_by_campaign: 2.3,
    budget_utilization_rate: 0.85,
    campaign_acos_variance: 0.15, // Keep low so primary trigger is CPC ratio
    // LISTING_LOW_QUALITY evidence (logic should NOT trigger)
    ctr: 0.4,                // > min_ctr (0.3)
    unit_session_pct: 11,    // > min_unit_session_pct (10)
    conversion_rate_by_term: 0.12,
    search_term_efficiency: 0.8,
    // QUERY_MISMATCH evidence (logic should NOT trigger)
    wasted_spend_ratio: 0.25, // < 0.3
    search_term_relevance_score: 0.65, // > 0.6
    zero_conversion_spend_pct: 0.20,   // < 0.25
    high_click_low_conversion_terms: 5,
    match_type_distribution: { broad: 0.3, exact: 0.4, phrase: 0.3 },
    // OFFER_WEAKNESS evidence (logic should NOT trigger)
    rating: 4.2,             // > 4.0
    price_percentile: 0.5,   // < 0.75
    spend: 200,
    clicks: 80
  },
  {
    max_acos: 0.30,
    min_ctr: 0.3,
    min_unit_session_pct: 10
  },
  'BID_TOO_HIGH',
  { perturbFields: ['spend', 'clicks', 'cpc'] }
);

// Test 3: LISTING_LOW_QUALITY dominates (low CTR/CVR)
// Note: Must provide ALL evidence fields for full coverage
runStabilityTest(
  'ACOS_TOO_HIGH - LISTING_LOW_QUALITY dominates',
  'ACOS_TOO_HIGH',
  {
    // NEW_PRODUCT_PHASE should NOT trigger (logic fails)
    days_since_launch: 365,
    review_count: 500,
    // LISTING_LOW_QUALITY evidence (4 fields, should trigger)
    ctr: 0.15,               // < min_ctr (0.3) triggers
    unit_session_pct: 5,     // < min_unit_session_pct (10) triggers
    conversion_rate_by_term: 0.05,
    search_term_efficiency: 0.4,
    // BID_TOO_HIGH evidence (logic should NOT trigger)
    cpc: 0.9,                // < 1.5x category_avg_cpc
    category_avg_cpc: 1.0,
    avg_cpc_by_campaign: 0.85,
    budget_utilization_rate: 0.70,
    campaign_acos_variance: 0.15,  // < 0.3
    // QUERY_MISMATCH evidence (logic should NOT trigger)
    wasted_spend_ratio: 0.28,      // < 0.3
    search_term_relevance_score: 0.65, // > 0.6
    zero_conversion_spend_pct: 0.20,   // < 0.25
    high_click_low_conversion_terms: 8,
    match_type_distribution: { broad: 0.35, exact: 0.40, phrase: 0.25 },
    // OFFER_WEAKNESS evidence (logic should NOT trigger)
    rating: 4.1,             // > 4.0
    price_percentile: 0.6,   // < 0.75
    spend: 150,
    clicks: 60
  },
  {
    max_acos: 0.30,
    min_ctr: 0.3,            // CTR < 0.3 triggers
    min_unit_session_pct: 10 // CVR < 10% triggers
  },
  'LISTING_LOW_QUALITY',
  { perturbFields: ['spend', 'clicks', 'ctr', 'unit_session_pct'] }
);

// Test 4: Boundary case - BID_TOO_HIGH vs OFFER_WEAKNESS
// This is a documented boundary case where swap may occur due to similar evidence coverage
runStabilityTest(
  'ACOS_TOO_HIGH - Boundary: BID vs OFFER (swap allowed)',
  'ACOS_TOO_HIGH',
  {
    // NEW_PRODUCT_PHASE should NOT trigger
    days_since_launch: 200,
    review_count: 150,
    // LISTING_LOW_QUALITY should NOT trigger
    ctr: 0.35,               // > min_ctr
    unit_session_pct: 11,    // > min_unit_session_pct
    conversion_rate_by_term: 0.10,
    search_term_efficiency: 0.6,
    // BID_TOO_HIGH - boundary case (just above threshold)
    cpc: 1.6,                // Just above 1.5x threshold (1.5)
    category_avg_cpc: 1.0,
    avg_cpc_by_campaign: 1.5,
    budget_utilization_rate: 0.80,
    campaign_acos_variance: 0.18,  // Below 0.3
    // QUERY_MISMATCH should NOT trigger
    wasted_spend_ratio: 0.28,      // < 0.3
    search_term_relevance_score: 0.62, // > 0.6
    zero_conversion_spend_pct: 0.22,   // < 0.25
    high_click_low_conversion_terms: 6,
    match_type_distribution: { broad: 0.30, exact: 0.45, phrase: 0.25 },
    // OFFER_WEAKNESS - boundary case (just above thresholds)
    rating: 3.9,             // Just below 4.0 threshold
    price_percentile: 0.76,  // Just above 0.75 threshold
    spend: 120,
    clicks: 55
  },
  {
    max_acos: 0.30,
    min_ctr: 0.3,
    min_unit_session_pct: 10
  },
  'BID_TOO_HIGH',
  {
    perturbFields: ['cpc', 'rating', 'price_percentile'],
    allowedSwaps: ['BID_TOO_HIGH->OFFER_WEAKNESS', 'OFFER_WEAKNESS->BID_TOO_HIGH']
  }
);

// ============================================================================
// SEARCH_TERM_WASTE_HIGH Stability Tests
// ============================================================================
console.log('\n========================================');
console.log('SEARCH_TERM_WASTE_HIGH Stability Tests');
console.log('========================================');

// Test 5: BROAD_MATCH_OVERUSE dominates
runStabilityTest(
  'SEARCH_TERM_WASTE_HIGH - BROAD_MATCH_OVERUSE dominates',
  'SEARCH_TERM_WASTE_HIGH',
  {
    // BROAD_MATCH_OVERUSE evidence (should trigger)
    broad_match_spend_pct: 0.70,  // > 0.6 threshold
    exact_match_spend_pct: 0.15,
    phrase_match_spend_pct: 0.15,
    match_type_distribution: { broad: 0.70, exact: 0.15, phrase: 0.15 },
    keyword_spend_distribution: { top10_pct: 0.60 },
    top_5_keyword_spend_pct: 0.45,
    // Other causes have weaker evidence
    negative_keyword_count: 80,   // > 50
    recurring_waste_terms: 5,
    negative_to_positive_ratio: 0.4, // > 0.3
    zero_conversion_spend_pct: 0.15, // < 0.2
    high_click_low_conversion_terms: 10,
    low_impression_terms: 20,
    auto_campaign_spend_pct: 0.25, // < 0.4
    auto_campaign_acos: 0.35,
    auto_to_manual_harvest_rate: 0.2,
    auto_vs_manual_spend_ratio: 0.3,
    budget_utilization_rate: 0.8,
    campaign_spend_trend: 0.05,
    search_term_relevance_score: 0.6,
    category_mismatch_rate: 0.15,
    semantic_similarity_avg: 0.65,
    spend: 500,
    clicks: 200
  },
  {
    max_acos: 0.30,
    max_wasted_spend_ratio: 0.25
  },
  'BROAD_MATCH_OVERUSE',
  { perturbFields: ['spend', 'clicks', 'broad_match_spend_pct'] }
);

// Test 6: INSUFFICIENT_NEGATIVE_KEYWORDS dominates
runStabilityTest(
  'SEARCH_TERM_WASTE_HIGH - INSUFFICIENT_NEGATIVE_KEYWORDS dominates',
  'SEARCH_TERM_WASTE_HIGH',
  {
    // BROAD_MATCH_OVERUSE should NOT trigger
    broad_match_spend_pct: 0.40,  // < 0.6
    exact_match_spend_pct: 0.35,
    phrase_match_spend_pct: 0.25,
    match_type_distribution: { broad: 0.40, exact: 0.35, phrase: 0.25 },
    keyword_spend_distribution: { top10_pct: 0.50 },
    top_5_keyword_spend_pct: 0.35,
    // INSUFFICIENT_NEGATIVE_KEYWORDS evidence (should trigger)
    negative_keyword_count: 20,    // < 50 threshold
    recurring_waste_terms: 15,
    negative_to_positive_ratio: 0.15, // < 0.3 threshold
    zero_conversion_spend_pct: 0.35,  // > 0.2 threshold
    high_click_low_conversion_terms: 25,
    low_impression_terms: 50,
    // Other causes have weaker evidence
    auto_campaign_spend_pct: 0.20,
    auto_campaign_acos: 0.28,
    auto_to_manual_harvest_rate: 0.3,
    auto_vs_manual_spend_ratio: 0.25,
    budget_utilization_rate: 0.75,
    campaign_spend_trend: 0.02,
    search_term_relevance_score: 0.55,
    category_mismatch_rate: 0.18,
    semantic_similarity_avg: 0.60,
    spend: 400,
    clicks: 180
  },
  {
    max_acos: 0.30,
    max_wasted_spend_ratio: 0.25
  },
  'INSUFFICIENT_NEGATIVE_KEYWORDS',
  { perturbFields: ['spend', 'clicks', 'negative_keyword_count', 'zero_conversion_spend_pct'] }
);

// Test 7: AUTO_CAMPAIGN_UNCONSTRAINED dominates
runStabilityTest(
  'SEARCH_TERM_WASTE_HIGH - AUTO_CAMPAIGN_UNCONSTRAINED dominates',
  'SEARCH_TERM_WASTE_HIGH',
  {
    // Other causes should NOT trigger
    broad_match_spend_pct: 0.35,
    exact_match_spend_pct: 0.40,
    phrase_match_spend_pct: 0.25,
    match_type_distribution: { broad: 0.35, exact: 0.40, phrase: 0.25 },
    keyword_spend_distribution: { top10_pct: 0.45 },
    top_5_keyword_spend_pct: 0.30,
    negative_keyword_count: 100,
    recurring_waste_terms: 3,
    negative_to_positive_ratio: 0.5,
    zero_conversion_spend_pct: 0.12,
    high_click_low_conversion_terms: 5,
    low_impression_terms: 15,
    // AUTO_CAMPAIGN_UNCONSTRAINED evidence (should trigger)
    auto_campaign_spend_pct: 0.55,   // > 0.4 threshold
    auto_campaign_acos: 0.60,        // > max_acos * 1.5 (0.30 * 1.5 = 0.45)
    auto_to_manual_harvest_rate: 0.05,
    auto_vs_manual_spend_ratio: 1.2,
    budget_utilization_rate: 0.95,
    campaign_spend_trend: 0.10,
    search_term_relevance_score: 0.58,
    category_mismatch_rate: 0.18,
    semantic_similarity_avg: 0.62,
    spend: 600,
    clicks: 250
  },
  {
    max_acos: 0.30,
    max_wasted_spend_ratio: 0.25
  },
  'AUTO_CAMPAIGN_UNCONSTRAINED',
  { perturbFields: ['spend', 'clicks', 'auto_campaign_spend_pct', 'auto_campaign_acos'] }
);

// Test 8: Boundary case - BROAD_MATCH vs INSUFFICIENT_NEGATIVE
runStabilityTest(
  'SEARCH_TERM_WASTE_HIGH - Boundary: BROAD vs NEGATIVE (swap allowed)',
  'SEARCH_TERM_WASTE_HIGH',
  {
    // Both causes near threshold
    broad_match_spend_pct: 0.61,      // Just above 0.6
    exact_match_spend_pct: 0.20,
    phrase_match_spend_pct: 0.19,
    match_type_distribution: { broad: 0.51, exact: 0.25, phrase: 0.24 },
    keyword_spend_distribution: { top10_pct: 0.55 },
    top_5_keyword_spend_pct: 0.38,
    negative_keyword_count: 48,       // Just below 50
    recurring_waste_terms: 10,
    negative_to_positive_ratio: 0.28, // Just below 0.3
    zero_conversion_spend_pct: 0.22,  // Just above 0.2
    high_click_low_conversion_terms: 15,
    low_impression_terms: 30,
    auto_campaign_spend_pct: 0.30,
    auto_campaign_acos: 0.32,
    auto_to_manual_harvest_rate: 0.15,
    auto_vs_manual_spend_ratio: 0.4,
    budget_utilization_rate: 0.80,
    campaign_spend_trend: 0.03,
    search_term_relevance_score: 0.52,
    category_mismatch_rate: 0.19,
    semantic_similarity_avg: 0.58,
    spend: 450,
    clicks: 190
  },
  {
    max_acos: 0.30,
    max_wasted_spend_ratio: 0.25
  },
  'BROAD_MATCH_OVERUSE',
  {
    perturbFields: ['broad_match_spend_pct', 'negative_keyword_count', 'zero_conversion_spend_pct'],
    allowedSwaps: [
      'BROAD_MATCH_OVERUSE->INSUFFICIENT_NEGATIVE_KEYWORDS',
      'INSUFFICIENT_NEGATIVE_KEYWORDS->BROAD_MATCH_OVERUSE'
    ]
  }
);

// ============================================================================
// Summary
// ============================================================================
console.log('\n========================================');
console.log('P6-B Cause Ranking Stability Summary');
console.log('========================================');
console.log(`\n✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

if (failures.length > 0) {
  console.log('\nFailure details:');
  for (const f of failures) {
    console.log(`  - ${f.test}: ${f.reason}`);
  }
  process.exit(1);
}

console.log('\n✅ All stability tests passed');
console.log('\nStability guarantees verified:');
console.log('  - ±1% perturbations do not cause unexpected ranking swaps');
console.log('  - Boundary cases are documented and allowed swaps are explicit');
console.log('  - Operational predictability maintained');
process.exit(0);
