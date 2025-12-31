/**
 * T3 World Dynamics Kernel API
 *
 * Purpose: Describe how states evolve under pressure
 * Constraint: Form only - NO outcomes, NO probabilities, NO advice
 *
 * @module T3_WORLD_DYNAMICS_KERNEL
 * @version 1.0.0
 */

import type {
  DynamicsAssessment,
  EvolutionForm,
  PhaseBoundaryCheck,
  AssessDynamicsInput,
  DescribeEvolutionFormInput,
  CheckPhaseBoundaryInput,
  DynamicsStatus,
  AccelerationPrimitive,
  AmplificationPrimitive,
  PhaseTransitionPrimitive,
} from './types';

import type { WorldState } from '../../t2/api/types';

// =============================================================================
// Core API Functions
// =============================================================================

/**
 * Assess which dynamics are active given current state
 *
 * @param input - Current world state and context
 * @returns DynamicsAssessment - Form-only dynamics description
 *
 * CRITICAL: Output describes FORM, not OUTCOME
 */
export function assess_dynamics(input: AssessDynamicsInput): DynamicsAssessment {
  const { world_state, context, historical_states } = input;

  // Detect each dynamics primitive
  const acceleration = detect_acceleration(world_state, historical_states);
  const amplification = detect_amplification(world_state, context);
  const phase_transition = detect_phase_transition(world_state);

  // Build pattern description (form only)
  const pattern_description = build_pattern_description(
    acceleration,
    amplification,
    phase_transition,
    world_state
  );

  return {
    current_state: world_state,
    dynamics: {
      acceleration,
      amplification,
      phase_transition,
    },
    pattern_description,
    what_this_does_not_tell_you: [
      'Whether current dynamics will continue, reverse, or intensify',
      'The probability of any particular outcome',
      'What actions, if any, should be taken',
      'When or how the current pattern might change',
    ],
    timestamp: new Date().toISOString(),
    confidence: calculate_dynamics_confidence(world_state),
    contains_prediction: false,
    contains_probability: false,
    contains_recommendation: false,
  };
}

/**
 * Describe the evolution form for a specific dimension
 *
 * @param input - Dimension and current state
 * @returns EvolutionForm - Present-tense form description
 */
export function describe_evolution_form(input: DescribeEvolutionFormInput): EvolutionForm {
  const { dimension, current_state, context } = input;

  const state_value = get_dimension_value(current_state, dimension);
  const dynamics = detect_dimension_dynamics(current_state, dimension, context);

  return {
    dimension,
    current_value: state_value,
    dynamics_detected: dynamics,
    form_description: `The ${dimension} dimension is currently at ${state_value}. ` +
      `Dynamics observed: ${dynamics.filter(d => d === 'DETECTED').length > 0
        ? 'active patterns detected'
        : 'no active dynamics detected'}.`,
    limitations: [
      `This does not predict future ${dimension} values`,
      `This does not estimate probability of ${dimension} changes`,
    ],
  };
}

/**
 * Check if a dimension is near a phase boundary
 *
 * @param input - Dimension and current state
 * @returns PhaseBoundaryCheck - Boundary proximity assessment
 *
 * CRITICAL: This does NOT predict transition
 */
export function check_phase_boundary(input: CheckPhaseBoundaryInput): PhaseBoundaryCheck {
  const { dimension, current_state } = input;

  const state_value = get_dimension_value(current_state, dimension);
  const { near_boundary, boundary_type } = assess_boundary_proximity(state_value, dimension);

  return {
    dimension,
    near_boundary,
    boundary_type,
    evidence: near_boundary
      ? [`${dimension} at ${state_value}, which is at boundary of scale`]
      : [`${dimension} at ${state_value}, not near boundary`],
    form_description: near_boundary
      ? `The ${dimension} dimension appears near a ${boundary_type} phase boundary.`
      : `The ${dimension} dimension does not appear near a phase boundary.`,
    does_not_predict_transition: true,
  };
}

// =============================================================================
// Internal Detection Functions
// =============================================================================

function detect_acceleration(
  current: WorldState,
  historical?: WorldState[]
): AccelerationPrimitive {
  // Without historical data, cannot detect acceleration
  if (!historical || historical.length < 2) {
    return {
      id: 'acceleration',
      status: 'UNCERTAIN',
      evidence: ['Insufficient historical data to assess acceleration'],
      form_description: 'Rate of change cannot be assessed without historical comparison',
      does_not_imply: [
        'Where it will end up',
        'When it will stop',
        'What you should do',
      ],
    };
  }

  // Simplified: check if uncertainty is elevated
  const status: DynamicsStatus = current.uncertainty.value === 'HIGH' ||
    current.uncertainty.value === 'REGIME_UNKNOWN'
    ? 'DETECTED'
    : 'NOT_DETECTED';

  return {
    id: 'acceleration',
    status,
    evidence: status === 'DETECTED'
      ? ['Multiple state dimensions showing elevated change rates']
      : ['State changes appear at stable rates'],
    form_description: status === 'DETECTED'
      ? 'Rate of state change appears to be increasing'
      : 'Rate of state change appears stable',
    does_not_imply: [
      'Where it will end up',
      'When it will stop',
      'What you should do',
    ],
  };
}

