/**
 * Slack Proxy Entry Point
 *
 * Connects Slack to LiYe Gateway via WebSocket.
 * Strict Proxy - No LLM, No Intent Router, Fixed Capability.
 *
 * Usage:
 *   npm start
 *
 * Environment Variables:
 *   SLACK_BOT_TOKEN      - Slack bot OAuth token (xoxb-...)
 *   SLACK_APP_TOKEN      - Slack app token for Socket Mode (xapp-...)
 *   LIYE_GATEWAY_WS      - LiYe Gateway WebSocket URL
 *   LIYE_HMAC_SECRET     - HMAC secret for authentication
 *   LIYE_POLICY_VERSION  - Policy version (default: phase1-v1.0.0)
 */

import { loadEnv, validateEnv } from './env.js';
import { createSocketModeApp } from './slack/socket_mode.js';

async function main(): Promise<void> {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           Slack Proxy for LiYe Gateway                        ║
║           Strict Proxy - Single Capability                    ║
╚══════════════════════════════════════════════════════════════╝
`);

  // Load and validate environment
  let env;
  try {
    env = loadEnv();
    validateEnv(env);
    console.log('[Config] Environment validated');
  } catch (error) {
    console.error('[Config] Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // Log configuration (without secrets)
  console.log(`[Config] LIYE_GATEWAY_WS: ${env.liyeGatewayWs}`);
  console.log(`[Config] LIYE_POLICY_VERSION: ${env.liyePolicyVersion}`);
  if (env.httpProxy || env.httpsProxy) {
    console.log(`[Config] Proxy configured: HTTP=${env.httpProxy || 'none'}, HTTPS=${env.httpsProxy || 'none'}`);
  }

  // Create and start Slack app
  try {
    const app = await createSocketModeApp({ env });

    await app.start();
    console.log('[Slack] Socket Mode app started');
    console.log('[Slack] Listening for messages...');
  } catch (error) {
    console.error('[Slack] Failed to start:', error);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = (): void => {
    console.log('\n[Shutdown] Stopping...');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
