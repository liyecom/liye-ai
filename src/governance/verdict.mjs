/**
 * Verdict - Human-readable decision semantics
 *
 * Generates Verdict from GateReport and EnforceResult.
 * Answers: Why? What changed? What was blocked? What next?
 */

import {
  PROTOCOL_VERSION,
  GateDecision,
  TraceEventType
} from './types.mjs';

/**
 * Generate verdict from gate report and enforce result
 *
 * @param {GateReport} gateReport
 * @param {EnforceResult} [enforceResult]
 * @param {Object} [options]
 * @param {TraceWriter} [options.trace]
 * @param {string[]} [options.executedActions] - Actions that were executed
 * @returns {Verdict}
 */
export function generateVerdict(gateReport, enforceResult, options = {}) {
  const { trace, executedActions = [] } = options;
  const created_at = new Date().toISOString();

  // Determine final decision
  let finalDecision = gateReport.decision;
  if (enforceResult && enforceResult.decision_summary === GateDecision.BLOCK) {
    finalDecision = GateDecision.BLOCK;
  }

  // Build summary
  const summary = buildSummary(finalDecision, gateReport, enforceResult);

  // Build why
  const why = buildWhy(gateReport, enforceResult);

  // Build what_changed
  const what_changed = executedActions.map(a =>
    typeof a === 'string' ? a : `Executed: ${a.action_type} on ${a.resource || a.tool || 'unknown'}`
  );

  // Build what_blocked
  const what_blocked = [];

  if (gateReport.decision === GateDecision.BLOCK) {
    what_blocked.push('All actions blocked by gate');
  }

  if (enforceResult?.blocked) {
    for (const b of enforceResult.blocked) {
      what_blocked.push(`${b.action?.action_type || 'action'}: ${b.rationale}`);
    }
  }

  // Build next_steps
  const next_steps = buildNextSteps(finalDecision, gateReport, enforceResult);

  // Calculate confidence
  const confidence = calculateConfidence(gateReport, enforceResult);

  // Build verdict (must match Verdict.schema.json)
  const verdict = {
    version: PROTOCOL_VERSION,
    trace_id: trace?.trace_id || gateReport.trace_id,
    created_at,
    summary,
    why,
    what_changed,
    what_blocked,
    next_steps,
    confidence
  };

  // Record verdict.emit
  if (trace) {
    trace.append(TraceEventType.VERDICT_EMIT, verdict);
  }

  return verdict;
}

/**
 * Build summary sentence
 *
 * @param {string} decision
 * @param {GateReport} gateReport
 * @param {EnforceResult} [enforceResult]
 * @returns {string}
 */
function buildSummary(decision, gateReport, enforceResult) {
  switch (decision) {
    case GateDecision.ALLOW:
      return 'Task approved. All proposed actions passed gate and contract checks.';

    case GateDecision.BLOCK:
      const blockReasons = [];
      if (gateReport.risks?.some(r => r.severity === 'critical')) {
        blockReasons.push('critical risk detected');
      }
      if (enforceResult?.blocked?.length > 0) {
        blockReasons.push(`${enforceResult.blocked.length} action(s) violated contract`);
      }
      return `Task blocked: ${blockReasons.join(', ') || 'security policy violation'}.`;

    case GateDecision.DEGRADE:
      return 'Task approved with degradation. High-risk actions require additional safeguards.';

    case GateDecision.UNKNOWN:
      return 'Task requires clarification. Missing information or evidence needed before proceeding.';

    default:
      return 'Task evaluation completed.';
  }
}

/**
 * Build why array
 *
 * @param {GateReport} gateReport
 * @param {EnforceResult} [enforceResult]
 * @returns {string[]}
 */
