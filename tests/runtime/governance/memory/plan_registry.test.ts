/**
 * MemoryPlanRegistry + snapshot tests — Sprint 6 Wave 6.1.
 *
 * Coverage:
 *   - plan registration + write_specs policy reference
 *   - write_specs.target_tier must match policy tier
 *   - freeze flips plan to immutable; subsequent mutation throws (O5)
 *   - expired plan cannot be frozen / cannot pass retrieval validator
 *   - buildFrozenSnapshot sorts by tierRank then rank_in_tier
 *   - snapshot is immutable
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  MemoryPlanRegistry,
  MemoryTier,
  MemoryUsePolicyRegistry,
  buildFrozenSnapshot,
  type MemoryAssemblyPlan,
  type MemoryUsePolicy,
  type RetrievalFragment,
} from '../../../../src/runtime/governance/memory';

function makePolicy(overrides: Partial<MemoryUsePolicy> = {}): MemoryUsePolicy {
  return {
    policy_id: 'pol-ds',
    tier: MemoryTier.DECISION_SUPPORT,
    read_allowed_for: ['decision', 'audit'],
    write_allowed_by: [{ actor_kind: 'engine-cosign', guard_chain_required: ['content-scan'] }],
    decision_consumers: [],
    derivation_rule: { can_summarize_to: [MemoryTier.DECISION_SUPPORT, MemoryTier.CONTEXT_ONLY], can_index_into: [] },
    revocation_path: 'adr://kill',
    ...overrides,
  };
}

function makePlan(overrides: Partial<MemoryAssemblyPlan> = {}): MemoryAssemblyPlan {
  return {
    plan_id: 'plan-1',
    intended_for: 'decision',
    retrieval_specs: [
      { provider_id: 'loamwise:align.retrieval', tiers: [MemoryTier.DECISION_SUPPORT], query_template: 'q', max_results: 10 },
    ],
    assembly_order: [
      { step: 'system-prompt', fragments: ['rec-1'], fence_boundary: null },
    ],
    write_specs: [
      { target_tier: MemoryTier.DECISION_SUPPORT, content_kind: 'summary.session', use_policy_id: 'pol-ds' },
    ],
    created_at: '2026-04-17T00:00:00Z',
    expires_at: '2099-01-01T00:00:00Z',
    frozen: false,
    ...overrides,
  };
}

describe('MemoryPlanRegistry — register', () => {
  let policies: MemoryUsePolicyRegistry;
  let plans: MemoryPlanRegistry;

  beforeEach(() => {
    policies = new MemoryUsePolicyRegistry();
    policies.register(makePolicy());
    plans = new MemoryPlanRegistry(policies);
  });

  it('accepts a plan with a known policy and matching tier', () => {
    expect(plans.register(makePlan()).ok).toBe(true);
  });

  it('rejects plan with unknown use_policy_id', () => {
    const r = plans.register(makePlan({
      write_specs: [{ target_tier: MemoryTier.DECISION_SUPPORT, content_kind: 'x', use_policy_id: 'no-such' }],
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('UNKNOWN_USE_POLICY');
  });

  it('rejects plan whose write_specs.target_tier differs from the policy tier', () => {
    const r = plans.register(makePlan({
      write_specs: [{ target_tier: MemoryTier.CONTEXT_ONLY, content_kind: 'x', use_policy_id: 'pol-ds' }],
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('WRITE_SPEC_TIER_MISMATCH');
  });

  it('rejects plan that arrives already frozen=true', () => {
    const r = plans.register(makePlan({ frozen: true }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PLAN_ALREADY_FROZEN_AT_REGISTER');
  });

  it('rejects duplicate plan_id', () => {
    expect(plans.register(makePlan()).ok).toBe(true);
    const r = plans.register(makePlan());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DUPLICATE_PLAN_ID');
  });
});

describe('MemoryPlanRegistry — freeze + immutability (O5)', () => {
  let policies: MemoryUsePolicyRegistry;
  let plans: MemoryPlanRegistry;

  beforeEach(() => {
    policies = new MemoryUsePolicyRegistry();
    policies.register(makePolicy());
    plans = new MemoryPlanRegistry(policies);
  });

  it('freeze flips frozen=true; double freeze rejected', () => {
    plans.register(makePlan());
    const r1 = plans.freeze('plan-1');
    expect(r1.ok).toBe(true);
    expect(plans.isFrozen('plan-1')).toBe(true);

    const r2 = plans.freeze('plan-1');
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.code).toBe('PLAN_ALREADY_FROZEN');
  });

  it('frozen plan is deep-Object.frozen — in-place mutation throws in strict mode', () => {
    plans.register(makePlan());
    plans.freeze('plan-1');
    const plan = plans.lookup('plan-1')!;
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.retrieval_specs)).toBe(true);
    expect(Object.isFrozen(plan.assembly_order)).toBe(true);

    // Assignment attempts are silently ignored OR throw depending on
    // strict mode; we assert via isFrozen + verifying the value didn't
    // actually change after the attempt.
    try { (plan as unknown as { frozen: boolean }).frozen = false; } catch { /* strict mode */ }
    expect(plan.frozen).toBe(true);
  });

  it('rejects freeze on unknown plan', () => {
    const r = plans.freeze('nope');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PLAN_NOT_FOUND');
  });

  it('rejects freeze on expired plan', () => {
    plans.register(makePlan({ plan_id: 'plan-exp', expires_at: '2000-01-01T00:00:00Z' }));
    const r = plans.freeze('plan-exp');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PLAN_EXPIRED');
  });
});

describe('buildFrozenSnapshot', () => {
  function frag(tier: MemoryTier, rank: number, record_id = `r-${tier}-${rank}`): RetrievalFragment {
    return {
      record: {
        record_id,
        tier,
        content_kind: 'x',
        content_hash: 'sha256:' + 'b'.repeat(64),
        source: { provider_id: 'p', layer: 1, upstream_ref: null, trace_id: 't' },
        created_at: '2026-04-17T00:00:00Z',
        guard_evidence: [{ evidence_id: 'ev', guard_kind: 'content-scan', verdict: 'safe' }],
        redaction_applied: false,
        payload: null,
      },
      rank_in_tier: rank,
      match_evidence: 'why',
    };
  }

  it('sorts strict-truth: authoritative → decision-support → context-only', () => {
    const snap = buildFrozenSnapshot('plan-1', [
      frag(MemoryTier.CONTEXT_ONLY, 0),
      frag(MemoryTier.AUTHORITATIVE, 1),
      frag(MemoryTier.DECISION_SUPPORT, 0),
      frag(MemoryTier.AUTHORITATIVE, 0),
    ]);
    const tiers = snap.fragments.map((f) => f.record.tier);
    expect(tiers).toEqual([
      MemoryTier.AUTHORITATIVE,
      MemoryTier.AUTHORITATIVE,
      MemoryTier.DECISION_SUPPORT,
      MemoryTier.CONTEXT_ONLY,
    ]);
    // within a tier: ascending rank_in_tier
    expect(snap.fragments[0].rank_in_tier).toBe(0);
    expect(snap.fragments[1].rank_in_tier).toBe(1);
  });

  it('fragments array is immutable', () => {
    const snap = buildFrozenSnapshot('plan-1', [frag(MemoryTier.AUTHORITATIVE, 0)]);
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.fragments)).toBe(true);
    expect(() => {
      (snap.fragments as unknown as RetrievalFragment[]).push(frag(MemoryTier.CONTEXT_ONLY, 0));
    }).toThrow();
  });
});
