/**
 * Feishu Event Adapter (Thin-Agent)
 *
 * Handles inbound Feishu events, routes to Gateway, returns verdict card.
 *
 * Thin-Agent Principle:
 * - Adapter only does: verify -> parse -> forward -> display
 * - Adapter DOES NOT: select tools, analyze intent, make routing decisions
 * - All decision logic stays in LiYe OS Gateway
 *
 * Contract Compliance:
 * - Request: GOV_TOOL_CALL_REQUEST_V1
 * - Response: GOV_TOOL_CALL_RESPONSE_V1
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { appendFileSync, mkdirSync, existsSync } from 'fs';

import { replyMessage, sendMessage, isConfigured } from './feishu_client.mjs';
import { renderVerdictCard, createFallbackTextMessage } from './cards/render_verdict_card.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load tenant map
let tenantMap = { default: { tenant_id: 'default', allowed_chat_ids: ['*'] } };
try {
  tenantMap = JSON.parse(readFileSync(join(__dirname, 'tenant_map.json'), 'utf-8'));
} catch (e) {
  console.warn('[FeishuAdapter] tenant_map.json not found, using defaults');
}

/**
 * Verify Feishu event signature/token
 * Week2: Simple token verification (encryption support documented but not enforced)
 *
 * @param {Object} body - Event body
 * @returns {boolean} True if verified
 */
function verifyEvent(body) {
  const verificationToken = process.env.FEISHU_VERIFICATION_TOKEN;

  // If no token configured, skip verification (local dev mode)
  if (!verificationToken) {
    console.warn('[FeishuAdapter] No FEISHU_VERIFICATION_TOKEN, skipping verification');
    return true;
  }

  // Check token in body
  if (body.token && body.token === verificationToken) {
    return true;
  }

  console.error('[FeishuAdapter] Token verification failed');
  return false;
}

/**
 * Check if chat_id is in allowlist
 *
 * @param {string} chatId - Chat ID to check
 * @returns {Object} { allowed: boolean, tenantId: string }
 */
function checkChatAllowlist(chatId) {
  for (const [key, config] of Object.entries(tenantMap)) {
    const allowedChats = config.allowed_chat_ids || [];

    // Wildcard allows all
    if (allowedChats.includes('*')) {
      return { allowed: true, tenantId: config.tenant_id || key };
    }

    // Exact match
    if (allowedChats.includes(chatId)) {
      return { allowed: true, tenantId: config.tenant_id || key };
    }
  }

  return { allowed: false, tenantId: 'blocked' };
}

/**
 * Parse message content from Feishu event
 *
 * @param {Object} event - Feishu event object
 * @returns {Object} { text, messageId, chatId, userId, messageType }
 */
function parseMessage(event) {
  const message = event?.message || {};
  const sender = event?.sender || {};

  const messageId = message.message_id || 'unknown';
  const chatId = message.chat_id || 'unknown';
  const messageType = message.message_type || 'unknown';
  const userId = sender?.sender_id?.user_id || 'unknown';

  let text = '';
  if (messageType === 'text' && message.content) {
    try {
      const content = JSON.parse(message.content);
      text = content.text || '';
    } catch (e) {
      text = message.content;
    }
  }

  return { text, messageId, chatId, userId, messageType };
}

/**
 * Write trace event (minimal tracing for adapter)
 */
function writeTraceEvent(traceDir, eventType, meta) {
  if (!traceDir) return;

  if (!existsSync(traceDir)) {
    mkdirSync(traceDir, { recursive: true });
  }

  const eventsFile = join(traceDir, 'events.ndjson');
  const event = {
    ts: new Date().toISOString(),
    type: eventType,
    meta
  };

  try {
    appendFileSync(eventsFile, JSON.stringify(event) + '\n');
  } catch (e) {
    console.error('[FeishuAdapter] Failed to write trace:', e.message);
  }
}

/**
 * Generate trace_id for this event
 */
