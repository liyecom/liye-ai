/**
 * Token Manager
 * 负责 access_token 的缓存与生命周期管理
 *
 * 功能:
 * - Token 缓存 (Cloudflare KV)
 * - 过期前刷新 (5分钟缓冲)
 * - 多实例安全
 */

import type { PushEnv, TokenCache, WechatTokenResponse } from "./types";

const WECHAT_TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token";
const TOKEN_CACHE_KEY = "wechat_access_token";
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5分钟缓冲

/**
 * 获取微信 access_token
 * 优先从缓存读取，过期前自动刷新
 */
export async function getWechatAccessToken(env: PushEnv): Promise<string> {
  // 1. 尝试从缓存读取
  const cached = await env.TOKEN_CACHE.get<TokenCache>(TOKEN_CACHE_KEY, "json");

  if (cached && cached.expiresAt > Date.now() + REFRESH_BUFFER_MS) {
    return cached.token;
  }

  // 2. 缓存不存在或即将过期，刷新 token
  const newToken = await refreshWechatToken(env);

  // 3. 存入缓存
  const cacheData: TokenCache = {
    token: newToken.access_token,
    expiresAt: Date.now() + newToken.expires_in * 1000,
  };

  await env.TOKEN_CACHE.put(TOKEN_CACHE_KEY, JSON.stringify(cacheData), {
    expirationTtl: newToken.expires_in,
  });

  return newToken.access_token;
}

/**
 * 刷新微信 access_token
 */
async function refreshWechatToken(env: PushEnv): Promise<WechatTokenResponse> {
  if (!env.WECHAT_APPID || !env.WECHAT_SECRET) {
    throw new Error("Missing WECHAT_APPID or WECHAT_SECRET");
  }

  const url = new URL(WECHAT_TOKEN_URL);
  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", env.WECHAT_APPID);
  url.searchParams.set("secret", env.WECHAT_SECRET);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`WeChat token API error: ${response.status}`);
  }

  const result = (await response.json()) as WechatTokenResponse;

  if (result.errcode) {
    throw new Error(`WeChat token error: ${result.errcode} - ${result.errmsg}`);
  }

  return result;
}

/**
 * 清除 token 缓存 (用于强制刷新)
 */
export async function clearWechatTokenCache(env: PushEnv): Promise<void> {
  await env.TOKEN_CACHE.delete(TOKEN_CACHE_KEY);
}
