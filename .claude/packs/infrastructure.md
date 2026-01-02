# Context Pack: Infrastructure (Architecture/Notion/PARA/Configuration)

**Loading Conditions:** Load when tasks involve Notion sync, PARA organization, path configuration, naming conventions, system architecture understanding, MCP server development, or skill creation.

## Skills (from Awesome Claude Skills)

### mcp-builder - MCP Server Builder
**Location:** `Skills/00_Core_Utilities/development-tools/mcp-builder/`
**Reference:** `Skills/06_Technical_Development/index.yaml`

MCP (Model Context Protocol) Server Building Guide:
- MCP server architecture design
- Python/TypeScript implementation guidance
- Tool definition best practices
- Extending LiYe OS MCP ecosystem

**Existing LiYe OS MCP Server References:**
- `src/runtime/mcp/servers/amazon/sellersprite_server.py`
- `src/runtime/mcp/servers/knowledge/qdrant_server.py`

### skill-creator - Skill Creation Guide
**Location:** `Skills/00_Core_Utilities/meta/skill-creator/`
**Reference:** `Skills/99_Incubator/index.yaml`

Complete guide for creating Claude Skills:
- Skill structure design
- SKILL.md writing standards
- LiYe OS three-layer architecture adaptation
- Skill validation and publishing process

---

## Notion Sync System

**Location:** `tools/notion-sync/`

**Architecture:** Node.js + Notion API + Markdown bidirectional sync

### Script Reference

| Script | Purpose | Input | Output |
|--------|---------|-------|--------|
| `notion-test.js` | Test connection | `.env` | Connection status |
| `analyze-notion-content.js` | Analyze content | Database ID | Statistics report |
| `notion-daily-sync.js` | Daily sync | Config file | Sync log |
| `index.js` (new) | CLI tool | Command args | Execution result |
| `scripts/pull.js` | Pull from Notion | Database | Markdown files |
| `scripts/push.js` | Push to Notion | Markdown | Notion Pages |
| `scripts/diff.js` | Compare differences | - | Diff report |

### Configuration Management

**Environment Variables (`.env`):**
```bash
# Notion API
NOTION_API_KEY=<YOUR_NOTION_API_KEY>
NOTION_DATABASE_ID=xxxxx

# Local Path
LOCAL_SYNC_DIR=../Documents/Obsidian Vault

# Sync Behavior
SYNC_INTERVAL_MINUTES=30
AUTO_SYNC_ENABLED=false
CONFLICT_RESOLUTION=ask  # ask | local-wins | notion-wins | merge
```

**Path Configuration (`.paths.config.json`, optional):**
```json
{
  "vaults": {
    "obsidian": "~/Documents/Obsidian Vault",
    "para": "~/Documents/liye_workspace"
  },
  "databases": {
    "skills": "database_id_1",
    "projects": "database_id_2",
    "areas": "database_id_3"
  },
  "output": {
    "logs": "~/github/liye_os/.cache/notion-sync/logs",
    "state": "~/github/liye_os/.cache/notion-sync/state.json"
  }
}
```

### Usage Flow

```bash
cd ~/github/liye_os/tools/notion-sync

# 1. Initial configuration
cp .env.example .env
vim .env  # Fill in NOTION_API_KEY and NOTION_DATABASE_ID

# 2. Install dependencies (if not done)
npm install

# 3. Test connection
node notion-test.js

# 4. View differences
npm run diff

# 5. Pull Notion content
npm run pull

# 6. Push local changes
npm run push

# 7. Force overwrite (use with caution)
npm run pull -- --force
npm run push -- --force
```

### Frontmatter Format

**Notion → Markdown:**
```yaml
---
notion_id: abc123def456
notion_url: https://www.notion.so/...
last_synced: 2024-01-20T10:30:00Z
last_edited_notion: 2024-01-20T09:15:00Z
title: My Page Title
tags:
  - tag1
  - tag2
status: In Progress
---

# Content starts here
...
```

**Markdown → Notion:**
- Determine update vs create based on `notion_id`
- `title` maps to Notion Title property
- `tags`, `status` etc. map to corresponding Notion properties
- Markdown content converts to Notion Blocks

### State Management

**Sync State File (`.cache/sync-state.json`):**
```json
{
  "last_sync": "2024-01-20T10:30:00Z",
  "page_count": 42,
  "pages": [
    {
      "id": "abc123",
      "title": "Page Title",
      "last_edited": "2024-01-20T09:15:00Z"
    }
  ]
}
```

**Note:** `.cache/` directory should be in `.gitignore`

## PARA / Directory Governance

**Principle:** Repo (engineering/system) and Vault (notes) must be separated to avoid tool scanning causing performance collapse

### Physical Isolation

```
~/github/liye_os/           # Git repo (code, config, docs)
~/Documents/Obsidian Vault/  # Obsidian notebook (knowledge management)
~/Documents/liye_workspace/  # PARA workspace (projects, areas)
~/data/                     # Large file storage (datasets, media)
~/vaults/                   # Other vaults (backup, archive)
```

**Connection Methods:**
- Symlinks: Point old paths to new locations (fallback)
- Index files: Maintain index in repo pointing to external vaults
- Bidirectional sync: Notion ↔ Obsidian ↔ LiYe OS (selective)

### PARA Structure

