#!/usr/bin/env bash
# print_openapi.sh - Print or copy OpenAPI spec for Dify import
# Usage: ./print_openapi.sh [--copy]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OPENAPI_FILE="$REPO_ROOT/examples/dify/governed-tool-call-gateway/openapi.yaml"

if [[ ! -f "$OPENAPI_FILE" ]]; then
  echo "Error: OpenAPI file not found at $OPENAPI_FILE" >&2
  exit 1
fi

if [[ "${1:-}" == "--copy" ]]; then
  if command -v pbcopy &>/dev/null; then
    cat "$OPENAPI_FILE" | pbcopy
    echo "✓ OpenAPI spec copied to clipboard ($(wc -l < "$OPENAPI_FILE" | tr -d ' ') lines)"
    echo "  Paste into Dify → Tools → Custom → Import via OpenAPI"
  elif command -v xclip &>/dev/null; then
    cat "$OPENAPI_FILE" | xclip -selection clipboard
    echo "✓ OpenAPI spec copied to clipboard ($(wc -l < "$OPENAPI_FILE" | tr -d ' ') lines)"
    echo "  Paste into Dify → Tools → Custom → Import via OpenAPI"
  else
    echo "Error: No clipboard tool found (pbcopy or xclip)" >&2
    echo "Printing to stdout instead:" >&2
    cat "$OPENAPI_FILE"
  fi
else
  cat "$OPENAPI_FILE"
fi
