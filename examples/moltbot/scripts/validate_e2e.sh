#!/usr/bin/env bash
#
# Phase 1 E2E Contract Validation Script
# Contract: GOV_TOOL_CALL_RESPONSE_V1.json + TRACE_REQUIRED_FIELDS_V1.json
#
# 模式:
#   正常模式 (默认): 期望 AGE 可达, origin_proof=true
#   故障演练模式 (FORCE_FALLBACK=1): 期望 mock fallback, origin_proof=false
#
set -euo pipefail

: "${LIYE_GOV_GATEWAY_URL:?需要设置 LIYE_GOV_GATEWAY_URL 环境变量}"
: "${TENANT_ID:=default}"
: "${FORCE_FALLBACK:=0}"

# Check for jq
if ! command -v jq &> /dev/null; then
  echo "❌ [ERROR] jq is required but not installed."
  echo "   Install: brew install jq (macOS) or apt install jq (Linux)"
  exit 1
fi

# 使用现有 Governed Tool Call Gateway 的 endpoint
ENDPOINT="${LIYE_GOV_GATEWAY_URL%/}/v1/governed_tool_call"

echo "========================================"
echo "Phase 1 E2E Contract Validation"
echo "========================================"
echo "Endpoint:   $ENDPOINT"
echo "Tenant:     $TENANT_ID"
echo "Contract:   GOV_TOOL_CALL_RESPONSE_V1"
if [[ "$FORCE_FALLBACK" == "1" ]]; then
  echo "Mode:       FAULT_DRILL (expect mock fallback)"
else
  echo "Mode:       NORMAL (expect real AGE)"
fi
echo "========================================"

payload='{
  "task": "Query campaign ACOS for Phase 1 contract validation",
  "tenant_id": "'"$TENANT_ID"'",
  "context": {},
  "proposed_actions": [
    {
      "action_type": "read",
      "tool": "amazon://strategy/campaign-audit",
      "arguments": {
        "profile_id": "DEMO",
        "campaign_id": "DEMO",
        "date_range": {"start": "2026-01-01", "end": "2026-01-07"}
      }
    }
  ]
}'

echo "[Phase1] Calling governed_tool_call..."
echo

