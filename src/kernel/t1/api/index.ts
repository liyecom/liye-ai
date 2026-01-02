/**
 * T1 Reasoning Kernel API
 *
 * Exports causal reasoning primitives, NOT domain conclusions.
 * Returns structures, NOT recommendations.
 *
 * @version 1.0.0
 * @stability v1_stable
 */

// =============================================================================
// Types
// =============================================================================

export interface CausalChain {
  trigger: string;
  steps: string[];
  outcome: string;
  confidence: number;
}

export interface BoundaryCondition {
  applies_when: string[];
  breaks_down_when: string[];
}

export interface RegimeSignal {
  signal: string;
  current_value: string;
  risk_on_interpretation: string;
  risk_off_interpretation: string;
  weight: number;
}

export interface RegimeAssessment {
  signals: RegimeSignal[];
  regime_probability: {
    risk_on: number;
    risk_off: number;
    transition_zone: number;
  };
  transition_asymmetry: string;
}

export interface FalseConfidenceWarning {
  claim: string;
  unsupported_because: string;
  required_evidence: string[];
  confidence_ceiling: number;
}

export interface T1Output {
  causal_chains: CausalChain[];
  boundary_conditions: BoundaryCondition;
  regime_assessment?: RegimeAssessment;
  false_confidence_warnings: FalseConfidenceWarning[];
  t1_sources: string[];
}

// =============================================================================
// Core API Functions
// =============================================================================

/**
 * Detect current market/scenario regime
 *
 * Returns regime probability distribution, NOT trading recommendation.
 *
 * @param signals - Array of market signals with values
 * @returns RegimeAssessment with probabilities
 */
export function detect_regime(signals: RegimeSignal[]): RegimeAssessment {
  // Placeholder implementation - actual logic would score signals
  const risk_off_signals = signals.filter(s =>
    s.current_value.toLowerCase().includes('widening') ||
    s.current_value.toLowerCase().includes('strengthening') ||
    s.current_value.toLowerCase().includes('elevated')
  ).length;

  const total = signals.length || 1;
  const risk_off_prob = risk_off_signals / total;

  return {
    signals,
    regime_probability: {
      risk_on: Math.max(0, 1 - risk_off_prob - 0.2),
      risk_off: risk_off_prob,
      transition_zone: 0.2
    },
    transition_asymmetry: 'Risk-on → Risk-off: FAST (days). Risk-off → Risk-on: SLOW (weeks).'
  };
}

/**
 * Expose causal chain for a given mechanism
 *
 * Returns the cause-effect structure, NOT what to do about it.
 *
 * @param mechanism_id - T1 mechanism identifier
 * @param context - Scenario context
 * @returns CausalChain structure
 */
export function expose_causal_chain(
  mechanism_id: string,
  context: Record<string, unknown>
): CausalChain {
  // T1 mechanism library
  const mechanisms: Record<string, CausalChain> = {
    'liquidity_illusion': {
      trigger: 'Stress event or volatility spike',
      steps: [
        'Stable conditions → Market makers provide tight spreads',
        'Investors assume liquidity is permanent',
        'Volatility spike → Market makers widen/withdraw',
        'Transaction costs spike when exit needed'
      ],
      outcome: 'Liquidity disappears precisely when needed most',
      confidence: 0.85
    },
    'correlation_regime_shift': {
      trigger: 'Systematic stress affecting multiple asset classes',
      steps: [
        'Stress event triggers flight to safety',
        'Flight to safety → Forced selling across classes',
        'Forced selling → Correlations converge toward 1.0',
        'Diversification benefit disappears'
      ],
      outcome: 'Portfolio volatility exceeds historical predictions',
      confidence: 0.80
    },
    'expectation_saturation': {
      trigger: 'Implied probability exceeds 70% threshold',
      steps: [
        'High implied probability → Market pre-positions',
        'Pre-positioning → No marginal buyers at event',
        'Outcome meets expectations → No information surprise',
        'Existing positions seek exit → Selling pressure'
      ],
      outcome: 'Negative price action despite positive outcome',
      confidence: 0.75
    }
  };

  return mechanisms[mechanism_id] || {
    trigger: 'Unknown',
    steps: [],
    outcome: 'Mechanism not found',
    confidence: 0
  };
}

/**
 * Identify and suppress false confidence claims
 *
 * Returns warnings about unsupported claims, NOT alternative claims.
 *
 * @param claims - Array of claims to evaluate
 * @returns Array of FalseConfidenceWarning
 */
export function suppress_false_confidence(
  claims: string[]
): FalseConfidenceWarning[] {
  const warnings: FalseConfidenceWarning[] = [];

  const patterns = [
    {
      pattern: /will (rise|fall|increase|decrease)/i,
      reason: 'Price prediction without causal mechanism',
      evidence: ['Causal chain from current state to predicted state', 'Boundary conditions for prediction']
    },
    {
      pattern: /guaranteed|certain|definitely/i,
      reason: 'Certainty claim in uncertain domain',
      evidence: ['Historical base rate', 'Confidence interval']
    },
    {
      pattern: /always|never/i,
      reason: 'Absolute claim without boundary conditions',
      evidence: ['Cases where claim holds', 'Cases where claim breaks down']
    },
    {
      pattern: /buy|sell|long|short/i,
      reason: 'Actionable recommendation in reasoning output',
      evidence: ['N/A - Kernel forbids trading recommendations']
    }
  ];

  for (const claim of claims) {
    for (const p of patterns) {
      if (p.pattern.test(claim)) {
        warnings.push({
          claim,
          unsupported_because: p.reason,
          required_evidence: p.evidence,
          confidence_ceiling: 0.3
        });
      }
    }
  }

  return warnings;
}

// =============================================================================
// Kernel Metadata
// =============================================================================

export const KERNEL_META = {
  name: 'T1_REASONING_KERNEL',
  version: '1.0.0',
  stability: 'v1_stable',
  exports: ['detect_regime', 'expose_causal_chain', 'suppress_false_confidence'],

  // Budget constraints
  always_on_budget: 0.25,
  contextual_budget: 0.40,

  // Governance
  verdict: 'TRANSFERABLE',
  verdict_frozen: true,
  breaking_changes_allowed: false
};
