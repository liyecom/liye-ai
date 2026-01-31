/**
 * Rollback Plan Writer
 *
 * Phase 2 Week 1: Generates rollback plans for real write operations
 *
 * Rollback plan contains inverse operations to restore system state:
 * - negative_keyword_add -> negative_keyword_remove
 * - bid_adjust -> bid_adjust (with swapped values)
 *
 * Plans have a 7-day validity period.
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Rollback plan validity period (7 days)
const VALIDITY_DAYS = 7;

/**
 * Build impact description for a rollback action
 */
function buildImpactDescription(action) {
  const tool = action.tool || '';
  const args = action.arguments || {};

  if (tool === 'negative_keyword_remove') {
    return `Will remove negative keyword from ad group`;
  }

  if (tool === 'bid_adjust') {
    const newBid = args.new_bid;
    return `Will restore bid to $${parseFloat(newBid).toFixed(2)}`;
  }

  return `Will execute ${tool}`;
}

/**
 * Generate rollback plan warnings
 */
function generateWarnings(rollbackActions, executionResult) {
  const warnings = [];

  for (const action of rollbackActions) {
    const args = action.arguments || {};

    if (action.tool === 'negative_keyword_remove' && !args.negative_keyword_id) {
      warnings.push({
        action_id: action.original_action_id,
        warning: 'Missing negative_keyword_id - rollback may fail'
      });
    }

    if (action.tool === 'bid_adjust' && !args.new_bid) {
      warnings.push({
        action_id: action.original_action_id,
        warning: 'Missing original bid value - rollback may fail'
      });
    }
  }

  // Check if original execution had failures
  if (executionResult?.summary?.failed_actions > 0) {
    warnings.push({
      warning: `Original execution had ${executionResult.summary.failed_actions} failed action(s) - rollback may be partial`
    });
  }

  return warnings;
}

/**
 * Write rollback plan to trace directory
 *
 * @param {Object} opts - Options
 * @param {string} opts.trace_id - Trace identifier
 * @param {string} opts.plan_id - Original plan identifier
 * @param {Object} opts.execution_result - Execution result object
 * @param {Array} opts.rollback_actions - Rollback actions array
 * @param {string} opts.baseDir - Base directory for traces
 * @returns {Object} Write result
 */
