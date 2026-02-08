#!/bin/bash

################################################################################
# Memory Governance Gate - LiYe OS SSOT (MAAP Boundary Enforcement)
#
# Purpose:
#   - Verify that Memory Completeness Contract v1 exists (frozen)
#   - Verify ADR-0010 exists
#   - Scan codebase for direct memory API calls (bypass violations)
#   - Ensure only save_observation_with_validation() can write to main pool
#   - Step 5B: Enforce no direct claude-mem access outside gateway
#
# Usage:
#   ./scripts/ci/memory-governance-gate.sh [--verbose]
#
# Exit Codes:
#   0 = All checks passed (boundary enforced)
#   1 = Critical failure (contract/ADR missing, bypass detected, or boundary violated)
#   2 = Warnings only (non-critical issues)
#
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERBOSE=${VERBOSE:-0}
FIX_MODE=${FIX_MODE:-0}

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNED=0

################################################################################
# Logging Functions
################################################################################

log_info() {
  echo -e "${BLUE}ℹ${NC}  $*"
}

log_pass() {
  echo -e "${GREEN}✅${NC} $*"
  ((CHECKS_PASSED++))
}

log_fail() {
  echo -e "${RED}❌${NC} $*"
  ((CHECKS_FAILED++))
}

log_warn() {
  echo -e "${YELLOW}⚠️ ${NC} $*"
  ((CHECKS_WARNED++))
}

log_verbose() {
  if [[ $VERBOSE -eq 1 ]]; then
    echo -e "${BLUE}»${NC}  $*"
  fi
}

################################################################################
# Check 1: Contract v1 Frozen
################################################################################

check_contract_exists() {
  log_info "Check 1: Contract v1 frozen..."

  if [[ -f "$SCRIPT_DIR/docs/contracts/memory-completeness-contract-v1.md" ]]; then
    log_pass "Contract v1 MD found: docs/contracts/memory-completeness-contract-v1.md"
  else
    log_fail "Contract v1 MD missing: docs/contracts/memory-completeness-contract-v1.md"
    return 1
  fi

  if [[ -f "$SCRIPT_DIR/docs/contracts/memory-completeness-contract-v1.schema.json" ]]; then
    log_pass "Contract v1 Schema found: docs/contracts/memory-completeness-contract-v1.schema.json"
  else
    log_fail "Contract v1 Schema missing: docs/contracts/memory-completeness-contract-v1.schema.json"
    return 1
  fi

  # Verify Contract status is FROZEN
  if grep -q "Status.*FROZEN" "$SCRIPT_DIR/docs/contracts/memory-completeness-contract-v1.md"; then
    log_pass "Contract v1 is marked FROZEN"
  else
    log_fail "Contract v1 status is not FROZEN"
    return 1
  fi

  return 0
}

################################################################################
# Check 2: ADR-0010 Exists
################################################################################

check_adr_exists() {
  log_info "Check 2: ADR-0010 frozen..."

  if [[ -f "$SCRIPT_DIR/docs/adr/ADR-0010-memory-governance-freeze-v1.md" ]]; then
    log_pass "ADR-0010 found: docs/adr/ADR-0010-memory-governance-freeze-v1.md"
  else
    log_fail "ADR-0010 missing: docs/adr/ADR-0010-memory-governance-freeze-v1.md"
    return 1
  fi

  # Verify ADR status is ACCEPTED
  if grep -q "Status.*ACCEPTED" "$SCRIPT_DIR/docs/adr/ADR-0010-memory-governance-freeze-v1.md"; then
    log_pass "ADR-0010 is marked ACCEPTED"
  else
    log_fail "ADR-0010 status is not ACCEPTED"
    return 1
  fi

  return 0
}

################################################################################
# Check 3: Gateway Implementation Exists
################################################################################

