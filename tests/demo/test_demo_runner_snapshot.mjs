/**
 * P5-A Demo Runner Snapshot Tests
 *
 * Validates:
 * 1. Fixed input → Fixed output (snapshot stability)
 * 2. writes_attempted == 0
 * 3. Deep dive cases include 1 A-group (dry-run) and 1 B/C-group (degrade/deny)
 *
 * @module tests/demo
 */

import { strict as assert } from 'assert';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, rmSync, mkdirSync } from 'fs';
import {
  runDemo,
  executeDemoCase,
  generateDemoSummary,
  FORCE_DRY_RUN,
  loadSamples
} from '../../src/reasoning/demo/run_demo.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');
const TEST_OUT_DIR = join(PROJECT_ROOT, 'tests/demo/.test_output');

// Test results accumulator
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Test 1: FORCE_DRY_RUN constant is true
 */
function testForceDryRunConstant() {
  console.log('Test 1: FORCE_DRY_RUN constant...');

  assert.strictEqual(FORCE_DRY_RUN, true, 'FORCE_DRY_RUN must be true');

  console.log('  ✅ Test 1 passed: FORCE_DRY_RUN=true');
  testResults.passed++;
  testResults.tests.push({ name: 'FORCE_DRY_RUN constant', passed: true });
}

/**
 * Test 2: Load samples returns expected structure
 */
function testLoadSamples() {
  console.log('Test 2: Load samples structure...');

  const samplesData = loadSamples();

  assert(samplesData.samples, 'Should have samples array');
  assert(samplesData.samples.length >= 12, 'Should have at least 12 samples');

  // Check group distribution
  const groupA = samplesData.samples.filter(s => s.group === 'A');
  const groupB = samplesData.samples.filter(s => s.group === 'B');
  const groupC = samplesData.samples.filter(s => s.group === 'C');

  assert(groupA.length >= 1, 'Should have at least 1 A-group sample');
  assert(groupB.length >= 1, 'Should have at least 1 B-group sample');
  assert(groupC.length >= 1, 'Should have at least 1 C-group sample');

  console.log(`  - Total samples: ${samplesData.samples.length}`);
  console.log(`  - Group A: ${groupA.length}, B: ${groupB.length}, C: ${groupC.length}`);
  console.log('  ✅ Test 2 passed');
  testResults.passed++;
  testResults.tests.push({ name: 'Load samples structure', passed: true });
}

/**
 * Test 3: Execute single case returns expected fields
 */
async function testExecuteSingleCase() {
  console.log('Test 3: Execute single case...');

  const samplesData = loadSamples();
  const sample = samplesData.samples.find(s => s.id === 'A2_high_waste');

  assert(sample, 'Should find A2_high_waste sample');

  const result = await executeDemoCase(sample, 'balanced');

  // Check required fields
  assert(result.case_id === 'A2_high_waste', 'case_id should match');
  assert(result.group === 'A', 'group should be A');
  assert(result.status, 'Should have status');
  assert(typeof result.candidates_before === 'number', 'Should have candidates_before');
  assert(typeof result.final_candidates === 'number', 'Should have final_candidates');
  assert(typeof result.rollback_payload_present === 'boolean', 'Should have rollback_payload_present');
  assert(typeof result.outcome_event_written === 'boolean', 'Should have outcome_event_written');
  assert(result.eligibility, 'Should have eligibility object');
  assert(result.safety, 'Should have safety object');

  console.log(`  - Status: ${result.status}`);
  console.log(`  - Candidates: ${result.candidates_before} → ${result.final_candidates}`);
  console.log('  ✅ Test 3 passed');
  testResults.passed++;
  testResults.tests.push({ name: 'Execute single case', passed: true });
}

/**
 * Test 4: Demo summary has writes_attempted == 0
 */
async function testZeroWrites() {
  console.log('Test 4: ZERO WRITES verification...');

  const samplesData = loadSamples();
  // Run just 3 samples for speed
  const samples = samplesData.samples.slice(0, 3);

  const results = [];
  for (const sample of samples) {
    const result = await executeDemoCase(sample, 'balanced');
    results.push(result);
  }

  const summary = generateDemoSummary(results, { profile: 'balanced' });

  assert.strictEqual(summary.meta.force_dry_run, true, 'force_dry_run must be true');
  assert.strictEqual(summary.meta.writes_attempted, 0, 'writes_attempted must be 0');
  assert.strictEqual(summary.meta.writes_blocked_by, 'force_dry_run', 'writes_blocked_by must be force_dry_run');

  console.log(`  - force_dry_run: ${summary.meta.force_dry_run}`);
  console.log(`  - writes_attempted: ${summary.meta.writes_attempted}`);
  console.log(`  - writes_blocked_by: ${summary.meta.writes_blocked_by}`);
  console.log('  ✅ Test 4 passed: ZERO WRITES verified');
  testResults.passed++;
  testResults.tests.push({ name: 'ZERO WRITES verification', passed: true });
}

/**
 * Test 5: Deep dive cases include A-group and B/C-group
 */
