---
mechanism_type: threshold_regime_shift
id: T1-INV-003
---

# Liquidity Illusion Mechanism

Apparent market liquidity is endogenous to stability;
the liquidity that exists when you don't need it
disappears precisely when you need it most.

## Causal Chain

1. Stable conditions → Market makers provide tight spreads
2. Tight spreads → Investors assume liquidity is permanent
3. Volatility spike → Market makers widen spreads or withdraw
4. Spread widening → Transaction costs spike
5. High costs → Investors delay selling → Further stress

## Boundary Condition

**Applies when:**
- Assets with dealer-intermediated markets
- Positions sized based on normal-condition liquidity
- Sudden information arrival or volatility spike

**Breaks down in:**
- Exchange-traded assets with continuous auction
- Small positions relative to market depth
- Gradual, anticipated information release

## Falsifiability

Compare bid-ask spreads during:
- Low volatility (VIX < 15) vs high volatility (VIX > 30)
- Normal trading days vs major event days

Prediction: Spreads should widen non-linearly as volatility increases.
