/**
 * Feishu Actions Handler (Week3 + Week4 + Week5 + Phase2 Week1)
 *
 * Handles interactive card button click callbacks:
 * - run_dry_plan: Generate dry_run_plan.md (Week3)
 * - generate_evidence: Generate evidence_package.md (Week3)
 * - submit_approval: Generate action_plan and submit for approval (Week4)
 * - approve: Approve an action plan (Week4, RBAC enforced)
 * - reject: Reject an action plan (Week4, RBAC enforced)
 * - execute_dry_run: Execute approved plan in dry-run mode (Week5)
 * - execute_real: Execute approved plan with real writes (Phase2 Week1)
 * - generate_rollback: Generate rollback plan from execution result (Phase2 Week1)
 *
 * Thin-Agent Principle:
 * - Actions handler only generates files, no strategy decisions
 * - All files written to trace directory for audit
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'fs';

import { replyMessage, sendMessage, isConfigured } from './feishu_client.mjs';
import { renderEvidenceStatusCard, renderApprovalStatusCard, renderExecutionStatusCard } from './cards/render_verdict_card.mjs';
import { writeEvidencePackage, getEvidencePath } from '../../src/runtime/evidence/evidence_writer.mjs';
import { writeActionPlan, actionPlanExists } from '../../src/runtime/evidence/action_plan_writer.mjs';
import {
  initApproval,
  submitApproval,
  approve,
  reject,
  markExecuted,
  getApproval,
  approvalExists
} from '../../src/runtime/evidence/approval_writer.mjs';
import { executeDryRun } from '../../src/runtime/execution/dry_run_executor.mjs';
import { writeExecutionResult } from '../../src/runtime/evidence/execution_result_writer.mjs';
// Phase2 Week1: Real write execution and rollback
import { executeReal } from '../../src/runtime/execution/real_executor.mjs';
import { writeRollbackPlan, rollbackPlanExists } from '../../src/runtime/evidence/rollback_plan_writer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load tenant map for verification
let tenantMap = { default: { tenant_id: 'default', allowed_chat_ids: ['*'] } };
try {
  tenantMap = JSON.parse(readFileSync(join(__dirname, 'tenant_map.json'), 'utf-8'));
} catch (e) {
  console.warn('[FeishuActions] tenant_map.json not found, using defaults');
}

// Week4: Load approvers list for RBAC
let approversConfig = { default: { approver_user_ids: [] } };
try {
  approversConfig = JSON.parse(readFileSync(join(__dirname, 'approvers.json'), 'utf-8'));
} catch (e) {
  console.warn('[FeishuActions] approvers.json not found, approvals will be denied');
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
  const comment = value.comment || body.event?.action?.value?.comment || null;

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
    chatId,
    comment
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
 * Week4: Check if user is an approver (RBAC)
 */
