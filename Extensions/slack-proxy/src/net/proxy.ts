/**
 * Proxy Configuration Module
 *
 * Unified proxy agent generation for HTTP and WebSocket connections.
 * Respects HTTP_PROXY, HTTPS_PROXY, and NO_PROXY environment variables.
 */

import { URL } from 'url';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

export interface ProxyEnv {
  httpProxy?: string;
  httpsProxy?: string;
  noProxy?: string;
}

/**
 * Read proxy configuration from environment variables.
 */
export function readProxyEnv(): ProxyEnv {
  return {
    httpProxy: process.env.HTTP_PROXY || process.env.http_proxy,
    httpsProxy: process.env.HTTPS_PROXY || process.env.https_proxy,
    noProxy: process.env.NO_PROXY || process.env.no_proxy,
  };
}

/**
 * Check if a hostname should bypass the proxy (matches NO_PROXY).
 */
export function shouldBypassProxy(hostname: string, noProxy?: string): boolean {
  if (!noProxy) return false;

  const patterns = noProxy.split(',').map((p) => p.trim().toLowerCase());
  const host = hostname.toLowerCase();

  for (const pattern of patterns) {
    if (!pattern) continue;

    // Exact match
    if (host === pattern) return true;

    // Wildcard suffix match (e.g., .example.com matches foo.example.com)
    if (pattern.startsWith('.') && host.endsWith(pattern)) return true;

    // Suffix match without dot (e.g., example.com matches example.com and foo.example.com)
    if (host === pattern || host.endsWith(`.${pattern}`)) return true;

    // Special case: * matches everything
    if (pattern === '*') return true;
  }

  return false;
}

/**
 * Parse proxy URL and extract host, port, and auth.
 */
function parseProxyUrl(proxyUrl: string): {
  host: string;
  port: number;
  auth?: { username: string; password: string };
} | null {
  try {
    const url = new URL(proxyUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port, 10) || (url.protocol === 'https:' ? 443 : 80),
      auth: url.username
        ? { username: decodeURIComponent(url.username), password: decodeURIComponent(url.password || '') }
        : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Build an HTTP agent for the target URL, respecting proxy settings.
 * Returns undefined if no proxy should be used.
 *
 * For Slack Web API and other HTTP clients.
 */
export function buildHttpAgent(
  targetUrl: string,
  env?: ProxyEnv
): HttpAgent | HttpsAgent | undefined {
  const proxyEnv = env || readProxyEnv();

  let targetHostname: string;
  let isHttps: boolean;

  try {
    const url = new URL(targetUrl);
    targetHostname = url.hostname;
    isHttps = url.protocol === 'https:';
  } catch {
    return undefined;
  }

  // Check NO_PROXY
  if (shouldBypassProxy(targetHostname, proxyEnv.noProxy)) {
    return undefined;
  }

  // Select appropriate proxy
  const proxyUrl = isHttps ? proxyEnv.httpsProxy : proxyEnv.httpProxy;
  if (!proxyUrl) {
    return undefined;
  }

  const proxy = parseProxyUrl(proxyUrl);
  if (!proxy) {
    console.warn(`[Proxy] Invalid proxy URL: ${maskUrl(proxyUrl)}`);
    return undefined;
  }

  console.log(`[Proxy] HTTP agent configured for ${targetHostname} via ${proxy.host}:${proxy.port}`);

  if (isHttps) {
    return new HttpsProxyAgent(proxyUrl);
  }
  return new HttpProxyAgent(proxyUrl);
}

/**
 * Build a WebSocket agent for the target URL, respecting proxy settings.
 * Returns undefined if no proxy should be used.
 *
 * For ws/wss connections to LiYe Gateway.
 */
export function buildWsAgent(
  targetWsUrl: string,
  env?: ProxyEnv
): { proxyUrl: string; headers?: Record<string, string> } | undefined {
  const proxyEnv = env || readProxyEnv();

  let targetHostname: string;
  let isSecure: boolean;

  try {
    const url = new URL(targetWsUrl);
    targetHostname = url.hostname;
    isSecure = url.protocol === 'wss:';
  } catch {
    return undefined;
  }

  // Check NO_PROXY
  if (shouldBypassProxy(targetHostname, proxyEnv.noProxy)) {
    console.log(`[Proxy] WS bypassing proxy for ${targetHostname} (NO_PROXY match)`);
    return undefined;
  }

  // Select appropriate proxy (wss uses HTTPS proxy, ws uses HTTP proxy)
  const proxyUrl = isSecure ? proxyEnv.httpsProxy : proxyEnv.httpProxy;
  if (!proxyUrl) {
    return undefined;
  }

  const proxy = parseProxyUrl(proxyUrl);
  if (!proxy) {
    console.warn(`[Proxy] Invalid proxy URL: ${maskUrl(proxyUrl)}`);
    return undefined;
  }

  console.log(`[Proxy] WS agent configured for ${targetHostname} via ${proxy.host}:${proxy.port}`);

  // Return proxy configuration for WebSocket
  const headers: Record<string, string> = {};
  if (proxy.auth) {
    const auth = Buffer.from(`${proxy.auth.username}:${proxy.auth.password}`).toString('base64');
    headers['Proxy-Authorization'] = `Basic ${auth}`;
  }

  return {
    proxyUrl,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  };
}

/**
 * Get proxy info for logging (without sensitive data).
 */
export function getProxyInfo(env?: ProxyEnv): {
  httpProxy: string | null;
  httpsProxy: string | null;
  noProxy: string | null;
} {
  const proxyEnv = env || readProxyEnv();

  return {
    httpProxy: proxyEnv.httpProxy ? maskUrl(proxyEnv.httpProxy) : null,
    httpsProxy: proxyEnv.httpsProxy ? maskUrl(proxyEnv.httpsProxy) : null,
    noProxy: proxyEnv.noProxy || null,
  };
}

/**
 * Mask sensitive parts of a URL for logging.
 */
function maskUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return '[invalid-url]';
  }
}
