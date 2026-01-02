# LiYe OS Architecture

> **Status**: Canonical
> **Audience**: All contributors, reviewers, maintainers
> **Authority**: Constitutional

---

## Architecture Doctrine

The following documents define the **normative foundation** for all architectural decisions in LiYe OS.

These are not reference materials. They are constitutional constraints.

| Document | Type | Purpose |
|----------|------|---------|
| [Anti-Entropy Architecture](./ANTI_ENTROPY_ARCHITECTURE_OVERVIEW.md) | Normative | Defines what architecture must do |
| [Entropy Architecture](./ENTROPY_ARCHITECTURE_FAILURE_PATTERNS.md) | Failure Patterns | Defines what architecture must prevent |

**All architectural decisions, reviews, and governance are evaluated against this doctrine.**

---

## Doctrine Hierarchy

```
Anti-Entropy Architecture (Philosophy)
         ↓
Architecture Constitution (_meta/docs/ARCHITECTURE_CONSTITUTION.md)
         ↓
Governance Constitution Index (_meta/docs/GOVERNANCE_CONSTITUTION_INDEX.md)
         ↓
CI Workflows (.github/workflows/)
         ↓
Code
```

Changes flow downward. Interpretive authority flows upward.

---

## Core Principles (from Doctrine)

1. **Entropy Is Inevitable** — Architecture assumes drift, shortcuts, and context loss
2. **Humans Are the Primary Entropy Source** — Protect the system from its maintainers
3. **Architecture Is About Irreversibility** — Constrain high-rollback-cost decisions
4. **Future Systems Matter More** — Design for missing context, not present knowledge

---

## Failure Pattern Recognition

When reviewing changes, explicitly check for these patterns:

| Pattern | Question |
|---------|----------|
| Boundary Erosion | Does this change introduce cross-layer dependencies? |
| Silent Scope Expansion | Does this expand responsibility without explicit approval? |
| Historical Debt Normalization | Does this justify a decision with "that's how it's always been"? |
| Assumption Leakage | Does this rely on unstated assumptions? |
| Architecture by Anecdote | Is this justified by analysis or by precedent? |
| Decision Amnesia | Will future maintainers understand why this exists? |

---

## Document Index

### Doctrine (Constitutional)

- [`ANTI_ENTROPY_ARCHITECTURE_OVERVIEW.md`](./ANTI_ENTROPY_ARCHITECTURE_OVERVIEW.md) — Foundational philosophy
- [`ENTROPY_ARCHITECTURE_FAILURE_PATTERNS.md`](./ENTROPY_ARCHITECTURE_FAILURE_PATTERNS.md) — Failure pattern catalog

### Constitution & Governance

- [`_meta/docs/ARCHITECTURE_CONSTITUTION.md`](../../_meta/docs/ARCHITECTURE_CONSTITUTION.md) — Structural rules
- [`_meta/docs/GOVERNANCE_CONSTITUTION_INDEX.md`](../../_meta/docs/GOVERNANCE_CONSTITUTION_INDEX.md) — Enforcement index

### Specifications

- [`WORLD_MODEL_CONSTITUTION.md`](./WORLD_MODEL_CONSTITUTION.md) — T1/T2/T3 World Model
- [`SKILL_CONSTITUTION.md`](./SKILL_CONSTITUTION.md) — Skill structure rules
- [`MCP_CONTRACT.md`](./MCP_CONTRACT.md) — MCP integration contract

### Phase 5 Governance (Active & Authoritative)

- [`PHASE_5_ARCHITECTURE_ACCEPTANCE.md`](./PHASE_5_ARCHITECTURE_ACCEPTANCE.md) — Phase 5 acceptance standard
- [`DOMAIN_CAPABILITY_PLAYBOOK_V1.md`](./DOMAIN_CAPABILITY_PLAYBOOK_V1.md) — Domain capability replication manual (v1.0 frozen)

---

## Reading Order for New Contributors

1. **Start here** — This README
2. **Understand the philosophy** — `ANTI_ENTROPY_ARCHITECTURE_OVERVIEW.md`
3. **Learn what to avoid** — `ENTROPY_ARCHITECTURE_FAILURE_PATTERNS.md`
4. **Study the rules** — `_meta/docs/ARCHITECTURE_CONSTITUTION.md`
5. **Check enforcement** — `_meta/docs/GOVERNANCE_CONSTITUTION_INDEX.md`

---

**Last Updated**: 2026-01-02
**Maintainer**: System Owner
