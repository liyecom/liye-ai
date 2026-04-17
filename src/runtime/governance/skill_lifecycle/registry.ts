/**
 * BGHS Skill Lifecycle — SkillLifecycleRegistry
 * Location: src/runtime/governance/skill_lifecycle/registry.ts
 *
 * ADR-Hermes-Skill-Lifecycle §8. State machine wrapper around
 * TransitionLog. Enforces L1–L7:
 *
 *   L1  Controlled transitions + append-only (no bypass, no in-place
 *       mutation). Every transition is driven by a PromotionDecision
 *       or QuarantineDecision — no "update this state field" API.
 *   L2  Initial state must be CANDIDATE. DRAFT is a pre-registration
 *       editor state and is never accepted into the lifecycle log.
 *   L3  approvers ≥ 1 and signature non-empty (scan_pass ≠ trust;
 *       promotion requires explicit approver evidence).
 *   L4  scan_evidence must contain at least one 'safe' verdict for
 *       promotion-class transitions. Any 'dangerous' = reject.
 *   L6  Provenance fields (source_trace_id / generated_by /
 *       content_hash) are mandatory at submit.
 *   L7  generated_by.layer ∈ {1,2}. capability_kind must be registered
 *       in the BGHS CapabilityKindRegistry.
 *
 * Note: policy-specific values (required approver counts, grace-period
 * seconds per TrustSource) are NOT enforced here. §3 calls those values
 * illustrative / NON-NORMATIVE and defers them to a later policy ADR.
 * This registry enforces the structural discipline only.
 */

import type { CapabilityKindRegistry } from '../capability/kind_registry';
import { TransitionLog } from './transition_log';
import {
  ALLOWED_TRANSITIONS,
  SkillLifecycleState,
  type PromotionDecision,
  type QuarantineDecision,
  type SkillCandidateRecord,
  type SubmitResult,
  type TransitionResult,
} from './types';

const CANDIDATE_ID_RE = /^[a-z0-9][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)*$/i;
const CONTENT_HASH_RE = /^sha256:[a-f0-9]{64}$|^[a-f0-9]{64}$/i;

interface CandidateEntry {
  record: SkillCandidateRecord;
  /** Current state — advanced by applyPromotion / applyQuarantine. */
  current_state: SkillLifecycleState;
  /**
   * Earliest moment (ISO 8601) at which a QUARANTINED → CANDIDATE
   * re-admission may be attempted. Set by QuarantineDecision; null = no
   * timed block (but still needs a new PromotionDecision to exit).
   */
  release_blocked_until: string | null;
}

export class SkillLifecycleRegistry {
  private candidates: Map<string, CandidateEntry> = new Map();
  private readonly log: TransitionLog;

  constructor(
    private readonly kinds: CapabilityKindRegistry,
    log?: TransitionLog,
  ) {
    this.log = log ?? new TransitionLog();
  }

  /** Expose the underlying log for auditing; not for mutation. */
  transitions(): TransitionLog {
    return this.log;
  }

  submitCandidate(rec: SkillCandidateRecord): SubmitResult {
    if (!CANDIDATE_ID_RE.test(rec.candidate_id)) {
      return { ok: false, code: 'INVALID_CANDIDATE_ID_FORMAT', detail: rec.candidate_id };
    }
    if (this.candidates.has(rec.candidate_id)) {
      return { ok: false, code: 'DUPLICATE_CANDIDATE_ID', detail: rec.candidate_id };
    }
    // L2 — initial state is CANDIDATE (DRAFT is not persisted)
    if (rec.state !== SkillLifecycleState.CANDIDATE) {
      return { ok: false, code: 'INITIAL_STATE_MUST_BE_CANDIDATE', detail: rec.state };
    }
    // L6 — provenance
    if (!rec.source_trace_id || !rec.generated_by?.component || !rec.content_hash) {
      return { ok: false, code: 'MISSING_PROVENANCE' };
    }
    if (!CONTENT_HASH_RE.test(rec.content_hash)) {
      return { ok: false, code: 'INVALID_CONTENT_HASH', detail: rec.content_hash };
    }
    // L7 — Layer 0 may not produce candidates
    if ((rec.generated_by.layer as number) === 0) {
      return { ok: false, code: 'LAYER_0_CANNOT_PRODUCE_CANDIDATE' };
    }
    if (![1, 2].includes(rec.generated_by.layer)) {
      return { ok: false, code: 'LAYER_0_CANNOT_PRODUCE_CANDIDATE', detail: String(rec.generated_by.layer) };
    }
    // L7 + P1-a B1 — capability_kind must be known
    if (!this.kinds.has(rec.capability_kind)) {
      return { ok: false, code: 'UNKNOWN_CAPABILITY_KIND', detail: rec.capability_kind };
    }

    this.candidates.set(rec.candidate_id, {
      record: rec,
      current_state: SkillLifecycleState.CANDIDATE,
      release_blocked_until: null,
    });
    return { ok: true, candidate_id: rec.candidate_id };
  }

