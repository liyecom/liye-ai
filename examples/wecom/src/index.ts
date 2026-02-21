/**
 * Enterprise WeChat Adapter Worker
 *
 * Cloudflare Worker that receives WeChat callbacks, validates signatures,
 * decrypts messages, and forwards to LiYe OS Gateway.
 *
 * Architecture: Thin-Agent
 * - Only does: verify -> decrypt -> forward -> render
 * - Does NOT: intent detection, tool selection, decision logic
 *
 * P0 Hardening:
 * - P0-1: Idempotency (KV first gate + Gateway authority)
 * - P0-2: 20s timeout budget with pending card fallback
 * - P0-3: S2S HMAC signature + nonce replay protection
 * - P0-4: URL verification (GET returns plain text echostr)
 */

import { WecomEnv } from './client/token_manager';
import { verifySignature } from './crypto/signature';
import { decryptMessage } from './crypto/aes';
import { handleWecomMessage, WecomMessage } from './handlers/event_handler';

export default {
  async fetch(request: Request, env: WecomEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, service: 'wecom-adapter' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Only handle root path for WeChat callbacks
    if (url.pathname !== '/') {
      return new Response('Not Found', { status: 404 });
    }

    // P0-4: URL Verification (GET request)
    if (request.method === 'GET') {
      return handleUrlVerification(url, env);
    }

    // Message callback (POST request)
    if (request.method === 'POST') {
      return handleMessageCallback(request, url, env, ctx);
    }

    return new Response('Method Not Allowed', { status: 405 });
  }
};

/**
 * P0-4: Handle WeChat URL verification
 *
 * WeChat sends GET request to verify URL ownership.
 * Must return decrypted echostr as plain text.
 */
async function handleUrlVerification(url: URL, env: WecomEnv): Promise<Response> {
  const msg_signature = url.searchParams.get('msg_signature') || '';
  const timestamp = url.searchParams.get('timestamp') || '';
  const nonce = url.searchParams.get('nonce') || '';
  const echostr = url.searchParams.get('echostr') || '';

  console.log('[Worker] URL verification request:', { timestamp, nonce });

  // Verify signature
  const isValid = await verifySignature(
    env.WECOM_TOKEN,
    timestamp,
    nonce,
    echostr,
    msg_signature
  );

  if (!isValid) {
    console.error('[Worker] URL verification signature failed');
    return new Response('Signature verification failed', { status: 401 });
  }

  // Decrypt echostr
  try {
    const { message, corpId } = await decryptMessage(echostr, env.WECOM_ENCODING_AES_KEY);

    // Verify corpId matches
    if (corpId !== env.WECOM_CORPID) {
      console.error('[Worker] CorpId mismatch:', corpId, 'vs', env.WECOM_CORPID);
      return new Response('CorpId mismatch', { status: 401 });
    }

    console.log('[Worker] URL verification success');

    // CRITICAL: Return plain text, no JSON wrapping
    return new Response(message, {
      headers: { 'Content-Type': 'text/plain' }
    });

  } catch (e) {
    console.error('[Worker] Decrypt failed:', e);
    return new Response('Decrypt failed', { status: 500 });
  }
}

/**
 * Handle WeChat message callback
 *
 * WeChat sends POST with encrypted XML message.
 */
async function handleMessageCallback(
  request: Request,
  url: URL,
  env: WecomEnv,
  ctx: ExecutionContext
): Promise<Response> {
  // Get signature params
  const msg_signature = url.searchParams.get('msg_signature') || '';
  const timestamp = url.searchParams.get('timestamp') || '';
  const nonce = url.searchParams.get('nonce') || '';

  // Parse XML body
  const body = await request.text();
  const encrypt = extractEncrypt(body);

  if (!encrypt) {
    console.error('[Worker] No Encrypt field in body');
    return new Response('Invalid request body', { status: 400 });
  }

  // Verify signature
  const isValid = await verifySignature(
    env.WECOM_TOKEN,
    timestamp,
    nonce,
    encrypt,
    msg_signature
  );

  if (!isValid) {
    console.error('[Worker] Message signature verification failed');
    return new Response('Signature verification failed', { status: 401 });
  }

  // Decrypt message
  let decrypted: { message: string; corpId: string };
  try {
    decrypted = await decryptMessage(encrypt, env.WECOM_ENCODING_AES_KEY);
  } catch (e) {
    console.error('[Worker] Message decrypt failed:', e);
    return new Response('Decrypt failed', { status: 500 });
  }

  // Verify corpId
  if (decrypted.corpId !== env.WECOM_CORPID) {
    console.error('[Worker] CorpId mismatch in message');
    return new Response('CorpId mismatch', { status: 401 });
  }

  // Parse decrypted XML to message object
  const msg = parseMessageXml(decrypted.message);

  console.log('[Worker] Received message:', {
    msgType: msg.MsgType,
    userId: msg.FromUserName?.slice(0, 4) + '****'
  });

  // Process message asynchronously
  // Return immediately to prevent WeChat retry
  ctx.waitUntil(
    handleWecomMessage(env, msg).catch(e => {
      console.error('[Worker] Message handling failed:', e);
    })
  );

  // Return empty response (WeChat expects this)
  return new Response('');
}

/**
 * Extract Encrypt field from XML body
 */
function extractEncrypt(xml: string): string | null {
  const match = xml.match(/<Encrypt><!\[CDATA\[(.+?)\]\]><\/Encrypt>/);
  return match ? match[1] : null;
}

/**
 * Parse decrypted XML message to object
 */
function parseMessageXml(xml: string): WecomMessage {
  const extract = (tag: string): string => {
    // Try CDATA format first
    const cdataMatch = xml.match(new RegExp(`<${tag}><!\\\[CDATA\\\[(.+?)\\\]\\\]></${tag}>`));
    if (cdataMatch) return cdataMatch[1];

    // Try plain format
    const plainMatch = xml.match(new RegExp(`<${tag}>(.+?)</${tag}>`));
    return plainMatch ? plainMatch[1] : '';
  };

  return {
    MsgId: extract('MsgId'),
    MsgType: extract('MsgType'),
    Content: extract('Content'),
    FromUserName: extract('FromUserName'),
    ToUserName: extract('ToUserName'),
    CreateTime: extract('CreateTime'),
    AgentID: extract('AgentID'),
    ChatId: extract('ChatId') || undefined
  };
}
