/**
 * Evidence Package Generator
 * Contract: docs/contracts/EVIDENCE_PACKAGE_V1.md (FROZEN: 2026-02-01)
 *
 * Generates evidence package with deterministic hashing.
 * Write-once semantics enforced at storage layer.
 */

import * as fs from "fs";
import * as path from "path";
import { EvidencePackageV1, EvidenceGeneratorInput } from "./types";
import { stableStringify } from "./canonicalize";
import { sha256Hex } from "./hash";

/**
 * Generate Evidence Package V1
 *
 * @param input - Evidence generation input
 * @returns Complete evidence package with integrity hash
 */
export function generateEvidencePackage(
  input: EvidenceGeneratorInput
): EvidencePackageV1 {
  const decision_time = new Date().toISOString();

  // Compute inputs_hash (task + proposed_actions, canonical)
  const inputs_hash = sha256Hex(
    stableStringify({
      task: (input.request_snapshot.task || "").trim(),
      proposed_actions: input.request_snapshot.proposed_actions || [],
    })
  );

  // Compute outputs_hash (decision + verdict_summary, canonical)
  const outputs_hash = sha256Hex(
    stableStringify({
      decision: input.verdict_result.decision,
      verdict_summary: (input.verdict_result.verdict_summary || "").trim(),
    })
  );

  // Build package without integrity (for hash computation)
  const packageWithoutIntegrity = {
    version: "v1" as const,
    trace_id: input.trace_id,
    decision: input.decision,
    decision_time,
    policy_ref: input.policy_ref,
    inputs_hash,
    outputs_hash,
    executor: {
      system: "LiYe Governance Kernel" as const,
      version: input.executor_version,
    },
  };

  // Compute package_hash (covers all fields except integrity itself)
  const package_hash = sha256Hex(stableStringify(packageWithoutIntegrity));

  // Return complete package
  const evidencePackage: EvidencePackageV1 = {
    ...packageWithoutIntegrity,
    integrity: {
      algorithm: "sha256" as const,
      package_hash,
    },
  };

  return evidencePackage;
}

/**
 * Persist evidence artifact to filesystem (write-once)
 *
 * @param evidence - Evidence package to persist
 * @param baseDir - Base directory for evidence storage (default: "evidence")
 * @returns Path to the written file
 * @throws Error if file already exists (no overwrite allowed)
 */
export function persistEvidenceArtifact(
  evidence: EvidencePackageV1,
  baseDir: string = "evidence"
): string {
  // Extract date from decision_time
  const date = evidence.decision_time.slice(0, 10); // YYYY-MM-DD

  // Construct path: evidence/YYYY-MM-DD/trace-xxx.json
  const dirPath = path.join(baseDir, date);
  const filePath = path.join(dirPath, `${evidence.trace_id}.json`);

  // Check if file exists (write-once enforcement)
  if (fs.existsSync(filePath)) {
    throw new Error(
      `Evidence artifact already exists: ${filePath}. Write-once violation.`
    );
  }

  // Ensure directory exists
  fs.mkdirSync(dirPath, { recursive: true });

  // Write using stableStringify for deterministic output
  const content = stableStringify(evidence);
  fs.writeFileSync(filePath, content, "utf8");

  return filePath;
}

/**
 * Verify evidence package integrity
 *
 * @param evidence - Evidence package to verify
 * @returns true if integrity check passes
 */
export function verifyEvidenceIntegrity(evidence: EvidencePackageV1): boolean {
  // Rebuild package without integrity
  const packageWithoutIntegrity = {
    version: evidence.version,
    trace_id: evidence.trace_id,
    decision: evidence.decision,
    decision_time: evidence.decision_time,
    policy_ref: evidence.policy_ref,
    inputs_hash: evidence.inputs_hash,
    outputs_hash: evidence.outputs_hash,
    executor: evidence.executor,
  };

  // Recompute hash
  const recomputed_hash = sha256Hex(stableStringify(packageWithoutIntegrity));

  return recomputed_hash === evidence.integrity.package_hash;
}
