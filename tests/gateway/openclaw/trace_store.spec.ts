/**
 * TraceStore Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { TraceStore } from '../../../src/gateway/openclaw/trace_store';

describe('TraceStore', () => {
  let tempDir: string;
  let store: TraceStore;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'trace-store-test-'));
    store = new TraceStore(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should initialize a new trace', async () => {
    await store.init('trace-123');
    expect(store.exists('trace-123')).toBe(true);
  });

  it('should append events with sequential seq numbers', async () => {
    const traceId = 'trace-456';
    await store.init(traceId);

    const event1 = await store.append(traceId, {
      ts: Date.now(),
      phase: 'gate',
      progress: 10,
      kind: 'info',
      message: 'First event',
    });

    const event2 = await store.append(traceId, {
      ts: Date.now(),
      phase: 'enforce',
      progress: 20,
      kind: 'info',
      message: 'Second event',
    });

    expect(event1.seq).toBe(0);
    expect(event2.seq).toBe(1);
  });

  it('should list events since a sequence number', async () => {
    const traceId = 'trace-789';
    await store.init(traceId);

    await store.append(traceId, {
      ts: Date.now(),
      phase: 'gate',
      progress: 10,
      kind: 'info',
    });

    await store.append(traceId, {
      ts: Date.now(),
      phase: 'enforce',
      progress: 20,
      kind: 'info',
    });

    await store.append(traceId, {
      ts: Date.now(),
      phase: 'route',
      progress: 30,
      kind: 'info',
    });

    const allEvents = await store.list(traceId);
    expect(allEvents.length).toBe(3);

    const sinceSeq1 = await store.list(traceId, 1);
    expect(sinceSeq1.length).toBe(2);
    expect(sinceSeq1[0].phase).toBe('enforce');
  });

  it('should set and get result', async () => {
    const traceId = 'trace-result';
    await store.init(traceId);

    const result = {
      decision: 'ALLOW',
      summary: 'Test completed',
    };

    await store.setResult(traceId, result);

    const trace = await store.get(traceId);
    expect(trace.result).toEqual(result);
  });

  it('should get events and result together', async () => {
    const traceId = 'trace-full';
    await store.init(traceId);

    await store.append(traceId, {
      ts: Date.now(),
      phase: 'gate',
      progress: 100,
      kind: 'info',
    });

    await store.setResult(traceId, { decision: 'ALLOW' });

    const trace = await store.get(traceId);
    expect(trace.events.length).toBe(1);
    expect(trace.result).toEqual({ decision: 'ALLOW' });
  });

  it('should return empty array for non-existent trace', async () => {
    const events = await store.list('non-existent');
    expect(events).toEqual([]);
  });

  it('should report non-existence correctly', () => {
    expect(store.exists('non-existent')).toBe(false);
  });
});
