#!/usr/bin/env node
/**
 * test_required_coverage_snapshot_2.mjs
 *
 * P6-A PR-B2 Snapshot Test #2: SEARCH_TERM_WASTE_HIGH observation coverage
 *
 * Based on p6a_timo_us_14d_2026-01-30 run:
 * - Search Terms: 1,382
 * - Zero-conversion terms: ~35% (estimated)
 * - Wasted spend ratio: ~25%
 *
 * Assertions:
 * 1. PR-B2 fields are in evidence_requirements
 * 2. At least one cause evidence transitioned from degrade -> hit
 * 3. keyword_spend_distribution and match_type_distribution are reachable
 */

import { readFileSync, existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '../../..');

// Test input: Deidentified metrics from Timo US 14d run
const SNAPSHOT_INPUT = {
  run_id: 'p6a_timo_us_14d_2026-01-30',
  observation: 'SEARCH_TERM_WASTE_HIGH',
  metrics: {
    search_term_count: 1382,
    zero_conversion_terms_pct: 0.35,  // Estimated 35%
    wasted_spend_ratio: 0.25,          // Estimated 25%
    total_spend: 1699.89,
    wasted_spend_estimate: 424.97      // ~25% of total
  },
  // Distribution buckets (deidentified)
  match_type_distribution: {
    broad: 0.35,
    phrase: 0.25,
    exact: 0.40
  },
  // Spend concentration
  spend_concentration: {
    top_10_terms_pct: 0.55,
    long_tail_pct: 0.45
  }
};

// PR-B2 fields specific to SEARCH_TERM_WASTE_HIGH
const PR_B2_FIELDS_WASTE = [
  'match_type_distribution',
  'keyword_spend_distribution',
  'zero_conversion_spend_pct',
  'high_click_low_conversion_terms',
  'low_impression_terms',
  'auto_vs_manual_spend_ratio',
  'budget_utilization_rate',
  'campaign_spend_trend'
];

// Fields that were previously unavailable but should now be available
const PREVIOUSLY_UNAVAILABLE = [
  'match_type_distribution',
  'keyword_spend_distribution',
  'zero_conversion_spend_pct'
];

let errors = [];

/**
 * Load SEARCH_TERM_WASTE_HIGH playbook
 */
function loadPlaybook() {
  const path = join(REPO_ROOT, 'docs/contracts/reasoning/amazon-growth/observations/SEARCH_TERM_WASTE_HIGH.yaml');
  if (!existsSync(path)) {
    errors.push('SEARCH_TERM_WASTE_HIGH.yaml not found');
    return null;
  }
  const content = readFileSync(path, 'utf-8');
  return parseYaml(content);
}

/**
 * Load evidence_fetch_map
 */
function loadEvidenceMap() {
  const path = join(REPO_ROOT, 'docs/contracts/reasoning/_shared/evidence_fetch_map.yaml');
  if (!existsSync(path)) {
    errors.push('evidence_fetch_map.yaml not found');
    return null;
  }
  const content = readFileSync(path, 'utf-8');
  return parseYaml(content);
}

/**
 * Check if a field is available (not unavailable)
 */
function isFieldAvailable(field, evidenceMap) {
  // Check in evidence_sources
  if (evidenceMap.evidence_sources?.[field]) {
    return evidenceMap.evidence_sources[field].status !== 'unavailable';
  }
  // If in unavailable_fields section, it's unavailable
  if (evidenceMap.unavailable_fields?.[field]) {
    return false;
  }
  // Not found at all
  return false;
}

/**
 * Run assertions
 */
