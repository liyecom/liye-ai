# Experience Schema (v0.1)

> **Purpose**: Structured post-execution reflection for Tracks
> **Status**: Active
> **Created**: 2026-01-02
> **Governed By**: TRACK_ARCHITECTURE_VERDICTS.md (V2: Read-Only Binding)

---

## Overview

`experience.yaml` is an **optional** file in each Track directory that captures structured lessons learned after execution. It enables:

- **Structured Review**: What happened and why
- **Selective Reuse**: T2/T1-low level experience material
- **Human Confidence**: Explicit human validation of insights

---

## Critical Constraints

| Rule | Rationale |
|------|-----------|
| ❌ Does NOT auto-enter glossary | Preserves SSOT integrity |
| ❌ Does NOT affect scoring | Memory scoring remains pure |
| ❌ Does NOT modify Memory | Respects V2: Read-Only Binding |
| ✅ Optional per Track | Not all Tracks need reflection |
| ✅ Human-written or human-validated | Prevents garbage accumulation |

---

## Schema Definition

```yaml
# experience.yaml (v0.1)

# === Required Fields ===
track_id: string        # Must match parent Track
domain: string          # Domain bound during execution
glossary_version: string # Glossary version used

# === Outcome ===
outcome:
  verdict: enum         # POSITIVE | NEGATIVE | NEUTRAL | INCONCLUSIVE
  metrics_impacted:     # List of glossary term IDs affected
    - string
  summary: string       # One-line outcome description (optional)

# === Lessons Learned ===
lessons:                # List of actionable insights
  - string

# === Confidence ===
confidence:
  human: enum           # high | medium | low
  ai_suggested: boolean # Was this AI-generated then human-reviewed?

# === Metadata (Optional) ===
created_at: datetime    # ISO 8601
reviewed_by: string     # Human reviewer
tags: list              # Free-form tags for retrieval
```

---

## Field Definitions

### outcome.verdict

| Value | Meaning |
|-------|---------|
| `POSITIVE` | Track achieved its goals |
| `NEGATIVE` | Track failed to achieve goals |
| `NEUTRAL` | Mixed results, no clear win/loss |
| `INCONCLUSIVE` | Insufficient data to judge |

### outcome.metrics_impacted

List of glossary concept IDs (not aliases) that were affected:

```yaml
metrics_impacted:
  - AMZ_ACOS    # Correct: concept_id
  - AMZ_ROAS    # Correct: concept_id
  # - acos      # Wrong: use concept_id, not alias
```

### lessons

Actionable insights in imperative form:

```yaml
lessons:
  - "调整 bid 前必须先拆分 campaign"      # Good: actionable
  - "ROAS 在低流量阶段不稳定"              # Good: observation
  # - "这次做得不错"                       # Bad: not actionable
```

### confidence.human

| Value | Meaning |
|-------|---------|
| `high` | Human strongly agrees with lessons |
| `medium` | Human partially agrees, some caveats |
| `low` | Human uncertain, needs more validation |

---

## Example

```yaml
# tracks/amz_optimize_ppc_20260101/experience.yaml

track_id: amz_optimize_ppc_20260101
domain: amazon-advertising
glossary_version: v1.0

outcome:
  verdict: POSITIVE
  metrics_impacted:
    - AMZ_ACOS
    - AMZ_ROAS
  summary: "ACoS 降低 12%，ROAS 提升至 4.2x"

lessons:
  - "调整 bid 前必须先拆分 campaign"
  - "ROAS 在低流量阶段不稳定，需等待 7 天数据"
  - "高 ACoS 关键词暂停前应检查其 organic 贡献"

confidence:
  human: high
  ai_suggested: true

created_at: "2026-01-02T15:00:00+08:00"
reviewed_by: "LiYe"
tags:
  - ppc-optimization
  - bid-strategy
```

---

## Usage Tiers

Experience files serve as **T2/T1-low level material**:

| Tier | Usage | Example |
|------|-------|---------|
| T1-high | Glossary SSOT | Metric definitions |
| T1-low | Experience candidates | Proven, high-confidence lessons |
| T2 | Working memory | All experience files |
| T3 | Archived | Old/invalidated experiences |

### Promotion Path

```
experience.yaml (T2)
       │
       ▼ (human review + high confidence + repeated pattern)
       │
Candidate for Playbook/ADR (T1-low)
       │
       ▼ (formal governance)
       │
Glossary or ADR (T1-high)
```

---

## Retrieval Pattern

When starting a new Track in the same domain:

```javascript
// Pseudocode for experience retrieval
const experiences = glob("tracks/*/experience.yaml")
  .filter(e => e.domain === currentDomain)
  .filter(e => e.confidence.human >= "medium")
  .sort((a, b) => b.created_at - a.created_at)
  .slice(0, 5);

// Inject as context (optional, human-triggered)
```

---

## Anti-Patterns

| Don't | Why |
|-------|-----|
| Auto-generate without review | Garbage accumulation |
| Copy lessons to glossary | Violates V2 binding |
| Use for scoring adjustments | Pollutes Memory purity |
| Skip `confidence.human` | No accountability |

---

## See Also

- `docs/architecture/TRACK_SCHEMA.md` - Track structure
- `docs/architecture/TRACK_ARCHITECTURE_VERDICTS.md` - Governing principles
- `knowledge/glossary/` - SSOT (T1-high)

---

**Version**: 0.1
**Author**: Claude + LiYe
