# Conductor Integration Proposal

> **Status**: IMPLEMENTED (P0-P4)
> **Version**: 1.0
> **Created**: 2026-01-02
> **Author**: Claude + LiYe

---

## Executive Summary

This document describes the integration of Conductor's "Context-Driven Development" concepts into LiYe OS's Memory as a Product (MaaP) framework. The key innovation is **Domain-Scoped Track** - an execution container that binds work units to specific domains and enforces glossary usage.

---

## Design Philosophy

### First Principles

```
┌────────────────────────────────────────────────────────────┐
│                Context Engineering Principles               │
├────────────────────────────────────────────────────────────┤
│  1. AI models are stateless → Need external context        │
│  2. Project context is multi-dimensional → Need structure  │
│  3. Context drifts → Need versioning and validation        │
│  4. Tokens are limited → Need intelligent filtering        │
└────────────────────────────────────────────────────────────┘
```

### Track vs Memory

| Concept | Role | Scope |
|---------|------|-------|
| **Track** | Execution Container | Work unit boundary |
| **Memory** | Semantic Truth | Term definitions |

**Key Coupling Point**: Domain-Scoped Track

```
Track ──────── binds to ─────────▶ Domain
  │                                   │
  │ references                        │
  ▼                                   ▼
glossary_version ─────────────▶ glossary/*.yaml
```

---

## Implementation Status

### P0: Track Basic Structure ✅

| Item | Status | Location |
|------|--------|----------|
| tracks/ directory | ✅ | `tracks/README.md` |
| TRACK_SCHEMA.md | ✅ | `docs/architecture/TRACK_SCHEMA.md` |
| First real Track | ✅ | `tracks/amz_optimize_ppc_20260101/` |

### P1: Domain × Track Binding ✅

| Item | Status | Location |
|------|--------|----------|
| memory_bootstrap.mjs extension | ✅ | `.claude/scripts/memory_bootstrap.mjs` |
| memory_state.json | ✅ | `.claude/.compiled/memory_state.json` |
| Track-aware domain detection | ✅ | `confidence: 1.0, reason: track_bound(...)` |

### P2: Workflow Verification ✅

| Item | Status | Location |
|------|--------|----------|
| workflow.yaml | ✅ | `tracks/amz_optimize_ppc_20260101/workflow.yaml` |
| verify_glossary_usage.sh | ✅ | `tools/audit/verify_glossary_usage.sh` |

### P3: Phase Checkpoint ✅

| Item | Status | Location |
|------|--------|----------|
| checkpoint.yaml | ✅ | `tracks/amz_optimize_ppc_20260101/checkpoint.yaml` |
| Frozen files list | ✅ | `spec.md` + `glossary` |

### P4: CI Integration ✅

| Item | Status | Location |
|------|--------|----------|
| Path filter for tracks/ | ✅ | `.github/workflows/audit-regression-gate.yml` |
| Track verification step | ✅ | Warning mode (non-blocking) |

---

## Track Structure

```
tracks/
└── amz_optimize_ppc_20260101/
    ├── spec.md          # Requirements (glossary terms only)
    ├── plan.md          # Execution steps
    ├── state.yaml       # Track state + domain binding
    ├── workflow.yaml    # Verification rules
    └── checkpoint.yaml  # Phase freeze record
```

### state.yaml Example

```yaml
track_id: amz_optimize_ppc_20260101
domain: amazon-advertising
status: draft
current_step: null
glossary_version: v1.0
glossary_path: knowledge/glossary/amazon-advertising.yaml
```

---

## Memory Bootstrap Integration

When `memory_state.json` contains an active track:

```json
{
  "active_track": "amz_optimize_ppc_20260101",
  "domain": "amazon-advertising",
  "glossary_version": "v1.0"
}
```

The bootstrap output becomes:

```json
{
  "ok": true,
  "domain": "amazon-advertising",
  "confidence": 1.0,
  "reason": "track_bound(amz_optimize_ppc_20260101)",
  "track": {
    "track_id": "amz_optimize_ppc_20260101",
    "domain": "amazon-advertising",
    "glossary_version": "v1.0"
  }
}
```

---

## Verification Script

```bash
# Verify glossary usage in a track
bash tools/audit/verify_glossary_usage.sh tracks/amz_optimize_ppc_20260101

# Output:
# ✓ PASS - All terms are defined in glossary
# or
# ✗ FAIL - N unknown term(s) found
```

---

## CI Behavior

| Scenario | Behavior |
|----------|----------|
| PR touches `tracks/**` | Run verify_glossary_usage.sh |
| Verification fails | **Warning** (non-blocking) |
| D1/D2/D3 fails | **Block** merge |

Future upgrade path:
- P5: Upgrade Track verification to blocking mode
- P6: Add checkpoint validation

---

## Invariants

| # | Rule | Enforcement |
|---|------|-------------|
| I1 | One Track = One Domain | state.yaml schema |
| I2 | spec.md uses glossary terms only | verify_glossary_usage.sh |
| I3 | plan.md cannot introduce new terms | verify_glossary_usage.sh |
| I4 | Frozen files are immutable | checkpoint.yaml + CI |

---

## What's NOT Changed

Per design constraints, the following remain untouched:

- ❌ Memory scoring algorithm
- ❌ Domain detection logic (except Track bypass)
- ❌ Output Contract format
- ❌ Drift Detector
- ❌ memory_diff.mjs

---

## Future Roadmap

| Phase | Task | Blocking |
|-------|------|----------|
| P5 | Upgrade Track CI to blocking | Yes |
| P6 | Checkpoint validation in CI | Yes |
| P7 | Multi-Track session support | No |
| P8 | Track archival automation | No |

---

## References

- Conductor Project: https://github.com/gemini-cli-extensions/conductor
- Track Schema: `docs/architecture/TRACK_SCHEMA.md`
- Audit Regression Gate: `docs/architecture/AUDIT_REGRESSION.md`
- Domain Conflict Policy: `docs/architecture/DOMAIN_CONFLICT_POLICY.md`

---

**Implementation Date**: 2026-01-02
**Verified By**: Claude + LiYe
