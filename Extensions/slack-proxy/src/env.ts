/**
 * Environment Configuration
 *
 * Validates required environment variables at startup (fail-fast).
 */

export interface EnvConfig {
  // Slack
  slackBotToken: string;
  slackAppToken: string;
  slackSigningSecret?: string;

  // LiYe Gateway
  liyeGatewayWs: string;
  liyeHmacSecret: string;
  liyePolicyVersion: string;

  // Proxy (optional)
  httpProxy?: string;
  httpsProxy?: string;
  noProxy?: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name];
}

export function loadEnv(): EnvConfig {
  return {
    // Slack
    slackBotToken: required('SLACK_BOT_TOKEN'),
    slackAppToken: required('SLACK_APP_TOKEN'),
    slackSigningSecret: optional('SLACK_SIGNING_SECRET'),

    // LiYe Gateway
    liyeGatewayWs: required('LIYE_GATEWAY_WS'),
    liyeHmacSecret: required('LIYE_HMAC_SECRET'),
    liyePolicyVersion: optional('LIYE_POLICY_VERSION') || 'phase1-v1.0.0',

    // Proxy
    httpProxy: optional('HTTP_PROXY') || optional('http_proxy'),
    httpsProxy: optional('HTTPS_PROXY') || optional('https_proxy'),
    noProxy: optional('NO_PROXY') || optional('no_proxy'),
  };
}

export function validateEnv(env: EnvConfig): void {
  // Validate Slack tokens format
  if (!env.slackBotToken.startsWith('xoxb-')) {
    throw new Error('SLACK_BOT_TOKEN must start with xoxb-');
  }

  if (!env.slackAppToken.startsWith('xapp-')) {
    throw new Error('SLACK_APP_TOKEN must start with xapp-');
  }

  // Validate WebSocket URL
  if (!env.liyeGatewayWs.startsWith('ws://') && !env.liyeGatewayWs.startsWith('wss://')) {
    throw new Error('LIYE_GATEWAY_WS must be a valid WebSocket URL (ws:// or wss://)');
  }

  // Validate HMAC secret length
  if (env.liyeHmacSecret.length < 16) {
    console.warn('WARNING: LIYE_HMAC_SECRET is less than 16 characters. Consider using a longer secret.');
  }
}
