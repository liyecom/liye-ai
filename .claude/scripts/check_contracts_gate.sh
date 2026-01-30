#!/usr/bin/env bash
#
# Phase 1 Contracts Gate - CI Drift Check
#
# Validates:
# 1. Schema files are parseable JSON
# 2. OpenAPI snapshot matches committed version
# 3. E2E contract validation passes (FORCE_FALLBACK mode)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "========================================"
echo "Phase 1 Contracts Gate"
echo "========================================"
echo "Repo: $REPO_ROOT"
echo "========================================"

FAIL=0

# ============================================
# 1. Schema Validation
# ============================================
echo
echo "=== 1. Schema Validation ==="

SCHEMA_DIR="$REPO_ROOT/src/contracts/phase1"

validate_schema() {
  local schema_file=$1
  local schema_name=$(basename "$schema_file")

  if [[ ! -f "$schema_file" ]]; then
    echo "❌ [FAIL] Schema not found: $schema_name"
    FAIL=1
    return
  fi

  # Check JSON is parseable
  if node -e "JSON.parse(require('fs').readFileSync('$schema_file', 'utf8'))" 2>/dev/null; then
    echo "✅ [PASS] $schema_name is valid JSON"
  else
    echo "❌ [FAIL] $schema_name is invalid JSON"
    FAIL=1
  fi

  # Check $schema field exists (JSON Schema compliance)
  if node -e "const s=JSON.parse(require('fs').readFileSync('$schema_file','utf8')); if(!s['\$schema'])process.exit(1)" 2>/dev/null; then
    echo "✅ [PASS] $schema_name has \$schema field"
  else
    echo "⚠️  [WARN] $schema_name missing \$schema field"
  fi
}

validate_schema "$SCHEMA_DIR/GOV_TOOL_CALL_REQUEST_V1.json"
validate_schema "$SCHEMA_DIR/GOV_TOOL_CALL_RESPONSE_V1.json"
validate_schema "$SCHEMA_DIR/TRACE_REQUIRED_FIELDS_V1.json"

# ============================================
# 2. OpenAPI Snapshot Check
# ============================================
echo
echo "=== 2. OpenAPI Snapshot Check ==="

OPENAPI_SNAPSHOT="$REPO_ROOT/docs/contracts/openapi.snapshot.yaml"
OPENAPI_CURRENT="$REPO_ROOT/examples/dify/governed-tool-call-gateway/openapi.yaml"

if [[ -f "$OPENAPI_CURRENT" ]]; then
  if [[ -f "$OPENAPI_SNAPSHOT" ]]; then
    # Compare snapshots
    if diff -q "$OPENAPI_CURRENT" "$OPENAPI_SNAPSHOT" > /dev/null 2>&1; then
      echo "✅ [PASS] OpenAPI snapshot matches current"
    else
      echo "❌ [FAIL] OpenAPI drift detected!"
      echo "   Current:  $OPENAPI_CURRENT"
      echo "   Snapshot: $OPENAPI_SNAPSHOT"
      echo "   Run: cp '$OPENAPI_CURRENT' '$OPENAPI_SNAPSHOT'"
      FAIL=1
    fi
  else
    echo "⚠️  [WARN] No OpenAPI snapshot found"
    echo "   Creating initial snapshot..."
    cp "$OPENAPI_CURRENT" "$OPENAPI_SNAPSHOT"
    echo "   Created: $OPENAPI_SNAPSHOT"
    echo "   Please commit this file to version control"
  fi
else
  echo "⚠️  [WARN] No OpenAPI file found at $OPENAPI_CURRENT"
  echo "   Skipping OpenAPI drift check"
fi

# ============================================
# 3. E2E Contract Validation (FORCE_FALLBACK)
# ============================================
echo
echo "=== 3. E2E Contract Validation (FORCE_FALLBACK mode) ==="

# Check if gateway is running or can be started
GATEWAY_URL="${LIYE_GOV_GATEWAY_URL:-http://localhost:3210}"

# Try health check
if curl -s "$GATEWAY_URL/health" > /dev/null 2>&1; then
  echo "✅ Gateway is running at $GATEWAY_URL"
  GATEWAY_RUNNING=1
else
  echo "⚠️  Gateway not running at $GATEWAY_URL"
  echo "   Attempting to start gateway..."

  # Start gateway in background
  PORT=3210 node "$REPO_ROOT/examples/dify/governed-tool-call-gateway/server.mjs" &
  GATEWAY_PID=$!
  sleep 3

  if curl -s "$GATEWAY_URL/health" > /dev/null 2>&1; then
    echo "✅ Gateway started with PID $GATEWAY_PID"
    GATEWAY_RUNNING=1
    STARTED_GATEWAY=1
  else
    echo "❌ [FAIL] Could not start gateway"
    FAIL=1
    GATEWAY_RUNNING=0
  fi
fi

if [[ ${GATEWAY_RUNNING:-0} -eq 1 ]]; then
  # Run E2E validation in FORCE_FALLBACK mode
  echo
  echo "Running E2E contract validation (FORCE_FALLBACK=1)..."
  echo

  if LIYE_GOV_GATEWAY_URL="$GATEWAY_URL" FORCE_FALLBACK=1 \
     bash "$REPO_ROOT/examples/moltbot/scripts/validate_e2e.sh"; then
    echo
    echo "✅ [PASS] E2E contract validation passed"
  else
    echo
    echo "❌ [FAIL] E2E contract validation failed"
    FAIL=1
  fi

  # Stop gateway if we started it
  if [[ ${STARTED_GATEWAY:-0} -eq 1 ]]; then
    kill $GATEWAY_PID 2>/dev/null || true
    echo "✅ Gateway stopped"
  fi
fi

# ============================================
# Final Result
# ============================================
echo
echo "========================================"
if [[ $FAIL -eq 0 ]]; then
  echo "✅ Contracts Gate PASSED"
  exit 0
else
  echo "❌ Contracts Gate FAILED"
  exit 1
fi
echo "========================================"
