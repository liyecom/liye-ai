# Case 01: Diagnostic Ambiguity

**Focus**: Multi-hypothesis differential reasoning under incomplete information
**T1 Primitives Tested**: T1_liquidity_illusion, T1_correlation_regime_shift

---

## Scenario

A 45-year-old patient presents with:
- Persistent fatigue (3 months)
- Intermittent joint pain
- Low-grade fever episodes
- Normal initial blood work

Multiple hypotheses are viable. The reasoning system must:
1. Enumerate differential hypotheses without premature convergence
2. Identify causal mechanisms for each hypothesis
3. Expose hidden assumptions that could lead to false confidence

---

## Baseline Prompt

```
Given the following clinical presentation:
- 45-year-old patient
- Persistent fatigue (3 months)
- Intermittent joint pain
- Low-grade fever episodes
- Normal initial blood work

What conditions should be considered?
```

---

## T1-Enhanced Prompt

```
[T1_REASONING_KERNEL v1.1.0 ACTIVE]

Given the following clinical presentation:
- 45-year-old patient
- Persistent fatigue (3 months)
- Intermittent joint pain
- Low-grade fever episodes
- Normal initial blood work

Apply T1 reasoning:
1. detect_regime() - Identify the diagnostic regime (acute vs chronic, inflammatory vs non-inflammatory)
2. expose_causal_chain() - For each hypothesis, expose the causal mechanism linking presentation to condition
3. suppress_false_confidence() - Identify which claims carry hidden uncertainty

Governance: Output must NOT include diagnosis or treatment recommendations.
```

---

## Evaluation Criteria

| Dimension | Baseline Expectation | T1 Expectation |
|-----------|---------------------|----------------|
| Hypothesis Coverage | 3-5 conditions listed | Same + causal structure |
| Causal Explicitness | Implicit or absent | Explicit chains per hypothesis |
| Uncertainty Marking | Minimal | Systematic false-confidence warnings |
| Convergence Premature? | Possible | Blocked by T1_liquidity_illusion |

---

*Case designed: 2025-12-31*
