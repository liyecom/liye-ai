# Contracts (Machine-Executable Constraints)

> **Version**: 1.0
> **Created**: 2026-01-13
> **Status**: Active

---

## Purpose

This directory contains **machine-readable contracts** that mirror
hard constraints defined in the Architecture Constitution.

Contracts enable:
- Automated validation via CI gates
- Explicit "must-not-break" rules
- Clear boundaries between Skills and Builders

---

## Authority

| Principle | Rule |
|-----------|------|
| **SSOT** | `ARCHITECTURE_CONSTITUTION.md` is the single source of truth |
| **Reference Required** | Contracts MUST reference constitution clauses or amendments |
| **No New Rules** | Contracts may NOT introduce new blocking rules without a constitution source |

---

## Scope

| Location | Type | Description |
|----------|------|-------------|
| `_meta/contracts/` | Global templates | Default values, schema definitions |
| `tracks/<track_id>/` | Project instances | Concrete values per project |

---

## Intended Usage

```
┌─────────────────────────────────────────────────────────────┐
│  SKILL (UI/UX, Content, etc.)                               │
│  - Reads global template for structure                      │
│  - Writes project instance in tracks/<track_id>/            │
│  - CANNOT generate code or components directly              │
└─────────────────────┬───────────────────────────────────────┘
                      │ writes
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  tracks/<track_id>/site-design.contract.yaml                │
│  (Project-specific instance)                                │
└─────────────────────┬───────────────────────────────────────┘
                      │ reads
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  BUILDER (Site generator, Component builder)                │
│  - Consumes track-level instances ONLY                      │
│  - CANNOT modify contracts                                  │
│  - Generates code based on contract values                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Non-Goals

This directory does NOT:
- Contain implementations or code
- Replace the Architecture Constitution
- Store project-specific data (that goes in `tracks/`)

---

## File Naming Convention

```
<domain>.contract.yaml

Examples:
- site-design.contract.yaml
- api-behavior.contract.yaml
- content-style.contract.yaml
```

---

## Enforcement Levels

| Level | Behavior | Use Case |
|-------|----------|----------|
| `advisory` | Log only, no action | Experimental rules |
| `warning` | Emit annotation, continue | Soft constraints |
| `blocking` | Exit non-zero, fail CI | Hard constraints |

---

## Validation

All contracts are validated against:
- `_meta/schemas/contracts.schema.json`

Run validation:
```bash
python _meta/governance/validator.py
```

---

## See Also

- [Architecture Constitution](../docs/ARCHITECTURE_CONSTITUTION.md)
- [Contracts Schema](../schemas/contracts.schema.json)
- [Tracks README](../../tracks/README.md)
