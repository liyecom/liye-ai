#!/bin/bash
#
# Symlink Retirement Enforcement Self-Test
# =========================================
#
# This script validates the symlink retirement enforcement logic in verify_v6_1.py
# by running test scenarios:
#
# 1. Default version from file (config/version.txt) - Should PASS, source=file
# 2. Env override (v6.3.0) - Should FAIL, source=env
# 3. Version comparison edge case (v6.10.0) - Should FAIL
# 4. Exact retirement version (v6.3.0) - Should FAIL with enforcement message
#
# Usage:
#     bash tools/audit/selftest_symlink_retire.sh
#
# Exit codes:
#     0: All tests passed
#     1: One or more tests failed
#
# Version: v6.1.2
# Date: 2026-01-01

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VERIFY_SCRIPT="$SCRIPT_DIR/verify_v6_1.py"
VERSION_FILE="$REPO_ROOT/config/version.txt"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

echo ""
echo -e "${BOLD}${BLUE}================================================================${NC}"
echo -e "${BOLD}${BLUE}Symlink Retirement Enforcement Self-Test${NC}"
echo -e "${BOLD}${BLUE}================================================================${NC}"
echo ""
echo -e "Repository: $REPO_ROOT"
echo -e "Verify Script: $VERIFY_SCRIPT"
echo -e "Version File: $VERSION_FILE"
echo -e "Version File Content: $(cat "$VERSION_FILE" 2>/dev/null || echo 'NOT FOUND')"
echo -e "Date: $(date)"
echo ""

# Function to run a test
run_test() {
    local test_name="$1"
    local use_env="$2"        # "yes" or "no"
    local env_version="$3"    # version to set in env (if use_env=yes)
    local expected_exit="$4"
    local check_pattern="$5"
    local check_source="$6"   # expected source pattern

    TESTS_RUN=$((TESTS_RUN + 1))

    echo -e "${BOLD}────────────────────────────────────────────────────────────${NC}"
    echo -e "${BOLD}TEST $TESTS_RUN: $test_name${NC}"
    if [ "$use_env" = "yes" ]; then
        echo -e "  Mode: env override (LIYE_OS_VERSION=$env_version)"
    else
        echo -e "  Mode: file (config/version.txt)"
    fi
    echo -e "  Expected exit code: $expected_exit"
    echo ""

    # Run verify script
    set +e
    if [ "$use_env" = "yes" ]; then
        output=$(LIYE_OS_VERSION="$env_version" python3 "$VERIFY_SCRIPT" 2>&1)
    else
        # Ensure no env override
        output=$(unset LIYE_OS_VERSION; python3 "$VERIFY_SCRIPT" 2>&1)
    fi
    actual_exit=$?
    set -e

    local all_checks_passed=true

    # Check exit code
    if [ "$actual_exit" -eq "$expected_exit" ]; then
        echo -e "  Exit code: ${GREEN}$actual_exit (expected $expected_exit) ✓${NC}"
    else
        echo -e "  Exit code: ${RED}$actual_exit (expected $expected_exit) ✗${NC}"
        all_checks_passed=false
    fi

    # Check for expected pattern in output
    if [ -n "$check_pattern" ]; then
        if echo "$output" | grep -q "$check_pattern"; then
            echo -e "  Pattern '$check_pattern': ${GREEN}Found ✓${NC}"
        else
            echo -e "  Pattern '$check_pattern': ${RED}Not found ✗${NC}"
            all_checks_passed=false
        fi
    fi

    # Check for version source in output
    if [ -n "$check_source" ]; then
        if echo "$output" | grep -q "$check_source"; then
            echo -e "  Source '$check_source': ${GREEN}Found ✓${NC}"
        else
            echo -e "  Source '$check_source': ${RED}Not found ✗${NC}"
            all_checks_passed=false
        fi
    fi

    # Determine overall test result
    if [ "$all_checks_passed" = true ]; then
        echo -e "\n  ${GREEN}${BOLD}TEST PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "\n  ${RED}${BOLD}TEST FAILED${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        # Show relevant output for debugging
        echo -e "\n  ${YELLOW}Output excerpt:${NC}"
        echo "$output" | grep -E "(symlink_retirement|OVERDUE|PASS|FAIL|Version:|source:)" | head -10 | sed 's/^/    /'
        return 1
    fi
}

# Test 1: Default version from file (no env override) - should PASS with file source
run_test "Default version from file" "no" "" 0 "No overdue symlinks" "source: file:config/version.txt"

echo ""

# Test 2: Env override should show env source and FAIL for overdue version
run_test "Env override (v6.3.0)" "yes" "v6.3.0" 1 "OVERDUE symlinks" "source: env:LIYE_OS_VERSION"

echo ""

# Test 3: Version comparison edge case (v6.10.0 > v6.3.0)
run_test "Version comparison (v6.10.0)" "yes" "v6.10.0" 1 "OVERDUE symlinks" "source: env:LIYE_OS_VERSION"

echo ""

# Test 4: Exact retirement version should FAIL (v6.3.0 >= v6.3.0)
run_test "Exact retirement version (v6.3.0)" "yes" "v6.3.0" 1 "SYMLINK RETIREMENT ENFORCEMENT FAILURE" ""

echo ""

# Test 5: Env override with current version should PASS
run_test "Env override with current (v6.1.1)" "yes" "v6.1.1" 0 "No overdue symlinks" "source: env:LIYE_OS_VERSION"

echo ""
echo -e "${BOLD}${BLUE}================================================================${NC}"
echo -e "${BOLD}${BLUE}SELF-TEST SUMMARY${NC}"
echo -e "${BOLD}${BLUE}================================================================${NC}"
echo ""
echo -e "  Tests run: $TESTS_RUN"
echo -e "  Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "  Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ "$TESTS_FAILED" -eq 0 ]; then
    echo -e "${GREEN}${BOLD}ALL SELF-TESTS PASSED${NC}"
    exit 0
else
    echo -e "${RED}${BOLD}SOME SELF-TESTS FAILED${NC}"
    exit 1
fi
