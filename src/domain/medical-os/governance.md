# Medical Reasoning OS Governance

**Classification**: HIGH-STAKES EXPERIMENTAL
**Effective Date**: 2025-12-31

---

## Absolute Prohibitions

### 1. No Diagnostic Output
```yaml
forbidden:
  - "You have [condition]"
  - "This is likely [disease]"
  - "The diagnosis is..."
  - Any statement that could be interpreted as clinical diagnosis
```

### 2. No Treatment Recommendations
```yaml
forbidden:
  - "You should take [medication]"
  - "The treatment is..."
  - "Consider [intervention]"
  - Any statement that could be interpreted as medical advice
```

### 3. No Probability Assertions Without Qualification
```yaml
forbidden:
  - "There is a 70% chance..."
  - Unqualified statistical claims
  - Confidence intervals without source citation
```

---

## Permitted Operations

### 1. Causal Structure Analysis
```yaml
permitted:
  - "The mechanism linking A to B involves..."
  - "This causal chain has the following structure..."
  - Explicit reasoning trace with uncertainty markers
```

### 2. Differential Enumeration
```yaml
permitted:
  - "Hypotheses to consider include: H1, H2, H3..."
  - "Factors that distinguish H1 from H2 include..."
  - Structured comparison without ranking confidence
```

### 3. Tradeoff Articulation
```yaml
permitted:
  - "Intervention X carries risk Y while potentially providing benefit Z"
  - "The tradeoff structure involves..."
  - Explicit uncertainty acknowledgment
```

---

## Validation Gates

Before any output, T1 must pass:

1. **Prohibition Check** - Does output contain forbidden patterns?
2. **Uncertainty Check** - Are all claims appropriately qualified?
3. **Audit Trail Check** - Is the reasoning chain fully explicit?

---

## Failure Mode

If governance check fails:
```yaml
action: HALT
output: "[GOVERNANCE BLOCK] Output suppressed due to policy violation"
log: traces/medical/governance_violations.log
```

---

*Governance v1.0*
*Owner: Architecture Team*
