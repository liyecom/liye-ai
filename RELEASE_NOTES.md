# LiYe OS v6.3.0 Release Notes

> **Canonical LiYe OS Release** | 2026-01-02
> **Previous Version**: v6.1.2

---

## What is LiYe OS?

LiYe OS is a **Governance & Architecture Reference Implementation** for AI-collaborative development. It turns AI outputs into auditable, replayable, and controllable engineering systems.

**Core Philosophy**: "Making blind confidence structurally impossible."

**Key Mechanisms**:
- **World Model Gate**: Forces risk analysis before execution (T1/T2/T3 cognitive pipeline)
- **Architecture Contract**: Defines Frozen/Stable/Experimental boundaries
- **Replay & Audit**: Every decision is traceable and reproducible

---

## Highlights in v6.3.0

### Repository Normalization

This release marks the first canonical LiYe OS version with a fully normalized repository:

- **Removed root-level symlinks**: 8 symlinks (adapters, governance, reports, etc.) that caused GitHub display issues
- **Archived legacy Chinese docs**: `架构设计.md` → `_meta/archive/`
- **Deleted backup files**: Removed `README.md.bak_*` artifacts
- **Unified version numbers**: All manifests now reflect v6.3.0

### Stability Contract (NEW)

Introduced formal stability contract (`docs/architecture/ARCHITECTURE_CONTRACT.md`):

| Level | Meaning | Examples |
|-------|---------|----------|
| **Frozen** | Immutable, constitutional | `_meta/governance/`, `*gate*` workflows |
| **Stable** | Backward compatible | `docs/architecture/`, `src/kernel/` interfaces |
| **Experimental** | May change | `Agents/`, `Crews/`, domain implementations |

### Adopter Registration (NEW)

Created `ADOPTERS.md` for tracking downstream dependencies:
- Public and private registration options
- Breaking change notification commitment
- Impact radius assessment for governance changes

### Documentation Restructure

- **README** rewritten as positioning statement with 3 adoption paths
- **Chinese README** (`README.zh-CN.md`) with bilingual navigation
- **Public Whitepaper v1** published (`docs/whitepaper/`)
- **Core Stable Spec** published (`docs/architecture/LIYE_OS_CORE_STABLE_SPEC.md`)

---

## Phase 5 Completions (v6.2.0 → v6.3.0)

### Amazon Growth OS
- Phase 5.1: Decision Inventory
- Phase 5.2: Decision Schema & Contracts
- Phase 5.3: Agent Pipeline
- Phase 5.4: Replay & Regression Gate

### GEO OS (SEO Domain)
- Phase 5.1-5.4: Full domain capability implementation
- Domain Capability Playbook v1 for replication

### Governance Infrastructure
- CODEOWNERS for governance protection
- i18n-gate for language authority enforcement
- Governance file change gate
- Architecture gate refinements

---

## Breaking Changes

### Symlink Removal

If you depend on these root-level paths, update to the real paths:

| Old (Removed) | New (Real Path) |
|---------------|-----------------|
| `adapters/` | `src/adapters/` |
| `governance/` | `_meta/governance/` |
| `reports/` | `Artifacts_Vault/reports/` |
| `schemas/` | `_meta/schemas/` |
| `scripts/` | `tools/` |
| `stats/` | `data/stats/` |
| `templates/` | `_meta/templates/` |
| `traces/` | `data/traces/` |

### Version Alignment

All version references are now v6.3.0. Previous tags (v3.1.0, v6.1.2) remain for historical reference.

---

## Migration Guide

### For Existing Users

1. Update any hardcoded symlink paths to real paths
2. Review `ARCHITECTURE_CONTRACT.md` for stability guarantees
3. Register in `ADOPTERS.md` to receive breaking change notifications

### For New Adopters

Choose your adoption path:
1. **Blueprint**: Copy directory structure and governance patterns
2. **Governance Stack**: Integrate CI gates and contracts into your project
3. **Minimal Runtime**: Run the full LiYe OS with Claude Code

See `README.md` for detailed instructions.

---

## Version History

| Version | Date | Focus |
|---------|------|-------|
| **6.3.0** | 2026-01-02 | Canonical release, repository normalization, stability contract |
| 6.2.0 | 2026-01-01 | Phase 5.4 Replay & Regression Gate |
| 6.1.2 | 2025-12-31 | Bug fixes and CI improvements |
| 6.0.0 | 2025-12-31 | Claude Code native, removed legacy CLI |
| 3.1.0 | 2025-12-27 | First public release (legacy) |

---

## Contributors

- **LiYe** ([@liyecom](https://github.com/liyecom))
- **Claude** ([@claude](https://github.com/claude))

---

## License

[Apache License 2.0](LICENSE)

---

*LiYe OS - Making blind confidence structurally impossible.*
