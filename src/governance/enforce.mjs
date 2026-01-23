/**
 * Enforce - Contract compliance checking
 *
 * Evaluates proposed actions against contract rules.
 * Returns allowed/blocked actions with traceable rationale.
 */

import {
  GateDecision,
  RuleEffect,
  TraceEventType
} from './types.mjs';

/**
 * Match action against rule
 *
 * @param {Action} action - Action to check
 * @param {Object} match - Rule match criteria
 * @returns {boolean}
 */
function matchesRule(action, match) {
  if (!match) return true;  // No match criteria = match all

  // action_type: exact match or prefix
  if (match.action_type) {
    if (action.action_type !== match.action_type &&
        !action.action_type?.startsWith(match.action_type)) {
      return false;
    }
  }

  // tool: exact match
  if (match.tool && action.tool !== match.tool) {
    return false;
  }

  // resource: exact match or prefix
  if (match.resource) {
    if (action.resource !== match.resource &&
        !action.resource?.startsWith(match.resource)) {
      return false;
    }
  }

  // path_prefix: prefix match
  if (match.path_prefix) {
    const actionPath = action.path_prefix || action.resource || '';
    if (!actionPath.startsWith(match.path_prefix)) {
      return false;
    }
  }

  return true;
}

/**
 * Enforce contract against proposed actions
 *
 * @param {Object} contract - Contract (must match Contract.schema.json)
 * @param {Action[]} actions - Proposed actions
 * @param {Object} [options] - Options
 * @param {TraceWriter} [options.trace] - Trace writer
 * @param {Object} [options.input] - Original input (for evidence checking)
 * @returns {EnforceResult}
 */
export function enforce(contract, actions, options = {}) {
  const { trace, input } = options;

  // Record contract.load
  if (trace) {
    trace.append(TraceEventType.CONTRACT_LOAD, {
      scope: contract.scope?.name,
      rule_count: contract.rules?.length || 0
    });
  }

  const allowed = [];
  const blocked = [];
  const degraded = [];
  const ruleMatches = [];

  for (const action of actions) {
    let actionDecision = GateDecision.ALLOW;
    let blockingRule = null;

    for (const rule of contract.rules || []) {
      if (!matchesRule(action, rule.match)) continue;

      ruleMatches.push({
        action,
        rule_id: rule.id,
        effect: rule.effect
      });

      switch (rule.effect) {
        case RuleEffect.DENY:
          actionDecision = GateDecision.BLOCK;
          blockingRule = rule;
          break;

        case RuleEffect.REQUIRE_EVIDENCE:
          // Check if evidence is provided
          const evidenceProvided = input?.context?.evidence_provided || [];
          const requiredEvidence = rule.evidence_required || [];
          const hasAllEvidence = requiredEvidence.every(e => evidenceProvided.includes(e));

          if (!hasAllEvidence) {
            actionDecision = GateDecision.UNKNOWN;
            blockingRule = rule;
          }
          break;

        case RuleEffect.DEGRADE:
          if (actionDecision !== GateDecision.BLOCK) {
            actionDecision = GateDecision.DEGRADE;
            blockingRule = rule;
          }
          break;

        case RuleEffect.ALLOW:
          // Explicit allow - override previous degradations but not blocks
          if (actionDecision !== GateDecision.BLOCK) {
            actionDecision = GateDecision.ALLOW;
            blockingRule = null;
          }
          break;
      }
    }

    // Categorize action
    if (actionDecision === GateDecision.BLOCK) {
      blocked.push({
        action,
        rule_id: blockingRule?.id,
        rationale: blockingRule?.rationale || 'Blocked by contract rule'
      });

      // Record enforce.block
      if (trace) {
        trace.append(TraceEventType.ENFORCE_BLOCK, {
          action_type: action.action_type,
          rule_id: blockingRule?.id,
          rationale: blockingRule?.rationale
        });
      }
    } else if (actionDecision === GateDecision.DEGRADE || actionDecision === GateDecision.UNKNOWN) {
      degraded.push({
        action,
        rule_id: blockingRule?.id,
        decision: actionDecision,
        rationale: blockingRule?.rationale
      });
    } else {
      allowed.push({
        action,
        matched_rules: ruleMatches.filter(m => m.action === action).map(m => m.rule_id)
      });

      // Record enforce.allow (only once per action, summarized)
      if (trace) {
        trace.append(TraceEventType.ENFORCE_ALLOW, {
          action_type: action.action_type,
          tool: action.tool
        });
      }
    }
  }

  // Determine overall decision
  let decision_summary;
  if (blocked.length > 0) {
    decision_summary = GateDecision.BLOCK;
  } else if (degraded.some(d => d.decision === GateDecision.UNKNOWN)) {
    decision_summary = GateDecision.UNKNOWN;
  } else if (degraded.length > 0) {
    decision_summary = GateDecision.DEGRADE;
  } else {
    decision_summary = GateDecision.ALLOW;
  }

  return {
    contract_id: contract.scope?.name || 'unknown',
    decision_summary,
    allowed,
    blocked,
    degraded,
    total_actions: actions.length,
    rule_matches: ruleMatches.length
  };
}

/**
 * Load and validate contract (basic validation)
 *
 * @param {Object} contract
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateContract(contract) {
  const errors = [];

  if (contract.version !== '1.0.0') {
    errors.push(`Invalid contract version: ${contract.version}`);
  }

  if (!contract.scope?.name) {
    errors.push('Contract missing scope.name');
  }

  if (!contract.rules || contract.rules.length === 0) {
    errors.push('Contract must have at least one rule');
  }

  for (let i = 0; i < (contract.rules || []).length; i++) {
    const rule = contract.rules[i];

    if (!rule.id) {
      errors.push(`Rule ${i}: missing id`);
    }
    if (!rule.effect) {
      errors.push(`Rule ${i}: missing effect`);
    }
    if (!rule.rationale) {
      errors.push(`Rule ${i}: missing rationale`);
    }

    const validEffects = Object.values(RuleEffect);
    if (rule.effect && !validEffects.includes(rule.effect)) {
      errors.push(`Rule ${i}: invalid effect "${rule.effect}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a simple deny rule
 *
 * @param {string} id
 * @param {Object} match
 * @param {string} rationale
 * @returns {Object}
 */
export function createDenyRule(id, match, rationale) {
  return {
    id,
    effect: RuleEffect.DENY,
    match,
    rationale
  };
}

/**
 * Create a simple allow rule
 *
 * @param {string} id
 * @param {Object} match
 * @param {string} rationale
 * @returns {Object}
 */
export function createAllowRule(id, match, rationale) {
  return {
    id,
    effect: RuleEffect.ALLOW,
    match,
    rationale
  };
}
