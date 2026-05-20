#!/usr/bin/env bash
# Mutation-ban lint skeleton — per PHASE-0B-SPEC.md §6.4 line 287-309.
#
# Two-layer ban (full enforcement lands with scan_db in M3 / scan_consumers in M4):
#   1. subprocess layer  — no `subprocess.{run,Popen,call,check_output}` / `os.system`
#      except read-only with `# noqa: read-only-exec` comment exemption
#   2. SDK/HTTP layer    — no requests.{post,put,delete,patch} / httpx mutators
#                         / Medusa SDK apiKeyService.{create,revoke,update,delete}
#                         / any ORM .save/.delete/.update/.insert
#
# M1 source has zero DB/HTTP code, so this lint is a no-op skeleton. The full
# grep set per SPEC §6.4 line 297-309 will be wired in M3/M4.

set -euo pipefail

SRC_DIR="src/phase_0b_parser"

cd "$(dirname "$0")/.."

if [ ! -d "$SRC_DIR" ]; then
    echo "FAIL: src dir $SRC_DIR not found"
    exit 1
fi

# TODO M3/M4: enable the grep set below once scan_db / scan_consumers land.
#
# grep -rE 'subprocess\.(run|Popen|call|check_output)|os\.system' "$SRC_DIR" \
#     | grep -v '# noqa: read-only-exec' \
#     && exit 1 || true
#
# grep -rE 'requests\.(post|put|delete|patch)|httpx\.(post|put|delete|patch)' \
#     "$SRC_DIR" && exit 1 || true
#
# grep -rE 'apiKeyService\.(create|revoke|update|delete)|remoteLink\.(create|delete)' \
#     "$SRC_DIR" && exit 1 || true

echo "OK: mutation-ban skeleton (M3/M4 full enforcement pending per SPEC §6.4)"
