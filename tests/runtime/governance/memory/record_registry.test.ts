/**
 * MemoryRecordRegistry tests — Sprint 6 Wave 6.1.
 *
 * Coverage:
 *   - Layer 3 cannot write memory (explicit code)
 *   - content_hash format validation
 *   - mandatory guard_evidence / trace_id
 *   - O3 derivation: derived record may not elevate tier
 *   - tierRank / canDeriveTo helpers
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  MemoryRecordRegistry,
  MemoryTier,
  canDeriveTo,
  tierRank,
  type MemoryRecord,
} from '../../../../src/runtime/governance/memory';

function makeRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    record_id: 'rec-1',
    tier: MemoryTier.DECISION_SUPPORT,
    content_kind: 'summary.session',
    content_hash: 'sha256:' + 'a'.repeat(64),
    source: {
      provider_id: 'loamwise:align.retrieval',
      layer: 1,
      upstream_ref: null,
      trace_id: 'trace-1',
    },
    created_at: '2026-04-17T00:00:00Z',
    guard_evidence: [{ evidence_id: 'ev-1', guard_kind: 'content-scan', verdict: 'safe' }],
    redaction_applied: false,
    payload: { text: 'hello' },
    ...overrides,
  };
}

describe('tierRank + canDeriveTo', () => {
  it('ranks authoritative < decision-support < context-only', () => {
    expect(tierRank(MemoryTier.AUTHORITATIVE)).toBe(0);
    expect(tierRank(MemoryTier.DECISION_SUPPORT)).toBe(1);
    expect(tierRank(MemoryTier.CONTEXT_ONLY)).toBe(2);
  });

  it('canDeriveTo prevents tier elevation', () => {
    expect(canDeriveTo(MemoryTier.DECISION_SUPPORT, MemoryTier.AUTHORITATIVE)).toBe(false);
    expect(canDeriveTo(MemoryTier.DECISION_SUPPORT, MemoryTier.DECISION_SUPPORT)).toBe(true);
    expect(canDeriveTo(MemoryTier.DECISION_SUPPORT, MemoryTier.CONTEXT_ONLY)).toBe(true);
    expect(canDeriveTo(MemoryTier.CONTEXT_ONLY, MemoryTier.AUTHORITATIVE)).toBe(false);
  });
});

describe('MemoryRecordRegistry — structural rules', () => {
  let reg: MemoryRecordRegistry;
  beforeEach(() => { reg = new MemoryRecordRegistry(); });

  it('accepts a valid Layer 1 record', () => {
    expect(reg.register(makeRecord()).ok).toBe(true);
  });

  it('rejects Layer 3 writer (specific code)', () => {
    const r = reg.register(makeRecord({
      source: { provider_id: 'products', layer: 3 as unknown as 2, upstream_ref: null, trace_id: 'trace-x' },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('LAYER_3_CANNOT_WRITE_MEMORY');
  });

  it('rejects invalid content_hash', () => {
    const r = reg.register(makeRecord({ content_hash: 'nope' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_CONTENT_HASH');
  });

  it('rejects empty guard_evidence', () => {
    const r = reg.register(makeRecord({ guard_evidence: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MISSING_GUARD_EVIDENCE');
  });

  it('rejects missing trace_id', () => {
    const r = reg.register(makeRecord({
      source: { provider_id: 'x', layer: 1, upstream_ref: null, trace_id: '' },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MISSING_TRACE_ID');
  });

  it('rejects duplicate record_id', () => {
    expect(reg.register(makeRecord()).ok).toBe(true);
    const r = reg.register(makeRecord());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DUPLICATE_RECORD_ID');
  });
});

describe('MemoryRecordRegistry — O3 derivation cannot elevate tier', () => {
  let reg: MemoryRecordRegistry;
  beforeEach(() => { reg = new MemoryRecordRegistry(); });

  it('rejects DECISION_SUPPORT upstream → AUTHORITATIVE derived (elevation)', () => {
    expect(reg.register(makeRecord({
      record_id: 'parent',
      tier: MemoryTier.DECISION_SUPPORT,
    })).ok).toBe(true);
    const r = reg.register(makeRecord({
      record_id: 'derived',
      tier: MemoryTier.AUTHORITATIVE,
      source: {
        provider_id: 'loamwise:align.retrieval',
        layer: 1,
        upstream_ref: 'parent',
        trace_id: 'trace-2',
      },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DERIVATION_ELEVATES_TIER');
  });

  it('accepts same-tier derivation', () => {
    expect(reg.register(makeRecord({
      record_id: 'parent2',
      tier: MemoryTier.DECISION_SUPPORT,
    })).ok).toBe(true);
    const r = reg.register(makeRecord({
      record_id: 'derived2',
      tier: MemoryTier.DECISION_SUPPORT,
      source: {
        provider_id: 'loamwise:align.retrieval',
        layer: 1,
        upstream_ref: 'parent2',
        trace_id: 'trace-3',
      },
    }));
    expect(r.ok).toBe(true);
  });

  it('accepts descent from AUTHORITATIVE to DECISION_SUPPORT', () => {
    expect(reg.register(makeRecord({
      record_id: 'auth-parent',
      tier: MemoryTier.AUTHORITATIVE,
    })).ok).toBe(true);
    const r = reg.register(makeRecord({
      record_id: 'desc',
      tier: MemoryTier.DECISION_SUPPORT,
      source: {
        provider_id: 'loamwise:align.retrieval',
        layer: 1,
        upstream_ref: 'auth-parent',
        trace_id: 'trace-4',
      },
    }));
    expect(r.ok).toBe(true);
  });

  it('rejects unknown upstream_ref', () => {
    const r = reg.register(makeRecord({
      source: {
        provider_id: 'x',
        layer: 1,
        upstream_ref: 'does-not-exist',
        trace_id: 'trace-5',
      },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('UNKNOWN_UPSTREAM_REF');
  });
});
