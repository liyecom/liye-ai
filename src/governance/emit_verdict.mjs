/**
 * emit_verdict.mjs - Unified Verdict Output Gateway
 *
 * Single point of output for all governance verdicts.
 * Automatically enriches BLOCK verdicts with reasoning assets.
 * Enrichment failure does not block verdict emission.
 *
 * @module governance/emit_verdict
 * @version v0.1
 */

import { enrichVerdict, formatEnrichedVerdictMarkdown } from './verdict_enricher.mjs';
import { formatVerdictMarkdown } from './verdict.mjs';
import { TraceEventType } from './types.mjs';

/**
 * Emit a verdict with optional enrichment
 *
 * @param {Object} verdict - Original verdict from generateVerdict()
 * @param {Object} [options] - Options
 * @param {Object} [options.context] - Additional context for enrichment
 * @param {Object} [options.context.proposed_amount] - The proposed amount that was blocked
 * @param {Object} [options.context.limit_value] - The limit that was exceeded
 * @param {TraceWriter} [options.trace] - Trace writer for audit
 * @returns {Object} Enriched verdict (or original if enrichment fails/skipped)
 *
 * @example
 * const enrichedVerdict = emitVerdict(verdict, {
 *   context: { proposed_amount: 5000, limit_value: 1000 },
 *   trace: traceWriter
 * });
 */
export function emitVerdict(verdict, options = {}) {
  const { context = {}, trace } = options;

  // Record verdict emission start
  if (trace) {
    trace.append(TraceEventType.VERDICT_EMIT, {
      event: 'emit_start',
      verdict_summary: verdict.summary,
      will_enrich: verdict.summary?.includes('blocked')
    });
  }

  // Only attempt enrichment for BLOCK verdicts
  if (!verdict.summary?.includes('blocked')) {
    // ALLOW/DEGRADE/UNKNOWN - pass through unchanged
    if (trace) {
      trace.append(TraceEventType.VERDICT_EMIT, {
        event: 'emit_complete',
        enriched: false,
        reason: 'not_a_block_verdict'
      });
    }
    return verdict;
  }

  // Attempt enrichment
  try {
    const enrichedVerdict = enrichVerdict(verdict, context);

    if (trace) {
      trace.append(TraceEventType.VERDICT_EMIT, {
        event: 'emit_complete',
        enriched: enrichedVerdict.enriched || false,
        has_impact_analysis: !!enrichedVerdict.impact_analysis,
        counterfactual_count: enrichedVerdict.counterfactual_suggestions?.length || 0,
        recommendation_count: enrichedVerdict.fix_recommendations?.length || 0
      });
    }

    return enrichedVerdict;
  } catch (error) {
    // Enrichment failure should NOT block verdict emission
    // Fall back to original verdict
    if (trace) {
      trace.append(TraceEventType.VERDICT_EMIT, {
        event: 'enrichment_failed',
        error: error.message,
        fallback: 'original_verdict'
      });
    }

    console.warn(`[VERDICT_ENRICHMENT_FAILED] ${error.message}`);

    // Return original verdict with minimal enrichment metadata
    return {
      ...verdict,
      enriched: false,
      enrichment_error: error.message
    };
  }
}

/**
 * Emit verdict and format as Markdown
 *
 * @param {Object} verdict - Original verdict
 * @param {Object} [options] - Options (same as emitVerdict)
 * @returns {string} Markdown formatted verdict
 */
export function emitVerdictMarkdown(verdict, options = {}) {
  const emitted = emitVerdict(verdict, options);

  if (emitted.enriched) {
    return formatEnrichedVerdictMarkdown(emitted);
  }

  return formatVerdictMarkdown(emitted);
}

/**
 * Check if a verdict was enriched
 *
 * @param {Object} verdict - Verdict to check
 * @returns {boolean} Whether the verdict was enriched
 */
export function isVerdictEnriched(verdict) {
  return verdict.enriched === true;
}

/**
 * Get enrichment metadata from verdict
 *
 * @param {Object} verdict - Verdict to inspect
 * @returns {Object} Enrichment metadata
 */
export function getEnrichmentMetadata(verdict) {
  return {
    enriched: verdict.enriched || false,
    enrichment_version: verdict.enrichment_version || null,
    rule_version: verdict.rule_version || null,
    has_impact_analysis: !!verdict.impact_analysis,
    counterfactual_count: verdict.counterfactual_suggestions?.length || 0,
    recommendation_count: verdict.fix_recommendations?.length || 0,
    error: verdict.enrichment_error || null
  };
}

// Default export
export default {
  emitVerdict,
  emitVerdictMarkdown,
  isVerdictEnriched,
  getEnrichmentMetadata
};
