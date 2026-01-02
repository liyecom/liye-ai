# T1 Ablation Results

**Status**: COMPLETE
**Date**: 2025-12-31
**Domain**: investment-os
**Cases**: case_01, case_02, case_03

---

## Ablation Ranking Table

| Rank | T1 Candidate | Avg Marginal Lift | Independence | Critical Cases | Final Status |
|------|--------------|-------------------|--------------|----------------|--------------|
| 1 | **T1_liquidity_illusion** | **58%** | HIGH | 2/3 | ALWAYS_ON |
| 2 | T1_risk_on_off_regime | 48% | MEDIUM | 1/3 | CONTEXTUAL |
| 3 | T1_correlation_regime_shift | 47% | MEDIUM | 1/3 | ALWAYS_ON* |
| 4 | T1_expectation_saturation | 42% | HIGH | 1/3 | CONTEXTUAL |
| 5 | T1_reflexivity_loop | 23% | LOW | 0/3 | CONTEXTUAL |
| 6 | T1_asymmetric_information_decay | 20% | LOW | 0/3 | DEFERRED |

*T1_correlation_regime_shift promoted due to synergy with T1_liquidity_illusion

---

## Always-On Final Set (Budget ≤ 2)

| T1 | Marginal Lift | Rationale |
|----|---------------|-----------|
| T1_liquidity_illusion | 58% | Highest independent contribution, 2/3 cases critical |
| T1_correlation_regime_shift | 47% | Synergy with #1, core stress mechanism |

**Combined Coverage**: Stress behavior + Timing constraint

---

## Contextual Set (Budget ≤ 3)

| T1 | Marginal Lift | Trigger |
|----|---------------|---------|
| T1_risk_on_off_regime | 48% | `regime_ambiguity_detected` |
| T1_expectation_saturation | 42% | `high_implied_probability_event` |
| T1_reflexivity_loop | 23% | `leverage_detected` |

---

## Deferred (Pending More Evidence)

| T1 | Marginal Lift | Blocker |
|----|---------------|---------|
| T1_asymmetric_information_decay | 20% | No critical case, needs news-driven scenarios |

---

## Synergy Matrix

```
                          liquidity  correlation  regime  expectation  reflexivity  asymmetric
T1_liquidity_illusion        -         HIGH        MED       LOW          MED          LOW
T1_correlation_regime_shift  HIGH       -          HIGH      LOW          MED          LOW
T1_risk_on_off_regime        MED       HIGH         -        MED          MED          LOW
T1_expectation_saturation    LOW        LOW        MED        -           LOW          MED
T1_reflexivity_loop          MED        MED        MED       LOW           -           LOW
T1_asymmetric_info_decay     LOW        LOW        LOW       MED          LOW           -
```

**Key Synergy Pair**: T1_liquidity_illusion + T1_correlation_regime_shift (mutual reinforcement under stress)

---

## Policy Application

Based on `top_always_on=2, contextual_max=3`:

```yaml
always_on:
  - T1_liquidity_illusion      # Rank 1
  - T1_correlation_regime_shift # Rank 3 (synergy promoted)

contextual:
  - T1_risk_on_off_regime      # Rank 2
  - T1_expectation_saturation  # Rank 4
  - T1_reflexivity_loop        # Rank 5

deferred:
  - T1_asymmetric_information_decay # Rank 6
```

---

## Budget Analysis

| Category | Count | Token Budget Est. |
|----------|-------|-------------------|
| Always-On | 2 | ~400 tokens |
| Contextual (max) | 3 | ~600 tokens |
| Total (worst case) | 5 | ~1000 tokens |

**Reasoning Budget Compliance**: ✅
- Always-On: 400/1600 = 25% ≤ 25% limit
- Contextual: 600/1600 = 37.5% ≤ 40% limit

---

*Ablation completed: 2025-12-31*
*Policy: top_always_on=2, contextual_max=3*
*Status: FINAL (auto-generated, no manual edits)*
