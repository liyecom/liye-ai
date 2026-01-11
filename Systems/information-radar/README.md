# Information OS

**A domain OS under LiYe OS** for ingesting, filtering, summarizing, and scoring external public information signals.

## Core Positioning (Frozen)

> Information OS is responsible for ingesting, filtering, summarizing, and scoring external public information signals (e.g. Hacker News, Product Hunt).
>
> Information OS does **NOT** make decisions and does **NOT** execute actions.
> It only provides structured, scored signals to other systems.

**Key Principle**: Signal only, no decision.

### Code Quality Red Line

> **Shared utilities must be pure, side-effect free, and domain-agnostic.**

Any code in `src/outputs/push/formatter.ts` or similar utility modules must:
- Be pure functions (same input → same output)
- Have no side effects (no API calls, no storage writes, no logging)
- Be domain-agnostic (no HN/PH specific logic in utilities)

## Architecture

```
systems/information-radar/
├── src/
│   ├── index.ts              # Cloudflare Workers entry
│   ├── sources/              # Data source adapters
│   │   ├── hackernews.ts     # HN via hnrss.org
│   │   └── producthunt.ts    # PH via GraphQL API
│   ├── processors/
│   │   ├── dedup.ts          # Deduplication (CF KV)
│   │   └── summarizer.ts     # Gemini API summarizer
│   ├── outputs/
│   │   └── push/             # Push Subsystem v1.0
│   │       ├── index.ts      # Channel Router
│   │       ├── types.ts      # Type definitions
│   │       ├── token-manager.ts
│   │       ├── registry.ts   # Member registry
│   │       └── channels/
│   │           ├── wechat-test.ts  # Default
│   │           ├── wecom-bot.ts    # Hot backup
│   │           └── pushplus.ts     # Cold backup
│   ├── types.ts              # Core type definitions
│   └── config.ts             # Configuration
├── wrangler.toml             # CF Workers config
├── package.json
└── docs/
    ├── architecture/
    │   └── INFORMATION_OS_PUSH_ARCHITECTURE.md
    └── GEMINI_API_SETUP.md
```

## Push Subsystem v1.0

**核心原则**: 测试号只是默认实现之一，不是系统前提。

### Channel Priority

| Channel | Priority | Status | Description |
|---------|----------|--------|-------------|
| `wechat_test` | 1 | Default | WeChat test account (free, zero risk) |
| `wecom_bot` | 2 | Hot backup | Enterprise WeChat bot |
| `pushplus` | 3 | Cold backup | PushPlus (requires verification) |

### Features

- **Auto failover**: Automatically switch to backup channel on failure
- **Member registry**: KV-based member management (no hardcoded openids)
- **Token caching**: Automatic refresh with 5-min buffer
- **Message batching**: Merge multiple signals into digest

See [Push Architecture Doc](docs/architecture/INFORMATION_OS_PUSH_ARCHITECTURE.md) for details.

## V0 Scope (Frozen)

### Data Sources
| Source | Endpoint | Monitor |
|--------|----------|---------|
| Hacker News | hnrss.org | Frontpage (Top Stories) |
| Product Hunt | GraphQL API | Trending / Top Ranked |

**NOT monitoring**: HN New, PH pure New (avoid noise)

### Capabilities
- [x] New entry detection (polling)
- [x] Deduplication (item_id / url)
- [x] Chinese summary (LLM - Gemini)
- [x] Value score (1-5)
- [x] Multi-channel push with auto failover

### V0 Explicitly NOT Doing
- Multi-source plugin system
- Long-term memory / self-learning
- Auto-decision / auto-execution
- User personalization
- Complex scheduling / workflow

## Output Schema (V0)

```typescript
interface Signal {
  source: "hacker_news" | "product_hunt";
  title: string;
  summary_zh: string;
  value_score: 1 | 2 | 3 | 4 | 5;
  link: string;
  detected_at: string; // ISO-8601
}
```

**Push threshold**: `value_score >= 3`

## Trigger & Frequency

| Platform | Interval | Note |
|----------|----------|------|
| Cloudflare Workers (Cron) | **15 min** | 信息雷达甜点区间 |

> 10 分钟偏激进，30 分钟信息滞后，15 分钟是平衡点。

## Quick Start

### 1. Prerequisites

- Node.js 18+
- Cloudflare account
- Gemini API key ([Get here](https://aistudio.google.com/app/apikey))
- Product Hunt API token ([Get here](https://www.producthunt.com/v2/oauth/applications))
- At least one push channel configured

### 2. Install

```bash
cd systems/information-radar
npm install
```

### 3. Create KV Namespaces

```bash
npx wrangler kv:namespace create SEEN_ITEMS
npx wrangler kv:namespace create PUSH_REGISTRY
npx wrangler kv:namespace create TOKEN_CACHE
# Update wrangler.toml with the IDs
```

### 4. Configure Secrets

```bash
# Required
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put PH_ACCESS_TOKEN

# Push channel (at least one)
npx wrangler secret put WECHAT_APPID
npx wrangler secret put WECHAT_SECRET
npx wrangler secret put WECHAT_TEMPLATE_ID
# OR
npx wrangler secret put WECOM_WEBHOOK_URL
# OR
npx wrangler secret put PUSHPLUS_TOKEN
```

### 5. Local Development

```bash
# Create .dev.vars from .env.example
npm run dev
```

### 6. Deploy

```bash
npm run deploy
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with channel status |
| `/trigger` | POST | Manual trigger |
| `/push/status` | GET | Push channel status |
| `/push/test` | POST | Send test message |

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google AI Studio API key |
| `PH_ACCESS_TOKEN` | Product Hunt API token |

### Push Channels (at least one required)

| Variable | Channel | Description |
|----------|---------|-------------|
| `WECHAT_APPID` | wechat_test | WeChat test account appid |
| `WECHAT_SECRET` | wechat_test | WeChat test account secret |
| `WECHAT_TEMPLATE_ID` | wechat_test | Template message ID |
| `WECOM_WEBHOOK_URL` | wecom_bot | Enterprise WeChat webhook |
| `PUSHPLUS_TOKEN` | pushplus | PushPlus token |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PUSH_CHANNEL_PRIORITY` | wechat_test,wecom_bot,pushplus | Channel priority |
| `PUSH_THRESHOLD` | 3 | Min score to push |
| `MAX_ITEMS_PER_PUSH` | 5 | Max items per message |

## Relationship with Other OS

```
Information OS → Outputs structured signals
                      ↓
GEO OS → Can pull signals as external input (future)
Amazon Growth OS → Can pull signals as market signals (future)
```

**Current**: Interface alignment only, no code coupling.

## Upgrade Trigger (to V1)

Only discuss V1 when ANY of:
- Stable usage >= 30 days
- Team starts "trusting scores by default"
- Clear expansion needs appear

## License

Part of LiYe OS - Internal use only

---

**Version**: 1.0.0
**Push Subsystem**: v1.0
**Created**: 2026-01-09
