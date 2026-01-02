# LiYe OS Core (STABLE)

LiYe OS Core is the **stable kernel** that makes AI work **trackable, auditable, and governable**.

It enforces four non-negotiable principles:

- **Track is an execution container, not a knowledge base.**
- **Memory is semantic truth, not a process engine.**
- **Experience is visibility, not authority.**
- **Checkpoint freeze enforces responsibility, not correctness.**

---

## Architecture Overview

```mermaid
flowchart TB
  %% =========================
  %% LiYe OS Core (STABLE) — Architecture Overview
  %% =========================

  subgraph T["Truth Layer (Semantic Truth Engine)"]
    DM["Domain Routing<br/>domain-mapping.yaml + scoring"]
    GL["Glossary SSOT<br/>knowledge/glossary/*.yaml"]
    AB["Ambiguity Policy<br/>D2/D3"]
    MB["Memory Brief Assembly<br/>memory_brief.md"]
    DM --> MB
    GL --> MB
    AB --> MB
  end

  subgraph E["Execution Layer (Domain-Scoped Track)"]
    TR["Track<br/>tracks/&lt;track_id&gt;/"]
    SPEC["spec.md<br/>(Decision Contract)"]
    PLAN["plan.md<br/>(Editable Plan)"]
    WF["workflow.yaml<br/>(Verifications)"]
    ST["state.yaml<br/>(Domain Binding)"]
    TR --> SPEC
    TR --> PLAN
    TR --> WF
    TR --> ST
  end

  subgraph G["Governance Layer (Contract Enforcement)"]
    CP["checkpoint.yaml<br/>(Freeze List)"]
    UF["unfreeze/*.yaml<br/>(Add-only Override)"]
    CI["CI Gate<br/>verify_checkpoint_freeze.sh"]
    CP --> CI
    UF --> CI
  end

  subgraph X["Experience & Reuse (Non-Authoritative)"]
    EXP["experience.yaml<br/>(Lessons + human confidence)"]
    IDX["experience_index/*.yaml<br/>(Metadata only)"]
    HINT["newTrack Hint<br/>(Visibility only)"]
    TPL["Templates<br/>generate_template_from_experience.js"]
    IDX --> HINT
    EXP --> TPL
  end

  %% Core Couplings (Allowed)
  MB --> TR

  %% Governance Freeze Scope (Hard Contract)
  SPEC -. "frozen by checkpoint" .-> CP
  GL -. "frozen by checkpoint" .-> CP

  %% Explicit Non-Authority (No direct injection)
  EXP -. "no auto-inject" .-> MB
  IDX -. "no routing/scoring" .-> DM
```

---

## Quick Start (New Track)

1. Create a new Track:
   - `liye track new "<task>"`

2. If an experience hint appears, optionally review:
   - `tracks/<track_id>/experience.yaml`

3. Fill in `spec.md` and `plan.md`, then run execution + verification per your workflow.
   - Freeze `spec.md` + glossary via `checkpoint.yaml` when the decision is ready to become a contract.

---

## Key Documents

| Document | Purpose |
|----------|---------|
| [LIYE_OS_CORE_STABLE_SPEC.md](./architecture/LIYE_OS_CORE_STABLE_SPEC.md) | Full specification (v1.0) |
| [CORE_STATUS.md](./architecture/CORE_STATUS.md) | Stability indicator |
| [CORE_CHANGE_POLICY.md](./governance/CORE_CHANGE_POLICY.md) | High-risk change rules |

---

## Operating Principle

> **Core is stable. Growth happens through new tracks, not kernel rewrites.**
