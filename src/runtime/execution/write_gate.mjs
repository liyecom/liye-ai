/**
 * Write Gate Validator
 *
 * Phase 2 Week 1: Four-layer gating for real write operations
 *
 * Layer 1: Global WRITE_ENABLED flag
 * Layer 2: Tool allowlist (negative_keyword_add, bid_adjust, negative_keyword_remove)
 * Layer 3: Scope allowlist (profile_ids, campaign_ids, adgroup_ids)
 * Layer 4: Threshold limits (bid adjustments)
 *
 * Fail-Closed: Any layer failure = BLOCK (no DEGRADE fallback)
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load write gray policy
let writePolicy = null;
try {
  const policyPath = join(__dirname, '..', 'dispatcher', 'policies', 'write-gray-v1.yaml');
  if (existsSync(policyPath)) {
    // Simple YAML parsing for our specific format
    const content = readFileSync(policyPath, 'utf-8');
    writePolicy = parseSimpleYaml(content);
  }
} catch (e) {
  console.warn('[WriteGate] Failed to load policy:', e.message);
}

// Load scope allowlist
let scopeAllowlist = null;
try {
  const allowlistPath = join(__dirname, '..', '..', '..', 'examples', 'feishu', 'write_scope_allowlist.json');
  if (existsSync(allowlistPath)) {
    scopeAllowlist = JSON.parse(readFileSync(allowlistPath, 'utf-8'));
  }
} catch (e) {
  console.warn('[WriteGate] Failed to load scope allowlist:', e.message);
}

/**
 * Simple YAML parser for our specific policy format
 */
function parseSimpleYaml(content) {
  const result = {
    global: { write_enabled_default: false },
    tool_allowlist: [],
    thresholds: { bid: {} }
  };

  const lines = content.split('\n');
  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed === '') continue;

    if (trimmed === 'global:') {
      currentSection = 'global';
    } else if (trimmed === 'tool_allowlist:') {
      currentSection = 'tool_allowlist';
    } else if (trimmed === 'thresholds:') {
      currentSection = 'thresholds';
    } else if (trimmed === 'bid:' && currentSection === 'thresholds') {
      currentSection = 'thresholds.bid';
    } else if (currentSection === 'global' && trimmed.startsWith('write_enabled_default:')) {
      result.global.write_enabled_default = trimmed.includes('true');
    } else if (currentSection === 'tool_allowlist' && trimmed.startsWith('- ')) {
      result.tool_allowlist.push(trimmed.slice(2).trim());
    } else if (currentSection === 'thresholds.bid') {
      if (trimmed.startsWith('max_delta_pct:')) {
        result.thresholds.bid.max_delta_pct = parseFloat(trimmed.split(':')[1].trim());
      } else if (trimmed.startsWith('max_delta_abs:')) {
        result.thresholds.bid.max_delta_abs = parseFloat(trimmed.split(':')[1].trim());
      }
    }
  }

  return result;
}

// Default tool allowlist
const DEFAULT_TOOL_ALLOWLIST = [
  'negative_keyword_add',
  'negative_keyword_remove',
  'bid_adjust'
];

// Default thresholds
const DEFAULT_THRESHOLDS = {
  bid: {
    max_delta_pct: 0.10,  // 10%
    max_delta_abs: 0.20   // $0.20
  }
};

/**
 * Check Layer 1: Global WRITE_ENABLED flag
 */
function checkGlobalEnabled() {
  const envEnabled = process.env.WRITE_ENABLED === '1';
  const policyEnabled = writePolicy?.global?.write_enabled_default || false;

  return {
    passed: envEnabled || policyEnabled,
    reason: envEnabled
      ? 'WRITE_ENABLED=1'
      : policyEnabled
        ? 'Policy allows writes'
        : 'WRITE_ENABLED=0 and policy disabled'
  };
}

/**
 * Check Layer 2: Tool allowlist
 */
function checkToolAllowlist(tool) {
  const allowlist = writePolicy?.tool_allowlist?.length > 0
    ? writePolicy.tool_allowlist
    : DEFAULT_TOOL_ALLOWLIST;

  const passed = allowlist.includes(tool);

  return {
    passed,
    reason: passed
      ? `Tool "${tool}" is in allowlist`
      : `Tool "${tool}" not in allowlist: [${allowlist.join(', ')}]`
  };
}

/**
 * Check Layer 3: Scope allowlist
 */
function checkScopeAllowlist(action) {
  if (!scopeAllowlist) {
    return {
      passed: false,
      reason: 'Scope allowlist not loaded'
    };
  }

  const tenantId = action.tenant_id || 'default';
  const tenantScope = scopeAllowlist[tenantId] || scopeAllowlist.default;

  if (!tenantScope) {
    return {
      passed: false,
      reason: `No scope config for tenant "${tenantId}"`
    };
  }

  const args = action.arguments || {};

  // Check profile_id
  if (args.profile_id) {
    const allowedProfiles = tenantScope.profile_ids || [];
    if (!allowedProfiles.includes(args.profile_id) && !allowedProfiles.includes('*')) {
      return {
        passed: false,
        reason: `profile_id "${args.profile_id}" not in allowlist`
      };
    }
  }

  // Check campaign_id
  if (args.campaign_id) {
    const allowedCampaigns = tenantScope.campaign_ids || [];
    if (!allowedCampaigns.includes(args.campaign_id) && !allowedCampaigns.includes('*')) {
      return {
        passed: false,
        reason: `campaign_id "${args.campaign_id}" not in allowlist`
      };
    }
  }

  // Check adgroup_id
  if (args.adgroup_id) {
    const allowedAdgroups = tenantScope.adgroup_ids || [];
    if (!allowedAdgroups.includes(args.adgroup_id) && !allowedAdgroups.includes('*')) {
      return {
        passed: false,
        reason: `adgroup_id "${args.adgroup_id}" not in allowlist`
      };
    }
  }

  return {
    passed: true,
    reason: 'Scope check passed'
  };
}

