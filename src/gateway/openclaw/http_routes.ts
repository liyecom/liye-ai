/**
 * HTTP Routes
 *
 * REST API for trace queries and health checks.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { TraceStore } from './trace_store';

export interface HttpServerConfig {
  port: number;
  traceStore: TraceStore;
}

/**
 * Parse URL path segments.
 */
function parsePath(url: string): string[] {
  const pathname = new URL(url, 'http://localhost').pathname;
  return pathname.split('/').filter((s) => s.length > 0);
}

/**
 * Send JSON response.
 */
function sendJson(
  res: ServerResponse,
  status: number,
  data: unknown
): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Health check handler.
 */
function handleHealth(_req: IncomingMessage, res: ServerResponse): void {
  sendJson(res, 200, {
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get trace handler.
 */
async function handleGetTrace(
  traceId: string,
  res: ServerResponse,
  traceStore: TraceStore
): Promise<void> {
  if (!traceStore.exists(traceId)) {
    sendJson(res, 404, { error: `Trace not found: ${traceId}` });
    return;
  }

  try {
    const trace = await traceStore.get(traceId);
    sendJson(res, 200, trace);
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Internal error',
    });
  }
}

/**
 * Create HTTP server for REST API.
 */
export function createHttpServer(config: HttpServerConfig): ReturnType<typeof createServer> {
  const { port, traceStore } = config;

  const server = createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const path = parsePath(req.url || '/');

    // Route: GET /health
    if (req.method === 'GET' && path.length === 1 && path[0] === 'health') {
      handleHealth(req, res);
      return;
    }

    // Route: GET /v1/traces/:trace_id
    if (
      req.method === 'GET' &&
      path.length === 3 &&
      path[0] === 'v1' &&
      path[1] === 'traces'
    ) {
      const traceId = path[2];
      await handleGetTrace(traceId, res, traceStore);
      return;
    }

    // 404 Not Found
    sendJson(res, 404, { error: 'Not found' });
  });

  server.listen(port, () => {
    console.log(`[HTTP] Server listening on port ${port}`);
  });

  return server;
}
