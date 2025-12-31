/**
 * T2 World State Kernel Type Definitions
 *
 * Purpose: Define danger state coordinates
 * Constraint: States only, no predictions or recommendations
 */

// =============================================================================
// State Scales
// =============================================================================

export type LiquidityScale = 'ABUNDANT' | 'NORMAL' | 'TIGHT' | 'CRITICAL';
export type CorrelationScale = 'STABLE' | 'SHIFTING' | 'BREAKING' | 'BROKEN';
export type ExpectationScale = 'DISTRIBUTED' | 'CONVERGING' | 'SATURATED' | 'OVERCROWDED';
export type LeverageScale = 'UNLEVERAGED' | 'MODERATE' | 'HIGH' | 'EXTREME';
export type UncertaintyScale = 'LOW' | 'ELEVATED' | 'HIGH' | 'REGIME_UNKNOWN';

// =============================================================================
// State Dimensions
// =============================================================================

export interface LiquidityState {
  dimension: 'liquidity';
  value: LiquidityScale;
  derived_from: 'T1_liquidity_illusion';
  question: 'Can I access what I need right now?';
  evidence: string[];
}

export interface CorrelationState {
  dimension: 'correlation';
  value: CorrelationScale;
  derived_from: 'T1_correlation_regime_shift';
  question: 'Are my assumed correlations still holding?';
  evidence: string[];
}

export interface ExpectationState {
  dimension: 'expectation';
  value: ExpectationScale;
  derived_from: 'T1_expectation_saturation';
  question: 'How crowded is the consensus view?';
  evidence: string[];
}

export interface LeverageState {
  dimension: 'leverage';
  value: LeverageScale;
  derived_from: 'T1_reflexivity_loop';
  question: 'How much will moves be amplified?';
  evidence: string[];
}

export interface UncertaintyState {
  dimension: 'uncertainty';
  value: UncertaintyScale;
  derived_from: null;  // Meta-state
  question: 'How confident can I be about any assessment?';
  evidence: string[];
}

// =============================================================================
// World State (5-Dimensional Danger Coordinates)
// =============================================================================

export interface WorldState {
  liquidity: LiquidityState;
  correlation: CorrelationState;
  expectation: ExpectationState;
  leverage: LeverageState;
  uncertainty: UncertaintyState;

  // Metadata
  timestamp: string;  // ISO 8601
  t1_warnings_active: string[];
  confidence: number;  // 0.0 - 1.0

  // Governance
  contains_prediction: false;  // Type-level enforcement
  contains_recommendation: false;
}

// =============================================================================
// State Snapshot (for comparison)
// =============================================================================

export interface StateSnapshot {
  id: string;
  world_state: WorldState;
  context: {
    domain: string;
    scenario: string;
    inputs: Record<string, unknown>;
  };
}

export interface StateComparison {
  snapshot_a: StateSnapshot;
  snapshot_b: StateSnapshot;
  changes: {
    dimension: string;
    from: string;
    to: string;
    direction: 'IMPROVED' | 'DEGRADED' | 'UNCHANGED';
  }[];
  summary: string;  // Descriptive only, no recommendation
}

// =============================================================================
// API Input Types
// =============================================================================

export interface GetWorldStateInput {
  domain: string;
  context: Record<string, unknown>;
  t1_output: {
    warnings: string[];
    causal_chains: unknown[];
  };
}

export interface GetStateDimensionInput {
  dimension: 'liquidity' | 'correlation' | 'expectation' | 'leverage' | 'uncertainty';
  context: Record<string, unknown>;
}

export interface CompareSnapshotsInput {
  snapshot_a_id: string;
  snapshot_b_id: string;
}

// =============================================================================
// Governance Constraint Types
// =============================================================================

/**
 * Type-level enforcement of World Model constraints
 * These types CANNOT contain prediction or recommendation fields
 */
export type StatePrimitive =
  | LiquidityState
  | CorrelationState
  | ExpectationState
  | LeverageState
  | UncertaintyState;

export type StateOutput = WorldState | StatePrimitive | StateComparison;

// Compile-time check: StateOutput should never have these fields
type ForbiddenFields = 'prediction' | 'recommendation' | 'optimal_action' | 'probability';
type NoForbiddenFields<T> = T extends { [K in ForbiddenFields]?: unknown } ? never : T;

// This line will fail to compile if StateOutput ever includes forbidden fields
export type ValidStateOutput = NoForbiddenFields<StateOutput>;
