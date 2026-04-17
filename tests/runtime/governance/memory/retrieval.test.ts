/**
 * validateRetrievalRequest tests — Sprint 6 Wave 6.1.
 *
 * Coverage:
 *   - tiers_allowed / providers_allowed must be explicit non-empty (O7)
 *   - strict_truth is default; balanced_recency requires audit purpose
 *   - plan must exist, be frozen, not expired
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_QUERY_MODE,
  MemoryPlanRegistry,
  MemoryTier,
  MemoryUsePolicyRegistry,
  validateRetrievalRequest,
  type MemoryRetrievalRequest,
} from '../../../../src/runtime/governance/memory';

function makeReq(overrides: Partial<MemoryRetrievalRequest> = {}): MemoryRetrievalRequest {
  return {
    request_id: 'req-1',
    query: 'find stuff',
    tiers_allowed: [MemoryTier.AUTHORITATIVE, MemoryTier.DECISION_SUPPORT],
    providers_allowed: ['loamwise:align.retrieval'],
    query_mode: 'strict_truth',
    max_fragments_per_tier: { [MemoryTier.AUTHORITATIVE]: 5 },
    triggered_by: { component: 'loamwise:align.orchestrator', purpose: 'decision', plan_id: 'plan-1' },
    ...overrides,
  };
}

describe('DEFAULT_QUERY_MODE', () => {
  it('is strict_truth', () => {
    expect(DEFAULT_QUERY_MODE).toBe('strict_truth');
  });
});

describe('validateRetrievalRequest', () => {
  let policies: MemoryUsePolicyRegistry;
  let plans: MemoryPlanRegistry;

  beforeEach(() => {
    policies = new MemoryUsePolicyRegistry();
    policies.register({
      policy_id: 'pol-ds',
      tier: MemoryTier.DECISION_SUPPORT,
      read_allowed_for: ['decision', 'audit'],
      write_allowed_by: [{ actor_kind: 'engine-cosign', guard_chain_required: ['content-scan'] }],
      decision_consumers: [],
      derivation_rule: { can_summarize_to: [MemoryTier.DECISION_SUPPORT, MemoryTier.CONTEXT_ONLY], can_index_into: [] },
      revocation_path: 'adr://kill',
    });
    plans = new MemoryPlanRegistry(policies);
    plans.register({
      plan_id: 'plan-1',
      intended_for: 'decision',
      retrieval_specs: [{ provider_id: 'loamwise:align.retrieval', tiers: [MemoryTier.DECISION_SUPPORT], query_template: 'q', max_results: 10 }],
      assembly_order: [{ step: 'system-prompt', fragments: [], fence_boundary: null }],
      write_specs: [],
      created_at: '2026-04-17T00:00:00Z',
      expires_at: '2099-01-01T00:00:00Z',
      frozen: false,
    });
    plans.freeze('plan-1');
  });

  it('accepts a valid strict_truth request against a frozen plan', () => {
    expect(validateRetrievalRequest(makeReq(), plans)).toEqual({ ok: true });
  });

  it('rejects empty tiers_allowed', () => {
    const r = validateRetrievalRequest(makeReq({ tiers_allowed: [] }), plans);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('TIERS_ALLOWED_EMPTY');
  });

  it('rejects empty providers_allowed (O7)', () => {
    const r = validateRetrievalRequest(makeReq({ providers_allowed: [] }), plans);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PROVIDERS_ALLOWED_EMPTY');
  });

  it('rejects invalid query_mode string', () => {
    const r = validateRetrievalRequest(makeReq({ query_mode: 'fast' as unknown as 'strict_truth' }), plans);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_QUERY_MODE');
  });

  it('rejects balanced_recency with purpose=decision', () => {
    const r = validateRetrievalRequest(makeReq({
      query_mode: 'balanced_recency',
      triggered_by: { component: 'x', purpose: 'decision', plan_id: 'plan-1' },
    }), plans);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('BALANCED_RECENCY_REQUIRES_AUDIT_PURPOSE');
  });

  it('accepts balanced_recency only when purpose=audit', () => {
    const r = validateRetrievalRequest(makeReq({
      query_mode: 'balanced_recency',
      triggered_by: { component: 'x', purpose: 'audit', plan_id: 'plan-1' },
    }), plans);
    expect(r.ok).toBe(true);
  });

  it('rejects unknown plan_id', () => {
    const r = validateRetrievalRequest(makeReq({
      triggered_by: { component: 'x', purpose: 'decision', plan_id: 'no-such' },
    }), plans);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PLAN_NOT_FOUND');
  });

  it('rejects non-frozen plan', () => {
    plans.register({
      plan_id: 'plan-open',
      intended_for: 'decision',
      retrieval_specs: [],
      assembly_order: [],
      write_specs: [],
      created_at: '2026-04-17T00:00:00Z',
      expires_at: '2099-01-01T00:00:00Z',
      frozen: false,
    });
    const r = validateRetrievalRequest(makeReq({
      triggered_by: { component: 'x', purpose: 'decision', plan_id: 'plan-open' },
    }), plans);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PLAN_NOT_FROZEN');
  });
});
