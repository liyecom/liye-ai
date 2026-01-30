/**
 * Feishu Actions Handler (Week3)
 *
 * Handles interactive card button click callbacks:
 * - run_dry_plan: Generate dry_run_plan.md
 * - generate_evidence: Generate evidence_package.md
 *
 * Thin-Agent Principle:
 * - Actions handler only generates files, no strategy decisions
 * - All files written to trace directory for audit
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'fs';

import { replyMessage, sendMessage, isConfigured } from './feishu_client.mjs';
import { renderEvidenceStatusCard } from './cards/render_verdict_card.mjs';
import { writeEvidencePackage, getEvidencePath } from '../../src/runtime/evidence/evidence_writer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load tenant map for verification
let tenantMap = { default: { tenant_id: 'default', allowed_chat_ids: ['*'] } };
try {
  tenantMap = JSON.parse(readFileSync(join(__dirname, 'tenant_map.json'), 'utf-8'));
} catch (e) {
  console.warn('[FeishuActions] tenant_map.json not found, using defaults');
}

/**
 * Verify Feishu action callback (reuse verification logic)
 */
function verifyAction(body) {
  const verificationToken = process.env.FEISHU_VERIFICATION_TOKEN;

  if (!verificationToken) {
    console.warn('[FeishuActions] No FEISHU_VERIFICATION_TOKEN, skipping verification');
    return true;
  }

  if (body.token && body.token === verificationToken) {
    return true;
  }

  console.error('[FeishuActions] Token verification failed');
  return false;
}

/**
 * Parse action from Feishu card callback
 * Feishu card action callbacks have a specific structure
 */
function parseAction(body) {
  // Card action callback structure
  const action = body.action || {};
  const value = action.value || {};

  // Extract from card action
  const actionType = value.action || body.event?.action?.value?.action || 'unknown';
  const traceId = value.trace_id || body.event?.action?.value?.trace_id || null;

  // User info
  const userId = body.open_id || body.user_id ||
    body.event?.operator?.open_id || 'unknown';
  const messageId = body.open_message_id ||
    body.event?.context?.open_message_id || null;
  const chatId = body.open_chat_id ||
    body.event?.context?.open_chat_id || null;

  return {
    actionType,
    traceId,
    userId,
    messageId,
    chatId
  };
}

/**
 * Write trace event for action
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
    console.error('[FeishuActions] Failed to write trace:', e.message);
  }
}

/**
 * Load trace context (verdict, task info) from trace directory
 */
function loadTraceContext(traceId, baseDir) {
  const traceDir = join(baseDir, traceId);
  let context = {
    decision: 'UNKNOWN',
    origin: 'unknown',
    mock_used: false,
    policy_version: 'unknown',
    task: '(unknown task)',
    tenant_id: 'default'
  };

  // Try to load verdict.json
  const verdictPath = join(traceDir, 'verdict.json');
  if (existsSync(verdictPath)) {
    try {
      const verdict = JSON.parse(readFileSync(verdictPath, 'utf-8'));
      context.decision = verdict.decision || context.decision;
    } catch (e) {
      console.warn('[FeishuActions] Could not load verdict:', e.message);
    }
  }

  // Try to load from events.ndjson
  const eventsPath = join(traceDir, 'events.ndjson');
  if (existsSync(eventsPath)) {
    try {
      const events = readFileSync(eventsPath, 'utf-8')
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line));

      // Find gateway.response event for full context
      const gatewayEvent = events.find(e => e.type === 'gateway.response');
      if (gatewayEvent?.meta) {
        context.origin = gatewayEvent.meta.origin || context.origin;
        context.mock_used = gatewayEvent.meta.mock_used ?? context.mock_used;
        context.policy_version = gatewayEvent.meta.policy_version || context.policy_version;
        context.decision = gatewayEvent.meta.decision || context.decision;
        context.tenant_id = gatewayEvent.meta.tenant_id || context.tenant_id;
      }

      // Find gate.start for task
      const gateStart = events.find(e => e.type === 'gate.start');
      if (gateStart?.payload?.task) {
        context.task = gateStart.payload.task;
      }

      // Find feishu.inbound for channel info
      const feishuInbound = events.find(e => e.type === 'feishu.inbound');
      if (feishuInbound) {
        context.channel = 'feishu';
      }
    } catch (e) {
      console.warn('[FeishuActions] Could not parse events:', e.message);
    }
  }

  return context;
}

