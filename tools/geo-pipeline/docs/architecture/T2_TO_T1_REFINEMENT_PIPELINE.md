# T2 → T1 Refinement Pipeline Specification

## 0. Purpose

This document defines the mandatory refinement pipeline for promoting
raw exploratory sources (T2) into curated knowledge sources (T1).

The goal is to prevent unverified experience from polluting system cognition.

---

## 1. Pipeline Overview

T2 sources MUST pass all stages below before being promoted to T1.

Stages:
1. Structural Eligibility Check
2. Content Quality Filtering
3. Redundancy & Noise Control
4. Semantic Alignment with T0
5. Human-in-the-loop Approval

Failure at ANY stage blocks promotion.

---

## 2. Stage 1 — Structural Eligibility Check

### Requirements

A candidate unit MUST satisfy ALL of the following:

- Text-based (no binary-only artifacts)
- Minimum content length: ≥ 300 characters
- Maximum content length: ≤ 2,000 characters
- Contains at least ONE of:
  - Explicit method
  - Explicit reasoning
  - Explicit causal claim

### Rejection Criteria

- Pure chat logs
- One-liners / slogans
- Tool screenshots without explanation
- Marketing copy

Result:
- PASS → Stage 2
- FAIL → Remains in T2

---

## 3. Stage 2 — Content Quality Filtering

### Scoring Dimensions (0–5 each)

| Dimension | Description |
|---------|-------------|
| Specificity | Concrete steps, parameters, examples |
| Reproducibility | Can the idea be tested or repeated |
| Signal Density | Ratio of insight to filler text |
| Coherence | Logical consistency |

### Thresholds

- Minimum average score: **≥ 3.5 / 5**
- Any single dimension < 3 → FAIL

Result:
- PASS → Stage 3
- FAIL → Remains in T2

---

## 4. Stage 3 — Redundancy & Noise Control

### Rules

- Similarity check against existing T1 units
- If semantic similarity ≥ 0.85 → duplicate

### Thresholds

- Duplicate ratio ≤ 20% per batch
- If exceeded → batch rejected

Purpose:
- Prevent experience spam from inflating confidence

Result:
- PASS → Stage 4
- FAIL → Remains in T2

---

## 5. Stage 4 — Semantic Alignment with T0

### Alignment Check

Each candidate MUST be evaluated against T0 concepts:

- Does NOT contradict T0 definitions
- Does NOT redefine core concepts
- May extend or contextualize T0 ideas

### Thresholds

- Any direct contradiction with T0 → HARD FAIL
- Ambiguity allowed but must be annotated

Result:
- PASS → Stage 5
- FAIL → Remains in T2

---

## 6. Stage 5 — Human-in-the-loop Approval

### Mandatory Human Actions

- Explicit promotion decision
- Assign confidence level:
  - High
  - Medium
  - Low
- Attach provenance metadata

### Rule

No automated promotion to T1 is allowed.

---

## 7. Promotion Outcome

Only units that PASS ALL stages are promoted:

- Tier: T1
- Metadata additions:
  - confidence_level
  - source_provenance
  - promotion_timestamp

All others remain permanently in T2.

---

## 8. Governance Principle

Experience is allowed to exist freely (T2),
but truth must be earned deliberately (T1).
