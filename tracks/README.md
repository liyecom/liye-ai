# Tracks Directory

> **Purpose**: Domain-Scoped Work Units (Execution Containers)
> **Version**: v0.1
> **Created**: 2026-01-02

---

## What is a Track?

A **Track** is a discrete work unit that binds execution to a specific domain and its glossary. Unlike generic task management, Tracks enforce:

1. **Domain Binding**: Each Track belongs to exactly one domain
2. **Glossary Enforcement**: All terms must come from the bound glossary
3. **Phase Freezing**: Completed phases lock spec + glossary versions

---

## Directory Structure

```
tracks/
└── <track_id>/
    ├── spec.md          # Requirements (must use glossary terms)
    ├── plan.md          # Execution steps (no new terms allowed)
    ├── state.yaml       # Current execution state
    ├── workflow.yaml    # Verification rules (optional)
    ├── checkpoint.yaml  # Phase freeze record (generated)
    └── experience.yaml  # Post-execution lessons (optional)
```

---

## Track ID Convention

```
<domain_prefix>_<short_name>_<YYYYMMDD>

Examples:
- amz_optimize_ppc_20260101
- geo_local_ranking_20260115
- med_literature_review_20260120
```

---

## Lifecycle

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  draft  │ ──▶ │ active  │ ──▶ │  done   │ ──▶ │ frozen  │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │
     └── spec.md     └── plan.md     └── checkpoint  └── archived
         created         executing        created         (optional)
```

---

## Key Invariants

| Rule | Enforced By |
|------|-------------|
| One Track = One Domain | state.yaml schema |
| Terms from glossary only | verify_glossary_usage.sh |
| No new terms in plan.md | verify_glossary_usage.sh |
| Frozen phases immutable | checkpoint.yaml + CI |

---

## Relationship to Memory

```
Track ────────────────────────────────────────────────────▶ Domain
  │                                                           │
  │ binds to                                                  │
  ▼                                                           ▼
state.yaml ──────────────────────────────────────────▶ domain-mapping.yaml
  │                                                           │
  │ references                                                │
  ▼                                                           ▼
glossary_version ─────────────────────────────────────▶ glossary/*.yaml
```

**Track is NOT**:
- A knowledge store (that's glossary's job)
- A workflow engine (that's human's job)
- A replacement for Memory (Memory is the semantic truth)

**Track IS**:
- An execution container
- A domain-scoped work boundary
- A verification checkpoint

---

## See Also

- `docs/architecture/TRACK_SCHEMA.md` - Schema definition
- `docs/architecture/CONDUCTOR_INTEGRATION_PROPOSAL.md` - Integration design
- `tools/audit/verify_glossary_usage.sh` - Glossary verification

---

**Version**: 0.1
**Author**: Claude + LiYe
