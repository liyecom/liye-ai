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
import { renderVerdictCard, renderDegradeCard, createFallbackTextMessage } from './cards/render_verdict_card.mjs';

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

  // Feishu v1.0 format: token in body.token
  // Feishu v2.0 format: token in body.header.token
  const receivedToken = body.token || body.header?.token;

  // Debug: log tokens for troubleshooting
  console.log('[FeishuAdapter] Expected:', verificationToken);
  console.log('[FeishuAdapter] Received:', receivedToken);
  console.log('[FeishuAdapter] Body keys:', Object.keys(body));

  // Check token
  if (receivedToken && receivedToken === verificationToken) {
    console.log('[FeishuAdapter] Token verified OK');
    return true;
  }

  console.error('[FeishuAdapter] Token verification failed - tokens do not match');
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
  // Thin-Agent: Simple intent routing based on keywords

  // Intent detection: keyword query vs campaign audit vs keyword performance
  const lowerText = (text || '').toLowerCase();
  const isKeywordQuery = (
    lowerText.includes('关键词') ||
    lowerText.includes('否定词') ||
    lowerText.includes('keyword') ||
    lowerText.includes('negative')
  );

  // Check if user wants performance/analysis data
  const wantsPerformance = (
    lowerText.includes('表现') ||
    lowerText.includes('性能') ||
    lowerText.includes('数据') ||
    lowerText.includes('分析') ||
    lowerText.includes('acos') ||
    lowerText.includes('花费') ||
    lowerText.includes('转化') ||
    lowerText.includes('加大投放') ||
    lowerText.includes('否定') ||
    lowerText.includes('performance')
  );

  // Extract campaign name from text
  let campaignName = '';
  if (isKeywordQuery) {
    // Pattern 1: "列出XXX所有的关键词"
    const pattern1 = text.match(/列出(.+?)(?:所有)?的?(?:关键词|否定词)/);
    if (pattern1 && pattern1[1]) {
      campaignName = pattern1[1].trim();
    }
    // Pattern 2: "广告组：XXX里"
    if (!campaignName) {
      const pattern2 = text.match(/(?:广告组|广告活动)[：:]\s*[•·\s]*(.+?)(?:里|的这|这些|的关键词)/);
      if (pattern2 && pattern2[1]) {
        campaignName = pattern2[1].trim();
      }
    }
    // Pattern 3: Date-ending campaign names like XXX-20251226
    if (!campaignName) {
      const pattern3 = text.match(/([a-zA-Z0-9\u4e00-\u9fa5][^\s]*-\d{8})/);
      if (pattern3) {
        campaignName = pattern3[1].trim();
      }
    }
  }

  // Select tool based on intent
  let selectedTool = 'amazon://strategy/campaign-audit';
  let toolArguments = {
    query: text,
    source: 'feishu_thin_agent'
  };

  if (isKeywordQuery && campaignName && wantsPerformance) {
    // User wants keyword performance data with analysis
    // Pass chat_id for async result push to Feishu
    selectedTool = 'amazon://strategy/keyword-performance';
    toolArguments = {
      campaign_name: campaignName,
      days: 30,
      chat_id: chatId,
      query: text,
      source: 'feishu_thin_agent'
    };
    console.log('[FeishuAdapter] Intent: keyword-performance for campaign:', campaignName);
  } else if (isKeywordQuery && campaignName) {
    // User just wants keyword list
    selectedTool = 'amazon://strategy/keyword-list';
    toolArguments = {
      campaign_name: campaignName,
      query: text,
      source: 'feishu_thin_agent'
    };
    console.log('[FeishuAdapter] Intent: keyword-list for campaign:', campaignName);
  } else {
    console.log('[FeishuAdapter] Intent: campaign-audit (default)');
  }

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
        tool: selectedTool,
        arguments: toolArguments
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

    // Determine error code based on error type
    let errorCode = 'AGE_UNREACHABLE';
    let stage = 'ERROR';
    if (e.message?.includes('timeout') || e.name === 'AbortError') {
      errorCode = 'AGE_TIMEOUT';
      stage = 'TIMEOUT';
    }

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
      verdict_summary: '网关暂时不可用，请稍后重试。',
      // Extended DEGRADE info
      degrade_info: {
        stage,
        error_code: errorCode,
        error_message: e.message
      }
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
    // Use renderDegradeCard for DEGRADE decisions with extended info
    if (govResponse.decision === 'DEGRADE' && govResponse.degrade_info) {
      card = renderDegradeCard({
        trace_id: govResponse.trace_id || traceId,
        stage: govResponse.degrade_info.stage,
        error_code: govResponse.degrade_info.error_code,
        error_message: govResponse.degrade_info.error_message,
        origin: govResponse.origin,
        fallback_reason: govResponse.fallback_reason
      });
    } else {
      card = renderVerdictCard(govResponse);
    }
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

/**
 * Notify a channel with a message
 *
 * @param {Object} opts - Notification options
 * @param {string} opts.channel - 'group' | 'private' (uses FEISHU_CHAT_ID_GROUP or FEISHU_CHAT_ID_PRIVATE)
 * @param {string} opts.title - Card title
 * @param {string} opts.md - Markdown content
 * @param {string} opts.trace_id - Trace ID for linking
 * @param {string} opts.level - 'info' | 'warn' | 'error' | 'success' (controls card color)
 * @returns {Promise<Object>} API response
 */
export async function notify(opts) {
  const { channel = 'group', title, md, trace_id, level = 'info' } = opts;

  // Resolve chat_id from env (support multiple variable names for compatibility)
  const chatId = channel === 'group'
    ? (process.env.FEISHU_CHAT_ID_GROUP || process.env.FEISHU_CHAT_ID)
    : (process.env.FEISHU_CHAT_ID_PRIVATE || process.env.FEISHU_PRIVATE_CHAT_ID);

  if (!chatId) {
    const envHint = channel === 'group'
      ? 'FEISHU_CHAT_ID_GROUP or FEISHU_CHAT_ID'
      : 'FEISHU_CHAT_ID_PRIVATE or FEISHU_PRIVATE_CHAT_ID';
    console.error(`[FeishuAdapter] No chat_id for channel: ${channel}. Set ${envHint}`);
    return { ok: false, error: `Missing env: ${envHint}` };
  }

  // Level to header color mapping
  const levelColors = {
    info: 'blue',
    warn: 'orange',
    error: 'red',
    success: 'green'
  };
  const headerColor = levelColors[level] || 'blue';

  // Build interactive card
  const card = {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: title || 'LiYe OS Notification' },
      template: headerColor
    },
    elements: [
      {
        tag: 'markdown',
        content: md || '(empty)'
      }
    ]
  };

  // Add trace_id footer if provided
  if (trace_id) {
    card.elements.push({
      tag: 'note',
      elements: [
        { tag: 'plain_text', content: `trace_id: ${trace_id}` }
      ]
    });
  }

  try {
    const result = await sendMessage(chatId, card);
    console.log(`[FeishuAdapter] Notify sent to ${channel}:`, title);
    return { ok: true, data: result };
  } catch (e) {
    console.error(`[FeishuAdapter] Notify failed:`, e.message);
    return { ok: false, error: e.message };
  }
}

export default { handleFeishuEvent, notify };
