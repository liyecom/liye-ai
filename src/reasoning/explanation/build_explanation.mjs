/**
 * build_explanation.mjs - Explanation Chain Generator
 *
 * Pure function that generates explanation JSON from signals, targets, and evidence.
 * Outputs top-3 root causes ranked by evidence satisfaction and confidence.
 *
 * P2.1: Added presentation fields for dashboard consumption:
 * - executive_summary: one-sentence diagnosis
 * - next_best_actions: top 1-3 recommended actions
 * - confidence_overall: high/medium/low
 *
 * @module reasoning/explanation
 * @version v0.2
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to playbooks (from src/reasoning/explanation/ to docs/contracts/...)
const PLAYBOOKS_DIR = join(__dirname, '../../../docs/contracts/reasoning/amazon-growth/observations');

/**
 * Load observation playbook from YAML
 *
 * @param {string} observationId - e.g., 'ACOS_TOO_HIGH'
 * @returns {Object} Parsed playbook
 */
function loadPlaybook(observationId) {
  const filePath = join(PLAYBOOKS_DIR, `${observationId}.yaml`);
  const content = readFileSync(filePath, 'utf-8');
  return parseYaml(content);
}

/**
 * Evaluate evidence requirements for a cause candidate
 *
 * @param {Object} cause - Cause candidate from playbook
 * @param {Object} signals - Current signal values
 * @param {Object} targets - Target thresholds
 * @returns {Object} { satisfied: boolean, evidence: Array, confidence: string }
 */
function evaluateCauseEvidence(cause, signals, targets) {
  const evidence = [];
  let satisfiedCount = 0;
  let totalRequired = cause.evidence_requirements?.length || 0;

  for (const requirement of cause.evidence_requirements || []) {
    const value = signals[requirement];
    const hasValue = value !== undefined && value !== null;

    evidence.push({
      evidence_id: `${cause.id}_${requirement}`,
      name: requirement,
      source: hasValue ? 'ENGINE' : 'MISSING',
      query_ref: `signals.${requirement}`,
      window: { dt_range: 'current' },
      value: hasValue ? value : null,
      confidence: hasValue ? 'high' : 'low',
      notes: hasValue ? null : `Missing evidence: ${requirement}`
    });

    if (hasValue) {
      satisfiedCount++;
    }
  }

  // Evaluate decision logic if all evidence available
  let logicSatisfied = false;
  if (satisfiedCount === totalRequired && cause.decision_logic) {
    logicSatisfied = evaluateDecisionLogic(cause.decision_logic, signals, targets);
  }

  // Determine confidence
  let confidence = 'low';
  if (satisfiedCount === totalRequired && logicSatisfied) {
    confidence = 'high';
  } else if (satisfiedCount >= totalRequired * 0.5) {
    confidence = 'medium';
  }

  return {
    satisfied: logicSatisfied,
    evidence,
    confidence,
    evidence_coverage: totalRequired > 0 ? satisfiedCount / totalRequired : 0
  };
}

/**
 * Evaluate decision logic expression
 *
 * @param {string} logic - Decision logic string (e.g., "days_since_launch < 90 AND review_count < 30")
 * @param {Object} signals - Signal values
 * @param {Object} targets - Target values
 * @returns {boolean} Whether logic is satisfied
 */
function evaluateDecisionLogic(logic, signals, targets) {
  try {
    // Replace variable references with actual values
    let expr = logic
      .replace(/targets\.(\w+)/g, (_, key) => JSON.stringify(targets[key]))
      .replace(/(\w+)/g, (match) => {
        if (signals.hasOwnProperty(match)) {
          return JSON.stringify(signals[match]);
        }
        return match;
      })
      .replace(/AND/g, '&&')
      .replace(/OR/g, '||');

    // Safe eval with limited scope
    return Function('"use strict"; return (' + expr + ')')();
  } catch {
    return false;
  }
}

