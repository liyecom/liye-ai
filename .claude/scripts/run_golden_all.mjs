#!/usr/bin/env node
/**
 * Golden Case Runner - All Cases
 *
 * Runs all golden cases in golden/10-cases/ and reports summary
 *
 * Usage: node .claude/scripts/run_golden_all.mjs
 */

import { readdirSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
process.chdir(projectRoot);

// Import the single case runner
const { runGoldenCase } = await import('./run_golden_case.mjs');

const CASES_DIR = 'golden/10-cases';

console.log('='.repeat(60));
console.log('Golden Cases v1 - Full Suite');
console.log('='.repeat(60));
console.log();

// Find all case directories
const caseDirs = readdirSync(CASES_DIR)
  .filter(name => /^\d{2}_/.test(name))  // Must start with 2 digits + underscore
  .map(name => join(CASES_DIR, name))
  .filter(path => existsSync(join(path, 'input.json')))  // Must have input.json
  .sort();

if (caseDirs.length === 0) {
  console.error('No golden cases found in', CASES_DIR);
  process.exit(1);
}

console.log(`Found ${caseDirs.length} cases\n`);

// Run all cases
const results = [];
let passed = 0;
let failed = 0;

for (const caseDir of caseDirs) {
  const caseName = basename(caseDir);

  try {
    const result = await runGoldenCase(caseDir);
    results.push({ name: caseName, ...result });

    if (result.passed) {
      console.log(`✓ ${caseName}: PASS (${result.gate_decision}/${result.enforce_decision})`);
      passed++;
    } else {
      console.log(`✗ ${caseName}: FAIL`);
      for (const err of result.errors) {
        console.log(`    - ${err}`);
      }
      failed++;
    }
  } catch (err) {
    console.log(`✗ ${caseName}: ERROR`);
    console.log(`    - ${err.message}`);
    results.push({ name: caseName, passed: false, errors: [err.message] });
    failed++;
  }
}

// Summary
console.log();
console.log('='.repeat(60));
console.log(`Results: ${passed}/${caseDirs.length} PASS, ${failed} FAIL`);
console.log('='.repeat(60));

// Detailed table
console.log();
console.log('Case Summary:');
console.log('-'.repeat(60));
console.log('Case                                  Gate     Enforce  Replay');
console.log('-'.repeat(60));

for (const r of results) {
  const name = r.name.padEnd(38);
  const gate = (r.gate_decision || 'N/A').padEnd(8);
  const enforce = (r.enforce_decision || 'N/A').padEnd(8);
  const replay = r.replay_status || 'N/A';
  console.log(`${name}${gate}${enforce}${replay}`);
}

console.log('-'.repeat(60));

// Exit with appropriate code
if (failed > 0) {
  console.log(`\n❌ ${failed} case(s) failed. Fix them before proceeding.`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${passed} cases passed!`);
  process.exit(0);
}
