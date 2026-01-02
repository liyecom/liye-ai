# CI Gates Alignment for Canonical v6.3.0

> **Version**: 1.0
> **Date**: 2026-01-02
> **PR**: #34 (follow-up to #33 repository normalization)

---

## Summary

This document describes CI gate updates made to align with the Canonical v6.3.0 repository structure established in PR #33.

**Key changes:**
- CI gates updated to reflect canonical paths (symlinks retired)
- Legacy path assumptions removed
- Replay and trace checks are now scope-aware

---

## Changes by Gate

### 1. Architecture Hardening Gate

**File**: `.github/workflows/architecture-hardening-gate.yml`
**Script**: `tools/audit/verify_v6_1.py`

**Updates:**
- `EXPECTED_SYMLINK_COUNT` changed from 8 to 0 (symlinks retired)
- `EXPECTED_SYMLINKS` replaced with `RETIRED_SYMLINKS` reference
- Added `CANONICAL_PATHS` documentation mapping
- Check C (Symlink Governance) now verifies retirement completion
- Check E (Symlink Retirement) confirms all symlinks have been retired
- Workflow step "Verify symlinks are documented" replaced with "Verify canonical structure"

**Rationale:**
PR #33 removed root-level symlinks. The contract must follow facts, not history.

---

### 2. Domain Replay Gate

**File**: `.github/workflows/domain-replay-gate.yml`

**Updates:**
- Added path-based filtering using GitHub Actions `paths:` directive
- Gate only triggers on:
  - `src/**` - Domain runtime code
  - `schemas/**` - Schema definitions
  - `replays/**` - Replay test cases
  - `config/amazon-growth/**`, `config/geo-os/**` - Domain configs
  - `Agents/**` - Agent definitions
  - `tools/replay_runner.js`, `tools/geo_os_replay_runner.js`
- Updated replay runner path from `scripts/` to `tools/`
- Added explicit documentation comment

**Rule:**
Replay is not required for structural or governance normalization PRs.

---

### 3. Trace Governance Gate

**File**: `.github/workflows/trace-governance-gate.yml`
**Script**: `tools/trace_guard.sh`

**Updates:**
- Added v6.3.0 header documentation
- Updated script path from `scripts/trace_guard.sh` to `tools/trace_guard.sh`
- Updated trace search path from `./traces/*` to `./data/traces/*`
- Updated template path from `templates/` to `_meta/templates/`
- Added fallback for legacy template path with migration suggestion

**Rule:**
Absence of runtime traces is acceptable for governance and structure PRs.

---

## Canonical Path Reference

| Legacy Path (Retired) | Canonical Path (v6.3.0+) |
|-----------------------|--------------------------|
| `adapters/` | `src/adapters/` |
| `governance/` | `_meta/governance/` |
| `reports/` | `Artifacts_Vault/reports/` |
| `schemas/` | `_meta/schemas/` |
| `scripts/` | `tools/` |
| `stats/` | `data/stats/` |
| `templates/` | `_meta/templates/` |
| `traces/` | `data/traces/` |

---

## Impact

### PRs Affected
- **Docs-only PRs**: No longer blocked by replay gate
- **Governance PRs**: No longer blocked by replay or trace gates
- **Structure normalization PRs**: Pass all gates without modification

### PRs Not Affected
- **Runtime code changes**: Still require replay tests
- **Agent changes**: Still require replay tests
- **Operational config changes**: Still validated by trace gate

---

## Verification

After merging this PR:

1. **PR #33 CI should become green** without modification
2. **Governance-only PRs** should pass all gates
3. **Runtime changes** still trigger appropriate tests

---

## Related Documents

- [ARCHITECTURE_CONTRACT.md](../architecture/ARCHITECTURE_CONTRACT.md) - Stability contract
- [PR #33](https://github.com/liyecom/liye-ai/pull/33) - Repository normalization
- [RELEASE_NOTES.md](../../RELEASE_NOTES.md) - v6.3.0 release notes

---

*This document is part of the LiYe OS governance framework.*
