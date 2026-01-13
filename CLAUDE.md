# CLAUDE.md (Kernel)

This file is the **startup router / minimal resident context** for LiYe OS. Do not put long SOPs, protocols, or complete skill documentation here.
Load `.claude/packs/` on demand when details are needed, or use the assembler to generate `.claude/.compiled/context.md`.

## Repo Root
- Repo: `~/github/liye_os`
- Claude execution directory: Use the currently opened repo (do not rely on CLAUDE.md under ~)

## Most Used Commands (Top)

### Notion Sync (run from repo root)

```bash
# Test Notion connection
node tools/notion-sync/notion-test.js

# Analyze Notion content
node tools/notion-sync/analyze-notion-content.js

# Daily sync
node tools/notion-sync/notion-daily-sync.js

# Use new scaffold (pull/push/diff)
cd tools/notion-sync
npm run pull    # Pull from Notion to local
npm run push    # Push local to Notion
npm run diff    # View differences
```

**Environment Configuration:**
- `tools/notion-sync/.env` requires `NOTION_API_KEY` and `NOTION_DATABASE_ID`
- Refer to `tools/notion-sync/.env.example` for configuration
- Ensure `.env` is in .gitignore

### Generate Task Context (Recommended)

```bash
# Auto-load relevant Packs based on task
node .claude/scripts/assembler.mjs --task "Optimize Amazon Listing"

# Then have Claude read the compiled context:
# Read .claude/.compiled/context.md
```

### File System Governance

```bash
# Check if CLAUDE.md and Packs exceed limits
node .claude/scripts/guardrail.mjs

# View governance documentation
cat _meta/docs/FILE_SYSTEM_GOVERNANCE.md
```

## On-Demand Pack Loading (Key Rules)

| Task Type | Which Pack to Load | Trigger Keywords |
| --------- | ------------------ | ---------------- |
| Amazon/Cross-border/Operations/Keywords/PPC | `.claude/packs/operations.md` | amazon, asin, ppc, listing |
| Medical Research/Evidence-based/Clinical/Literature/CrewAI | `.claude/packs/research.md` | medical, treatment, drug, clinical, crew |
| Architecture/Notion/PARA/Config/Naming | `.claude/packs/infrastructure.md` | notion, para, architecture, config, sync |
| Multi-agent Collaboration/Responsibilities/Protocols | `.claude/packs/protocols.md` | multi-agent, collaboration, protocol |

**Usage:**
1. **Manual loading**: Directly `Read .claude/packs/operations.md`
2. **Auto loading**: Use Assembler to automatically concatenate based on task keywords

## Core Principles (Guardrails)

### Performance Boundaries
- `CLAUDE.md` <= 10,000 chars (this file)
- Each Pack <= 15,000 chars
- Exceeding limits blocks commits (pre-commit hook)

### Separation of Concerns
- **Kernel (this file)**: Startup routing, common commands, Pack index
- **Packs**: Domain-specific detailed rules (operations, research, infrastructure, protocols)
- **Skills**: Complete skill documentation (10-module standard)
- **Systems**: Executable code systems (amazon_growth_os, notion_sync, etc.)

### Check Commands

```bash
# Run Guardrail check
node .claude/scripts/guardrail.mjs

# If failed, view specific oversized files and simplify
```

## Directory Structure Quick Reference

```
~/github/liye_os/
├── CLAUDE.md              # This file (Kernel)
├── .claude/               # Claude configuration and scripts
│   ├── packs/             # On-demand detailed rules
│   ├── scripts/           # Tool scripts (assembler, guardrail)
│   ├── .compiled/         # Compiled output (not versioned)
│   └── .githooks/         # Git hooks
├── _meta/                 # Metadata and documentation
│   ├── docs/              # Architecture documentation
│   │   ├── ARCHITECTURE_CONSTITUTION.md
│   │   └── FILE_SYSTEM_GOVERNANCE.md
│   └── templates/         # Template library
├── Skills/                # Skill library
├── src/domain/            # Domain implementations
│   └── <domain-name>/     # Domain-specific code (private repos)
├── tools/                 # Tool scripts
│   └── notion-sync/       # Notion sync tool
├── Projects_Engine/       # Project management
└── Artifacts_Vault/       # Artifact archive
```

## Architecture Boundaries (Important)

### LiYe CLI vs LiYe OS

