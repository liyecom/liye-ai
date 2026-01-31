/**
 * Dry-Run Executor
 *
 * Executes an approved action plan in dry-run mode.
 * No real tool calls are made - all actions are simulated.
 *
 * Week5: Consumes action_plan.json, produces execution_result
 *
 * GUARANTEE:
 * - no_real_write: true
 * - write_calls_attempted: 0
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const TRACE_BASE_DIR = process.env.TRACE_BASE_DIR || '.liye/traces';

// Action types that are write operations (blocked in dry-run)
const WRITE_ACTION_TYPES = ['write', 'delete', 'execute', 'send'];

// Action types that are read operations (simulated in dry-run)
const READ_ACTION_TYPES = ['read', 'analyze'];

/**
 * Execute a plan in dry-run mode
 *
 * @param {Object} params
 * @param {string} params.trace_id - Trace identifier
 * @param {Object} params.approval - Approval object (must be APPROVED)
 * @param {string} params.baseDir - Base directory for traces
 * @returns {Object} Execution result conforming to EXECUTION_RESULT_V1
 */
export function executeDryRun({ trace_id, approval, baseDir }) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const traceDir = join(traceBaseDir, trace_id);

  // Load action plan
  const planPath = join(traceDir, 'action_plan.json');
  if (!existsSync(planPath)) {
    throw new Error(`Action plan not found: ${planPath}`);
  }

  const plan = JSON.parse(readFileSync(planPath, 'utf-8'));

  // Validate approval status
  if (!approval || approval.status !== 'APPROVED') {
    throw new Error('Execution requires APPROVED status');
  }

  const now = new Date().toISOString();

  // Execute each action in dry-run mode
  const actionResults = [];
  let simulatedCount = 0;
  let blockedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const action of plan.actions) {
    const result = executeActionDryRun(action);
    actionResults.push(result);

    switch (result.result_status) {
      case 'SIMULATED':
        simulatedCount++;
        break;
      case 'BLOCKED':
        blockedCount++;
        break;
      case 'SKIPPED':
        skippedCount++;
        break;
      case 'FAILED':
        failedCount++;
        break;
    }
  }

  // Build execution result
  const executionResult = {
    trace_id,
    plan_id: plan.plan_id,
    tenant_id: plan.tenant_id,
    executed_at: now,
    mode: 'dry_run',
    approval: {
      status: 'APPROVED',
      reviewed_by: approval.review?.reviewed_by || 'unknown',
      reviewed_at: approval.review?.reviewed_at || now
    },
    summary: {
      total_actions: plan.actions.length,
      simulated_actions: simulatedCount,
      blocked_actions: blockedCount,
      skipped_actions: skippedCount,
      failed_actions: failedCount,
      notes: generateSummaryNotes(simulatedCount, blockedCount, plan.actions.length)
    },
    actions: actionResults,
    GUARANTEE: {
      no_real_write: true,
      write_calls_attempted: 0,
      write_enabled_env: process.env.WRITE_ENABLED === '1' ? '1' : '0'
    },
    origin: 'liye_os.dry_run_executor'
  };

  console.log(`[DryRunExecutor] Executed plan ${plan.plan_id}: ${simulatedCount} simulated, ${blockedCount} blocked`);
  return executionResult;
}

/**
 * Execute a single action in dry-run mode
 *
 * @param {Object} action - Action from plan
 * @returns {Object} Action result
 */
function executeActionDryRun(action) {
  const { action_id, action_type, tool, arguments: args } = action;

  // Hash arguments to avoid exposing sensitive data
  const argsHash = hashArguments(args);

  // Determine result based on action type
  if (WRITE_ACTION_TYPES.includes(action_type)) {
    // Write actions are BLOCKED (not actually called)
    return {
      action_id,
      action_type,
      tool,
      arguments_hash: argsHash,
      result_status: 'BLOCKED',
      reason: `Write action blocked in dry-run mode (WRITE_ENABLED=0)`
    };
  }

  if (READ_ACTION_TYPES.includes(action_type)) {
    // Read/analyze actions are SIMULATED
    const simulatedOutput = generateSimulatedOutput(tool, args);
    return {
      action_id,
      action_type,
      tool,
      arguments_hash: argsHash,
      result_status: 'SIMULATED',
      reason: 'Action simulated in dry-run mode (no real API call)',
      simulated_output: simulatedOutput
    };
  }

  // Unknown action types are SKIPPED
  return {
    action_id,
    action_type,
    tool,
    arguments_hash: argsHash,
    result_status: 'SKIPPED',
    reason: `Unknown action type: ${action_type}`
  };
}

/**
 * Hash arguments to avoid exposing sensitive data
 */
function hashArguments(args) {
  if (!args) return 'empty';
  const json = JSON.stringify(args);
  return createHash('sha256').update(json).digest('hex').substring(0, 16);
}

/**
 * Generate simulated output for read/analyze actions
 */
function generateSimulatedOutput(tool, args) {
  // Provide meaningful simulated output based on tool type
  if (tool.includes('campaign') || tool.includes('metrics')) {
    return {
      simulated: true,
      message: 'Simulated campaign metrics response',
      data: {
        acos: 'N/A (simulated)',
        spend: 'N/A (simulated)',
        sales: 'N/A (simulated)',
        clicks: 'N/A (simulated)',
        impressions: 'N/A (simulated)'
      }
    };
  }

  if (tool.includes('wasted') || tool.includes('analyze')) {
    return {
      simulated: true,
      message: 'Simulated analysis response',
      data: {
        candidates: [],
        total_wasted_spend: 0,
        analysis_note: 'No real data - dry-run simulation'
      }
    };
  }

  // Generic simulated output
  return {
    simulated: true,
    message: `Simulated ${tool} response`,
    tool,
    arguments_received: args ? Object.keys(args) : []
  };
}

/**
 * Generate summary notes
 */
function generateSummaryNotes(simulated, blocked, total) {
  if (blocked === 0) {
    return `All ${total} actions simulated successfully (no write actions)`;
  }
  return `${simulated} actions simulated, ${blocked} write actions blocked (WRITE_ENABLED=0)`;
}

/**
 * Load action plan from trace directory
 */
export function loadActionPlan(trace_id, baseDir) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const planPath = join(traceBaseDir, trace_id, 'action_plan.json');

  if (!existsSync(planPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(planPath, 'utf-8'));
  } catch (e) {
    console.error('[DryRunExecutor] Failed to load plan:', e.message);
    return null;
  }
}

export default { executeDryRun, loadActionPlan };
