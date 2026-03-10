/**
 * LiYe Gateway WebSocket Client
 *
 * JSON-RPC 2.0 over WebSocket with:
 * - Proxy support (HTTP_PROXY/HTTPS_PROXY)
 * - Contract validation (fail-closed)
 * - Reconnection logic with exponential backoff
 * - Timeout handling with trace_id preservation
 */

import WebSocket from 'ws';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
import { generateWsToken } from './hmac.js';
import type { ProxyEnv } from '../net/proxy.js';
import { buildWsAgent } from '../net/proxy.js';
import { validateStreamChunkV1, formatValidationError } from '../contracts/validate.js';
import { logWithTrace } from '../util/errors.js';

export interface LiYeWsClientConfig {
  wsUrl: string;
  hmacSecret: string;
  timeoutMs: number;
  maxReconnects: number;
  proxy?: ProxyEnv;
}

export interface StreamChunkV1 {
  version: 'STREAM_CHUNK_V1';
  type: 'chunk' | 'complete' | 'error';
  trace_id: string;
  phase: 'gate' | 'enforce' | 'route' | 'execute' | 'verdict';
  progress: number;
  data?: Record<string, unknown>;
}

export interface StreamCallbacks {
  onChunk: (chunk: StreamChunkV1) => Promise<void>;
  onReconnecting?: (attempt: number, maxAttempts: number) => Promise<void>;
  onError?: (error: Error, traceId: string) => Promise<void>;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Default reconnect config
const DEFAULT_MAX_RECONNECTS = 3;
const BASE_RECONNECT_DELAY_MS = parseInt(process.env.WS_RECONNECT_BASE_DELAY_MS || '500', 10);
const MAX_RECONNECT_DELAY_MS = 30000; // Cap at 30s
const JITTER_FRACTION = 0.2; // ±20% jitter

/**
 * Execute a governed tool call with streaming.
 */
export async function governedToolCallStream(
  cfg: LiYeWsClientConfig,
  req: unknown,
  callbacks: StreamCallbacks | ((chunk: StreamChunkV1) => Promise<void>)
): Promise<void> {
  const { wsUrl, hmacSecret, timeoutMs, maxReconnects = DEFAULT_MAX_RECONNECTS, proxy } = cfg;

  // Normalize callbacks
  const cbs: StreamCallbacks = typeof callbacks === 'function'
    ? { onChunk: callbacks }
    : callbacks;

  // Extract trace_id from request for logging
  const traceId = (req as { trace_id?: string })?.trace_id || 'unknown';

  let reconnectAttempts = 0;
  let lastError: Error | null = null;

  while (reconnectAttempts <= maxReconnects) {
    try {
      await executeWithWebSocket(wsUrl, hmacSecret, timeoutMs, req, cbs, proxy, traceId);
      return; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      reconnectAttempts++;

      if (reconnectAttempts <= maxReconnects) {
        // Exponential backoff with cap
        const baseDelay = Math.min(
          BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts - 1),
          MAX_RECONNECT_DELAY_MS
        );
        // Add ±20% jitter to avoid thundering herd
        const jitter = baseDelay * JITTER_FRACTION * (Math.random() * 2 - 1);
        const delay = Math.max(100, Math.round(baseDelay + jitter));

        logWithTrace('warn', traceId, `WS reconnect attempt ${reconnectAttempts}/${maxReconnects}`, {
          delay_ms: delay,
          base_delay_ms: baseDelay,
        });

        // Notify about reconnection if callback provided
        if (cbs.onReconnecting) {
          await cbs.onReconnecting(reconnectAttempts, maxReconnects);
        }

        await sleep(delay);
      }
    }
  }

  // Notify about final error if callback provided
  if (cbs.onError && lastError) {
    await cbs.onError(lastError, traceId);
  }

  throw lastError || new Error('WebSocket connection failed after max retries');
}

/**
 * Execute a single WebSocket connection.
 */