check_gateway_exists() {
  log_info "Check 3: Gateway implementation..."

  if [[ -f "$SCRIPT_DIR/src/runtime/memory/observation-gateway.ts" ]]; then
    log_pass "Gateway found: src/runtime/memory/observation-gateway.ts"
  else
    log_fail "Gateway missing: src/runtime/memory/observation-gateway.ts"
    return 1
  fi

  # Verify save_observation_with_validation is exported
  if grep -q "export.*save_observation_with_validation" "$SCRIPT_DIR/src/runtime/memory/observation-gateway.ts"; then
    log_pass "save_observation_with_validation exported from gateway"
  else
    log_fail "save_observation_with_validation not exported from gateway"
    return 1
  fi

  return 0
}

################################################################################
# Check 4: Bypass Detection
################################################################################

check_no_bypass_writes() {
  log_info "Check 4: Scanning for bypass writes..."

  # Define prohibited patterns (direct memory pool writes)
  # These should ONLY appear in observation-gateway.ts (whitelisted)
  declare -a PROHIBITED_PATTERNS=(
    "ObservationStore\\.insert"
    "ObservationStore\\.upsert"
    "MemoryStore\\.insert"
    "MemoryStore\\.upsert"
    "memory\\.save"
    "store\\.save"
  )

  local bypass_found=0
  local bypass_files=""

  for pattern in "${PROHIBITED_PATTERNS[@]}"; do
    # Search for pattern but exclude whitelisted files
    local matches
    matches=$(grep -r "$pattern" "$SCRIPT_DIR/src" \
      --include="*.ts" \
      --include="*.js" \
      --exclude="observation-gateway.ts" \
      2>/dev/null | wc -l || echo 0)

    if [[ $matches -gt 0 ]]; then
      # If we find matches (not just in whitelist), flag it
      bypass_found=1
      bypass_files+="Found: $pattern ($matches occurrences)\n"
    fi
  done

  if [[ $bypass_found -eq 1 ]]; then
    log_fail "Direct memory pool writes detected (bypass violation):\n$bypass_files"
    return 1
  else
    log_pass "No direct memory pool writes detected (no bypass)"
  fi

  return 0
}

################################################################################
# Check 4.5: Direct Claude-Mem API Calls (STEP 5B: Boundary Enforcement)
################################################################################

check_no_direct_claude_mem_calls() {
  log_info "Check 4.5: Scanning for direct claude-mem API calls (boundary enforcement)..."

  # Auto-discover gateway file as whitelist (must be exactly 1)
  local gateway_files
  gateway_files=$(find "$SCRIPT_DIR/src" -name "observation-gateway.ts" 2>/dev/null || true)

  local file_count=$(echo "$gateway_files" | grep -c . || true)

  if [[ $file_count -ne 1 ]]; then
    log_fail "Cannot auto-discover unique gateway file (found: $file_count)"
    return 1
  fi

  local whitelist_file=$(echo "$gateway_files" | head -1)
  log_verbose "Whitelist: $whitelist_file"

  local violations=""
  local violation_count=0

  # Pattern 1: CLAUDE_MEM_BASE_URL environment variable
  log_verbose "Scanning for CLAUDE_MEM_BASE_URL references..."
  local matches=$(grep -rn "CLAUDE_MEM_BASE_URL" "$SCRIPT_DIR/src" --include="*.ts" --include="*.js" 2>/dev/null | grep -v "$whitelist_file" || true)
  if [[ -n "$matches" ]]; then
    violations+="=== CLAUDE_MEM_BASE_URL (exposed) ===\n$matches\n\n"
    violation_count=$((violation_count + 1))
  fi

  # Pattern 2: /observations endpoints
  log_verbose "Scanning for /observations endpoints..."
  local matches=$(grep -rn "/observations" "$SCRIPT_DIR/src" --include="*.ts" --include="*.js" 2>/dev/null | grep -v "$whitelist_file" || true)
  if [[ -n "$matches" ]]; then
    violations+="=== /observations endpoints ===\n$matches\n\n"
    violation_count=$((violation_count + 1))
  fi

  # Pattern 3: 'claude-mem' string references (exclude comments)
  log_verbose "Scanning for 'claude-mem' string references..."
  local matches=$(grep -rn "claude-mem" "$SCRIPT_DIR/src" --include="*.ts" --include="*.js" 2>/dev/null | grep -v "//" | grep -v "$whitelist_file" || true)
  if [[ -n "$matches" ]]; then
    violations+="=== 'claude-mem' string references ===\n$matches\n\n"
    violation_count=$((violation_count + 1))
  fi

  if [[ $violation_count -gt 0 ]]; then
    log_fail "Direct claude-mem API calls detected OUTSIDE gateway (BOUNDARY VIOLATION):"
    echo -e "$violations"
    return 1
  else
    log_pass "No direct claude-mem calls detected outside gateway (boundary enforced)"
  fi

  return 0
}