function isApprover(userId, tenantId = 'default') {
  const config = approversConfig[tenantId] || approversConfig.default;
  const approverIds = config?.approver_user_ids || [];
  return approverIds.includes(userId);
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
  const { actionType, traceId, userId, messageId, chatId, comment } = parseAction(body);

  console.log(`[FeishuActions] Received action: ${actionType}, trace: ${traceId}, user: ${userId}`);

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

  // Handle action based on type
  let result;
  let statusCard;

  switch (actionType) {
    case 'run_dry_plan':
      result = await handleDryRunPlan(traceId, context, traceBaseDir, traceViewerBaseUrl);
      statusCard = renderEvidenceStatusCard(
        traceId,
        result.success ? 'generated' : 'failed',
        result.success ? result.evidenceUrl : null,
        { traceViewerBaseUrl }
      );
      break;

    case 'generate_evidence':
      result = await handleGenerateEvidence(traceId, context, traceBaseDir, traceViewerBaseUrl);
      statusCard = renderEvidenceStatusCard(
        traceId,
        result.success ? 'generated' : 'failed',
        result.success ? result.evidenceUrl : null,
        { traceViewerBaseUrl }
      );
      break;

    case 'submit_approval':
      result = await handleSubmitApproval(traceId, userId, context, traceBaseDir, traceViewerBaseUrl, { messageId, chatId });
      statusCard = renderApprovalStatusCard(traceId, result.approval, { traceViewerBaseUrl });
      break;

    case 'approve':
      result = await handleApprove(traceId, userId, context, traceBaseDir, traceViewerBaseUrl, { messageId, chatId, comment });
      statusCard = renderApprovalStatusCard(traceId, result.approval, { traceViewerBaseUrl });
      break;

    case 'reject':
      result = await handleReject(traceId, userId, context, traceBaseDir, traceViewerBaseUrl, { messageId, chatId, comment });
      statusCard = renderApprovalStatusCard(traceId, result.approval, { traceViewerBaseUrl });
      break;

    case 'execute_dry_run':
      result = await handleExecuteDryRun(traceId, userId, context, traceBaseDir, traceViewerBaseUrl, { messageId, chatId });
      statusCard = renderExecutionStatusCard(traceId, result.executionResult, { traceViewerBaseUrl });
      break;

    // Phase2 Week1: Real write execution
    case 'execute_real':
      result = await handleExecuteReal(traceId, userId, context, traceBaseDir, traceViewerBaseUrl, { messageId, chatId });
      statusCard = renderExecutionStatusCard(traceId, result.executionResult, { traceViewerBaseUrl, mode: 'real_write' });
      break;

    // Phase2 Week1: Generate rollback plan
    case 'generate_rollback':
      result = await handleGenerateRollback(traceId, userId, context, traceBaseDir, traceViewerBaseUrl, { messageId, chatId });
      statusCard = renderExecutionStatusCard(traceId, result.rollbackPlan, { traceViewerBaseUrl, isRollback: true });
      break;

    default:
      res.writeHead(400);
      res.end(JSON.stringify({
        ok: false,
        error: `Unknown action: ${actionType}`
      }));
      return;
  }

  // Write outbound trace event
  writeTraceEvent(traceDir, 'feishu.action.outbound', {
    action: actionType,
    trace_id: traceId,
    status: result.success ? 'success' : 'failed',
    error: result.error
  });

  // Reply to Feishu with status card
  if (isConfigured() && chatId && statusCard) {
    try {
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
    ...result
  }));
}

// --- Week3 Handlers ---

async function handleDryRunPlan(traceId, context, traceBaseDir, traceViewerBaseUrl) {
  const result = writeEvidencePackage({
    trace_id: traceId,
    kind: 'dry_run_plan',
    data: {
      ...context,
      channel: 'feishu'
    },
    baseDir: traceBaseDir
  });

  const evidenceUrl = result.success
    ? `${traceViewerBaseUrl}/${traceId}/${result.fileName || 'dry_run_plan.md'}`
    : null;

  return {
    success: result.success,
    evidenceUrl,
    filePath: result.filePath,
    error: result.error
  };
}

async function handleGenerateEvidence(traceId, context, traceBaseDir, traceViewerBaseUrl) {
  const result = writeEvidencePackage({
    trace_id: traceId,
    kind: 'evidence_package',
    data: {
      ...context,
      channel: 'feishu'
    },
    baseDir: traceBaseDir
  });

  const evidenceUrl = result.success
    ? `${traceViewerBaseUrl}/${traceId}/${result.fileName || 'evidence_package.md'}`
    : null;

  return {
    success: result.success,
    evidenceUrl,
    filePath: result.filePath,
    error: result.error
  };
}

// --- Week4 Handlers ---

