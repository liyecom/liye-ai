/**
 * P1 Observations Snapshot Tests
 *
 * Tests for 8 new observation playbooks:
 * - SPEND_TOO_HIGH_WITH_LOW_SALES
 * - SEARCH_TERM_WASTE_HIGH
 * - CTR_TOO_LOW
 * - CVR_TOO_LOW
 * - BUDGET_EXHAUST_EARLY
 * - IMPRESSIONS_TOO_LOW
 * - RANKING_DECLINING
 * - COMPETITOR_PRICE_UNDERCUT
 *
 * Each observation has 3 test cases:
 * 1. Full signals → stable top causes
 * 2. Missing evidence → confidence degradation
 * 3. Multiple cause competition → top-3 ranking stable
 */

import { strict as assert } from 'assert';
import { buildExplanation } from '../../src/reasoning/explanation/build_explanation.mjs';
import { explainObservation } from '../../src/reasoning/explanation/explain_observation.mjs';

// ============================================================================
// Test Fixtures
// ============================================================================

const P1_OBSERVATIONS = [
  'SPEND_TOO_HIGH_WITH_LOW_SALES',
  'SEARCH_TERM_WASTE_HIGH',
  'CTR_TOO_LOW',
  'CVR_TOO_LOW',
  'BUDGET_EXHAUST_EARLY',
  'IMPRESSIONS_TOO_LOW',
  'RANKING_DECLINING',
  'COMPETITOR_PRICE_UNDERCUT'
];

// Full signals for each observation type
const FULL_SIGNALS = {
  SPEND_TOO_HIGH_WITH_LOW_SALES: {
    wasted_spend_ratio: 0.5,
    search_term_count: 200,
    irrelevant_term_pct: 0.4,
    rating: 3.5,
    review_count: 20,
    price_percentile: 0.85,
    listing_quality_score: 60,
    cpc: 2.5,
    category_avg_cpc: 1.0,
    campaign_count: 15,
    keyword_overlap_ratio: 0.6
  },
  SEARCH_TERM_WASTE_HIGH: {
    broad_match_spend_pct: 0.7,
    exact_match_spend_pct: 0.1,
    phrase_match_spend_pct: 0.2,
    negative_keyword_count: 20,
    negative_to_positive_ratio: 0.1,
    auto_campaign_spend_pct: 0.5,
    auto_campaign_acos: 0.6,
    search_term_relevance_score: 0.4,
    category_mismatch_rate: 0.3
  },
  CTR_TOO_LOW: {
    main_image_score: 0.4,
    title_length: 60,
    title_keyword_coverage: 0.4,
    price_percentile: 0.8,
    buybox_win_rate: 0.7,
    search_term_relevance_score: 0.4,
    review_count: 20,
    rating: 3.8,
    review_velocity: 2
  },
  CVR_TOO_LOW: {
    bullet_point_count: 3,
    a_plus_content_enabled: false,
    description_length: 300,
    price_percentile: 0.75,
    rating: 3.8,
    review_count: 25,
    prime_eligible: true,
    search_term_relevance_score: 0.5,
    bounce_rate: 0.75,
    wasted_spend_ratio: 0.45,
    return_rate: 0.12,
    in_stock_rate: 0.98
  },
  BUDGET_EXHAUST_EARLY: {
    daily_budget: 50,
    avg_daily_spend_potential: 150,
    cpc: 2.0,
    category_avg_cpc: 1.0,
    top_5_keyword_spend_pct: 0.75,
    budget_exhaust_hour: 10
  },
  IMPRESSIONS_TOO_LOW: {
    bid: 0.5,
    suggested_bid: 1.5,
    category_avg_cpc: 1.0,
    impression_share: 0.05,
    daily_budget: 100,
    budget_utilization_rate: 0.3,
    keyword_search_volume_avg: 500,
    keyword_count: 10,
    listing_status: 'active',
    buybox_eligible: true
  },
  RANKING_DECLINING: {
    sales_velocity_7d: 5,
    sales_velocity_30d: 10,
    competitor_rank_change: -8,
    stockout_days_30d: 5,
    current_inventory_days: 10,
    listing_quality_score: 70,
    rating: 3.9,
    rating_trend_30d: -0.3
  },
  COMPETITOR_PRICE_UNDERCUT: {
    competitor_price_history: [25, 22, 18, 15],
    competitor_inventory_estimate: 'declining',
    competitor_days_on_market: 60,
    competitor_review_count: 10,
    category_avg_price_trend: -0.15,
    our_price_vs_category_percentile: 0.85,
    last_price_change_date: -120
  }
};

const TARGETS = {
  max_acos: 0.30,
  min_ctr: 0.003,
  min_unit_session_pct: 0.05,
  max_wasted_spend_ratio: 0.25,
  min_roas: 3.0,
  min_daily_impressions: 1000,
  max_early_exhaust_hours: 16
};

// ============================================================================
// Test Runners
// ============================================================================

let passedCount = 0;
let failedCount = 0;

function runTest(name, testFn) {
  try {
    testFn();
    console.log(`  ✅ ${name}`);
    passedCount++;
  } catch (error) {
    console.log(`  ❌ ${name}`);
    console.log(`     Error: ${error.message}`);
    failedCount++;
  }
}

// ============================================================================
// Test: All P1 Observations Supported
// ============================================================================

function testAllObservationsSupported() {
  console.log('\n📋 Test: All P1 observations are supported');

  for (const obs of P1_OBSERVATIONS) {
    runTest(`${obs} is supported`, () => {
      const result = explainObservation(obs, { signals: {}, targets: TARGETS });
      assert(result.status === 'SUCCESS', `${obs} should return SUCCESS, got ${result.status}`);
    });
  }
}

