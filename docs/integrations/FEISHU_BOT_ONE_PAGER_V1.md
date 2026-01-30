# Feishu Bot Integration (Thin-Agent) v1

Phase 1 Week 2: Feishu Thin-Agent with Interactive Verdict Card

## Overview

This integration implements a **Thin-Agent** pattern where the Feishu adapter:
- **DOES**: Verify, parse, forward, display
- **DOES NOT**: Select tools, analyze intent, make routing decisions

All governance decisions are made by LiYe OS Gateway.

## Architecture

```
User → Feishu Bot → /v1/feishu/events → Gateway → AGE MCP → Response
                                            ↓
                              Interactive Verdict Card ← render_verdict_card.mjs
```

## Quick Start

### 1. Environment Variables

Create `.env` in project root (or export these):

```bash
# Gateway port
export PORT=3210

# Feishu App credentials (from 飞书开发者后台)
export FEISHU_APP_ID=cli_xxxxx
export FEISHU_APP_SECRET=xxxxxxxx

# Verification token (from 飞书事件订阅配置)
export FEISHU_VERIFICATION_TOKEN=xxxxxxxx

# Optional: Trace viewer URL
export TRACE_VIEWER_BASE_URL=https://your-trace-viewer.com
```

### 2. Start Gateway

```bash
cd ~/github/liye_os/examples/dify/governed-tool-call-gateway
node server.mjs
```

Expected output:
```
╔═══════════════════════════════════════════════════════════════╗
║  Governed Tool Call Gateway (Phase 1 Contract)                ║
╠═══════════════════════════════════════════════════════════════╣
║  Endpoint: http://localhost:3210/v1/governed_tool_call        ║
║  Feishu:   http://localhost:3210/v1/feishu/events             ║
║  Health:   http://localhost:3210/health                       ║
╚═══════════════════════════════════════════════════════════════╝
```

### 3. Local Testing (No Feishu Required)

```bash
curl -sS -X POST "http://127.0.0.1:3210/v1/feishu/events" \
  -H "content-type: application/json" \
  -d @examples/feishu/fixtures/event_message.json
```

Expected output:
```json
{
  "ok": true,
  "decision": "ALLOW" | "DEGRADE",
  "trace_id": "trace-xxx",
  "origin": "AGE" | "liye_os.mock",
  "mock_used": false | true
}
```

Verify trace exists:
```bash
ls .liye/traces/trace-*/events.ndjson
```

## Feishu Developer Console Configuration

### 1. Create App

