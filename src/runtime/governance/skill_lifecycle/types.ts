/**
 * BGHS Skill Lifecycle — Types
 * Location: src/runtime/governance/skill_lifecycle/types.ts
 *
 * Mirrors ADR-Hermes-Skill-Lifecycle §1–§8. This tree is the **governance
 * state machine** for skill candidates — it is NOT the execution face.
 * See README.md in this directory for the hard boundary rule (the two
 * sibling trees never reach into each other across the layer 0 / layer 2
 * line).
 *
 * Sprint 5 Wave 5.1 lands the declarative surface, the transition log,
 * and the registry. Actual dispatcher behavior (Loamwise promotion
 * scheduler, quarantine watchers) lives in Layer 1 and is out of scope.
 */

// === §1 SkillLifecycleState ===

export enum SkillLifecycleState {
  DRAFT = 'draft',
  CANDIDATE = 'candidate',
  QUARANTINED = 'quarantined',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  REVOKED = 'revoked',
}

/**
 * Controlled transition whitelist. Any transition not listed here is
 * rejected at registry level (L1 — no bypass).
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<SkillLifecycleState, readonly SkillLifecycleState[]>> = {
  [SkillLifecycleState.DRAFT]: [SkillLifecycleState.CANDIDATE],
  [SkillLifecycleState.CANDIDATE]: [
    SkillLifecycleState.ACTIVE,
    SkillLifecycleState.QUARANTINED,
    SkillLifecycleState.REVOKED,
  ],
  [SkillLifecycleState.QUARANTINED]: [
    SkillLifecycleState.CANDIDATE,
    SkillLifecycleState.REVOKED,
  ],
  [SkillLifecycleState.ACTIVE]: [
    SkillLifecycleState.DEPRECATED,
    SkillLifecycleState.QUARANTINED,
  ],
  [SkillLifecycleState.DEPRECATED]: [SkillLifecycleState.REVOKED],
  [SkillLifecycleState.REVOKED]: [],
};

// === §3 TrustSource ===

export enum TrustSource {
  INTERNAL_VETTED = 'internal-vetted',
  ENGINE_PUBLISHED = 'engine-published',
  AGENT_GENERATED = 'agent-generated',
  EXTERNAL = 'external',
}

// === Scan reference (points at GuardEvidence) ===

export type ScanVerdictLiteral = 'safe' | 'caution' | 'dangerous';

export interface ScanResultRef {
  scanner_id: string;
  scanned_at: string;
  verdict: ScanVerdictLiteral;
  evidence_path: string;    // references GuardEvidence.evidence_id or an external ref
}

// === §2 SkillCandidateRecord ===

export type GeneratedByLayer = 1 | 2;

export interface GeneratedBy {
  component: string;                // e.g., "loamwise:construct.learning-loop"
  layer: GeneratedByLayer;          // Layer 0 may NOT produce candidates (L7)
}

export interface SkillCandidateRecord {
  candidate_id: string;
  skill_id: string;                 // e.g., "amazon-growth-engine:bid_recommend"
  version: string;                  // SemVer
  content_hash: string;             // sha256 hex of body + frontmatter

  source_trace_id: string;
  source_kind: TrustSource;
  generated_by: GeneratedBy;
  created_at: string;               // ISO 8601
  expires_at: string | null;        // CANDIDATE grace deadline; null = no expiry policy

  risk_class: 'low' | 'medium' | 'high' | 'unknown';
  scan_results: ScanResultRef[];

  /** Must be the submission state — CANDIDATE only (L2). */
  state: SkillLifecycleState;
  state_changed_at: string;

  /** Must reference a kind registered in the BGHS CapabilityKindRegistry. */
  capability_kind: string;
  /** Filled in only after ACTIVE; null at submission. */
  capability_registration_id: string | null;
}

// === §4 PromotionDecision + support types ===

export type ApproverKind = 'human-maintainer' | 'engine-cosign' | 'policy-rule';

export interface ApproverEvidence {
  approver_kind: ApproverKind;
  approver_id: string;
  approved_at: string;
  evidence_ref: string;
}

export interface PolicyEvalResult {
  policy_adr: string;
  evaluated_at: string;
  passed: boolean;
  notes?: string;
}

export interface RollbackPolicy {
  on_drift_detected: 'auto-quarantine' | 'alert-only';
  on_kill_switch: 'auto-revoke' | 'auto-quarantine';
}

export type DecidedByActorKind = 'human' | 'service' | 'policy-engine' | 'kill-switch';

