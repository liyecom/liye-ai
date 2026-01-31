#!/usr/bin/env bash
# check_gateway_ready.sh - Verify Gateway + Tunnel readiness for Dify import
# Usage: ./check_gateway_ready.sh [--tunnel-url URL]

set -euo pipefail

GATEWAY_PORT="${PORT:-3210}"
GATEWAY_URL="http://localhost:$GATEWAY_PORT"
TUNNEL_URL="${1:-}"
API_KEY="${LIYE_API_KEY:-}"

echo "=== LiYe Gateway Readiness Check ==="
echo ""

# 1. Local health check
echo -n "Local Health ($GATEWAY_URL/health): "
if curl -sf "$GATEWAY_URL/health" >/dev/null 2>&1; then
  echo "✓ OK"
else
  echo "✗ FAIL - Gateway not running"
  echo "  Start with: node examples/dify/governed-tool-call-gateway/server.mjs"
  exit 1
fi

# 2. Check for tunnel URL
if [[ -z "$TUNNEL_URL" ]]; then
  # Try to detect cloudflared tunnel
  TUNNEL_URL=$(ps aux 2>/dev/null | grep -o 'https://[a-z-]*\.trycloudflare\.com' | head -1 || true)
fi

if [[ -n "$TUNNEL_URL" ]]; then
  echo "Tunnel URL: $TUNNEL_URL"
  echo -n "Tunnel Health: "
  if curl -sf "$TUNNEL_URL/health" >/dev/null 2>&1; then
    echo "✓ OK"
  else
    echo "✗ FAIL - Tunnel not responding"
  fi
else
  echo "Tunnel URL: (not detected)"
  echo "  To create: cloudflared tunnel --url http://localhost:$GATEWAY_PORT"
fi

# 3. Check API key
if [[ -n "$API_KEY" ]]; then
  echo "API Key: ${API_KEY:0:20}..."

  # Test auth
  echo -n "Auth Check (no key): "
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$GATEWAY_URL/v1/governed_tool_call" -X POST -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "000")
  if [[ "$STATUS" == "401" ]]; then
    echo "✓ 401 (correctly rejected)"
  else
    echo "? $STATUS"
  fi

  echo -n "Auth Check (with key): "
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$GATEWAY_URL/v1/governed_tool_call" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d '{"task":"test","proposed_actions":[{"action_type":"read","tool":"test"}]}' 2>/dev/null || echo "000")
  if [[ "$STATUS" == "200" ]]; then
    echo "✓ 200 (accepted)"
  else
    echo "? $STATUS"
  fi
else
  echo "API Key: (not set)"
  echo "  Set LIYE_API_KEY if auth is enabled"
fi

echo ""
echo "=== Ready for Dify Import ==="
if [[ -n "$TUNNEL_URL" ]]; then
  echo "Server URL for Dify: $TUNNEL_URL"
else
  echo "Server URL for Dify: $GATEWAY_URL (local only)"
fi
