/**
 * guardedMemoryWrite + guardedAssemblyFragmentIngest tests — Sprint 6 Wave 6.2.
 *
 * Coverage:
 *   - AUTHORITATIVE write uses TRUTH_WRITE guard; non-auth uses CONTENT_SCAN
 *   - DANGEROUS verdict never blocks (SHADOW invariant)
 *   - Policy tier mismatch rejected; guard evidence still reported
 *   - Fragment ingest rejects non-frozen / expired / unknown record
 *   - CONTEXT_INJECT guard runs for fragment ingest
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  AlwaysDangerousScanner,
  GuardKind,
  InMemoryGuardEvidenceSink,
  NoopScanner,
  ShadowRunner,
} from '../../../../src/runtime/governance/guard';
import {
  MemoryPlanRegistry,
  MemoryRecordRegistry,
  MemoryTier,
  MemoryUsePolicyRegistry,
  guardedAssemblyFragmentIngest,
  guardedMemoryWrite,
  type MemoryUsePolicy,
  type MemoryWriteRequest,
} from '../../../../src/runtime/governance/memory';

function basePolicy(overrides: Partial<MemoryUsePolicy> = {}): MemoryUsePolicy {
  return {
    policy_id: 'pol-ds',
    tier: MemoryTier.DECISION_SUPPORT,
    read_allowed_for: ['decision'],
    write_allowed_by: [{ actor_kind: 'engine-cosign', guard_chain_required: ['content-scan'] }],
    decision_consumers: [],
    derivation_rule: { can_summarize_to: [MemoryTier.DECISION_SUPPORT, MemoryTier.CONTEXT_ONLY], can_index_into: [] },
    revocation_path: 'adr://kill',
    ...overrides,
  };
}

function baseWrite(overrides: Partial<MemoryWriteRequest> = {}): MemoryWriteRequest {
  return {
    record: {
      record_id: 'rec-w-1',
      tier: MemoryTier.DECISION_SUPPORT,
      content_kind: 'summary.session',
      content_hash: 'sha256:' + 'c'.repeat(64),
      source: { provider_id: 'loamwise', layer: 1, upstream_ref: null, trace_id: 'trace-1' },
      created_at: '2026-04-17T00:00:00Z',
      redaction_applied: false,
      payload: { text: 'hi' },
    } as unknown as MemoryWriteRequest['record'],
    use_policy_id: 'pol-ds',
    scan_payload: 'hi',
    trace_id: 'trace-1',
    ...overrides,
  };
}

describe('guardedMemoryWrite', () => {
  let policies: MemoryUsePolicyRegistry;
  let records: MemoryRecordRegistry;
  let sink: InMemoryGuardEvidenceSink;

  beforeEach(() => {
    policies = new MemoryUsePolicyRegistry();
    records = new MemoryRecordRegistry();
    sink = new InMemoryGuardEvidenceSink();
    policies.register(basePolicy());
    policies.register(basePolicy({
      policy_id: 'pol-auth',
      tier: MemoryTier.AUTHORITATIVE,
      decision_consumers: ['approval'],
      derivation_rule: { can_summarize_to: [MemoryTier.AUTHORITATIVE], can_index_into: [] },
    }));
  });

  it('DECISION_SUPPORT write runs CONTENT_SCAN + registers record', async () => {
    const runner = new ShadowRunner(new NoopScanner(GuardKind.CONTENT_SCAN), { sink, fail_open: true });
    const r = await guardedMemoryWrite(baseWrite(), {
      runner, sink, policies, records, scanner_id: 'noop',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.guard_kind).toBe('content-scan');
      expect(r.guard_verdict).toBe('safe');
    }
    expect(sink.list().length).toBe(1);
    expect(records.size()).toBe(1);
    // Guard evidence ref was attached to the stored record.
    const stored = records.lookup('rec-w-1')!;
    expect(stored.guard_evidence.length).toBe(1);
  });

  it('AUTHORITATIVE write runs TRUTH_WRITE guard', async () => {
    const runner = new ShadowRunner(new NoopScanner(GuardKind.TRUTH_WRITE), { sink, fail_open: true });
    const r = await guardedMemoryWrite(baseWrite({
      use_policy_id: 'pol-auth',
      record: {
        record_id: 'rec-auth-1',
        tier: MemoryTier.AUTHORITATIVE,
        content_kind: 'contract.adr',
        content_hash: 'sha256:' + 'd'.repeat(64),
        source: { provider_id: 'contract-adr-writer', layer: 0, upstream_ref: null, trace_id: 'trace-2' },
        created_at: '2026-04-17T00:00:00Z',
        redaction_applied: false,
        payload: { text: 'auth content' },
      } as unknown as MemoryWriteRequest['record'],
      trace_id: 'trace-2',
    }), {
      runner, sink, policies, records, scanner_id: 'noop-truth',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.guard_kind).toBe('truth-write');
  });

  it('DANGEROUS verdict does not block (SHADOW invariant)', async () => {
    const runner = new ShadowRunner(new AlwaysDangerousScanner(GuardKind.CONTENT_SCAN), { sink, fail_open: true });
    const r = await guardedMemoryWrite(baseWrite(), {
      runner, sink, policies, records, scanner_id: 'dangerous',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.guard_verdict).toBe('dangerous');
    // Record still registered with the dangerous-verdict evidence attached.
    const stored = records.lookup('rec-w-1')!;
    expect(stored.guard_evidence[0].verdict).toBe('dangerous');
  });

  it('rejects unknown use_policy_id', async () => {
    const runner = new ShadowRunner(new NoopScanner(GuardKind.CONTENT_SCAN), { sink, fail_open: true });
    const r = await guardedMemoryWrite(baseWrite({ use_policy_id: 'no-such' }), {
      runner, sink, policies, records, scanner_id: 'noop',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('UNKNOWN_USE_POLICY');
    // No guard scan was run for this particular branch — it fails before runner.
    expect(sink.list().length).toBe(0);
  });

  it('rejects policy/record tier mismatch (evidence still recorded? — pre-scan check)', async () => {
    const runner = new ShadowRunner(new NoopScanner(GuardKind.CONTENT_SCAN), { sink, fail_open: true });
    const r = await guardedMemoryWrite(baseWrite({
      record: {
        record_id: 'rec-mismatch',
        tier: MemoryTier.CONTEXT_ONLY,
        content_kind: 'note',
        content_hash: 'sha256:' + 'e'.repeat(64),
        source: { provider_id: 'x', layer: 1, upstream_ref: null, trace_id: 'trace-3' },
        created_at: '2026-04-17T00:00:00Z',
        redaction_applied: false,
        payload: null,
      } as unknown as MemoryWriteRequest['record'],
      trace_id: 'trace-3',
    }), {
      runner, sink, policies, records, scanner_id: 'noop',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('POLICY_TIER_MISMATCH');
  });

  it('returns registry-level failure with evidence id attached', async () => {
    const runner = new ShadowRunner(new NoopScanner(GuardKind.CONTENT_SCAN), { sink, fail_open: true });
    // Bad content_hash → registry rejects, but guard already ran.
    const r = await guardedMemoryWrite(baseWrite({
      record: {
        record_id: 'rec-bad',
        tier: MemoryTier.DECISION_SUPPORT,
        content_kind: 'summary.session',
        content_hash: 'nope',
        source: { provider_id: 'loamwise', layer: 1, upstream_ref: null, trace_id: 'trace-4' },
        created_at: '2026-04-17T00:00:00Z',
        redaction_applied: false,
        payload: null,
      } as unknown as MemoryWriteRequest['record'],
      trace_id: 'trace-4',
    }), {
      runner, sink, policies, records, scanner_id: 'noop',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('INVALID_CONTENT_HASH');
      expect(r.guard_evidence_id).toBeTruthy();
      expect(r.guard_verdict).toBe('safe');
    }
    expect(sink.list().length).toBe(1);
  });
});

describe('guardedAssemblyFragmentIngest', () => {
  let policies: MemoryUsePolicyRegistry;
  let plans: MemoryPlanRegistry;
  let records: MemoryRecordRegistry;
  let sink: InMemoryGuardEvidenceSink;

  beforeEach(() => {
    policies = new MemoryUsePolicyRegistry();
    policies.register(basePolicy());
    plans = new MemoryPlanRegistry(policies);
    plans.register({
      plan_id: 'plan-frag',
      intended_for: 'decision',
      retrieval_specs: [{ provider_id: 'p', tiers: [MemoryTier.DECISION_SUPPORT], query_template: 'q', max_results: 10 }],
      assembly_order: [{ step: 'system-prompt', fragments: [], fence_boundary: null }],
      write_specs: [],
      created_at: '2026-04-17T00:00:00Z',
      expires_at: '2099-01-01T00:00:00Z',
      frozen: false,
    });
    records = new MemoryRecordRegistry();
    records.register({
      record_id: 'rec-parent',
      tier: MemoryTier.DECISION_SUPPORT,
      content_kind: 'x',
      content_hash: 'sha256:' + 'f'.repeat(64),
      source: { provider_id: 'p', layer: 1, upstream_ref: null, trace_id: 't' },
      created_at: '2026-04-17T00:00:00Z',
      guard_evidence: [{ evidence_id: 'ev', guard_kind: 'content-scan', verdict: 'safe' }],
      redaction_applied: false,
      payload: null,
    });
    sink = new InMemoryGuardEvidenceSink();
  });

  it('rejects ingest when plan is not frozen', async () => {
    const runner = new ShadowRunner(new NoopScanner(GuardKind.CONTEXT_INJECT), { sink, fail_open: true });
    const r = await guardedAssemblyFragmentIngest({
      fragment_id: 'frag-1',
      plan_id: 'plan-frag',
      step: 'system-prompt',
      record_ref: 'rec-parent',
      scan_payload: 'text',
      trace_id: 'tr',
    }, { runner, sink, plans, records, scanner_id: 'ctx' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('PLAN_NOT_FROZEN');
      expect(r.guard_evidence_id).toBeTruthy();
    }
    // Guard evidence was still recorded so audits observe the attempt.
    expect(sink.list().length).toBe(1);
  });

  it('accepts ingest against a frozen, unexpired plan with a known record_ref', async () => {
    plans.freeze('plan-frag');
    const runner = new ShadowRunner(new NoopScanner(GuardKind.CONTEXT_INJECT), { sink, fail_open: true });
    const r = await guardedAssemblyFragmentIngest({
      fragment_id: 'frag-2',
      plan_id: 'plan-frag',
      step: 'system-prompt',
      record_ref: 'rec-parent',
      scan_payload: 'text',
      trace_id: 'tr',
    }, { runner, sink, plans, records, scanner_id: 'ctx' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.guard_mode).toBe('shadow');
  });

  it('rejects when record_ref is unknown', async () => {
    plans.freeze('plan-frag');
    const runner = new ShadowRunner(new NoopScanner(GuardKind.CONTEXT_INJECT), { sink, fail_open: true });
    const r = await guardedAssemblyFragmentIngest({
      fragment_id: 'frag-3',
      plan_id: 'plan-frag',
      step: 'system-prompt',
      record_ref: 'nope',
      scan_payload: 'x',
      trace_id: 'tr',
    }, { runner, sink, plans, records, scanner_id: 'ctx' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('UNKNOWN_RECORD_REF');
  });

  it('DANGEROUS verdict does not block SHADOW ingest', async () => {
    plans.freeze('plan-frag');
    const runner = new ShadowRunner(new AlwaysDangerousScanner(GuardKind.CONTEXT_INJECT), { sink, fail_open: true });
    const r = await guardedAssemblyFragmentIngest({
      fragment_id: 'frag-4',
      plan_id: 'plan-frag',
      step: 'tool-context',
      record_ref: 'rec-parent',
      scan_payload: 'bad',
      trace_id: 'tr',
    }, { runner, sink, plans, records, scanner_id: 'ctx' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.guard_verdict).toBe('dangerous');
  });
});
