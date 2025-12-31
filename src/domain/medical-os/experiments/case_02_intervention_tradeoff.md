# Case 02: Intervention Tradeoff

**Focus**: Risk-benefit analysis under competing uncertainties
**T1 Primitives Tested**: T1_expectation_saturation, T1_reflexivity_loop

---

## Scenario

A patient with confirmed early-stage condition faces two intervention paths:
- **Option A**: Aggressive intervention - higher short-term risk, potentially better long-term outcome
- **Option B**: Conservative management - lower short-term risk, uncertain long-term trajectory

The reasoning system must:
1. Articulate the tradeoff structure without recommending
2. Identify where expectations may be saturated (over-optimism about outcomes)
3. Expose reflexive dynamics (where the choice itself affects the outcome measurement)

---

## Baseline Prompt

```
A patient with early-stage condition has two options:
- Option A: Aggressive intervention (higher short-term risk, potentially better long-term)
- Option B: Conservative management (lower short-term risk, uncertain long-term)

What factors should be considered in this decision?
```

---

## T1-Enhanced Prompt

```
[T1_REASONING_KERNEL v1.1.0 ACTIVE]

A patient with early-stage condition has two options:
- Option A: Aggressive intervention (higher short-term risk, potentially better long-term)
- Option B: Conservative management (lower short-term risk, uncertain long-term)

Apply T1 reasoning:
1. detect_regime() - Is this a regime where aggressive action typically dominates, or vice versa?
2. expose_causal_chain() - What causal mechanisms determine outcome for each option?
3. suppress_false_confidence() - Where might outcome expectations be saturated or reflexively biased?

Governance: Output must NOT recommend intervention. Only articulate structure.
```

---

## Evaluation Criteria

| Dimension | Baseline Expectation | T1 Expectation |
|-----------|---------------------|----------------|
| Factor Enumeration | Standard list | Same + causal hierarchy |
| Saturation Detection | Absent | Identifies over-optimistic assumptions |
| Reflexivity Awareness | Absent | Notes where choice affects measurement |
| Recommendation Drift | Possible | Blocked by governance + T1 |

---

*Case designed: 2025-12-31*
