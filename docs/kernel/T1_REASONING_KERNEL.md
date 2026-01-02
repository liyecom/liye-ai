# T1: A Transferable Causal Reasoning Kernel

**Status**: Canonical
**Version**: 1.0.0
**Date**: 2025-12-31

---

## Executive Summary

T1 is a **cross-domain causal reasoning substrate** that has been validated to produce consistent Reasoning Lift across structurally different domains.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   T1 is not a feature. T1 is the reasoning skeleton         │
│   of LiYe OS.                                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## What Is T1?

T1 (Tier-1 Reasoning Primitives) are **canonical causal mechanisms** that structure how agents reason about problems. Unlike domain-specific knowledge, T1 mechanisms are:

1. **Transferable** - Work across different domains
2. **Causal** - Describe cause-effect relationships
3. **Bounded** - Include explicit boundary conditions
4. **Falsifiable** - Can be empirically tested

---

## Validation Evidence

### Cross-Domain Experiment

| Domain | Cases | Lift Confirmed | Hallucination Control |
|--------|-------|----------------|----------------------|
| Amazon Growth OS | 3 | 3/3 (100%) | ✅ Stable |
| Investment Reasoning OS | 3 | 3/3 (100%) | ✅ Stable |

### Dimension-wise Improvement

| Dimension | Avg Delta | Significance |
|-----------|-----------|--------------|
| Causal Explicitness | **+3.0** | Strongest lift |
| Assumption Clarity | +2.3 | Clear improvement |
| Hallucination Risk | 0 | No degradation |
| Actionability | +2.3 | Decision frameworks emerge |

### Verdict

**TRANSFERABLE** - Frozen as of 2025-12-31

---

## T1 Classification

### Always-On (Default Loaded)

| T1 | Mechanism | Rationale |
|----|-----------|-----------|
| T1_liquidity_illusion | Liquidity disappears when needed most | 2/3 cases high contribution |
| T1_correlation_regime_shift | Correlations → 1.0 under stress | Core stress behavior mechanism |

### Contextual (Trigger-Activated)

| T1 | Trigger | Rationale |
|----|---------|-----------|
| T1_risk_on_off_regime | Regime ambiguity detected | Foundational for regime cases |
| T1_expectation_saturation | High implied probability event | Event-driven risk assessment |
| T1_reflexivity_loop | Leverage or feedback detected | Applicable in feedback scenarios |

### Deferred (Pending Ablation)

| T1 | Blocker | Path Forward |
|----|---------|--------------|
| T1_asymmetric_information_decay | Ablation pending | Phase 2 validation required |

---

## How T1 Works

### Before T1 (Baseline Reasoning)

```
Input: "Assess risk of this earnings event"
Output: "The situation presents several risks:
         1. Valuation risk
         2. Volatility risk
         3. Execution risk
         Conclusion: Risk is moderately elevated."
```

**Problem**: Lists risks without mechanism. No causal chain. Vague conclusion.

### After T1 (T1-Enabled Reasoning)

```
Input: "Assess risk of this earnings event"
Output: "Core Mechanism: Expectation Saturation

         Causal Chain:
         1. 85% implied probability → Market pre-positioned
         2. Pre-positioning → No marginal buyers remain
         3. Beat as expected → No information surprise
         4. No surprise → Selling pressure despite 'good' news

         Boundary: Breaks down if beat significantly exceeds expectations

         Falsifiable: If beat < 5%, expect flat-to-negative in 48h"
```

**Improvement**: Explicit mechanism, causal chain, boundary conditions, falsifiable prediction.

---

## Governance

### Immutable Rules

1. **T1 Cannot Be Disabled** - Production domains must load T1
2. **Verdict Cannot Be Rolled Back** - TRANSFERABLE is frozen
3. **Always-On Cannot Be Demoted** - Without new 3+ domain evidence

### CI Enforcement

- `t1-kernel-non-regression` gate blocks violations
- PR review required for `src/kernel/t1/**` changes
- Architecture Team approval for classification changes

---

## For Domain Developers

### How to Use T1 in Your Domain

1. T1 is automatically loaded (always-on candidates)
2. Contextual T1 activates based on case signals
3. Never quote T1 verbatim - let it inform reasoning structure
4. T1 constrains, it doesn't fabricate

### How to Add New T1 Candidates

1. Create candidate in `src/domain/{domain}/t1_candidates/`
2. Include: mechanism_type, causal_chain, boundary_condition, falsifiability
3. Validate via controlled experiment (baseline vs T1-enabled)
4. Promote to kernel via Architecture Team review

---

## Philosophical Foundation

```
T1 is to reasoning what the skeleton is to the body.

It doesn't tell you WHAT to think.
It tells you HOW to structure your thinking.

Without T1: Reasoning is a bag of observations.
With T1: Reasoning is a causal machine.
```

---

## References

- Verdict Evidence: `src/domain/investment-os/experiments/reasoning_comparison/CROSS_DOMAIN_VERDICT.md`
- Kernel Registry: `src/kernel/t1/REGISTRY.yaml`
- Verdict Freeze: `src/kernel/t1/VERDICT_FREEZE.md`
- Ablation Plan: `docs/kernel/T1_ABLATION_PLAN.md` (pending)

---

*Document Status: CANONICAL*
*Audience: Public*
*Last Updated: 2025-12-31*