/**
 * Handle Feishu card action callback
 *
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 * @param {Object} opts - Options
 * @param {string} opts.traceBaseDir - Base directory for traces
 * @param {string} opts.traceViewerBaseUrl - Base URL for trace viewer
 */
export async function handleFeishuAction(req, res, opts = {}) {
  const traceBaseDir = opts.traceBaseDir || '.liye/traces';
  const traceViewerBaseUrl = opts.traceViewerBaseUrl ||
    process.env.TRACE_VIEWER_BASE_URL ||
    'http://localhost:3210/trace';

  res.setHeader('Content-Type', 'application/json');

  // Parse body
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

  // Verify token
  if (!verifyAction(body)) {
    res.writeHead(401);
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    return;
  }

  // Parse action
  const { actionType, traceId, userId, messageId, chatId } = parseAction(body);

  console.log(`[FeishuActions] Received action: ${actionType}, trace: ${traceId}`);

  // Validate trace_id
  if (!traceId || traceId === 'unknown') {
    res.writeHead(400);
    res.end(JSON.stringify({
      ok: false,
      error: 'Missing trace_id in action payload'
    }));
    return;
  }

  const traceDir = join(traceBaseDir, traceId);

  // Write inbound trace event
  writeTraceEvent(traceDir, 'feishu.action.inbound', {
    action: actionType,
    trace_id: traceId,
    user_id: userId,
    message_id: messageId,
    chat_id: chatId
  });

  // Load trace context
  const context = loadTraceContext(traceId, traceBaseDir);

  // Handle action
  let result;
  let kind;

  if (actionType === 'run_dry_plan') {
    kind = 'dry_run_plan';
    result = writeEvidencePackage({
      trace_id: traceId,
      kind: 'dry_run_plan',
      data: {
        ...context,
        channel: 'feishu'
      },
      baseDir: traceBaseDir
    });
  } else if (actionType === 'generate_evidence') {
    kind = 'evidence_package';
    result = writeEvidencePackage({
      trace_id: traceId,
      kind: 'evidence_package',
      data: {
        ...context,
        channel: 'feishu'
      },
      baseDir: traceBaseDir
    });
  } else {
    // Unknown action
    res.writeHead(400);
    res.end(JSON.stringify({
      ok: false,
      error: `Unknown action: ${actionType}`
    }));
    return;
  }

  // Build evidence URL
  const evidenceUrl = `${traceViewerBaseUrl}/${traceId}/${result.fileName || 'evidence_package.md'}`;

  // Write outbound trace event
  writeTraceEvent(traceDir, 'feishu.action.outbound', {
    action: actionType,
    trace_id: traceId,
    status: result.success ? 'generated' : 'failed',
    evidence_url: result.success ? evidenceUrl : null,
    error: result.error
  });

  // Reply to Feishu with status card
  if (isConfigured() && chatId) {
    try {
      const statusCard = renderEvidenceStatusCard(
        traceId,
        result.success ? 'generated' : 'failed',
        result.success ? evidenceUrl : null,
        { traceViewerBaseUrl }
      );

      // Use sendMessage instead of replyMessage for action callbacks
      await sendMessage(chatId, statusCard);
      console.log('[FeishuActions] Status card sent to chat:', chatId);
    } catch (e) {
      console.error('[FeishuActions] Failed to send status card:', e.message);
    }
  }

  // Return success
  res.writeHead(200);
  res.end(JSON.stringify({
    ok: result.success,
    action: actionType,
    trace_id: traceId,
    evidence_url: result.success ? evidenceUrl : null,
    file_path: result.filePath,
    error: result.error
  }));
}

export default { handleFeishuAction };
