---
mechanism_type: risk_exposure_failure_mode
id: T1-INV-002
---

# Correlation Regime Shift Mechanism

Asset correlations that appear stable during normal conditions
converge toward 1.0 during stress events, invalidating
diversification assumptions built on historical data.

## Causal Chain

1. Stress event triggers → Flight to safety behavior
2. Flight to safety → Forced selling across asset classes
3. Forced selling → Correlation spike (all assets move together)
4. Correlation spike → Diversification benefit disappears
5. Portfolio volatility exceeds model predictions

## Boundary Condition

**Applies when:**
- Systematic stress event affects multiple asset classes
- Leverage exists in the system requiring deleveraging
- Liquidity constraints force simultaneous selling

**Breaks down in:**
- Idiosyncratic, sector-specific events
- Well-functioning markets with ample liquidity
- Gradual, well-telegraphed transitions

## Falsifiability

Compare realized correlation during:
- VIX < 20 (calm) vs VIX > 35 (stress)
- Pre-crisis (2007) vs crisis (2008) periods

Prediction: Cross-asset correlation should significantly increase during stress.
