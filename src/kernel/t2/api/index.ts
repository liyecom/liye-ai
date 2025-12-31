/**
 * T2 World State Kernel API
 *
 * Purpose: Expose current danger state coordinates
 * Constraint: Describe only, never prescribe
 *
 * @module T2_WORLD_STATE_KERNEL
 * @version 1.0.0
 */

import type {
  WorldState,
  StatePrimitive,
  StateComparison,
  GetWorldStateInput,
  GetStateDimensionInput,
  CompareSnapshotsInput,
  LiquidityScale,
  CorrelationScale,
  ExpectationScale,
  LeverageScale,
  UncertaintyScale,
} from './types';

// =============================================================================
// Core API Functions
// =============================================================================

/**
 * Get the current 5-dimensional danger state
 *
 * @param input - Domain context and T1 output
 * @returns WorldState - Current danger coordinates
 *
 * @example
 * ```typescript
 * const state = get_world_state({
 *   domain: 'investment-os',
 *   context: { market: 'equity', position: 'long' },
 *   t1_output: {
 *     warnings: ['T1_liquidity_illusion', 'T1_correlation_regime_shift'],
 *     causal_chains: [...]
 *   }
 * });
 *
 * // Returns:
 * // {
 * //   liquidity: { value: 'TIGHT', ... },
 * //   correlation: { value: 'SHIFTING', ... },
 * //   ...
 * // }
 * ```
 */
export function get_world_state(input: GetWorldStateInput): WorldState {
  const { domain, context, t1_output } = input;

  // Map T1 warnings to state assessments
  const liquidity = assess_liquidity(t1_output, context);
  const correlation = assess_correlation(t1_output, context);
  const expectation = assess_expectation(t1_output, context);
  const leverage = assess_leverage(t1_output, context);
  const uncertainty = assess_uncertainty(t1_output, context);

  return {
    liquidity,
    correlation,
    expectation,
    leverage,
    uncertainty,
    timestamp: new Date().toISOString(),
    t1_warnings_active: t1_output.warnings,
    confidence: calculate_confidence(t1_output),
    contains_prediction: false,
    contains_recommendation: false,
  };
}

/**
 * Get a single dimension of the danger state
 *
 * @param input - Dimension name and context
 * @returns StatePrimitive - Single dimension state
 */
export function get_state_dimension(input: GetStateDimensionInput): StatePrimitive {
  const { dimension, context } = input;

  // Simplified assessment for single dimension
  const t1_output = { warnings: [], causal_chains: [] };

  switch (dimension) {
    case 'liquidity':
      return assess_liquidity(t1_output, context);
    case 'correlation':
      return assess_correlation(t1_output, context);
    case 'expectation':
      return assess_expectation(t1_output, context);
    case 'leverage':
      return assess_leverage(t1_output, context);
    case 'uncertainty':
      return assess_uncertainty(t1_output, context);
  }
}

/**
 * Compare two state snapshots
 *
 * @param input - Snapshot IDs to compare
 * @returns StateComparison - Descriptive comparison (no recommendations)
 */
export function compare_state_snapshot(input: CompareSnapshotsInput): StateComparison {
  // Implementation would load snapshots from trace storage
  // For now, return structure definition

  return {
    snapshot_a: {
      id: input.snapshot_a_id,
      world_state: {} as WorldState,
      context: { domain: '', scenario: '', inputs: {} },
    },
    snapshot_b: {
      id: input.snapshot_b_id,
      world_state: {} as WorldState,
      context: { domain: '', scenario: '', inputs: {} },
    },
    changes: [],
    summary: 'State comparison pending implementation',
  };
}

// =============================================================================
// Internal Assessment Functions
// =============================================================================

function assess_liquidity(
  t1_output: GetWorldStateInput['t1_output'],
  context: Record<string, unknown>
): WorldState['liquidity'] {
  const warning_active = t1_output.warnings.includes('T1_liquidity_illusion');

  // Determine scale based on T1 warning and context
  let value: LiquidityScale = 'NORMAL';
  const evidence: string[] = [];

  if (warning_active) {
    value = 'TIGHT';
    evidence.push('T1_liquidity_illusion warning active');
  }

  return {
    dimension: 'liquidity',
    value,
    derived_from: 'T1_liquidity_illusion',
    question: 'Can I access what I need right now?',
    evidence,
  };
}

function assess_correlation(
  t1_output: GetWorldStateInput['t1_output'],
  context: Record<string, unknown>
): WorldState['correlation'] {
  const warning_active = t1_output.warnings.includes('T1_correlation_regime_shift');

  let value: CorrelationScale = 'STABLE';
  const evidence: string[] = [];

  if (warning_active) {
    value = 'SHIFTING';
    evidence.push('T1_correlation_regime_shift warning active');
  }

  return {
    dimension: 'correlation',
    value,
    derived_from: 'T1_correlation_regime_shift',
    question: 'Are my assumed correlations still holding?',
    evidence,
  };
}

function assess_expectation(
  t1_output: GetWorldStateInput['t1_output'],
  context: Record<string, unknown>
): WorldState['expectation'] {
  const warning_active = t1_output.warnings.includes('T1_expectation_saturation');

  let value: ExpectationScale = 'DISTRIBUTED';
  const evidence: string[] = [];

  if (warning_active) {
    value = 'SATURATED';
    evidence.push('T1_expectation_saturation warning active');
  }

  return {
    dimension: 'expectation',
    value,
    derived_from: 'T1_expectation_saturation',
    question: 'How crowded is the consensus view?',
    evidence,
  };
}

function assess_leverage(
  t1_output: GetWorldStateInput['t1_output'],
  context: Record<string, unknown>
): WorldState['leverage'] {
  const warning_active = t1_output.warnings.includes('T1_reflexivity_loop');

  let value: LeverageScale = 'UNLEVERAGED';
  const evidence: string[] = [];

  if (warning_active) {
    value = 'HIGH';
    evidence.push('T1_reflexivity_loop warning active');
  }

  return {
    dimension: 'leverage',
    value,
    derived_from: 'T1_reflexivity_loop',
    question: 'How much will moves be amplified?',
    evidence,
  };
}

function assess_uncertainty(
  t1_output: GetWorldStateInput['t1_output'],
  context: Record<string, unknown>
): WorldState['uncertainty'] {
  const warning_count = t1_output.warnings.length;

  let value: UncertaintyScale = 'LOW';
  const evidence: string[] = [];

  if (warning_count >= 3) {
    value = 'HIGH';
    evidence.push(`${warning_count} T1 warnings active`);
  } else if (warning_count >= 1) {
    value = 'ELEVATED';
    evidence.push(`${warning_count} T1 warning(s) active`);
  }

  return {
    dimension: 'uncertainty',
    value,
    derived_from: null,
    question: 'How confident can I be about any assessment?',
    evidence,
  };
}

function calculate_confidence(t1_output: GetWorldStateInput['t1_output']): number {
  // Confidence decreases as more T1 warnings are active
  const base_confidence = 0.9;
  const penalty_per_warning = 0.1;
  return Math.max(0.3, base_confidence - t1_output.warnings.length * penalty_per_warning);
}

// =============================================================================
// Exports
// =============================================================================

export type {
  WorldState,
  StatePrimitive,
  StateComparison,
  GetWorldStateInput,
  GetStateDimensionInput,
  CompareSnapshotsInput,
};
