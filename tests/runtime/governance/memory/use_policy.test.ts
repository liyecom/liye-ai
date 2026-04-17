/**
 * MemoryUsePolicyRegistry tests — Sprint 6 Wave 6.1.
 *
 * Coverage:
 *   - §5 AUTHORITATIVE ⇒ decision_consumers non-empty
 *   - §5 non-AUTHORITATIVE ⇒ decision_consumers empty
 *   - O3 derivation rule may not elevate tier
 *   - duplicate policy_id rejected
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  MemoryTier,
  MemoryUsePolicyRegistry,
  type MemoryUsePolicy,
} from '../../../../src/runtime/governance/memory';

function makePolicy(overrides: Partial<MemoryUsePolicy> = {}): MemoryUsePolicy {
  return {
    policy_id: 'pol-1',
    tier: MemoryTier.DECISION_SUPPORT,
    read_allowed_for: ['decision', 'context', 'audit'],
    write_allowed_by: [
      { actor_kind: 'engine-cosign', guard_chain_required: ['content-scan'] },
    ],
    decision_consumers: [],
    derivation_rule: { can_summarize_to: [MemoryTier.DECISION_SUPPORT, MemoryTier.CONTEXT_ONLY], can_index_into: [] },
    revocation_path: 'ADR-kill-switch',
    ...overrides,
  };
}

describe('MemoryUsePolicyRegistry — §5 twin invariants', () => {
  let reg: MemoryUsePolicyRegistry;
  beforeEach(() => { reg = new MemoryUsePolicyRegistry(); });

  it('accepts AUTHORITATIVE with non-empty decision_consumers', () => {
    const r = reg.register(makePolicy({
      policy_id: 'pol-auth',
      tier: MemoryTier.AUTHORITATIVE,
      decision_consumers: ['capability.admission', 'approval'],
      derivation_rule: { can_summarize_to: [MemoryTier.AUTHORITATIVE], can_index_into: [] },
    }));
    expect(r.ok).toBe(true);
  });

  it('rejects AUTHORITATIVE with empty decision_consumers', () => {
    const r = reg.register(makePolicy({
      policy_id: 'pol-auth-bad',
      tier: MemoryTier.AUTHORITATIVE,
      decision_consumers: [],
      derivation_rule: { can_summarize_to: [MemoryTier.AUTHORITATIVE], can_index_into: [] },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('AUTHORITATIVE_MUST_DECLARE_DECISION_CONSUMERS');
  });

  it('rejects DECISION_SUPPORT with non-empty decision_consumers', () => {
    const r = reg.register(makePolicy({
      decision_consumers: ['approval'],
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NON_AUTH_MUST_HAVE_EMPTY_DECISION_CONSUMERS');
  });

  it('rejects CONTEXT_ONLY with non-empty decision_consumers', () => {
    const r = reg.register(makePolicy({
      tier: MemoryTier.CONTEXT_ONLY,
      decision_consumers: ['approval'],
      derivation_rule: { can_summarize_to: [MemoryTier.CONTEXT_ONLY], can_index_into: [] },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NON_AUTH_MUST_HAVE_EMPTY_DECISION_CONSUMERS');
  });
});

describe('MemoryUsePolicyRegistry — O3 derivation cannot elevate', () => {
  let reg: MemoryUsePolicyRegistry;
  beforeEach(() => { reg = new MemoryUsePolicyRegistry(); });

  it('rejects DECISION_SUPPORT policy with can_summarize_to AUTHORITATIVE', () => {
    const r = reg.register(makePolicy({
      derivation_rule: { can_summarize_to: [MemoryTier.AUTHORITATIVE], can_index_into: [] },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DERIVATION_CANNOT_ELEVATE_TIER');
  });

  it('rejects CONTEXT_ONLY policy with can_index_into DECISION_SUPPORT', () => {
    const r = reg.register(makePolicy({
      tier: MemoryTier.CONTEXT_ONLY,
      derivation_rule: { can_summarize_to: [MemoryTier.CONTEXT_ONLY], can_index_into: [MemoryTier.DECISION_SUPPORT] },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DERIVATION_CANNOT_ELEVATE_TIER');
  });

  it('accepts same-tier or lower-tier derivations', () => {
    const r = reg.register(makePolicy({
      tier: MemoryTier.DECISION_SUPPORT,
      derivation_rule: {
        can_summarize_to: [MemoryTier.DECISION_SUPPORT, MemoryTier.CONTEXT_ONLY],
        can_index_into: [MemoryTier.CONTEXT_ONLY],
      },
    }));
    expect(r.ok).toBe(true);
  });
});

describe('MemoryUsePolicyRegistry — misc guards', () => {
  let reg: MemoryUsePolicyRegistry;
  beforeEach(() => { reg = new MemoryUsePolicyRegistry(); });

  it('rejects duplicate policy_id', () => {
    expect(reg.register(makePolicy()).ok).toBe(true);
    const r = reg.register(makePolicy());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DUPLICATE_POLICY_ID');
  });

  it('rejects empty write_allowed_by', () => {
    const r = reg.register(makePolicy({ write_allowed_by: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('WRITE_ACTOR_RULES_EMPTY');
  });

  it('rejects invalid tier', () => {
    const r = reg.register(makePolicy({ tier: 'bogus' as unknown as MemoryTier }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_TIER');
  });
});