/**
 * Build explanation from observation
 *
 * @param {string} observationId - Observation ID (e.g., 'ACOS_TOO_HIGH')
 * @param {Object} signals - Current signal values
 * @param {Object} targets - Target thresholds
 * @param {Object} [options] - Options
 * @param {string} [options.trace_id] - Optional trace ID for audit
 * @returns {Object} Explanation conforming to explanation.schema.json
 */
export function buildExplanation(observationId, signals, targets, options = {}) {
  const playbook = loadPlaybook(observationId);
  const { trace_id } = options;

  // Evaluate each cause candidate
  const evaluatedCauses = [];

  for (const cause of playbook.cause_candidates || []) {
    const evaluation = evaluateCauseEvidence(cause, signals, targets);

    evaluatedCauses.push({
      cause_id: cause.id,
      description: cause.description,
      rationale: cause.rationale || [],
      confidence: evaluation.confidence,
      evidence_satisfied: evaluation.satisfied,
      evidence_coverage: evaluation.evidence_coverage,
      evidence: evaluation.evidence,
      recommended_actions: cause.recommended_actions || [],
      counterfactuals: cause.counterfactuals || []
    });
  }

  // Sort by: satisfied first, then by evidence_coverage, then by confidence
  evaluatedCauses.sort((a, b) => {
    if (a.evidence_satisfied !== b.evidence_satisfied) {
      return b.evidence_satisfied ? 1 : -1;
    }
    if (a.evidence_coverage !== b.evidence_coverage) {
      return b.evidence_coverage - a.evidence_coverage;
    }
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    return (confidenceOrder[b.confidence] || 0) - (confidenceOrder[a.confidence] || 0);
  });

  // Take top 3
  const topCauses = evaluatedCauses.slice(0, 3).map(c => ({
    cause_id: c.cause_id,
    description: c.description,
    confidence: c.confidence,
    rationale: c.rationale,
    evidence_satisfied: c.evidence_satisfied
  }));

  // Build cause_evidence_map
  const causeEvidenceMap = {};
  for (const cause of evaluatedCauses.slice(0, 3)) {
    causeEvidenceMap[cause.cause_id] = cause.evidence;
  }

  // Collect recommendations from top causes
  const recommendations = [];
  const seenActions = new Set();
  for (const cause of evaluatedCauses.slice(0, 3)) {
    for (const action of cause.recommended_actions) {
      if (!seenActions.has(action.action_id)) {
        seenActions.add(action.action_id);
        recommendations.push(action);
      }
    }
  }

  // Collect counterfactuals from top causes
  const counterfactuals = [];
  const seenCounterfactuals = new Set();
  for (const cause of evaluatedCauses.slice(0, 3)) {
    for (const cf of cause.counterfactuals) {
      const key = cf.if;
      if (!seenCounterfactuals.has(key)) {
        seenCounterfactuals.add(key);
        counterfactuals.push({
          if: cf.if,
          expected: cf.expected,
          risk_level: cf.risk_level || 'MEDIUM'
        });
      }
    }
  }

  // Determine overall severity
  const hasHighConfidenceCause = topCauses.some(c => c.confidence === 'high' && c.evidence_satisfied);
  const severity = hasHighConfidenceCause
    ? playbook.severity_default || 'HIGH'
    : 'MEDIUM';

  // P2.1: Generate presentation fields for dashboard consumption
  const presentation = generatePresentationFields(
    observationId,
    playbook,
    topCauses,
    recommendations,
    hasHighConfidenceCause
  );

  // Build final explanation
  const explanation = {
    observation_id: observationId,
    severity,
    top_causes: topCauses,
    cause_evidence_map: causeEvidenceMap,
    recommendations,
    counterfactuals,
    rule_version: `${observationId}.yaml@${playbook.version || 'v0.1'}`,
    generated_at: new Date().toISOString(),
    // P2.1: Presentation fields (optional, for dashboard consumption)
    ...presentation
  };

  if (trace_id) {
    explanation.trace_id = trace_id;
  }

  return explanation;
}

