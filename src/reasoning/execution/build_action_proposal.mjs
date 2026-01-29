/**
 * build_action_proposal.mjs - Action Proposal Builder
 *
 * P3: Converts reasoning explanation into executable action proposals.
 * This is the bridge between Reasoning (P1/P2) and Execution (P3).
 *
 * @module reasoning/execution
 * @version v0.1
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../../..');

// Paths to contracts
const ACTION_PLAYBOOKS_DIR = join(PROJECT_ROOT, 'docs/contracts/reasoning/amazon-growth/actions');
const EXECUTION_FLAGS_PATH = join(PROJECT_ROOT, 'docs/contracts/reasoning/_shared/execution_flags.yaml');

/**
 * Load action playbook from YAML
 *
 * @param {string} actionId - e.g., 'ADD_NEGATIVE_KEYWORDS'
 * @returns {Object|null} Parsed playbook or null if not found
 */
export function loadActionPlaybook(actionId) {
  const filePath = join(ACTION_PLAYBOOKS_DIR, `${actionId}.yaml`);
  if (!existsSync(filePath)) {
    return null;
  }
  const content = readFileSync(filePath, 'utf-8');
  return parseYaml(content);
}

/**
 * Load execution flags configuration
 *
 * @returns {Object} Execution flags
 */
export function loadExecutionFlags() {
  if (!existsSync(EXECUTION_FLAGS_PATH)) {
    // Default: everything disabled
    return {
      auto_execution: {
        enabled: false,
        allow_actions: []
      },
      dry_run: { enabled: true }
    };
  }
  const content = readFileSync(EXECUTION_FLAGS_PATH, 'utf-8');
  return parseYaml(content);
}

/**
 * Check if auto execution is enabled for an action
 *
 * @param {string} actionId - Action ID
 * @param {Object} flags - Execution flags
 * @returns {boolean} Whether auto execution is allowed
 */
function isAutoExecutionAllowed(actionId, flags) {
  // Check environment variable override
  if (process.env.REASONING_AUTO_EXECUTION === 'false') {
    return false;
  }

  // Check master switch
  if (!flags.auto_execution?.enabled) {
    return false;
  }

  // Check whitelist
  const allowList = flags.auto_execution?.allow_actions || [];
  return allowList.includes(actionId);
}

/**
 * Determine execution mode for a recommendation
 *
 * @param {Object} recommendation - From explanation.next_best_actions
 * @param {Object} actionPlaybook - Action playbook (may be null)
 * @param {Object} flags - Execution flags
 * @returns {string} 'suggest_only' | 'auto_if_safe' | 'requires_approval'
 */
function determineExecutionMode(recommendation, actionPlaybook, flags) {
  const actionId = recommendation.action_id;

  // If no playbook exists, always suggest_only
  if (!actionPlaybook) {
    return 'suggest_only';
  }

  // If recommendation specifies execution_mode, use it as base
  const recommendedMode = recommendation.execution_mode || actionPlaybook.execution_mode_default || 'suggest_only';

  // If mode is suggest_only or requires_approval, honor it
  if (recommendedMode !== 'auto_if_safe') {
    return recommendedMode;
  }

  // For auto_if_safe, check if auto execution is actually allowed
  if (!isAutoExecutionAllowed(actionId, flags)) {
    return 'suggest_only'; // Degrade to suggest_only
  }

  return 'auto_if_safe';
}

/**
 * Build action proposal from a single recommendation
 *
 * @param {Object} recommendation - From explanation.next_best_actions
 * @param {Object} context - Context from explanation
 * @param {Object} context.trace_id - Trace ID
 * @param {Object} context.observation_id - Observation ID
 * @param {Object} context.cause_id - Cause ID (optional)
 * @param {Object} context.rule_version - Rule version
 * @param {Object} context.evidence_map - Evidence map
 * @returns {Object} Action proposal
 */
