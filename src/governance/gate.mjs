/**
 * Gate - Risk assessment before action
 *
 * Evaluates input and produces a GateReport with deterministic rules.
 * NOT about being smart, but about being controllable and explainable.
 */

import {
  PROTOCOL_VERSION,
  GateDecision,
  Severity,
  TraceEventType
} from './types.mjs';

/**
 * Dangerous action patterns (deterministic rules)
 */
const DANGEROUS_PATTERNS = [
  { pattern: /\bdelete\b/i, severity: Severity.HIGH, id: 'risk-001', rationale: 'Destructive delete operation' },
  { pattern: /\boverwrite\b/i, severity: Severity.HIGH, id: 'risk-002', rationale: 'Overwrite operation may lose data' },
  { pattern: /\btransfer_funds\b/i, severity: Severity.CRITICAL, id: 'risk-003', rationale: 'Financial transfer requires explicit authorization' },
  { pattern: /\bsend_email\b/i, severity: Severity.MEDIUM, id: 'risk-004', rationale: 'Sending email requires user confirmation' },
  { pattern: /\brm\s+-rf\b/i, severity: Severity.CRITICAL, id: 'risk-005', rationale: 'Recursive force delete is extremely dangerous' },
  { pattern: /\bdrop\s+table\b/i, severity: Severity.CRITICAL, id: 'risk-006', rationale: 'Database table drop is irreversible' },
  { pattern: /\btruncate\b/i, severity: Severity.HIGH, id: 'risk-007', rationale: 'Truncate operation deletes all data' }
];

/**
 * External tools that require evidence
 */
const EXTERNAL_TOOLS = ['api_call', 'http_request', 'database_query', 'file_system', 'shell_exec'];

/**
 * Evaluate gate for given input
 *
 * @param {GateInput} input - Gate input
 * @param {Object} [options] - Options
 * @param {TraceWriter} [options.trace] - Trace writer to record events
 * @returns {GateReport}
 */
export function gate(input, options = {}) {
  const { trace } = options;
  const created_at = new Date().toISOString();

  // Record gate.start
  if (trace) {
    trace.append(TraceEventType.GATE_START, {
      task: input.task?.slice(0, 200),
      has_context: !!input.context,
      action_count: input.proposed_actions?.length || 0
    });
  }

  const risks = [];
  const unknowns = [];
  const constraints = [];
  const recommended_next_actions = [];

  // Rule 1: No proposed_actions → UNKNOWN (require plan)
  if (!input.proposed_actions || input.proposed_actions.length === 0) {
    unknowns.push({
      id: 'unk-001',
      question: 'What actions are you planning to take?'
    });
    recommended_next_actions.push('Provide proposed_actions array with action_type for each action');
  }

  // Rule 2: Check for dangerous patterns in actions
  if (input.proposed_actions) {
    for (const action of input.proposed_actions) {
      const actionStr = JSON.stringify(action);

      for (const { pattern, severity, id, rationale } of DANGEROUS_PATTERNS) {
        if (pattern.test(actionStr)) {
          risks.push({
            id,
            severity,
            rationale,
            evidence_required: ['user_confirmation', 'backup_verified']
          });
        }
      }
    }
  }

  // Rule 3: External tools without evidence → DEGRADE/UNKNOWN
  if (input.proposed_actions) {
    for (const action of input.proposed_actions) {
      if (EXTERNAL_TOOLS.includes(action.tool)) {
        const hasEvidence = input.context?.evidence_provided?.includes(action.tool);

        if (!hasEvidence) {
          unknowns.push({
            id: `unk-ext-${action.tool}`,
            question: `External tool "${action.tool}" requires evidence of authorization`
          });
          recommended_next_actions.push(`Provide evidence for ${action.tool} in context.evidence_provided`);
        }
      }
    }
  }

  // Rule 4: No task description → UNKNOWN
  if (!input.task || input.task.trim().length < 5) {
    unknowns.push({
      id: 'unk-002',
      question: 'Task description is missing or too brief'
    });
    recommended_next_actions.push('Provide a clear task description (minimum 5 characters)');
  }

  // Determine decision
  let decision;

  const hasCritical = risks.some(r => r.severity === Severity.CRITICAL);
  const hasHigh = risks.some(r => r.severity === Severity.HIGH);
  const hasUnknowns = unknowns.length > 0;

  if (hasCritical) {
    decision = GateDecision.BLOCK;
    recommended_next_actions.unshift('Critical risk detected - review and provide explicit authorization');
  } else if (hasHigh) {
    decision = GateDecision.DEGRADE;
    recommended_next_actions.unshift('High risk detected - proceed with caution and additional safeguards');
    constraints.push({
      id: 'con-001',
      rule: 'Require user confirmation before executing high-risk actions',
      severity: Severity.HIGH
    });
  } else if (hasUnknowns) {
    decision = GateDecision.UNKNOWN;
  } else {
    decision = GateDecision.ALLOW;
  }

  // Build GateReport (must match schema)
  const report = {
    version: PROTOCOL_VERSION,
    trace_id: trace?.trace_id,
    created_at,
    decision,
    risks,
    unknowns,
    constraints,
    recommended_next_actions
  };

  // Record gate.end
  if (trace) {
    trace.append(TraceEventType.GATE_END, report);
  }

  return report;
}

/**
 * Quick helper to check if decision allows proceeding
 *
 * @param {string} decision
 * @returns {boolean}
 */
export function canProceed(decision) {
  return decision === GateDecision.ALLOW || decision === GateDecision.DEGRADE;
}

/**
 * Get decision severity (for logging/display)
 *
 * @param {string} decision
 * @returns {string}
 */
export function getDecisionSeverity(decision) {
  switch (decision) {
    case GateDecision.ALLOW: return 'info';
    case GateDecision.DEGRADE: return 'warning';
    case GateDecision.BLOCK: return 'error';
    case GateDecision.UNKNOWN: return 'warning';
    default: return 'info';
  }
}
