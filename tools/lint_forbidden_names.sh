#!/usr/bin/env bash
# Forbidden Name Lint Gate v1.1.0
# SSOT: tools/lint_forbidden_names.sh
#
# Phase: 0f (Checkpoint B1) per ADR §0f + EV2-B-01
#
# RULES (per EV2-B-01):
# - identifier-level (NOT string literals, NOT YAML/JSON/MD path/value strings)
# - declaration-pattern only:
#     (A) keyword + name      (const/let/var/function/class/def/fn/func/type/interface/
#                              enum/struct/static/public/private/async def/async function)
#     (B) line-start assignment (NAME = ...)
#     (C) function parameter   (def/function NAME(<forbidden>...) or (..., <forbidden>...))
# - **staged-blob**: reads index content (git show ":$f"), NOT working tree.
#   This prevents the hole "stage violation → modify working tree clean → commit slips".
# - source extensions only (.mjs .js .ts .tsx .jsx .py .sh .bash .rs .go .java .cpp .cc .c .h .hpp)
#     NOT scanned: .yaml .yml .json .md .txt .toml .ini .cfg
# - Self-test runs FIRST; self-test fail → exit 2
# - Lint violation → exit 1
# - Clean → exit 0
#
# FORBIDDEN PATTERNS (per glossary + Hard Gate 1 + EV2-B-01):
# - [Tt]rust* (with _, CamelCase, or bare)  — Hard Gate 1: no new Trust system
# - bare 'candidate'                        — too generic; use candidate_X / X_candidate / etc.
# - bare 'evaluator'                        — too generic; use policy_trial_evaluator / X_evaluator / etc.
# - bare 'trial'                            — too generic; use policy_trial / X_trial / trial_id / etc.
#
# REGEX FLAVOR: POSIX ERE (grep -E). Compatible with BSD/GNU grep both.
#
# USAGE:
#   bash tools/lint_forbidden_names.sh            # Default: lint staged blobs (self-test first)
#   bash tools/lint_forbidden_names.sh --self-test # Run self-test only and exit

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/lint_forbidden_names_fixtures"

# Source file extensions (regex for filename matching)
SOURCE_EXTS_RE='\.(mjs|js|ts|tsx|jsx|py|sh|bash|rs|go|java|cpp|cc|c|h|hpp)$'

# === POSIX ERE patterns ===
#
# Forbidden identifier core (no leading/trailing context):
#   [Tt]rust[_A-Z][A-Za-z0-9_]*  — Trust_X / TrustX / trust_X / trustX (catches `Trust_` followed by snake or CamelCase suffix)
#   [Tt]rust                     — bare Trust/trust (boundary checked by tail)
#   candidate / evaluator / trial — bare singletons (boundary checked by tail)
FORBIDDEN_CORE='([Tt]rust[_A-Z][A-Za-z0-9_]*|[Tt]rust|candidate|evaluator|trial)'

# Tail boundary: space, EOL, or non-word char (ensures full-identifier match, not a prefix of a longer name)
FORBIDDEN_TAIL='([[:space:]]|$|[^A-Za-z0-9_])'

# Pattern A — declaration keyword + forbidden identifier:
# Covers JS/TS: const/let/var/function/class/type/interface/enum + async function
# Covers Python: def/class + async def
# Covers Rust/Go/C/C++/Java: fn/func/struct/static/public/private/type
PATTERN_A="^[[:space:]]*((async[[:space:]]+)?(def|function|fn|func)|const|let|var|class|type|interface|enum|struct|static|public|private)[[:space:]]+${FORBIDDEN_CORE}${FORBIDDEN_TAIL}"

# Pattern B — line-start assignment (Python/Shell-style global assignment):
PATTERN_B="^[[:space:]]*${FORBIDDEN_CORE}[[:space:]]*="