export function writeRollbackPlan(opts) {
  const {
    trace_id,
    plan_id,
    execution_result,
    rollback_actions,
    baseDir = '.liye/traces'
  } = opts;

  const traceDir = join(baseDir, trace_id);

  if (!existsSync(traceDir)) {
    return {
      success: false,
      error: 'Trace directory does not exist'
    };
  }

  if (!rollback_actions || rollback_actions.length === 0) {
    return {
      success: false,
      error: 'No rollback actions provided'
    };
  }

  const rollbackPlanId = `rollback-${plan_id}`;
  const createdAt = new Date().toISOString();
  const validityUntil = new Date(Date.now() + VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Build rollback plan with details
  const rollbackPlanActions = rollback_actions.map((action, index) => ({
    rollback_action_id: `rollback-action-${index + 1}`,
    tool: action.tool,
    arguments: action.arguments,
    rollback_for: action.rollback_for || action.original_tool,
    original_action_id: action.original_action_id,
    impact_description: buildImpactDescription(action),
    risk_level: 'low'
  }));

  // Generate warnings
  const warnings = generateWarnings(rollback_actions, execution_result);

  // Build rollback plan JSON
  const rollbackPlan = {
    rollback_plan_id: rollbackPlanId,
    original_plan_id: plan_id,
    trace_id,
    status: 'READY',
    created_at: createdAt,
    validity_until: validityUntil,
    validity_days: VALIDITY_DAYS,
    actions: rollbackPlanActions,
    warnings: warnings.length > 0 ? warnings : undefined,
    execution_context: {
      original_executed_at: execution_result?.executed_at,
      original_mode: execution_result?.mode,
      writes_to_rollback: rollback_actions.length
    },
    GUARANTEE: {
      rollback_available: true,
      actions_count: rollbackPlanActions.length,
      auto_generated: true
    }
  };

  // Write JSON file
  const jsonPath = join(traceDir, 'rollback_plan.json');
  try {
    writeFileSync(jsonPath, JSON.stringify(rollbackPlan, null, 2));
  } catch (e) {
    return {
      success: false,
      error: `Failed to write JSON: ${e.message}`
    };
  }

  // Build Markdown representation
  const mdContent = buildRollbackPlanMarkdown(rollbackPlan);
  const mdPath = join(traceDir, 'rollback_plan.md');
  try {
    writeFileSync(mdPath, mdContent);
  } catch (e) {
    console.warn('[RollbackPlanWriter] Failed to write MD:', e.message);
  }

  return {
    success: true,
    rollback_plan_id: rollbackPlanId,
    validity_until: validityUntil,
    actions_count: rollbackPlanActions.length,
    filePath: jsonPath
  };
}

/**
 * Build Markdown representation of rollback plan
 */
function buildRollbackPlanMarkdown(plan) {
  const lines = [
    `# Rollback Plan`,
    '',
    `**Rollback Plan ID**: \`${plan.rollback_plan_id}\``,
    `**Original Plan ID**: \`${plan.original_plan_id}\``,
    `**Trace ID**: \`${plan.trace_id}\``,
    '',
    `**Status**: ${plan.status}`,
    `**Created**: ${plan.created_at}`,
    `**Valid Until**: ${plan.validity_until}`,
    '',
    `---`,
    '',
    `## Rollback Actions`,
    ''
  ];

  // Actions table
  lines.push(`| # | Tool | Impact | Risk |`);
  lines.push(`|---|------|--------|------|`);

  for (const action of plan.actions) {
    lines.push(`| ${action.rollback_action_id} | \`${action.tool}\` | ${action.impact_description} | ${action.risk_level} |`);
  }

  // Action details
  lines.push('');
  lines.push(`## Action Details`);
  lines.push('');

  for (const action of plan.actions) {
    lines.push(`### ${action.rollback_action_id}`);
    lines.push('');
    lines.push(`- **Tool**: \`${action.tool}\``);
    lines.push(`- **Rollback For**: \`${action.rollback_for}\``);
    lines.push(`- **Original Action**: \`${action.original_action_id}\``);
    lines.push('');
    lines.push('**Arguments**:');
    lines.push('```json');
    lines.push(JSON.stringify(action.arguments, null, 2));
    lines.push('```');
    lines.push('');
  }

  // Warnings
  if (plan.warnings && plan.warnings.length > 0) {
    lines.push(`---`);
    lines.push('');
    lines.push(`## Warnings`);
    lines.push('');
    for (const warning of plan.warnings) {
      if (warning.action_id) {
        lines.push(`- **${warning.action_id}**: ${warning.warning}`);
      } else {
        lines.push(`- ${warning.warning}`);
      }
    }
    lines.push('');
  }

  // How to execute
  lines.push(`---`);
  lines.push('');
  lines.push(`## How to Execute Rollback`);
  lines.push('');
  lines.push(`1. Review each rollback action above`);
  lines.push(`2. In Feishu, click "执行回滚" button (Phase 2 Week 2)`);
  lines.push(`3. Or call the rollback API endpoint:`);
  lines.push('```bash');
  lines.push(`curl -X POST http://localhost:3210/v1/execute_rollback \\`);
  lines.push(`  -H "Content-Type: application/json" \\`);
  lines.push(`  -d '{"trace_id": "${plan.trace_id}", "rollback_plan_id": "${plan.rollback_plan_id}"}'`);
  lines.push('```');
  lines.push('');

  // GUARANTEE section
  lines.push(`---`);
  lines.push('');
  lines.push(`## GUARANTEE`);
  lines.push('');
  lines.push(`- **rollback_available**: ${plan.GUARANTEE.rollback_available}`);
  lines.push(`- **actions_count**: ${plan.GUARANTEE.actions_count}`);
  lines.push(`- **auto_generated**: ${plan.GUARANTEE.auto_generated}`);
  lines.push('');
  lines.push(`---`);
  lines.push('');
  lines.push(`*Generated by LiYe OS Phase 2 Week 1*`);

  return lines.join('\n');
}

/**
 * Check if rollback plan exists for a trace
 */
export function rollbackPlanExists(traceId, baseDir = '.liye/traces') {
  const planPath = join(baseDir, traceId, 'rollback_plan.json');
  return existsSync(planPath);
}

/**
 * Get rollback plan file path
 */
export function getRollbackPlanPath(traceId, format = 'json', baseDir = '.liye/traces') {
  const fileName = format === 'md' ? 'rollback_plan.md' : 'rollback_plan.json';
  return join(baseDir, traceId, fileName);
}

export default {
  writeRollbackPlan,
  rollbackPlanExists,
  getRollbackPlanPath
};
