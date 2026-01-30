/**
 * action_outcome.mjs - ActionOutcomeEvent Builder and Recorder
 *
 * P2.2: Enables the feedback loop by recording outcomes of executed actions.
 * Events are stored in trace system for later analysis by playbook_evaluator.
 *
 * @module reasoning/feedback
 * @version v0.1
 */

import { randomUUID } from 'crypto';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Default storage location (trace directory)
const OUTCOMES_DIR = join(__dirname, '../../../traces/action_outcomes');

/**
 * Create an ActionOutcomeEvent
 *
 * @param {Object} params - Event parameters
 * @param {string} params.trace_id - Trace ID linking to original explanation
 * @param {string} params.observation_id - Observation that triggered action
 * @param {string} params.action_id - Action that was executed
 * @param {Object} [params.cause_id] - Cause that led to this action
 * @param {Object} [params.before_metrics] - Metrics before action
 * @param {Object} [params.after_metrics] - Metrics after action
 * @param {boolean} params.success - Whether action achieved expected outcome
 * @param {string} [params.expected_outcome] - What was expected
 * @param {string} [params.actual_outcome] - What actually happened
 * @param {string} [params.notes] - Additional context
 * @param {string} [params.evaluator] - 'auto' or 'manual'
 * @returns {Object} ActionOutcomeEvent
 */
export function createActionOutcomeEvent(params) {
  const {
    trace_id,
    observation_id,
    action_id,
    cause_id = null,
    before_metrics = null,
    after_metrics = null,
    success,
    expected_outcome = null,
    actual_outcome = null,
    notes = null,
    evaluator = 'auto'
  } = params;

  // Calculate delta if both metrics provided
  let delta = null;
  if (before_metrics?.values && after_metrics?.values) {
    delta = {};
    for (const key of Object.keys(after_metrics.values)) {
      if (before_metrics.values[key] !== undefined) {
        delta[key] = after_metrics.values[key] - before_metrics.values[key];
      }
    }
  }

  const event = {
    event_id: `aoe_${randomUUID().slice(0, 8)}`,
    trace_id,
    observation_id,
    action_id,
    timestamp: new Date().toISOString(),
    success,
    evaluator
  };

  // Add optional fields
  if (cause_id) event.cause_id = cause_id;
  if (before_metrics) event.before_metrics = before_metrics;
  if (after_metrics) event.after_metrics = after_metrics;
  if (delta) event.delta = delta;
  if (expected_outcome) event.expected_outcome = expected_outcome;
  if (actual_outcome) event.actual_outcome = actual_outcome;
  if (notes) event.notes = notes;

  return event;
}

/**
 * Record an ActionOutcomeEvent to the trace system
 *
 * @param {Object} event - ActionOutcomeEvent to record
 * @param {Object} [options] - Options
 * @param {string} [options.outputDir] - Override output directory
 * @returns {Object} { success: boolean, path: string }
 */
export function recordActionOutcome(event, options = {}) {
  const { outputDir = OUTCOMES_DIR } = options;

  // Ensure directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Append to daily NDJSON file
  const date = new Date().toISOString().slice(0, 10);
  const filePath = join(outputDir, `outcomes_${date}.ndjson`);

  try {
    appendFileSync(filePath, JSON.stringify(event) + '\n');
    return { success: true, path: filePath };
  } catch (error) {
    console.error(`[ACTION_OUTCOME] Failed to record: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Quick helper to record a successful action outcome
 *
 * @param {string} trace_id - Trace ID
 * @param {string} observation_id - Observation ID
 * @param {string} action_id - Action ID
 * @param {Object} delta - Metric changes
 * @param {string} [notes] - Additional notes
 * @returns {Object} Recorded event
 */
export function recordSuccess(trace_id, observation_id, action_id, delta, notes = null) {
  const event = createActionOutcomeEvent({
    trace_id,
    observation_id,
    action_id,
    success: true,
    actual_outcome: 'Action achieved expected results',
    notes
  });

  if (delta) {
    event.delta = delta;
  }

  recordActionOutcome(event);
  return event;
}

/**
 * Quick helper to record a failed action outcome
 *
 * @param {string} trace_id - Trace ID
 * @param {string} observation_id - Observation ID
 * @param {string} action_id - Action ID
 * @param {string} reason - Why it failed
 * @returns {Object} Recorded event
 */
export function recordFailure(trace_id, observation_id, action_id, reason) {
  const event = createActionOutcomeEvent({
    trace_id,
    observation_id,
    action_id,
    success: false,
    actual_outcome: reason,
    notes: `Action did not achieve expected results: ${reason}`
  });

  recordActionOutcome(event);
  return event;
}

/**
 * Record outcome with full before/after metrics comparison
 *
 * @param {Object} params - Parameters
 * @param {string} params.trace_id - Trace ID
 * @param {string} params.observation_id - Observation ID
 * @param {string} params.action_id - Action ID
 * @param {string} params.cause_id - Cause ID
 * @param {Object} params.before - Before metrics { window, values }
 * @param {Object} params.after - After metrics { window, values }
 * @param {string} params.primary_metric - Key metric to evaluate success
 * @param {string} params.expected_direction - 'up' or 'down'
 * @returns {Object} Recorded event with success evaluated
 */
export function recordWithMetrics(params) {
  const {
    trace_id,
    observation_id,
    action_id,
    cause_id,
    before,
    after,
    primary_metric,
    expected_direction
  } = params;

  // Calculate delta
  const beforeValue = before.values[primary_metric];
  const afterValue = after.values[primary_metric];
  const delta = afterValue - beforeValue;

  // Determine success based on expected direction
  const success = expected_direction === 'up'
    ? delta > 0
    : delta < 0;

  const event = createActionOutcomeEvent({
    trace_id,
    observation_id,
    action_id,
    cause_id,
    before_metrics: before,
    after_metrics: after,
    success,
    expected_outcome: `${primary_metric} should go ${expected_direction}`,
    actual_outcome: `${primary_metric} changed by ${delta > 0 ? '+' : ''}${delta.toFixed(4)}`,
    evaluator: 'auto'
  });

  recordActionOutcome(event);
  return event;
}

// Default export
export default {
  createActionOutcomeEvent,
  recordActionOutcome,
  recordSuccess,
  recordFailure,
  recordWithMetrics
};