/**
 * Generate presentation fields for dashboard consumption (P2.1)
 *
 * @param {string} observationId - Observation ID
 * @param {Object} playbook - Loaded playbook
 * @param {Array} topCauses - Evaluated top causes
 * @param {Array} recommendations - Collected recommendations
 * @param {boolean} hasHighConfidenceCause - Whether any high confidence cause exists
 * @returns {Object} Presentation fields
 */
function generatePresentationFields(observationId, playbook, topCauses, recommendations, hasHighConfidenceCause) {
  // executive_summary: one-sentence diagnosis
  const primaryCause = topCauses[0];
  const executive_summary = primaryCause
    ? `${formatObservationName(observationId)} detected. Primary cause: ${primaryCause.description} (${primaryCause.confidence} confidence).`
    : `${formatObservationName(observationId)} detected, but no causes could be determined with available evidence.`;

  // next_best_actions: top 1-3 recommended actions with risk
  const next_best_actions = recommendations.slice(0, 3).map(rec => ({
    action_id: rec.action_id,
    risk_level: rec.risk_level,
    notes: rec.notes || null
  }));

  // confidence_overall: aggregate confidence level
  let confidence_overall = 'low';
  if (hasHighConfidenceCause) {
    confidence_overall = 'high';
  } else if (topCauses.some(c => c.confidence === 'medium')) {
    confidence_overall = 'medium';
  }

  return {
    executive_summary,
    next_best_actions,
    confidence_overall
  };
}

/**
 * Format observation ID into human-readable name
 *
 * @param {string} observationId - e.g., 'ACOS_TOO_HIGH'
 * @returns {string} e.g., 'ACoS Too High'
 */
function formatObservationName(observationId) {
  return observationId
    .split('_')
    .map(word => {
      // Special cases
      if (word === 'ACOS') return 'ACoS';
      if (word === 'CTR') return 'CTR';
      if (word === 'CVR') return 'CVR';
      if (word === 'CPC') return 'CPC';
      // Normal case: capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Format explanation as human-readable Markdown
 *
 * @param {Object} explanation - Explanation object
 * @returns {string} Markdown formatted explanation
 */
export function formatExplanationMarkdown(explanation) {
  const lines = [
    `# Explanation: ${explanation.observation_id}`,
    '',
    `**Severity:** ${explanation.severity}`,
    `**Generated:** ${explanation.generated_at}`,
    `**Rule Version:** ${explanation.rule_version}`,
    ''
  ];

  if (explanation.trace_id) {
    lines.push(`**Trace ID:** \`${explanation.trace_id}\``, '');
  }

  lines.push('## Top Root Causes', '');

  for (let i = 0; i < explanation.top_causes.length; i++) {
    const cause = explanation.top_causes[i];
    const icon = cause.evidence_satisfied ? '✅' : '⚠️';
    lines.push(`### ${i + 1}. ${cause.cause_id} ${icon}`);
    lines.push('');
    lines.push(`**Description:** ${cause.description}`);
    lines.push(`**Confidence:** ${cause.confidence}`);
    lines.push('');

    if (cause.rationale.length > 0) {
      lines.push('**Rationale:**');
      for (const r of cause.rationale) {
        lines.push(`- ${r}`);
      }
      lines.push('');
    }
  }

  if (explanation.recommendations.length > 0) {
    lines.push('## Recommendations', '');
    for (const rec of explanation.recommendations) {
      const riskIcon = rec.risk_level === 'LOW' ? '🟢' : rec.risk_level === 'MEDIUM' ? '🟡' : '🔴';
      lines.push(`- **${rec.action_id}** ${riskIcon} (Risk: ${rec.risk_level})`);
      if (rec.notes) {
        lines.push(`  - ${rec.notes}`);
      }
    }
    lines.push('');
  }

  if (explanation.counterfactuals.length > 0) {
    lines.push('## What-If Analysis', '');
    for (const cf of explanation.counterfactuals) {
      lines.push(`- **If** ${cf.if} → **Then** ${cf.expected} (Risk: ${cf.risk_level})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// Default export
export default { buildExplanation, formatExplanationMarkdown };
