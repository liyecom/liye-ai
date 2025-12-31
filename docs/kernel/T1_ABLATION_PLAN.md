# T1 Ablation Plan (Phase 2)

**Status**: PLANNED
**Purpose**: Optimize T1 loading, NOT validate T1 existence

---

## Objective

Ablation answers: **"Which T1 candidates drive the most lift?"**

This is for **optimization**, not **validation**. T1 verdict is already FROZEN.

---

## Priority Order

Based on Phase 1 contribution analysis:

| Priority | T1 Candidate | Rationale |
|----------|--------------|-----------|
| 1 | T1_liquidity_illusion | 2/3 cases high impact |
| 2 | T1_correlation_regime_shift | Core stress mechanism |
| 3 | T1_risk_on_off_regime | Case 03 framework driver |
| 4 | T1_expectation_saturation | Case 01 critical mechanism |

---

## Experiment Design

### Methodology

For each T1 candidate:
1. Run case with **only that T1** loaded
2. Compare lift to full-T1 condition
3. Compute **marginal contribution**

### Test Cases

| Case | Domain | Scenario |
|------|--------|----------|
| case_01 | investment-os | Event-driven risk assessment |
| case_02 | investment-os | Portfolio hidden risk |
| case_03 | investment-os | Risk-on/off regime |

### Metrics

| Metric | Definition |
|--------|------------|
| Marginal Lift | Lift(single T1) / Lift(all T1) |
| Independence | Does T1 work alone? |
| Synergy | Does T1 amplify other T1s? |

---

## Expected Outputs

### Per-T1 Report

```yaml
t1_id: T1_liquidity_illusion
marginal_lift: 0.65  # 65% of full lift achieved with this T1 alone
independence: HIGH   # Works well in isolation
synergy: MEDIUM      # Some amplification with T1_correlation_regime_shift
recommendation: ALWAYS_ON  # Confirmed
```

### Ablation Summary Table

| T1 | Marginal Lift | Independence | Synergy | Final Status |
|----|---------------|--------------|---------|--------------|
| T1_liquidity_illusion | - | - | - | - |
| T1_correlation_regime_shift | - | - | - | - |
| T1_risk_on_off_regime | - | - | - | - |
| T1_expectation_saturation | - | - | - | - |

---

## Decision Rules

### Promotion to Always-On

- Marginal Lift > 50%
- Independence = HIGH
- OR Synergy = HIGH with existing always-on

### Remain Contextual

- Marginal Lift 20-50%
- Works in specific case types

### Demote to Deferred

- Marginal Lift < 20%
- No clear contribution pattern

---

## Execution Timeline

| Phase | Task | Status |
|-------|------|--------|
| 2.1 | Single-T1 experiments | PENDING |
| 2.2 | Synergy analysis | PENDING |
| 2.3 | Final classification | PENDING |

---

## Constraints

1. **Do NOT re-validate T1** - Verdict is frozen
2. **Do NOT remove T1 from kernel** - Only optimize ordering
3. **Do NOT change always-on without Architecture review**

---

*Plan created: 2025-12-31*
*Status: PENDING EXECUTION*
