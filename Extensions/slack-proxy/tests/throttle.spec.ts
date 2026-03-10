/**
 * Throttle Tests
 *
 * Tests for chunk throttling to prevent Slack rate limits.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createChunkThrottler,
  loadThrottleConfig,
  type ChunkInput,
} from '../src/util/throttle.js';

describe('createChunkThrottler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const makeInput = (phase: string, progress: number, isFinal = false): ChunkInput => ({
    traceId: 'trace-123',
    phase,
    progress,
    isFinal,
  });

  describe('phase change', () => {
    it('should pass first chunk', () => {
      const throttler = createChunkThrottler();
      const input = makeInput('gate', 0);

      const decision = throttler.decide(input);

      expect(decision.shouldUpdate).toBe(true);
      expect(decision.reason).toBe('phase_change');
    });

    it('should pass on phase change', () => {
      const throttler = createChunkThrottler();

      // First chunk
      throttler.decide(makeInput('gate', 50));

      // Immediate phase change should pass
      const decision = throttler.decide(makeInput('enforce', 0));

      expect(decision.shouldUpdate).toBe(true);
      expect(decision.reason).toBe('phase_change');
    });
  });

  describe('progress step', () => {
    it('should pass when progress crosses step boundary', () => {
      // Use high minIntervalMs to isolate progress step testing
      // Rule 6 triggers at 2x minIntervalMs, so we need to stay below that
      const throttler = createChunkThrottler({ progressStep: 10, minIntervalMs: 10000 });

      throttler.decide(makeInput('execute', 0));

      // Advance time just past minIntervalMs but not 2x (avoid Rule 6)
      vi.advanceTimersByTime(11000);

      // 5% should not pass (below step threshold)
      const decision5 = throttler.decide(makeInput('execute', 5));
      expect(decision5.shouldUpdate).toBe(false);
      expect(decision5.reason).toBe('dropped');

      // 10% should pass (crossed 10% boundary)
      vi.advanceTimersByTime(11000);
      const decision10 = throttler.decide(makeInput('execute', 10));
      expect(decision10.shouldUpdate).toBe(true);
      expect(decision10.reason).toBe('progress_step');
    });

    it('should pass when progress increases by full step', () => {
      const throttler = createChunkThrottler({ progressStep: 10, minIntervalMs: 10000 });

      throttler.decide(makeInput('execute', 10));

      // Advance time past minIntervalMs
      vi.advanceTimersByTime(11000);

      // 15% should not pass (only 5% delta, need 10%)
      const decision15 = throttler.decide(makeInput('execute', 15));
      expect(decision15.shouldUpdate).toBe(false);

      vi.advanceTimersByTime(11000);

      // 20% should pass (10% delta from last recorded progress)
      const decision20 = throttler.decide(makeInput('execute', 20));
      expect(decision20.shouldUpdate).toBe(true);
    });
  });

  describe('minimum interval', () => {
    it('should block rapid updates within interval', () => {
      const throttler = createChunkThrottler({ minIntervalMs: 1000 });

      // First passes (phase change)
      const first = throttler.decide(makeInput('execute', 0));
      expect(first.shouldUpdate).toBe(true);

      // Same phase, same progress step, within interval - should block
      vi.advanceTimersByTime(500);
      const second = throttler.decide(makeInput('execute', 5));
      expect(second.shouldUpdate).toBe(false);
    });

    it('should pass after extended interval elapsed', () => {
      const throttler = createChunkThrottler({ minIntervalMs: 1000 });

      throttler.decide(makeInput('execute', 0));

      // Advance past 2x interval (rule 6 in implementation)
      vi.advanceTimersByTime(2001);

      // Should pass now even without progress step
      const decision = throttler.decide(makeInput('execute', 1));
      expect(decision.shouldUpdate).toBe(true);
      expect(decision.reason).toBe('min_interval');
    });
  });

  describe('max updates per job', () => {
    it('should enforce max updates limit', () => {
      const throttler = createChunkThrottler({
        maxUpdatesPerJob: 3,
        minIntervalMs: 0,
        progressStep: 1,
      });

      // First 3 should pass (phase changes)
      expect(throttler.decide(makeInput('gate', 0)).shouldUpdate).toBe(true);
      expect(throttler.decide(makeInput('enforce', 0)).shouldUpdate).toBe(true);
      expect(throttler.decide(makeInput('route', 0)).shouldUpdate).toBe(true);

      // 4th should be blocked (max reached)
      const decision = throttler.decide(makeInput('execute', 0));
      expect(decision.shouldUpdate).toBe(false);
      expect(decision.reason).toBe('dropped');
    });
  });

  describe('complete/error chunks', () => {
    it('should always pass final chunks', () => {
      const throttler = createChunkThrottler({ maxUpdatesPerJob: 1 });

      // Exhaust limit
      throttler.decide(makeInput('gate', 0));

      // Final should still pass
      const decision = throttler.decide(makeInput('verdict', 100, true));
      expect(decision.shouldUpdate).toBe(true);
      expect(decision.reason).toBe('forced_final');
    });

    it('should always pass error chunks (isFinal)', () => {
      const throttler = createChunkThrottler({ maxUpdatesPerJob: 1 });

      // Exhaust limit
      throttler.decide(makeInput('gate', 0));

      // Error (isFinal=true) should still pass
      const decision = throttler.decide(makeInput('execute', 50, true));
      expect(decision.shouldUpdate).toBe(true);
      expect(decision.reason).toBe('forced_final');
    });
  });

  describe('reset', () => {
    it('should reset throttler state for a trace', () => {
      const throttler = createChunkThrottler({ maxUpdatesPerJob: 2 });

      throttler.decide(makeInput('gate', 0));
      throttler.decide(makeInput('enforce', 0));

      // Max reached
      const blocked = throttler.decide(makeInput('route', 0));
      expect(blocked.shouldUpdate).toBe(false);

      // Reset
      throttler.reset('trace-123');

      // Should pass again
      const after = throttler.decide(makeInput('gate', 0));
      expect(after.shouldUpdate).toBe(true);
    });
  });

  describe('getState', () => {
    it('should return job state', () => {
      const throttler = createChunkThrottler();

      throttler.decide(makeInput('gate', 50));

      const state = throttler.getState('trace-123');

      expect(state).toBeDefined();
      expect(state?.lastPhase).toBe('gate');
      expect(state?.lastProgress).toBe(50);
      expect(state?.updateCount).toBe(1);
    });

    it('should return undefined for unknown trace', () => {
      const throttler = createChunkThrottler();

      const state = throttler.getState('unknown-trace');

      expect(state).toBeUndefined();
    });
  });
});

describe('loadThrottleConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use default values', () => {
    delete process.env.SLACK_UPDATE_MIN_INTERVAL_MS;
    delete process.env.SLACK_PROGRESS_STEP;
    delete process.env.SLACK_MAX_UPDATES_PER_JOB;

    const config = loadThrottleConfig();

    expect(config.minIntervalMs).toBe(900);
    expect(config.progressStep).toBe(10);
    expect(config.maxUpdatesPerJob).toBe(30);
  });

  it('should read from environment', () => {
    process.env.SLACK_UPDATE_MIN_INTERVAL_MS = '500';
    process.env.SLACK_PROGRESS_STEP = '5';
    process.env.SLACK_MAX_UPDATES_PER_JOB = '20';

    const config = loadThrottleConfig();

    expect(config.minIntervalMs).toBe(500);
    expect(config.progressStep).toBe(5);
    expect(config.maxUpdatesPerJob).toBe(20);
  });
});
