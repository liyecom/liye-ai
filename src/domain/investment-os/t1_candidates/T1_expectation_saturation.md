---
mechanism_type: expectation_gap
id: T1-INV-001
---

# Expectation Saturation Mechanism

When market-implied probability of an event exceeds a critical threshold,
the downside risk increases if the realized outcome merely meets expectations,
due to expectation saturation rather than surprise.

## Causal Chain

1. High implied probability (>70%) → Market pre-positions for outcome
2. Pre-positioning → Reduced marginal buyers at event
3. Event occurs as expected → No new information, no new buyers
4. Existing positions seek exit → Selling pressure despite "good" outcome

## Boundary Condition

**Applies when:**
- Macro or earnings-driven events with clear binary outcomes
- Sufficient liquidity for pre-positioning to occur
- Observable implied probability via options/prediction markets

**Breaks down in:**
- Low-liquidity regimes where pre-positioning is difficult
- Events with continuous rather than binary outcomes
- Situations where outcome significantly exceeds expectations

## Falsifiability

Compare price reaction when:
- Implied probability >70% and outcome meets expectations
- Implied probability <40% and outcome meets expectations

Prediction: Former shows neutral-to-negative reaction; latter shows positive reaction.
