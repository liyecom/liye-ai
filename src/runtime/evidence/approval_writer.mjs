/**
 * Approval Writer
 *
 * Manages approval.json state machine for action plans.
 * State transitions: DRAFT → SUBMITTED → APPROVED/REJECTED → EXECUTED
 *
 * Week4: Approval workflow with RBAC enforcement
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

const TRACE_BASE_DIR = process.env.TRACE_BASE_DIR || '.liye/traces';

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['EXECUTED'],
  REJECTED: [],
  EXECUTED: []
};

/**
 * Initialize approval for a plan
 *
 * @param {Object} params
 * @param {string} params.trace_id - Trace identifier
 * @param {string} params.plan_id - Plan identifier
 * @param {string} params.actor - User who created the approval
 * @param {Object} params.meta - Additional metadata
 * @param {string} params.baseDir - Base directory for traces
 * @returns {Object} { success, approval, error }
 */
export function initApproval({ trace_id, plan_id, actor, meta = {}, baseDir }) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const traceDir = join(traceBaseDir, trace_id);
  const approvalPath = join(traceDir, 'approval.json');

  try {
    // Ensure trace directory exists
    if (!existsSync(traceDir)) {
      mkdirSync(traceDir, { recursive: true });
    }

    const now = new Date().toISOString();

    const approval = {
      trace_id,
      plan_id,
      status: 'DRAFT',
      audit_log: [{
        ts: now,
        actor: actor || 'system',
        event: 'created',
        meta
      }]
    };

    writeFileSync(approvalPath, JSON.stringify(approval, null, 2), 'utf-8');

    // Write trace event
    writeTraceEvent(traceDir, 'approval.created', {
      trace_id,
      plan_id,
      actor,
      status: 'DRAFT'
    });

    console.log(`[ApprovalWriter] Initialized approval at ${approvalPath}`);
    return { success: true, approval };

  } catch (e) {
    console.error('[ApprovalWriter] Failed to init approval:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Submit approval request
 *
 * @param {Object} params
 * @param {string} params.trace_id - Trace identifier
 * @param {string} params.actor - User submitting the request
 * @param {Object} params.meta - Additional metadata (message_id, chat_id)
 * @param {string} params.baseDir - Base directory for traces
 * @returns {Object} { success, approval, error }
 */
export function submitApproval({ trace_id, actor, meta = {}, baseDir }) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const traceDir = join(traceBaseDir, trace_id);

  try {
    const approval = loadApproval(traceDir);
    if (!approval) {
      return { success: false, error: 'Approval not found' };
    }

    // Validate transition
    if (!VALID_TRANSITIONS[approval.status]?.includes('SUBMITTED')) {
      return {
        success: false,
        error: `Cannot submit from status: ${approval.status}`
      };
    }

    const now = new Date().toISOString();

    // Update approval
    approval.status = 'SUBMITTED';
    approval.submitted_by = actor;
    approval.submitted_at = now;
    approval.audit_log.push({
      ts: now,
      actor,
      event: 'submitted',
      meta
    });

    saveApproval(traceDir, approval);

    // Write trace event
    writeTraceEvent(traceDir, 'approval.submitted', {
      trace_id,
      plan_id: approval.plan_id,
      actor,
      status: 'SUBMITTED',
      meta
    });

    console.log(`[ApprovalWriter] Approval submitted for ${trace_id}`);
    return { success: true, approval };

  } catch (e) {
    console.error('[ApprovalWriter] Failed to submit:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Approve an approval request
 *
 * @param {Object} params
 * @param {string} params.trace_id - Trace identifier
 * @param {string} params.actor - Approver user_id
 * @param {Object} params.meta - Additional metadata
 * @param {string} params.comment - Optional approval comment
 * @param {string} params.baseDir - Base directory for traces
 * @returns {Object} { success, approval, error }
 */
export function approve({ trace_id, actor, meta = {}, comment, baseDir }) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const traceDir = join(traceBaseDir, trace_id);

  try {
    const approval = loadApproval(traceDir);
    if (!approval) {
      return { success: false, error: 'Approval not found' };
    }

    // Validate transition
    if (!VALID_TRANSITIONS[approval.status]?.includes('APPROVED')) {
      return {
        success: false,
        error: `Cannot approve from status: ${approval.status}`
      };
    }

    const now = new Date().toISOString();

    // Update approval
    approval.status = 'APPROVED';
    approval.review = {
      reviewed_by: actor,
      reviewed_at: now,
      decision: 'APPROVE',
      comment: comment || null
    };
    approval.audit_log.push({
      ts: now,
      actor,
      event: 'approved',
      meta
    });

    saveApproval(traceDir, approval);

    // Write trace event
    writeTraceEvent(traceDir, 'approval.approved', {
      trace_id,
      plan_id: approval.plan_id,
      actor,
      status: 'APPROVED',
      comment,
      meta
    });

    console.log(`[ApprovalWriter] Approval approved for ${trace_id}`);
    return { success: true, approval };

  } catch (e) {
    console.error('[ApprovalWriter] Failed to approve:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Reject an approval request
 *
 * @param {Object} params
 * @param {string} params.trace_id - Trace identifier
 * @param {string} params.actor - Rejector user_id
 * @param {Object} params.meta - Additional metadata
 * @param {string} params.comment - Optional rejection reason
 * @param {string} params.baseDir - Base directory for traces
 * @returns {Object} { success, approval, error }
 */
export function reject({ trace_id, actor, meta = {}, comment, baseDir }) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const traceDir = join(traceBaseDir, trace_id);

  try {
    const approval = loadApproval(traceDir);
    if (!approval) {
      return { success: false, error: 'Approval not found' };
    }

    // Validate transition
    if (!VALID_TRANSITIONS[approval.status]?.includes('REJECTED')) {
      return {
        success: false,
        error: `Cannot reject from status: ${approval.status}`
      };
    }

    const now = new Date().toISOString();

    // Update approval
    approval.status = 'REJECTED';
    approval.review = {
      reviewed_by: actor,
      reviewed_at: now,
      decision: 'REJECT',
      comment: comment || null
    };
    approval.audit_log.push({
      ts: now,
      actor,
      event: 'rejected',
      meta
    });

    saveApproval(traceDir, approval);

    // Write trace event
    writeTraceEvent(traceDir, 'approval.rejected', {
      trace_id,
      plan_id: approval.plan_id,
      actor,
      status: 'REJECTED',
      comment,
      meta
    });

    console.log(`[ApprovalWriter] Approval rejected for ${trace_id}`);
    return { success: true, approval };

  } catch (e) {
    console.error('[ApprovalWriter] Failed to reject:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * P6-C Enhanced Approval
 *
 * Requires structured review with Why/Evidence/Risk checks.
 * See docs/sops/P6C_HUMAN_APPROVAL_SOP.md for full checklist.
 *
 * @param {Object} params
 * @param {string} params.trace_id - Trace identifier
 * @param {string} params.actor - Approver user_id
 * @param {Object} params.why_check - { reason_clear, observation_valid, action_appropriate }
 * @param {Object} params.evidence_check - { exists, fresh, supports }
 * @param {Object} params.risk_check - { rollback_clear, time_estimate, impact_bounded }
 * @param {string} params.comment - Optional approval comment
 * @param {string} params.baseDir - Base directory for traces
 * @returns {Object} { success, approval, error }
 */
export function approveP6C({
  trace_id,
  actor,
  why_check,
  evidence_check,
  risk_check,
  comment,
  baseDir
}) {
  // Validate all checks are provided
  if (!why_check || !evidence_check || !risk_check) {
    return { success: false, error: 'P6-C requires why_check, evidence_check, and risk_check' };
  }

  // All checks must pass for APPROVE
  const allPass =
    why_check.reason_clear &&
    why_check.observation_valid &&
    why_check.action_appropriate &&
    evidence_check.exists &&
    evidence_check.fresh &&
    evidence_check.supports &&
    risk_check.rollback_clear &&
    risk_check.impact_bounded;

  if (!allPass) {
    return { success: false, error: 'Not all P6-C checks passed. Use reject() or defer() instead.' };
  }

  return approve({
    trace_id,
    actor,
    meta: { p6c: true, why_check, evidence_check, risk_check },
    comment,
    baseDir
  });
}

/**
 * Mark approval as executed (dry-run completed)
 *
 * Week5: APPROVED → EXECUTED
 *
 * @param {Object} params
 * @param {string} params.trace_id - Trace identifier
 * @param {string} params.actor - User/system that executed
 * @param {Object} params.meta - Additional metadata
 * @param {string} params.baseDir - Base directory for traces
 * @returns {Object} { success, approval, error }
 */
export function markExecuted({ trace_id, actor, meta = {}, baseDir }) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const traceDir = join(traceBaseDir, trace_id);

  try {
    const approval = loadApproval(traceDir);
    if (!approval) {
      return { success: false, error: 'Approval not found' };
    }

    // Validate transition
    if (!VALID_TRANSITIONS[approval.status]?.includes('EXECUTED')) {
      return {
        success: false,
        error: `Cannot mark executed from status: ${approval.status}. Must be APPROVED first.`
      };
    }

    const now = new Date().toISOString();

    // Update approval
    approval.status = 'EXECUTED';
    approval.executed_by = actor;
    approval.executed_at = now;
    approval.audit_log.push({
      ts: now,
      actor,
      event: 'executed',
      meta
    });

    saveApproval(traceDir, approval);

    // Write trace event
    writeTraceEvent(traceDir, 'approval.executed', {
      trace_id,
      plan_id: approval.plan_id,
      actor,
      status: 'EXECUTED',
      meta
    });

    console.log(`[ApprovalWriter] Approval marked executed for ${trace_id}`);
    return { success: true, approval };

  } catch (e) {
    console.error('[ApprovalWriter] Failed to mark executed:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Get current approval status
 *
 * @param {string} trace_id - Trace identifier
 * @param {string} baseDir - Base directory for traces
 * @returns {Object|null} Approval object or null
 */
export function getApproval(trace_id, baseDir) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const traceDir = join(traceBaseDir, trace_id);
  return loadApproval(traceDir);
}

/**
 * Check if approval exists
 */
export function approvalExists(trace_id, baseDir) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const approvalPath = join(traceBaseDir, trace_id, 'approval.json');
  return existsSync(approvalPath);
}

// --- Internal Helpers ---

function loadApproval(traceDir) {
  const approvalPath = join(traceDir, 'approval.json');
  if (!existsSync(approvalPath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(approvalPath, 'utf-8'));
  } catch (e) {
    console.error('[ApprovalWriter] Failed to load approval:', e.message);
    return null;
  }
}

function saveApproval(traceDir, approval) {
  const approvalPath = join(traceDir, 'approval.json');
  writeFileSync(approvalPath, JSON.stringify(approval, null, 2), 'utf-8');
}

function writeTraceEvent(traceDir, eventType, meta) {
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
    console.error('[ApprovalWriter] Failed to write trace:', e.message);
  }
}

export default {
  initApproval,
  submitApproval,
  approve,
  approveP6C,
  reject,
  markExecuted,
  getApproval,
  approvalExists
};
