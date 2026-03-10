# Slack Proxy for LiYe Gateway

Slack bot that proxies user messages to LiYe Gateway for governed tool execution.

**Strict Proxy Mode**: No LLM reasoning, no intent routing, fixed capability (`amazon://strategy/wasted-spend-detect`).

## Quick Start

### 1. Prerequisites

- Node.js >= 18
- Slack App with Socket Mode enabled
- LiYe Gateway running (PR#1)
- AGE Job API running (PR#3)

### 2. Environment Setup

```bash
cd Extensions/slack-proxy
npm install

# Copy env template
cp .env.example .env
# Edit .env with your credentials
```

Required environment variables:

```bash
# Slack
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token

# LiYe Gateway
LIYE_GATEWAY_WS=ws://localhost:3210/ws
LIYE_HMAC_SECRET=your-shared-secret
LIYE_POLICY_VERSION=phase1-v1.0.0

# Optional: Proxy (respects standard env vars)
HTTP_PROXY=http://proxy:8080
HTTPS_PROXY=http://proxy:8080
NO_PROXY=localhost,127.0.0.1,.internal.corp

# Optional: Throttle tuning (defaults shown)
SLACK_UPDATE_MIN_INTERVAL_MS=900      # Min ms between Slack updates
SLACK_PROGRESS_STEP=10                # Progress step threshold (%)
SLACK_MAX_UPDATES_PER_JOB=30          # Max updates per job

# Optional: WebSocket resilience (defaults shown)
WS_RECONNECT_MAX=3                    # Max reconnect attempts
WS_RECONNECT_BASE_DELAY_MS=500        # Base delay for exponential backoff
```

### 3. Start the Proxy

```bash
npm start
```

### 4. Test in Slack

Send a message to the bot:

```
@YourBot 分析我的广告浪费（近7天）
```

Expected output:
- Progress updates showing Gate → Enforce → Route → Execute → Verdict
- Final result with wasted spend table
- trace_id for audit trail

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Slack       │────▶│  Slack Proxy    │────▶│  LiYe Gateway   │
│                 │◀────│  (This Service) │◀────│  (WS Stream)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │    AGE          │
                                                │  (Job API)      │
                                                └─────────────────┘
```

## Message Flow

1. User sends message to Slack bot
2. Proxy builds `GovToolCallRequestV1` (fixed capability)
3. Proxy connects to LiYe Gateway via WebSocket
4. Gateway streams `StreamChunkV1` chunks back
5. Proxy updates Slack message in real-time
6. Final result displayed with trace_id

## File Structure

```
Extensions/slack-proxy/
├── src/
│   ├── index.ts              # Entry point
│   ├── env.ts                # Environment config
│   ├── slack/
│   │   ├── socket_mode.ts    # Socket Mode handler
│   │   └── slack_client.ts   # Slack API wrapper + rate limit backoff
│   ├── liye/
│   │   ├── hmac.ts           # HMAC token generation
│   │   ├── ws_client.ts      # WebSocket client + proxy + reconnect
│   │   └── request_builder.ts # Request construction + contract validation
│   ├── render/
│   │   ├── progress.ts       # Progress display (concise)
│   │   └── final.ts          # Final result display + error rendering
│   ├── net/
│   │   └── proxy.ts          # HTTP/WS proxy agent builder
│   ├── contracts/
│   │   └── validate.ts       # Contract validation (fail-closed)
│   └── util/
│       ├── idempotency.ts    # ID generation
│       ├── throttle.ts       # Slack update throttling
│       └── errors.ts         # Error sanitization + logging
├── tests/
│   ├── smoke.spec.ts         # Integration tests
│   ├── proxy.spec.ts         # Proxy agent tests
│   ├── throttle.spec.ts      # Throttle tests
│   ├── contract.spec.ts      # Contract validation tests
│   └── errors.spec.ts        # Error handling tests
└── README.md
```

## Production Hardening (PR#4)

### Proxy Support

The proxy respects standard environment variables (`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`).

**Verification:**

```bash
# Check proxy configuration on startup
export HTTP_PROXY=http://proxy.corp:8080
export HTTPS_PROXY=http://proxy.corp:8080
export NO_PROXY=localhost,127.0.0.1

npm start
# Look for: [Proxy] HTTP agent configured for ... via proxy.corp:8080
# Look for: [Proxy] WS agent configured for ... via proxy.corp:8080
```

### Slack Update Throttling

Prevents Slack API rate limits (429) by throttling message updates:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `SLACK_UPDATE_MIN_INTERVAL_MS` | 900 | Minimum ms between updates |
| `SLACK_PROGRESS_STEP` | 10 | Progress delta threshold (%) |
| `SLACK_MAX_UPDATES_PER_JOB` | 30 | Hard limit per job |

**Throttle Rules (priority order):**

1. Always pass `complete` / `error` chunks
2. Block if max updates reached
3. Pass on phase change
4. Block if within min interval
5. Pass if progress crosses step boundary
6. Pass if 2x min interval elapsed

### Rate Limit Backoff (429)

Slack API calls automatically retry on 429 with exponential backoff:

- Max retries: 3
- Respects `Retry-After` header from Slack
- Default backoff: 1s → 2s → 4s (capped at 30s)

### WebSocket Resilience

WebSocket connections to LiYe Gateway include:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `WS_RECONNECT_MAX` | 3 | Max reconnect attempts |
| `WS_RECONNECT_BASE_DELAY_MS` | 500 | Base delay (exponential) |

**Reconnect behavior:**

- On connection failure: exponential backoff (500ms → 1s → 2s)
- Preserves `trace_id` across reconnects
- Notifies user via Slack message: "🔄 Reconnecting... (1/3)"

### Contract Validation (Fail-Closed)

All requests and responses are validated against JSON schemas:

- **GovToolCallRequestV1**: Validated before sending to Gateway
- **StreamChunkV1**: Validated on receipt from Gateway

Invalid data causes immediate failure with error message to user.

### Log Sanitization

Sensitive data is automatically redacted from logs:

- Slack tokens (`xoxb-*`, `xoxp-*`, `xapp-*`)
- AWS credentials (`AKIA*`)
- Bearer tokens, API keys, passwords
- URLs with credentials (`:password@` → `[REDACTED]@`)

## Slack App Setup

1. Create a new Slack App at https://api.slack.com/apps
2. Enable Socket Mode under "Socket Mode"
3. Generate App-Level Token with `connections:write` scope
4. Add Bot Token Scopes:
   - `app_mentions:read`
   - `chat:write`
   - `im:history`
   - `im:read`
   - `im:write`
   - `reactions:read`
   - `reactions:write`
5. Install app to workspace
6. Copy Bot Token and App Token to `.env`

## Troubleshooting

### Connection Issues

```bash
# Check LiYe Gateway health
curl http://localhost:3211/health

# Check AGE health
curl http://localhost:8765/health
```

### WebSocket Reconnect Failures

If you see repeated "🔄 Reconnecting..." messages:

- Check network connectivity to Gateway
- Verify `LIYE_GATEWAY_WS` URL is correct
- Increase `WS_RECONNECT_MAX` if network is unstable

### Proxy Issues

```bash
# Verify proxy environment
env | grep -i proxy

# Test proxy connectivity
curl -x $HTTP_PROXY https://slack.com

# Bypass proxy for local services
export NO_PROXY=localhost,127.0.0.1,gateway.local
```

### Rate Limit (429) Errors

If updates are being dropped:

- Increase `SLACK_UPDATE_MIN_INTERVAL_MS` (e.g., 1500)
- Decrease `SLACK_MAX_UPDATES_PER_JOB` (e.g., 20)
- Check console for "Slack rate limited, retrying" messages

### Contract Validation Errors

If you see "Contract validation failed":

- Check that Gateway returns valid `StreamChunkV1` format
- Verify `policy_version` matches expected pattern (`phaseN-vX.Y.Z`)
- Use `trace_id` to query Gateway for detailed error

### Message Not Updating

- Check Slack API rate limits
- Verify bot has `chat:write` permission
- Check console logs for errors (sensitive data is redacted)

### Authentication Errors

- Ensure `LIYE_HMAC_SECRET` matches Gateway config
- Check token timestamp (max 5 minutes old)

## License

Apache-2.0
