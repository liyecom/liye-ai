# T1 Reasoning Substrate Controlled Experiment

> **Status**: ACTIVE
> **Purpose**: Validate T1 as reasoning substrate (not answer source)
> **Success Criteria**: Positive Reasoning Lift across evaluation dimensions

---

## Experiment Design

### Hypothesis

> If T1 units function as effective reasoning substrate,
> then Agent outputs WITH T1 context should demonstrate measurably better
> causal explicitness, assumption clarity, and actionability
> compared to outputs WITHOUT T1 context.

### Control Variables

| Variable | Setting |
|----------|---------|
| LLM Model | Claude Opus 4.5 |
| Agent Prompt | Identical across conditions |
| Output Format | Structured markdown |
| Query Complexity | Business strategy questions |

### Independent Variable

| Condition | T1 Loading |
|-----------|------------|
| **Group A (Baseline)** | No T1 units loaded |
| **Group B (T1-Enabled)** | 10-15 relevant T1 units as reasoning context |

### Dependent Variables

Measured using `docs/architecture/REASONING_LIFT_CRITERIA.md`:

1. Causal Explicitness (High/Medium/Low)
2. Assumption Clarity (High/Medium/Low)
3. Hallucination Risk (Low = Good)
4. Actionability (High/Medium/Low)

---

## Experiment Cases

### Case Selection Criteria

- Real business problems from Amazon FBA / Growth Strategy domain
- Questions that benefit from mechanism-level reasoning
- Not factual lookups (where T1 would just be a database)

### Cases

| Case | Business Question | Domain |
|------|-------------------|--------|
| 01 | PPC ACoS 优化策略：ACoS 从 45% 降到 25% 的路径 | Amazon PPC |
| 02 | 新品上架前30天的 Listing 优化优先级 | Amazon Listing |
| 03 | BSR 下滑诊断：从 Top 100 跌至 500+ 的根因分析 | Amazon Growth |

---

## Execution Protocol

### Step 1: Baseline Run (Group A)

```
Query → Agent (no T1 context) → Output → Save to case_XX_baseline.md
```

### Step 2: T1-Enabled Run (Group B)

```
Query → Load relevant T1 units → Agent (with T1 context) → Output → Save to case_XX_t1_enabled.md
```

### Step 3: Blind Evaluation

- Evaluator does NOT know which output is baseline vs T1-enabled
- Score each output using REASONING_LIFT_CRITERIA
- Record in evaluation template

### Step 4: Lift Calculation

```
Lift = Score(T1-Enabled) - Score(Baseline)
```

---

## Critical Constraints

### T1 Usage Rules (Constitutional)

| Rule | Description |
|------|-------------|
| **No Direct Quoting** | T1 content must NOT appear verbatim in output |
| **No T1 ID Exposure** | T1 unit IDs must NOT appear in output |
| **Reasoning Only** | T1 is input to reasoning, not output to user |

### Validity Requirements

| Requirement | Rationale |
|-------------|-----------|
| Same prompt | Isolate T1 as only variable |
| Same model | Control for model differences |
| Real questions | Ensure practical relevance |
| Blind evaluation | Reduce confirmation bias |

---

## File Structure

```
experiments/reasoning_comparison/
├── README.md                    # This file
├── case_01_baseline.md          # PPC ACoS - No T1
├── case_01_t1_enabled.md        # PPC ACoS - With T1
├── case_02_baseline.md          # Listing Optimization - No T1
├── case_02_t1_enabled.md        # Listing Optimization - With T1
├── case_03_baseline.md          # BSR Diagnosis - No T1
├── case_03_t1_enabled.md        # BSR Diagnosis - With T1
└── evaluation_summary.md        # Final lift assessment
```

---

## Expected Outcomes

### If T1 Works (Positive Lift)

- T1-enabled outputs show explicit causal chains
- Assumptions are surfaced and bounded
- Recommendations include specific thresholds
- Reasoning is traceable

### If T1 Fails (Neutral/Negative Lift)

- No measurable difference between groups
- Or: T1-enabled outputs show more hallucination
- Indicates T1 units need quality improvement

---

## References

- `docs/architecture/REASONING_LIFT_CRITERIA.md` - Evaluation framework
- `docs/architecture/T1_CANONICAL_DEFINITION.md` - T1 definition
- `docs/architecture/T1_CONSUMPTION_RULES.md` - Usage constraints
- `refinement/README.md` - T1 production pipeline

---

**Version**: 1.0.0
**Created**: 2025-12-30
