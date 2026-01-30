/**
 * verdict_enricher.mjs - Enrich Governance Verdicts with Reasoning Assets
 *
 * Adds impact_analysis, counterfactuals, and recommendations to BLOCK verdicts
 * without modifying the original Gate/Enforce judgment logic.
 *
 * @module governance/verdict_enricher
 * @version v0.1
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to governance reasoning playbooks
const PLAYBOOKS_DIR = join(__dirname, '../../docs/contracts/reasoning/governance/observations');

/**
 * Map violation types to playbook files
 */
const VIOLATION_PLAYBOOK_MAP = {
  'budget_exceed': 'BLOCK_BUDGET_EXCEED',
  'daily_budget_limit': 'BLOCK_BUDGET_EXCEED',
  'spend_limit': 'BLOCK_BUDGET_EXCEED'
  // Add more mappings as new playbooks are created
};

/**
 * Load observation playbook from YAML
 *
 * @param {string} playbookId - e.g., 'BLOCK_BUDGET_EXCEED'
 * @returns {Object|null} Parsed playbook or null if not found
 */
function loadPlaybook(playbookId) {
  try {
    const filePath = join(PLAYBOOKS_DIR, `${playbookId}.yaml`);
    const content = readFileSync(filePath, 'utf-8');
    return parseYaml(content);
  } catch {
    return null;
  }
}

/**
 * Extract violation type from verdict reason
 *
 * @param {string} reason - Verdict reason string
 * @returns {string|null} Violation type or null
 */
function extractViolationType(reason) {
  if (!reason) return null;

  // Pattern: "Contract violation: xxx" or "violated: xxx"
  const patterns = [
    /Contract violation:\s*(\w+)/i,
    /violated:\s*(\w+)/i,
    /constraint:\s*(\w+)/i,
    /(\w+_exceed)/i,
    /(\w+_limit)/i
  ];

  for (const pattern of patterns) {
    const match = reason.match(pattern);
    if (match) {
      return match[1].toLowerCase();
    }
  }

  return null;
}

/**
 * Find appropriate playbook for a verdict
 *
 * @param {Object} verdict - Original verdict
 * @returns {Object|null} Playbook or null
 */
function findPlaybook(verdict) {
  // Try to extract violation type from verdict
  const violationType = extractViolationType(verdict.summary) ||
                        extractViolationType(verdict.why?.[0]) ||
                        extractViolationType(verdict.what_blocked?.[0]);

  if (!violationType) {
    return null;
  }

  // Look up playbook ID
  const playbookId = VIOLATION_PLAYBOOK_MAP[violationType];
  if (!playbookId) {
    return null;
  }

  return loadPlaybook(playbookId);
}

/**
 * Enrich a verdict with impact analysis, counterfactuals, and recommendations
 *
 * @param {Object} verdict - Original verdict from generateVerdict()
 * @param {Object} [context] - Additional context
 * @param {Object} [context.proposed_amount] - The proposed amount that was blocked
 * @param {Object} [context.limit_value] - The limit that was exceeded
 * @returns {Object} Enriched verdict with additional fields
 */
export function enrichVerdict(verdict, context = {}) {
  // Only enrich BLOCK verdicts
  if (!verdict.summary?.includes('blocked')) {
    return verdict;
  }

  const playbook = findPlaybook(verdict);

  if (!playbook) {
    // No playbook found, return with minimal enrichment
    return {
      ...verdict,
      enriched: true,
      enrichment_version: 'v0.1',
      impact_analysis: {
        financial_risk: 'unknown',
        operational_risk: 'unknown',
        compliance_risk: 'unknown',
        note: 'No matching playbook found for this violation type'
      },
      counterfactual_suggestions: [],
      fix_recommendations: []
    };
  }

  // Build enriched verdict
  const enrichedVerdict = {
    ...verdict,
    enriched: true,
    enrichment_version: 'v0.1',
    rule_version: `${playbook.observation_id}.yaml@${playbook.version || 'v0.1'}`,

    // Impact Analysis from playbook
    impact_analysis: playbook.impact_analysis || {},

    // Counterfactual Suggestions
    counterfactual_suggestions: (playbook.counterfactuals || []).map(cf => ({
      if: cf.if,
      expected_decision: cf.expected_decision,
      // Add concrete values if context available
      ...(context.limit_value && cf.if === 'reduce_to_daily_limit' ? {
        suggested_value: context.limit_value
      } : {}),
      ...(context.proposed_amount && context.limit_value && cf.if === 'split_into_n_days' ? {
        suggested_days: Math.ceil(context.proposed_amount / context.limit_value)
      } : {})
    })),

    // Fix Recommendations
    fix_recommendations: (playbook.recommendations || []).map(rec => ({
      action_id: rec.action_id,
      risk_level: rec.risk_level,
      params: rec.params || {},
      // Add concrete values if context available
      ...(context.limit_value && rec.action_id === 'REDUCE_AMOUNT' ? {
        concrete_value: context.limit_value
      } : {})
    }))
  };

  return enrichedVerdict;
}