1. Go to [飞书开发者后台](https://open.feishu.cn/app)
2. Create new app → Custom App
3. Note down `App ID` and `App Secret`

### 2. Enable Bot

1. App Features → Bot → Enable
2. Set bot name and avatar

### 3. Configure Event Subscription

1. Event Subscription → Configure
2. Request URL: `https://your-domain.com/v1/feishu/events`
3. Verification Token: copy and set as `FEISHU_VERIFICATION_TOKEN`
4. Subscribe to events:
   - `im.message.receive_v1` (Receive messages)

### 4. Permissions

Add these permissions:
- `im:message:send_as_bot` (Send messages as bot)
- `im:message` (Read messages)

### 5. Deploy & Publish

1. Deploy app
2. Publish (or use internal test mode)
3. Add bot to group chat

## Verification Cases

### Case 1: Normal Text Message (read)

**Input**: Send "查询本周 ACOS" to bot

**Expected Card**:
```
LiYe Verdict · ALLOW
─────────────────────
Trace ID: trace-xxx
Decision: ALLOW
Origin: AGE · Origin Proof: true
Mock Used: false
Policy: phase1-v1.0.0
─────────────────────
已通过治理检查，可继续执行下一步。
[打开 Trace] [复制 Trace ID]
```

### Case 2: Fault Drill (AGE Unreachable)

**Setup**: Stop AGE MCP or set `FORCE_FALLBACK=1`

**Input**: Send any message

**Expected Card**:
```
LiYe Verdict · DEGRADE
─────────────────────
Trace ID: trace-xxx
Decision: DEGRADE
Origin: liye_os.mock · Origin Proof: false
Mock Used: true
Fallback Reason: AGE MCP unavailable
Policy: phase1-v1.0.0
─────────────────────
已降级到 mock fallback，结果可用但受限。
```

### Case 3: Unauthorized Chat ID

**Setup**: Edit `tenant_map.json` to remove wildcard:
```json
{
  "default": {
    "tenant_id": "default",
    "allowed_chat_ids": ["oc_specific_chat_only"]
  }
}
```

**Input**: Send message from unauthorized chat

**Expected**: No response (BLOCK logged in trace)

Verify in trace:
```bash
cat .liye/traces/trace-xxx/events.ndjson | grep feishu.blocked
```

## Trace Events

The adapter writes these events to `.liye/traces/<trace_id>/events.ndjson`:

| Event Type | Fields |
|------------|--------|
| `feishu.inbound` | trace_id, chat_id, user_id, message_id, message_type |
| `feishu.outbound` | trace_id, decision, origin, mock_used |
| `feishu.blocked` | trace_id, chat_id, reason |

## Contract Compliance

### Request (GOV_TOOL_CALL_REQUEST_V1)

```json
{
  "task": "查询本周 ACOS",
  "tenant_id": "default",
  "trace_id": "trace-xxx",
  "context": { "source": "feishu", "chat_id": "oc_xxx" },
  "proposed_actions": [{
    "action_type": "read",
    "tool": "amazon://strategy/campaign-audit",
    "arguments": { "query": "查询本周 ACOS" }
  }]
}
```

### Response (GOV_TOOL_CALL_RESPONSE_V1)

Card must display these required fields:
- `trace_id` (always)
- `decision` (ALLOW/BLOCK/DEGRADE/UNKNOWN)
- `origin` (AGE or liye_os.mock)
- `mock_used` (boolean)

HF5 rules enforced:
- `mock_used=true` → `origin=liye_os.mock`, `origin_proof=false`, `decision=DEGRADE`
- `origin=AGE` → `origin_proof=true`, `mock_used=false`

## Thin-Agent Constraints

The Feishu adapter MUST NOT:

1. **Select tools** - Always uses default `amazon://strategy/campaign-audit`
2. **Classify intent** - User text goes directly to `task` field
3. **Make routing decisions** - Gateway decides everything
4. **Store sensitive data** - Only trace_id and decision in logs

These constraints ensure:
- Auditability (all decisions logged in Gateway)
- Reusability (adapter works for any LiYe-governed workflow)
- Controllability (policy changes require no adapter updates)

## Troubleshooting

### "Gateway unreachable" in all responses

1. Check Gateway is running: `curl http://localhost:3210/health`
2. Check port matches: `echo $PORT`

### No response in Feishu

1. Check FEISHU_APP_ID/SECRET are set
2. Check bot has `im:message:send_as_bot` permission
3. Check logs: look for `[FeishuAdapter]` or `[FeishuClient]` errors

### Token verification failed

1. Check `FEISHU_VERIFICATION_TOKEN` matches console
2. For local dev, unset the token to skip verification

### Card not rendering

1. Check `verdict_card_v1.json` exists in `examples/feishu/cards/`
2. Look for `[VerdictCard] Render error` in logs
3. Fallback text message will be sent if card fails

## Files Reference

| File | Purpose |
|------|---------|
| `examples/feishu/feishu_adapter.mjs` | Event handler (Thin-Agent) |
| `examples/feishu/feishu_client.mjs` | Feishu API client |
| `examples/feishu/cards/verdict_card_v1.json` | Card template |
| `examples/feishu/cards/render_verdict_card.mjs` | Card renderer |
| `examples/feishu/tenant_map.json` | Chat ID allowlist |
| `examples/feishu/fixtures/event_message.json` | Local test fixture |

---

**Version**: 1.0.0
**Phase**: 1 Week 2
**Last Updated**: 2026-01-30
