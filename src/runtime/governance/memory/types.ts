/**
 * BGHS Memory Orchestration — Types
 * Location: src/runtime/governance/memory/types.ts
 *
 * Mirrors ADR-Hermes-Memory-Orchestration §1–§6. This tree is the
 * **governance surface** for memory orchestration — NOT the retrieval
 * engine, query orchestrator, or provider execution runtime. See
 * README.md for the hard boundary against `src/runtime/memory/` and
 * the Loamwise `align/` face.
 *
 * Sprint 6 Wave 6.1 lands:
 *   - MemoryTier enum + rank ordering (O1, O2)
 *   - MemoryRecord (§2) with derivation-rule enforcement (O3)
 *   - MemoryAssemblyPlan (§4) with immutability-after-freeze (O5)
 *   - MemoryRetrievalRequest (§3) — structural validation only
 *   - MemoryUsePolicy (§5) validator (decision_consumers invariants)
 *   - FrozenSnapshot (§6) immutable artifact
 *
 * Explicitly NOT in scope: retrieval execution, provider registration,
 * LLM summarization, federated query routing (all deferred to
 * Loamwise / P1-e). Sprint 6 Wave 6.2 wires Guard onto memory write
 * and assembly fragment ingest only.
 */

// === §1 MemoryTier (decision authority) ===

export enum MemoryTier {
  AUTHORITATIVE = 'authoritative',
  DECISION_SUPPORT = 'decision-support',
  CONTEXT_ONLY = 'context-only',
}

/**
 * Retrieval priority rank. Lower rank = higher priority (queried /
 * surfaced first). `strict_truth` default: authoritative(0) →
 * decision-support(1) → context-only(2).
 */
export function tierRank(t: MemoryTier): 0 | 1 | 2 {
  switch (t) {
    case MemoryTier.AUTHORITATIVE: return 0;
    case MemoryTier.DECISION_SUPPORT: return 1;
    case MemoryTier.CONTEXT_ONLY: return 2;
  }
}

/**
 * Derivation rule — source tier can only derive records at the same or
 * lower tier (O3). AUTHORITATIVE cannot be created by summarization.
 */
export function canDeriveTo(source: MemoryTier, target: MemoryTier): boolean {
  return tierRank(target) >= tierRank(source);
}

// === §2 MemoryRecord ===

export type MemoryRecordSourceLayer = 0 | 1 | 2;

export interface GuardEvidenceRef {
  evidence_id: string;
  guard_kind: string;                 // 'content-scan' | 'truth-write' | 'context-inject'
  verdict: 'safe' | 'caution' | 'dangerous';
}

export interface MemoryRecordSource {
  provider_id: string;
  layer: MemoryRecordSourceLayer;     // Layer 3 may NOT write memory records
  upstream_ref: string | null;        // record_id of parent if derived
  trace_id: string;                   // session event link
}

export interface MemoryRecord {
  record_id: string;
  tier: MemoryTier;
  content_kind: string;               // e.g., "contract.adr", "trace.event"
  content_hash: string;               // sha256 hex (with or without "sha256:" prefix)

  source: MemoryRecordSource;
  created_at: string;                 // ISO 8601

  guard_evidence: GuardEvidenceRef[]; // non-empty; all writes must have guard evidence
  redaction_applied: boolean;

  payload: unknown;                   // shape governed by content_kind sub-schema
}

// === §3 MemoryRetrievalRequest ===

export type RetrievalPurpose = 'decision' | 'context' | 'audit';
export type QueryMode = 'strict_truth' | 'balanced_recency';

export interface StructuredQuery {
  filters: Record<string, string | number | boolean>;
}

export interface MemoryRetrievalTriggeredBy {
  component: string;
  purpose: RetrievalPurpose;
  plan_id: string;                    // must reference a registered plan (O7)
}

