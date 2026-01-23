#!/usr/bin/env node
/**
 * Golden Case Runner - Single Case
 *
 * Runs a single golden case and validates against expected.json
 *
 * Usage: node .claude/scripts/run_golden_case.mjs <case_dir>
 * Example: node .claude/scripts/run_golden_case.mjs golden/10-cases/01_allow_happy_path
 */

import { readFileSync, writeFileSync, existsSync, cpSync, rmSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
process.chdir(projectRoot);

// Import governance kernel
const {
  createTrace,
  gate,
  enforce,
  generateVerdict,
  formatVerdictMarkdown,
  replay
} = await import('../../src/governance/index.mjs');

/**
 * Run a single golden case
 *
 * @param {string} caseDir - Path to case directory
 * @returns {{passed: boolean, trace_id: string, errors: string[]}}
 */
export async function runGoldenCase(caseDir) {
  const caseName = basename(caseDir);
  const errors = [];

  // Check required files
  const inputPath = join(caseDir, 'input.json');
  const expectedPath = join(caseDir, 'expected.json');

  if (!existsSync(inputPath)) {
    return { passed: false, trace_id: null, errors: [`Missing input.json in ${caseName}`] };
  }
  if (!existsSync(expectedPath)) {
    return { passed: false, trace_id: null, errors: [`Missing expected.json in ${caseName}`] };
  }

  // Load input and expected
  const input = JSON.parse(readFileSync(inputPath, 'utf-8'));
  const expected = JSON.parse(readFileSync(expectedPath, 'utf-8'));

  // Load contract if exists
  const contractPath = join(caseDir, 'contract.json');
  const contract = existsSync(contractPath)
    ? JSON.parse(readFileSync(contractPath, 'utf-8'))
    : null;

  // Create trace
  const trace = createTrace(undefined, '.liye/traces');

  // Run gate
  const gateReport = gate(input, { trace });

  // Run enforce (only if contract exists)
  let enforceResult = null;
  if (contract) {
    enforceResult = enforce(contract, input.proposed_actions || [], { trace, input });
  } else {
    // No contract = ALLOW with empty blocked
    enforceResult = {
      decision_summary: 'ALLOW',
      blocked: [],
      allowed: input.proposed_actions || []
    };
  }

  // Generate verdict
  const verdict = generateVerdict(gateReport, enforceResult, { trace });

  // Write verdict files to trace dir
  trace.writeFile('verdict.json', verdict);
  trace.writeFile('verdict.md', formatVerdictMarkdown(verdict));

  // Run replay
  const replayResult = replay(trace.trace_id, { baseDir: '.liye/traces', writeResults: true });

  // Copy output to case_dir/output/latest/
  const outputDir = join(caseDir, 'output', 'latest');
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true });
  }
  mkdirSync(outputDir, { recursive: true });

  // Copy all files from trace dir to output/latest/
  const traceDir = trace.traceDir;
  cpSync(traceDir, outputDir, { recursive: true });

  // Validate against expected
  // 1. Gate decision
  if (expected.gate?.decision) {
    if (gateReport.decision !== expected.gate.decision) {
      errors.push(`Gate decision: expected ${expected.gate.decision}, got ${gateReport.decision}`);
    }
  }

  // 2. Enforce decision_summary
  if (expected.enforce?.decision_summary) {
    if (enforceResult.decision_summary !== expected.enforce.decision_summary) {
      errors.push(`Enforce decision: expected ${expected.enforce.decision_summary}, got ${enforceResult.decision_summary}`);
    }
  }

  // 3. Blocked rule IDs
  if (expected.enforce?.blocked_rule_ids !== undefined) {
    const actualBlockedIds = (enforceResult.blocked || []).map(b => b.rule_id).filter(Boolean);
    const expectedBlockedIds = expected.enforce.blocked_rule_ids;

    // Compare as sets
    const actualSet = new Set(actualBlockedIds);
    const expectedSet = new Set(expectedBlockedIds);

    const missing = expectedBlockedIds.filter(id => !actualSet.has(id));
    const extra = actualBlockedIds.filter(id => !expectedSet.has(id));

    if (missing.length > 0) {
      errors.push(`Missing blocked rules: ${missing.join(', ')}`);
    }
    if (extra.length > 0) {
      errors.push(`Unexpected blocked rules: ${extra.join(', ')}`);
    }
  }

  // 4. Replay should always PASS (evidence chain integrity)
  if (replayResult.status !== 'PASS') {
    errors.push(`Replay failed: ${replayResult.errors.map(e => e.message).join(', ')}`);
  }

  return {
    passed: errors.length === 0,
    trace_id: trace.trace_id,
    gate_decision: gateReport.decision,
    enforce_decision: enforceResult.decision_summary,
    replay_status: replayResult.status,
    errors
  };
}

// CLI entry point
if (process.argv[1].includes('run_golden_case.mjs')) {
  const caseDir = process.argv[2];

  if (!caseDir) {
    console.error('Usage: node run_golden_case.mjs <case_dir>');
    console.error('Example: node run_golden_case.mjs golden/10-cases/01_allow_happy_path');
    process.exit(1);
  }

  if (!existsSync(caseDir)) {
    console.error(`Case directory not found: ${caseDir}`);
    process.exit(1);
  }

  const caseName = basename(caseDir);
  console.log(`Running: ${caseName}`);
  console.log('-'.repeat(40));

  const result = await runGoldenCase(caseDir);

  console.log(`Trace ID: ${result.trace_id}`);
  console.log(`Gate: ${result.gate_decision}`);
  console.log(`Enforce: ${result.enforce_decision}`);
  console.log(`Replay: ${result.replay_status}`);
  console.log();

  if (result.passed) {
    console.log(`✓ ${caseName}: PASS`);
  } else {
    console.log(`✗ ${caseName}: FAIL`);
    for (const err of result.errors) {
      console.log(`  - ${err}`);
    }
  }

  process.exit(result.passed ? 0 : 1);
}