async function handleSubmitApproval(traceId, userId, context, traceBaseDir, traceViewerBaseUrl, meta) {
  const traceDir = join(traceBaseDir, traceId);

  // Step 1: Generate action plan if not exists
  if (!actionPlanExists(traceId, traceBaseDir)) {
    const planResult = writeActionPlan({
      trace_id: traceId,
      tenant_id: context.tenant_id,
      user_message: context.task,
      verdict: { decision: context.decision },
      policy_version: context.policy_version,
      baseDir: traceBaseDir
    });

    if (!planResult.success) {
      return {
        success: false,
        error: `Failed to generate action plan: ${planResult.error}`
      };
    }

    // Write plan.frozen event
    writeTraceEvent(traceDir, 'plan.frozen', {
      trace_id: traceId,
      plan_id: planResult.plan_id,
      actor: userId
    });
  }

  // Step 2: Initialize approval if not exists
  const plan_id = `plan-${traceId}`;
  if (!approvalExists(traceId, traceBaseDir)) {
    const initResult = initApproval({
      trace_id: traceId,
      plan_id,
      actor: userId,
      meta,
      baseDir: traceBaseDir
    });

    if (!initResult.success) {
      return {
        success: false,
        error: `Failed to init approval: ${initResult.error}`
      };
    }
  }

  // Step 3: Submit approval
  const submitResult = submitApproval({
    trace_id: traceId,
    actor: userId,
    meta,
    baseDir: traceBaseDir
  });

  if (!submitResult.success) {
    return {
      success: false,
      error: submitResult.error,
      approval: getApproval(traceId, traceBaseDir)
    };
  }

  return {
    success: true,
    approval: submitResult.approval,
    plan_url: `${traceViewerBaseUrl}/${traceId}/action_plan.md`
  };
}

async function handleApprove(traceId, userId, context, traceBaseDir, traceViewerBaseUrl, meta) {
  // RBAC check
  if (!isApprover(userId, context.tenant_id)) {
    return {
      success: false,
      error: `User ${userId} is not authorized to approve. Contact admin to be added to approvers list.`,
      approval: getApproval(traceId, traceBaseDir)
    };
  }

  // Approve
  const result = approve({
    trace_id: traceId,
    actor: userId,
    meta: { message_id: meta.messageId, chat_id: meta.chatId },
    comment: meta.comment,
    baseDir: traceBaseDir
  });

  return {
    success: result.success,
    error: result.error,
    approval: result.approval || getApproval(traceId, traceBaseDir)
  };
}

async function handleReject(traceId, userId, context, traceBaseDir, traceViewerBaseUrl, meta) {
  // RBAC check
  if (!isApprover(userId, context.tenant_id)) {
    return {
      success: false,
      error: `User ${userId} is not authorized to reject. Contact admin to be added to approvers list.`,
      approval: getApproval(traceId, traceBaseDir)
    };
  }

  // Reject
  const result = reject({
    trace_id: traceId,
    actor: userId,
    meta: { message_id: meta.messageId, chat_id: meta.chatId },
    comment: meta.comment,
    baseDir: traceBaseDir
  });

  return {
    success: result.success,
    error: result.error,
    approval: result.approval || getApproval(traceId, traceBaseDir)
  };
}

// --- Week5 Handlers ---

async function handleExecuteDryRun(traceId, userId, context, traceBaseDir, traceViewerBaseUrl, meta) {
  const traceDir = join(traceBaseDir, traceId);

  // Step 1: Check approval status - must be APPROVED
  const approval = getApproval(traceId, traceBaseDir);
  if (!approval) {
    return {
      success: false,
      error: 'Approval not found. Please submit for approval first.',
      executionResult: null
    };
  }

  if (approval.status !== 'APPROVED') {
    return {
      success: false,
      error: `Cannot execute: approval status is ${approval.status}. Must be APPROVED first.`,
      executionResult: null
    };
  }

  // Step 2: Check action plan exists
  if (!actionPlanExists(traceId, traceBaseDir)) {
    return {
      success: false,
      error: 'Action plan not found. Please submit for approval to generate plan.',
      executionResult: null
    };
  }

  // Step 3: Write trace event - started
  writeTraceEvent(traceDir, 'execution.dry_run.started', {
    trace_id: traceId,
    user_id: userId,
    message_id: meta.messageId,
    chat_id: meta.chatId
  });

  try {
    // Step 4: Run dry-run executor
    const executionResult = executeDryRun({
      trace_id: traceId,
      approval,
      baseDir: traceBaseDir
    });

    // Step 5: Write execution result to files
    const writeResult = writeExecutionResult({
      trace_id: traceId,
      executionResult,
      baseDir: traceBaseDir
    });

    if (!writeResult.success) {
      throw new Error(`Failed to write execution result: ${writeResult.error}`);
    }

    // Step 6: Mark approval as EXECUTED
    const markResult = markExecuted({
      trace_id: traceId,
      actor: userId,
      meta: { message_id: meta.messageId, chat_id: meta.chatId },
      baseDir: traceBaseDir
    });

    if (!markResult.success) {
      console.warn(`[FeishuActions] Failed to mark executed: ${markResult.error}`);
    }

    // Step 7: Write trace event - completed
    writeTraceEvent(traceDir, 'execution.dry_run.completed', {
      trace_id: traceId,
      plan_id: executionResult.plan_id,
      user_id: userId,
      summary: executionResult.summary,
      GUARANTEE: executionResult.GUARANTEE
    });

    return {
      success: true,
      executionResult,
      execution_url: `${traceViewerBaseUrl}/${traceId}/execution_result.md`
    };

  } catch (e) {
    console.error('[FeishuActions] Dry-run execution failed:', e.message);

    // Write failed event
    writeTraceEvent(traceDir, 'execution.dry_run.failed', {
      trace_id: traceId,
      user_id: userId,
      error: e.message
    });

    return {
      success: false,
      error: e.message,
      executionResult: null
    };
  }
}