```
~/Documents/liye_workspace/
├── 00 Inbox/              # Collection box
├── 10 Projects/           # Active projects (with clear deadlines)
│   ├── amazon_q4_launch/
│   └── medical_research_xxx/
├── 20 Areas/              # Ongoing areas (no deadlines)
│   ├── Health/
│   ├── Finance/
│   └── Career/
├── 30 Resources/          # Reference materials
│   ├── Templates/
│   ├── Checklists/
│   └── Knowledge_Base/
└── 40 Archive/            # Completed/paused projects
```

**Relationship with LiYe OS Repo:**
- **Projects** → `Projects_Engine/active/` (index)
- **Resources** → `Skills/` (versioned methodology)
- **Archive** → `Artifacts_Vault/` (deliverable archive)

### Large File Strategy

**Problem:** Git is not suitable for large files (>10MB), causing:
- Long clone times
- Wasted storage space
- Low collaboration efficiency

**Solution:**

```bash
# 1. Large files go to ~/data
~/data/
├── shengcai/              # Shengcai materials
├── cancer/                # Cancer domain materials
├── amazon_reports/        # Amazon raw reports
└── medical_papers/        # Medical literature PDFs

# 2. Keep symlinks in Documents (fallback for old paths)
ln -s ~/data/shengcai ~/Documents/shengcai

# 3. Use external links in repo
# Systems/amazon-growth-os/data_external → ~/data/amazon_reports
ln -s ~/data/amazon_reports Systems/amazon-growth-os/data_external
```

**`.gitignore` Configuration:**
```gitignore
# Large files and external data
*.csv
*.xlsx
*.pdf
*.mp4
data_external/
uploads/
```

## Naming and Traceability

### Naming Conventions

**Directory Naming:** lowercase + underscore
```
✅ amazon_growth_os
✅ notion_sync
✅ medical_research_analyst

❌ Amazon-Growth-OS
❌ NotionSync
❌ Medical_Research_Analyst
```

**File Naming:** Descriptive + date stamp (optional)
```
✅ listing_optimization_report_20240120.md
✅ keyword_analysis.py
✅ config.js

❌ report.md
❌ script1.py
❌ file.js
```

**Artifact Naming:** Topic + timestamp + source
```
Artifacts_Vault/by_date/2024/01/
└── amazon_listing_optimization_20240120_claude.md

Artifacts_Vault/by_project/timo_canada_q4/
└── ppc_strategy_optimization_20240115.md
```

### Version Tracking

**Git Commit Messages (Conventional Commits):**
```bash
# Format: <type>(<scope>): <subject>

feat(notion-sync): add diff command to compare local and Notion
fix(amazon-growth-os): correct keyword analysis ACOS calculation
docs(README): update Notion sync configuration guide
chore(gitignore): add .cache and .env to ignore list
refactor(Skills): reorganize 12 domains into 6 active domains
```

**Type Classification:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `chore`: Build/config changes
- `refactor`: Code refactoring
- `test`: Test-related

### Deliverable Traceability

**Every Artifact must include:**
```markdown
---
title: Amazon Listing Optimization Report
date: 2024-01-20
project: Timo Canada Q4
author: Claude Sonnet 4.5
source: ~/github/liye_os/Systems/amazon-growth-os
input: data/inputs/campaign_report_20240115.csv
output: reports/listing_optimization_20240120.md
---

## Background
...

## Analysis Process
...

## Conclusions and Recommendations
...

## Appendix
- Data source: [path]
- Script: [path]
- Dependency versions: [list]
```

## Architecture Documentation Index

**Core Documents:**
- `README.md` - Project overview and quickstart
- `_meta/docs/ARCHITECTURE_CONSTITUTION.md` - Architecture constitution
- `_meta/docs/FILE_SYSTEM_GOVERNANCE.md` - File system governance
- `_meta/EVOLUTION_ROADMAP_2025.md` - Evolution roadmap
- `_meta/DUAL_ENGINE_SUMMARY.md` - Dual engine architecture summary
- `_meta/TRIPLE_ENGINE_ARCHITECTURE.md` - Triple engine architecture design

**Skill Documentation Standard (10 Modules):**
```
Skills/{domain}/{skill_name}/
├── skill_definition.md       # Core definition
├── README.md                 # Quickstart
├── methods.md                # Methodology details
├── templates/                # Template library
├── knowledge_base/           # Knowledge base
├── evolution_log.md          # Evolution log
├── collaboration_protocols.md # Collaboration protocols
├── quality_standards.md      # Quality standards
├── automation_scripts/       # Automation scripts
└── case_studies/             # Case studies
```

## Performance Optimization Tips

**Avoid Repository Bloat:**
1. Regularly check large files: `find . -type f -size +10M`
2. Use `.gitignore` to exclude runtime files
3. Virtual environments (venv, node_modules) not in repo
4. Database files (*.db, *.duckdb) not in repo

**Improve Notion Sync Speed:**
1. Incremental sync: Only process changed pages
2. Batch operations: Combine multiple API requests
3. Cache: Use `.cache/sync-state.json` to avoid reprocessing
4. Concurrency: Use Promise.all to process multiple pages in parallel

**Obsidian Performance:**
1. Keep vault size under <50,000 files
2. Avoid deep nesting (>5 levels)
3. Images/PDFs use external links instead of embedding
4. Regularly archive old content to Archive

---

**Char Count:** ~7,000 / 15,000 ✅

<!-- i18n: Chinese display version at i18n/display/zh-CN/packs/infrastructure.md -->
