# Investment Domain: Reasoning Comparison Experiments

## Purpose

Validate T1 cross-domain transferability by comparing reasoning quality
with and without T1 canonical reasoning substrate.

## Case Definitions

| Case | Description | Focus |
|------|-------------|-------|
| Case 01 | Event-driven risk assessment | Earnings/macro event impact analysis |
| Case 02 | Portfolio hidden risk exposure diagnosis | Correlation and concentration risk |
| Case 03 | Risk-on vs risk-off regime trade-off | Regime identification and implications |

## Methodology

### Control Variables

- **Agent**: Same Investment Analyst Agent
- **Model**: Identical model version
- **Prompt Structure**: Identical task framing
- **Data**: Same market scenario data

### Independent Variable

- **Baseline**: No T1 reasoning substrate loaded
- **T1-Enabled**: 6 Investment T1 candidates loaded

### Constraint

T1 may inform reasoning structure but must **never be quoted verbatim**.
The agent should internalize the mechanism, not regurgitate it.

## Evaluation Criteria

Uses standardized 4-dimension Reasoning Lift criteria:

1. **Causal Explicitness** - Are cause-effect relationships clearly stated?
2. **Assumption Clarity** - Are underlying assumptions surfaced?
3. **Hallucination Risk** - Does output contain unsupported claims?
4. **Actionability** - Is the reasoning practically applicable?

Reference: `docs/architecture/REASONING_LIFT_CRITERIA.md`

## Verdict Rules

- **Lift Confirmed**: ≥2/4 dimensions improved, Hallucination Risk not increased
- **Lift Rejected**: <2/4 dimensions improved OR Hallucination Risk increased
- **Inconclusive**: Mixed results requiring additional experiments

---

*Experiment Framework Version: 1.0*
*Created: 2025-12-31*
