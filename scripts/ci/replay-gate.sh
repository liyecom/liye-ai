#!/usr/bin/env bash
# P3-A Replay CI Gate
# Contract: docs/contracts/EVIDENCE_PACKAGE_V1.md (FROZEN: 2026-02-01)
#
# Verifies that historical evidence artifacts remain replayable.
# Any change that breaks replay is considered a breaking change.

set -euo pipefail

echo "🔒 Replay CI Gate: start"

FAILED=0
FIXTURES_DIR=".ci/replay-fixtures"

if [ ! -d "$FIXTURES_DIR" ]; then
  echo "⛔ Fixtures directory not found: $FIXTURES_DIR"
  exit 1
fi

for f in "$FIXTURES_DIR"/*.json; do
  [ -e "$f" ] || continue
  echo "▶ Replaying $f"
  if ! npm run audit:replay -- "$f"; then
    echo "❌ Replay failed for $f"
    FAILED=1
  fi
done

if [ "$FAILED" -ne 0 ]; then
  echo "⛔ Replay CI Gate FAILED"
  echo "   Historical trust guarantees have been violated."
  echo "   This change cannot be merged."
  exit 1
fi

echo "✅ Replay CI Gate PASSED"
echo "   All historical evidence artifacts remain verifiable."
