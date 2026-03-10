/**
 * JobRunner Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { TraceStore } from '../../../src/gateway/openclaw/trace_store';
import { runGovernedToolCall } from '../../../src/gateway/openclaw/job_runner';
import type {
  GovToolCallRequestV1,
  StreamChunkV1,
  AgeJobStatus,
} from '../../../src/gateway/openclaw/types';

// Mock AGE client
vi.mock('../../../src/gateway/openclaw/age_job_client', () => ({
  ageCreateJob: vi.fn(),
  ageGetJob: vi.fn(),
  ageGetJobResult: vi.fn(),
}));

import {
  ageCreateJob,
  ageGetJob,
  ageGetJobResult,
} from '../../../src/gateway/openclaw/age_job_client';

const mockAgeCreateJob = vi.mocked(ageCreateJob);
const mockAgeGetJob = vi.mocked(ageGetJob);
const mockAgeGetJobResult = vi.mocked(ageGetJobResult);

describe('runGovernedToolCall', () => {
  let tempDir: string;
  let traceStore: TraceStore;

  const validRequest: GovToolCallRequestV1 = {
    version: 'GOV_TOOL_CALL_REQUEST_V1',
    trace_id: 'test-trace-123',
    idempotency_key: 'idem-123',
    tenant_id: 'slack:T123',
    task: 'Analyze wasted spend',
    policy_version: 'phase1-v1.0.0',
    proposed_actions: [
      {
        action_type: 'read',
        tool: 'amazon://strategy/wasted-spend-detect',
        arguments: {
          start_date: '2024-01-01',
          end_date: '2024-01-07',
        },
      },
    ],
    context: {
      source: 'openclaw',
      channel: 'slack',
      session_id: 'sess-123',
      user_id: 'user-123',
      message_id: 'msg-123',
    },
  };

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'job-runner-test-'));
    traceStore = new TraceStore(tempDir);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should block requests with invalid action_type', async () => {
    const invalidRequest = {
      ...validRequest,
      proposed_actions: [
        {
          action_type: 'write' as const,
          tool: 'amazon://strategy/wasted-spend-detect' as const,
          arguments: { start_date: '2024-01-01', end_date: '2024-01-07' },
        },
      ],
    };

    const chunks: StreamChunkV1[] = [];
    const generator = runGovernedToolCall(invalidRequest as GovToolCallRequestV1, {
      trace: traceStore,
      ageConfig: { baseUrl: 'http://localhost:8765', timeoutMs: 30000 },
    });

    let result;
    for await (const chunk of generator) {
      chunks.push(chunk);
      if (chunk.type === 'complete') {
        result = chunk.data;
      }
    }

    expect(result).toBeDefined();
    expect((result as any).decision).toBe('BLOCK');
    expect(chunks.some((c) => c.phase === 'gate')).toBe(true);
  });

  it('should block requests with unsupported tool', async () => {
    const invalidRequest = {
      ...validRequest,
      proposed_actions: [
        {
          action_type: 'read' as const,
          tool: 'amazon://strategy/unknown-tool' as const,
          arguments: { start_date: '2024-01-01', end_date: '2024-01-07' },
        },
      ],
    };

    const chunks: StreamChunkV1[] = [];
    const generator = runGovernedToolCall(invalidRequest as any, {
      trace: traceStore,
      ageConfig: { baseUrl: 'http://localhost:8765', timeoutMs: 30000 },
    });

    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    const completeChunk = chunks.find((c) => c.type === 'complete');
    expect(completeChunk?.data).toBeDefined();
    expect((completeChunk?.data as any).decision).toBe('BLOCK');
  });

  it('should process valid request through all phases', async () => {
    // Mock AGE responses
    mockAgeCreateJob.mockResolvedValue({ job_id: 'job-123' });

    const doneStatus: AgeJobStatus = {
      job_id: 'job-123',
      status: 'done',
      progress: 100,
      events: [
        {
          seq: 0,
          ts: new Date().toISOString(),
          phase: 'execute',
          progress: 50,
          message: 'Processing',
          data: {},
        },
      ],
    };
    mockAgeGetJob.mockResolvedValue(doneStatus);

    mockAgeGetJobResult.mockResolvedValue({
      job_id: 'job-123',
      status: 'done',
      result: {
        summary: { total_wasted: 100 },
        wasted_spend: [],
        evidence: { report_ids: ['rpt-1'] },
      },
    });

    const chunks: StreamChunkV1[] = [];
    const generator = runGovernedToolCall(validRequest, {
      trace: traceStore,
      ageConfig: { baseUrl: 'http://localhost:8765', timeoutMs: 30000 },
    });

    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    // Verify all phases are present
    const phases = chunks.map((c) => c.phase);
    expect(phases).toContain('gate');
    expect(phases).toContain('enforce');
    expect(phases).toContain('route');
    expect(phases).toContain('execute');
    expect(phases).toContain('verdict');

    // Verify progress is monotonically increasing
    const progresses = chunks.map((c) => c.progress);
    for (let i = 1; i < progresses.length; i++) {
      expect(progresses[i]).toBeGreaterThanOrEqual(progresses[i - 1]);
    }

    // Verify final chunk
    const completeChunk = chunks.find((c) => c.type === 'complete');
    expect(completeChunk).toBeDefined();
    expect((completeChunk?.data as any).decision).toBe('ALLOW');
  });

  it('should handle AGE job failure', async () => {
    mockAgeCreateJob.mockResolvedValue({ job_id: 'job-fail' });

    const failedStatus: AgeJobStatus = {
      job_id: 'job-fail',
      status: 'failed',
      progress: 0,
      events: [],
      error: 'Report generation failed',
    };
    mockAgeGetJob.mockResolvedValue(failedStatus);

    const chunks: StreamChunkV1[] = [];
    const generator = runGovernedToolCall(validRequest, {
      trace: traceStore,
      ageConfig: { baseUrl: 'http://localhost:8765', timeoutMs: 30000 },
    });

    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    const completeChunk = chunks.find((c) => c.type === 'complete');
    expect((completeChunk?.data as any).decision).toBe('DEGRADE');
  });

  it('should write events to trace store', async () => {
    mockAgeCreateJob.mockResolvedValue({ job_id: 'job-trace' });

    const doneStatus: AgeJobStatus = {
      job_id: 'job-trace',
      status: 'done',
      progress: 100,
      events: [],
    };
    mockAgeGetJob.mockResolvedValue(doneStatus);
    mockAgeGetJobResult.mockResolvedValue({
      job_id: 'job-trace',
      status: 'done',
      result: { summary: {}, wasted_spend: [], evidence: {} },
    });

    const generator = runGovernedToolCall(validRequest, {
      trace: traceStore,
      ageConfig: { baseUrl: 'http://localhost:8765', timeoutMs: 30000 },
    });

    // Consume generator
    for await (const _ of generator) {
      // Just consume
    }

    // Verify trace was written
    const trace = await traceStore.get(validRequest.trace_id);
    expect(trace.events.length).toBeGreaterThan(0);
    expect(trace.result).toBeDefined();
  });
});