function detect_amplification(
  current: WorldState,
  context: Record<string, unknown>
): AmplificationPrimitive {
  // Check for leverage-related amplification
  const status: DynamicsStatus = current.leverage.value === 'HIGH' ||
    current.leverage.value === 'EXTREME'
    ? 'DETECTED'
    : 'NOT_DETECTED';

  return {
    id: 'amplification',
    status,
    evidence: status === 'DETECTED'
      ? ['Leverage state suggests disproportionate response potential']
      : ['No amplification indicators detected'],
    form_description: status === 'DETECTED'
      ? 'Responses may be disproportionate to inputs'
      : 'Responses appear proportionate to inputs',
    does_not_imply: [
      'Final magnitude',
      'Whether this is good or bad',
      'How to dampen it',
    ],
  };
}

function detect_phase_transition(current: WorldState): PhaseTransitionPrimitive {
  // Check for boundary conditions
  const critical_dimensions = [
    current.liquidity.value === 'CRITICAL',
    current.correlation.value === 'BROKEN',
    current.expectation.value === 'OVERCROWDED',
    current.leverage.value === 'EXTREME',
    current.uncertainty.value === 'REGIME_UNKNOWN',
  ];

  const near_critical = critical_dimensions.filter(Boolean).length;

  let status: DynamicsStatus = 'NOT_DETECTED';
  if (near_critical >= 2) {
    status = 'DETECTED';
  } else if (near_critical === 1) {
    status = 'UNCERTAIN';
  }

  return {
    id: 'phase_transition',
    status,
    evidence: status === 'DETECTED'
      ? ['Multiple dimensions at boundary values']
      : status === 'UNCERTAIN'
        ? ['One dimension at boundary value']
        : ['No dimensions at boundary values'],
    form_description: status === 'DETECTED'
      ? 'System appears near a regime boundary'
      : status === 'UNCERTAIN'
        ? 'System may be approaching a boundary'
        : 'System does not appear near a regime boundary',
    does_not_imply: [
      'Which new phase will emerge',
      'Probability of transition',
      'Whether transition should be avoided',
    ],
  };
}

function build_pattern_description(
  acceleration: AccelerationPrimitive,
  amplification: AmplificationPrimitive,
  phase_transition: PhaseTransitionPrimitive,
  state: WorldState
): string {
  const parts: string[] = [];

  parts.push(`Current state shows ${state.uncertainty.value} uncertainty.`);

  if (acceleration.status === 'DETECTED') {
    parts.push('Acceleration is observed in state changes.');
  }

  if (amplification.status === 'DETECTED') {
    parts.push('Amplification potential is elevated.');
  }

  if (phase_transition.status === 'DETECTED') {
    parts.push('System appears near a phase boundary.');
  } else if (phase_transition.status === 'UNCERTAIN') {
    parts.push('Phase boundary proximity is uncertain.');
  }

  parts.push('This describes current form, not future trajectory.');

  return parts.join(' ');
}

function get_dimension_value(state: WorldState, dimension: string): string {
  switch (dimension) {
    case 'liquidity': return state.liquidity.value;
    case 'correlation': return state.correlation.value;
    case 'expectation': return state.expectation.value;
    case 'leverage': return state.leverage.value;
    case 'uncertainty': return state.uncertainty.value;
    default: return 'UNKNOWN';
  }
}

function detect_dimension_dynamics(
  state: WorldState,
  dimension: string,
  context: Record<string, unknown>
): DynamicsStatus[] {
  // Simplified: return statuses for all three dynamics
  return ['NOT_DETECTED', 'NOT_DETECTED', 'NOT_DETECTED'];
}

function assess_boundary_proximity(
  value: string,
  dimension: string
): { near_boundary: boolean; boundary_type: 'lower' | 'upper' | 'unknown' } {
  const critical_values: Record<string, string[]> = {
    liquidity: ['CRITICAL'],
    correlation: ['BROKEN'],
    expectation: ['OVERCROWDED'],
    leverage: ['EXTREME'],
    uncertainty: ['REGIME_UNKNOWN'],
  };

  const is_critical = critical_values[dimension]?.includes(value) ?? false;

  return {
    near_boundary: is_critical,
    boundary_type: is_critical ? 'upper' : 'unknown',
  };
}

function calculate_dynamics_confidence(state: WorldState): number {
  // Lower confidence when uncertainty is high
  const uncertainty_penalty: Record<string, number> = {
    'LOW': 0,
    'ELEVATED': 0.1,
    'HIGH': 0.2,
    'REGIME_UNKNOWN': 0.4,
  };

  return Math.max(0.3, 0.8 - (uncertainty_penalty[state.uncertainty.value] ?? 0));
}

// =============================================================================
// Exports
// =============================================================================

export type {
  DynamicsAssessment,
  EvolutionForm,
  PhaseBoundaryCheck,
  AssessDynamicsInput,
  DescribeEvolutionFormInput,
  CheckPhaseBoundaryInput,
};
