/**
 * WebSocket Server
 *
 * JSON-RPC 2.0 over WebSocket for governed tool calls.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import type { IncomingMessage } from 'http';
import type {
  GovToolCallRequestV1,
  JsonRpcRequest,
  JsonRpcResponse,
  StreamChunkV1,
} from './types';
import { verifyWsToken } from './hmac';
import { TraceStore } from './trace_store';
import { runGovernedToolCall, type JobRunnerDeps } from './job_runner';
import type { AgeClientConfig } from './age_job_client';

export interface WsServerConfig {
  port: number;
  hmacSecret: string;
  ageConfig: AgeClientConfig;
  traceStore: TraceStore;
}

/**
 * Send JSON-RPC response.
 */
function sendResponse(ws: WebSocket, response: JsonRpcResponse): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(response));
  }
}

/**
 * Send stream chunk as JSON-RPC notification.
 */
function sendChunk(ws: WebSocket, chunk: StreamChunkV1): void {
  if (ws.readyState === WebSocket.OPEN) {
    const notification = {
      jsonrpc: '2.0' as const,
      method: 'stream_chunk',
      params: chunk,
    };
    ws.send(JSON.stringify(notification));
  }
}

/**
 * Send JSON-RPC error.
 */
function sendError(
  ws: WebSocket,
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): void {
  const response: JsonRpcResponse = {
    jsonrpc: '2.0',
    id: id ?? 0,
    error: { code, message, data },
  };
  sendResponse(ws, response);
}

/**
 * Handle governed_tool_call method.
 */
async function handleGovernedToolCall(
  ws: WebSocket,
  id: string | number,
  params: unknown,
  deps: JobRunnerDeps
): Promise<void> {
  // Validate params
  const req = params as GovToolCallRequestV1;
  if (!req || req.version !== 'GOV_TOOL_CALL_REQUEST_V1') {
    sendError(ws, id, -32602, 'Invalid params: expected GovToolCallRequestV1');
    return;
  }

  try {
    // Run the governed tool call
    const generator = runGovernedToolCall(req, deps);

    let result: unknown;
    for await (const chunk of generator) {
      sendChunk(ws, chunk);

      // Check if this is the complete chunk
      if (chunk.type === 'complete') {
        result = chunk.data;
      }
    }

    // Send final JSON-RPC response
    sendResponse(ws, {
      jsonrpc: '2.0',
      id,
      result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal error';
    sendError(ws, id, -32603, message);
  }
}

/**
 * Handle incoming WebSocket message.
 */
async function handleMessage(
  ws: WebSocket,
  data: string,
  deps: JobRunnerDeps
): Promise<void> {
  let request: JsonRpcRequest;

  try {
    request = JSON.parse(data);
  } catch {
    sendError(ws, null, -32700, 'Parse error');
    return;
  }

  // Validate JSON-RPC 2.0
  if (request.jsonrpc !== '2.0') {
    sendError(ws, request.id ?? null, -32600, 'Invalid Request');
    return;
  }

  // Route to method handler
  switch (request.method) {
    case 'governed_tool_call':
      await handleGovernedToolCall(ws, request.id, request.params, deps);
      break;

    default:
      sendError(ws, request.id, -32601, `Method not found: ${request.method}`);
  }
}

/**
 * Create and start WebSocket server.
 */
export function createWsServer(config: WsServerConfig): WebSocketServer {
  const { port, hmacSecret, ageConfig, traceStore } = config;

  const wss = new WebSocketServer({ port });

  const deps: JobRunnerDeps = {
    trace: traceStore,
    ageConfig,
  };

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // Authenticate connection
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    const token = url.searchParams.get('token');

    if (!token || !verifyWsToken(hmacSecret, token)) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    console.log(`[WS] Client connected`);

    ws.on('message', async (data: Buffer) => {
      try {
        const msg = data.toString();
        await handleMessage(ws, msg, deps);
      } catch (error) {
        console.error('[WS] Message handling error:', error);
        sendError(
          ws,
          null,
          -32603,
          error instanceof Error ? error.message : 'Internal error'
        );
      }
    });

    ws.on('close', () => {
      console.log(`[WS] Client disconnected`);
    });

    ws.on('error', (error) => {
      console.error('[WS] Connection error:', error);
    });
  });

  wss.on('error', (error) => {
    console.error('[WS] Server error:', error);
  });

  console.log(`[WS] Server listening on port ${port}`);

  return wss;
}