# Pattern C — forbidden identifier as function parameter:
# Matches `def NAME(<forbidden>...)`, `function NAME(<forbidden>...)`,
#         `def NAME(..., <forbidden>...)`, `async function NAME(<forbidden>...)`
# Inside parens, accepts either:
#   first param: `(\s*FORBIDDEN`
#   subsequent : `([^)]*,\s*FORBIDDEN)`
PATTERN_C="^[[:space:]]*(async[[:space:]]+)?(def|function|fn|func)[[:space:]]+[A-Za-z_][A-Za-z0-9_]*[[:space:]]*\\(([[:space:]]*|[^)]*,[[:space:]]*)${FORBIDDEN_CORE}([[:space:]]|[,:=)])"

# Colors via printf
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
NC=$'\033[0m'

# Lint a file path (real on-disk OR staged-blob temp); return 0 clean, 1 hits.
# Args:
#   $1 = display name (for reporting, the actual repo path)
#   $2 = file path to read content from
lint_file_at() {
  local display_name="$1"
  local read_path="$2"
  local hits_a hits_b hits_c
  hits_a=$(grep -nE "$PATTERN_A" "$read_path" 2>/dev/null || true)
  hits_b=$(grep -nE "$PATTERN_B" "$read_path" 2>/dev/null || true)
  hits_c=$(grep -nE "$PATTERN_C" "$read_path" 2>/dev/null || true)
  if [ -n "$hits_a$hits_b$hits_c" ]; then
    printf '%s❌ Forbidden name in %s (staged blob):%s\n' "$RED" "$display_name" "$NC"
    [ -n "$hits_a" ] && printf '%s\n' "$hits_a" | sed 's/^/    [A] /'
    [ -n "$hits_b" ] && printf '%s\n' "$hits_b" | sed 's/^/    [B] /'
    [ -n "$hits_c" ] && printf '%s\n' "$hits_c" | sed 's/^/    [C] /'
    return 1
  fi
  return 0
}

run_self_test() {
  local pass=0 fail=0

  if [ ! -d "$FIXTURES_DIR" ]; then
    printf '%s❌ Self-test fixtures directory missing: %s%s\n' "$RED" "$FIXTURES_DIR" "$NC"
    return 1
  fi

  # must_pass_*: zero hits expected (all 3 patterns)
  for fixture in "$FIXTURES_DIR"/must_pass_*; do
    [ -f "$fixture" ] || continue
    local hits
    hits=$(grep -nE "$PATTERN_A|$PATTERN_B|$PATTERN_C" "$fixture" 2>/dev/null || true)
    if [ -n "$hits" ]; then
      printf '%s  ❌ self-test: must_pass fixture wrongly flagged: %s%s\n' "$RED" "$(basename "$fixture")" "$NC"
      printf '%s\n' "$hits" | sed 's/^/      /'
      fail=$((fail + 1))
    else
      printf '%s  ✅ self-test: %s cleanly passed%s\n' "$GREEN" "$(basename "$fixture")" "$NC"
      pass=$((pass + 1))
    fi
  done

  # must_fail_*: at least one hit expected
  for fixture in "$FIXTURES_DIR"/must_fail_*; do
    [ -f "$fixture" ] || continue
    local hits
    hits=$(grep -nE "$PATTERN_A|$PATTERN_B|$PATTERN_C" "$fixture" 2>/dev/null || true)
    if [ -z "$hits" ]; then
      printf '%s  ❌ self-test: must_fail fixture NOT flagged: %s%s\n' "$RED" "$(basename "$fixture")" "$NC"
      fail=$((fail + 1))
    else
      local hit_count
      hit_count=$(printf '%s\n' "$hits" | grep -c '^' 2>/dev/null || echo 0)
      printf '%s  ✅ self-test: %s triggered (%d hits)%s\n' "$GREEN" "$(basename "$fixture")" "$hit_count" "$NC"
      pass=$((pass + 1))
    fi
  done

  printf '\n'
  if [ "$fail" -gt 0 ]; then
    printf '%sSelf-test FAILED: %d failures, %d successes%s\n' "$RED" "$fail" "$pass" "$NC"
    return 1
  fi
  printf '%sSelf-test passed: %d fixtures verified%s\n' "$GREEN" "$pass" "$NC"
  return 0
}

# Parse mode
MODE="lint"
if [ "${1:-}" = "--self-test" ]; then
  MODE="self-test"
