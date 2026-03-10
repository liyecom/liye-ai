#!/usr/bin/env bash
#
# E2E Integration Test Runner
# Slack -> Proxy -> LiYe Gateway -> AGE (Amazon Ads)
#
# Prerequisites:
#   - AGE_DIR env var pointing to AGE engine directory (with .env.local containing ADS_* vars)
#   - Slack tokens in Extensions/slack-proxy/.env (SLACK_BOT_TOKEN, SLACK_APP_TOKEN)
#   - LIYE_HMAC_SECRET set in .env or environment
#   - Python 3 venv at $AGE_DIR/.venv/
#
# Usage:
#   ./scripts/e2e_run.sh
#

set -euo pipefail

# ── Paths ────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SLACK_PROXY_DIR="$REPO_ROOT/Extensions/slack-proxy"
AGE_DIR="${AGE_DIR:?Set AGE_DIR to the AGE engine directory}"
EVIDENCE_DIR="$REPO_ROOT/evidence/e2e/$(date +%Y%m%d_%H%M%S)"

AGE_PORT=8765
GATEWAY_WS_PORT=3210
GATEWAY_HTTP_PORT=3211

# ── Colors ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

step() { echo -e "\n${CYAN}▶ $1${NC}"; }
ok()   { echo -e "  ${GREEN}✅ $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; }
fail() { echo -e "  ${RED}❌ $1${NC}"; exit 1; }

# ── Cleanup on exit ─────────────────────────────────────────────────
PIDS=()
cleanup() {
  echo -e "\n${YELLOW}Shutting down services...${NC}"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  done
  echo -e "${GREEN}Done.${NC}"
}
trap cleanup EXIT INT TERM

# ── 0. Validate prerequisites ───────────────────────────────────────
step "Checking prerequisites"

# Check AGE credentials
if [ ! -f "$AGE_DIR/.env.local" ]; then
  fail "Missing $AGE_DIR/.env.local (Amazon Ads credentials)"
fi

# Check Slack tokens
if [ ! -f "$SLACK_PROXY_DIR/.env" ]; then
  fail "Missing $SLACK_PROXY_DIR/.env (Slack tokens)"
fi

# Check venv
if [ ! -d "$AGE_DIR/.venv" ]; then
  warn "No venv at $AGE_DIR/.venv — creating..."
  python3 -m venv "$AGE_DIR/.venv"
  "$AGE_DIR/.venv/bin/pip" install -r "$AGE_DIR/requirements.txt" -q
fi

ok "Prerequisites validated"

# ── 1. Create evidence directory ────────────────────────────────────
step "Creating evidence directory: $EVIDENCE_DIR"
mkdir -p "$EVIDENCE_DIR"/{logs,logs/redacted,bundles,slack_screenshots}
ok "Evidence directory created"

# ── 2. Load environment ─────────────────────────────────────────────
step "Loading environment variables"

# Load AGE credentials (map ADS_* -> AMAZON_ADS_*)
while IFS='=' read -r key val; do
  case "$key" in
    ADS_CLIENT_ID)     export AMAZON_ADS_CLIENT_ID="$val"     ;;
    ADS_CLIENT_SECRET) export AMAZON_ADS_CLIENT_SECRET="$val" ;;
    ADS_PROFILE_ID)    export AMAZON_ADS_PROFILE_ID="$val"    ;;
    ADS_REFRESH_TOKEN) export AMAZON_ADS_REFRESH_TOKEN="$val" ;;
  esac
done < <(grep '^ADS_' "$AGE_DIR/.env.local" | sed 's/^export //')

# Load Slack proxy env
set -a
source "$SLACK_PROXY_DIR/.env"
set +a

# Defaults
export LIYE_GATEWAY_WS="${LIYE_GATEWAY_WS:-ws://localhost:$GATEWAY_WS_PORT/ws}"
export LIYE_POLICY_VERSION="${LIYE_POLICY_VERSION:-phase1-v1.0.0}"
export NO_PROXY="${NO_PROXY:-localhost,127.0.0.1}"

ok "Environment loaded"

# ── 3. Start AGE ────────────────────────────────────────────────────
step "Starting AGE (port $AGE_PORT)"
cd "$AGE_DIR"
"$AGE_DIR/.venv/bin/python3" -m src.job_api.server --port "$AGE_PORT" \
  > "$EVIDENCE_DIR/logs/age.log" 2>&1 &
PIDS+=($!)
cd "$SLACK_PROXY_DIR"

# Wait for health
for i in $(seq 1 15); do
  if curl -sf "http://localhost:$AGE_PORT/health" > /dev/null 2>&1; then
    curl -sf "http://localhost:$AGE_PORT/health" > "$EVIDENCE_DIR/logs/age_health.json"
    ok "AGE healthy"
    break
  fi
  [ "$i" -eq 15 ] && fail "AGE failed to start within 15s"
  sleep 1
done

