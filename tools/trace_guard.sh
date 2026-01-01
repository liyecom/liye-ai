#!/usr/bin/env bash
# =============================================================================
# trace_guard.sh - Trace Governance Gate
# =============================================================================
# Purpose: CI 检查脚本，验证 TRACE 格式和护栏合规
# Usage:   ./scripts/trace_guard.sh
# Exit:    0 = PASS, 1 = FAIL
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ERRORS=$((ERRORS + 1))
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_info() {
    echo -e "[INFO] $1"
}

# -----------------------------------------------------------------------------
# Check 1: Required files exist
# -----------------------------------------------------------------------------
log_info "=== Check 1: Required Files ==="

REQUIRED_FILES=(
    "templates/trace/TRACE_TEMPLATE_v4_2.yaml"
    "config/amazon-growth/guardrails.yaml"
    "config/amazon-growth/priority_score.yaml"
    "config/amazon-growth/bucket_lifecycle.yaml"
    "config/amazon-growth/trace_type_profiles.yaml"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        log_pass "$file exists"
    else
        log_fail "$file missing"
    fi
done

# -----------------------------------------------------------------------------
# Check 2: Agent files exist
# -----------------------------------------------------------------------------
log_info ""
log_info "=== Check 2: P0 Agent Files ==="

AGENT_FILES=(
    "Agents/amazon-growth/intent-analyst.yaml"
    "Agents/amazon-growth/trace-scribe.yaml"
    "Agents/amazon-growth/guardrail-governor.yaml"
)

for file in "${AGENT_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        log_pass "$file exists"
    else
        log_fail "$file missing"
    fi
done

# -----------------------------------------------------------------------------
# Check 3: Validate TRACE files in repo (if any)
# -----------------------------------------------------------------------------
log_info ""
log_info "=== Check 3: Validate TRACE Files ==="

# Find trace files (both .yaml and .yml)
TRACE_FILES=$(find . -path "./traces/*" -name "TRACE-*.yaml" -o -path "./traces/*" -name "TRACE-*.yml" 2>/dev/null || true)

if [[ -z "$TRACE_FILES" ]]; then
    log_info "No TRACE files found in repo (OK for initial setup)"
else
    TRACE_COUNT=$(echo "$TRACE_FILES" | wc -l)
    log_info "Found $TRACE_COUNT TRACE file(s)"

    while IFS= read -r f; do
        if [[ -z "$f" ]]; then
            continue
        fi

        log_info "  Checking: $f"

        # Check 3.1: Top-level trace: key
        if grep -qE '^\s*trace:\s*$' "$f"; then
            log_pass "    Has top-level 'trace:' key"
        else
            log_fail "    Missing top-level 'trace:' key"
        fi

        # Check 3.2: Has id field with TRACE- prefix
        if grep -qE '^\s+id:\s*["'\'']?TRACE-' "$f"; then
            log_pass "    Has valid 'id: TRACE-*'"
        else
            log_fail "    Missing or invalid 'id: TRACE-*'"
        fi

        # Check 3.3: Has trace_type field
        if grep -qE '^\s+trace_type:\s*["'\'']?(decision|observation|hypothesis|verification)' "$f"; then
            log_pass "    Has valid 'trace_type'"
        else
            log_fail "    Missing or invalid 'trace_type'"
        fi

        # Check 3.4: Has execution block
        if grep -qE '^\s+execution:\s*$' "$f"; then
            log_pass "    Has 'execution:' block"
        else
            log_warn "    Missing 'execution:' block (may be OK for observation/hypothesis type)"
        fi

        # Check 3.5: Has guardrail_check if execution exists
        if grep -qE '^\s+execution:\s*$' "$f"; then
            if grep -qE '^\s+guardrail_check:\s*["'\'']?(PASS|BLOCK|ESCALATE)' "$f"; then
                log_pass "    Has valid 'guardrail_check'"
            else
                log_fail "    Missing 'guardrail_check: PASS|BLOCK|ESCALATE'"
            fi
        fi

        # Check 3.6: Has evidence block (Enhancement 3)
        if grep -qE '^\s+evidence:\s*$' "$f"; then
            log_pass "    Has 'evidence:' block"
            # Check for sha256 in evidence
            if grep -qE '^\s+sha256:\s*' "$f"; then
                log_pass "    Has 'sha256' in evidence (auditable)"
            else
                log_warn "    Missing 'sha256' in evidence (recommended for auditability)"
            fi
        else
            log_warn "    Missing 'evidence:' block (recommended)"
        fi

        # Check 3.7: Has tenant block (Enhancement 4)
        if grep -qE '^\s+tenant:\s*$' "$f"; then
            log_pass "    Has 'tenant:' block (multi-tenant ready)"
        else
            log_warn "    Missing 'tenant:' block (recommended for multi-store)"
        fi

    done <<< "$TRACE_FILES"
fi

# -----------------------------------------------------------------------------
# Check 4: Guardrails config validation
# -----------------------------------------------------------------------------
log_info ""
log_info "=== Check 4: Guardrails Config ==="

GUARDRAILS_FILE="config/amazon-growth/guardrails.yaml"
if [[ -f "$GUARDRAILS_FILE" ]]; then
    # Check for required guardrail sections
    for section in "write_guardrail" "amplitude_guardrails" "batch_guardrails" "freeze_guardrails" "hypothesis_guardrails"; do
        if grep -qE "^\s*${section}:" "$GUARDRAILS_FILE"; then
            log_pass "Has '$section' section"
        else
            log_fail "Missing '$section' section"
        fi
    done
fi

# -----------------------------------------------------------------------------
# Check 5: Scripts exist and are executable
# -----------------------------------------------------------------------------
log_info ""
log_info "=== Check 5: Scripts ==="

if [[ -f "scripts/derive_all.sh" ]]; then
    log_pass "derive_all.sh exists"
    if [[ -x "scripts/derive_all.sh" ]]; then
        log_pass "derive_all.sh is executable"
    else
        log_warn "derive_all.sh is not executable (run: chmod +x scripts/derive_all.sh)"
    fi
else
    log_warn "derive_all.sh not found (optional but recommended)"
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
log_info ""
log_info "=== Summary ==="

if [[ $ERRORS -eq 0 ]]; then
    log_pass "All checks passed!"
    exit 0
else
    log_fail "Found $ERRORS error(s)"
    exit 1
fi
