# External Integrations

**Analysis Date:** 2026-04-13

## APIs & External Services

**AI/LLM Providers (via Broker System):**
- OpenAI Codex CLI - Default broker for ask/Q&A tasks
  - Client: CLI binary `codex`
  - Model: `gpt-5.2-thinking` (aliased to `gpt-5.2` for CLI)
  - Config: `config/brokers.yaml`, `src/brokers/codex.js`
- Claude Code CLI - Primary broker for engineering (build/ship/refactor)
  - Client: CLI binary `claude`
  - Model: `claude-sonnet-4-20250514`
  - Config: `config/brokers.yaml`, `src/brokers/claude.js`
- Google Gemini CLI - Cost-optimized batch processing
  - Client: CLI binary `gemini` or `gemini-cli`
  - Model: `gemini-2.5-pro`
  - Config: `config/brokers.yaml`, `src/brokers/gemini.js`
- Antigravity (Manual) - Cross-browser research tasks
  - Type: manual (no CLI)
  - Config: `config/brokers.yaml`, `src/brokers/antigravity.js`

**Google AI Studio (Gemini API):**
- Information Radar uses Gemini API for Chinese summary generation
  - Auth: `GEMINI_API_KEY` (Cloudflare Worker secret)
  - Config: `systems/information-radar/wrangler.toml`

**Anthropic API (Claude):**
- Web Publisher tool uses Anthropic SDK directly
  - SDK: `anthropic` Python package (>=0.40.0)
  - Auth: API key (env var, specific var name in local `.env`)
  - Location: `tools/web-publisher/requirements.txt`

**Notion API:**
- Bidirectional sync between local markdown and Notion databases
  - SDK: `@notionhq/client` ^2.2.15
  - Auth: `NOTION_API_KEY`
  - Database: `NOTION_DATABASE_ID`
  - Location: `tools/notion-sync/`
  - Additional: `notion-to-md` for Notion-to-Markdown conversion

**Slack (Bot Integration):**
- Slack Proxy extension connects Slack to LiYe Gateway
  - SDK: `@slack/bolt` ^3.17.0, `@slack/web-api` ^7.0.0
  - Auth: `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`
  - Connection: Socket Mode (app-level token)
  - Location: `Extensions/slack-proxy/`
  - Connects to: LiYe Gateway via WebSocket (`LIYE_GATEWAY_WS`)

**Product Hunt API:**
- Information Radar ingests Product Hunt data
  - Auth: `PH_ACCESS_TOKEN`
  - Location: `systems/information-radar/wrangler.toml`

**Hacker News (RSS):**
- Information Radar ingests HN front page via RSS
  - URL: `https://hnrss.org/frontpage`
  - No auth required
  - Location: `systems/information-radar/wrangler.toml`

## Data Storage

**Databases:**
- Qdrant (Vector Database)
  - Purpose: Knowledge base semantic search (Amazon advertising strategies, operational guides)
  - Default URL: `http://localhost:6333`
  - Default collection: `amazon_knowledge_base`
  - Embedding model: `all-MiniLM-L6-v2`
  - Client: `qdrant_client` Python package (lazy-loaded)
  - Location: `src/runtime/mcp/servers/knowledge/qdrant_server.py`

- DuckDB (Embedded Analytics)
  - Purpose: Data warehouse for keyword metrics, sales data, analytics
  - Default path: `data/warehouse.duckdb`
  - Mode: read-only by default
  - Client: `duckdb` Python package (lazy-loaded)
  - Location: `src/runtime/mcp/servers/data/duckdb_server.py`

**File Storage:**
- Local filesystem only
- Trace files: `state/traces/`, `data/traces/`
- Evidence packages: `evidence/`
- Runtime state: `state/runtime/`

**Caching:**
- Cloudflare KV (for Workers):
  - `SEEN_ITEMS` - Deduplication store (Information Radar)
  - `PUSH_REGISTRY` - Push channel registry (Information Radar)
  - `TOKEN_CACHE` - OAuth token cache (Information Radar, WeCom)
  - `SIGNAL_STORE` - Signal storage (Information Radar v2.0)
  - `DIGEST_HISTORY` - Digest history (Information Radar v2.0)
  - `IDEMPOTENT_KV` - Idempotency store (WeCom adapter)
  - `NONCE_KV` - Nonce store (WeCom adapter)

## Authentication & Identity

**Auth Provider:**
- Custom HMAC-based service-to-service authentication
  - Implementation: `src/gateway/openclaw/hmac.ts`
  - Secret: `LIYE_HMAC_SECRET` env var
  - Used by: Gateway WebSocket connections, Slack Proxy, WeCom Adapter
  - Method: HMAC-SHA256 with timing-safe comparison

**Enterprise WeChat (WeCom) Auth:**
- OAuth for message verification
  - Credentials: `WECOM_CORPID`, `WECOM_SECRET`, `WECOM_AGENT_ID`
  - Message encryption: `WECOM_TOKEN`, `WECOM_ENCODING_AES_KEY`
  - Location: `examples/wecom/wrangler.toml`

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, etc. detected)

**Logs:**
- Console-based logging (Node.js)
- Python `logging` module to stderr for MCP servers
- Structured trace files written to `data/traces/` and `state/traces/`

**Audit System:**
- Custom deterministic replay verifier (`src/audit/replay/replay.ts`)
- Evidence packages with SHA-256 hashing (`src/audit/evidence/`)
- Governance audit via GitHub Actions (weekly cron: `.github/workflows/governance-audit.yml`)

## CI/CD & Deployment

