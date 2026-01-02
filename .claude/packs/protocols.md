# Context Pack: Protocols (Collaboration/Delivery Protocols)

**Loading Conditions:** Load when tasks involve "multi-person/multi-model/multi-agent collaboration", delivery standards, quality gates, or retrospective processes.

## Collaboration Principles

### Claude's Role Positioning

**Strengths:**
- Orchestration and scheduling
- File system operations (read/write, reorganize, refactor)
- Quality gates (check, validate, ensure consistency)
- Integration and implementation (turn plans into executable code)
- Context management (load relevant Packs, Skill documents)

**Not suited for (should delegate):**
- Large batch repetitive tasks (e.g., processing 100+ files)
- Super-large context summaries (e.g., reading 50 papers at once)
- Real-time data scraping (should use APIs or crawler tools)

### Multi-Model Collaboration Division

| Model | Position | Typical Tasks | Invocation Method |
|-------|----------|---------------|-------------------|
| **Claude Sonnet** | Orchestrator | Crew design, quality gates, file operations | Primary control |
| **Claude Opus** | Deep thinking | Complex strategy design, architecture decisions | Claude invokes (key decision points) |
| **Gemini 2.0 Flash** | Large context | 50+ literature summaries, large-scale data analysis | Claude delegates (batch tasks) |
| **GPT-4** | Tool calling | API calls, structured output | Claude delegates (precise format) |
| **Gemini 2.0 Flash Thinking** | Complex reasoning | Multi-step logic chains, mathematical proofs | Special tasks |

**Collaboration Flow Example:**

```
User: Analyze Amazon Q4 advertising data and generate optimization plan

Claude (Sonnet):
  1. Understand requirements → Break down tasks
  2. Load .claude/packs/operations.md
  3. Design Crew: DataCollector → Analyzer → Strategist → Reporter
  4. Delegate to Gemini: Batch process 100+ ad groups' data
  5. Invoke Opus: Design optimization strategy (key decision)
  6. Self-execute: Generate report, archive to Artifacts_Vault
  7. Quality check: Verify data completeness, format correctness
  8. Deliver: Show results to user + archive path
```

## Output Contracts (Most Important)

### Deliverable Standards

**Every delivery must include 5 elements:**

1. **Objective**
   ```
   What task? Why? What is the definition of success?
   ```

2. **Input**
   ```
   Data sources, config files, dependency file paths
   ```

3. **Steps**
   ```
   Detailed execution process (reproducible)
   ```

4. **Output**
   ```
   Final file path, format, size
   ```

5. **Risk & Rollback**
   ```
   Potential issues, how to rollback, backup location
   ```

### Deliverable Example

```markdown
# Amazon Listing Optimization Report

## Objective
Optimize Timo Canada ASIN B0XXX Listing, target: improve CTR 10%, CVR 5%

## Input
- Data source: `Systems/amazon-growth-os/data/inputs/campaign_report_20240115.csv`
- Config: `Systems/amazon-growth-os/config/optimization.yaml`
- Reference: `Skills/02_Operation_Intelligence/amazon-keyword-analysis/templates/listing_template.md`

## Steps
1. Data loading: Read ad report (2024-01-01 to 2024-01-15)
2. Keyword analysis: Extract CTR Top 10 and CVR Top 10
3. Competitor benchmarking: Analyze top 3 competitors' Listings
4. Generate recommendations: Title, bullets, A+ content optimization
5. Archive output: Save to Artifacts_Vault

## Output
- Report: `Artifacts_Vault/by_project/timo_canada_q4/listing_optimization_20240120.md`
- Data attachment: `Artifacts_Vault/by_project/timo_canada_q4/data/keyword_analysis.csv`

## Risk & Rollback
- Risk: Optimization may affect existing rankings (recommend A/B testing)
- Rollback: Original Listing screenshot saved at `Artifacts_Vault/.../backup/`
- Backup: Raw data backed up to `~/data/amazon_reports/backup_20240120/`
```

### Prohibited Patterns

**❌ Not allowed: Giving conclusions without implementation**
```
User: Optimize this Listing
Claude: I suggest you optimize the title, increase keyword density...

Problem: No specific suggestions, no file output, not traceable
```

**✅ Correct approach:**
```
User: Optimize this Listing
Claude:
  1. Read current Listing (Tools/Read)
  2. Analyzed keywords (TES framework)
  3. Generated optimization plan (Tools/Write → Artifacts_Vault/...)
  4. Please see: [file path]
```

## Quality Gates

### Pre-commit Checklist

```bash
# Automatic check (pre-commit hook)
node .claude/scripts/guardrail.mjs

# Manual checklist
- [ ] CLAUDE.md ≤ 10,000 chars
- [ ] Each Pack ≤ 15,000 chars
- [ ] .env files in .gitignore
- [ ] Data files moved out of repo (or in .gitignore)
- [ ] Artifacts have complete metadata (date, source, input/output)
- [ ] Commit messages follow Conventional Commits
```

### Code Quality Standards

**Python (Amazon Growth OS):**
```bash
# Linting
black src/
flake8 src/

# Type checking
mypy src/

# Tests
pytest tests/
```

**JavaScript (Notion Sync):**
```bash
# Linting
eslint tools/notion-sync/

# Tests
npm test
```

### Documentation Completeness

**Every Skill must have:**
- [ ] `README.md` (quickstart)
- [ ] `skill_definition.md` (core definition)
- [ ] `methods.md` (methodology details)
- [ ] `templates/` (at least 1 template)