async function executeWithWebSocket(
  wsUrl: string,
  hmacSecret: string,
  timeoutMs: number,
  req: unknown,
  callbacks: StreamCallbacks,
  proxy?: ProxyEnv,
  traceId?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Generate auth token
    const token = generateWsToken(hmacSecret);
    const url = `${wsUrl}?token=${encodeURIComponent(token)}`;

    // Build WebSocket options with proxy support
    const wsOptions: WebSocket.ClientOptions = {};

    const proxyConfig = buildWsAgent(wsUrl, proxy);
    if (proxyConfig) {
      // Determine if target is wss or ws
      const isSecure = wsUrl.startsWith('wss://');
      const Agent = isSecure ? HttpsProxyAgent : HttpProxyAgent;
      wsOptions.agent = new Agent(proxyConfig.proxyUrl);

      if (proxyConfig.headers) {
        wsOptions.headers = proxyConfig.headers;
      }

      logWithTrace('info', traceId || 'unknown', 'WS using proxy', {
        proxy: proxyConfig.proxyUrl.replace(/:[^:@\/\s]+@/, ':***@'),
      });
    }

    const ws = new WebSocket(url, wsOptions);
    const requestId = Date.now().toString();
    let isComplete = false;

    // Timeout handler
    const timeoutId = setTimeout(() => {
      if (!isComplete) {
        isComplete = true;
        ws.close();
        const error = new Error(`WebSocket request timed out after ${timeoutMs}ms`);
        logWithTrace('error', traceId || 'unknown', 'WS timeout', { timeout_ms: timeoutMs });
        reject(error);
      }
    }, timeoutMs);

    ws.on('open', () => {
      logWithTrace('info', traceId || 'unknown', 'WS connected to LiYe Gateway');

      // Send JSON-RPC request
      const rpcRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: requestId,
        method: 'governed_tool_call',
        params: req,
      };

      ws.send(JSON.stringify(rpcRequest));
    });

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle stream_chunk notification
        if (message.method === 'stream_chunk' && message.params) {
          const chunk = message.params;

          // Validate chunk against contract (fail-closed)
          const validation = validateStreamChunkV1(chunk);
          if (!validation.ok) {
            isComplete = true;
            clearTimeout(timeoutId);
            ws.close();

            const errorMsg = formatValidationError(validation, 'StreamChunkV1');
            logWithTrace('error', traceId || 'unknown', 'Contract validation failed', {
              errors: validation.errors,
            });
            reject(new Error(`Contract invalid: ${errorMsg}`));
            return;
          }

          const validatedChunk = chunk as StreamChunkV1;
          await callbacks.onChunk(validatedChunk);

          // Check if complete
          if (validatedChunk.type === 'complete' || validatedChunk.type === 'error') {
            isComplete = true;
            clearTimeout(timeoutId);
            ws.close();

            if (validatedChunk.type === 'error') {
              const errorData = validatedChunk.data?.error as string | undefined;
              reject(new Error(errorData || 'Stream error'));
            } else {
              resolve();
            }
          }
          return;
        }

        // Handle JSON-RPC response (final)
        const response = message as JsonRpcResponse;
        if (response.id === requestId) {
          isComplete = true;
          clearTimeout(timeoutId);
          ws.close();

          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve();
          }
        }
      } catch (error) {
        logWithTrace('error', traceId || 'unknown', 'WS message parse error', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    ws.on('error', (error) => {
      logWithTrace('error', traceId || 'unknown', 'WS connection error', {
        error: error.message,
      });
      clearTimeout(timeoutId);
      if (!isComplete) {
        reject(error);
      }
    });

    ws.on('close', (code, reason) => {
      logWithTrace('info', traceId || 'unknown', 'WS connection closed', {
        code,
        reason: reason?.toString(),
      });
      clearTimeout(timeoutId);
      if (!isComplete) {
        reject(new Error(`WebSocket closed unexpectedly: ${code}`));
      }
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