**Hosting:**
- Cloudflare Workers - Information Radar (`systems/information-radar/`)
- Cloudflare Workers - WeCom Adapter (`examples/wecom/`)
- Vercel - Website hosting (zhangxiang site, `websites/zhangxiang/.vercel/`)

**CI Pipeline:**
- GitHub Actions - 20+ governance gate workflows (`.github/workflows/`)
- Key gates:
  - `security-gate.yml` - Security checks
  - `governance-audit.yml` - Weekly governance audit
  - `contracts-gate.yml` / `contracts_gate.yml` - Contract validation
  - `mcp-federation-ci.yml` - MCP federation tests
  - `layer-dependency-gate.yml` - Architecture layer enforcement
  - `amazon-leak-guard.yml` - Client data leak prevention
  - `memory-gate.yml` / `memory-governance-gate.yml` - Memory system governance
  - `reasoning-assets-gate.yml` - Reasoning asset validation
  - `bundle-gate.yml` - Bundle size/format checks
  - `i18n-gate.yml` - Internationalization checks
  - `trace-governance-gate.yml` - Trace governance
  - `audit-regression-gate.yml` - Audit regression prevention
  - `release.yml` - Release pipeline

## LiYe Gateway (Internal Service)

**OpenClaw Gateway:**
- WebSocket server for agent communication
  - Location: `src/gateway/openclaw/`
  - Entry: `src/gateway/openclaw/server.ts`
  - WS Port: `LIYE_GATEWAY_PORT` (default: 3210)
  - HTTP Port: `LIYE_HTTP_PORT` (default: 3211)
  - Auth: HMAC-based (`LIYE_HMAC_SECRET`)
  - Connects to: AGE Job API (`AGE_BASE_URL`, default: `http://localhost:8765`)

## MCP Servers (Internal)

**Governance MCP Server (Node.js):**
- JSON-RPC 2.0 over stdio
  - Location: `src/mcp/server.mjs`
  - Tools: governance_gate, governance_enforce, governance_verdict, governance_replay
  - Run: `npm run mcp:governance`

**Knowledge MCP Server (Python):**
- JSON-RPC 2.0 over stdio
  - Location: `src/runtime/mcp/server_main.py`
  - Wraps: Qdrant (semantic_search, similar_docs, get_document, list_collections) and DuckDB (execute_query, list_tables)
  - Run: `npm run mcp:knowledge`

## Push/Notification Channels

**WeChat Test Account:**
- Template message push
  - Auth: `WECHAT_APPID`, `WECHAT_SECRET`, `WECHAT_TEMPLATE_ID`
  - Used by: Information Radar

**Enterprise WeChat (WeCom) Bot:**
- Webhook-based push
  - Auth: `WECOM_WEBHOOK_URL`
  - Used by: Information Radar (primary channel)

**PushPlus:**
- Cold backup push channel
  - Auth: `PUSHPLUS_TOKEN`
  - Used by: Information Radar

## Environment Configuration

**Required env vars (by subsystem):**

| Subsystem | Required Env Vars |
|---|---|
| Gateway | `LIYE_HMAC_SECRET` |
| Notion Sync | `NOTION_API_KEY`, `NOTION_DATABASE_ID` |
| Slack Proxy | `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `LIYE_GATEWAY_WS`, `LIYE_HMAC_SECRET` |
| Information Radar | `GEMINI_API_KEY` + at least one push channel secret |
| WeCom Adapter | `WECOM_CORPID`, `WECOM_SECRET`, `WECOM_AGENT_ID`, `WECOM_TOKEN`, `WECOM_ENCODING_AES_KEY`, `LIYE_GATEWAY_URL`, `LIYE_HMAC_SECRET` |
| Site Deployer | `VERCEL_TOKEN` |
| Web Publisher | Anthropic API key |

**Secrets location:**
- Local: `.env` files per sub-package (gitignored)
- Cloudflare: `wrangler secret put` for Workers
- CI: GitHub Actions secrets (`${{ secrets.GITHUB_TOKEN }}`)
- Templates: `.env.example` files provided in each sub-package

## Webhooks & Callbacks

**Incoming:**
- WeCom Adapter receives enterprise WeChat messages via Cloudflare Worker HTTP endpoint (`examples/wecom/`)
- Slack Proxy receives Slack events via Socket Mode (no public endpoint needed)
- Information Radar triggered by Cloudflare cron triggers (every 5 min, daily 23:00 UTC, weekly Monday 00:00 UTC)

**Outgoing:**
- WeChat template messages (Information Radar -> WeChat API)
- WeCom webhook messages (Information Radar -> WeCom bot)
- PushPlus notifications (Information Radar -> PushPlus API)
- Vercel deployment API calls (Site Deployer -> Vercel)
- AGE Job API calls (Gateway -> AGE, `http://localhost:8765`)

## Multi-Agent Broker Architecture

The broker system (`src/brokers/`) provides a unified interface for routing tasks to different AI providers:

```
Task -> Route Config (config/brokers.yaml) -> Broker Selection -> CLI Execution
```

| Route | Broker | Model | Use Case |
|---|---|---|---|
| ask | codex | gpt-5.2-thinking | Text Q&A |
| build/ship/refactor | claude | claude-sonnet-4 | Engineering |
| batch/outline/summarize | gemini | gemini-2.5-pro | Cost-optimized |
| research/browser | antigravity | manual | Web research |

Safety checks run before broker execution via `src/config/safety.js` (forbidden intent scanning).

---

*Integration audit: 2026-04-13*