export function buildProposal(recommendation, context) {
  const {
    trace_id,
    observation_id,
    cause_id,
    rule_version,
    evidence_map
  } = context;

  const actionId = recommendation.action_id;
  const actionPlaybook = loadActionPlaybook(actionId);
  const flags = loadExecutionFlags();

  // Determine execution mode
  const executionMode = determineExecutionMode(recommendation, actionPlaybook, flags);

  // Extract evidence refs
  const evidenceRefs = [];
  if (evidence_map && cause_id && evidence_map[cause_id]) {
    for (const ev of evidence_map[cause_id]) {
      if (ev.source !== 'MISSING') {
        evidenceRefs.push({
          evidence_id: ev.evidence_id,
          name: ev.name,
          value: ev.value,
          confidence: ev.confidence
        });
      }
    }
  }

  // Build base proposal
  const proposal = {
    proposal_id: `prop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),

    // Required linkage fields
    trace_id,
    observation_id,
    cause_id: cause_id || null,
    action_id: actionId,
    rule_version,

    // Execution control
    execution_mode: executionMode,
    risk_level: recommendation.risk_level || 'MEDIUM',

    // Evidence refs for audit
    evidence_refs: evidenceRefs,

    // Action-specific params (to be filled by action-specific logic)
    params: {},

    // Metadata
    playbook_version: actionPlaybook?.version || null,
    dry_run: flags.dry_run?.enabled ?? true
  };

  // If action has a playbook, include eligibility and safety_limits refs
  if (actionPlaybook) {
    proposal.eligibility_ref = `${actionId}.yaml@${actionPlaybook.version}/eligibility`;
    proposal.safety_limits_ref = `${actionId}.yaml@${actionPlaybook.version}/safety_limits`;
  }

  return proposal;
}

/**
 * Build action proposals from a full explanation
 *
 * @param {Object} explanation - Full explanation from buildExplanation
 * @param {Object} options - Options
 * @param {string} options.cause_id - Specific cause to use (optional, uses first if not provided)
 * @param {number} options.max_proposals - Maximum proposals to generate (default: 3)
 * @returns {Array} Array of action proposals
 */
export function buildProposalsFromExplanation(explanation, options = {}) {
  const {
    cause_id = null,
    max_proposals = 3
  } = options;

  const proposals = [];

  // Use specified cause or first top cause
  const targetCauseId = cause_id || explanation.top_causes?.[0]?.cause_id;

  // Build context
  const context = {
    trace_id: explanation.trace_id || `trace_${Date.now().toString(36)}`,
    observation_id: explanation.observation_id,
    cause_id: targetCauseId,
    rule_version: explanation.rule_version,
    evidence_map: explanation.cause_evidence_map
  };

  // Get recommendations (from next_best_actions or recommendations)
  const recommendations = explanation.next_best_actions || explanation.recommendations || [];

  for (const rec of recommendations.slice(0, max_proposals)) {
    const proposal = buildProposal(rec, context);
    proposals.push(proposal);
  }

  return proposals;
}

/**
 * Check if a proposal is eligible for auto execution
 *
 * @param {Object} proposal - Action proposal
 * @param {Object} signals - Current signal values
 * @param {Object} options - Options
 * @param {string} options.profile - Override profile (conservative/balanced/aggressive)
 * @returns {Object} { eligible: boolean, reasons: string[], profile: string }
 */
export function checkEligibility(proposal, signals, options = {}) {
  const reasons = [];
  let eligible = true;

  // Must be auto_if_safe mode
  if (proposal.execution_mode !== 'auto_if_safe') {
    eligible = false;
    reasons.push(`Execution mode is ${proposal.execution_mode}, not auto_if_safe`);
    return { eligible, reasons, profile: null };
  }

  // Load action playbook for eligibility rules
  const playbook = loadActionPlaybook(proposal.action_id);
  if (!playbook) {
    eligible = false;
    reasons.push(`No action playbook found for ${proposal.action_id}`);
    return { eligible, reasons, profile: null };
  }

  const eligibility = playbook.eligibility;
  if (!eligibility) {
    eligible = false;
    reasons.push('No eligibility rules defined in playbook');
    return { eligible, reasons, profile: null };
  }

  // Check required observation
  if (eligibility.required_observation && proposal.observation_id !== eligibility.required_observation) {
    eligible = false;
    reasons.push(`Required observation ${eligibility.required_observation}, got ${proposal.observation_id}`);
  }

  // P4: Get thresholds from active profile or use legacy thresholds
  const profileName = options.profile || eligibility.active_profile || 'balanced';
  let thresholds;

  if (eligibility.profiles && eligibility.profiles[profileName]) {
    // Use profile-based thresholds (P4)
    const profile = eligibility.profiles[profileName];
    thresholds = {};
    // Extract threshold keys from profile (skip 'description')
    for (const [key, value] of Object.entries(profile)) {
      if (key !== 'description') {
        thresholds[key] = value;
      }
    }
  } else {
    // Fallback to legacy thresholds
    thresholds = eligibility.thresholds || {};
  }

  // Check thresholds
  for (const [key, value] of Object.entries(thresholds)) {
    const [field, op] = parseThresholdKey(key);
    const signalValue = signals[field];

    if (signalValue === undefined || signalValue === null) {
      eligible = false;
      reasons.push(`Missing required signal: ${field}`);
      continue;
    }

    const passed = evaluateThreshold(signalValue, op, value);
    if (!passed) {
      eligible = false;
      reasons.push(`Threshold not met: ${field} ${op} ${value} (actual: ${signalValue})`);
    }
  }

  return { eligible, reasons, profile: profileName };
}

/**
 * Parse threshold key like "wasted_spend_ratio_gte" into ["wasted_spend_ratio", "gte"]
 */
function parseThresholdKey(key) {
  const ops = ['_gte', '_lte', '_gt', '_lt', '_eq', '_ne'];
  for (const op of ops) {
    if (key.endsWith(op)) {
      return [key.slice(0, -op.length), op.slice(1)];
    }
  }
  return [key, 'eq']; // Default to equality
}

/**
 * Evaluate a threshold condition
 */
function evaluateThreshold(value, op, threshold) {
  switch (op) {
    case 'gte': return value >= threshold;
    case 'lte': return value <= threshold;
    case 'gt': return value > threshold;
    case 'lt': return value < threshold;
    case 'eq': return value === threshold;
    case 'ne': return value !== threshold;
    default: return false;
  }
}

/**
 * Check safety limits for a proposal
 *
 * @param {Object} proposal - Action proposal
 * @param {Object} params - Proposed action params (e.g., negative keywords to add)
 * @param {Object} state - Current state (e.g., existing negatives count today)
 * @returns {Object} { safe: boolean, violations: string[] }
 */
export function checkSafetyLimits(proposal, params, state = {}) {
  const violations = [];
  let safe = true;

  const playbook = loadActionPlaybook(proposal.action_id);
  if (!playbook || !playbook.safety_limits) {
    // No limits defined, allow
    return { safe: true, violations: [] };
  }

  const limits = playbook.safety_limits;

  // Check max_negatives_per_run (for ADD_NEGATIVE_KEYWORDS)
  if (limits.max_negatives_per_run && params.negative_keywords?.length > limits.max_negatives_per_run) {
    safe = false;
    violations.push(`Exceeds max_negatives_per_run: ${params.negative_keywords.length} > ${limits.max_negatives_per_run}`);
  }

  // Check max_negatives_per_campaign_per_day
  if (limits.max_negatives_per_campaign_per_day) {
    const todayCount = state.negatives_added_today || 0;
    const proposedCount = params.negative_keywords?.length || 0;
    if (todayCount + proposedCount > limits.max_negatives_per_campaign_per_day) {
      safe = false;
      violations.push(`Exceeds daily limit: ${todayCount} + ${proposedCount} > ${limits.max_negatives_per_campaign_per_day}`);
    }
  }

  // Check min_term_length
  if (limits.min_term_length && params.negative_keywords) {
    for (const term of params.negative_keywords) {
      if (term.length < limits.min_term_length) {
        safe = false;
        violations.push(`Term too short: "${term}" (min: ${limits.min_term_length})`);
      }
    }
  }

  // Check forbid_brand_terms
  if (limits.forbid_brand_terms && params.negative_keywords && state.brand_terms) {
    const brandTermsLower = state.brand_terms.map(t => t.toLowerCase());
    for (const term of params.negative_keywords) {
      if (brandTermsLower.some(bt => term.toLowerCase().includes(bt))) {
        safe = false;
        violations.push(`Brand term detected: "${term}"`);
      }
    }
  }

  // Check forbid_asin_terms
  if (limits.forbid_asin_terms && params.negative_keywords) {
    const asinPattern = /^[A-Z0-9]{10}$/i;
    for (const term of params.negative_keywords) {
      if (asinPattern.test(term.trim())) {
        safe = false;
        violations.push(`ASIN-like term detected: "${term}"`);
      }
    }
  }

  // Check match_types_allowed
  if (limits.match_types_allowed && params.match_type) {
    if (!limits.match_types_allowed.includes(params.match_type)) {
      safe = false;
      violations.push(`Match type not allowed: ${params.match_type} (allowed: ${limits.match_types_allowed.join(', ')})`);
    }
  }

  return { safe, violations };
}

// Default export
export default {
  buildProposal,
  buildProposalsFromExplanation,
  checkEligibility,
  checkSafetyLimits,
  loadActionPlaybook,
  loadExecutionFlags
};