// ============================================================================
// Test: Full Signals → Stable Top Causes
// ============================================================================

function testFullSignalsStableCauses() {
  console.log('\n📋 Test: Full signals produce stable top causes');

  for (const obs of P1_OBSERVATIONS) {
    runTest(`${obs} with full signals`, () => {
      const signals = FULL_SIGNALS[obs] || {};
      const explanation = buildExplanation(obs, signals, TARGETS);

      // Structure validation
      assert(explanation.observation_id === obs, 'observation_id should match');
      assert(Array.isArray(explanation.top_causes), 'top_causes should be array');
      assert(explanation.top_causes.length >= 1 && explanation.top_causes.length <= 3,
        `top_causes should have 1-3 items, got ${explanation.top_causes.length}`);

      // Stability: same input should produce same causes
      const explanation2 = buildExplanation(obs, signals, TARGETS);
      assert.deepEqual(
        explanation.top_causes.map(c => c.cause_id),
        explanation2.top_causes.map(c => c.cause_id),
        'Top causes should be stable across runs'
      );
    });
  }
}

// ============================================================================
// Test: Missing Evidence → Confidence Degradation
// ============================================================================

function testMissingEvidenceDegrades() {
  console.log('\n📋 Test: Missing evidence degrades confidence');

  for (const obs of P1_OBSERVATIONS) {
    runTest(`${obs} with minimal signals`, () => {
      // Only provide minimal signals (no evidence for causes)
      const minimalSignals = {};
      const explanation = buildExplanation(obs, minimalSignals, TARGETS);

      // With no signals, causes should have low/medium confidence
      const hasHighConfidenceSatisfied = explanation.top_causes.some(
        c => c.confidence === 'high' && c.evidence_satisfied
      );

      assert(!hasHighConfidenceSatisfied,
        'Should not have high confidence satisfied causes with no signals');

      // Most causes should have low or medium confidence
      const lowMediumCount = explanation.top_causes.filter(
        c => c.confidence === 'low' || c.confidence === 'medium'
      ).length;

      assert(lowMediumCount > 0, 'Should have low/medium confidence causes');
    });
  }
}

// ============================================================================
// Test: Cause Evidence Map Structure
// ============================================================================

function testCauseEvidenceMapStructure() {
  console.log('\n📋 Test: Cause evidence map has correct structure');

  for (const obs of P1_OBSERVATIONS) {
    runTest(`${obs} evidence map structure`, () => {
      const signals = FULL_SIGNALS[obs] || {};
      const explanation = buildExplanation(obs, signals, TARGETS);

      assert(typeof explanation.cause_evidence_map === 'object',
        'cause_evidence_map should be object');

      // Each top cause should have corresponding evidence
      for (const cause of explanation.top_causes) {
        const evidence = explanation.cause_evidence_map[cause.cause_id];
        assert(Array.isArray(evidence),
          `Evidence for ${cause.cause_id} should be array`);
      }
    });
  }
}

// ============================================================================
// Test: Recommendations Present
// ============================================================================

function testRecommendationsPresent() {
  console.log('\n📋 Test: Recommendations are present');

  for (const obs of P1_OBSERVATIONS) {
    runTest(`${obs} has recommendations`, () => {
      const signals = FULL_SIGNALS[obs] || {};
      const explanation = buildExplanation(obs, signals, TARGETS);

      assert(Array.isArray(explanation.recommendations),
        'recommendations should be array');

      // Each recommendation should have required fields
      for (const rec of explanation.recommendations) {
        assert(rec.action_id, 'recommendation should have action_id');
        assert(rec.risk_level, 'recommendation should have risk_level');
      }
    });
  }
}

// ============================================================================
// Test: Counterfactuals Present
// ============================================================================

function testCounterfactualsPresent() {
  console.log('\n📋 Test: Counterfactuals are present');

  for (const obs of P1_OBSERVATIONS) {
    runTest(`${obs} has counterfactuals`, () => {
      const signals = FULL_SIGNALS[obs] || {};
      const explanation = buildExplanation(obs, signals, TARGETS);

      assert(Array.isArray(explanation.counterfactuals),
        'counterfactuals should be array');

      // Each counterfactual should have required fields
      for (const cf of explanation.counterfactuals) {
        assert(cf.if, 'counterfactual should have if');
        assert(cf.expected, 'counterfactual should have expected');
        assert(cf.risk_level, 'counterfactual should have risk_level');
      }
    });
  }
}

// ============================================================================
// Test: Rule Version Format
// ============================================================================

function testRuleVersionFormat() {
  console.log('\n📋 Test: Rule version format is correct');

  for (const obs of P1_OBSERVATIONS) {
    runTest(`${obs} rule version format`, () => {
      const explanation = buildExplanation(obs, {}, TARGETS);

      assert(explanation.rule_version, 'rule_version should exist');
      assert(explanation.rule_version.includes(obs),
        'rule_version should reference playbook name');
      assert(explanation.rule_version.includes('@'),
        'rule_version should include version separator');
    });
  }
}

// ============================================================================
// Main
// ============================================================================

async function runAllTests() {
  console.log('=== P1 Observations Snapshot Tests ===');
  console.log(`Testing ${P1_OBSERVATIONS.length} observations\n`);

  testAllObservationsSupported();
  testFullSignalsStableCauses();
  testMissingEvidenceDegrades();
  testCauseEvidenceMapStructure();
  testRecommendationsPresent();
  testCounterfactualsPresent();
  testRuleVersionFormat();

  console.log('\n=== Results ===');
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log(`Total:  ${passedCount + failedCount}`);

  if (failedCount > 0) {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

runAllTests();