elif [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<EOF
Usage: bash tools/lint_forbidden_names.sh [--self-test|--help]

Default mode (no args): self-test first, then lint staged-blob source files.
--self-test mode: run self-test only and exit.

Forbidden patterns (per EV2-B-01):
  [Tt]rust* (with _, CamelCase, or bare)  — Hard Gate 1: no new Trust system
  bare 'candidate'                        — use compound name
  bare 'evaluator'                        — use compound name
  bare 'trial'                            — use compound name (policy_trial / trial_id / etc.)

Coverage:
  A — declaration: keyword + identifier
  B — assignment:  ^IDENT = ...
  C — parameter:   def/function NAME(<forbidden>, ...)

Reads index/staged blobs (git show ":\$f"), NOT working tree.

Exit codes:
  0 = clean
  1 = forbidden name found in staged source
  2 = self-test failed or fixtures missing
EOF
  exit 0
fi

# 1. Run self-test (always; fail-fast)
printf '═══════════════════════════════════════════════════════════\n'
printf '  Forbidden Name Lint Self-Test\n'
printf '═══════════════════════════════════════════════════════════\n'
if ! run_self_test; then
  printf '\n%s❌ Lint refuses to run (self-test failed).%s\n' "$RED" "$NC"
  exit 2
fi

if [ "$MODE" = "self-test" ]; then
  exit 0
fi

# 2. Lint staged-blob source files
printf '\n═══════════════════════════════════════════════════════════\n'
printf '  Linting staged-blob source files (reads git index, not working tree)\n'
printf '═══════════════════════════════════════════════════════════\n'

cd "$PROJECT_ROOT"

declare -a STAGED=()
while IFS= read -r line; do
  [ -n "$line" ] && STAGED+=("$line")
done < <(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true)

declare -a SOURCE_FILES=()
for f in "${STAGED[@]:-}"; do
  if [[ "$f" =~ $SOURCE_EXTS_RE ]]; then
    # Skip lint's own fixtures (they contain intentional violations)
    case "$f" in
      tools/lint_forbidden_names_fixtures/*) continue ;;
    esac
    SOURCE_FILES+=("$f")
  fi
done

if [ ${#SOURCE_FILES[@]} -eq 0 ]; then
  printf '%s✅ No staged source files to lint.%s\n' "$GREEN" "$NC"
  exit 0
fi

printf '  Files to lint (staged blobs): %d\n' "${#SOURCE_FILES[@]}"

# Tempdir for staged blob extraction
LINT_TMPDIR=$(mktemp -d -t lintforbid.XXXXXX)
trap 'rm -rf "$LINT_TMPDIR"' EXIT

VIOLATIONS=0
for f in "${SOURCE_FILES[@]}"; do
  # Verify staged blob exists for this path (e.g. not a staged delete)
  if ! git cat-file -e ":$f" 2>/dev/null; then
    continue
  fi
  # Extract staged blob to temp file. Sanitize basename for the temp path.
  blob_temp="$LINT_TMPDIR/$(printf '%s' "$f" | tr '/' '_').staged"
  if ! git show ":$f" > "$blob_temp" 2>/dev/null; then
    rm -f "$blob_temp"
    continue
  fi
  if ! lint_file_at "$f" "$blob_temp"; then
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

printf '\n'
if [ "$VIOLATIONS" -gt 0 ]; then
  printf '%s❌ Forbidden name lint FAILED (%d file(s) flagged)%s\n' "$RED" "$VIOLATIONS" "$NC"
  printf '   Forbidden: [Tt]rust* (Hard Gate 1) | bare candidate | bare evaluator | bare trial\n'
  printf '   Use compound names: candidate_write_enabled / policy_trial_evaluator / trial_id / etc.\n'
  printf '   NOTE: lint reads staged blob, not working tree. Fix the staged content (re-stage after edit).\n'
  exit 1
fi

printf '%s✅ Forbidden name lint passed (%d files)%s\n' "$GREEN" "${#SOURCE_FILES[@]}" "$NC"
exit 0
