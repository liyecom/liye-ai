#!/usr/bin/env bash
#
# Phase 0 E2E Validation Script
# 验证 Moltbot → LiYe Gateway → Amazon MCP 链路可行性
#
# 模式:
#   正常模式 (默认): 期望 AGE 可达, origin_proof=true
#   故障演练模式 (FORCE_FALLBACK=1): 期望 mock fallback, origin_proof=false
#
set -euo pipefail

: "${LIYE_GOV_GATEWAY_URL:?需要设置 LIYE_GOV_GATEWAY_URL 环境变量}"
: "${TENANT_ID:=default}"
: "${FORCE_FALLBACK:=0}"

# 使用现有 Governed Tool Call Gateway 的 endpoint
ENDPOINT="${LIYE_GOV_GATEWAY_URL%/}/v1/governed_tool_call"

echo "========================================"
echo "Phase 0 E2E Validation"
echo "========================================"
echo "Endpoint: $ENDPOINT"
echo "Tenant:   $TENANT_ID"
if [[ "$FORCE_FALLBACK" == "1" ]]; then
  echo "Mode:     FAULT_DRILL (expect mock fallback)"
else
  echo "Mode:     NORMAL (expect real AGE)"
fi
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

echo "Response (first 1500 chars):"
echo "$resp" | head -c 1500
echo
echo

# 基础验证
echo "=== 基础断言 ==="

if echo "$resp" | grep -q "trace_id"; then
  echo "✅ [PASS] trace_id present"
else
  echo "❌ [FAIL] missing trace_id"
  exit 2
fi

if echo "$resp" | grep -q "decision"; then
  echo "✅ [PASS] decision field present"
else
  echo "⚠️  [WARN] decision field missing"
fi

# HF5: origin/mock_used 一致性断言
echo
echo "=== HF5 断言 (origin/mock_used 一致性) ==="

# 提取字段值 (使用 python 解析 JSON 更可靠)
origin_proof=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('origin_proof', 'MISSING'))" 2>/dev/null || echo "PARSE_ERROR")
mock_used=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('mock_used', 'MISSING'))" 2>/dev/null || echo "PARSE_ERROR")
origin=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('origin', 'MISSING'))" 2>/dev/null || echo "PARSE_ERROR")

echo "  origin_proof = $origin_proof"
echo "  mock_used    = $mock_used"
echo "  origin       = $origin"
echo

if [[ "$FORCE_FALLBACK" == "1" ]]; then
  # 故障演练模式: 期望 mock fallback
  echo "--- 故障演练模式断言 ---"

  if [[ "$mock_used" == "True" ]]; then
    echo "✅ [PASS] mock_used = True"
  else
    echo "❌ [FAIL] mock_used should be True (got: $mock_used)"
    exit 3
  fi

  if [[ "$origin_proof" == "False" ]]; then
    echo "✅ [PASS] origin_proof = False"
  else
    echo "❌ [FAIL] origin_proof should be False (got: $origin_proof)"
    exit 3
  fi

  if [[ "$origin" == "liye_os.mock" ]]; then
    echo "✅ [PASS] origin = liye_os.mock"
  else
    echo "❌ [FAIL] origin should be liye_os.mock (got: $origin)"
    exit 3
  fi

  # 验证 fallback_reason 存在
  if echo "$resp" | grep -q "fallback_reason"; then
    echo "✅ [PASS] fallback_reason documented"
  else
    echo "❌ [FAIL] fallback_reason missing"
    exit 3
  fi

else
  # 正常模式: 期望真实 AGE 响应
  echo "--- 正常模式断言 ---"

  # 注意: Phase 0 AGE MCP 可能未启动，此时会 fallback
  # 如果 mock_used=True，说明 AGE 不可达，这在 Phase 0 是允许的
  if [[ "$mock_used" == "True" ]]; then
    echo "⚠️  [INFO] AGE MCP unavailable - fallback to mock (acceptable in Phase 0)"
    echo "⚠️  [INFO] To test real AGE: start AGE MCP server first"

    # 即使 fallback，也验证 HF5 一致性
    if [[ "$origin_proof" == "False" && "$origin" == "liye_os.mock" ]]; then
      echo "✅ [PASS] HF5 consistency: mock_used=True → origin_proof=False, origin=liye_os.mock"
    else
      echo "❌ [FAIL] HF5 inconsistency detected"
      exit 3
    fi
  else
    # 真实 AGE 响应
    if [[ "$mock_used" != "True" ]]; then
      echo "✅ [PASS] mock_used != True (real AGE)"
    fi

    if [[ "$origin_proof" == "True" ]]; then
      echo "✅ [PASS] origin_proof = True"
    else
      echo "❌ [FAIL] origin_proof should be True for real AGE (got: $origin_proof)"
      exit 3
    fi

    if [[ "$origin" == "amazon-growth-engine" ]]; then
      echo "✅ [PASS] origin = amazon-growth-engine"
    else
      echo "❌ [FAIL] origin should be amazon-growth-engine (got: $origin)"
      exit 3
    fi
  fi
fi

# Trace 文件验证
echo
echo "=== Trace 文件验证 ==="
trace_id=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('trace_id', ''))" 2>/dev/null || echo "")
if [[ -n "$trace_id" ]]; then
  trace_dir=".liye/traces/$trace_id"
  if [[ -d "$trace_dir" ]]; then
    echo "✅ [PASS] Trace directory: $trace_dir"
    if [[ -f "$trace_dir/events.ndjson" ]]; then
      echo "✅ [PASS] events.ndjson exists ($(wc -l < "$trace_dir/events.ndjson") lines)"
    else
      echo "⚠️  [WARN] events.ndjson not found"
    fi
  else
    echo "⚠️  [WARN] Trace directory not found"
  fi
fi

echo
echo "========================================"
echo "Phase 0 Validation Complete"
echo "========================================"