/**
 * Format enriched verdict as Markdown
 *
 * @param {Object} verdict - Enriched verdict
 * @returns {string} Markdown formatted verdict
 */
export function formatEnrichedVerdictMarkdown(verdict) {
  const lines = [
    `# Enriched Verdict`,
    '',
    `**Decision:** ${verdict.summary?.includes('blocked') ? 'BLOCK' : 'ALLOW'}`,
    `**Confidence:** ${((verdict.confidence || 0) * 100).toFixed(0)}%`,
    `**Time:** ${verdict.created_at}`,
    ''
  ];

  if (verdict.trace_id) {
    lines.push(`**Trace ID:** \`${verdict.trace_id}\``, '');
  }

  lines.push('## Summary', '', verdict.summary, '');

  // Why section
  if (verdict.why?.length > 0) {
    lines.push('## Why', '');
    for (const w of verdict.why) {
      lines.push(`- ${w}`);
    }
    lines.push('');
  }

  // What Blocked section
  if (verdict.what_blocked?.length > 0) {
    lines.push('## What Was Blocked', '');
    for (const b of verdict.what_blocked) {
      lines.push(`- ${b}`);
    }
    lines.push('');
  }

  // Impact Analysis (enriched)
  if (verdict.impact_analysis) {
    lines.push('## Impact Analysis', '');
    const ia = verdict.impact_analysis;
    if (ia.financial_risk) lines.push(`- **Financial Risk:** ${ia.financial_risk}`);
    if (ia.operational_risk) lines.push(`- **Operational Risk:** ${ia.operational_risk}`);
    if (ia.compliance_risk) lines.push(`- **Compliance Risk:** ${ia.compliance_risk}`);
    if (ia.note) lines.push(`- *Note:* ${ia.note}`);
    lines.push('');
  }

  // Counterfactual Suggestions (enriched)
  if (verdict.counterfactual_suggestions?.length > 0) {
    lines.push('## How to Fix (Counterfactuals)', '');
    for (const cf of verdict.counterfactual_suggestions) {
      let suggestion = `- **If** ${cf.if} → **Then** ${cf.expected_decision}`;
      if (cf.suggested_value !== undefined) {
        suggestion += ` (Suggested: ${cf.suggested_value})`;
      }
      if (cf.suggested_days !== undefined) {
        suggestion += ` (Suggested: split into ${cf.suggested_days} days)`;
      }
      lines.push(suggestion);
    }
    lines.push('');
  }

  // Recommendations (enriched)
  if (verdict.fix_recommendations?.length > 0) {
    lines.push('## Recommendations', '');
    for (const rec of verdict.fix_recommendations) {
      const riskIcon = rec.risk_level === 'LOW' ? '🟢' : rec.risk_level === 'MEDIUM' ? '🟡' : '🔴';
      let line = `- **${rec.action_id}** ${riskIcon} (Risk: ${rec.risk_level})`;
      if (rec.concrete_value !== undefined) {
        line += ` — Set value to: ${rec.concrete_value}`;
      }
      lines.push(line);
    }
    lines.push('');
  }

  // Next Steps
  if (verdict.next_steps?.length > 0) {
    lines.push('## Next Steps', '');
    for (const step of verdict.next_steps) {
      lines.push(`- ${step}`);
    }
    lines.push('');
  }

  // Enrichment metadata
  if (verdict.enriched) {
    lines.push('---', '');
    lines.push(`*Enriched by verdict_enricher ${verdict.enrichment_version}*`);
    if (verdict.rule_version) {
      lines.push(`*Rule: ${verdict.rule_version}*`);
    }
  }

  return lines.join('\n');
}

// Default export
export default { enrichVerdict, formatEnrichedVerdictMarkdown };
