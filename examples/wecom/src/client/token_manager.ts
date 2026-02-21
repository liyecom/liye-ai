/**
 * Enterprise WeChat AccessToken Manager
 *
 * Manages access token lifecycle with KV caching.
 * Refreshes token at 90% of its lifetime.
 */

const WECOM_TOKEN_URL = 'https://qyapi.weixin.qq.com/cgi-bin/gettoken';

export interface WecomEnv {
  WECOM_CORPID: string;
  WECOM_SECRET: string;
  WECOM_AGENT_ID: string;
  WECOM_TOKEN: string;
  WECOM_ENCODING_AES_KEY: string;
  LIYE_GATEWAY_URL: string;
  LIYE_HMAC_SECRET: string;
  TOKEN_CACHE: KVNamespace;
  IDEMPOTENT_KV: KVNamespace;
  NONCE_KV: KVNamespace;
}

interface TokenResponse {
  errcode: number;
  errmsg: string;
  access_token?: string;
  expires_in?: number;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

const TOKEN_CACHE_KEY = 'wecom_access_token';

/**
 * Get access token with KV caching
 *
 * @param env - Worker environment with KV binding
 * @returns Access token string
 */
export async function getAccessToken(env: WecomEnv): Promise<string> {
  const { WECOM_CORPID, WECOM_SECRET, TOKEN_CACHE } = env;

  if (!WECOM_CORPID || !WECOM_SECRET) {
    throw new Error('Missing WECOM_CORPID or WECOM_SECRET');
  }

  // Check KV cache first
  if (TOKEN_CACHE) {
    try {
      const cached = await TOKEN_CACHE.get(TOKEN_CACHE_KEY);
      if (cached) {
        const parsed: CachedToken = JSON.parse(cached);
        // Return if still valid (with 5 minute buffer)
        if (parsed.expiresAt > Date.now() + 5 * 60 * 1000) {
          return parsed.token;
        }
      }
    } catch (e) {
      console.warn('[TokenManager] Cache read failed:', e);
    }
  }

  // Fetch new token
  const url = `${WECOM_TOKEN_URL}?corpid=${WECOM_CORPID}&corpsecret=${WECOM_SECRET}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Token fetch failed: ${response.status}`);
  }

  const result = (await response.json()) as TokenResponse;

  if (result.errcode !== 0 || !result.access_token) {
    throw new Error(`WeChat error: ${result.errcode} - ${result.errmsg}`);
  }

  // Cache token at 90% of lifetime
  const expiresIn = result.expires_in || 7200;
  const expiresAt = Date.now() + expiresIn * 900; // 90% of lifetime in ms

  if (TOKEN_CACHE) {
    try {
      await TOKEN_CACHE.put(
        TOKEN_CACHE_KEY,
        JSON.stringify({ token: result.access_token, expiresAt }),
        { expirationTtl: expiresIn }
      );
    } catch (e) {
      console.warn('[TokenManager] Cache write failed:', e);
    }
  }

  console.log('[TokenManager] Token refreshed, expires in', expiresIn, 'seconds');
  return result.access_token;
}

/**
 * Clear cached token (for testing or forced refresh)
 */
export async function clearTokenCache(env: WecomEnv): Promise<void> {
  if (env.TOKEN_CACHE) {
    await env.TOKEN_CACHE.delete(TOKEN_CACHE_KEY);
  }
}
