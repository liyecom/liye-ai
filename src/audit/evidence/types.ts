/**
 * Evidence Package V1 Types
 * Contract: docs/contracts/EVIDENCE_PACKAGE_V1.md (FROZEN: 2026-02-01)
 * Commit: 3e36293
 *
 * ⚠️ DO NOT MODIFY - This interface is contract-locked
 * Any changes require EVIDENCE_PACKAGE_V2
 */

export interface EvidencePackageV1 {
  version: "v1";
  trace_id: string;
  decision: "ALLOW" | "BLOCK" | "DEGRADE" | "UNKNOWN";
  decision_time: string;
  policy_ref: string;
  inputs_hash: string;
  outputs_hash: string;
  executor: {
    system: "LiYe Governance Kernel";
    version: string;
  };
  integrity: {
    algorithm: "sha256";
    package_hash: string;
  };
}

/**
 * Input for generating evidence package
 */
export interface EvidenceGeneratorInput {
  trace_id: string;
  decision: "ALLOW" | "BLOCK" | "DEGRADE" | "UNKNOWN";
  policy_ref: string;
  request_snapshot: {
    task: string;
    proposed_actions: unknown[];
  };
  verdict_result: {
    decision: string;
    verdict_summary?: string;
  };
  executor_version: string;
}