# ── 4. Start LiYe Gateway ──────────────────────────────────────────
step "Starting LiYe Gateway (WS:$GATEWAY_WS_PORT / HTTP:$GATEWAY_HTTP_PORT)"
cd "$REPO_ROOT"
npx tsx src/gateway/openclaw/server.ts \
  > "$EVIDENCE_DIR/logs/liye_gateway.log" 2>&1 &
PIDS+=($!)
cd "$SLACK_PROXY_DIR"

# Wait for health
for i in $(seq 1 10); do
  if curl -sf "http://localhost:$GATEWAY_HTTP_PORT/health" > /dev/null 2>&1; then
    curl -sf "http://localhost:$GATEWAY_HTTP_PORT/health" > "$EVIDENCE_DIR/logs/liye_health.json"
    ok "Gateway healthy"
    break
  fi
  [ "$i" -eq 10 ] && fail "Gateway failed to start within 10s"
  sleep 1
done

# ── 5. Start Slack Proxy ───────────────────────────────────────────
step "Starting Slack Proxy (Socket Mode)"
npx tsx src/index.ts > "$EVIDENCE_DIR/logs/slack_proxy.log" 2>&1 &
PIDS+=($!)

sleep 3
if kill -0 "${PIDS[2]}" 2>/dev/null; then
  ok "Slack Proxy started"
else
  fail "Slack Proxy crashed on startup — check $EVIDENCE_DIR/logs/slack_proxy.log"
fi

# ── 6. Prompt user for Slack test ──────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  All services running. Send a DM to the bot in Slack:      ║${NC}"
echo -e "${CYAN}║                                                            ║${NC}"
echo -e "${CYAN}║  \"梳理一下近7天的广告活动的数据并分析\"                       ║${NC}"
echo -e "${CYAN}║                                                            ║${NC}"
echo -e "${CYAN}║  Wait for the ALLOW result (may take 30-300s).             ║${NC}"
echo -e "${CYAN}║  Then save screenshots:                                    ║${NC}"
echo -e "${CYAN}║    01_progress.png — progress bar (execute 50-80%)         ║${NC}"
echo -e "${CYAN}║    02_final.png    — final ALLOW result                    ║${NC}"
echo -e "${CYAN}║                                                            ║${NC}"
echo -e "${CYAN}║  Save to: $EVIDENCE_DIR/slack_screenshots/ ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Press ENTER when done (or Ctrl+C to abort)...${NC}"
read -r

# ── 7. Collect evidence ────────────────────────────────────────────
step "Collecting evidence"

# Redact logs
for logfile in age.log liye_gateway.log slack_proxy.log; do
  if [ -f "$EVIDENCE_DIR/logs/$logfile" ]; then
    sed -E \
      -e 's/xoxb-[A-Za-z0-9-]+/[REDACTED]/g' \
      -e 's/xapp-[A-Za-z0-9-]+/[REDACTED]/g' \
      -e 's/AKIA[A-Z0-9]{16}/[REDACTED]/g' \
      -e 's/Bearer [A-Za-z0-9._-]+/Bearer [REDACTED]/g' \
      "$EVIDENCE_DIR/logs/$logfile" > "$EVIDENCE_DIR/logs/redacted/$logfile"
    ok "Redacted $logfile"
  fi
done

# Extract trace_id from proxy log
TRACE_ID=$(grep -oP '"trace_id":"(trace-[a-f0-9-]+)"' "$EVIDENCE_DIR/logs/slack_proxy.log" | tail -1 | grep -oP 'trace-[a-f0-9-]+' || echo "unknown")
ok "Trace ID: $TRACE_ID"

# Try to fetch trace from Gateway
if [ "$TRACE_ID" != "unknown" ]; then
  curl -sf "http://localhost:$GATEWAY_HTTP_PORT/v1/traces/$TRACE_ID" > "$EVIDENCE_DIR/logs/trace.json" 2>/dev/null || warn "Could not fetch trace"
fi

# ── 8. Integrity check ─────────────────────────────────────────────
step "Evidence pack integrity check"

COMPLETE=true
for f in logs/age_health.json logs/liye_health.json logs/redacted/age.log logs/redacted/liye_gateway.log logs/redacted/slack_proxy.log; do
  if [ -f "$EVIDENCE_DIR/$f" ]; then
    ok "$f"
  else
    warn "$f MISSING"
    COMPLETE=false
  fi
done

for f in slack_screenshots/01_progress.png slack_screenshots/02_final.png; do
  if [ -f "$EVIDENCE_DIR/$f" ]; then
    ok "$f"
  else
    warn "$f (pending manual save)"
  fi
done

echo ""
if [ "$COMPLETE" = true ]; then
  echo -e "${GREEN}✅ E2E evidence pack created at:${NC}"
  echo -e "   $EVIDENCE_DIR"
  echo ""
  echo -e "${YELLOW}Next steps:${NC}"
  echo "  1. Save Slack screenshots to $EVIDENCE_DIR/slack_screenshots/"
  echo "  2. Write E2E_RUN_EVIDENCE.md with trace IDs and results"
  echo "  3. Commit evidence to repo"
else
  echo -e "${RED}⚠️  Evidence pack incomplete — check warnings above${NC}"
fi