function buildWhy(gateReport, enforceResult) {
  const why = [];

  // Add risk reasons
  for (const risk of gateReport.risks || []) {
    why.push(`[${risk.severity.toUpperCase()}] ${risk.rationale}`);
  }

  // Add unknown reasons
  for (const unknown of gateReport.unknowns || []) {
    why.push(`[UNKNOWN] ${unknown.question}`);
  }

  // Add contract violation reasons
  if (enforceResult?.blocked) {
    for (const b of enforceResult.blocked) {
      why.push(`[CONTRACT] ${b.rationale}`);
    }
  }

  // Ensure at least one reason
  if (why.length === 0) {
    why.push('All checks passed without issues');
  }

  return why;
}

/**
 * Build next_steps array
 *
 * @param {string} decision
 * @param {GateReport} gateReport
 * @param {EnforceResult} [enforceResult]
 * @returns {string[]}
 */
function buildNextSteps(decision, gateReport, enforceResult) {
  const steps = [];

  // Add recommended actions from gate
  if (gateReport.recommended_next_actions) {
    steps.push(...gateReport.recommended_next_actions);
  }

  // Add decision-specific steps
  switch (decision) {
    case GateDecision.ALLOW:
      if (steps.length === 0) {
        steps.push('Proceed with execution');
      }
      break;

    case GateDecision.BLOCK:
      if (steps.length === 0) {
        steps.push('Review and address blocking issues before retry');
      }
      break;

    case GateDecision.DEGRADE:
      steps.push('Request user confirmation for high-risk actions');
      break;

    case GateDecision.UNKNOWN:
      if (steps.length === 0) {
        steps.push('Provide missing information and retry');
      }
      break;
  }

  // Ensure at least one step
  if (steps.length === 0) {
    steps.push('Review verdict and take appropriate action');
  }

  return steps;
}

/**
 * Calculate confidence score
 *
 * @param {GateReport} gateReport
 * @param {EnforceResult} [enforceResult]
 * @returns {number} 0-1 confidence score
 */
function calculateConfidence(gateReport, enforceResult) {
  let confidence = 1.0;

  // Reduce for unknowns
  confidence -= (gateReport.unknowns?.length || 0) * 0.2;

  // Reduce for risks
  for (const risk of gateReport.risks || []) {
    switch (risk.severity) {
      case 'critical': confidence -= 0.3; break;
      case 'high': confidence -= 0.2; break;
      case 'medium': confidence -= 0.1; break;
      case 'low': confidence -= 0.05; break;
    }
  }

  // Reduce for degraded actions
  if (enforceResult?.degraded?.length > 0) {
    confidence -= enforceResult.degraded.length * 0.1;
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Format verdict as Markdown
 *
 * @param {Verdict} verdict
 * @returns {string}
 */
export function formatVerdictMarkdown(verdict) {
  const lines = [
    `# Verdict`,
    '',
    `**Decision:** ${getDecisionFromSummary(verdict.summary)}`,
    `**Confidence:** ${(verdict.confidence * 100).toFixed(0)}%`,
    `**Time:** ${verdict.created_at}`,
    '',
    '## Summary',
    '',
    verdict.summary,
    '',
    '## Why',
    '',
    ...verdict.why.map(w => `- ${w}`),
    ''
  ];

  if (verdict.what_changed.length > 0) {
    lines.push('## What Changed', '', ...verdict.what_changed.map(w => `- ${w}`), '');
  }

  if (verdict.what_blocked.length > 0) {
    lines.push('## What Blocked', '', ...verdict.what_blocked.map(w => `- ${w}`), '');
  }

  lines.push('## Next Steps', '', ...verdict.next_steps.map(s => `- ${s}`), '');

  if (verdict.trace_id) {
    lines.push('---', '', `Trace ID: \`${verdict.trace_id}\``);
  }

  return lines.join('\n');
}

/**
 * Extract decision from summary
 *
 * @param {string} summary
 * @returns {string}
 */
function getDecisionFromSummary(summary) {
  if (summary.includes('approved') && !summary.includes('degradation')) return 'ALLOW';
  if (summary.includes('blocked')) return 'BLOCK';
  if (summary.includes('degradation')) return 'DEGRADE';
  if (summary.includes('clarification')) return 'UNKNOWN';
  return 'UNKNOWN';
}
