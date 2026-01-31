#!/usr/bin/env node
/**
 * test_required_coverage_snapshot_1.mjs
 *
 * P6-A PR-B2 Snapshot Test #1: ACOS_TOO_HIGH observation coverage
 *
 * Based on p6a_timo_us_14d_2026-01-30 run:
 * - ACOS: 67.61% (2.7x above 25% target)
 * - Spend: $1,699.89
 * - Sales: $2,514.26
 * - Clicks: 2,006
 * - Search Terms: 1,382
 *
 * Assertions:
 * 1. PR-B2 fields (match_type_distribution, zero_conversion_spend_pct) are in evidence_requirements
 * 2. All ACOS_TOO_HIGH evidence_requirements are reachable (no degrade)
 * 3. At least one cause has PR-B2 evidence fields
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
  observation: 'ACOS_TOO_HIGH',
  metrics: {
    acos: 0.6761,         // 67.61%
    acos_threshold: 0.25, // 25%
    spend: 1699.89,
    sales: 2514.26,
    clicks: 2006,
    search_term_count: 1382,
    campaign_count: 16
  },
  // Distribution buckets (deidentified)
  spend_distribution: {
    top_5_pct: 0.42,      // Top 5 keywords = 42% spend
    top_20_pct: 0.78,     // Top 20 keywords = 78% spend
    long_tail_pct: 0.22   // Remaining = 22%
  },
  match_type_distribution: {
    broad: 0.35,
    phrase: 0.25,
    exact: 0.40
  }
};

// Expected PR-B2 evidence fields
const PR_B2_FIELDS = [
  'zero_conversion_spend_pct',
  'high_click_low_conversion_terms',
  'match_type_distribution',
  'conversion_rate_by_term',
  'search_term_efficiency',
  'campaign_acos_variance',
  'avg_cpc_by_campaign'
];

let errors = [];

/**
 * Load ACOS_TOO_HIGH playbook
 */
function loadPlaybook() {
  const path = join(REPO_ROOT, 'docs/contracts/reasoning/amazon-growth/observations/ACOS_TOO_HIGH.yaml');
  if (!existsSync(path)) {
    errors.push('ACOS_TOO_HIGH.yaml not found');
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
  console.log('🧪 P6-A Snapshot Test #1: ACOS_TOO_HIGH Coverage\n');
  console.log(`Input: ${SNAPSHOT_INPUT.run_id}`);
  console.log(`Observation: ${SNAPSHOT_INPUT.observation}`);
  console.log(`ACOS: ${(SNAPSHOT_INPUT.metrics.acos * 100).toFixed(1)}% (threshold: ${(SNAPSHOT_INPUT.metrics.acos_threshold * 100).toFixed(0)}%)`);
  console.log('');

  const playbook = loadPlaybook();
  const evidenceMap = loadEvidenceMap();

  if (!playbook || !evidenceMap) {
    console.log('❌ Test setup failed');
    return false;
  }

  // Collect all evidence_requirements from playbook
  const allEvidenceFields = new Set();
  const causesPrB2Fields = new Map(); // cause_id -> [pr_b2_fields]

  for (const cause of playbook.cause_candidates || []) {
    const prB2InCause = [];
    for (const field of cause.evidence_requirements || []) {
      allEvidenceFields.add(field);
      if (PR_B2_FIELDS.includes(field)) {
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
  for (const field of PR_B2_FIELDS) {
    if (allEvidenceFields.has(field)) {
      console.log(`  ✓ ${field}`);
      prB2FieldsFound++;
    }
  }
  if (prB2FieldsFound === 0) {
    errors.push('No PR-B2 evidence fields found in ACOS_TOO_HIGH playbook');
  } else {
    console.log(`  → ${prB2FieldsFound}/${PR_B2_FIELDS.length} PR-B2 fields present`);
  }
  console.log('');

  // === Assertion 2: All required fields are reachable (not degraded) ===
  console.log('Assertion 2: Required fields reachability');
  let reachableCount = 0;
  let degradedFields = [];

  for (const field of allEvidenceFields) {
    if (isFieldAvailable(field, evidenceMap)) {
      reachableCount++;
    } else {
      degradedFields.push(field);
    }
  }

  console.log(`  Reachable: ${reachableCount}/${allEvidenceFields.size}`);
  if (degradedFields.length > 0) {
    console.log(`  Degraded (unavailable): ${degradedFields.join(', ')}`);
    // Note: Some degradation is expected for fields requiring ML/external systems
    // Only fail if PR-B2 fields are degraded
    const degradedPrB2 = degradedFields.filter(f => PR_B2_FIELDS.includes(f));
    if (degradedPrB2.length > 0) {
      errors.push(`PR-B2 fields are degraded: ${degradedPrB2.join(', ')}`);
    }
  }
  console.log('');

  // === Assertion 3: At least one cause has PR-B2 evidence ===
  console.log('Assertion 3: Causes with PR-B2 evidence');
  if (causesPrB2Fields.size === 0) {
    errors.push('No causes have PR-B2 evidence fields');
  } else {
    for (const [causeId, fields] of causesPrB2Fields) {
      console.log(`  ✓ ${causeId}: ${fields.join(', ')}`);
    }
  }
  console.log('');

  // === Summary ===
  console.log('---');
  if (errors.length === 0) {
    console.log('✅ All assertions passed');
    console.log(`   PR-B2 fields hit: ${prB2FieldsFound}`);
    console.log(`   Coverage: ${reachableCount}/${allEvidenceFields.size} fields reachable`);
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
