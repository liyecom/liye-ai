/**
 * Enterprise WeChat Event Handler (Thin-Agent)
 *
 * Handles inbound WeChat messages, routes to Gateway, returns verdict card.
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

import { WecomEnv } from '../client/token_manager';
import { sendMarkdownMessage } from '../client/message_sender';
import { sha256, hmacSign } from '../crypto/signature';
import { renderVerdictCard, GovResponse } from '../cards/verdict_card';
import { renderPendingCard, renderErrorCard } from '../cards/pending_card';

/**
 * Parsed WeChat message
 */
export interface WecomMessage {
  MsgId?: string;
  MsgType: string;
  Content?: string;
  FromUserName: string;
  ToUserName: string;
  CreateTime: string;
  AgentID?: string;
  ChatId?: string; // Present in group chats
}

/**
 * GOV_TOOL_CALL_REQUEST_V1 schema
 */
interface GovRequest {
  task: string;
  tenant_id: string;
  trace_id: string;
  idempotency_key: string;
  context: {
    source: 'wecom';
    user_id: string;
    chat_id?: string;
    message_id?: string;
  };
  proposed_actions: Array<{
    action_type: 'read' | 'write';
    tool: string;
    arguments: Record<string, unknown>;
  }>;
}

/**
 * Idempotency status in KV
 */
interface IdempotentStatus {
  status: 'processing' | 'done' | 'failed';
  startedAt: number;
  completedAt?: number;
  traceId?: string;
  error?: string;
}

/**
 * Generate trace_id
 */
