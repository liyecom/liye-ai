#!/bin/bash
#
# Run the Governed Knowledge Call Demo
#
# Usage:
#   ./examples/federation/governed-knowledge-call/run_demo.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$PROJECT_ROOT"

echo "Running Governed Knowledge Call Demo..."
echo ""

node examples/federation/governed-knowledge-call/run_demo.mjs

echo ""
echo "Evidence package written to .liye/traces/"
