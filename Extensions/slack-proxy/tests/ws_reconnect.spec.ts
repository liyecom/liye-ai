/**
 * WebSocket Reconnect Tests
 *
 * Tests for WS client reconnection logic, timeout, and contract validation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketServer, WebSocket as WsWebSocket } from 'ws';
import { governedToolCallStream, type LiYeWsClientConfig, type StreamChunkV1 } from '../src/liye/ws_client.js';

// Use a random port to avoid conflicts
function getRandomPort(): number {
  return 30000 + Math.floor(Math.random() * 20000);
}

// Create a minimal HMAC secret (tests don't actually validate HMAC)
const TEST_HMAC = 'test-hmac-secret-1234567890';

describe('WS reconnect logic', () => {
  let wss: WebSocketServer;
  let port: number;

  afterEach(async () => {
    if (wss) {
      await new Promise<void>((resolve) => {
        wss.close(() => resolve());
      });
    }
  });

  it('should connect and receive stream chunks', async () => {
    port = getRandomPort();
    const chunks: StreamChunkV1[] = [];

    wss = new WebSocketServer({ port });
    wss.on('connection', (ws) => {
      ws.on('message', () => {
        // Send a chunk then complete
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          method: 'stream_chunk',
          params: {
            version: 'STREAM_CHUNK_V1',
            type: 'chunk',
            trace_id: 'trace-test',
            phase: 'gate',
            progress: 50,
          },
        }));
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          method: 'stream_chunk',
          params: {
            version: 'STREAM_CHUNK_V1',
            type: 'complete',
            trace_id: 'trace-test',
            phase: 'verdict',
            progress: 100,
            data: { decision: 'ALLOW' },
          },
        }));
      });
    });

    const cfg: LiYeWsClientConfig = {
      wsUrl: `ws://localhost:${port}`,
      hmacSecret: TEST_HMAC,
      timeoutMs: 5000,
      maxReconnects: 0,
    };

    await governedToolCallStream(cfg, { trace_id: 'trace-test' }, {
      onChunk: async (chunk) => { chunks.push(chunk); },
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0].phase).toBe('gate');
    expect(chunks[1].type).toBe('complete');
  });

  it('should reject invalid stream chunks (fail-closed)', async () => {
    port = getRandomPort();

    wss = new WebSocketServer({ port });
    wss.on('connection', (ws) => {
      ws.on('message', () => {
        // Send invalid chunk (missing version)
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          method: 'stream_chunk',
          params: {
            type: 'chunk',
            trace_id: 'trace-test',
            phase: 'gate',
            progress: 50,
          },
        }));
      });
    });

    const cfg: LiYeWsClientConfig = {
      wsUrl: `ws://localhost:${port}`,
      hmacSecret: TEST_HMAC,
      timeoutMs: 5000,
      maxReconnects: 0,
    };

    await expect(
      governedToolCallStream(cfg, { trace_id: 'trace-test' }, {
        onChunk: async () => {},
      })
    ).rejects.toThrow('Contract invalid');
  });

  it('should timeout and reject when server is silent', async () => {
    port = getRandomPort();

    wss = new WebSocketServer({ port });
    wss.on('connection', () => {
      // Server accepts but never responds
    });

    const cfg: LiYeWsClientConfig = {
      wsUrl: `ws://localhost:${port}`,
      hmacSecret: TEST_HMAC,
      timeoutMs: 500, // Short timeout for test
      maxReconnects: 0,
    };

    await expect(
      governedToolCallStream(cfg, { trace_id: 'trace-test' }, {
        onChunk: async () => {},
      })
    ).rejects.toThrow('timed out');
  });

  it('should reconnect on connection failure up to maxReconnects', async () => {
    port = getRandomPort();
    let connectionCount = 0;

    // No server running — all connections will fail
    const cfg: LiYeWsClientConfig = {
      wsUrl: `ws://localhost:${port}`,
      hmacSecret: TEST_HMAC,
      timeoutMs: 1000,
      maxReconnects: 2,
    };

    const onReconnecting = vi.fn();

    await expect(
      governedToolCallStream(cfg, { trace_id: 'trace-test' }, {
        onChunk: async () => {},
        onReconnecting,
      })
    ).rejects.toThrow();

    // Should have called onReconnecting for each retry
    expect(onReconnecting).toHaveBeenCalledTimes(2);
    expect(onReconnecting).toHaveBeenCalledWith(1, 2);
    expect(onReconnecting).toHaveBeenCalledWith(2, 2);
  });

  it('should succeed after reconnecting when server comes up', async () => {
    port = getRandomPort();
    let attempts = 0;

    // Start server that rejects first connection, accepts second
    wss = new WebSocketServer({ port });
    wss.on('connection', (ws) => {
      attempts++;
      if (attempts === 1) {
        ws.close(1001, 'try again');
        return;
      }
      ws.on('message', () => {
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          method: 'stream_chunk',
          params: {
            version: 'STREAM_CHUNK_V1',
            type: 'complete',
            trace_id: 'trace-test',
            phase: 'verdict',
            progress: 100,
            data: { decision: 'ALLOW' },
          },
        }));
      });
    });

    const cfg: LiYeWsClientConfig = {
      wsUrl: `ws://localhost:${port}`,
      hmacSecret: TEST_HMAC,
      timeoutMs: 5000,
      maxReconnects: 3,
    };

    const chunks: StreamChunkV1[] = [];
    await governedToolCallStream(cfg, { trace_id: 'trace-test' }, {
      onChunk: async (chunk) => { chunks.push(chunk); },
    });

    expect(attempts).toBe(2);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('complete');
  });

  it('should call onError after all retries exhausted', async () => {
    port = getRandomPort();

    const cfg: LiYeWsClientConfig = {
      wsUrl: `ws://localhost:${port}`,
      hmacSecret: TEST_HMAC,
      timeoutMs: 500,
      maxReconnects: 1,
    };

    const onError = vi.fn();

    await expect(
      governedToolCallStream(cfg, { trace_id: 'trace-test' }, {
        onChunk: async () => {},
        onError,
      })
    ).rejects.toThrow();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'trace-test');
  });
});
