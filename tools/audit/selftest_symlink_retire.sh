#!/bin/bash
#
# Symlink Retirement Enforcement Self-Test
# =========================================
#
# This script validates the symlink retirement enforcement logic in verify_v6_1.py
# by running two test scenarios:
#
# 1. Normal version (v6.1.1) - Should PASS
# 2. Overdue version (v6.3.0) - Should FAIL with remediation list
#
# Usage:
#     bash tools/audit/selftest_symlink_retire.sh
#
# Exit codes:
#     0: All tests passed
#     1: One or more tests failed
#
# Version: v6.1.1
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
echo -e "Date: $(date)"
echo ""

# Function to run a test
run_test() {
    local test_name="$1"
    local version="$2"
    local expected_exit="$3"
    local check_pattern="$4"

    TESTS_RUN=$((TESTS_RUN + 1))

    echo -e "${BOLD}────────────────────────────────────────────────────────────${NC}"
    echo -e "${BOLD}TEST $TESTS_RUN: $test_name${NC}"
    echo -e "  Version: $version"
    echo -e "  Expected exit code: $expected_exit"
    echo ""

    # Run verify script with version override
    set +e
    output=$(LIYE_OS_VERSION="$version" python3 "$VERIFY_SCRIPT" 2>&1)
    actual_exit=$?
    set -e

    # Check exit code
    if [ "$actual_exit" -eq "$expected_exit" ]; then
        echo -e "  Exit code: ${GREEN}$actual_exit (expected $expected_exit) ✓${NC}"
        exit_passed=true
    else
        echo -e "  Exit code: ${RED}$actual_exit (expected $expected_exit) ✗${NC}"
        exit_passed=false
    fi

    # Check for expected pattern in output
    if [ -n "$check_pattern" ]; then
        if echo "$output" | grep -q "$check_pattern"; then
            echo -e "  Pattern '$check_pattern': ${GREEN}Found ✓${NC}"
            pattern_passed=true
        else
            echo -e "  Pattern '$check_pattern': ${RED}Not found ✗${NC}"
            pattern_passed=false
        fi
    else
        pattern_passed=true
    fi

    # Determine overall test result
    if [ "$exit_passed" = true ] && [ "$pattern_passed" = true ]; then
        echo -e "\n  ${GREEN}${BOLD}TEST PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "\n  ${RED}${BOLD}TEST FAILED${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        # Show relevant output for debugging
        echo -e "\n  ${YELLOW}Output excerpt:${NC}"
        echo "$output" | grep -E "(symlink_retirement|OVERDUE|PASS|FAIL|Version:)" | head -10 | sed 's/^/    /'
        return 1
    fi
}

# Test 1: Normal version should PASS
run_test "Normal version (v6.1.1)" "v6.1.1" 0 "No overdue symlinks"

echo ""

# Test 2: Overdue version should FAIL
run_test "Overdue version (v6.3.0)" "v6.3.0" 1 "OVERDUE symlinks"

echo ""

# Test 3: Version comparison edge case (v6.10.0 > v6.3.0)
run_test "Version comparison (v6.10.0)" "v6.10.0" 1 "OVERDUE symlinks"

echo ""

# Test 4: Exact retirement version should FAIL (v6.3.0 >= v6.3.0)
run_test "Exact retirement version (v6.3.0)" "v6.3.0" 1 "SYMLINK RETIREMENT ENFORCEMENT FAILURE"

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
