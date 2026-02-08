# ADR-0011: Memory Governance Enforcement Proof

- decision_id: ADR-0011
- domain: memory
- status: accepted
- tags: [memory, governance, enforcement, ssot, proof]

**Title**: Proof of Step 5B Memory Boundary Enforcement Mechanism
**Decision Date**: 2026-02-08
**Last Updated**: 2026-02-08
**Author**: LiYe OS Memory Governance Initiative

---

## 1. CONTEXT — Why Proof is Required

ADR-0010 established memory governance as a frozen tier requirement, stating:
- Only `save_observation_with_validation()` in `src/runtime/memory/observation-gateway.ts` can access claude-mem
- Direct claude-mem API calls outside the gateway constitute boundary violations

However, ADR-0010 was a governance decision **without operational proof**. This ADR documents that Step 5B enforcement validates the boundary is enforceable.

## 2. DECISION — Implementation + Proof Strategy

### A. CI-level Enforcement (Check 4.5)

Implement `check_no_direct_claude_mem_calls()` in `scripts/ci/memory-governance-gate.sh` to scan for violations:

1. **CLAUDE_MEM_BASE_URL** environment variable access
2. **/observations** endpoint references
3. **claude-mem** string literals (excluding comments)

**Key characteristic**: Auto-discovery of gateway whitelist
- Gateway file auto-discovered: `find src -name "observation-gateway.ts"`
- Validation: exactly 1 file must exist (not 0, not 2+)
- If count ≠ 1, gate fails immediately

### B. GitHub Branch Protection Integration

Configure "Memory Governance Gate (SSOT)" as **required status check**:
- Prevents any code merge if violation is detected
- Fail-closed principle: boundary breach → CI failure (exit 1)

### C. Redteam Proof

Execute boundary violation test to validate enforcement:
- Create test file with direct CLAUDE_MEM_BASE_URL access
- Submit as PR
- Verify: Check 4.5 detects violation
- Verify: PR merge is blocked (required check fails)

## 3. EVIDENCE

### A. Check 4.5 Implementation Details

**File**: `scripts/ci/memory-governance-gate.sh` (lines 204-257)

Detects violations by scanning for:
- `CLAUDE_MEM_BASE_URL` environment variable
- `/observations` endpoint references
- `claude-mem` string literals (excluding comments)

**Auto-discovery mechanism**:
```bash
local gateway_files=$(find "$SCRIPT_DIR/src" -name "observation-gateway.ts")
local file_count=$(echo "$gateway_files" | grep -c . || true)
if [[ $file_count -ne 1 ]]; then
  log_fail "Cannot auto-discover unique gateway file"
  return 1
fi
```

### B. Redteam Test (PR #100)

**Test commit**: 0d63d57
**Test file**: `src/redteam-violation.ts` (intentional boundary violation)
**Violations**: Direct access to CLAUDE_MEM_BASE_URL and /observations endpoint

**Local verification result**:
```
❌ Direct claude-mem API calls detected OUTSIDE gateway (BOUNDARY VIOLATION)
=== CLAUDE_MEM_BASE_URL (exposed) ===
src/redteam-violation.ts:11:const CLAUDE_MEM_BASE_URL = process.env.CLAUDE_MEM_BASE_URL...

=== /observations endpoints ===
src/redteam-violation.ts:15:const response = await fetch(...${CLAUDE_MEM_BASE_URL}/observations...)

❌ GATE FAILED
```

**CI enforcement result**:
- Memory Governance Gate (SSOT) check: **FAILURE** ✅
- PR merge status: **BLOCKED** ✅ (required check enforcement)

### C. Production Validation (main branch)

**Validated commit**: ee9720e
**Command**: `bash scripts/ci/memory-governance-gate.sh`

**Result**:
```
✅ GATE PASSED - All memory governance checks passed
Checks Passed:  1
Checks Failed:  0
```

**Gateway validation**:
- Auto-discovered: `src/runtime/memory/observation-gateway.ts` (exactly 1 file ✅)
- No violations detected ✅

### D. Milestone & Tag

**Tag**: `memory-governance-v1.1`
**Commit**: `ee9720e` (Step 5B implementation)
**Meaning**: Enforcement is production-ready

## 4. CONSEQUENCES

### Positive Impacts

1. **SSOT is enforceable**: Governance decision backed by automated CI enforcement
2. **No silent bypass**: Any violation → immediate CI failure, no manual review gaps
3. **Reproducible proof**: Redteam test demonstrates enforcement works
4. **AGE baseline**: Other projects can verify liye_os SSOT compliance

### Trust & Assurance

- Governance confidence increased: Decision supported by operational proof
- Downstream audit capability: Any project can re-run redteam test
- Zero-trust model: Automation enforces boundary, not just documentation

## 5. IMPLEMENTATION STATUS

✅ Check 4.5 implemented in `scripts/ci/memory-governance-gate.sh`
✅ CI integration via memory-gate job in `.github/workflows/ci.yml`
✅ Required Check configured in GitHub branch protection
✅ Redteam test passed (PR #100 blocked)
✅ Step 5B merged as stable (commit ee9720e)

## 6. REFERENCES

- **Gate implementation**: `scripts/ci/memory-governance-gate.sh` (Check 4.5, lines 204-257)
- **CI workflow**: `.github/workflows/ci.yml` (memory-gate job)
- **Redteam test**: PR #100 (closed after proof validation)
- **Step 5B merge**: PR #99 (merged)
- **Production tag**: memory-governance-v1.1 @ ee9720e
- **Earlier decision**: ADR-0010 (Memory Governance Freeze v1)

## 7. VERIFICATION STEPS

Deployers can independently verify enforcement:

```bash
# Step 1: Check gate exists with Check 4.5
grep "check_no_direct_claude_mem_calls" scripts/ci/memory-governance-gate.sh

# Step 2: Main branch validation
git checkout main
bash scripts/ci/memory-governance-gate.sh
# Expected: ✅ GATE PASSED

# Step 3: Violation detection test
echo 'const x = process.env.CLAUDE_MEM_BASE_URL;' > src/test-violation.ts
bash scripts/ci/memory-governance-gate.sh
# Expected: ❌ GATE FAILED with BOUNDARY VIOLATION
```

---

**Accepted**: 2026-02-08
**Effective since**: Memory governance v1.1 (commit ee9720e)
**Review cycle**: After major boundary-related changes
