#!/usr/bin/env bash
# Verb-prefix whitelist enforcement — per PHASE-0B-SPEC.md §6.1 line 243-252.
#
# SPEC reference path is `src/0b/`; this project uses `src/phase_0b_parser/`
# (Python package naming convention — underscores not hyphens; documented in
# the M1 report and README).
#
# Whitelist (SPEC §6.1 line 235-239, Decision 4 + v2 Gap A):
#   classify | is | list | report | scan
#
# Scope: only catches module-level `def <verb>_*` and `async def <verb>_*`.
# Functions without a verb_<underscore> form (e.g. `check_envelope`,
# `normalize`, dunder methods) fall outside the verb-prefix rule by design —
# the SPEC whitelist constrains verb-prefixed public API only.

set -euo pipefail

SRC_DIR="src/phase_0b_parser"
WHITELIST=(classify is list report scan)

cd "$(dirname "$0")/.."

if [ ! -d "$SRC_DIR" ]; then
    echo "FAIL: src dir $SRC_DIR not found"
    exit 1
fi

# Extract verb prefixes from module-level def statements only (column 0).
# Pattern: optional `async ` + `def ` + lowercase verb + `_`.
FOUND=$(grep -rEho '^(async )?def [a-z]+_' "$SRC_DIR" \
    | sed -E 's/^(async )?def ([a-z]+)_.*/\2/' \
    | sort -u || true)

VIOLATIONS=()
while IFS= read -r verb; do
    [ -z "$verb" ] && continue
    if ! printf '%s\n' "${WHITELIST[@]}" | grep -qx "$verb"; then
        VIOLATIONS+=("$verb")
    fi
done <<< "$FOUND"

if [ ${#VIOLATIONS[@]} -gt 0 ]; then
    echo "FAIL: verb prefix violations (not in whitelist [${WHITELIST[*]}]):"
    printf '  - %s\n' "${VIOLATIONS[@]}"
    exit 1
fi

echo "OK: all module-level def verb prefixes within whitelist"
