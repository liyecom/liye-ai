/**
 * T3 World Dynamics Kernel Type Definitions
 *
 * Purpose: Define state evolution patterns
 * Constraint: Form only - no outcomes, no probabilities, no advice
 */

import type { WorldState } from '../../t2/api/types';

// =============================================================================
// Dynamics Status
// =============================================================================

export type DynamicsStatus = 'DETECTED' | 'NOT_DETECTED' | 'UNCERTAIN';

// =============================================================================
// Dynamics Primitives (Strictly 3)
// =============================================================================

export interface AccelerationPrimitive {
  id: 'acceleration';
  status: DynamicsStatus;
  evidence: string[];
  form_description: string;
  does_not_imply: [
    'Where it will end up',
    'When it will stop',
    'What you should do'
  ];
}

export interface AmplificationPrimitive {
  id: 'amplification';
  status: DynamicsStatus;
  evidence: string[];
  form_description: string;
  does_not_imply: [
    'Final magnitude',
    'Whether this is good or bad',
    'How to dampen it'
  ];
}

export interface PhaseTransitionPrimitive {
  id: 'phase_transition';
  status: DynamicsStatus;
  evidence: string[];
  form_description: string;
  does_not_imply: [
    'Which new phase will emerge',
    'Probability of transition',
    'Whether transition should be avoided'
  ];
}

export type DynamicsPrimitive =
  | AccelerationPrimitive
  | AmplificationPrimitive
  | PhaseTransitionPrimitive;

// =============================================================================
// Dynamics Assessment (Full Output)
// =============================================================================

export interface DynamicsAssessment {
  // Source state
  current_state: WorldState;

  // Observed dynamics
  dynamics: {
    acceleration: AccelerationPrimitive;
    amplification: AmplificationPrimitive;
    phase_transition: PhaseTransitionPrimitive;
  };

  // Form-only description
  pattern_description: string;

  // MANDATORY: Explicit limitations
  what_this_does_not_tell_you: string[];

  // Metadata
  timestamp: string;
  confidence: number;

  // Governance enforcement (type-level)
  contains_prediction: false;
  contains_probability: false;
  contains_recommendation: false;
}

// =============================================================================
// Evolution Form Description
// =============================================================================

export interface EvolutionForm {
  dimension: string;
  current_value: string;
  dynamics_detected: DynamicsStatus[];
  form_description: string;  // Present tense only
  limitations: string[];
}

// =============================================================================
// Phase Boundary Check
// =============================================================================

export interface PhaseBoundaryCheck {
  dimension: string;
  near_boundary: boolean;
  boundary_type: 'lower' | 'upper' | 'unknown';
  evidence: string[];
  form_description: string;

  // Explicit: we do NOT predict transition
  does_not_predict_transition: true;
}

// =============================================================================
// API Input Types
// =============================================================================

export interface AssessDynamicsInput {
  world_state: WorldState;
  context: Record<string, unknown>;
  historical_states?: WorldState[];  // For detecting acceleration
}

export interface DescribeEvolutionFormInput {
  dimension: 'liquidity' | 'correlation' | 'expectation' | 'leverage' | 'uncertainty';
  current_state: WorldState;
  context: Record<string, unknown>;
}

export interface CheckPhaseBoundaryInput {
  dimension: 'liquidity' | 'correlation' | 'expectation' | 'leverage' | 'uncertainty';
  current_state: WorldState;
}

// =============================================================================
// Governance Constraint Types
// =============================================================================

/**
 * Forbidden output fields - compile-time enforcement
 */
type ForbiddenDynamicsFields =
  | 'prediction'
  | 'probability'
  | 'recommendation'
  | 'optimal_action'
  | 'expected_outcome'
  | 'likely_result';

type NoForbiddenDynamicsFields<T> = T extends { [K in ForbiddenDynamicsFields]?: unknown }
  ? never
  : T;

// Compile-time check
export type ValidDynamicsOutput = NoForbiddenDynamicsFields<DynamicsAssessment>;

// =============================================================================
// Output Validation
// =============================================================================

export interface DynamicsValidation {
  valid: boolean;
  violations: {
    field: string;
    violation_type: 'prediction' | 'probability' | 'recommendation';
    content: string;
  }[];
}
