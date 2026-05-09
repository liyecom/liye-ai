/**
 * SkillLifecycleRegistry tests — Sprint 5 Wave 5.1.
 *
 * Coverage:
 *   - submitCandidate enforces L2/L6/L7 + CapabilityKind admission
 *   - applyPromotion enforces L1 whitelist, L3 approvers + signature,
 *     L4 safe-scan requirement, QUARANTINED release block
 *   - applyQuarantine enforces L1 whitelist + decided_by.signature
 *   - REVOKED is terminal
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  CapabilityKindRegistry,
  type CapabilityKindRegistration,
} from '../../../../src/runtime/governance/capability';
import {
  ALLOWED_TRANSITIONS,
  QuarantineReason,
  SkillLifecycleRegistry,
  SkillLifecycleState,
  TrustSource,
  type PromotionDecision,
  type QuarantineDecision,
  type SkillCandidateRecord,
} from '../../../../src/runtime/governance/skill_lifecycle';

const KIND: CapabilityKindRegistration = {
  kind: 'engine.write.amazon-ads-bid',
  layer_introduced: 0,
  contract_adr: 'ADR-OpenClaw-Capability-Boundary',
  contract_schema: '_meta/contracts/capability/engine.write.amazon-ads-bid.schema.yaml',
  introduced_at: '2026-04-17T00:00:00Z',
  superseded_by: null,
  status: 'active',
};

function makeRecord(overrides: Partial<SkillCandidateRecord> = {}): SkillCandidateRecord {
  return {
    candidate_id: 'cand-001',
    skill_id: 'amazon-growth-engine:bid_recommend',
    version: '0.1.0',
    content_hash: 'sha256:' + 'a'.repeat(64),
    source_trace_id: 'trace-abc',
    source_kind: TrustSource.AGENT_GENERATED,
    generated_by: { component: 'loamwise:learning-loop', layer: 1 },
    created_at: '2026-04-17T00:00:00Z',
    expires_at: null,
    risk_class: 'low',
    scan_results: [],
    state: SkillLifecycleState.CANDIDATE,
    state_changed_at: '2026-04-17T00:00:00Z',
    capability_kind: 'engine.write.amazon-ads-bid',
    capability_registration_id: null,
    ...overrides,
  };
}

function makePromotion(overrides: Partial<PromotionDecision> = {}): PromotionDecision {
  return {
    decision_id: 'promo-1',
    candidate_id: 'cand-001',
    from_state: SkillLifecycleState.CANDIDATE,
    to_state: SkillLifecycleState.ACTIVE,
    decided_at: '2026-04-17T01:00:00Z',
    approvers: [
      {
        approver_kind: 'human-maintainer',
        approver_id: 'liye',
        approved_at: '2026-04-17T01:00:00Z',
        evidence_ref: 'pr://example/1',
      },
    ],
    scan_evidence: [
      { scanner_id: 'stub', scanned_at: '2026-04-17T00:30:00Z', verdict: 'safe', evidence_path: 'ev-safe' },
    ],
    policy_evaluations: [],
    rollback_policy: { on_drift_detected: 'auto-quarantine', on_kill_switch: 'auto-revoke' },
    decided_by: { actor_id: 'liye', actor_kind: 'human', signature: 'hmac-abc' },
    ...overrides,
  };
}

function makeQuarantine(overrides: Partial<QuarantineDecision> = {}): QuarantineDecision {
  return {
    decision_id: 'quar-1',
    candidate_id: 'cand-001',
    from_state: SkillLifecycleState.CANDIDATE,
    to_state: SkillLifecycleState.QUARANTINED,
    reason: QuarantineReason.SCAN_CAUTION,
    reason_detail: 'caution from shadow guard',
    reason_evidence: ['ev-caution'],
    decided_at: '2026-04-17T02:00:00Z',
    release_blocked_until: null,
    decided_by: { actor_id: 'policy', actor_kind: 'policy-engine', signature: 'hmac-z' },
    ...overrides,
  };
}

describe('ALLOWED_TRANSITIONS whitelist', () => {
  it('REVOKED is terminal', () => {
    expect(ALLOWED_TRANSITIONS[SkillLifecycleState.REVOKED]).toEqual([]);
  });

  it('ACTIVE can only go to DEPRECATED or QUARANTINED', () => {
    expect(ALLOWED_TRANSITIONS[SkillLifecycleState.ACTIVE]).toEqual([
      SkillLifecycleState.DEPRECATED,
      SkillLifecycleState.QUARANTINED,
    ]);
  });

  it('QUARANTINED can only re-enter CANDIDATE or REVOKED (no direct ACTIVE)', () => {
    const allowed = ALLOWED_TRANSITIONS[SkillLifecycleState.QUARANTINED];
    expect(allowed).toContain(SkillLifecycleState.CANDIDATE);
    expect(allowed).toContain(SkillLifecycleState.REVOKED);
    expect(allowed).not.toContain(SkillLifecycleState.ACTIVE);
  });
});

describe('SkillLifecycleRegistry.submitCandidate', () => {
  let kinds: CapabilityKindRegistry;
  let reg: SkillLifecycleRegistry;

  beforeEach(() => {
    kinds = new CapabilityKindRegistry();
    kinds.register(KIND);
    reg = new SkillLifecycleRegistry(kinds);
  });

  it('accepts a valid candidate', () => {
    const r = reg.submitCandidate(makeRecord());
    expect(r.ok).toBe(true);
    expect(reg.getState('cand-001')).toBe(SkillLifecycleState.CANDIDATE);
  });

  it('rejects DRAFT initial state (L2)', () => {
    const r = reg.submitCandidate(makeRecord({ state: SkillLifecycleState.DRAFT }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INITIAL_STATE_MUST_BE_CANDIDATE');
  });

  it('rejects ACTIVE initial state (L2 — no shortcut to ACTIVE)', () => {
    const r = reg.submitCandidate(makeRecord({ state: SkillLifecycleState.ACTIVE }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INITIAL_STATE_MUST_BE_CANDIDATE');
  });

  it('rejects missing source_trace_id (L6)', () => {
    const r = reg.submitCandidate(makeRecord({ source_trace_id: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MISSING_PROVENANCE');
  });

  it('rejects missing content_hash (L6)', () => {
    const r = reg.submitCandidate(makeRecord({ content_hash: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MISSING_PROVENANCE');
  });

  it('rejects malformed content_hash (L6)', () => {
    const r = reg.submitCandidate(makeRecord({ content_hash: 'not-a-sha' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_CONTENT_HASH');
  });

  it('rejects Layer 0 candidate producer (L7)', () => {
    const r = reg.submitCandidate(makeRecord({
      generated_by: { component: 'liye_os:anything', layer: 0 as unknown as 1 },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('LAYER_0_CANNOT_PRODUCE_CANDIDATE');
  });

  it('rejects unknown capability_kind (L7 + P1-a B1)', () => {
    const r = reg.submitCandidate(makeRecord({ capability_kind: 'engine.write.not-registered' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('UNKNOWN_CAPABILITY_KIND');
  });

  it('rejects duplicate candidate_id', () => {
    expect(reg.submitCandidate(makeRecord()).ok).toBe(true);
    const r = reg.submitCandidate(makeRecord());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DUPLICATE_CANDIDATE_ID');
  });
});

describe('SkillLifecycleRegistry.applyPromotion', () => {
  let kinds: CapabilityKindRegistry;
  let reg: SkillLifecycleRegistry;

  beforeEach(() => {
    kinds = new CapabilityKindRegistry();
    kinds.register(KIND);
    reg = new SkillLifecycleRegistry(kinds);
    reg.submitCandidate(makeRecord());
  });

  it('promotes CANDIDATE → ACTIVE with safe scan + approver + signature', () => {
    const r = reg.applyPromotion(makePromotion());
    expect(r.ok).toBe(true);
    expect(reg.getState('cand-001')).toBe(SkillLifecycleState.ACTIVE);
  });

  it('rejects from_state mismatch', () => {
    const r = reg.applyPromotion(makePromotion({ from_state: SkillLifecycleState.ACTIVE }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('FROM_STATE_MISMATCH');
  });

  it('rejects illegal transition (CANDIDATE → DEPRECATED)', () => {
    const r = reg.applyPromotion(makePromotion({ to_state: SkillLifecycleState.DEPRECATED }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ILLEGAL_TRANSITION');
  });

  it('rejects missing approvers (L3)', () => {
    const r = reg.applyPromotion(makePromotion({ approvers: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MISSING_APPROVERS');
  });

  it('rejects empty signature (L3)', () => {
    const r = reg.applyPromotion(makePromotion({
      decided_by: { actor_id: 'x', actor_kind: 'human', signature: '' },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MISSING_SIGNATURE');
  });

  it('rejects missing scan evidence on ACTIVE promotion (L4)', () => {
    const r = reg.applyPromotion(makePromotion({ scan_evidence: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MISSING_SCAN_EVIDENCE');
  });

  it('rejects scan evidence without any safe verdict (L4)', () => {
    const r = reg.applyPromotion(makePromotion({
      scan_evidence: [
        { scanner_id: 'x', scanned_at: '2026-04-17T00:00:00Z', verdict: 'caution', evidence_path: 'ev' },
      ],
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('SCAN_EVIDENCE_NOT_SAFE');
  });

  it('rejects promotion for unknown candidate', () => {
    const r = reg.applyPromotion(makePromotion({ candidate_id: 'nonexistent' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('CANDIDATE_NOT_FOUND');
  });
});

describe('SkillLifecycleRegistry.applyQuarantine', () => {
  let kinds: CapabilityKindRegistry;
  let reg: SkillLifecycleRegistry;

  beforeEach(() => {
    kinds = new CapabilityKindRegistry();
    kinds.register(KIND);
    reg = new SkillLifecycleRegistry(kinds);
    reg.submitCandidate(makeRecord());
  });

  it('quarantines CANDIDATE', () => {
    const r = reg.applyQuarantine(makeQuarantine());
    expect(r.ok).toBe(true);
    expect(reg.getState('cand-001')).toBe(SkillLifecycleState.QUARANTINED);
  });

  it('blocks QUARANTINED → CANDIDATE re-admission when release_blocked_until is in the future', () => {
    const future = '2099-01-01T00:00:00Z';
    const q = reg.applyQuarantine(makeQuarantine({ release_blocked_until: future }));
    expect(q.ok).toBe(true);
    const p = reg.applyPromotion(makePromotion({
      from_state: SkillLifecycleState.QUARANTINED,
      to_state: SkillLifecycleState.CANDIDATE,
    }));
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.code).toBe('QUARANTINE_RELEASE_BLOCKED');
  });

  it('allows QUARANTINED → CANDIDATE once release_blocked_until has passed', () => {
    reg.applyQuarantine(makeQuarantine({ release_blocked_until: '2000-01-01T00:00:00Z' }));
    const p = reg.applyPromotion(makePromotion({
      from_state: SkillLifecycleState.QUARANTINED,
      to_state: SkillLifecycleState.CANDIDATE,
    }));
    expect(p.ok).toBe(true);
    expect(reg.getState('cand-001')).toBe(SkillLifecycleState.CANDIDATE);
  });

  it('rejects quarantine with empty signature', () => {
    const r = reg.applyQuarantine(makeQuarantine({
      decided_by: { actor_id: 'x', actor_kind: 'human', signature: '' },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MISSING_SIGNATURE');
  });

  it('rejects illegal quarantine (REVOKED → QUARANTINED)', () => {
    // Drive to REVOKED via QUARANTINED → REVOKED path
    reg.applyQuarantine(makeQuarantine());
    reg.applyQuarantine(makeQuarantine({
      from_state: SkillLifecycleState.QUARANTINED,
      to_state: SkillLifecycleState.REVOKED,
    }));
    expect(reg.getState('cand-001')).toBe(SkillLifecycleState.REVOKED);

    const r = reg.applyQuarantine(makeQuarantine({
      from_state: SkillLifecycleState.REVOKED,
      to_state: SkillLifecycleState.QUARANTINED,
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('REVOKED_IS_TERMINAL');
  });
});

describe('Transitions are append-only (audit chain)', () => {
  it('records each accepted transition in order', () => {
    const kinds = new CapabilityKindRegistry();
    kinds.register(KIND);
    const reg = new SkillLifecycleRegistry(kinds);
    reg.submitCandidate(makeRecord());

    reg.applyPromotion(makePromotion());                          // → ACTIVE
    reg.applyQuarantine(makeQuarantine({                          // → QUARANTINED
      from_state: SkillLifecycleState.ACTIVE,
    }));

    const chain = reg.transitions().getChain('cand-001');
    expect(chain.length).toBe(2);
    expect(chain[0].to_state).toBe(SkillLifecycleState.ACTIVE);
    expect(chain[1].to_state).toBe(SkillLifecycleState.QUARANTINED);
    expect(reg.transitions().verifyChain('cand-001')).toEqual({ ok: true });
  });
});
