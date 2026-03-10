/**
 * LiYe Gateway Server
 *
 * Entry point for the OpenClaw Gateway.
 *
 * Usage:
 *   npx ts-node src/gateway/openclaw/server.ts
 *
 * Environment variables:
 *   LIYE_GATEWAY_PORT - WS port (default: 3210)
 *   LIYE_HTTP_PORT - HTTP port (default: 3211)
 *   LIYE_HMAC_SECRET - HMAC secret for authentication
 *   AGE_BASE_URL - AGE Job API base URL (default: http://localhost:8765)
 *   AGE_TIMEOUT_MS - AGE request timeout (default: 30000)
 */

import { TraceStore } from './trace_store';
import { createWsServer } from './ws_server';
import { createHttpServer } from './http_routes';
import type { AgeClientConfig } from './age_job_client';

function main(): void {
  // Load configuration from environment
  const wsPort = parseInt(process.env.LIYE_GATEWAY_PORT || '3210', 10);
  const httpPort = parseInt(process.env.LIYE_HTTP_PORT || '3211', 10);
  const hmacSecret = process.env.LIYE_HMAC_SECRET;
  const ageBaseUrl = process.env.AGE_BASE_URL || 'http://localhost:8765';
  const ageTimeoutMs = parseInt(process.env.AGE_TIMEOUT_MS || '30000', 10);

  // Validate required config
  if (!hmacSecret) {
    console.error('ERROR: LIYE_HMAC_SECRET environment variable is required');
    process.exit(1);
  }

  // Initialize components
  const traceStore = new TraceStore('state/traces');

  const ageConfig: AgeClientConfig = {
    baseUrl: ageBaseUrl,
    timeoutMs: ageTimeoutMs,
  };

  // Start WebSocket server
  const wss = createWsServer({
    port: wsPort,
    hmacSecret,
    ageConfig,
    traceStore,
  });

  // Start HTTP server
  const http = createHttpServer({
    port: httpPort,
    traceStore,
  });

  // Graceful shutdown
  const shutdown = (): void => {
    console.log('\nShutting down...');
    wss.close();
    http.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              LiYe Gateway (OpenClaw Integration)              ║
╠══════════════════════════════════════════════════════════════╣
║  WebSocket: ws://localhost:${wsPort}/ws                          ║
║  HTTP:      http://localhost:${httpPort}                           ║
║  AGE:       ${ageBaseUrl.padEnd(40)}    ║
╚══════════════════════════════════════════════════════════════╝
`);
}

main();
