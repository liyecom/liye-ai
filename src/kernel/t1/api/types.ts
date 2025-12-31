/**
 * T1 Reasoning Kernel - Type Definitions
 *
 * Core types for causal reasoning primitives.
 * All types are declarative structures, not imperative commands.
 */

// =============================================================================
// Causal Reasoning Types
// =============================================================================

/**
 * A step in a causal chain
 */
export interface CausalStep {
  from: string;
  to: string;
  mechanism: string;
  confidence: number;
}

/**
 * Complete causal chain with metadata
 */
export interface CausalChain {
  id: string;
  trigger: string;
  steps: CausalStep[];
  outcome: string;
  boundary: BoundaryCondition;
  falsifiability: FalsifiabilityCriteria;
  source_t1: string;
}

/**
 * Boundary conditions for when a mechanism applies
 */
export interface BoundaryCondition {
  applies_when: Condition[];
  breaks_down_when: Condition[];
}

export interface Condition {
  description: string;
  testable: boolean;
}

/**
 * Criteria for falsifying a causal claim
 */
export interface FalsifiabilityCriteria {
  test_description: string;
  prediction: string;
  comparison: string;
}

// =============================================================================
// Regime Detection Types
// =============================================================================

/**
 * Input signal for regime detection
 */
export interface RegimeSignal {
  name: string;
  current_value: string | number;
  risk_on_range: string;
  risk_off_range: string;
  weight: number;
}

/**
 * Output of regime detection
 */
export interface RegimeAssessment {
  signals_analyzed: number;
  regime_probabilities: {
    risk_on: number;
    risk_off: number;
    transition: number;
  };
  dominant_regime: 'RISK_ON' | 'RISK_OFF' | 'TRANSITION';
  confidence: number;
  transition_dynamics: TransitionDynamics;
}

export interface TransitionDynamics {
  speed_to_risk_off: 'FAST' | 'MEDIUM' | 'SLOW';
  speed_to_risk_on: 'FAST' | 'MEDIUM' | 'SLOW';
  asymmetry_note: string;
}

// =============================================================================
// False Confidence Types
// =============================================================================

/**
 * Warning about unsupported confidence
 */
export interface FalseConfidenceWarning {
  claim: string;
  violation_type: ViolationType;
  unsupported_because: string;
  required_for_support: string[];
  max_defensible_confidence: number;
}

export type ViolationType =
  | 'PREDICTION_WITHOUT_MECHANISM'
  | 'CERTAINTY_IN_UNCERTAINTY'
  | 'ABSOLUTE_WITHOUT_BOUNDARY'
  | 'ACTIONABLE_IN_REASONING';

// =============================================================================
// T1 Loading Types
// =============================================================================

/**
 * T1 candidate metadata
 */
export interface T1Candidate {
  id: string;
  mechanism_type: string;
  classification: 'ALWAYS_ON' | 'CONTEXTUAL' | 'DEFERRED';
  trigger?: string;
  token_cost_estimate: number;
  marginal_lift: number;
  synergy_with: string[];
}

/**
 * T1 loading decision
 */
export interface T1LoadingDecision {
  always_on: T1Candidate[];
  contextual_activated: T1Candidate[];
  contextual_dormant: T1Candidate[];
  deferred: T1Candidate[];
  total_token_budget_used: number;
  budget_compliance: boolean;
}

// =============================================================================
// Kernel API Response Types
// =============================================================================

/**
 * Standard kernel API response wrapper
 */
export interface KernelResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata: {
    kernel_version: string;
    t1_sources: string[];
    token_cost: number;
    latency_ms: number;
  };
}
