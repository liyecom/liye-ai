# T1 Canonical Definition

> **Constitutional Document** | Version 1.0 | 2025-12-30
>
> This document defines the immutable identity of T1 (Canonical Truth Units).
> Any modification requires Constitutional Amendment Protocol.

---

## Article 1: Identity Statement

**T1 = Canonical Truth Units**

T1 is the tier of verified, minimal, actionable truth units that serve as the foundation for reasoning, decision-making, and cross-validation within LiYe OS.

**T1 is reasoning fuel, not a knowledge base.**

---

## Article 2: Inclusion Criteria (MUST satisfy ALL)

A knowledge unit MAY enter T1 if and only if it satisfies ALL of the following:

### 2.1 Agent-Callable
- The unit can be directly invoked by an Agent or Analyst
- The unit provides actionable input for automated workflows
- Example: "Amazon SP广告在ACoS超过35%时，应降低bid 10-15%"

### 2.2 Causal-Reasoning Capable
- The unit expresses or supports a cause-effect relationship
- The unit can participate in "if X then Y" reasoning chains
- Example: "Listing主图CTR低于2%通常导致转化率下降"

### 2.3 Cross-Source Verifiable
- The unit's truth claim can be validated against at least one other source
- The unit is not single-source opinion or speculation
- Example: A strategy mentioned in both Helium10 and Jungle Scout documentation

### 2.4 Minimal Unit
- The unit is atomic - cannot be meaningfully split further
- The unit expresses exactly one truth claim
- No bundled concepts or compound statements

---

## Article 3: Exclusion Criteria (MUST NOT contain ANY)

A knowledge unit is FORBIDDEN from T1 if it contains ANY of the following:

### 3.1 Topic-Organized Summaries
- Collections of related information without causal structure
- "Overview" or "Introduction" type content
- Example: "Amazon广告类型概述" ❌

### 3.2 Tutorial-Style Content
- Step-by-step instructions without underlying mechanism
- "How-to" guides focused on process not principle
- Example: "如何创建Amazon广告活动（5步教程）" ❌

### 3.3 Content Rephrasing/Paraphrase
- Rewording of existing T1 units without new truth value
- Stylistic variations of known truths
- Example: Same strategy described in different words ❌

### 3.4 Opinion Without Mechanism
- Personal preferences without causal backing
- "I think X is better" without explaining why
- Example: "我认为SP广告比SD广告更好" ❌

### 3.5 Time-Sensitive Facts
- Information that expires (unless tagged with validity window)
- Current prices, dates, temporary policies
- Example: "2024年Prime Day从7月16日开始" ❌

---

## Article 4: The TRUTH_DELTA Requirement

Every candidate T1 unit MUST answer the question:

> "这条内容新增了什么此前 T1 中不存在的机制/因果关系？"

- If the answer is empty → REJECT
- If the answer is vague → REJECT
- If the answer is boilerplate → REJECT
- Only specific, novel mechanism/causality → ACCEPT

This is enforced by **TRUTH_DELTA_GATE** in the T2→T1 pipeline.

---

## Article 5: T1 is NOT

| T1 is NOT | Reason |
|-----------|--------|
| A note repository | Notes are unstructured, T1 is minimal units |
| A content database | Databases store data, T1 stores verified truths |
| A summary collection | Summaries condense, T1 extracts mechanisms |
| A tutorial library | Tutorials instruct, T1 enables reasoning |
| A bookmark folder | Bookmarks reference, T1 is the truth itself |

---

## Article 6: Pipeline Enforcement

The T2 → T1 Refinement Pipeline MUST:

1. Reference this document as a hard constraint
2. Reject any unit not satisfying Article 2
3. Reject any unit containing Article 3 patterns
4. Require non-empty TRUTH_DELTA field
5. Log all rejections with specific violation reason

```yaml
# Pipeline constraint reference
refinement:
  constitutional_reference: docs/architecture/T1_CANONICAL_DEFINITION.md
  gates:
    - TRUTH_DELTA_GATE
  rejection_policy: strict
  fallback: disabled
  auto_fill: disabled
```

---

## Article 7: Amendment Protocol

This document may only be modified through:

1. Explicit user approval in conversation
2. Documentation of rationale
3. Version increment
4. Timestamp update

Automated systems CANNOT modify this document.

---

## Signature

```
Document: T1_CANONICAL_DEFINITION.md
Status: FROZEN
Created: 2025-12-30
Author: LiYe AI Constitutional Authority
Hash: SHA256(content) for integrity verification
```

---

**Remember: We are building a Truth Factory, not a Content System.**
