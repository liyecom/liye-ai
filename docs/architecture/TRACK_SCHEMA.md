# Track Schema (v0.1)

> **Purpose**: Define the minimal required structure for Domain-Scoped Tracks
> **Status**: Active
> **Created**: 2026-01-02

---

## Overview

A Track is an **Execution Container** that binds work to a specific domain and enforces glossary usage. This schema defines the minimal required fields and invariants.

---

## Required Fields

### state.yaml (Required)

```yaml
# Minimal required fields
track_id: string       # Unique identifier (format: <prefix>_<name>_<YYYYMMDD>)
domain: string         # Domain ID from domain-mapping.yaml
status: enum           # draft | active | done | frozen
current_step: string   # Current execution step (nullable)

# Optional but recommended
glossary_version: string  # Version of bound glossary (e.g., "v1.0")
created_at: datetime      # ISO 8601 timestamp
updated_at: datetime      # ISO 8601 timestamp
```

### spec.md (Required)

```markdown
# {Track Title}

Domain: {domain_id}
Glossary Version: {version}

## Goal
{Description using only glossary terms}

## Constraints
{List of constraints}

## Success Criteria
{Measurable outcomes using glossary metrics}
```

### plan.md (Required)

```markdown
# Execution Plan

{Numbered steps, each referencing glossary terms}

1. Step one...
2. Step two...
```

### workflow.yaml (Optional)

```yaml
task_lifecycle:
  - step: {step_name}
    verification:
      - glossary_terms_used: boolean
      - no_unknown_terms: boolean
```

### checkpoint.yaml (Generated)

```yaml
checkpoint_type: phase_completion
track_id: string
frozen:
  - {list of frozen file paths}
verified:
  human_approved: boolean
  tests_passed: boolean
created_at: datetime
```

### experience.yaml (Optional, Post-Execution)

```yaml
track_id: string
domain: string
glossary_version: string

outcome:
  verdict: enum           # POSITIVE | NEGATIVE | NEUTRAL | INCONCLUSIVE
  metrics_impacted: list  # Glossary concept IDs
  summary: string         # One-line description

lessons: list             # Actionable insights

confidence:
  human: enum             # high | medium | low
  ai_suggested: boolean

created_at: datetime
reviewed_by: string
tags: list
```

**Critical**: experience.yaml does NOT modify Memory (V2: Read-Only Binding).
See `docs/architecture/EXPERIENCE_SCHEMA.md` for full specification.

---

## Invariants

These rules MUST be enforced:

| # | Invariant | Enforcement |
|---|-----------|-------------|
| I1 | One Track binds to exactly one Domain | state.yaml schema validation |
| I2 | spec.md MUST use only glossary-defined terms | verify_glossary_usage.sh |
| I3 | plan.md MUST NOT introduce new terms | verify_glossary_usage.sh |
| I4 | Frozen files are immutable | checkpoint.yaml + CI gate |
| I5 | Track ID format must match pattern | Schema validation |

---

## Track ID Format

```
<domain_prefix>_<short_name>_<YYYYMMDD>

domain_prefix: 3-4 letter abbreviation
  - amz  = amazon-advertising
  - geo  = geo
  - med  = medical-research
  - gen  = general

short_name: Snake_case descriptive name (max 30 chars)

YYYYMMDD: Creation date

Examples:
  ✓ amz_optimize_ppc_20260101
  ✓ geo_local_ranking_20260115
  ✗ amazon_ppc  (missing date, wrong prefix)
  ✗ AMZ_TEST_2026  (wrong case, wrong date format)
```

---

## Status Transitions

```
draft ──▶ active ──▶ done ──▶ frozen
  │                    │
  └──── (delete) ◀─────┘ (revert)
```

| From | To | Trigger | Side Effect |
|------|----|---------|-------------|
| draft | active | `/track:start` or manual | state.yaml updated |
| active | done | All steps completed | checkpoint.yaml generated |
| done | frozen | Human approval | Files become immutable |
| any | (deleted) | Manual cleanup | Directory removed |

---

## Domain Binding

A Track MUST reference a valid domain from `domain-mapping.yaml`:

```yaml
# .claude/config/domain-mapping.yaml
domains:
  - id: amazon-advertising  # ← Track can bind to this
    glossary: knowledge/glossary/amazon-advertising.yaml
  - id: geo
    glossary: knowledge/glossary/geo.yaml
```

Binding is established in `state.yaml`:

```yaml
track_id: amz_optimize_ppc_20260101
domain: amazon-advertising  # ← Must match domain.id
glossary_version: v1.0
```

---

## Glossary Term Verification

Terms in `spec.md` and `plan.md` are verified against the bound glossary:

```yaml
# knowledge/glossary/amazon-advertising.yaml
concepts:
  - id: AMZ_ACOS
    term: ACoS
    aliases: [acos]
    version: v1.0
```

Verification process:
1. Extract all capitalized terms and known aliases from spec.md/plan.md
2. Check each against glossary concepts
3. Report unknown terms as violations
4. Exit 1 if any violations found

---

## Example Track

```
tracks/amz_optimize_ppc_20260101/
├── spec.md
├── plan.md
├── state.yaml
├── workflow.yaml (optional)
└── checkpoint.yaml (generated after completion)
```

### state.yaml
```yaml
track_id: amz_optimize_ppc_20260101
domain: amazon-advertising
status: draft
current_step: null
glossary_version: v1.0
created_at: 2026-01-02T10:00:00+08:00
```

### spec.md
```markdown
# PPC Optimization Spec

Domain: amazon-advertising
Glossary Version: v1.0

## Goal
降低 ACoS，同时保持或提升 ROAS。

## Constraints
- 所有指标定义必须来自 glossary
- 不引入自定义指标
```

---

## Governing Verdicts

This schema is governed by frozen architectural verdicts:

| Verdict | Principle | Reference |
|---------|-----------|-----------|
| V1 | Track = Atomic Execution Unit | `TRACK_ARCHITECTURE_VERDICTS.md` |
| V2 | Memory-Track = Read-Only Binding | `TRACK_ARCHITECTURE_VERDICTS.md` |
| V3 | Checkpoint = Organizational Commitment | `TRACK_ARCHITECTURE_VERDICTS.md` |

---

## See Also

- `tracks/README.md` - Directory overview
- `tools/audit/verify_glossary_usage.sh` - Verification script
- `.claude/config/domain-mapping.yaml` - Domain definitions
- `docs/architecture/TRACK_ARCHITECTURE_VERDICTS.md` - Frozen principles

---

**Version**: 0.1
**Governed By**: TRACK_ARCHITECTURE_VERDICTS.md
**Author**: Claude + LiYe
