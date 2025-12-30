/**
 * Approval Manager
 * Handles semi-auto approval logic for missions
 */

const fs = require('fs');
const path = require('path');
const { readJson, writeJson } = require('../mission/utils');
const { matchesReapprovePattern, getApprovalPolicy } = require('./load');

/**
 * Approval modes
 */
const ApprovalMode = {
  NONE: 'none',
  SEMI_AUTO: 'semi-auto',
  MANUAL: 'manual',
};

/**
 * Get approval state from mission meta.json
 */
function getApprovalState(missionDir) {
  const metaPath = path.join(missionDir, 'meta.json');

  if (!fs.existsSync(metaPath)) {
    return { mode: ApprovalMode.SEMI_AUTO, granted: false };
  }

  const meta = readJson(metaPath);
  const approval = meta.approval || {};

  return {
    mode: approval.mode || ApprovalMode.SEMI_AUTO,
    granted: !!approval.granted_at,
    granted_at: approval.granted_at,
    granted_by: approval.granted_by,
  };
}

/**
 * Grant approval for a mission (semi-auto mode)
 */
function grantApproval(missionDir, grantedBy = 'user') {
  const metaPath = path.join(missionDir, 'meta.json');
  let meta = {};

  if (fs.existsSync(metaPath)) {
    meta = readJson(metaPath);
  }

  meta.approval = meta.approval || {};
  meta.approval.mode = ApprovalMode.SEMI_AUTO;
  meta.approval.granted_at = new Date().toISOString();
  meta.approval.granted_by = grantedBy;

  writeJson(metaPath, meta);

  return {
    success: true,
    granted_at: meta.approval.granted_at,
  };
}

/**
 * Revoke approval for a mission
 */
function revokeApproval(missionDir) {
  const metaPath = path.join(missionDir, 'meta.json');

  if (!fs.existsSync(metaPath)) {
    return { success: false, reason: 'meta.json not found' };
  }

  const meta = readJson(metaPath);

  if (meta.approval) {
    delete meta.approval.granted_at;
    delete meta.approval.granted_by;
    meta.approval.revoked_at = new Date().toISOString();
  }

  writeJson(metaPath, meta);

  return { success: true };
}

/**
 * Check if action is allowed under current approval state
 * Returns: { allowed, reason, requires_reapproval }
 */
function checkApproval(missionDir, action, repoRoot) {
  const state = getApprovalState(missionDir);
  const policy = getApprovalPolicy(repoRoot);

  // Mode: none - always allowed (for read-only operations)
  if (state.mode === ApprovalMode.NONE) {
    return { allowed: true, reason: 'Approval mode is none' };
  }

  // Mode: manual - always requires explicit approval
  if (state.mode === ApprovalMode.MANUAL) {
    return {
      allowed: false,
      reason: 'Manual approval required for each action',
      requires_reapproval: true,
    };
  }

  // Mode: semi-auto
  if (state.mode === ApprovalMode.SEMI_AUTO) {
    // Check if action matches reapprove patterns (dangerous actions)
    if (action) {
      const match = matchesReapprovePattern(action, repoRoot);
      if (match.matches) {
        return {
          allowed: false,
          reason: `Action matches dangerous pattern: ${match.pattern}`,
          requires_reapproval: true,
          pattern: match.pattern,
        };
      }
    }

    // Check if already approved for this mission
    if (state.granted && policy.semi_auto?.allow_until_mission_end) {
      return {
        allowed: true,
        reason: 'Already approved for this mission',
        granted_at: state.granted_at,
      };
    }

    // Not yet approved
    return {
      allowed: false,
      reason: 'Semi-auto approval required',
      requires_reapproval: false,
    };
  }

  // Unknown mode - deny by default
  return { allowed: false, reason: `Unknown approval mode: ${state.mode}` };
}

/**
 * Update meta.json with approval mode from route config
 */
function initApprovalMode(missionDir, mode) {
  const metaPath = path.join(missionDir, 'meta.json');
  let meta = {};

  if (fs.existsSync(metaPath)) {
    meta = readJson(metaPath);
  }

  meta.approval = meta.approval || {};
  meta.approval.mode = mode || ApprovalMode.SEMI_AUTO;

  writeJson(metaPath, meta);
}

/**
 * Format approval status for display
 */
function formatApprovalStatus(state) {
  if (state.mode === ApprovalMode.NONE) {
    return '✅ No approval required';
  }

  if (state.mode === ApprovalMode.MANUAL) {
    return '🔐 Manual approval (per action)';
  }

  if (state.mode === ApprovalMode.SEMI_AUTO) {
    if (state.granted) {
      return `✅ Approved (${state.granted_at})`;
    }
    return '⏳ Pending approval (run: liye mission approve <dir>)';
  }

  return '❓ Unknown approval mode';
}

module.exports = {
  ApprovalMode,
  getApprovalState,
  grantApproval,
  revokeApproval,
  checkApproval,
  initApprovalMode,
  formatApprovalStatus,
};
