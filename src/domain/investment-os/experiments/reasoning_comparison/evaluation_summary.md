# Investment Domain: Reasoning Lift Evaluation Summary

## Experiment Overview

| Case | Scenario | Status |
|------|----------|--------|
| Case 01 | Event-driven risk assessment | ✅ COMPLETED |
| Case 02 | Portfolio hidden risk exposure diagnosis | ✅ COMPLETED |
| Case 03 | Risk-on vs risk-off regime trade-off | ✅ COMPLETED |

---

## Evaluation Criteria

Reference: `docs/architecture/REASONING_LIFT_CRITERIA.md`

### 4-Dimension Framework

| Dimension | Definition | Scoring |
|-----------|------------|---------|
| **Causal Explicitness** | Are cause-effect relationships clearly stated with mechanism? | 1-5 |
| **Assumption Clarity** | Are underlying assumptions surfaced and acknowledged? | 1-5 |
| **Hallucination Risk** | Does output contain unsupported or fabricated claims? | 1-5 (lower = better) |
| **Actionability** | Is the reasoning practically applicable to decisions? | 1-5 |

---

## Case Results

### Case 01: Event-driven Risk Assessment

| Dimension | Baseline | T1-Enabled | Delta |
|-----------|----------|------------|-------|
| Causal Explicitness | 2 | 5 | **+3** |
| Assumption Clarity | 2 | 4 | **+2** |
| Hallucination Risk | 2 | 2 | 0 |
| Actionability | 2 | 4 | **+2** |

**Observations:**
- **Baseline**: Lists risk categories without causal mechanism. Concludes with vague "moderately elevated risk."
- **T1-Enabled**: Explicit causal chain (expectation saturation → pre-positioning → no marginal buyers → selling pressure). Includes boundary conditions and falsifiable prediction.

**Case Verdict**: **LIFT CONFIRMED** (3/4 dimensions improved, Hallucination Risk stable)

---

### Case 02: Portfolio Hidden Risk Exposure

| Dimension | Baseline | T1-Enabled | Delta |
|-----------|----------|------------|-------|
| Causal Explicitness | 2 | 5 | **+3** |
| Assumption Clarity | 2 | 5 | **+3** |
| Hallucination Risk | 2 | 2 | 0 |
| Actionability | 2 | 4 | **+2** |

**Observations:**
- **Baseline**: Identifies risks (correlation, liquidity, EM currency) without mechanism. Concludes "diversification may be overstated."
- **T1-Enabled**: Quantified correlation regime shift (table with 2010-2019 vs 2008 data), explicit causal chains for liquidity illusion and reflexive EM exposure, multiple falsifiable predictions.

**Case Verdict**: **LIFT CONFIRMED** (3/4 dimensions improved, Hallucination Risk stable)

---

### Case 03: Risk-On vs Risk-Off Regime

| Dimension | Baseline | T1-Enabled | Delta |
|-----------|----------|------------|-------|
| Causal Explicitness | 2 | 5 | **+3** |
| Assumption Clarity | 2 | 4 | **+2** |
| Hallucination Risk | 2 | 2 | 0 |
| Actionability | 2 | 5 | **+3** |

**Observations:**
- **Baseline**: Two-handed analysis ("arguments for, arguments against"), concludes "depends on individual circumstances." No framework for decision.
- **T1-Enabled**: Signal-to-regime mapping table, regime transition asymmetry mechanism, scenario probability/outcome matrix, weighted decision framework with 75% structural favor, falsifiable predictions.

**Case Verdict**: **LIFT CONFIRMED** (3/4 dimensions improved, Hallucination Risk stable)

---

## Aggregate Analysis

### Dimension-wise Summary

| Dimension | Cases with Lift | Avg Delta | Verdict |
|-----------|-----------------|-----------|---------|
| Causal Explicitness | 3/3 | **+3.0** | ✅ Strong Lift |
| Assumption Clarity | 3/3 | **+2.3** | ✅ Clear Lift |
| Hallucination Risk | 0/3 (stable) | 0 | ✅ No Degradation |
| Actionability | 3/3 | **+2.3** | ✅ Clear Lift |

### Overall Reasoning Lift Verdict

**Result**: **POSITIVE**

**Interpretation**: T1 reasoning substrate produces consistent lift across all three cases in the Investment Domain. The lift is most pronounced in Causal Explicitness (+3.0 avg), indicating T1's primary value is in structuring cause-effect reasoning.

---

## Cross-Domain Verdict

### Comparison with Amazon Domain

| Metric | Amazon Domain | Investment Domain | Consistent? |
|--------|---------------|-------------------|-------------|
| Cases with Lift | 3/3 | 3/3 | ✅ YES |
| Avg Causal Explicitness Delta | +2.7 | +3.0 | ✅ YES |
| Avg Assumption Clarity Delta | +2.0 | +2.3 | ✅ YES |
| Hallucination Control | Stable | Stable | ✅ YES |
| Avg Actionability Delta | +2.3 | +2.3 | ✅ YES |

### Transferability Result

**Result**: **TRANSFERABLE**

**Interpretation**:
The T1 reasoning substrate produces comparable Reasoning Lift in the Investment Domain as observed in the Amazon Domain. The lift pattern is consistent:
1. Strongest improvement in Causal Explicitness (mechanism-based reasoning)
2. Clear improvement in Assumption Clarity (boundary conditions surfaced)
3. No degradation in Hallucination Risk (T1 constrains rather than fabricates)
4. Consistent improvement in Actionability (decision frameworks emerge)

The consistency across two structurally different domains (e-commerce optimization vs. financial risk assessment) provides evidence that the lift is attributable to the reasoning substrate itself, not domain-specific knowledge.

### Conclusion Statement

> **"This validates T1 as a domain-agnostic reasoning substrate."**

---

## T1 Mechanism Contribution Analysis

| T1 Candidate | Case 01 | Case 02 | Case 03 | Primary Value |
|--------------|---------|---------|---------|---------------|
| T1_expectation_saturation | ✅ High | - | - | Event risk asymmetry |
| T1_correlation_regime_shift | - | ✅ High | ✅ Medium | Stress behavior |
| T1_liquidity_illusion | - | ✅ High | ✅ High | Timing constraint |
| T1_reflexivity_loop | - | ✅ Medium | - | Feedback dynamics |
| T1_asymmetric_information_decay | ✅ Medium | - | - | Reaction speed |
| T1_risk_on_off_regime | - | - | ✅ High | Regime framework |

---

## Ablation Priority (for Phase 2)

Based on contribution analysis, priority order for single-T1 ablation:

1. **T1_liquidity_illusion** - Appeared in 2/3 cases with high impact
2. **T1_correlation_regime_shift** - Core mechanism for stress behavior
3. **T1_risk_on_off_regime** - Foundational framework for Case 03
4. **T1_expectation_saturation** - Critical for Case 01

---

*Evaluation completed: 2025-12-31*
*Evaluator: Blind evaluation (conditions not visible during scoring)*
*Verdict: TRANSFERABLE*
