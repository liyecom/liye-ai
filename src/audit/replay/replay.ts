/**
 * Deterministic Replay Verifier
 * Contract: docs/contracts/EVIDENCE_PACKAGE_V1.md (FROZEN: 2026-02-01)
 *
 * Pure verification - read-only, no modifications.
 * Recomputes hashes and compares against stored values.
 */

import * as fs from "fs";
import { EvidencePackageV1 } from "../evidence/types";
import { stableStringify } from "../evidence/canonicalize";
import { sha256Hex } from "../evidence/hash";

/**
 * Replay verification result
 */
export interface ReplayResult {
  decision_match: boolean;
  package_hash_match: boolean;
}

/**
 * Required fields for EvidencePackageV1
 */
const REQUIRED_FIELDS = [
  "version",
  "trace_id",
  "decision",
  "decision_time",
  "policy_ref",
  "inputs_hash",
  "outputs_hash",
  "executor",
  "integrity",
] as const;

/**
 * Validate evidence artifact has all required fields
 *
 * @param evidence - Parsed evidence object
 * @returns true if valid, throws on missing fields
 */
function validateFields(evidence: unknown): evidence is EvidencePackageV1 {
  if (!evidence || typeof evidence !== "object") {
    throw new Error("Invalid evidence: not an object");
  }

  const obj = evidence as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate nested fields
  if (!obj.executor || typeof obj.executor !== "object") {
    throw new Error("Invalid evidence: executor must be an object");
  }
  const executor = obj.executor as Record<string, unknown>;
  if (!("system" in executor) || !("version" in executor)) {
    throw new Error("Missing required field: executor.system or executor.version");
  }

  if (!obj.integrity || typeof obj.integrity !== "object") {
    throw new Error("Invalid evidence: integrity must be an object");
  }
  const integrity = obj.integrity as Record<string, unknown>;
  if (!("algorithm" in integrity) || !("package_hash" in integrity)) {
    throw new Error("Missing required field: integrity.algorithm or integrity.package_hash");
  }

  return true;
}

/**
 * Replay evidence package verification
 *
 * Recomputes package_hash and compares against stored value.
 * Uses identical canonicalization as generation (stableStringify + sha256Hex).
 *
 * @param evidencePath - Path to evidence artifact JSON file
 * @returns ReplayResult with match status
 * @throws Error if file cannot be read or evidence is invalid
 */
export function replayEvidencePackage(evidencePath: string): ReplayResult {
  // Step 2: Load evidence artifact (read-only)
  if (!fs.existsSync(evidencePath)) {
    throw new Error(`Evidence file not found: ${evidencePath}`);
  }

  const content = fs.readFileSync(evidencePath, "utf8");
  let evidence: unknown;

  try {
    evidence = JSON.parse(content);
  } catch {
    throw new Error(`Invalid JSON in evidence file: ${evidencePath}`);
  }

  // Validate all required fields exist
  validateFields(evidence);
  const pkg = evidence as EvidencePackageV1;

  // Step 3 & 4: Recompute package_hash using identical canonicalization
  // Build package without integrity (same order as generation)
  const packageWithoutIntegrity = {
    version: pkg.version,
    trace_id: pkg.trace_id,
    decision: pkg.decision,
    decision_time: pkg.decision_time,
    policy_ref: pkg.policy_ref,
    inputs_hash: pkg.inputs_hash,
    outputs_hash: pkg.outputs_hash,
    executor: pkg.executor,
  };

  const recomputed_package_hash = sha256Hex(stableStringify(packageWithoutIntegrity));

  // Step 5: Output replay verdict
  return {
    decision_match: ["ALLOW", "BLOCK", "DEGRADE", "UNKNOWN"].includes(pkg.decision),
    package_hash_match: recomputed_package_hash === pkg.integrity.package_hash,
  };
}

/**
 * CLI entry point
 *
 * Exit codes:
 * - 0: All checks pass
 * - 1: Any check fails
 */
export function runReplayCLI(args: string[]): number {
  if (args.length < 1) {
    console.error("Usage: pnpm audit:replay <evidence-file.json>");
    return 1;
  }

  const evidencePath = args[0];

  try {
    const result = replayEvidencePackage(evidencePath);

    console.log(`DECISION MATCH ${result.decision_match ? "✅" : "❌"}`);
    console.log(`PACKAGE HASH MATCH ${result.package_hash_match ? "✅" : "❌"}`);

    return result.decision_match && result.package_hash_match ? 0 : 1;
  } catch (error) {
    console.error(`REPLAY FAILED: ${(error as Error).message}`);
    return 1;
  }
}

// CLI execution
if (process.argv[1]?.includes("replay")) {
  const exitCode = runReplayCLI(process.argv.slice(2));
  process.exit(exitCode);
}
