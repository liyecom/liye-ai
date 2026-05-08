# Technology Stack

**Analysis Date:** 2026-04-13

## Languages

**Primary:**
- TypeScript 5.x - Core runtime, gateway, orchestrator, audit, skill system (`src/**/*.ts`)
- JavaScript (ESM + CommonJS) - Brokers, config, MCP governance server, Claude scripts (`src/**/*.mjs`, `src/**/*.js`, `.claude/scripts/*.mjs`)

**Secondary:**
- Python 3.13 - MCP servers (knowledge, data), policy engine, CrewAI adapters (`src/runtime/mcp/**/*.py`, `src/runtime/policy/**/*.py`)
- YAML - Agent/Crew definitions, broker config, governance contracts (`Agents/**/*.yaml`, `Crews/**/*.yaml`, `config/*.yaml`)
- Shell (Bash/Zsh) - Utility scripts (`.claude/scripts/*.sh`)

## Runtime

**Environment:**
- Node.js >= 18.0.0 (currently v23.11.0 on dev machine)
- Python 3.13.3 (for MCP servers and policy engine)

**Package Manager:**
- npm (root project)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- No web framework at root level - custom runtime architecture
- Astro 5.x - Website static site generation (`websites/*/package.json`)
- Cloudflare Workers (Wrangler 4.x) - Edge functions for Information Radar and WeCom adapter (`systems/information-radar/`, `examples/wecom/`)

**Testing:**
- Vitest 1.x - Primary test runner for TypeScript/JavaScript (`vitest.config.ts`, `package.json`)

**Build/Dev:**
- TypeScript 5.x compiler (`tsconfig.json`) - Target: ES2022, Module: NodeNext
- tsx 4.x - TypeScript execution without compilation (`devDependencies`)
- Wrangler 4.x - Cloudflare Workers dev/deploy (`systems/information-radar/package.json`)

## Key Dependencies

**Critical (root `package.json`):**
- `ajv` ^8.17.1 + `ajv-formats` ^3.0.1 - JSON Schema validation (governance contracts)
- `ws` ^8.18.0 - WebSocket server for OpenClaw Gateway
- `yaml` ^2.8.2 - YAML parsing for config and agent definitions

**Infrastructure (devDependencies):**
- `typescript` ^5.0.0 - TypeScript compiler
- `tsx` ^4.0.0 - TypeScript execution
- `vitest` ^1.0.0 - Testing
- `fast-glob` ^3.3.3 - File pattern matching
- `glob` ^13.0.0 - Glob patterns
- `js-yaml` ^4.1.1 - YAML parsing (config loader)

**Extension: Slack Proxy (`Extensions/slack-proxy/package.json`):**
- `@slack/bolt` ^3.17.0 - Slack app framework
- `@slack/web-api` ^7.0.0 - Slack Web API client
- `ws` ^8.18.0 - WebSocket client to LiYe Gateway
- `http-proxy-agent` / `https-proxy-agent` - Network proxy support

**Extension: Notion Sync (`tools/notion-sync/package.json`):**
- `@notionhq/client` ^2.2.15 - Notion API client
- `notion-to-md` ^3.1.1 - Notion to Markdown converter
- `gray-matter` ^4.0.3 - YAML frontmatter parsing
- `dotenv` ^16.3.1 - Environment variable loading
- `commander` ^11.1.0 - CLI argument parsing

**System: Information Radar (`systems/information-radar/package.json`):**
- `fast-xml-parser` ^4.3.2 - RSS/XML parsing
- `@cloudflare/workers-types` ^4.x - Cloudflare Worker type definitions
- `wrangler` ^4.58.0 - Cloudflare Workers CLI

**Python dependencies (optional, lazy-loaded):**
- `qdrant-client` - Vector database client (`src/runtime/mcp/servers/knowledge/qdrant_server.py`)
- `duckdb` - Embedded analytics database (`src/runtime/mcp/servers/data/duckdb_server.py`)
- `crewai` 1.7.0 - Multi-agent framework (`src/runtime/requirements.crewai.txt`)
- `anthropic` >=0.40.0 - Claude API client (`tools/web-publisher/requirements.txt`)
- `pyyaml` >=6.0.1 - YAML parsing for Python components
- `httpx` >=0.25.0 - HTTP client for Vercel API (`systems/site-deployer/requirements.txt`)

**Website dependencies (per-site):**
- `astro` ^5.x - Static site framework
- `tailwindcss` ^4.x - CSS utility framework
- `@astrojs/sitemap` ^3.6.0 - Sitemap generation
- `@astrojs/vercel` ^9.0.4 - Vercel deployment adapter (zhangxiang site)

## Configuration

**Environment:**
- Environment variables loaded via `dotenv` in sub-packages
- Root-level `.env` files gitignored; `.env.example` provided per sub-package
- Critical env vars defined per subsystem (see INTEGRATIONS.md)

**Build:**
- `tsconfig.json` - Root TypeScript config (ES2022, NodeNext, strict mode)
- `vitest.config.ts` - Test runner config (excludes Extensions/, websites/)
- `config/brokers.yaml` - Multi-broker routing configuration
- `config/policy.yaml` - Approval/sandbox/safety policy

**TypeScript Configuration (from `tsconfig.json`):**
- Target: ES2022
- Module: NodeNext
- Strict mode: enabled
- Declaration maps: enabled
- Includes: `src/**/*.ts`, `tests/**/*.ts`
- Excludes: `node_modules`, `dist`, `websites`, `examples`, `systems`

## Platform Requirements

**Development:**
- Node.js >= 18.0.0
- Python 3.x (for MCP servers, policy engine, CrewAI)
- npm (package management)
- Optional: Qdrant server (for vector search)
- Optional: Claude Code CLI, Codex CLI, Gemini CLI (for broker system)

**Production/Deployment:**
- Cloudflare Workers (Information Radar, WeCom adapter)
- Vercel (website hosting for zhangxiang site)
- GitHub Actions (CI/CD with 20+ governance gates)

## Sub-Package Architecture

The monorepo contains multiple independent packages with their own `package.json`:

| Sub-Package | Location | Runtime |
|---|---|---|
| Root (liye-ai) | `/` | Node.js |
| Notion Sync | `tools/notion-sync/` | Node.js (ESM) |
| Slack Proxy | `Extensions/slack-proxy/` | Node.js (ESM) |
| Builders | `builders/` | Node.js (ESM) |
| Information Radar | `systems/information-radar/` | Cloudflare Workers |
| WeCom Adapter | `examples/wecom/` | Cloudflare Workers |
| Site Deployer | `systems/site-deployer/` | Python 3 |
| Web Publisher | `tools/web-publisher/` | Python 3 |
| Websites (6+) | `websites/*/` | Astro/Node.js |

---

*Stack analysis: 2026-04-13*
