#!/usr/bin/env node
/**
 * Business Probe: Bid Recommend Outcome (Week 6)
 * SSOT: .claude/scripts/proactive/business_probe_bid_recommend_outcome.mjs
 *
 * Control Plane component: measures business success signal for bid_recommend playbook.
 *
 * Trigger conditions:
 * - playbook_id == "bid_recommend"
 * - operator_decision == "approve"
 * - action_taken == "applied" with applied_at timestamp
 *
 * Measurement:
 * - before: [applied_at - lookback_days, applied_at)
 * - after: [applied_at, applied_at + 3d)
 * - improved: acos_after <= acos_before * 0.95 AND clicks_after >= 20
 *
 * Usage:
 *   ENGINE_T1_DATA_DIR=/path/to/t1 node .claude/scripts/proactive/business_probe_bid_recommend_outcome.mjs --run-id <run_id>
 *
 * Output: JSON with business_probe_status and metrics
 */

import { readFileSync, appendFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Constants
const EPSILON = 1e-9;
const IMPROVEMENT_THRESHOLD = 0.95;  // ACOS must decrease by at least 5%
const MIN_CLICKS_AFTER = 20;  // Minimum clicks for valid measurement
const AFTER_WINDOW_DAYS = 3;  // Measurement window after applied_at

// Required environment variable
const ENGINE_T1_DATA_DIR = process.env.ENGINE_T1_DATA_DIR;

// Facts directory (append-only)
const FACTS_DIR = join(__dirname, '../../../state/memory/facts');
const BUSINESS_PROBES_FILE = join(FACTS_DIR, 'fact_business_probes_bid_recommend.jsonl');

// Runs directory
const RUNS_DIR = join(__dirname, '../../../data/runs');

/**
 * Append a fact record (append-only, no overwrites)
 */
function appendFact(factRecord) {
  mkdirSync(FACTS_DIR, { recursive: true });
  appendFileSync(BUSINESS_PROBES_FILE, JSON.stringify(factRecord) + '\n');
}

/**
 * Load run metadata from runs directory
 */
function loadRunMeta(runId) {
  const runDir = join(RUNS_DIR, runId);
  const metaPath = join(runDir, 'meta.json');

  if (!existsSync(metaPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(metaPath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

/**
 * Load playbook output from runs directory
 */
function loadPlaybookOutput(runId) {
  const runDir = join(RUNS_DIR, runId);
  const outputPath = join(runDir, 'playbook_io.json');

  if (!existsSync(outputPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(outputPath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

/**
 * Load operator callback from runs directory
 */
function loadOperatorCallback(runId) {
  const runDir = join(RUNS_DIR, runId);
  const callbackPath = join(runDir, 'operator_callback.json');

  if (!existsSync(callbackPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(callbackPath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

/**
 * Query T1 data for keyword metrics
 * Fail-closed: returns null if data unavailable
 */
function queryT1Metrics(entityKey, startDate, endDate) {
  if (!ENGINE_T1_DATA_DIR) {
    console.error('[business_probe] ENGINE_T1_DATA_DIR not set');
    return null;
  }

  if (!existsSync(ENGINE_T1_DATA_DIR)) {
    console.error(`[business_probe] T1 directory not found: ${ENGINE_T1_DATA_DIR}`);
    return null;
  }

  // Try to load keyword metrics from T1
  // Expected structure: ENGINE_T1_DATA_DIR/keyword_metrics/ or similar
  const metricsDir = join(ENGINE_T1_DATA_DIR, 'keyword_metrics');

  if (!existsSync(metricsDir)) {
    console.error(`[business_probe] Metrics directory not found: ${metricsDir}`);
    return null;
  }

  // Week 6: Stub implementation - return null to trigger insufficient_data
  // In production, this would query parquet files or DuckDB
  console.error('[business_probe] T1 query not fully implemented - returning null');
  return null;
}

/**
 * Calculate business outcome
 */
function calculateBusinessOutcome(metricsBefore, metricsAfter, anomalyDirection) {
  if (!metricsBefore || !metricsAfter) {
    return {
      status: 'insufficient_data',
      reason: 'missing_metrics_data'
    };
  }

  const acosBefore = metricsBefore.acos;
  const acosAfter = metricsAfter.acos;
  const clicksAfter = metricsAfter.clicks || 0;

  // Validate we have enough data
  if (acosBefore === null || acosBefore === undefined ||
      acosAfter === null || acosAfter === undefined) {
    return {
      status: 'insufficient_data',
      reason: 'missing_acos_values'
    };
  }

  if (clicksAfter < MIN_CLICKS_AFTER) {
    return {
      status: 'insufficient_data',
      reason: `clicks_after=${clicksAfter} < ${MIN_CLICKS_AFTER} minimum`
    };
  }

  // Calculate improvement
  // For ACOS (anomaly_direction='low'), lower is better
  // improved = acos_after <= acos_before * 0.95 (5% improvement)
  const improvementRatio = (acosBefore + EPSILON) > 0 ? acosAfter / (acosBefore + EPSILON) : 1;
  const improved = improvementRatio <= IMPROVEMENT_THRESHOLD;
  const improvementPct = (1 - improvementRatio) * 100;

  return {
    status: 'measured',
    improved,
    improvement_pct: Math.round(improvementPct * 100) / 100,
    acos_before: acosBefore,
    acos_after: acosAfter,
    clicks_after: clicksAfter,
    improvement_threshold: IMPROVEMENT_THRESHOLD
  };
}

/**
 * Run business probe for a specific run
 */
function runBusinessProbe(runId) {
  const timestamp = new Date().toISOString();

  // 1. Load run metadata
  const runMeta = loadRunMeta(runId);
  if (!runMeta) {
    return {
      run_id: runId,
      timestamp,
      business_probe_status: 'insufficient_data',
      reason: 'run_meta_not_found'
    };
  }

  // 2. Verify playbook_id is bid_recommend
  if (runMeta.playbook_id !== 'bid_recommend') {
    return {
      run_id: runId,
      timestamp,
      business_probe_status: 'not_applicable',
      reason: `playbook_id=${runMeta.playbook_id} is not bid_recommend`
    };
  }

  // 3. Load operator callback
  const operatorCallback = loadOperatorCallback(runId);
  if (!operatorCallback) {
    return {
      run_id: runId,
      timestamp,
      business_probe_status: 'insufficient_data',
      reason: 'operator_callback_not_found'
    };
  }

  // 4. Verify operator approved and applied
  if (operatorCallback.decision !== 'approve') {
    return {
      run_id: runId,
      timestamp,
      business_probe_status: 'not_applicable',
      reason: `operator_decision=${operatorCallback.decision} is not approve`
    };
  }

  if (operatorCallback.action_taken !== 'applied') {
    return {
      run_id: runId,
      timestamp,
      business_probe_status: 'insufficient_data',
      reason: `action_taken=${operatorCallback.action_taken} is not applied`
    };
  }

  if (!operatorCallback.applied_at) {
    return {
      run_id: runId,
      timestamp,
      business_probe_status: 'insufficient_data',
      reason: 'applied_at timestamp missing'
    };
  }

  // 5. Load playbook output for entities and primary_metric
  const playbookOutput = loadPlaybookOutput(runId);
  if (!playbookOutput) {
    return {
      run_id: runId,
      timestamp,
      business_probe_status: 'insufficient_data',
      reason: 'playbook_output_not_found'
    };
  }

  const entities = playbookOutput.entities || [];
  const primaryMetric = playbookOutput.primary_metric || { name: 'acos', anomaly_direction: 'low', lookback_days: 7 };

  if (entities.length === 0) {
    return {
      run_id: runId,
      timestamp,
      business_probe_status: 'insufficient_data',
      reason: 'no_entities_in_output'
    };
  }

  // 6. Calculate measurement windows
  const appliedAt = new Date(operatorCallback.applied_at);
  const lookbackDays = primaryMetric.lookback_days || 7;

  const beforeStart = new Date(appliedAt.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const beforeEnd = appliedAt;
  const afterStart = appliedAt;
  const afterEnd = new Date(appliedAt.getTime() + AFTER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // 7. Check if after window has passed
  if (new Date() < afterEnd) {
    return {
      run_id: runId,
      timestamp,
      business_probe_status: 'pending',
      reason: `after_window not yet complete (ends ${afterEnd.toISOString()})`,
      window: {
        before: { start: beforeStart.toISOString(), end: beforeEnd.toISOString() },
        after: { start: afterStart.toISOString(), end: afterEnd.toISOString() }
      }
    };
  }

  // 8. Query T1 metrics for each entity
  const entityResults = [];
  let totalImproved = 0;
  let totalMeasured = 0;

  for (const entity of entities) {
    const entityKey = entity.entity_key;

    const metricsBefore = queryT1Metrics(entityKey, beforeStart, beforeEnd);
    const metricsAfter = queryT1Metrics(entityKey, afterStart, afterEnd);

    const outcome = calculateBusinessOutcome(metricsBefore, metricsAfter, primaryMetric.anomaly_direction);

    entityResults.push({
      entity_key: entityKey,
      outcome
    });

    if (outcome.status === 'measured') {
      totalMeasured++;
      if (outcome.improved) {
        totalImproved++;
      }
    }
  }

  // 9. Aggregate results
  const aggregateResult = {
    run_id: runId,
    timestamp,
    playbook_id: 'bid_recommend',
    primary_metric: primaryMetric,
    window: {
      before: { start: beforeStart.toISOString(), end: beforeEnd.toISOString() },
      after: { start: afterStart.toISOString(), end: afterEnd.toISOString() }
    },
    entities_total: entities.length,
    entities_measured: totalMeasured,
    entities_improved: totalImproved,
    entity_results: entityResults
  };

  if (totalMeasured === 0) {
    aggregateResult.business_probe_status = 'insufficient_data';
    aggregateResult.reason = 'no_entities_measured';
  } else {
    aggregateResult.business_probe_status = 'measured';
    aggregateResult.improved = totalImproved >= totalMeasured * 0.5;  // Majority improved
    aggregateResult.improve_rate = totalImproved / totalMeasured;
  }

  // 10. Append to facts (append-only)
  appendFact({
    event_type: 'business_probe',
    probe_type: 'bid_recommend_outcome',
    ...aggregateResult
  });

  return aggregateResult;
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);

  // Parse --run-id argument
  const runIdIndex = args.indexOf('--run-id');
  if (runIdIndex === -1 || !args[runIdIndex + 1]) {
    console.error('Usage: node business_probe_bid_recommend_outcome.mjs --run-id <run_id>');
    console.error('Required: ENGINE_T1_DATA_DIR environment variable');
    process.exit(1);
  }

  const runId = args[runIdIndex + 1];

  console.error(`[business_probe] Starting bid_recommend outcome probe for run: ${runId}`);
  console.error(`[business_probe] ENGINE_T1_DATA_DIR: ${ENGINE_T1_DATA_DIR || '(not set)'}`);

  try {
    const result = runBusinessProbe(runId);

    console.log(JSON.stringify(result, null, 2));

    // Exit code based on status
    if (result.business_probe_status === 'measured') {
      process.exit(0);
    } else if (result.business_probe_status === 'pending') {
      process.exit(2);  // Special exit code for pending
    } else {
      process.exit(1);  // insufficient_data or not_applicable
    }

  } catch (error) {
    const result = {
      run_id: runId,
      timestamp: new Date().toISOString(),
      business_probe_status: 'error',
      error: {
        code: 'PROBE_FAILED',
        message: error.message
      }
    };

    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

// Only run if directly executed
const isDirectRun = process.argv[1]?.endsWith('business_probe_bid_recommend_outcome.mjs');
if (isDirectRun) {
  main();
}

export { runBusinessProbe, calculateBusinessOutcome, queryT1Metrics };
