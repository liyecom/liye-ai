/**
 * guardedSubmitCandidate tests — Sprint 5 Wave 5.2.
 *
 * Coverage:
 *   - SHADOW guard runs + emits GuardEvidence before submit
 *   - DANGEROUS verdict never blocks (SHADOW non-blocking invariant)
 *   - Registry rejection still returns the guard evidence id
 *   - Scanner failure (fail_open) still produces evidence + allows submit
 *   - scan_results on the persisted record includes the guard evidence ref
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  CapabilityKindRegistry,
  type CapabilityKindRegistration,
} from '../../../../src/runtime/governance/capability';
import {
  AlwaysDangerousScanner,
  GuardKind,
  InMemoryGuardEvidenceSink,
  NoopScanner,
  ShadowRunner,
  type Scanner,
} from '../../../../src/runtime/governance/guard';
import {
  SkillLifecycleRegistry,
  SkillLifecycleState,
  TrustSource,
  guardedSubmitCandidate,
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
    candidate_id: 'cand-submit-1',
    skill_id: 'amazon-growth-engine:bid_recommend',
    version: '0.1.0',
    content_hash: 'sha256:' + 'b'.repeat(64),
    source_trace_id: 'trace-xyz',
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

class ThrowingScanner implements Scanner {
  readonly scanner_id = 'throwing';
  readonly scanner_version = '0.0.0';
  readonly pattern_catalog_version = '0.0.0';
  readonly supports_kind = GuardKind.CONTENT_SCAN;
  async scan(): Promise<never> {
    throw new Error('scanner-blew-up');
  }
}

describe('guardedSubmitCandidate', () => {
  let kinds: CapabilityKindRegistry;
  let registry: SkillLifecycleRegistry;
  let sink: InMemoryGuardEvidenceSink;

  beforeEach(() => {
    kinds = new CapabilityKindRegistry();
    kinds.register(KIND);
    registry = new SkillLifecycleRegistry(kinds);
    sink = new InMemoryGuardEvidenceSink();
  });

  it('accepts with SAFE verdict and records guard evidence', async () => {
    const runner = new ShadowRunner(
      new NoopScanner(GuardKind.CONTENT_SCAN, 'noop'),
      { sink, fail_open: true },
    );
    const r = await guardedSubmitCandidate(makeRecord(), {
      runner,
      sink,
      registry,
      trace_id: 'trace-xyz',
      payload: { body: 'hello world' },
      scanner_id: 'noop',
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.guard_verdict).toBe('safe');
      expect(r.guard_mode).toBe('shadow');
      expect(r.guard_evidence_id).toBeTruthy();
    }
    expect(sink.list().length).toBe(1);
    expect(registry.getState('cand-submit-1')).toBe(SkillLifecycleState.CANDIDATE);

    // scan_results on the persisted record contains the guard evidence ref
    const stored = registry.lookup('cand-submit-1')!;
    expect(stored.scan_results.length).toBe(1);
    expect(stored.scan_results[0].verdict).toBe('safe');
  });

  it('SHADOW never blocks even when scanner reports DANGEROUS', async () => {
    const runner = new ShadowRunner(
      new AlwaysDangerousScanner(GuardKind.CONTENT_SCAN, 'dangerous'),
      { sink, fail_open: true },
    );
    const r = await guardedSubmitCandidate(makeRecord(), {
      runner,
      sink,
      registry,
      trace_id: 'trace-xyz',
      payload: 'suspicious',
      scanner_id: 'dangerous',
    });

    expect(r.ok).toBe(true);        // SHADOW never blocks
    if (r.ok) {
      expect(r.guard_verdict).toBe('dangerous');
    }
    expect(sink.list().length).toBe(1);
    expect(sink.list()[0].verdict).toBe('dangerous');
    expect(registry.getState('cand-submit-1')).toBe(SkillLifecycleState.CANDIDATE);
  });

  it('returns registry failure but still reports guard evidence id', async () => {
    const runner = new ShadowRunner(
      new NoopScanner(GuardKind.CONTENT_SCAN, 'noop'),
      { sink, fail_open: true },
    );
    // Unknown capability_kind — registry will reject after guard runs.
    const r = await guardedSubmitCandidate(
      makeRecord({ capability_kind: 'engine.write.not-registered' }),
      {
        runner,
        sink,
        registry,
        trace_id: 'trace-xyz',
        payload: 'x',
        scanner_id: 'noop',
      },
    );

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('UNKNOWN_CAPABILITY_KIND');
      expect(r.guard_evidence_id).toBeTruthy();
      expect(r.guard_verdict).toBe('safe');
    }
    // Guard evidence is still written even when lifecycle rejects.
    expect(sink.list().length).toBe(1);
  });

  it('scanner exception is swallowed by fail_open and candidate still submits', async () => {
    const runner = new ShadowRunner(new ThrowingScanner(), { sink, fail_open: true });
    const r = await guardedSubmitCandidate(makeRecord(), {
      runner,
      sink,
      registry,
      trace_id: 'trace-xyz',
      payload: 'x',
      scanner_id: 'throwing',
    });

    expect(r.ok).toBe(true);
    expect(sink.list().length).toBe(1);
    expect(sink.list()[0].scanner_failed).toBe(true);
  });
});