export interface MemoryRetrievalRequest {
  request_id: string;
  query: string | StructuredQuery;
  tiers_allowed: MemoryTier[];        // must be explicit non-empty
  providers_allowed: string[];        // must be explicit non-empty
  query_mode: QueryMode;              // default 'strict_truth'; 'balanced_recency' gated
  max_fragments_per_tier: Partial<Record<MemoryTier, number>>;
  triggered_by: MemoryRetrievalTriggeredBy;
}

export interface RetrievalFragment {
  record: MemoryRecord;
  rank_in_tier: number;
  match_evidence: string;
}

export interface RetrievalResult {
  request_id: string;
  fragments: RetrievalFragment[];     // sorted by tierRank asc, then rank_in_tier asc
  truncated: boolean;
  retrieved_at: string;
}

// === §4 MemoryAssemblyPlan ===

export interface RetrievalSpec {
  provider_id: string;
  tiers: MemoryTier[];
  query_template: string;
  max_results: number;
}

export type AssemblyStepKind = 'system-prompt' | 'tool-context' | 'memory-fence';

export interface AssemblyStep {
  step: AssemblyStepKind;
  fragments: string[];                // record_id refs
  fence_boundary: string | null;      // O6 fencing
}

export interface MemoryWriteSpec {
  target_tier: MemoryTier;
  content_kind: string;
  use_policy_id: string;              // must reference a registered MemoryUsePolicy
}

export interface MemoryAssemblyPlan {
  plan_id: string;
  intended_for: RetrievalPurpose;
  retrieval_specs: RetrievalSpec[];
  assembly_order: AssemblyStep[];
  write_specs: MemoryWriteSpec[];
  created_at: string;
  expires_at: string;                 // ISO 8601; plan expires — new plan required
  frozen: boolean;                    // flipped true on freeze; then immutable (O5)
}

// === §5 MemoryUsePolicy ===

export type DecisionKindId = string;  // loose ref to P1-a DecisionKind (avoid cross-import)

export type WriteActorKind =
  | 'contract-adr'
  | 'event-stream'
  | 'engine-cosign'
  | 'policy-engine'
  | 'human-maintainer';

export type GuardKindId = 'content-scan' | 'truth-write' | 'context-inject';

export interface WriteActorRule {
  actor_kind: WriteActorKind;
  guard_chain_required: GuardKindId[];
}

export interface DerivationRule {
  can_summarize_to: MemoryTier[];     // must satisfy tierRank(target) >= tierRank(self)
  can_index_into: MemoryTier[];       // same constraint
}

export interface MemoryUsePolicy {
  policy_id: string;
  tier: MemoryTier;
  read_allowed_for: RetrievalPurpose[];
  write_allowed_by: WriteActorRule[];
  /** See §5 validator — see use_policy_registry.ts. */
  decision_consumers: DecisionKindId[];
  derivation_rule: DerivationRule;
  revocation_path: string;
}

// === §6 FrozenSnapshot ===

export interface FrozenSnapshot {
  snapshot_id: string;
  plan_id: string;
  fragments: ReadonlyArray<RetrievalFragment>;
  frozen_at: string;
}

// === Failure codes ===

export type UsePolicyFailureCode =
  | 'MISSING_POLICY_ID'
  | 'DUPLICATE_POLICY_ID'
  | 'INVALID_TIER'
  | 'AUTHORITATIVE_MUST_DECLARE_DECISION_CONSUMERS'
  | 'NON_AUTH_MUST_HAVE_EMPTY_DECISION_CONSUMERS'
  | 'DERIVATION_CANNOT_ELEVATE_TIER'
  | 'WRITE_ACTOR_RULES_EMPTY';

export type UsePolicyRegisterResult =
  | { ok: true; policy_id: string }
  | { ok: false; code: UsePolicyFailureCode; detail?: string };

