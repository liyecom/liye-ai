#!/usr/bin/env node
/**
 * playbook_evaluator.mjs - Playbook Effectiveness Analyzer
 *
 * P2.3: Scans ActionOutcomeEvents and generates evaluation reports.
 * Answers:
 * - Which causes have high hit rate?
 * - Which recommended actions are effective?
 * - Which evidence fields are frequently missing?
 *
 * Usage:
 *   node scripts/reasoning/playbook_evaluator.mjs [--days 30] [--output-dir docs/reasoning/reports]
 *
 * @module reasoning/evaluator
 * @version v0.1
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');

// Default paths
const DEFAULT_OUTCOMES_DIR = join(PROJECT_ROOT, 'traces/action_outcomes');
const DEFAULT_REPORTS_DIR = join(PROJECT_ROOT, 'docs/reasoning/reports');

/**
 * Load all ActionOutcomeEvents from NDJSON files
 *
 * @param {string} dir - Directory containing outcome files
 * @param {number} [days=30] - Number of days to look back
 * @returns {Array} Array of events
 */
function loadOutcomeEvents(dir, days = 30) {
  if (!existsSync(dir)) {
    console.log(`No outcomes directory found: ${dir}`);
    return [];
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const events = [];
  const files = readdirSync(dir).filter(f => f.endsWith('.ndjson'));

  for (const file of files) {
    // Parse date from filename (outcomes_YYYY-MM-DD.ndjson)
    const dateMatch = file.match(/outcomes_(\d{4}-\d{2}-\d{2})\.ndjson/);
    if (!dateMatch) continue;

    const fileDate = new Date(dateMatch[1]);
    if (fileDate < cutoffDate) continue;

    const content = readFileSync(join(dir, file), 'utf-8');
    const lines = content.trim().split('\n').filter(l => l);

    for (const line of lines) {
      try {
        events.push(JSON.parse(line));
      } catch (e) {
        console.warn(`Failed to parse line in ${file}: ${e.message}`);
      }
    }
  }

  return events;
}

/**
 * Analyze cause hit rates
 *
 * @param {Array} events - ActionOutcomeEvents
 * @returns {Object} Cause analysis
 */
function analyzeCauses(events) {
  const causeStats = {};

  for (const event of events) {
    const causeId = event.cause_id || 'UNKNOWN';

    if (!causeStats[causeId]) {
      causeStats[causeId] = {
        total: 0,
        success: 0,
        failure: 0,
        observations: new Set()
      };
    }

    causeStats[causeId].total++;
    if (event.success) {
      causeStats[causeId].success++;
    } else {
      causeStats[causeId].failure++;
    }
    causeStats[causeId].observations.add(event.observation_id);
  }

  // Calculate hit rates
  const results = [];
  for (const [causeId, stats] of Object.entries(causeStats)) {
    results.push({
      cause_id: causeId,
      total: stats.total,
      success: stats.success,
      failure: stats.failure,
      success_rate: stats.total > 0 ? (stats.success / stats.total * 100).toFixed(1) : '0.0',
      observations: Array.from(stats.observations)
    });
  }

  return results.sort((a, b) => b.total - a.total);
}

/**
 * Analyze action effectiveness
 *
 * @param {Array} events - ActionOutcomeEvents
 * @returns {Object} Action analysis
 */
function analyzeActions(events) {
  const actionStats = {};

  for (const event of events) {
    const actionId = event.action_id;

    if (!actionStats[actionId]) {
      actionStats[actionId] = {
        total: 0,
        success: 0,
        failure: 0,
        avg_delta: {},
        delta_samples: {}
      };
    }

    actionStats[actionId].total++;
    if (event.success) {
      actionStats[actionId].success++;
    } else {
      actionStats[actionId].failure++;
    }

    // Track delta values
    if (event.delta) {
      for (const [metric, value] of Object.entries(event.delta)) {
        if (!actionStats[actionId].delta_samples[metric]) {
          actionStats[actionId].delta_samples[metric] = [];
        }
        actionStats[actionId].delta_samples[metric].push(value);
      }
    }
  }

  // Calculate averages
  const results = [];
  for (const [actionId, stats] of Object.entries(actionStats)) {
    const avgDelta = {};
    for (const [metric, samples] of Object.entries(stats.delta_samples)) {
      if (samples.length > 0) {
        avgDelta[metric] = (samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(4);
      }
    }

    results.push({
      action_id: actionId,
      total: stats.total,
      success: stats.success,
      failure: stats.failure,
      success_rate: stats.total > 0 ? (stats.success / stats.total * 100).toFixed(1) : '0.0',
      avg_delta: avgDelta
    });
  }

  return results.sort((a, b) => parseFloat(b.success_rate) - parseFloat(a.success_rate));
}

/**
 * Analyze observation distribution
 *
 * @param {Array} events - ActionOutcomeEvents
 * @returns {Object} Observation analysis
 */
function analyzeObservations(events) {
  const obsStats = {};

  for (const event of events) {
    const obsId = event.observation_id;

    if (!obsStats[obsId]) {
      obsStats[obsId] = {
        total: 0,
        success: 0,
        failure: 0,
        actions: new Set(),
        causes: new Set()
      };
    }

    obsStats[obsId].total++;
    if (event.success) {
      obsStats[obsId].success++;
    } else {
      obsStats[obsId].failure++;
    }
    obsStats[obsId].actions.add(event.action_id);
    if (event.cause_id) {
      obsStats[obsId].causes.add(event.cause_id);
    }
  }

  const results = [];
  for (const [obsId, stats] of Object.entries(obsStats)) {
    results.push({
      observation_id: obsId,
      total: stats.total,
      success: stats.success,
      failure: stats.failure,
      success_rate: stats.total > 0 ? (stats.success / stats.total * 100).toFixed(1) : '0.0',
      unique_actions: stats.actions.size,
      unique_causes: stats.causes.size
    });
  }

  return results.sort((a, b) => b.total - a.total);
}

/**
 * Analyze missing evidence fields (P2.3 required section)
 *
 * @param {Array} events - ActionOutcomeEvents
 * @returns {Array} Missing evidence analysis
 */
function analyzeMissingEvidence(events) {
  const evidenceStats = {};

  for (const event of events) {
    // Track events without before_metrics
    if (!event.before_metrics || !event.before_metrics.values) {
      const key = 'before_metrics';
      if (!evidenceStats[key]) {
        evidenceStats[key] = { field: key, missing_count: 0, observations: new Set() };
      }
      evidenceStats[key].missing_count++;
      evidenceStats[key].observations.add(event.observation_id);
    }

    // Track events without after_metrics
    if (!event.after_metrics || !event.after_metrics.values) {
      const key = 'after_metrics';
      if (!evidenceStats[key]) {
        evidenceStats[key] = { field: key, missing_count: 0, observations: new Set() };
      }
      evidenceStats[key].missing_count++;
      evidenceStats[key].observations.add(event.observation_id);
    }

    // Track events without cause_id
    if (!event.cause_id) {
      const key = 'cause_id';
      if (!evidenceStats[key]) {
        evidenceStats[key] = { field: key, missing_count: 0, observations: new Set() };
      }
      evidenceStats[key].missing_count++;
      evidenceStats[key].observations.add(event.observation_id);
    }

    // Track events without delta (computed field)
    if (!event.delta) {
      const key = 'delta';
      if (!evidenceStats[key]) {
        evidenceStats[key] = { field: key, missing_count: 0, observations: new Set() };
      }
      evidenceStats[key].missing_count++;
      evidenceStats[key].observations.add(event.observation_id);
    }
  }

  const results = [];
  for (const [field, stats] of Object.entries(evidenceStats)) {
    results.push({
      field: stats.field,
      missing_count: stats.missing_count,
      missing_pct: events.length > 0 ? (stats.missing_count / events.length * 100).toFixed(1) : '0.0',
      affected_observations: Array.from(stats.observations)
    });
  }

  return results.sort((a, b) => b.missing_count - a.missing_count);
}

/**
 * Analyze auto execution effectiveness (P3 required section)
 *
 * @param {Array} events - ActionOutcomeEvents
 * @returns {Object} Auto execution analysis
 */
function analyzeAutoExecution(events) {
  const stats = {
    total_proposals: 0,        // Events with execution_mode field
    auto_executed: 0,          // execution_mode = 'auto_executed'
    dry_run: 0,                // execution_mode = 'dry_run'
    suggest_only: 0,           // execution_mode = 'suggest_only' or undefined
    auto_success: 0,
    auto_failure: 0,
    dry_run_success: 0,
    dry_run_failure: 0,
    failure_reasons: {},       // Count by failure reason
    by_action: {},             // Stats by action_id
    metric_deltas: {           // Average metric changes
      wasted_spend_ratio: [],
      acos: []
    }
  };

  for (const event of events) {
    const mode = event.execution_mode || 'suggest_only';
    stats.total_proposals++;

    if (mode === 'auto_executed') {
      stats.auto_executed++;
      if (event.success) {
        stats.auto_success++;
      } else {
        stats.auto_failure++;
        // Track failure reason
        const reason = event.actual_outcome || event.notes || 'Unknown';
        stats.failure_reasons[reason] = (stats.failure_reasons[reason] || 0) + 1;
      }
    } else if (mode === 'dry_run') {
      stats.dry_run++;
      if (event.success) {
        stats.dry_run_success++;
      } else {
        stats.dry_run_failure++;
      }
    } else {
      stats.suggest_only++;
    }

    // Track by action
    const actionId = event.action_id;
    if (!stats.by_action[actionId]) {
      stats.by_action[actionId] = {
        total: 0,
        auto_executed: 0,
        dry_run: 0,
        success: 0,
        failure: 0
      };
    }
    stats.by_action[actionId].total++;
    if (mode === 'auto_executed') {
      stats.by_action[actionId].auto_executed++;
      if (event.success) stats.by_action[actionId].success++;
      else stats.by_action[actionId].failure++;
    } else if (mode === 'dry_run') {
      stats.by_action[actionId].dry_run++;
    }

    // Track metric deltas
    if (event.delta) {
      if (event.delta.wasted_spend_ratio !== undefined) {
        stats.metric_deltas.wasted_spend_ratio.push(event.delta.wasted_spend_ratio);
      }
      if (event.delta.acos !== undefined) {
        stats.metric_deltas.acos.push(event.delta.acos);
      }
    }
  }

  // Calculate averages
  const avgDelta = {};
  for (const [metric, values] of Object.entries(stats.metric_deltas)) {
    if (values.length > 0) {
      avgDelta[metric] = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(4);
    }
  }

  // Convert failure reasons to sorted array
  const topFailureReasons = Object.entries(stats.failure_reasons)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total_proposals: stats.total_proposals,
    auto_executed_count: stats.auto_executed,
    dry_run_count: stats.dry_run,
    suggest_only_count: stats.suggest_only,
    auto_success_rate: stats.auto_executed > 0
      ? (stats.auto_success / stats.auto_executed * 100).toFixed(1)
      : '0.0',
    auto_success: stats.auto_success,
    auto_failure: stats.auto_failure,
    dry_run_success_rate: stats.dry_run > 0
      ? (stats.dry_run_success / stats.dry_run * 100).toFixed(1)
      : '0.0',
    top_failure_reasons: topFailureReasons,
    by_action: stats.by_action,
    avg_metric_deltas: avgDelta
  };
}

/**
 * Generate P3 auto execution effectiveness report
 *
 * @param {Object} autoExecStats - Auto execution analysis
 * @param {number} days - Days analyzed
 * @returns {string} Markdown report
 */
function generateAutoExecReport(autoExecStats, days) {
  const lines = [
    '# P3 Auto Execution Effectiveness Report',
    '',
    `> **Generated:** ${new Date().toISOString()}`,
    `> **Period:** Last ${days} days`,
    '',
    '---',
    '',
    '## Executive Summary',
    '',
    `- **Total Proposals:** ${autoExecStats.total_proposals}`,
    `- **Auto Executed:** ${autoExecStats.auto_executed_count}`,
    `- **Dry Run:** ${autoExecStats.dry_run_count}`,
    `- **Suggest Only:** ${autoExecStats.suggest_only_count}`,
    '',
    `### Auto Execution Success Rate: ${autoExecStats.auto_success_rate}%`,
    '',
    `- Successes: ${autoExecStats.auto_success}`,
    `- Failures: ${autoExecStats.auto_failure}`,
    '',
    '---',
    '',
    '## Metric Impact',
    ''
  ];

  if (Object.keys(autoExecStats.avg_metric_deltas).length > 0) {
    lines.push('| Metric | Average Delta |');
    lines.push('|--------|---------------|');
    for (const [metric, delta] of Object.entries(autoExecStats.avg_metric_deltas)) {
      const sign = parseFloat(delta) >= 0 ? '+' : '';
      lines.push(`| ${metric} | ${sign}${delta} |`);
    }
  } else {
    lines.push('No metric deltas recorded yet.');
  }

  lines.push('', '---', '', '## By Action', '');
  lines.push('| Action | Total | Auto Executed | Dry Run | Success | Failure |');
  lines.push('|--------|-------|---------------|---------|---------|---------|');

  for (const [actionId, stats] of Object.entries(autoExecStats.by_action)) {
    lines.push(`| ${actionId} | ${stats.total} | ${stats.auto_executed} | ${stats.dry_run} | ${stats.success} | ${stats.failure} |`);
  }

  if (autoExecStats.top_failure_reasons.length > 0) {
    lines.push('', '---', '', '## Top Failure Reasons', '');
    lines.push('| Reason | Count |');
    lines.push('|--------|-------|');
    for (const { reason, count } of autoExecStats.top_failure_reasons) {
      const truncatedReason = reason.length > 60 ? reason.slice(0, 57) + '...' : reason;
      lines.push(`| ${truncatedReason} | ${count} |`);
    }
  }

  lines.push('', '---', '', '*Report generated by playbook_evaluator.mjs (P3)*');

  return lines.join('\n');
}

/**
 * Generate markdown report
 *
 * @param {Object} analysis - Analysis results
 * @param {number} days - Days analyzed
 * @returns {string} Markdown report
 */
function generateReport(analysis, days) {
  const { causes, actions, observations, missingEvidence, autoExecution, summary } = analysis;

  const lines = [
    `# Playbook Evaluation Report`,
    '',
    `> **Generated:** ${new Date().toISOString()}`,
    `> **Period:** Last ${days} days`,
    `> **Total Events:** ${summary.totalEvents}`,
    '',
    '---',
    '',
    '## Executive Summary',
    '',
    `- **Total Actions Evaluated:** ${summary.totalEvents}`,
    `- **Overall Success Rate:** ${summary.overallSuccessRate}%`,
    `- **Unique Observations:** ${summary.uniqueObservations}`,
    `- **Unique Actions:** ${summary.uniqueActions}`,
    `- **Unique Causes:** ${summary.uniqueCauses}`,
    '',
    '---',
    '',
    '## Action Effectiveness',
    '',
    '| Action | Total | Success | Failure | Success Rate |',
    '|--------|-------|---------|---------|--------------|'
  ];

  for (const action of actions.slice(0, 20)) {
    lines.push(`| ${action.action_id} | ${action.total} | ${action.success} | ${action.failure} | ${action.success_rate}% |`);
  }

  lines.push('', '---', '', '## Cause Hit Rates', '');
  lines.push('| Cause | Total | Success | Failure | Success Rate |');
  lines.push('|-------|-------|---------|---------|--------------|');

  for (const cause of causes.slice(0, 20)) {
    lines.push(`| ${cause.cause_id} | ${cause.total} | ${cause.success} | ${cause.failure} | ${cause.success_rate}% |`);
  }

  lines.push('', '---', '', '## Observation Distribution', '');
  lines.push('| Observation | Total | Success Rate | Unique Actions | Unique Causes |');
  lines.push('|-------------|-------|--------------|----------------|---------------|');

  for (const obs of observations) {
    lines.push(`| ${obs.observation_id} | ${obs.total} | ${obs.success_rate}% | ${obs.unique_actions} | ${obs.unique_causes} |`);
  }

  // P2.3 Required: Missing Evidence Section (data collection roadmap)
  lines.push('', '---', '', '## Missing Evidence Fields', '');
  lines.push('> This section identifies evidence gaps for data collection prioritization.', '');

  if (missingEvidence && missingEvidence.length > 0) {
    lines.push('| Field | Missing Count | Missing % | Affected Observations |');
    lines.push('|-------|---------------|-----------|----------------------|');
    for (const me of missingEvidence) {
      lines.push(`| ${me.field} | ${me.missing_count} | ${me.missing_pct}% | ${me.affected_observations.join(', ')} |`);
    }
  } else {
    lines.push('✅ No missing evidence fields detected.');
  }

  // P3: Auto Execution Effectiveness Section
  if (autoExecution && autoExecution.auto_executed_count > 0) {
    lines.push('', '---', '', '## Auto Execution Effectiveness (P3)', '');
    lines.push(`> Auto execution is ${autoExecution.auto_executed_count > 0 ? 'ACTIVE' : 'INACTIVE'}`, '');
    lines.push(`- **Total Proposals:** ${autoExecution.total_proposals}`);
    lines.push(`- **Auto Executed:** ${autoExecution.auto_executed_count} (${autoExecution.auto_success_rate}% success)`);
    lines.push(`- **Dry Run:** ${autoExecution.dry_run_count}`);
    lines.push(`- **Suggest Only:** ${autoExecution.suggest_only_count}`);
    lines.push('');

    if (autoExecution.top_failure_reasons.length > 0) {
      lines.push('### Top Failure Reasons');
      for (const { reason, count } of autoExecution.top_failure_reasons.slice(0, 3)) {
        lines.push(`- ${reason}: ${count}`);
      }
      lines.push('');
    }
  }

  lines.push('', '---', '', '## Recommendations', '');

  // Low success rate actions
  const lowSuccessActions = actions.filter(a => parseFloat(a.success_rate) < 50 && a.total >= 3);
  if (lowSuccessActions.length > 0) {
    lines.push('### Actions Needing Review', '');
    for (const action of lowSuccessActions) {
      lines.push(`- **${action.action_id}**: ${action.success_rate}% success (${action.total} executions)`);
    }
    lines.push('');
  }

  // High success rate actions
  const highSuccessActions = actions.filter(a => parseFloat(a.success_rate) >= 80 && a.total >= 3);
  if (highSuccessActions.length > 0) {
    lines.push('### High-Performing Actions', '');
    for (const action of highSuccessActions) {
      lines.push(`- **${action.action_id}**: ${action.success_rate}% success (${action.total} executions)`);
    }
    lines.push('');
  }

  lines.push('', '---', '', '*Report generated by playbook_evaluator.mjs*');

  return lines.join('\n');
}

/**
 * Main evaluation function
 */
async function evaluate(options = {}) {
  const {
    outcomesDir = DEFAULT_OUTCOMES_DIR,
    reportsDir = DEFAULT_REPORTS_DIR,
    days = 30
  } = options;

  console.log('📊 Playbook Evaluator');
  console.log(`   Looking back: ${days} days`);
  console.log(`   Outcomes dir: ${outcomesDir}`);

  // Load events
  const events = loadOutcomeEvents(outcomesDir, days);
  console.log(`   Events found: ${events.length}`);

  if (events.length === 0) {
    console.log('\n⚠️  No events found. Generate some ActionOutcomeEvents first.');
    console.log('   Use: import { recordSuccess } from "src/reasoning/feedback/action_outcome.mjs"');
    return;
  }

  // Analyze
  const causes = analyzeCauses(events);
  const actions = analyzeActions(events);
  const observations = analyzeObservations(events);
  const missingEvidence = analyzeMissingEvidence(events);
  const autoExecution = analyzeAutoExecution(events);

  // Summary stats
  const summary = {
    totalEvents: events.length,
    overallSuccessRate: (events.filter(e => e.success).length / events.length * 100).toFixed(1),
    uniqueObservations: observations.length,
    uniqueActions: actions.length,
    uniqueCauses: causes.filter(c => c.cause_id !== 'UNKNOWN').length
  };

  // Generate report
  const report = generateReport({ causes, actions, observations, missingEvidence, autoExecution, summary }, days);

  // Write report
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  const date = new Date().toISOString().slice(0, 10);
  const reportPath = join(reportsDir, `PLAYBOOK_EVAL_${date}.md`);
  writeFileSync(reportPath, report);

  // P3: Generate auto execution effectiveness report if there are auto executions
  let autoExecReportPath = null;
  if (autoExecution.auto_executed_count > 0 || autoExecution.dry_run_count > 0) {
    const autoExecReport = generateAutoExecReport(autoExecution, days);
    autoExecReportPath = join(reportsDir, `P3_AUTO_EXEC_EFFECT_${date}.md`);
    writeFileSync(autoExecReportPath, autoExecReport);
    console.log(`\n✅ P3 Auto Exec Report: ${autoExecReportPath}`);
  }

  console.log(`\n✅ Report generated: ${reportPath}`);
  console.log(`\n📈 Summary:`);
  console.log(`   Success Rate: ${summary.overallSuccessRate}%`);
  console.log(`   Observations: ${summary.uniqueObservations}`);
  console.log(`   Actions: ${summary.uniqueActions}`);
  console.log(`   Causes: ${summary.uniqueCauses}`);
  if (autoExecution.auto_executed_count > 0) {
    console.log(`   Auto Executed: ${autoExecution.auto_executed_count} (${autoExecution.auto_success_rate}% success)`);
  }

  return { causes, actions, observations, missingEvidence, autoExecution, summary, reportPath, autoExecReportPath };
}

// CLI handling
if (process.argv[1].includes('playbook_evaluator')) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
      options.days = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--output-dir' && args[i + 1]) {
      options.reportsDir = args[i + 1];
      i++;
    } else if (args[i] === '--outcomes-dir' && args[i + 1]) {
      options.outcomesDir = args[i + 1];
      i++;
    }
  }

  evaluate(options);
}

export {
  evaluate,
  loadOutcomeEvents,
  analyzeCauses,
  analyzeActions,
  analyzeObservations,
  analyzeMissingEvidence,
  analyzeAutoExecution,
  generateAutoExecReport
};