/**
 * Check Layer 4: Threshold limits
 */
function checkThresholds(action) {
  const tool = action.tool || '';
  const args = action.arguments || {};

  // Only check thresholds for bid_adjust
  if (tool !== 'bid_adjust') {
    return {
      passed: true,
      reason: 'No threshold check needed for this tool'
    };
  }

  const thresholds = writePolicy?.thresholds?.bid || DEFAULT_THRESHOLDS.bid;

  const currentBid = parseFloat(args.original_bid || args.current_bid || 0);
  const newBid = parseFloat(args.new_bid || 0);

  if (currentBid <= 0 || newBid <= 0) {
    return {
      passed: false,
      reason: 'Invalid bid values (must be positive)'
    };
  }

  const deltaPct = Math.abs((newBid - currentBid) / currentBid);
  const deltaAbs = Math.abs(newBid - currentBid);

  if (deltaPct > thresholds.max_delta_pct) {
    return {
      passed: false,
      reason: `Bid change ${(deltaPct * 100).toFixed(1)}% exceeds max ${(thresholds.max_delta_pct * 100).toFixed(1)}%`
    };
  }

  if (deltaAbs > thresholds.max_delta_abs) {
    return {
      passed: false,
      reason: `Bid change $${deltaAbs.toFixed(2)} exceeds max $${thresholds.max_delta_abs.toFixed(2)}`
    };
  }

  return {
    passed: true,
    reason: `Bid change within limits: ${(deltaPct * 100).toFixed(1)}% / $${deltaAbs.toFixed(2)}`
  };
}

/**
 * Check write gate - all four layers must pass
 *
 * @param {Object} action - The action to validate
 * @param {string} action.tool - Tool name
 * @param {Object} action.arguments - Tool arguments
 * @param {string} action.action_type - Action type (write, delete, etc.)
 * @param {string} action.tenant_id - Tenant identifier
 * @returns {Object} Gate result
 */
export function checkWriteGate(action) {
  const checks = {
    global_enabled: checkGlobalEnabled(),
    tool_allowlist: checkToolAllowlist(action.tool || ''),
    scope_allowlist: checkScopeAllowlist(action),
    threshold: checkThresholds(action)
  };

  const allPassed = Object.values(checks).every(c => c.passed);

  // Find first failure for blocked_at
  let blockedAt = null;
  let blockedReason = null;
  for (const [layer, result] of Object.entries(checks)) {
    if (!result.passed) {
      blockedAt = layer;
      blockedReason = result.reason;
      break;
    }
  }

  return {
    allowed: allPassed,
    blocked_at: blockedAt,
    reason: allPassed ? 'All gate checks passed' : blockedReason,
    checks
  };
}

/**
 * Get rollback tool for a write tool
 *
 * @param {string} tool - The write tool name
 * @returns {string|null} The rollback tool name
 */
export function getRollbackTool(tool) {
  const rollbackMap = {
    'negative_keyword_add': 'negative_keyword_remove',
    'bid_adjust': 'bid_adjust'  // Bid adjust rolls back by reversing values
  };

  return rollbackMap[tool] || null;
}

/**
 * Build rollback action from original action and API response
 *
 * @param {Object} action - Original action
 * @param {Object} response - API response data
 * @returns {Object|null} Rollback action
 */
export function buildRollbackAction(action, response) {
  const tool = action.tool || '';
  const args = action.arguments || {};
  const rollbackTool = getRollbackTool(tool);

  if (!rollbackTool) {
    return null;
  }

  if (tool === 'negative_keyword_add') {
    // Need negative_keyword_id from response to remove
    const negativeKeywordId = response?.data?.negative_keyword_id || response?.negative_keyword_id;
    if (!negativeKeywordId) {
      console.warn('[WriteGate] No negative_keyword_id in response for rollback');
      return null;
    }

    return {
      tool: 'negative_keyword_remove',
      arguments: {
        profile_id: args.profile_id,
        campaign_id: args.campaign_id,
        adgroup_id: args.adgroup_id,
        negative_keyword_id: negativeKeywordId
      },
      rollback_for: tool,
      original_action_id: action.action_id
    };
  }

  if (tool === 'bid_adjust') {
    // Swap new and original bids
    return {
      tool: 'bid_adjust',
      arguments: {
        profile_id: args.profile_id,
        campaign_id: args.campaign_id,
        adgroup_id: args.adgroup_id,
        keyword_id: args.keyword_id,
        original_bid: args.new_bid,  // The new bid becomes "original"
        new_bid: args.original_bid   // Restore to the original value
      },
      rollback_for: tool,
      original_action_id: action.action_id
    };
  }

  return null;
}

export default {
  checkWriteGate,
  getRollbackTool,
  buildRollbackAction
};
