#!/bin/bash
# =============================================================================
# Glossary Usage Verification Script
# =============================================================================
# Purpose: Verify that Track spec.md/plan.md only use glossary-defined terms
# Usage: bash tools/audit/verify_glossary_usage.sh [track_path]
# Example: bash tools/audit/verify_glossary_usage.sh tracks/amz_optimize_ppc_20260101
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Default track path (can be overridden)
TRACK_PATH="${1:-tracks/amz_optimize_ppc_20260101}"

echo "============================================================================="
echo "GLOSSARY USAGE VERIFICATION"
echo "============================================================================="
echo ""
echo "Track: $TRACK_PATH"
echo ""

# Verify track exists
if [ ! -d "$TRACK_PATH" ]; then
    echo -e "${RED}✗ FAIL: Track directory not found: $TRACK_PATH${NC}"
    exit 1
fi

# Load state.yaml to get domain
STATE_FILE="$TRACK_PATH/state.yaml"
if [ ! -f "$STATE_FILE" ]; then
    echo -e "${RED}✗ FAIL: state.yaml not found${NC}"
    exit 1
fi

# Extract domain from state.yaml (simple grep approach)
DOMAIN=$(grep "^domain:" "$STATE_FILE" | head -1 | sed 's/domain:[[:space:]]*//')
if [ -z "$DOMAIN" ]; then
    echo -e "${RED}✗ FAIL: Could not extract domain from state.yaml${NC}"
    exit 1
fi
echo "Domain: $DOMAIN"

# Determine glossary path
GLOSSARY_PATH="knowledge/glossary/${DOMAIN}.yaml"
if [ ! -f "$GLOSSARY_PATH" ]; then
    echo -e "${RED}✗ FAIL: Glossary not found: $GLOSSARY_PATH${NC}"
    exit 1
fi
echo "Glossary: $GLOSSARY_PATH"
echo ""

# Extract valid terms from glossary
# Look for: term:, name:, concept_id:, and aliases
echo "--- Extracting valid terms from glossary ---"

VALID_TERMS=$(grep -E "^[[:space:]]*(term|name|concept_id):" "$GLOSSARY_PATH" 2>/dev/null | \
    sed 's/.*:[[:space:]]*//' | \
    tr -d '"' | \
    tr '[:upper:]' '[:lower:]' | \
    sort -u)

# Also extract aliases (simple approach: lines containing "- " after aliases:)
ALIASES=$(grep -A10 "aliases:" "$GLOSSARY_PATH" 2>/dev/null | \
    grep "^[[:space:]]*-" | \
    sed 's/.*-[[:space:]]*//' | \
    tr -d '"' | \
    tr '[:upper:]' '[:lower:]' | \
    sort -u)

# Combine into one list
ALL_VALID_TERMS=$(echo -e "$VALID_TERMS\n$ALIASES" | grep -v "^$" | sort -u)

echo "Valid terms found:"
echo "$ALL_VALID_TERMS" | head -20
TERM_COUNT=$(echo "$ALL_VALID_TERMS" | wc -l | tr -d ' ')
echo "(Total: $TERM_COUNT terms)"
echo ""

# Extract terms from spec.md and plan.md
echo "--- Scanning Track documents ---"

SPEC_FILE="$TRACK_PATH/spec.md"
PLAN_FILE="$TRACK_PATH/plan.md"

# Extract potential glossary terms (capitalized acronyms like ACoS, ROAS, CPC, CTR, CVR)
# Also Chinese terms that might be in glossary
FOUND_TERMS=""

if [ -f "$SPEC_FILE" ]; then
    echo "Scanning: $SPEC_FILE"
    # Find all capitalized words that look like metrics (e.g., ACoS, ROAS, CPC)
    SPEC_TERMS=$(grep -oE '\b[A-Z][A-Za-z]*[A-Z][A-Za-z]*\b|\b[A-Z]{2,}\b' "$SPEC_FILE" 2>/dev/null | sort -u || true)
    FOUND_TERMS="$FOUND_TERMS $SPEC_TERMS"
fi

if [ -f "$PLAN_FILE" ]; then
    echo "Scanning: $PLAN_FILE"
    PLAN_TERMS=$(grep -oE '\b[A-Z][A-Za-z]*[A-Z][A-Za-z]*\b|\b[A-Z]{2,}\b' "$PLAN_FILE" 2>/dev/null | sort -u || true)
    FOUND_TERMS="$FOUND_TERMS $PLAN_TERMS"
fi

# Deduplicate and filter out common non-glossary terms
UNIQUE_TERMS=$(echo "$FOUND_TERMS" | tr ' ' '\n' | grep -v "^$" | sort -u | \
    grep -v -E "^(README|TODO|MUST|NOT|AND|OR|THE|FOR|IF|ELSE|ID|TDD|CI|CD|PR|OK|MD|JSON|YAML)$" || true)

echo ""
echo "Terms found in documents:"
echo "$UNIQUE_TERMS"
echo ""

# Check each term against glossary
echo "--- Verification Results ---"
VIOLATIONS=0
VALID=0

for term in $UNIQUE_TERMS; do
    term_lower=$(echo "$term" | tr '[:upper:]' '[:lower:]')

    # Check if term exists in valid terms
    if echo "$ALL_VALID_TERMS" | grep -q "^${term_lower}$"; then
        echo -e "  ${GREEN}✓${NC} $term (in glossary)"
        ((VALID++))
    else
        # Also check exact match in uppercase/mixed case
        if echo "$ALL_VALID_TERMS" | grep -qi "^${term}$"; then
            echo -e "  ${GREEN}✓${NC} $term (in glossary)"
            ((VALID++))
        else
            echo -e "  ${RED}✗${NC} $term (NOT in glossary)"
            ((VIOLATIONS++))
        fi
    fi
done

echo ""
echo "============================================================================="
echo "                         VERIFICATION SUMMARY"
echo "============================================================================="
echo ""
echo "Track:       $TRACK_PATH"
echo "Domain:      $DOMAIN"
echo "Glossary:    $GLOSSARY_PATH"
echo ""
echo "Terms valid:     $VALID"
echo "Terms unknown:   $VIOLATIONS"
echo ""

if [ $VIOLATIONS -eq 0 ]; then
    echo -e "${GREEN}✓ PASS - All terms are defined in glossary${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}✗ FAIL - $VIOLATIONS unknown term(s) found${NC}"
    echo ""
    echo "Action Required:"
    echo "  1. Add missing terms to $GLOSSARY_PATH"
    echo "  2. Or remove undefined terms from spec.md/plan.md"
    echo ""
    exit 1
fi
