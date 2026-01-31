# P6-C Human Approval SOP

> **Version**: 1.0
> **Scope**: ADD_NEGATIVE_KEYWORDS on Timo US only
> **Effective**: 2026-01-31

## Purpose

This SOP defines the human approval process for P6-C live writes.
Approval is NOT just clicking a button - it's a structured verification.

## Approval Checklist

Before approving, the reviewer MUST confirm:

### 1. WHY (Reason Validation)
- [ ] Reason summary clearly explains the problem
- [ ] The observation (e.g., SEARCH_TERM_WASTE_HIGH) is valid
- [ ] The proposed action addresses the root cause

### 2. EVIDENCE (Data Validation)
- [ ] Evidence file exists and is recent (< 24h)
- [ ] Evidence hash matches (no tampering)
- [ ] Metrics support the decision (e.g., wasted_spend_ratio > 0.30)

### 3. RISK (Rollback Validation)
- [ ] Rollback path is clear (negative_keyword_remove)
- [ ] Rollback can be executed within 1 hour if needed
- [ ] Impact is bounded (≤5 keywords)

## Approval Decisions

| Decision | When to Use |
|----------|-------------|
| APPROVE | All 3 checklists pass |
| DENY | Any checklist item fails |
| DEFER | Need more information (must explain) |

**IMPORTANT**: Silent ignore is NOT allowed. Every submission MUST get a response.

## Response Template

```
Approval Decision: [APPROVE/DENY/DEFER]

WHY Check:
- [PASS/FAIL] Reason clear: [yes/no because...]
- [PASS/FAIL] Observation valid: [yes/no because...]
- [PASS/FAIL] Action appropriate: [yes/no because...]

EVIDENCE Check:
- [PASS/FAIL] Evidence exists: [file path]
- [PASS/FAIL] Evidence fresh: [timestamp]
- [PASS/FAIL] Metrics support: [values]

RISK Check:
- [PASS/FAIL] Rollback clear: [negative_keyword_remove]
- [PASS/FAIL] Time to rollback: [estimate]
- [PASS/FAIL] Impact bounded: [N keywords]

Comment: [additional notes]
```

## Escalation

If unsure, escalate to @liye with:
1. Trace ID
2. Your concern
3. Recommendation (APPROVE/DENY/DEFER)
