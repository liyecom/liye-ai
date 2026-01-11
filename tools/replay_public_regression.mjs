#!/usr/bin/env node

/**
 * Public Replay Regression Runner
 *
 * Purpose: Execute deterministic replay tests for public domains (skeleton, geo)
 * This runner does NOT depend on any private domain modules.
 *
 * Usage:
 *   node tools/replay_public_regression.mjs \
 *     --input data/demo/skeleton/replay_input.json \
 *     --baseline data/demo/skeleton/baseline/replay_output.json
 *
 * Contract:
 * - Same input must produce same output
 * - Compares: decision_id, domain, severity, action
 * - Ignores: timestamps, confidence scores, evidence (non-deterministic)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = { input: null, baseline: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) {
      result.input = args[++i];
    } else if (args[i] === "--baseline" && args[i + 1]) {
      result.baseline = args[++i];
    }
  }

  return result;
}

/**
 * Skeleton domain processor - pure function, no external dependencies
 */
function processSkeletonDomain(input) {
  const { payload } = input;
  const { metrics, thresholds } = payload;

  const decisions = [];
  let decisionCounter = 1;

  // Process each signal against thresholds
  for (const [signal, value] of Object.entries(metrics)) {
    let severity = "info";
    let action = "IGNORE";

    if (value >= thresholds.high) {
      severity = "high";
      action = "ESCALATE";
    } else if (value >= thresholds.medium) {
      severity = "medium";
      action = "ALERT";
    } else if (value >= thresholds.low) {
      severity = "low";
      action = "MONITOR";
    }

    // Only create decisions for signals above low threshold
    if (action !== "IGNORE") {
      decisions.push({
        decision_id: `SKL-${String(decisionCounter++).padStart(3, "0")}`,
        domain: "skeleton",
        severity,
        signal,
        value,
        threshold: thresholds[severity] || thresholds.low,
        action,
      });
    }
  }

  // Sort by decision_id for deterministic output
  decisions.sort((a, b) => a.decision_id.localeCompare(b.decision_id));

  return {
    domain: input.domain,
    task: input.task,
    seed: input.seed,
    version: input.version,
    status: decisions.length > 0 ? "PASS" : "SKIP",
    decisions,
    summary: {
      total_signals: Object.keys(metrics).length,
      decisions_made: decisions.length,
      escalations: decisions.filter((d) => d.action === "ESCALATE").length,
    },
  };
}

/**
 * Extract stable fields for comparison
 */
function extractStableDecision(decision) {
  return {
    decision_id: decision.decision_id,
    domain: decision.domain,
    severity: decision.severity,
    action: decision.action,
  };
}

/**
 * Compare actual output against baseline
 */
function compareOutputs(actual, baseline) {
  // Compare stable top-level fields
  if (actual.domain !== baseline.domain) {
    return { match: false, reason: `Domain mismatch: ${actual.domain} vs ${baseline.domain}` };
  }

  if (actual.status !== baseline.status) {
    return { match: false, reason: `Status mismatch: ${actual.status} vs ${baseline.status}` };
  }

  // Compare decisions
  if (actual.decisions.length !== baseline.decisions.length) {
    return {
      match: false,
      reason: `Decision count: ${actual.decisions.length} vs ${baseline.decisions.length}`,
    };
  }

  const actualStable = actual.decisions.map(extractStableDecision);
  const baselineStable = baseline.decisions.map(extractStableDecision);

  // Sort by decision_id
  const sortFn = (a, b) => a.decision_id.localeCompare(b.decision_id);
  actualStable.sort(sortFn);
  baselineStable.sort(sortFn);

  for (let i = 0; i < actualStable.length; i++) {
    const a = actualStable[i];
    const b = baselineStable[i];

    for (const field of ["decision_id", "domain", "severity", "action"]) {
      if (a[field] !== b[field]) {
        return {
          match: false,
          reason: `${field} mismatch at index ${i}: "${a[field]}" vs "${b[field]}"`,
        };
      }
    }
  }

  return { match: true };
}

/**
 * Main entry point
 */
function main() {
  const args = parseArgs();

  if (!args.input || !args.baseline) {
    console.error("Usage: node tools/replay_public_regression.mjs --input <file> --baseline <file>");
    console.error("");
    console.error("Example:");
    console.error("  node tools/replay_public_regression.mjs \\");
    console.error("    --input data/demo/skeleton/replay_input.json \\");
    console.error("    --baseline data/demo/skeleton/baseline/replay_output.json");
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), args.input);
  const baselinePath = path.resolve(process.cwd(), args.baseline);

  // Validate files exist
  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(baselinePath)) {
    console.error(`Baseline file not found: ${baselinePath}`);
    process.exit(1);
  }

  console.log("");
  console.log("🔁 Public Replay Regression Runner");
  console.log("===================================");
  console.log(`Input:    ${args.input}`);
  console.log(`Baseline: ${args.baseline}`);
  console.log("");

  // Load files
  const input = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf-8"));

  // Process based on domain
  let actual;
  switch (input.domain) {
    case "skeleton":
      actual = processSkeletonDomain(input);
      break;
    default:
      console.error(`Unknown domain: ${input.domain}`);
      console.error("Supported domains: skeleton");
      process.exit(1);
  }

  // Compare
  const result = compareOutputs(actual, baseline);

  if (result.match) {
    console.log("✅ PASS: Output matches baseline");
    console.log("");
    console.log(`   Decisions: ${actual.decisions.length}`);
    console.log(`   Escalations: ${actual.summary.escalations}`);
    console.log("");
    process.exit(0);
  } else {
    console.error("❌ FAIL: Regression detected");
    console.error("");
    console.error(`   Reason: ${result.reason}`);
    console.error("");
    console.error("Actual output:");
    console.error(JSON.stringify(actual, null, 2));
    console.error("");
    console.error("Expected baseline:");
    console.error(JSON.stringify(baseline, null, 2));
    console.error("");
    process.exit(1);
  }
}

main();