| Concept | Responsibility | Location |
|---------|---------------|----------|
| **LiYe CLI** | Command entry, route commands | `cli/` |
| **LiYe OS** | Capability platform (knowledge + skills + engines) | All other directories |
| **Context Compiler** | Smart context compilation | `.claude/scripts/assembler.mjs` (belongs to OS) |

**Key Boundaries**:
- CLI only parses commands and calls assembler.mjs
- CLI does not compile context, execute Agents, or manage knowledge
- assembler.mjs belongs to OS, not a CLI component

### Runtime != CLI

Note terminology distinction:
- **Runtime** = OS execution engine layer (`src/runtime/`), contains AgentExecutor, MCP
- **CLI** = Command line entry (`cli/`), only does routing
- These are not the same thing

## Quick Start

### First Time Use

```bash
# 1. Install Notion sync dependencies
cd tools/notion-sync
npm install

# 2. Configure environment variables
cp .env.example .env
# Edit .env, fill in NOTION_API_KEY and NOTION_DATABASE_ID

# 3. Test connection
node notion-test.js

# 4. Run Guardrail to ensure compliance
cd ~/github/liye_os
node .claude/scripts/guardrail.mjs
```

### Typical Workflow

```bash
# 1. Before starting a new task, generate context
node .claude/scripts/assembler.mjs --task "your task description"

# 2. Claude reads the compiled context
# Read .claude/.compiled/context.md

# 3. Execute task...

# 4. Check before committing
node .claude/scripts/guardrail.mjs
git add -A
git commit -m "..."
```

## Important Reminders

1. **Do not pollute Kernel**: Add new rules to corresponding Pack, do not write back to this file
2. **Use Assembler**: Let the system auto-load needed Packs, avoid manual maintenance
3. **Follow Guardrails**: Exceeding limits will be blocked by pre-commit hook
4. **Externalize data files**: `.env`, data files, logs, etc. should not be versioned
5. **Keep versioned**: All content in `.claude/` should be in Git (except `.compiled/`)

## Reference Documentation

- Architecture Constitution: `_meta/docs/ARCHITECTURE_CONSTITUTION.md`
- File System Governance: `_meta/docs/FILE_SYSTEM_GOVERNANCE.md`
- Evolution Roadmap: `_meta/EVOLUTION_ROADMAP_2025.md`
- Notion Sync Documentation: `tools/notion-sync/README.md`

---

## Execution Policy: Two-Speed (D) + Traces-First (F1)

### Concepts (plain language)
- **Session** = this chat's temporary cockpit (keep goal/phase/next actions aligned)
- **Track** = long-lived project folder for audit, handoff, governance

### Default Mode
- Start in **Fast Path** unless an active Track is detected.
- Fast Path writes facts to **traces/** only.
- Only after upgrade to **Governed Path**, we curate traces into **memory_brief** (and ADR if needed).

### 3-Strike Protocol (Stop-loss)
- Count **consecutive** failures.
- On the 3rd consecutive failure → enter **Recovery Mode** and auto-upgrade to **governed**.

### Upgrade Triggers (Fast → Governed)
- consecutive_errors >= 3 (3-strike)
- multi-session continuation / PR / handoff / publication
- new terminology / new constraints / decisions requiring ADR

### Hook Setup (Project settings)
> Do NOT commit your `.claude/settings.local.json`.
Use Claude Code `/hooks` to register commands below (project scope).

**Recommended hooks**
- SessionStart → ensure memory_state + session plan (no Track)
- UserPromptSubmit (fallback alignment) → pre_tool_check
- PreToolUse → pre_tool_check (best-effort; may be flaky in some versions)
- PostToolUse → pre_tool_check --post (to update counters / strike)
- Stop → stop_gate (completion gate)

**Commands**
```bash
node "$CLAUDE_PROJECT_DIR/.claude/scripts/pre_tool_check.mjs"
node "$CLAUDE_PROJECT_DIR/.claude/scripts/pre_tool_check.mjs" --post
node "$CLAUDE_PROJECT_DIR/.claude/scripts/stop_gate.mjs"
```

---

**Version**: 2.1
**Last Updated**: 2026-01-13
**Char Count**: ~6,500 / 10,000
**i18n**: English SSOT | Chinese display: `i18n/display/zh-CN/CLAUDE.display.md`
