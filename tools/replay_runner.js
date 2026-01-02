#!/usr/bin/env node

/**
 * Replay Runner - Amazon Growth OS
 *
 * Purpose: Execute deterministic replay tests for decision pipeline
 *
 * Usage: node scripts/replay_runner.js replays/amazon-growth/cases
 *
 * Rules:
 * - Same input must produce same decisions
 * - Only compares: decision_id, domain, severity, version
 * - Does NOT compare: confidence, timestamp, evidence
 * - Exit 1 on any mismatch
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runSignals } from "../Agents/amazon-growth/signal_agent.js";
import { applyRules } from "../Agents/amazon-growth/rule_agent.js";
import { generateVerdicts } from "../Agents/amazon-growth/verdict_agent.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extract stable fields for comparison (no confidence, timestamp, evidence)
 */
function extractStableFields(decision) {
  return {
    decision_id: decision.decision_id,
    domain: decision.domain,
    severity: decision.severity,
    version: decision.version
  };
}

/**
 * Compare two decision arrays for equality (stable fields only)
 */
function compareDecisions(actual, expected) {
  if (actual.length !== expected.length) {
    return {
      match: false,
      reason: `Decision count mismatch: got ${actual.length}, expected ${expected.length}`
    };
  }

  const actualStable = actual.map(extractStableFields);
  const expectedStable = expected.map(extractStableFields);

  // Sort by decision_id for deterministic comparison
  const sortFn = (a, b) => a.decision_id.localeCompare(b.decision_id);
  actualStable.sort(sortFn);
  expectedStable.sort(sortFn);

  for (let i = 0; i < actualStable.length; i++) {
    const a = actualStable[i];
    const e = expectedStable[i];

    if (a.decision_id !== e.decision_id) {
      return {
        match: false,
        reason: `decision_id mismatch at index ${i}: got "${a.decision_id}", expected "${e.decision_id}"`
      };
    }
    if (a.domain !== e.domain) {
      return {
        match: false,
        reason: `domain mismatch for ${a.decision_id}: got "${a.domain}", expected "${e.domain}"`
      };
    }
    if (a.severity !== e.severity) {
      return {
        match: false,
        reason: `severity mismatch for ${a.decision_id}: got "${a.severity}", expected "${e.severity}"`
      };
    }
    if (a.version !== e.version) {
      return {
        match: false,
        reason: `version mismatch for ${a.decision_id}: got "${a.version}", expected "${e.version}"`
      };
    }
  }

  return { match: true };
}

/**
 * Run a single replay case
 */
function runCase(inputPath, expectedPath) {
  const caseName = path.basename(inputPath).replace(".input.json", "");

  // Load input and expected
  const input = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  const expected = JSON.parse(fs.readFileSync(expectedPath, "utf-8"));

  // Run pipeline: Signal → Rule → Verdict
  const signals = runSignals(input.metrics);
  const ruleResults = applyRules(signals, input.thresholds);
  const decisions = generateVerdicts(ruleResults, signals);

  // Compare
  const result = compareDecisions(decisions, expected.decisions);

  if (result.match) {
    console.log(`✅ ${caseName}: PASS`);
    return true;
  } else {
    console.error(`❌ ${caseName}: FAIL`);
    console.error(`   Reason: ${result.reason}`);
    console.error(`   Actual decisions: ${JSON.stringify(decisions.map(extractStableFields), null, 2)}`);
    return false;
  }
}

/**
 * Main entry point
 */
function main() {
  const casesDir = process.argv[2];

  if (!casesDir) {
    console.error("Usage: node scripts/replay_runner.js <cases-directory>");
    console.error("Example: node scripts/replay_runner.js replays/amazon-growth/cases");
    process.exit(1);
  }

  const absoluteCasesDir = path.resolve(process.cwd(), casesDir);

  if (!fs.existsSync(absoluteCasesDir)) {
    console.error(`Directory not found: ${absoluteCasesDir}`);
    process.exit(1);
  }

  // Find all case files
  const files = fs.readdirSync(absoluteCasesDir);
  const inputFiles = files.filter(f => f.endsWith(".input.json"));

  if (inputFiles.length === 0) {
    console.error(`No input files found in ${absoluteCasesDir}`);
    process.exit(1);
  }

  console.log(`\n🔁 Replay Runner - Amazon Growth OS`);
  console.log(`   Cases directory: ${casesDir}`);
  console.log(`   Found ${inputFiles.length} case(s)\n`);

  let passed = 0;
  let failed = 0;

  for (const inputFile of inputFiles) {
    const caseName = inputFile.replace(".input.json", "");
    const expectedFile = `${caseName}.expected.json`;

    const inputPath = path.join(absoluteCasesDir, inputFile);
    const expectedPath = path.join(absoluteCasesDir, expectedFile);

    if (!fs.existsSync(expectedPath)) {
      console.error(`❌ ${caseName}: FAIL - Missing expected file: ${expectedFile}`);
      failed++;
      continue;
    }

    try {
      if (runCase(inputPath, expectedPath)) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ ${caseName}: ERROR - ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Summary: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error("\n🚫 Replay regression detected. Fix decisions or update expected outputs.");
    process.exit(1);
  }

  console.log("\n✅ All replay cases passed.");
  process.exit(0);
}

main();