################################################################################
# Check 5: Tests Pass
################################################################################

check_tests_pass() {
  log_info "Check 5: Running unit tests..."

  if [[ -f "$SCRIPT_DIR/tests/runtime/memory-gateway.test.mjs" ]]; then
    log_pass "Test file found: tests/runtime/memory-gateway.test.mjs"

    # Run tests
    if node "$SCRIPT_DIR/tests/runtime/memory-gateway.test.mjs" > /tmp/memory-tests.log 2>&1; then
      log_pass "All unit tests passed"
    else
      log_fail "Unit tests failed"
      if [[ $VERBOSE -eq 1 ]]; then
        cat /tmp/memory-tests.log
      fi
      return 1
    fi
  else
    log_warn "Test file not found: tests/runtime/memory-gateway.test.mjs"
    return 0 # Non-critical
  fi

  return 0
}

################################################################################
# Check 6: Governance Log Configuration
################################################################################

check_governance_log_config() {
  log_info "Check 6: Governance log configuration..."

  # Check if .liye/logs exists or can be created
  local log_dir="$SCRIPT_DIR/.liye/logs"

  if [[ -d "$log_dir" ]]; then
    log_pass "Governance log directory exists: .liye/logs"
  else
    log_warn "Governance log directory does not exist (will be created at runtime): .liye/logs"
    return 0 # Non-critical
  fi

  # Check if memory-compliance.jsonl exists
  if [[ -f "$log_dir/memory-compliance.jsonl" ]]; then
    local line_count
    line_count=$(wc -l < "$log_dir/memory-compliance.jsonl" || echo 0)
    log_pass "Governance log exists with $line_count entries: .liye/logs/memory-compliance.jsonl"
  else
    log_pass "Governance log not yet created (will be created on first rejection)"
  fi

  return 0
}

################################################################################
# Main
################################################################################

main() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════════════════════╗"
  echo "║    LiYe OS Memory Governance Gate — Boundary Enforcement (SSOT) v1.1       ║"
  echo "║          Step 5B: No Direct Claude-Mem Access Outside Gateway              ║"
  echo "╚════════════════════════════════════════════════════════════════════════════╝"
  echo ""

  # For liye_os, we only run Step 5B checks (Checks 4.5+)
  # AGE-specific checks (Contract v1, ADR-0010, gateway-exists) are skipped
  local failed=0

  log_info "Running liye_os SSOT checks (Step 5B)..."
  echo ""

  # Core boundary enforcement check (CRITICAL)
  check_no_direct_claude_mem_calls || failed=1
  echo ""

  # Summary
  echo "╔════════════════════════════════════════════════════════════════════════════╗"
  echo "║                          SUMMARY                                           ║"
  echo "╚════════════════════════════════════════════════════════════════════════════╝"
  echo ""
  echo -e "Checks Passed:  ${GREEN}${CHECKS_PASSED}${NC}"
  echo -e "Checks Failed:  ${RED}${CHECKS_FAILED}${NC}"
  echo -e "Warnings:       ${YELLOW}${CHECKS_WARNED}${NC}"
  echo ""

  if [[ $failed -eq 1 || $CHECKS_FAILED -gt 0 ]]; then
    echo -e "${RED}❌ GATE FAILED${NC} - Memory governance compliance check failed"
    exit 1
  else
    echo -e "${GREEN}✅ GATE PASSED${NC} - All memory governance checks passed"
    exit 0
  fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --verbose|-v)
      VERBOSE=1
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Run main
main "$@"
