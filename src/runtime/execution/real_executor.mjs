/**
 * Real Executor
 *
 * Phase 2 Week 1: Executes approved action plans with real API calls
 *
 * Flow:
 * 1. Validate approval status is APPROVED
 * 2. Load action plan from trace directory
 * 3. For each action:
 *    - If write action: check write gate, execute if allowed
 *    - If read action: simulate (same as dry-run)
 * 4. Build rollback actions from API responses
 * 5. Return execution result with GUARANTEE fields
 *
 * Fail-Closed: Any gate failure = BLOCK (no DEGRADE)
 */

import { readFileSync, existsSync, appendFileSync } from 'fs';
import { join } from 'path';
import { checkWriteGate, buildRollbackAction } from './write_gate.mjs';

// AGE MCP configuration
const AGE_MCP_CONFIG = {
  base_url: process.env.AGE_MCP_URL || 'http://localhost:8765',
  timeout_ms: parseInt(process.env.AGE_MCP_TIMEOUT || '10000')
};

/**
 * Check if action type is a write operation
 */
function isWriteAction(actionType) {
  return ['write', 'delete', 'execute', 'send'].includes(actionType);
}

/**
 * Write trace event to events.ndjson
 */
function writeTraceEvent(traceDir, eventType, meta) {
  if (!traceDir) return;

  const eventsFile = join(traceDir, 'events.ndjson');
  const event = {
    ts: new Date().toISOString(),
    type: eventType,
    meta
  };

  try {
    appendFileSync(eventsFile, JSON.stringify(event) + '\n');
  } catch (e) {
    console.error('[RealExecutor] Failed to write trace:', e.message);
  }
}

/**
 * Execute real action through AGE MCP
 */
async function executeRealAction(action, traceId) {
  const url = `${AGE_MCP_CONFIG.base_url}/v1/tools/call`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AGE_MCP_CONFIG.timeout_ms);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: action.tool,
        arguments: action.arguments || {},
        trace_id: traceId,
        mode: 'real_write'
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return {
        success: false,
        error: `AGE MCP returned ${resp.status}`,
        data: null
      };
    }

    const data = await resp.json();
    return {
      success: true,
      data,
      request_id: data.request_id || null
    };

  } catch (err) {
    clearTimeout(timeout);
    console.error(`[RealExecutor] AGE MCP call failed:`, err.message);
    return {
      success: false,
      error: err.message,
      data: null
    };
  }
}

/**
 * Execute approved action plan with real writes
 *
 * @param {Object} opts - Execution options
 * @param {string} opts.trace_id - Trace identifier
 * @param {Object} opts.approval - Approval object (must be APPROVED)
 * @param {string} opts.baseDir - Base directory for traces
 * @returns {Object} Execution result
 */
export async function executeReal(opts) {
  const { trace_id, approval, baseDir = '.liye/traces' } = opts;
  const traceDir = join(baseDir, trace_id);

  // Validate approval status
  if (!approval || approval.status !== 'APPROVED') {
    throw new Error(`Cannot execute: approval status is ${approval?.status || 'MISSING'}`);
  }

  // Load action plan
  const planPath = join(traceDir, 'action_plan.json');
  if (!existsSync(planPath)) {
    throw new Error('Action plan not found');
  }

  let actionPlan;
  try {
    actionPlan = JSON.parse(readFileSync(planPath, 'utf-8'));
  } catch (e) {
    throw new Error(`Failed to load action plan: ${e.message}`);
  }

  const planId = actionPlan.plan_id || `plan-${trace_id}`;
  const actions = actionPlan.actions || [];

  // Write start event
  writeTraceEvent(traceDir, 'execution.real_write.started', {
    trace_id,
    plan_id: planId,
    action_count: actions.length
  });

  // Execute actions
  const executedActions = [];
  const rollbackActions = [];
  let writeCallsAttempted = 0;
  let writeCallsSucceeded = 0;
  let blockedActions = 0;
  let failedActions = 0;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const actionId = action.action_id || `action-${i + 1}`;
    const actionType = action.action_type || 'read';

    const executedAction = {
      action_id: actionId,
      tool: action.tool,
      action_type: actionType,
      arguments: action.arguments
    };

    if (isWriteAction(actionType)) {
      // Check write gate
      const gateResult = checkWriteGate({
        tool: action.tool,
        arguments: action.arguments,
        action_type: actionType,
        tenant_id: actionPlan.tenant_id
      });

      if (!gateResult.allowed) {
        // Blocked by gate
        blockedActions++;
        executedAction.result_status = 'BLOCKED';
        executedAction.gate_result = gateResult;
        executedAction.blocked_at = gateResult.blocked_at;
        executedAction.blocked_reason = gateResult.reason;
        executedAction.executed_at = new Date().toISOString();
      } else {
        // Gate passed, execute real write
        writeCallsAttempted++;

        const result = await executeRealAction(action, trace_id);

        if (result.success) {
          writeCallsSucceeded++;
          executedAction.result_status = 'EXECUTED';
          executedAction.response_data = result.data;
          executedAction.request_id = result.request_id;
          executedAction.executed_at = new Date().toISOString();

          // Build rollback action
          const rollback = buildRollbackAction(action, result.data);
          if (rollback) {
            rollbackActions.push({
              ...rollback,
              original_action_id: actionId,
              original_tool: action.tool
            });
            executedAction.rollback_info = rollback;
          }
        } else {
          failedActions++;
          executedAction.result_status = 'FAILED';
          executedAction.error = result.error;
          executedAction.executed_at = new Date().toISOString();
        }
      }
    } else {
      // Read/analyze actions - simulate (same as dry-run)
      executedAction.result_status = 'SIMULATED';
      executedAction.simulated_output = {
        message: 'Read operation simulated in real_write mode',
        would_execute: action.tool
      };
      executedAction.executed_at = new Date().toISOString();
    }

    executedActions.push(executedAction);
  }

  // Build execution result
  const executionResult = {
    trace_id,
    plan_id: planId,
    mode: 'real_write',
    approval: {
      status: approval.status,
      approved_by: approval.review?.reviewed_by,
      approved_at: approval.review?.reviewed_at
    },
    executed_at: new Date().toISOString(),
    summary: {
      total_actions: actions.length,
      executed_actions: writeCallsSucceeded,
      simulated_actions: executedActions.filter(a => a.result_status === 'SIMULATED').length,
      blocked_actions: blockedActions,
      failed_actions: failedActions,
      notes: writeCallsSucceeded > 0
        ? `${writeCallsSucceeded} write(s) succeeded` + (blockedActions > 0 ? `, ${blockedActions} blocked by gate` : '')
        : blockedActions > 0
          ? `All writes blocked by gate`
          : `No writes attempted`
    },
    actions: executedActions,
    rollback_actions: rollbackActions,
    GUARANTEE: {
      no_real_write: false,  // Real writes are enabled in Phase 2
      write_calls_attempted: writeCallsAttempted,
      write_calls_succeeded: writeCallsSucceeded,
      write_enabled_env: process.env.WRITE_ENABLED === '1'
    },
    origin: 'amazon-growth-engine',
    origin_proof: writeCallsSucceeded > 0
  };

  // Write completion event
  writeTraceEvent(traceDir, 'execution.real_write.completed', {
    trace_id,
    plan_id: planId,
    summary: executionResult.summary,
    GUARANTEE: executionResult.GUARANTEE
  });

  return executionResult;
}

export default { executeReal };
