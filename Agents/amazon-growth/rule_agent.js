/**
 * Rule Agent - Amazon Growth OS
 *
 * Purpose: Evaluate boolean triggers only, no verdicts
 *
 * Rules:
 * - ❌ Do NOT output Decision JSON
 * - ❌ Do NOT write recommendations or explanations
 * - ✅ Only output decision_id: true/false
 */

export function applyRules(signals, thresholds) {
  return {
    ACOS_TOO_HIGH: signals.acos > thresholds.max_acos,
    CONVERSION_RATE_TOO_LOW: signals.conversion_rate < thresholds.min_cvr,
    STOCKOUT_RISK: signals.inventory_days_left < thresholds.min_inventory_days
  };
}
