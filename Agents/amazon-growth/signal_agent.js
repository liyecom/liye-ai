/**
 * Signal Agent - Amazon Growth OS
 *
 * Purpose: Compute metrics only, no judgments
 *
 * Rules:
 * - ❌ Do NOT return decisions
 * - ❌ Do NOT compare benchmarks
 * - ✅ Only return numeric facts
 */

export function runSignals(input) {
  return {
    acos: input.ad_spend / input.ad_sales,
    tacos: input.ad_spend / input.total_sales,
    conversion_rate: input.orders / input.sessions,
    inventory_days_left: input.inventory_units / input.daily_sales_velocity
  };
}