  applyPromotion(decision: PromotionDecision): TransitionResult {
    const entry = this.candidates.get(decision.candidate_id);
    if (!entry) return { ok: false, code: 'CANDIDATE_NOT_FOUND', detail: decision.candidate_id };

    if (entry.current_state !== decision.from_state) {
      return { ok: false, code: 'FROM_STATE_MISMATCH', detail: `${entry.current_state} vs ${decision.from_state}` };
    }
    if (entry.current_state === SkillLifecycleState.REVOKED) {
      return { ok: false, code: 'REVOKED_IS_TERMINAL' };
    }
    // L1 — whitelist check
    const allowed = ALLOWED_TRANSITIONS[decision.from_state];
    if (!allowed.includes(decision.to_state)) {
      return { ok: false, code: 'ILLEGAL_TRANSITION', detail: `${decision.from_state} → ${decision.to_state}` };
    }
    // QUARANTINED → CANDIDATE re-admission respects release_blocked_until
    if (
      decision.from_state === SkillLifecycleState.QUARANTINED
      && decision.to_state === SkillLifecycleState.CANDIDATE
      && entry.release_blocked_until
      && new Date().toISOString() < entry.release_blocked_until
    ) {
      return { ok: false, code: 'QUARANTINE_RELEASE_BLOCKED', detail: entry.release_blocked_until };
    }
    // L3 — approvers + signature
    if (!decision.approvers || decision.approvers.length === 0) {
      return { ok: false, code: 'MISSING_APPROVERS' };
    }
    if (!decision.decided_by?.signature) {
      return { ok: false, code: 'MISSING_SIGNATURE' };
    }
    // L4 — scan evidence must include 'safe' when transitioning to ACTIVE or
    // re-admitting to CANDIDATE. DEPRECATED / graceful wind-down transitions
    // are promotion-class too but have their own checkpoint later; Sprint 5
    // enforces safe-evidence on any promotion path that lands in ACTIVE or
    // re-admission CANDIDATE.
    const needsSafeScan =
      decision.to_state === SkillLifecycleState.ACTIVE
      || decision.to_state === SkillLifecycleState.CANDIDATE;
    if (needsSafeScan) {
      if (!decision.scan_evidence || decision.scan_evidence.length === 0) {
        return { ok: false, code: 'MISSING_SCAN_EVIDENCE' };
      }
      const hasSafe = decision.scan_evidence.some((s) => s.verdict === 'safe');
      if (!hasSafe) return { ok: false, code: 'SCAN_EVIDENCE_NOT_SAFE' };
    }

    const t = this.log.append({
      candidate_id: decision.candidate_id,
      from_state: decision.from_state,
      to_state: decision.to_state,
      driver: { kind: 'promotion', decision },
    });
    entry.current_state = decision.to_state;
    if (decision.to_state === SkillLifecycleState.CANDIDATE) {
      // Re-admission — clear the block.
      entry.release_blocked_until = null;
    }
    return { ok: true, transition_id: t.transition_id, to_state: decision.to_state };
  }

  applyQuarantine(decision: QuarantineDecision): TransitionResult {
    const entry = this.candidates.get(decision.candidate_id);
    if (!entry) return { ok: false, code: 'CANDIDATE_NOT_FOUND', detail: decision.candidate_id };

    if (entry.current_state !== decision.from_state) {
      return { ok: false, code: 'FROM_STATE_MISMATCH', detail: `${entry.current_state} vs ${decision.from_state}` };
    }
    if (entry.current_state === SkillLifecycleState.REVOKED) {
      return { ok: false, code: 'REVOKED_IS_TERMINAL' };
    }
    const allowed = ALLOWED_TRANSITIONS[decision.from_state];
    if (!allowed.includes(decision.to_state)) {
      return { ok: false, code: 'ILLEGAL_TRANSITION', detail: `${decision.from_state} → ${decision.to_state}` };
    }
    if (!decision.decided_by?.signature) {
      return { ok: false, code: 'MISSING_SIGNATURE' };
    }

    const t = this.log.append({
      candidate_id: decision.candidate_id,
      from_state: decision.from_state,
      to_state: decision.to_state,
      driver: { kind: 'quarantine', decision },
    });
    entry.current_state = decision.to_state;
    if (decision.to_state === SkillLifecycleState.QUARANTINED) {
      entry.release_blocked_until = decision.release_blocked_until;
    }
    return { ok: true, transition_id: t.transition_id, to_state: decision.to_state };
  }

  getState(candidate_id: string): SkillLifecycleState | null {
    return this.candidates.get(candidate_id)?.current_state ?? null;
  }

  lookup(candidate_id: string): SkillCandidateRecord | null {
    return this.candidates.get(candidate_id)?.record ?? null;
  }

  size(): number {
    return this.candidates.size;
  }

  _clearForTests(): void {
    this.candidates.clear();
    this.log._clearForTests();
  }
}