export interface DecidedBy {
  actor_id: string;
  actor_kind: DecidedByActorKind;
  signature: string;                // HMAC or stronger; must be non-empty
}

export interface PromotionDecision {
  decision_id: string;
  candidate_id: string;
  from_state: SkillLifecycleState;
  to_state: SkillLifecycleState;    // expected to be ACTIVE or CANDIDATE (re-admission)
  decided_at: string;

  approvers: ApproverEvidence[];    // ≥ 1 required (L3)
  scan_evidence: ScanResultRef[];   // ≥ 1 required with verdict='safe' (L4)
  policy_evaluations: PolicyEvalResult[];

  rollback_policy: RollbackPolicy;

  decided_by: DecidedBy;
}

// === §5 QuarantineDecision ===

export enum QuarantineReason {
  SCAN_DANGEROUS = 'scan.dangerous',
  SCAN_CAUTION = 'scan.caution',
  PROMOTION_REJECTED = 'promotion.rejected',
  DRIFT_DETECTED = 'drift.detected',
  POLICY_VIOLATION = 'policy.violation',
  KILL_SWITCH = 'kill-switch',
  EXTERNAL_REPORT = 'external.report',
  GRACE_PERIOD_EXPIRED = 'grace-period.expired',
}

export interface QuarantineDecision {
  decision_id: string;
  candidate_id: string;
  from_state: SkillLifecycleState;
  to_state: SkillLifecycleState;    // usually QUARANTINED or REVOKED
  reason: QuarantineReason;
  reason_detail: string;
  reason_evidence: string[];
  decided_at: string;
  /** Null = blocked until a new decision explicitly releases. */
  release_blocked_until: string | null;

  decided_by: DecidedBy;
}

// === §6 LifecycleTransition (append-only log entry) ===

export type LifecycleDriver =
  | { kind: 'promotion'; decision: PromotionDecision }
  | { kind: 'quarantine'; decision: QuarantineDecision };

export interface LifecycleTransition {
  transition_id: string;
  candidate_id: string;
  from_state: SkillLifecycleState;
  to_state: SkillLifecycleState;
  transitioned_at: string;
  driver: LifecycleDriver;
  /** sha256(prev_transition_id || canonical(payload)) — see transition_log.ts */
  prev_transition_id: string | null;
  entry_hash: string;
}

// === Registry failure codes ===

export type SubmitFailureCode =
  | 'INITIAL_STATE_MUST_BE_CANDIDATE'
  | 'MISSING_PROVENANCE'
  | 'LAYER_0_CANNOT_PRODUCE_CANDIDATE'
  | 'UNKNOWN_CAPABILITY_KIND'
  | 'DUPLICATE_CANDIDATE_ID'
  | 'INVALID_CANDIDATE_ID_FORMAT'
  | 'INVALID_CONTENT_HASH';

export type TransitionFailureCode =
  | 'CANDIDATE_NOT_FOUND'
  | 'ILLEGAL_TRANSITION'
  | 'FROM_STATE_MISMATCH'
  | 'MISSING_DRIVER'
  | 'MISSING_APPROVERS'
  | 'MISSING_SIGNATURE'
  | 'SCAN_EVIDENCE_NOT_SAFE'
  | 'MISSING_SCAN_EVIDENCE'
  | 'QUARANTINE_RELEASE_BLOCKED'
  | 'REVOKED_IS_TERMINAL'
  | 'CANDIDATE_ID_MISMATCH';

export type SubmitResult =
  | { ok: true; candidate_id: string }
  | { ok: false; code: SubmitFailureCode; detail?: string };

export type TransitionResult =
  | { ok: true; transition_id: string; to_state: SkillLifecycleState }
  | { ok: false; code: TransitionFailureCode; detail?: string };

// === Guard seam — candidate submit (Wave 5.2) ===

export type CandidateSubmitFailureCode =
  | SubmitFailureCode
  | 'GUARD_EVIDENCE_MISSING';

/**
 * Output of a guarded candidate submit (Wave 5.2). SHADOW mode never
 * blocks, so `ok` reflects whether the lifecycle registry accepted the
 * record after the shadow guard produced evidence.
 */
export type GuardedSubmitResult =
  | {
      ok: true;
      candidate_id: string;
      guard_evidence_id: string;
      guard_verdict: 'safe' | 'caution' | 'dangerous';
      guard_mode: 'shadow';
    }
  | {
      ok: false;
      code: CandidateSubmitFailureCode;
      detail?: string;
      guard_evidence_id?: string;
      guard_verdict?: 'safe' | 'caution' | 'dangerous';
    };
