# ADR-0010A: Memory Governance Enforcement Proof

**Status**: ACCEPTED
**Date**: 2026-02-08
**Supersedes**: ADR-0010 (Memory Governance Freeze v1)

## Context

ADR-0010 established memory governance as frozen tier in liye_os SSOT, with requirement that:
- Only `save_observation_with_validation()` in `src/runtime/memory/observation-gateway.ts` can access claude-mem
- Direct claude-mem API calls outside gateway constitute boundary violations

However, ADR-0010 lacked operational proof that this boundary is enforceable. This ADR documents the proof mechanism.

## Decision

Implement Step 5B memory boundary enforcement through:

1. **CI-level enforcement**: Check 4.5 in `scripts/ci/memory-governance-gate.sh` scans for:
   - `CLAUDE_MEM_BASE_URL` environment variable access
   - `/observations` endpoint references
   - `claude-mem` string literals (excluding comments)

2. **Required Check integration**: Configure "Memory Governance Gate (SSOT)" as required status check in GitHub branch protection

3. **Redteam proof**: Validate that boundary enforcement correctly rejects violations

## Evidence

### Check 4.5 Implementation
- File: `scripts/ci/memory-governance-gate.sh` (lines 204-257)
- Auto-discovery whitelist: `src/runtime/memory/observation-gateway.ts`
- Fail-closed principle: Any violation → exit code 1

### Redteam Test (PR #100)
- Commit: `0d63d57` - Intentional boundary violation
- Detection result: ✅ BOUNDARY VIOLATION correctly identified
- Patterns detected:
  - CLAUDE_MEM_BASE_URL exposed (3 occurrences)
  - /observations endpoint (1 occurrence)
- CI gate result: ❌ GATE FAILED (exit 1)
- Merge status: BLOCKED (required check failed)

### Production Validation (main branch, commit ee9720e)
- After PR #99 merge: ✅ GATE PASSED
- Gateway file count validation: exactly 1 (`src/runtime/memory/observation-gateway.ts`)
- No violations detected

### Tag & Milestone
- Tag: `memory-governance-v1.1` (commit ee9720e)
- Marking Step 5B boundary enforcement as production-ready

## Consequences

### Positive
- **Enforcement guarantee**: Boundary violations are automatically caught by CI
- **SSOT assurance**: liye_os governance rules are enforceable
- **AGE compliance baseline**: AGE can now only access memory through liye_os gateway

### Risk Mitigation
- **No silent bypass**: Any attempt to escape gateway → CI failure
- **Operational proof**: Enforcement is testable and reproducible
- **Downstream trust**: AGE maintainers can verify compliance independently

## Compliance Impact

This enforcement proof enables:
1. Configuration of Required Check in GitHub branch protection
2. Merging PR #99 (Step 5B) as stable tier
3. Documentation of memory governance as immutable boundary
4. AGE compliance audit (identify & remediate direct access patterns)

## References

- **Redteam test PR**: https://github.com/liyecom/liye-ai/pull/100 (closed)
- **Step 5B merge PR**: https://github.com/liyecom/liye-ai/pull/99
- **Gate script**: `scripts/ci/memory-governance-gate.sh` (Check 4.5)
- **Earlier ADR**: ADR-0010 (Memory Governance Freeze v1)

## Review Notes

This ADR is documentation of an already-implemented enforcement mechanism. Step 5B functionality is already merged (PR #99) and validated. This ADR amendment ensures governance decision is accompanied by proof of enforcement.
