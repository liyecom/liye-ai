/**
 * explain_observation.mjs - Unified Entry Point for Observations
 *
 * Single point of entry for all explanation generation.
 * Strategies/Rules call this to get explanations for observations.
 *
 * @module reasoning/explain_observation
 * @version v0.1
 */

import { buildExplanation, formatExplanationMarkdown } from './build_explanation.mjs';

// Supported observation types (must have corresponding playbook)
const SUPPORTED_OBSERVATIONS = new Set([
  'ACOS_TOO_HIGH'
  // Add new observations here as playbooks are created:
  // 'CVR_TOO_LOW',
  // 'CTR_TOO_LOW',
  // etc.
]);

/**
 * Generate explanation for an observation
 *
 * @param {string} observationId - Observation ID (e.g., 'ACOS_TOO_HIGH')
 * @param {Object} context - Context containing signals and targets
 * @param {Object} context.signals - Current signal values
 * @param {Object} context.targets - Target thresholds
 * @param {string} [context.trace_id] - Optional trace ID for audit
 * @returns {Object} Explanation result with status
 *
 * @example
 * const result = explainObservation('ACOS_TOO_HIGH', {
 *   signals: { acos: 0.45, days_since_launch: 30 },
 *   targets: { max_acos: 0.30 },
 *   trace_id: 'trace-123'
 * });
 */
export function explainObservation(observationId, context = {}) {
  const { signals = {}, targets = {}, trace_id } = context;

  // Check if observation is supported
  if (!SUPPORTED_OBSERVATIONS.has(observationId)) {
    const unsupportedResult = {
      status: 'UNSUPPORTED_OBSERVATION',
      observation_id: observationId,
      message: `No playbook found for observation: ${observationId}`,
      supported_observations: Array.from(SUPPORTED_OBSERVATIONS),
      generated_at: new Date().toISOString()
    };

    // Trace unsupported observation (if trace system available)
    if (trace_id) {
      unsupportedResult.trace_id = trace_id;
      // TODO: integrate with trace system when available
      console.warn(`[TRACE:${trace_id}] UNSUPPORTED_OBSERVATION: ${observationId}`);
    }

    return unsupportedResult;
  }

  try {
    const explanation = buildExplanation(observationId, signals, targets, { trace_id });

    return {
      status: 'SUCCESS',
      explanation
    };
  } catch (error) {
    const errorResult = {
      status: 'ERROR',
      observation_id: observationId,
      message: error.message,
      generated_at: new Date().toISOString()
    };

    if (trace_id) {
      errorResult.trace_id = trace_id;
      console.error(`[TRACE:${trace_id}] ERROR: ${error.message}`);
    }

    return errorResult;
  }
}

/**
 * Get explanation as Markdown (convenience wrapper)
 *
 * @param {string} observationId - Observation ID
 * @param {Object} context - Context containing signals and targets
 * @returns {string} Markdown formatted explanation or error message
 */
export function explainObservationMarkdown(observationId, context = {}) {
  const result = explainObservation(observationId, context);

  if (result.status === 'SUCCESS') {
    return formatExplanationMarkdown(result.explanation);
  }

  return `# Explanation Unavailable\n\n**Status:** ${result.status}\n**Message:** ${result.message}`;
}

/**
 * Check if an observation type is supported
 *
 * @param {string} observationId - Observation ID to check
 * @returns {boolean} Whether the observation is supported
 */
export function isObservationSupported(observationId) {
  return SUPPORTED_OBSERVATIONS.has(observationId);
}

/**
 * Get list of all supported observation types
 *
 * @returns {string[]} Array of supported observation IDs
 */
export function getSupportedObservations() {
  return Array.from(SUPPORTED_OBSERVATIONS);
}

// Default export
export default {
  explainObservation,
  explainObservationMarkdown,
  isObservationSupported,
  getSupportedObservations
};
