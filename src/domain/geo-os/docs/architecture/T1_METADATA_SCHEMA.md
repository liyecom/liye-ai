# T1 Knowledge Unit Metadata Schema

## Purpose

This schema defines mandatory lifecycle metadata for all T1 (Curated Knowledge) units.

T1 knowledge is useful but not eternal.
All T1 units must decay, be reviewed, or be demoted.

---

## Required Metadata Fields

Each T1 unit MUST include the following metadata:

```yaml
tier: T1

confidence_level: one_of [high, medium, low]

source_provenance:
  source_name: string
  original_location: string
  author_or_origin: optional string

promotion:
  promoted_from: T2
  promoted_by: human_id
  promoted_at: ISO8601 timestamp

review:
  last_reviewed_at: ISO8601 timestamp
  review_status: one_of [valid, needs_review, deprecated]
  reviewer: human_id

decay:
  decay_policy: one_of [time_based, usage_based]
  decay_after_days: integer  # recommended: 90 / 180 / 365
  decay_action: one_of [demote_to_T2, require_review]
```

---

## Confidence Semantics

| Level  | Meaning                              |
|--------|--------------------------------------|
| high   | Repeatedly validated, stable pattern |
| medium | Context-dependent, useful heuristic  |
| low    | Experimental, fragile insight        |

---

## Review Rules

- All T1 units MUST be reviewed periodically
- Unreviewed units past decay window MUST NOT be used in reasoning
- Deprecated units MUST be demoted to T2

---

## Governance Principle

T1 knowledge is trusted conditionally and temporarily.

**Truth decays unless deliberately renewed.**
