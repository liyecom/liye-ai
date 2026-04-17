/**
 * StreamRegistry tests — Sprint 1 Wave 1.1.
 *
 * Coverage target:
 *   - registerStream() accepts F1-compliant streams.
 *   - registerStream() rejects non-hash-chained streams.
 *   - registerProvisionalStream() accepts hash_chained=false.
 *   - Duplicate stream_id rejection.
 *   - Invalid owner layer rejection (0 and 3 forbidden).
 *   - Missing ADR reference rejection.
 *   - lookupStream() round-trip.
 *   - listStreams() filter semantics (owner, scope_kind, f1_compliant_only).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StreamRegistry, type SessionEventStream } from '../../../../src/runtime/governance/session';

function makeF1Stream(overrides: Partial<SessionEventStream> = {}): SessionEventStream {
  return {
    stream_id: 'loamwise.orchestrator.trace.test-1',
    owner: { component_id: 'loamwise.orchestrator', layer: 1 },
    scope: { scope_kind: 'orchestrator-trace', scope_keys: { trace_id: 'trace-abc' } },
    format: 'ndjson.append',
    storage_location: '/tmp/test.jsonl',
    retention: { min_retention_days: 30, immutable_after_days: null, delete_after_days: null },
    is_append_only: true,
    is_hash_chained: true,
    hash_alg: 'sha256',
    registered_at: '2026-04-17T00:00:00Z',
    registered_by_adr: 'ADR-Session-and-Session-Adjacent-Taxonomy-Federated-Query.md',
    ...overrides,
  };
}

function makeProvisionalStream(overrides: Partial<SessionEventStream> = {}): SessionEventStream {
  return makeF1Stream({ is_hash_chained: false, ...overrides });
}

describe('StreamRegistry — strict registration', () => {
  let reg: StreamRegistry;

  beforeEach(() => {
    reg = new StreamRegistry();
  });

  it('accepts an F1-compliant stream', () => {
    const s = makeF1Stream();
    const r = reg.registerStream(s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.stream_id).toBe(s.stream_id);
      expect(r.f1_compliant).toBe(true);
    }
    expect(reg.size()).toBe(1);
  });

  it('rejects a stream with is_hash_chained=false (strict path)', () => {
    const s = makeProvisionalStream();
    const r = reg.registerStream(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NOT_HASH_CHAINED_STRICT');
  });

  it('rejects duplicate stream_id', () => {
    const s = makeF1Stream();
    expect(reg.registerStream(s).ok).toBe(true);
    const r2 = reg.registerStream(s);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.code).toBe('DUPLICATE_STREAM_ID');
  });

  it('rejects invalid owner layer (layer 0 forbidden)', () => {
    const s = makeF1Stream({ owner: { component_id: 'x', layer: 0 as unknown as 1 } });
    const r = reg.registerStream(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_OWNER_LAYER');
  });

  it('rejects invalid owner layer (layer 3 forbidden)', () => {
    const s = makeF1Stream({ owner: { component_id: 'x', layer: 3 as unknown as 1 } });
    const r = reg.registerStream(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_OWNER_LAYER');
  });

  it('rejects missing registered_by_adr', () => {
    const s = makeF1Stream({ registered_by_adr: '' });
    const r = reg.registerStream(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MISSING_REGISTERED_BY_ADR');
  });

  it('rejects unsupported format', () => {
    const s = makeF1Stream({ format: 'unknown-format' as unknown as 'ndjson.append' });
    const r = reg.registerStream(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_FORMAT');
  });
});

describe('StreamRegistry — provisional registration (P1-e C4)', () => {
  let reg: StreamRegistry;

  beforeEach(() => {
    reg = new StreamRegistry();
  });

  it('accepts a stream with is_hash_chained=false via provisional path', () => {
    const s = makeProvisionalStream({ stream_id: 'engine.amazon-growth.onboarding.STR-E438213024' });
    const r = reg.registerProvisionalStream(s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.f1_compliant).toBe(false);
    }
    const entry = reg.lookupStream(s.stream_id);
    expect(entry?.provisional).toBe(true);
    expect(entry?.f1_compliant).toBe(false);
  });

  it('still enforces F1.1 (is_append_only) on provisional path', () => {
    const s = makeProvisionalStream({
      is_append_only: false as unknown as true,
    });
    const r = reg.registerProvisionalStream(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NOT_APPEND_ONLY');
  });

  it('still enforces Layer 1/2 ownership on provisional path', () => {
    const s = makeProvisionalStream({ owner: { component_id: 'x', layer: 3 as unknown as 1 } });
    const r = reg.registerProvisionalStream(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_OWNER_LAYER');
  });
});

describe('StreamRegistry — lookup & list', () => {
  let reg: StreamRegistry;

  beforeEach(() => {
    reg = new StreamRegistry();
  });

  it('lookupStream() returns entry with f1_compliant flag', () => {
    const s = makeF1Stream();
    reg.registerStream(s);
    const entry = reg.lookupStream(s.stream_id);
    expect(entry).not.toBeNull();
    expect(entry?.stream.stream_id).toBe(s.stream_id);
    expect(entry?.f1_compliant).toBe(true);
    expect(entry?.provisional).toBe(false);
  });

  it('lookupStream() returns null for unknown stream', () => {
    expect(reg.lookupStream('nonexistent')).toBeNull();
  });

  it('listStreams() filters by owner_component_id', () => {
    reg.registerStream(makeF1Stream({ stream_id: 's1', owner: { component_id: 'a', layer: 1 } }));
    reg.registerStream(makeF1Stream({ stream_id: 's2', owner: { component_id: 'b', layer: 1 } }));
    const hits = reg.listStreams({ owner_component_id: 'a' });
    expect(hits).toHaveLength(1);
    expect(hits[0].stream.stream_id).toBe('s1');
  });

  it('listStreams() filters by f1_compliant_only', () => {
    reg.registerStream(makeF1Stream({ stream_id: 's-f1' }));
    reg.registerProvisionalStream(makeProvisionalStream({ stream_id: 's-prov' }));
    const allHits = reg.listStreams({});
    const f1Hits = reg.listStreams({ f1_compliant_only: true });
    expect(allHits).toHaveLength(2);
    expect(f1Hits).toHaveLength(1);
    expect(f1Hits[0].stream.stream_id).toBe('s-f1');
  });

  it('listStreams() filters by scope_keys (partial match all keys)', () => {
    reg.registerStream(makeF1Stream({
      stream_id: 's-a',
      scope: { scope_kind: 'orchestrator-trace', scope_keys: { trace_id: 'trace-1', tenant: 't1' } },
    }));
    reg.registerStream(makeF1Stream({
      stream_id: 's-b',
      scope: { scope_kind: 'orchestrator-trace', scope_keys: { trace_id: 'trace-2', tenant: 't1' } },
    }));
    const hits = reg.listStreams({ scope_keys: { tenant: 't1' } });
    expect(hits).toHaveLength(2);
    const hits2 = reg.listStreams({ scope_keys: { trace_id: 'trace-1' } });
    expect(hits2).toHaveLength(1);
    expect(hits2[0].stream.stream_id).toBe('s-a');
  });
});