// --- Phase2 Week1 Handlers ---

/**
 * Handle execute_real action - Execute approved plan with real writes
 *
 * Gate checks:
 * 1. Approval status must be APPROVED
 * 2. Action plan must exist
 * 3. Write gate validation (four-layer)
 *
 * Produces:
 * - execution_result.json/md with mode="real_write"
 * - Rollback actions captured for rollback plan generation
 */
async function handleExecuteReal(traceId, userId, context, traceBaseDir, traceViewerBaseUrl, meta) {
  const traceDir = join(traceBaseDir, traceId);

  // Step 1: Check approval status - must be APPROVED
  const approval = getApproval(traceId, traceBaseDir);
  if (!approval) {
    return {
      success: false,
      error: 'Approval not found. Please submit for approval first.',
      executionResult: null
    };
  }

  if (approval.status !== 'APPROVED') {
    return {
      success: false,
      error: `Cannot execute: approval status is ${approval.status}. Must be APPROVED first.`,
      executionResult: null
    };
  }

  // Step 2: Check action plan exists
  if (!actionPlanExists(traceId, traceBaseDir)) {
    return {
      success: false,
      error: 'Action plan not found. Please submit for approval to generate plan.',
      executionResult: null
    };
  }

  // Step 3: Write trace event - started
  writeTraceEvent(traceDir, 'execution.real_write.started', {
    trace_id: traceId,
    user_id: userId,
    message_id: meta.messageId,
    chat_id: meta.chatId
  });

  try {
    // Step 4: Run real executor (includes write gate checks)
    const executionResult = await executeReal({
      trace_id: traceId,
      approval,
      baseDir: traceBaseDir
    });

    // Step 5: Write execution result to files
    const writeResult = writeExecutionResult({
      trace_id: traceId,
      executionResult,
      baseDir: traceBaseDir
    });

    if (!writeResult.success) {
      throw new Error(`Failed to write execution result: ${writeResult.error}`);
    }

    // Step 6: Auto-generate rollback plan if writes succeeded
    if (executionResult.rollback_actions && executionResult.rollback_actions.length > 0) {
      const rollbackResult = writeRollbackPlan({
        trace_id: traceId,
        plan_id: executionResult.plan_id,
        execution_result: executionResult,
        rollback_actions: executionResult.rollback_actions,
        baseDir: traceBaseDir
      });

      if (!rollbackResult.success) {
        console.warn(`[FeishuActions] Failed to write rollback plan: ${rollbackResult.error}`);
      } else {
        writeTraceEvent(traceDir, 'rollback.plan.generated', {
          trace_id: traceId,
          rollback_plan_id: rollbackResult.rollback_plan_id,
          actions_count: executionResult.rollback_actions.length
        });
      }
    }

    // Step 7: Mark approval as EXECUTED
    const markResult = markExecuted({
      trace_id: traceId,
      actor: userId,
      meta: { message_id: meta.messageId, chat_id: meta.chatId, mode: 'real_write' },
      baseDir: traceBaseDir
    });

    if (!markResult.success) {
      console.warn(`[FeishuActions] Failed to mark executed: ${markResult.error}`);
    }

    // Step 8: Write trace event - completed
    writeTraceEvent(traceDir, 'execution.real_write.completed', {
      trace_id: traceId,
      plan_id: executionResult.plan_id,
      user_id: userId,
      summary: executionResult.summary,
      GUARANTEE: executionResult.GUARANTEE,
      rollback_available: executionResult.rollback_actions?.length > 0
    });

    return {
      success: true,
      executionResult,
      execution_url: `${traceViewerBaseUrl}/${traceId}/execution_result.md`,
      rollback_url: executionResult.rollback_actions?.length > 0
        ? `${traceViewerBaseUrl}/${traceId}/rollback_plan.md`
        : null
    };

  } catch (e) {
    console.error('[FeishuActions] Real write execution failed:', e.message);

    // Write failed event
    writeTraceEvent(traceDir, 'execution.real_write.failed', {
      trace_id: traceId,
      user_id: userId,
      error: e.message
    });

    return {
      success: false,
      error: e.message,
      executionResult: null
    };
  }
}