function runTests() {
  console.log('🧪 P6-A Snapshot Test #2: SEARCH_TERM_WASTE_HIGH Coverage\n');
  console.log(`Input: ${SNAPSHOT_INPUT.run_id}`);
  console.log(`Observation: ${SNAPSHOT_INPUT.observation}`);
  console.log(`Search Terms: ${SNAPSHOT_INPUT.metrics.search_term_count}`);
  console.log(`Wasted Spend Ratio: ${(SNAPSHOT_INPUT.metrics.wasted_spend_ratio * 100).toFixed(0)}%`);
  console.log('');

  const playbook = loadPlaybook();
  const evidenceMap = loadEvidenceMap();

  if (!playbook || !evidenceMap) {
    console.log('❌ Test setup failed');
    return false;
  }

  // Collect all evidence_requirements from playbook
  const allEvidenceFields = new Set();
  const causesPrB2Fields = new Map();

  for (const cause of playbook.cause_candidates || []) {
    const prB2InCause = [];
    for (const field of cause.evidence_requirements || []) {
      allEvidenceFields.add(field);
      if (PR_B2_FIELDS_WASTE.includes(field)) {
        prB2InCause.push(field);
      }
    }
    if (prB2InCause.length > 0) {
      causesPrB2Fields.set(cause.id, prB2InCause);
    }
  }

  console.log(`Evidence fields required: ${allEvidenceFields.size}`);
  console.log(`Causes with PR-B2 fields: ${causesPrB2Fields.size}`);
  console.log('');

  // === Assertion 1: PR-B2 fields are in evidence_requirements ===
  console.log('Assertion 1: PR-B2 fields present in playbook');
  let prB2FieldsFound = 0;
  for (const field of PR_B2_FIELDS_WASTE) {
    if (allEvidenceFields.has(field)) {
      console.log(`  ✓ ${field}`);
      prB2FieldsFound++;
    }
  }
  if (prB2FieldsFound === 0) {
    errors.push('No PR-B2 evidence fields found in SEARCH_TERM_WASTE_HIGH playbook');
  } else {
    console.log(`  → ${prB2FieldsFound}/${PR_B2_FIELDS_WASTE.length} PR-B2 fields present`);
  }
  console.log('');

  // === Assertion 2: Previously unavailable fields are now reachable ===
  console.log('Assertion 2: Degrade -> Hit transition');
  let transitionCount = 0;
  for (const field of PREVIOUSLY_UNAVAILABLE) {
    const isAvailable = isFieldAvailable(field, evidenceMap);
    if (isAvailable) {
      console.log(`  ✓ ${field}: degrade -> hit`);
      transitionCount++;
    } else {
      console.log(`  ✗ ${field}: still degraded`);
    }
  }
  if (transitionCount === 0) {
    errors.push('No fields transitioned from degrade to hit');
  } else {
    console.log(`  → ${transitionCount}/${PREVIOUSLY_UNAVAILABLE.length} fields now reachable`);
  }
  console.log('');

  // === Assertion 3: Core diagnostic fields are reachable ===
  console.log('Assertion 3: Core diagnostic fields reachability');
  const coreFields = ['match_type_distribution', 'keyword_spend_distribution'];
  let coreReachable = 0;

  for (const field of coreFields) {
    const isAvailable = isFieldAvailable(field, evidenceMap);
    if (isAvailable) {
      console.log(`  ✓ ${field}: reachable`);
      coreReachable++;
    } else {
      console.log(`  ✗ ${field}: NOT reachable`);
      errors.push(`Core field ${field} is not reachable`);
    }
  }
  console.log('');

  // === Summary ===
  console.log('---');
  if (errors.length === 0) {
    console.log('✅ All assertions passed');
    console.log(`   PR-B2 fields hit: ${prB2FieldsFound}`);
    console.log(`   Degrade->Hit transitions: ${transitionCount}`);
    console.log(`   Core fields reachable: ${coreReachable}/${coreFields.length}`);
    return true;
  } else {
    console.log('❌ Test failed:');
    for (const e of errors) {
      console.log(`   - ${e}`);
    }
    return false;
  }
}

// Run test
const passed = runTests();
process.exit(passed ? 0 : 1);