resp=$(curl -sS -X POST "$ENDPOINT" \
  -H "content-type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d "$payload")

echo "Response (first 1500 chars):"
echo "$resp" | head -c 1500
echo
echo

# ============================================
# Contract Required Fields Validation
# ============================================
echo "=== Contract Required Fields (GOV_TOOL_CALL_RESPONSE_V1) ==="

# Extract fields with jq (handle boolean false correctly)
ok=$(echo "$resp" | jq -r 'if has("ok") then .ok else "MISSING" end')
decision=$(echo "$resp" | jq -r 'if has("decision") then .decision else "MISSING" end')
origin=$(echo "$resp" | jq -r 'if has("origin") then .origin else "MISSING" end')
origin_proof=$(echo "$resp" | jq -r 'if has("origin_proof") then .origin_proof else "MISSING" end')
mock_used=$(echo "$resp" | jq -r 'if has("mock_used") then .mock_used else "MISSING" end')
policy_version=$(echo "$resp" | jq -r 'if has("policy_version") then .policy_version else "MISSING" end')
trace_id=$(echo "$resp" | jq -r 'if has("trace_id") then .trace_id else "MISSING" end')
fallback_reason=$(echo "$resp" | jq -r 'if has("fallback_reason") then .fallback_reason else "MISSING" end')

echo "  ok             = $ok"
echo "  decision       = $decision"
echo "  origin         = $origin"
echo "  origin_proof   = $origin_proof"
echo "  mock_used      = $mock_used"
echo "  policy_version = $policy_version"
echo "  trace_id       = $trace_id"
echo "  fallback_reason= $fallback_reason"
echo

# Check required fields exist
FAIL=0

check_required() {
  local field=$1
  local value=$2
  # Handle MISSING, null, and empty string as missing
  # Note: "false" and "true" are valid boolean values, not missing
  if [[ "$value" == "MISSING" || "$value" == "null" || -z "$value" ]]; then
    echo "❌ [FAIL] Required field missing: $field"
    FAIL=1
  else
    echo "✅ [PASS] $field present (=$value)"
  fi
}

echo "--- Required Fields Check ---"
check_required "ok" "$ok"
check_required "decision" "$decision"
check_required "origin" "$origin"
check_required "origin_proof" "$origin_proof"
check_required "mock_used" "$mock_used"
check_required "policy_version" "$policy_version"
check_required "trace_id" "$trace_id"

if [[ $FAIL -eq 1 ]]; then
  echo "❌ [FATAL] Required fields missing - contract violation"
  exit 2
fi

# ============================================
# HF5 Consistency Rules Validation
# ============================================
echo
echo "=== HF5 Consistency Rules ==="

if [[ "$FORCE_FALLBACK" == "1" ]]; then
  # 故障演练模式: 期望 mock fallback
  echo "--- 故障演练模式断言 ---"

  if [[ "$mock_used" == "true" ]]; then
    echo "✅ [PASS] mock_used = true"
  else
    echo "❌ [FAIL] mock_used should be true (got: $mock_used)"
    FAIL=1
  fi

  if [[ "$origin_proof" == "false" ]]; then
    echo "✅ [PASS] origin_proof = false"
  else
    echo "❌ [FAIL] origin_proof should be false (got: $origin_proof)"
    FAIL=1
  fi

  if [[ "$origin" == "liye_os.mock" ]]; then
    echo "✅ [PASS] origin = liye_os.mock"
  else
    echo "❌ [FAIL] origin should be liye_os.mock (got: $origin)"
    FAIL=1
  fi

  if [[ "$decision" == "DEGRADE" ]]; then
    echo "✅ [PASS] decision = DEGRADE"
  else
    echo "❌ [FAIL] decision should be DEGRADE (got: $decision)"
    FAIL=1
  fi

  if [[ "$fallback_reason" != "MISSING" && "$fallback_reason" != "null" ]]; then
    echo "✅ [PASS] fallback_reason present: $fallback_reason"
  else
    echo "❌ [FAIL] fallback_reason required when mock_used=true"
    FAIL=1
  fi

else
  # 正常模式: 验证 HF5 一致性
  echo "--- 正常模式断言 ---"

  # 检查是否 fallback
  if [[ "$mock_used" == "true" ]]; then
    echo "⚠️  [INFO] AGE MCP unavailable - fallback to mock (acceptable in Phase 1)"
    echo "⚠️  [INFO] To test real AGE: start AGE MCP server first"

    # 验证 HF5 一致性: mock_used=true
    if [[ "$origin_proof" == "false" && "$origin" == "liye_os.mock" && "$decision" == "DEGRADE" ]]; then
      echo "✅ [PASS] HF5 consistency: mock_used=true → origin_proof=false, origin=liye_os.mock, decision=DEGRADE"
    else
      echo "❌ [FAIL] HF5 inconsistency detected"
      FAIL=1
    fi

    if [[ "$fallback_reason" != "MISSING" && "$fallback_reason" != "null" ]]; then
      echo "✅ [PASS] fallback_reason present"
    else
      echo "❌ [FAIL] fallback_reason required when mock_used=true"
      FAIL=1
    fi
  else
    # 真实 AGE 响应
    echo "✅ [PASS] mock_used = false (real AGE)"

    if [[ "$origin_proof" == "true" ]]; then
      echo "✅ [PASS] origin_proof = true"
    else
      echo "❌ [FAIL] origin_proof should be true for real AGE (got: $origin_proof)"
      FAIL=1
    fi

    if [[ "$origin" == "amazon-growth-engine" ]]; then
      echo "✅ [PASS] origin = amazon-growth-engine"
    else
      echo "❌ [FAIL] origin should be amazon-growth-engine (got: $origin)"
      FAIL=1
    fi
  fi
fi

# ============================================
# Decision Consistency Check
# ============================================
echo
echo "=== Decision Consistency ==="

if [[ "$decision" == "ALLOW" || "$decision" == "DEGRADE" ]]; then
  if [[ "$ok" == "true" ]]; then
    echo "✅ [PASS] ok=true when decision=$decision"
  else
    echo "❌ [FAIL] ok should be true when decision=$decision"
    FAIL=1
  fi
elif [[ "$decision" == "BLOCK" || "$decision" == "UNKNOWN" ]]; then
  if [[ "$ok" == "false" ]]; then
    echo "✅ [PASS] ok=false when decision=$decision"
  else
    echo "❌ [FAIL] ok should be false when decision=$decision"
    FAIL=1
  fi
fi

# ============================================
# Trace File Validation
# ============================================
echo
echo "=== Trace 文件验证 ==="

if [[ "$trace_id" != "MISSING" && "$trace_id" != "null" ]]; then
  trace_dir=".liye/traces/$trace_id"
  if [[ -d "$trace_dir" ]]; then
    echo "✅ [PASS] Trace directory: $trace_dir"
    if [[ -f "$trace_dir/events.ndjson" ]]; then
      line_count=$(wc -l < "$trace_dir/events.ndjson" | tr -d ' ')
      echo "✅ [PASS] events.ndjson exists ($line_count lines)"

      # Check for gateway.response event
      if grep -q '"type":"gateway.response"' "$trace_dir/events.ndjson" 2>/dev/null; then
        echo "✅ [PASS] gateway.response event present"
      else
        echo "⚠️  [WARN] gateway.response event not found"
      fi
    else
      echo "⚠️  [WARN] events.ndjson not found"
    fi
  else
    echo "⚠️  [WARN] Trace directory not found: $trace_dir"
  fi
else
  echo "⚠️  [WARN] No trace_id in response"
fi

# ============================================
# Final Result
# ============================================
echo
echo "========================================"
if [[ $FAIL -eq 0 ]]; then
  echo "✅ Phase 1 Contract Validation PASSED"
else
  echo "❌ Phase 1 Contract Validation FAILED"
  exit 3
fi
echo "========================================"
