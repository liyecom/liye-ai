/**
 * Skill Lifecycle TransitionLog tests — Sprint 5 Wave 5.1.
 *
 * Coverage:
 *   - canonicalJson produces stable output under key reordering
 *   - TransitionLog.append assigns prev_transition_id and entry_hash
 *   - verifyChain catches tampered entry_hash and prev mismatch
 *   - Per-candidate chains are independent (no global single chain)
 */

import { describe, expect, it } from 'vitest';
import {
  TransitionLog,
  canonicalJson,
  SkillLifecycleState,
  type LifecycleDriver,
  type PromotionDecision,
  type QuarantineDecision,
} from '../../../../src/runtime/governance/skill_lifecycle';
import { QuarantineReason } from '../../../../src/runtime/governance/skill_lifecycle';

function promoDriver(decision_id: string): LifecycleDriver {
  const d: PromotionDecision = {
    decision_id,
    candidate_id: 'c1',
    from_state: SkillLifecycleState.CANDIDATE,
    to_state: SkillLifecycleState.ACTIVE,
    decided_at: '2026-04-17T00:00:00Z',
    approvers: [
      {
        approver_kind: 'human-maintainer',
        approver_id: 'liye',
        approved_at: '2026-04-17T00:00:00Z',
        evidence_ref: 'pr://example',
      },
    ],
    scan_evidence: [
      { scanner_id: 'stub', scanned_at: '2026-04-17T00:00:00Z', verdict: 'safe', evidence_path: 'ev-1' },
    ],
    policy_evaluations: [],
    rollback_policy: { on_drift_detected: 'auto-quarantine', on_kill_switch: 'auto-revoke' },
    decided_by: { actor_id: 'liye', actor_kind: 'human', signature: 'hmac-abc' },
  };
  return { kind: 'promotion', decision: d };
}

function quarantineDriver(decision_id: string): LifecycleDriver {
  const d: QuarantineDecision = {
    decision_id,
    candidate_id: 'c1',
    from_state: SkillLifecycleState.CANDIDATE,
    to_state: SkillLifecycleState.QUARANTINED,
    reason: QuarantineReason.SCAN_CAUTION,
    reason_detail: 'caution-from-shadow',
    reason_evidence: [],
    decided_at: '2026-04-17T00:00:00Z',
    release_blocked_until: null,
    decided_by: { actor_id: 'policy-engine', actor_kind: 'policy-engine', signature: 'hmac-xyz' },
  };
  return { kind: 'quarantine', decision: d };
}

describe('canonicalJson', () => {
  it('produces identical output regardless of key order', () => {
    const a = canonicalJson({ b: 1, a: 2, c: [3, { z: 1, a: 2 }] });
    const b = canonicalJson({ c: [3, { a: 2, z: 1 }], a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it('stringifies primitives natively', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson('x')).toBe('"x"');
    expect(canonicalJson(3)).toBe('3');
  });
});

describe('TransitionLog.append + verifyChain', () => {
  it('chains entries: prev_transition_id points at prior id', () => {
    const log = new TransitionLog();
    const e1 = log.append({
      candidate_id: 'c1',
      from_state: SkillLifecycleState.CANDIDATE,
      to_state: SkillLifecycleState.ACTIVE,
      driver: promoDriver('d1'),
    });
    expect(e1.prev_transition_id).toBeNull();

    const e2 = log.append({
      candidate_id: 'c1',
      from_state: SkillLifecycleState.ACTIVE,
      to_state: SkillLifecycleState.QUARANTINED,
      driver: quarantineDriver('d2'),
    });
    expect(e2.prev_transition_id).toBe(e1.transition_id);
    expect(log.tip('c1')).toBe(e2.transition_id);
  });

  it('verifyChain returns ok for untouched chain', () => {
    const log = new TransitionLog();
    log.append({
      candidate_id: 'c1',
      from_state: SkillLifecycleState.CANDIDATE,
      to_state: SkillLifecycleState.ACTIVE,
      driver: promoDriver('d1'),
    });
    log.append({
      candidate_id: 'c1',
      from_state: SkillLifecycleState.ACTIVE,
      to_state: SkillLifecycleState.QUARANTINED,
      driver: quarantineDriver('d2'),
    });
    expect(log.verifyChain('c1')).toEqual({ ok: true });
  });

  it('verifyChain detects tampered entry_hash', () => {
    const log = new TransitionLog();
    log.append({
      candidate_id: 'c1',
      from_state: SkillLifecycleState.CANDIDATE,
      to_state: SkillLifecycleState.ACTIVE,
      driver: promoDriver('d1'),
    });
    const chain = log.getChain('c1');
    // Cast away readonly for the test; production code never does this.
    (chain as unknown as { entry_hash: string }[])[0].entry_hash = 'tampered';
    const r = log.verifyChain('c1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/entry_hash/);
  });

  it('verifyChain detects tampered prev_transition_id', () => {
    const log = new TransitionLog();
    log.append({
      candidate_id: 'c1',
      from_state: SkillLifecycleState.CANDIDATE,
      to_state: SkillLifecycleState.ACTIVE,
      driver: promoDriver('d1'),
    });
    log.append({
      candidate_id: 'c1',
      from_state: SkillLifecycleState.ACTIVE,
      to_state: SkillLifecycleState.QUARANTINED,
      driver: quarantineDriver('d2'),
    });
    const chain = log.getChain('c1');
    (chain as unknown as { prev_transition_id: string }[])[1].prev_transition_id = 'bogus';
    const r = log.verifyChain('c1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.at).toBe(1);
  });

  it('per-candidate chains are independent', () => {
    const log = new TransitionLog();
    log.append({
      candidate_id: 'c1',
      from_state: SkillLifecycleState.CANDIDATE,
      to_state: SkillLifecycleState.ACTIVE,
      driver: promoDriver('d-a'),
    });
    log.append({
      candidate_id: 'c2',
      from_state: SkillLifecycleState.CANDIDATE,
      to_state: SkillLifecycleState.ACTIVE,
      driver: promoDriver('d-b'),
    });
    expect(log.getChain('c1').length).toBe(1);
    expect(log.getChain('c2').length).toBe(1);
    // Neither chain's first entry points at the other's tip.
    expect(log.getChain('c1')[0].prev_transition_id).toBeNull();
    expect(log.getChain('c2')[0].prev_transition_id).toBeNull();
  });
});