export type PlanFailureCode =
  | 'DUPLICATE_PLAN_ID'
  | 'PLAN_ALREADY_FROZEN_AT_REGISTER'
  | 'PLAN_NOT_FOUND'
  | 'PLAN_EXPIRED'
  | 'PLAN_ALREADY_FROZEN'
  | 'PLAN_FROZEN_IS_IMMUTABLE'
  | 'UNKNOWN_USE_POLICY'
  | 'ASSEMBLY_STEP_REFERENCES_UNKNOWN_FRAGMENT'
  | 'WRITE_SPEC_TIER_MISMATCH';

export type PlanRegisterResult =
  | { ok: true; plan_id: string }
  | { ok: false; code: PlanFailureCode; detail?: string };

export type PlanFreezeResult =
  | { ok: true; plan_id: string; frozen_at: string }
  | { ok: false; code: PlanFailureCode; detail?: string };

export type RecordFailureCode =
  | 'INVALID_CONTENT_HASH'
  | 'INVALID_SOURCE_LAYER'
  | 'LAYER_3_CANNOT_WRITE_MEMORY'
  | 'DUPLICATE_RECORD_ID'
  | 'UNKNOWN_UPSTREAM_REF'
  | 'DERIVATION_ELEVATES_TIER'
  | 'MISSING_GUARD_EVIDENCE'
  | 'MISSING_TRACE_ID'
  | 'INVALID_TIER';

export type RecordRegisterResult =
  | { ok: true; record_id: string }
  | { ok: false; code: RecordFailureCode; detail?: string };

export type RetrievalFailureCode =
  | 'TIERS_ALLOWED_EMPTY'
  | 'PROVIDERS_ALLOWED_EMPTY'
  | 'INVALID_QUERY_MODE'
  | 'BALANCED_RECENCY_REQUIRES_AUDIT_PURPOSE'
  | 'PLAN_NOT_FOUND'
  | 'PLAN_EXPIRED'
  | 'PLAN_NOT_FROZEN';

export type RetrievalValidateResult =
  | { ok: true }
  | { ok: false; code: RetrievalFailureCode; detail?: string };

// === Guard-wired seams (Wave 6.2) ===

export type GuardedWriteFailureCode =
  | RecordFailureCode
  | 'UNKNOWN_USE_POLICY'
  | 'POLICY_TIER_MISMATCH'
  | 'DANGEROUS_VERDICT_BLOCKED_BY_POLICY';   // reserved — SHADOW does not block

export interface MemoryWriteRequest {
  record: Omit<MemoryRecord, 'guard_evidence'>;
  use_policy_id: string;
  /** Opaque payload for the guard scanner — e.g., serialized record body. */
  scan_payload: unknown;
  trace_id: string;
}

export type GuardedMemoryWriteResult =
  | {
      ok: true;
      record_id: string;
      guard_evidence_id: string;
      guard_kind: GuardKindId;
      guard_verdict: 'safe' | 'caution' | 'dangerous';
      guard_mode: 'shadow';
    }
  | {
      ok: false;
      code: GuardedWriteFailureCode;
      detail?: string;
      guard_evidence_id?: string;
      guard_verdict?: 'safe' | 'caution' | 'dangerous';
    };

export interface AssemblyFragmentIngestRequest {
  fragment_id: string;
  plan_id: string;
  step: AssemblyStepKind;
  record_ref: string;                 // the MemoryRecord the fragment is derived from
  scan_payload: unknown;
  trace_id: string;
}

export type FragmentIngestFailureCode =
  | 'PLAN_NOT_FOUND'
  | 'PLAN_NOT_FROZEN'
  | 'PLAN_EXPIRED'
  | 'UNKNOWN_RECORD_REF';

export type GuardedFragmentIngestResult =
  | {
      ok: true;
      fragment_id: string;
      guard_evidence_id: string;
      guard_verdict: 'safe' | 'caution' | 'dangerous';
      guard_mode: 'shadow';
    }
  | {
      ok: false;
      code: FragmentIngestFailureCode;
      detail?: string;
      guard_evidence_id?: string;
      guard_verdict?: 'safe' | 'caution' | 'dangerous';
    };
