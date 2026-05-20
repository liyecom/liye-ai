#!/usr/bin/env bash
# Mutation-ban lint — per PHASE-0B-SPEC.md §6.4 line 287-309.
#
# Three-layer ban (full enforcement enabled in M3 when scan_db ships):
#   1. subprocess layer  — no `subprocess.{run,Popen,call,check_output}` / `os.system`
#      except read-only with `# noqa: read-only-exec` comment exemption
#   2. HTTP write methods — no requests.{post,put,delete,patch} / httpx mutators
#   3. SDK/ORM mutation  — no Medusa SDK apiKeyService.{create,revoke,update,delete}
#                         / remoteLink.{create,delete} / ORM .save/.delete/.update
#
# Defensive even though Medusa SDK is unavailable in this standalone tool —
# the lint catches future drift before it lands.

set -euo pipefail

SRC_DIR="src/phase_0b_parser"

cd "$(dirname "$0")/.."

if [ ! -d "$SRC_DIR" ]; then
    echo "FAIL: src dir $SRC_DIR not found"
    exit 1
fi

# ---------------------------------------------------------------------------
# Layer 1 — subprocess mutation ban (SPEC §6.4 line 297-302).
# `# noqa: read-only-exec` line-suffix exempts read-only invocations only.
# ---------------------------------------------------------------------------
SUBPROCESS_VIOLATIONS=$(grep -rnE --include='*.py' 'subprocess\.(run|Popen|call|check_output)|os\.system' "$SRC_DIR" \
    | grep -v '# noqa: read-only-exec' || true)
if [ -n "$SUBPROCESS_VIOLATIONS" ]; then
    echo "FAIL: subprocess mutation calls detected (no '# noqa: read-only-exec' exemption):"
    echo "$SUBPROCESS_VIOLATIONS"
    exit 1
fi

# ---------------------------------------------------------------------------
# Layer 2 — HTTP write-method ban (SPEC §6.4 line 304-308).
# `requests.get` / `httpx.get` allowed; only mutation verbs blocked.
# ---------------------------------------------------------------------------
HTTP_VIOLATIONS=$(grep -rnE --include='*.py' 'requests\.(post|put|delete|patch)|httpx\.(post|put|delete|patch)' "$SRC_DIR" || true)
if [ -n "$HTTP_VIOLATIONS" ]; then
    echo "FAIL: HTTP write-method calls detected:"
    echo "$HTTP_VIOLATIONS"
    exit 1
fi

# ---------------------------------------------------------------------------
# Layer 3 — SDK / ORM mutation ban (SPEC §6.4 line 291-294).
# Defensive: SDK is unavailable in this standalone tool, but lint enforced
# anyway to catch drift before it lands.
# ---------------------------------------------------------------------------
SDK_VIOLATIONS=$(grep -rnE --include='*.py' 'apiKeyService\.(create|revoke|update|delete)|remoteLink\.(create|delete)|\.save\(|\.delete\(\)|\.update\(' "$SRC_DIR" || true)
if [ -n "$SDK_VIOLATIONS" ]; then
    echo "FAIL: SDK/ORM mutation calls detected:"
    echo "$SDK_VIOLATIONS"
    exit 1
fi

echo "OK: mutation-ban full enforcement (subprocess + HTTP + SDK/ORM layers)"
