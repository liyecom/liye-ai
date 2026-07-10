#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
CHECKER="$ROOT_DIR/.github/scripts/check-live-site-files.sh"
FIXTURES="$ROOT_DIR/tests/fixtures/live-site-gate"

if ! "$CHECKER" < "$FIXTURES/allowed.txt"; then
  echo "FAIL: allowed website paths must pass" >&2
  exit 1
fi

echo "PASS: allowed website paths pass"

set +e
FORBIDDEN_OUTPUT=$("$CHECKER" < "$FIXTURES/forbidden.txt" 2>&1)
FORBIDDEN_STATUS=$?
set -e

if [ "$FORBIDDEN_STATUS" -ne 1 ]; then
  echo "FAIL: forbidden website paths must exit 1, got $FORBIDDEN_STATUS" >&2
  exit 1
fi

if [ "$FORBIDDEN_OUTPUT" != "$(cat "$FIXTURES/forbidden.txt")" ]; then
  echo "FAIL: classifier must report every forbidden path verbatim" >&2
  exit 1
fi

echo "PASS: forbidden website paths are reported and blocked"

set +e
ERROR_OUTPUT=$(PATH="$FIXTURES/failing-bin:$PATH" "$CHECKER" < "$FIXTURES/allowed.txt" 2>&1)
ERROR_STATUS=$?
set -e

if [ "$ERROR_STATUS" -ne 2 ]; then
  echo "FAIL: matcher/tool errors must exit 2, got $ERROR_STATUS" >&2
  exit 1
fi

if [[ "$ERROR_OUTPUT" != *"live-site classifier failed"* ]]; then
  echo "FAIL: matcher/tool errors must emit a classifier failure" >&2
  exit 1
fi

echo "PASS: matcher/tool errors fail closed"