async function testDeepDiveCases() {
  console.log('Test 5: Deep dive case selection...');

  const samplesData = loadSamples();
  const results = [];

  for (const sample of samplesData.samples) {
    const result = await executeDemoCase(sample, 'balanced');
    results.push(result);
  }

  // Find deep dive candidates
  const autoDryRun = results.find(r =>
    r.status === 'DRY_RUN' || r.status === 'AUTO_EXECUTED'
  );

  const degradeDeny = results.find(r =>
    r.status === 'SUGGEST_ONLY' ||
    r.status === 'BLOCKED' ||
    r.status === 'DENY_UNSUPPORTED_ACTION'
  );

  assert(autoDryRun, 'Should have at least one auto/dry-run case');
  assert(degradeDeny, 'Should have at least one degrade/deny case');

  // Verify A-group produces dry-run and B/C produces degrade/deny
  const aGroupDryRun = results.filter(r =>
    r.group === 'A' && (r.status === 'DRY_RUN' || r.status === 'AUTO_EXECUTED')
  );
  const bcGroupDegrade = results.filter(r =>
    (r.group === 'B' || r.group === 'C') &&
    (r.status === 'SUGGEST_ONLY' || r.status === 'BLOCKED' || r.status === 'DENY_UNSUPPORTED_ACTION')
  );

  assert(aGroupDryRun.length >= 1, 'Should have at least 1 A-group dry-run');
  assert(bcGroupDegrade.length >= 1, 'Should have at least 1 B/C-group degrade/deny');

  console.log(`  - Auto/DryRun example: ${autoDryRun.case_id} (${autoDryRun.status})`);
  console.log(`  - Degrade/Deny example: ${degradeDeny.case_id} (${degradeDeny.status})`);
  console.log(`  - A-group dry-runs: ${aGroupDryRun.length}`);
  console.log(`  - B/C-group degrades: ${bcGroupDegrade.length}`);
  console.log('  ✅ Test 5 passed: Deep dive cases available');
  testResults.passed++;
  testResults.tests.push({ name: 'Deep dive case selection', passed: true });
}

/**
 * Test 6: Snapshot stability (fixed input → deterministic fields)
 */
async function testSnapshotStability() {
  console.log('Test 6: Snapshot stability...');

  const samplesData = loadSamples();
  const sample = samplesData.samples.find(s => s.id === 'A2_high_waste');

  // Run twice
  const result1 = await executeDemoCase(sample, 'balanced');
  const result2 = await executeDemoCase(sample, 'balanced');

  // Deterministic fields should match
  assert.strictEqual(result1.case_id, result2.case_id, 'case_id should be deterministic');
  assert.strictEqual(result1.group, result2.group, 'group should be deterministic');
  assert.strictEqual(result1.status, result2.status, 'status should be deterministic');
  assert.strictEqual(result1.eligibility.eligible, result2.eligibility.eligible, 'eligibility should be deterministic');
  assert.strictEqual(result1.safety.safe, result2.safety.safe, 'safety should be deterministic');
  assert.strictEqual(result1.candidates_before, result2.candidates_before, 'candidates_before should be deterministic');
  assert.strictEqual(result1.final_candidates, result2.final_candidates, 'final_candidates should be deterministic');

  console.log('  - Ran same sample twice, deterministic fields match');
  console.log('  ✅ Test 6 passed: Snapshot stability verified');
  testResults.passed++;
  testResults.tests.push({ name: 'Snapshot stability', passed: true });
}

/**
 * Test 7: Full demo run produces expected outputs
 */
async function testFullDemoRun() {
  console.log('Test 7: Full demo run...');

  // Clean test output directory
  if (existsSync(TEST_OUT_DIR)) {
    rmSync(TEST_OUT_DIR, { recursive: true });
  }
  mkdirSync(TEST_OUT_DIR, { recursive: true });

  // Run demo with limited cases for speed
  const result = await runDemo({
    profile: 'balanced',
    cases: 'A1_boundary_eligible,A2_high_waste,B1_spend_below,C4_non_whitelisted',
    out_dir: TEST_OUT_DIR
  });

  // Verify outputs exist
  const summaryPath = join(TEST_OUT_DIR, 'demo_summary.json');
  assert(existsSync(summaryPath), 'demo_summary.json should exist');

  // Verify summary structure
  assert(result.summary, 'Should return summary');
  assert(result.summary.meta, 'Summary should have meta');
  assert(result.summary.stats, 'Summary should have stats');
  assert(result.summary.results, 'Summary should have results');
  assert.strictEqual(result.summary.results.length, 4, 'Should have 4 results');

  // Verify ZERO WRITES in output
  assert.strictEqual(result.summary.meta.writes_attempted, 0, 'writes_attempted must be 0');

  console.log(`  - Output directory: ${TEST_OUT_DIR}`);
  console.log(`  - Cases run: ${result.summary.results.length}`);
  console.log('  ✅ Test 7 passed: Full demo run successful');
  testResults.passed++;
  testResults.tests.push({ name: 'Full demo run', passed: true });

  // Cleanup
  rmSync(TEST_OUT_DIR, { recursive: true });
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('=== P5-A Demo Runner Snapshot Tests ===\n');

  try {
    testForceDryRunConstant();
    testLoadSamples();
    await testExecuteSingleCase();
    await testZeroWrites();
    await testDeepDiveCases();
    await testSnapshotStability();
    await testFullDemoRun();

    console.log('\n=== Test Summary ===');
    console.log(`Passed: ${testResults.passed}`);
    console.log(`Failed: ${testResults.failed}`);

    if (testResults.failed > 0) {
      console.log('\n❌ Some tests failed');
      process.exit(1);
    }

    console.log('\n✅ All P5-A demo runner tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    testResults.failed++;
    process.exit(1);
  }
}

// Run tests
runTests();
