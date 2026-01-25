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
 * Generate markdown report
 *
 * @param {Object} analysis - Analysis results
 * @param {number} days - Days analyzed
 * @returns {string} Markdown report
 */
function generateReport(analysis, days) {
  const { causes, actions, observations, summary } = analysis;

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

  // Summary stats
  const summary = {
    totalEvents: events.length,
    overallSuccessRate: (events.filter(e => e.success).length / events.length * 100).toFixed(1),
    uniqueObservations: observations.length,
    uniqueActions: actions.length,
    uniqueCauses: causes.filter(c => c.cause_id !== 'UNKNOWN').length
  };

  // Generate report
  const report = generateReport({ causes, actions, observations, summary }, days);

  // Write report
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  const date = new Date().toISOString().slice(0, 10);
  const reportPath = join(reportsDir, `PLAYBOOK_EVAL_${date}.md`);
  writeFileSync(reportPath, report);

  console.log(`\n✅ Report generated: ${reportPath}`);
  console.log(`\n📈 Summary:`);
  console.log(`   Success Rate: ${summary.overallSuccessRate}%`);
  console.log(`   Observations: ${summary.uniqueObservations}`);
  console.log(`   Actions: ${summary.uniqueActions}`);
  console.log(`   Causes: ${summary.uniqueCauses}`);

  return { causes, actions, observations, summary, reportPath };
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

export { evaluate, loadOutcomeEvents, analyzeCauses, analyzeActions, analyzeObservations };
