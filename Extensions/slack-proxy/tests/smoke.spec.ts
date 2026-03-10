/**
 * Smoke Tests for Slack Proxy
 *
 * Basic integration tests with mocked LiYe Gateway.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildGovRequest } from '../src/liye/request_builder.js';
import { generateWsToken } from '../src/liye/hmac.js';
import { renderProgressLine, renderProgressDisplay } from '../src/render/progress.js';
import { renderFinalResult } from '../src/render/final.js';
import type { StreamChunkV1, LiYeWsClientConfig } from '../src/liye/ws_client.js';
import type { GovToolCallResponseV1 } from '../src/render/final.js';
import type { EnvConfig } from '../src/env.js';

describe('Request Builder', () => {
  it('should build valid GovToolCallRequestV1', () => {
    const ctx = {
      teamId: 'T123',
      channelId: 'C456',
      userId: 'U789',
      messageTs: '1234567890.123456',
      text: 'Analyze my wasted spend',
    };

    const request = buildGovRequest(ctx, 'phase1-v1.0.0');

    expect(request.version).toBe('GOV_TOOL_CALL_REQUEST_V1');
    expect(request.trace_id).toMatch(/^trace-/);
    expect(request.tenant_id).toBe('slack:T123');
    expect(request.proposed_actions).toHaveLength(1);
    expect(request.proposed_actions[0].tool).toBe('amazon://strategy/wasted-spend-detect');
    expect(request.proposed_actions[0].action_type).toBe('read');
    expect(request.context.channel).toBe('slack');
  });

  it('should generate unique trace IDs', () => {
    const ctx = {
      teamId: 'T123',
      channelId: 'C456',
      userId: 'U789',
      messageTs: '1234567890.123456',
      text: 'Test',
    };

    const req1 = buildGovRequest(ctx, 'phase1-v1.0.0');
    const req2 = buildGovRequest(ctx, 'phase1-v1.0.0');

    expect(req1.trace_id).not.toBe(req2.trace_id);
  });
});

describe('HMAC', () => {
  it('should generate valid WS token format', () => {
    const token = generateWsToken('test-secret');

    expect(token).toMatch(/^\d+\.[a-f0-9]+$/);

    const [timestamp, hmac] = token.split('.');
    expect(parseInt(timestamp)).toBeGreaterThan(0);
    expect(hmac.length).toBe(64); // SHA-256 hex
  });
});

describe('Progress Renderer', () => {
  it('should render progress line correctly', () => {
    const chunk: StreamChunkV1 = {
      version: 'STREAM_CHUNK_V1',
      type: 'chunk',
      trace_id: 'trace-123',
      phase: 'gate',
      progress: 50,
      data: { status: 'checking' },
    };

    const line = renderProgressLine(chunk);

    expect(line).toContain('Gate');
    expect(line).toContain('50%');
    expect(line).toContain('checking');
  });

  it('should render compact progress display with trace_id', () => {
    const chunk: StreamChunkV1 = {
      version: 'STREAM_CHUNK_V1',
      type: 'chunk',
      trace_id: 'trace-123',
      phase: 'execute',
      progress: 50,
      data: { status: 'running' },
    };

    const display = renderProgressDisplay(chunk, 'trace-123');

    expect(display).toContain('trace: trace-123');
    expect(display).toContain('Execute');
    expect(display).toContain('50%');
    expect(display).toContain('Processing');
  });
});

describe('Final Renderer', () => {
  it('should render ALLOW response with results', () => {
    const response: GovToolCallResponseV1 = {
      version: 'GOV_TOOL_CALL_RESPONSE_V1',
      trace_id: 'trace-123',
      decision: 'ALLOW',
      verdict_summary: 'Execution completed successfully',
      execution_result: {
        summary: {
          total_spend: 1000,
          total_wasted_spend: 200,
          wasted_percentage: 20,
          wasted_count: 5,
        },
        wasted_spend: [
          { search_term: 'bad keyword', spend: 50, clicks: 25 },
        ],
      },
      policy_version: 'phase1-v1.0.0',
    };

    const text = renderFinalResult(response);

    expect(text).toContain('ALLOW');
    expect(text).toContain('$1000.00');
    expect(text).toContain('$200.00');
    expect(text).toContain('20.0%');
    expect(text).toContain('bad keyword');
    expect(text).toContain('trace-123');
  });

  it('should render DEGRADE response', () => {
    const response: GovToolCallResponseV1 = {
      version: 'GOV_TOOL_CALL_RESPONSE_V1',
      trace_id: 'trace-789',
      decision: 'DEGRADE',
      verdict_summary: 'Timed out',
      policy_version: 'phase1-v1.0.0',
    };

    const text = renderFinalResult(response);

    expect(text).toContain('DEGRADE');
    expect(text).toContain('Timed out');
  });

  it('should render BLOCK response', () => {
    const response: GovToolCallResponseV1 = {
      version: 'GOV_TOOL_CALL_RESPONSE_V1',
      trace_id: 'trace-456',
      decision: 'BLOCK',
      verdict_summary: 'Unsupported tool',
      policy_version: 'phase1-v1.0.0',
    };

    const text = renderFinalResult(response);

    expect(text).toContain('BLOCK');
    expect(text).toContain('Unsupported tool');
    expect(text).toContain('blocked by governance');
  });
});

/**
 * Regression Tests — E2E Bug Fixes
 *
 * These tests guard against the 3 bugs found during E2E (2026-03-10):
 * 1. ESM/CJS import compatibility
 * 2. Bot message infinite loop
 * 3. WS timeout too short for AGE reports
 */
describe('Regression: ESM/CJS imports', () => {
  it('should import @slack/bolt via default import without crashing', async () => {
    // This catches the ESM named-import-from-CJS error:
    // "does not provide an export named 'App'"
    const bolt = await import('@slack/bolt');
    expect(bolt.default).toBeDefined();
    expect(bolt.default.App).toBeDefined();
  });

  it('should import @slack/web-api via default import without crashing', async () => {
    const webApi = await import('@slack/web-api');
    expect(webApi.default).toBeDefined();
    expect(webApi.default.WebClient).toBeDefined();
  });
});

describe('Regression: Bot message loop prevention', () => {
  it('socket_mode.ts must filter bot_id in DM handler', async () => {
    // Read the source and verify the guard exists — prevents someone
    // from removing it during a refactor.
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const source = readFileSync(
      resolve(__dirname, '../src/slack/socket_mode.ts'),
      'utf-8'
    );

    // Must check for bot_id to filter bot's own messages
    expect(source).toContain("'bot_id' in event");
    // Must check for subtype to filter message edits/deletes
    expect(source).toContain("'subtype' in event");
  });
});

describe('Regression: WS timeout configuration', () => {
  it('timeoutMs must be >= 300000 (5 min) to survive AGE report polling', () => {
    // AGE reports take up to 300s. Timeout must cover that plus margin.
    // This prevents someone from lowering the value back to 60s.
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../src/slack/socket_mode.ts'),
      'utf-8'
    );

    // Extract timeoutMs value from wsConfig
    const match = source.match(/timeoutMs:\s*(\d+)/);
    expect(match).not.toBeNull();
    const timeoutMs = parseInt(match![1], 10);
    expect(timeoutMs).toBeGreaterThanOrEqual(300000);
  });
});