export function generateTraceId(): string {
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Generate stable dedupeKey for idempotency
 *
 * P0-1: Uses stable fields only, no encrypted content slicing
 */
export async function generateDedupeKey(
  env: WecomEnv,
  msg: WecomMessage
): Promise<string> {
  const components = [
    'wecom',
    env.WECOM_CORPID,
    env.WECOM_AGENT_ID,
    msg.MsgId || '',           // Prefer MsgId when available
    msg.FromUserName,
    msg.ToUserName,
    msg.ChatId || '',          // Group chat ID if present
    msg.CreateTime
  ];
  return sha256(components.join(':'));
}

/**
 * Check idempotency status
 *
 * Returns { shouldProcess: boolean, existingTraceId?: string }
 */
export async function checkIdempotency(
  env: WecomEnv,
  dedupeKey: string
): Promise<{ shouldProcess: boolean; existingTraceId?: string; status?: IdempotentStatus }> {
  try {
    const cached = await env.IDEMPOTENT_KV.get(dedupeKey);
    if (!cached) {
      return { shouldProcess: true };
    }

    const status: IdempotentStatus = JSON.parse(cached);

    // Already done - skip
    if (status.status === 'done') {
      return { shouldProcess: false, existingTraceId: status.traceId, status };
    }

    // Processing but stale (>5 minutes) - allow retry
    if (status.status === 'processing' && Date.now() - status.startedAt > 5 * 60 * 1000) {
      return { shouldProcess: true };
    }

    // Still processing - skip
    if (status.status === 'processing') {
      return { shouldProcess: false, existingTraceId: status.traceId, status };
    }

    // Failed - allow retry
    if (status.status === 'failed') {
      return { shouldProcess: true };
    }

    return { shouldProcess: true };
  } catch (e) {
    console.warn('[EventHandler] Idempotency check failed:', e);
    return { shouldProcess: true };
  }
}

/**
 * Mark message as processing
 */
export async function markProcessing(
  env: WecomEnv,
  dedupeKey: string,
  traceId: string
): Promise<void> {
  const status: IdempotentStatus = {
    status: 'processing',
    startedAt: Date.now(),
    traceId
  };
  await env.IDEMPOTENT_KV.put(dedupeKey, JSON.stringify(status), {
    expirationTtl: 86400 // 24 hours
  });
}

/**
 * Mark message as done
 */
export async function markDone(
  env: WecomEnv,
  dedupeKey: string,
  traceId: string
): Promise<void> {
  const status: IdempotentStatus = {
    status: 'done',
    startedAt: Date.now(),
    completedAt: Date.now(),
    traceId
  };
  await env.IDEMPOTENT_KV.put(dedupeKey, JSON.stringify(status), {
    expirationTtl: 86400
  });
}

/**
 * Mark message as failed
 */
export async function markFailed(
  env: WecomEnv,
  dedupeKey: string,
  traceId: string,
  error: string
): Promise<void> {
  const status: IdempotentStatus = {
    status: 'failed',
    startedAt: Date.now(),
    completedAt: Date.now(),
    traceId,
    error
  };
  await env.IDEMPOTENT_KV.put(dedupeKey, JSON.stringify(status), {
    expirationTtl: 86400
  });
}

/**
 * Build GOV_TOOL_CALL_REQUEST_V1
 */
function buildGovRequest(
  msg: WecomMessage,
  traceId: string,
  dedupeKey: string
): GovRequest {
  // Thin-Agent: No intent detection here
  // Gateway/Moltbot handles tool selection
  return {
    task: msg.Content || '(empty message)',
    tenant_id: 'wecom_default',
    trace_id: traceId,
    idempotency_key: dedupeKey,
    context: {
      source: 'wecom',
      user_id: msg.FromUserName,
      chat_id: msg.ChatId,
      message_id: msg.MsgId
    },
    proposed_actions: [
      {
        action_type: 'read',
        tool: 'amazon://strategy/campaign-audit', // Default tool, Gateway decides actual routing
        arguments: {
          query: msg.Content || '',
          source: 'wecom_thin_agent'
        }
      }
    ]
  };
}

/**
 * Call Gateway with timeout budget
 *
 * P0-2: 20 second end-to-end budget
 */
async function callGateway(
  env: WecomEnv,
  govRequest: GovRequest
): Promise<{ response: GovResponse | null; timedOut: boolean; error?: string }> {
  const END_TO_END_BUDGET_MS = 20000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), END_TO_END_BUDGET_MS);

  try {
    // P0-3: Generate HMAC signature
    const timestamp = Date.now().toString();
    const nonce = crypto.randomUUID();
    const payload = JSON.stringify(govRequest);
    const signature = await hmacSign(`${timestamp}.${nonce}.${payload}`, env.LIYE_HMAC_SECRET);

    // Store nonce for replay protection (Gateway can check this)
    await env.NONCE_KV.put(nonce, '1', { expirationTtl: 300 });

    const response = await fetch(`${env.LIYE_GATEWAY_URL}/v1/governed_tool_call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LiYe-Timestamp': timestamp,
        'X-LiYe-Nonce': nonce,
        'X-LiYe-Signature': signature,
        'X-LiYe-Idempotency-Key': govRequest.idempotency_key
      },
      body: payload,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        response: null,
        timedOut: false,
        error: `Gateway error: ${response.status}`
      };
    }

    const data = (await response.json()) as GovResponse;
    return { response: data, timedOut: false };

  } catch (e) {
    clearTimeout(timeoutId);

    if (e instanceof Error && e.name === 'AbortError') {
      return { response: null, timedOut: true };
    }

    return {
      response: null,
      timedOut: false,
      error: e instanceof Error ? e.message : 'Unknown error'
    };
  }
}

/**
 * Handle WeChat message event
 *
 * Main entry point for message processing.
 */
export async function handleWecomMessage(
  env: WecomEnv,
  msg: WecomMessage
): Promise<void> {
  const traceId = generateTraceId();

  console.log('[EventHandler] Processing message:', {
    traceId,
    msgType: msg.MsgType,
    userId: msg.FromUserName.slice(0, 4) + '****',
    chatId: msg.ChatId?.slice(0, 8)
  });

  // Only handle text messages for now
  if (msg.MsgType !== 'text') {
    console.log('[EventHandler] Ignoring non-text message:', msg.MsgType);
    await sendMarkdownMessage(
      env,
      msg.FromUserName,
      `## ⚠️ 暂不支持\n\n暂不支持 ${msg.MsgType} 类型消息，请发送文本消息。`
    );
    return;
  }

  // P0-1: Generate dedupeKey and check idempotency
  const dedupeKey = await generateDedupeKey(env, msg);
  const { shouldProcess, existingTraceId, status } = await checkIdempotency(env, dedupeKey);

  if (!shouldProcess) {
    console.log('[EventHandler] Duplicate message, skipping:', {
      dedupeKey: dedupeKey.slice(0, 16),
      existingTraceId,
      status: status?.status
    });

    // If already done, optionally send status
    if (status?.status === 'done') {
      await sendMarkdownMessage(
        env,
        msg.FromUserName,
        renderErrorCard(existingTraceId || traceId, 'IDEMPOTENT_DUPLICATE', '此请求已处理')
      );
    }
    return;
  }

  // Mark as processing
  await markProcessing(env, dedupeKey, traceId);

  // Build request
  const govRequest = buildGovRequest(msg, traceId, dedupeKey);

  // Call Gateway
  const { response, timedOut, error } = await callGateway(env, govRequest);

  // Handle timeout
  if (timedOut) {
    console.log('[EventHandler] Gateway timeout, sending pending card');
    await sendMarkdownMessage(
      env,
      msg.FromUserName,
      renderPendingCard({
        traceId,
        task: msg.Content,
        reason: 'Gateway 响应超时',
        estimatedMinutes: 3
      })
    );
    // Keep as processing - will be updated when result comes back
    return;
  }

  // Handle error
  if (error || !response) {
    console.error('[EventHandler] Gateway error:', error);
    await markFailed(env, dedupeKey, traceId, error || 'No response');
    await sendMarkdownMessage(
      env,
      msg.FromUserName,
      renderErrorCard(traceId, 'GATEWAY_ERROR', error || 'Gateway 返回空响应')
    );
    return;
  }

  // Success - send verdict card
  console.log('[EventHandler] Gateway response:', {
    decision: response.decision,
    traceId: response.trace_id
  });

  await markDone(env, dedupeKey, response.trace_id || traceId);
  await sendMarkdownMessage(
    env,
    msg.FromUserName,
    renderVerdictCard(response)
  );
}
