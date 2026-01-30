/**
 * Feishu API Client
 *
 * Provides tenant_access_token management and message reply API.
 * Thin-Agent principle: transport layer only, no business logic.
 */

// Token cache (in-memory)
let tokenCache = {
  token: null,
  expiresAt: 0
};

// Feishu API base URL
const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

/**
 * Get tenant_access_token with automatic refresh
 * Refreshes token 5 minutes before expiration
 */
export async function getTenantAccessToken() {
  const now = Date.now();
  const refreshBuffer = 5 * 60 * 1000; // 5 minutes before expiration

  // Return cached token if still valid
  if (tokenCache.token && tokenCache.expiresAt > now + refreshBuffer) {
    return tokenCache.token;
  }

  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('FEISHU_APP_ID and FEISHU_APP_SECRET are required');
  }

  try {
    const resp = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret })
    });

    if (!resp.ok) {
      throw new Error(`Token request failed: ${resp.status}`);
    }

    const data = await resp.json();

    if (data.code !== 0) {
      throw new Error(`Feishu error ${data.code}: ${data.msg}`);
    }

    // Cache token (expire time in seconds from API)
    tokenCache = {
      token: data.tenant_access_token,
      expiresAt: now + (data.expire * 1000)
    };

    console.log('[FeishuClient] Token refreshed, expires in', data.expire, 'seconds');
    return tokenCache.token;

  } catch (e) {
    console.error('[FeishuClient] Failed to get token:', e.message);
    throw e;
  }
}

/**
 * Reply to a message with interactive card or text
 *
 * @param {string} messageId - Original message ID to reply to
 * @param {Object|string} payload - Card JSON or text string
 * @returns {Promise<Object>} API response
 */
export async function replyMessage(messageId, payload) {
  const token = await getTenantAccessToken();

  // Determine message type and content
  let msgType, content;

  if (typeof payload === 'string') {
    // Text fallback
    msgType = 'text';
    content = JSON.stringify({ text: payload });
  } else {
    // Interactive card
    msgType = 'interactive';
    content = JSON.stringify(payload);
  }

  try {
    const resp = await fetch(`${FEISHU_API_BASE}/im/v1/messages/${messageId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        msg_type: msgType,
        content: content
      })
    });

    const data = await resp.json();

    if (data.code !== 0) {
      console.error('[FeishuClient] Reply failed:', data.code, data.msg);
      throw new Error(`Reply failed: ${data.msg}`);
    }

    console.log('[FeishuClient] Message replied:', messageId, 'type:', msgType);
    return data;

  } catch (e) {
    console.error('[FeishuClient] Reply error:', e.message);
    throw e;
  }
}

/**
 * Send a message to a chat (for cases where we can't reply)
 *
 * @param {string} chatId - Chat ID to send to
 * @param {Object|string} payload - Card JSON or text string
 * @returns {Promise<Object>} API response
 */
export async function sendMessage(chatId, payload) {
  const token = await getTenantAccessToken();

  let msgType, content;

  if (typeof payload === 'string') {
    msgType = 'text';
    content = JSON.stringify({ text: payload });
  } else {
    msgType = 'interactive';
    content = JSON.stringify(payload);
  }

  try {
    const resp = await fetch(`${FEISHU_API_BASE}/im/v1/messages?receive_id_type=chat_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: msgType,
        content: content
      })
    });

    const data = await resp.json();

    if (data.code !== 0) {
      console.error('[FeishuClient] Send failed:', data.code, data.msg);
      throw new Error(`Send failed: ${data.msg}`);
    }

    console.log('[FeishuClient] Message sent to chat:', chatId, 'type:', msgType);
    return data;

  } catch (e) {
    console.error('[FeishuClient] Send error:', e.message);
    throw e;
  }
}

/**
 * Check if client is properly configured
 */
export function isConfigured() {
  return !!(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET);
}

/**
 * Clear token cache (for testing)
 */
export function clearTokenCache() {
  tokenCache = { token: null, expiresAt: 0 };
}

export default {
  getTenantAccessToken,
  replyMessage,
  sendMessage,
  isConfigured,
  clearTokenCache
};