**Every System must have:**
- [ ] `README.md` (installation and usage)
- [ ] `.env.example` (environment variable template)
- [ ] `requirements.txt` or `package.json` (dependencies)

## Retrospective Process (Evolution Loop)

### Trigger Conditions

**Must retrospect:**
- Project completed (delivered)
- Major failure (ACoS >20% over target, system error causing data loss, etc.)
- New method validation (A/B test results)

**Optional retrospect:**
- Monthly regular (monthly review)
- User feedback (suggestions/complaints)

### Retrospective Template

```markdown
# Retrospective Report: [Project Name]

## Basic Info
- Project: Timo Canada Q4 Launch
- Duration: 2024-01-01 to 2024-01-20
- Goal: New product breakout, reach 50 daily sales
- Actual: 45 daily sales (90% achieved)

## Success Factors (Keep)
1. Keyword strategy: TES framework effective, quickly filtered high-converting words in test phase
2. Ad structure: Auto + manual combination, broad coverage
3. Data dashboard: Real-time monitoring, quick response

## Failure Lessons (Problem)
1. Inventory management: Stockout for 2 days on day 10, lost sales
2. Competitor monitoring: Didn't notice competitor price drop in time, lost traffic
3. Listing optimization: A+ content went live 1 week late

## Improvement Plans (Try)
1. Inventory alert: Set safety stock threshold (14 days of sales)
2. Competitor crawler: Daily auto-fetch top 5 competitors' prices
3. Listing SOP: Must complete all content 7 days before launch

## Knowledge Archive
- Method update: `Skills/.../methods.md` add "Inventory Management Best Practices"
- Template update: `Skills/.../templates/launch_checklist.md` add inventory check items
- Case archive: `Artifacts_Vault/by_project/timo_canada_q4/retrospective.md`
```

### Knowledge Archival Process

```
1. Artifacts (Deliverables)
   ↓
2. Retrospective
   ↓
3. Insights (Extract insights)
   ↓
4. Methods Update
   ↓
5. Template Enrichment
   ↓
6. Knowledge Graph
```

**Specific Operations:**

```bash
# 1. Archive Artifacts
mv reports/listing_optimization_20240120.md Artifacts_Vault/by_project/timo_canada_q4/

# 2. Write retrospective
vim Artifacts_Vault/by_project/timo_canada_q4/retrospective.md

# 3. Update Methods
vim Skills/02_Operation_Intelligence/amazon-keyword-analysis/methods.md
# Add: "Inventory Management Best Practices" section

# 4. Update Templates
vim Skills/02_Operation_Intelligence/amazon-keyword-analysis/templates/launch_checklist.md
# Add: Inventory alert setup steps

# 5. Commit changes
git add -A
git commit -m "feat(amazon-keyword): add inventory management best practices from Timo Q4 project"
```

## Collaboration Protocols (Multi-person Scenarios)

### Role Definitions

| Role | Responsibilities | Permissions |
|------|-----------------|-------------|
| **Architect** | Architecture design, technical decisions | Modify _meta/, .claude/, core documents |
| **Operator** | Execute operations tasks, data analysis | Modify Systems/, Projects_Engine/ |
| **Researcher** | Research analysis, knowledge archival | Modify Skills/, Artifacts_Vault/ |
| **Reviewer** | Quality review, merge PRs | Approve all changes |

### Branch Strategy

```
main              # Main branch (stable version)
├── develop       # Development branch
│   ├── feature/amazon-bid-optimizer
│   ├── feature/notion-sync-v2
│   └── fix/keyword-analysis-bug
└── hotfix/       # Emergency fixes
```

### Pull Request Checklist

```markdown
## PR Title
feat(notion-sync): add bidirectional sync with conflict resolution

## Description
Add bidirectional sync feature, supports conflict detection and resolution strategies (ask/local-wins/notion-wins)

## Changes
- [ ] Added `scripts/sync.js`
- [ ] Updated `README.md` documentation
- [ ] Added unit tests
- [ ] Passed Guardrail checks

## Testing
- [x] Local testing passed
- [x] Tested with real Notion database
- [ ] Multi-person collaboration scenario testing (pending)

## Checklist
- [x] Code follows naming conventions
- [x] No sensitive data (.env gitignored)
- [x] Documentation updated
- [x] Guardrail check passed
```

## Emergency Response

### Issue Severity Levels

| Level | Definition | Response Time | Example |
|-------|------------|---------------|---------|
| **P0** | System crash, data loss | Within 1 hour | Database corruption, API key leak |
| **P1** | Core function unavailable | Within 4 hours | Notion sync failed, ad system stopped |
| **P2** | Function impaired but workaround exists | Within 1 day | Partial data missing, performance degradation |
| **P3** | Minor issues, optimization needs | Within 1 week | UI optimization, documentation errors |

### Rollback Strategy

**Git Rollback:**
```bash
# View recent commits
git log --oneline -10

# Rollback to specific commit
git reset --hard <commit-hash>

# If already pushed, need force push (caution!)
git push origin --force
```

**Data Rollback:**
```bash
# Restore from backup
cp ~/data/amazon_reports/backup_20240120/*.csv Systems/amazon-growth-os/data/inputs/

# Re-sync from Notion
cd tools/notion-sync
npm run pull -- --force
```

**Config Rollback:**
```bash
# Restore .env (from .env.example)
cp tools/notion-sync/.env.example tools/notion-sync/.env
vim tools/notion-sync/.env  # Reconfigure
```

---

**Char Count:** ~8,500 / 15,000 ✅

<!-- i18n: Chinese display version at i18n/display/zh-CN/packs/protocols.md -->