function generateTraceId() {
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Handle Feishu event callback
 *
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 * @param {Object} opts - Options
 * @param {string} opts.gatewayUrl - Gateway URL (default: http://localhost:3210)
 * @param {string} opts.traceBaseDir - Trace directory (default: .liye/traces)
 */
export async function handleFeishuEvent(req, res, opts = {}) {
  const gatewayUrl = opts.gatewayUrl || process.env.GATEWAY_URL || 'http://localhost:3210';
  const traceBaseDir = opts.traceBaseDir || '.liye/traces';

  // Generate trace_id early
  const traceId = generateTraceId();
  const traceDir = join(traceBaseDir, traceId);

  // Ensure res headers
  res.setHeader('Content-Type', 'application/json');

  // Parse body (already done by caller or need to parse)
  let body = req.body;
  if (!body && typeof req.on === 'function') {
    body = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => {
        try {
          resolve(JSON.parse(data || '{}'));
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  // Handle URL verification challenge (Feishu bot setup)
  if (body.type === 'url_verification') {
    console.log('[FeishuAdapter] URL verification challenge');
    res.writeHead(200);
    res.end(JSON.stringify({ challenge: body.challenge }));
    return;
  }

  // Verify event token
  if (!verifyEvent(body)) {
    res.writeHead(401);
    res.end(JSON.stringify({
      ok: false,
      error: 'Unauthorized: token verification failed',
      trace_id: traceId
    }));
    return;
  }

  // Parse message
  const { text, messageId, chatId, userId, messageType } = parseMessage(body.event || {});

  // Write inbound trace event
  writeTraceEvent(traceDir, 'feishu.inbound', {
    trace_id: traceId,
    chat_id: chatId,
    user_id: userId,
    message_id: messageId,
    message_type: messageType
  });

  // Check chat_id allowlist
  const { allowed, tenantId } = checkChatAllowlist(chatId);
  if (!allowed) {
    console.warn('[FeishuAdapter] Chat not in allowlist:', chatId);

    // Write BLOCK trace
    writeTraceEvent(traceDir, 'feishu.blocked', {
      trace_id: traceId,
      chat_id: chatId,
      reason: 'chat_id_not_allowed'
    });

    // Return 200 to prevent Feishu retry storm, but don't process
    res.writeHead(200);
    res.end(JSON.stringify({
      ok: false,
      decision: 'BLOCK',
      error: 'Chat not authorized',
      trace_id: traceId
    }));
    return;
  }

  // Only support text messages in Week2
  if (messageType !== 'text') {
    const unsupportedMsg = `暂不支持 ${messageType} 类型消息，请发送文本消息。`;

    // Try to reply with simple text
    if (isConfigured() && messageId !== 'unknown') {
      try {
        await replyMessage(messageId, unsupportedMsg);
      } catch (e) {
        console.error('[FeishuAdapter] Failed to reply unsupported type:', e.message);
      }
    }

    res.writeHead(200);
    res.end(JSON.stringify({
      ok: true,
      message: 'Unsupported message type acknowledged',
      trace_id: traceId
    }));
    return;
  }

  // Build GOV_TOOL_CALL_REQUEST_V1
  // Thin-Agent: action_type fixed to "read", tool is a read-only default
  // User text goes into task, letting Gateway/LiYe decide real routing
  const govRequest = {
    task: text || '(empty message)',
    tenant_id: tenantId,
    trace_id: traceId,
    context: {
      source: 'feishu',
      chat_id: chatId,
      user_id: userId,
      message_id: messageId
    },
    proposed_actions: [
      {
        action_type: 'read',
        tool: 'amazon://strategy/campaign-audit',
        arguments: {
          query: text,
          source: 'feishu_thin_agent'
        }
      }
    ]
  };

  // Call Gateway
  let govResponse;
  try {
    console.log('[FeishuAdapter] Calling Gateway:', gatewayUrl);

    const resp = await fetch(`${gatewayUrl}/v1/governed_tool_call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(govRequest)
    });

    govResponse = await resp.json();
    console.log('[FeishuAdapter] Gateway response:', govResponse.decision, govResponse.trace_id);

  } catch (e) {
    console.error('[FeishuAdapter] Gateway call failed:', e.message);

    // Create degraded response when Gateway is unreachable
    govResponse = {
      ok: true,
      decision: 'DEGRADE',
      origin: 'liye_os.mock',
      origin_proof: false,
      mock_used: true,
      policy_version: 'phase1-v1.0.0',
      trace_id: traceId,
      fallback_reason: `Gateway unreachable: ${e.message}`,
      verdict_summary: '网关暂时不可用，请稍后重试。'
    };
  }

  // Write outbound trace event
  writeTraceEvent(traceDir, 'feishu.outbound', {
    trace_id: govResponse.trace_id || traceId,
    decision: govResponse.decision,
    origin: govResponse.origin,
    mock_used: govResponse.mock_used
  });

  // Render verdict card
  let card;
  try {
    card = renderVerdictCard(govResponse);
  } catch (e) {
    console.error('[FeishuAdapter] Card render failed:', e.message);
    card = null;
  }

  // Reply to Feishu (if configured)
  if (isConfigured() && messageId !== 'unknown') {
    try {
      if (card) {
        await replyMessage(messageId, card);
      } else {
        // Fallback to text message
        const textMsg = createFallbackTextMessage(govResponse);
        await replyMessage(messageId, textMsg);
      }
      console.log('[FeishuAdapter] Reply sent successfully');
    } catch (e) {
      console.error('[FeishuAdapter] Failed to reply:', e.message);
      // Log but don't fail - return 200 to prevent retry storm
    }
  } else {
    console.log('[FeishuAdapter] Skipping Feishu reply (not configured or local mode)');
  }

  // Return 200 success to Feishu
  res.writeHead(200);
  res.end(JSON.stringify({
    ok: govResponse.ok,
    decision: govResponse.decision,
    trace_id: govResponse.trace_id || traceId,
    origin: govResponse.origin,
    mock_used: govResponse.mock_used
  }));
}

export default { handleFeishuEvent };
