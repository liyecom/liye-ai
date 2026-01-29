#!/usr/bin/env bash
#
# Phase 0 E2E Validation Script
# 验证 Moltbot → LiYe Gateway → Amazon MCP 链路可行性
#
set -euo pipefail

: "${LIYE_GOV_GATEWAY_URL:?需要设置 LIYE_GOV_GATEWAY_URL 环境变量}"
: "${TENANT_ID:=default}"

# 使用现有 Governed Tool Call Gateway 的 endpoint
ENDPOINT="${LIYE_GOV_GATEWAY_URL%/}/v1/governed_tool_call"

echo "========================================"
echo "Phase 0 E2E Validation"
echo "========================================"
echo "Endpoint: $ENDPOINT"
echo "Tenant:   $TENANT_ID"
echo "========================================"

payload='{
  "task": "Query campaign ACOS for Phase 0 validation",
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

echo "[Phase0] Calling governed_tool_call..."
echo

resp=$(curl -sS -X POST "$ENDPOINT" \
  -H "content-type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d "$payload")

echo "Response (first 1200 chars):"
echo "$resp" | head -c 1200
echo
echo

# 验证返回中有 trace_id
if echo "$resp" | grep -q "trace_id"; then
  echo "✅ [PASS] trace_id present in response"
else
  echo "❌ [FAIL] missing trace_id in response"
  exit 2
fi

# 验证 decision 字段存在
if echo "$resp" | grep -q "decision"; then
  echo "✅ [PASS] decision field present"
else
  echo "⚠️  [WARN] decision field missing (may be expected in trace_lite mode)"
fi

# 提取 trace_id 并检查 trace 文件
trace_id=$(echo "$resp" | grep -o '"trace_id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
if [[ -n "$trace_id" ]]; then
  trace_dir=".liye/traces/$trace_id"
  if [[ -d "$trace_dir" ]]; then
    echo "✅ [PASS] Trace directory exists: $trace_dir"
    if [[ -f "$trace_dir/events.ndjson" ]]; then
      echo "✅ [PASS] events.ndjson exists"
      echo "   Lines: $(wc -l < "$trace_dir/events.ndjson")"
    else
      echo "⚠️  [WARN] events.ndjson not found (may be async write)"
    fi
  else
    echo "⚠️  [WARN] Trace directory not found: $trace_dir"
  fi
fi

echo
echo "========================================"
echo "Phase 0 Validation Complete"
echo "========================================"