/**
 * Handle generate_rollback action - Generate rollback plan from execution result
 *
 * Produces:
 * - rollback_plan.json/md with inverse operations
 */
async function handleGenerateRollback(traceId, userId, context, traceBaseDir, traceViewerBaseUrl, meta) {
  const traceDir = join(traceBaseDir, traceId);

  // Step 1: Check if rollback plan already exists
  if (rollbackPlanExists(traceId, traceBaseDir)) {
    return {
      success: true,
      message: 'Rollback plan already exists',
      rollback_url: `${traceViewerBaseUrl}/${traceId}/rollback_plan.md`
    };
  }

  // Step 2: Load execution result
  const executionResultPath = join(traceDir, 'execution_result.json');
  if (!existsSync(executionResultPath)) {
    return {
      success: false,
      error: 'Execution result not found. Please execute the plan first.'
    };
  }

  let executionResult;
  try {
    executionResult = JSON.parse(readFileSync(executionResultPath, 'utf-8'));
  } catch (e) {
    return {
      success: false,
      error: `Failed to load execution result: ${e.message}`
    };
  }

  // Step 3: Check if there are any writes to rollback
  if (!executionResult.rollback_actions || executionResult.rollback_actions.length === 0) {
    // Try to build rollback from actions
    const rollbackActions = [];
    if (executionResult.actions) {
      for (const action of executionResult.actions) {
        if (action.result_status === 'EXECUTED' && action.rollback_info) {
          rollbackActions.push(action.rollback_info);
        }
      }
    }

    if (rollbackActions.length === 0) {
      return {
        success: false,
        error: 'No writes found to rollback. Only executed real writes can be rolled back.'
      };
    }

    executionResult.rollback_actions = rollbackActions;
  }

  // Step 4: Write trace event
  writeTraceEvent(traceDir, 'rollback.plan.requested', {
    trace_id: traceId,
    user_id: userId,
    message_id: meta.messageId
  });

  try {
    // Step 5: Generate rollback plan
    const rollbackResult = writeRollbackPlan({
      trace_id: traceId,
      plan_id: executionResult.plan_id,
      execution_result: executionResult,
      rollback_actions: executionResult.rollback_actions,
      baseDir: traceBaseDir
    });

    if (!rollbackResult.success) {
      throw new Error(rollbackResult.error);
    }

    // Step 6: Write success event
    writeTraceEvent(traceDir, 'rollback.plan.generated', {
      trace_id: traceId,
      rollback_plan_id: rollbackResult.rollback_plan_id,
      actions_count: executionResult.rollback_actions.length,
      user_id: userId
    });

    return {
      success: true,
      rollbackPlan: {
        rollback_plan_id: rollbackResult.rollback_plan_id,
        actions_count: executionResult.rollback_actions.length,
        validity_until: rollbackResult.validity_until
      },
      rollback_url: `${traceViewerBaseUrl}/${traceId}/rollback_plan.md`
    };

  } catch (e) {
    console.error('[FeishuActions] Rollback plan generation failed:', e.message);

    writeTraceEvent(traceDir, 'rollback.plan.failed', {
      trace_id: traceId,
      user_id: userId,
      error: e.message
    });

    return {
      success: false,
      error: e.message
    };
  }
}

export default { handleFeishuAction };
