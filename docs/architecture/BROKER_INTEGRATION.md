# Broker Integration Architecture

> LiYe OS Multi-Broker Unified Access Layer

## Overview

LiYe OS implements a three-plane architecture for AI broker integration:

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTROL PLANE                            │
│                      LiYe CLI                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ mission │  │   ask   │  │ broker  │  │ ingest  │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
└───────┼────────────┼────────────┼────────────┼──────────────┘
        │            │            │            │
        ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│                   EXECUTION PLANE                           │
│                      Brokers                                │
│  ┌─────────┐  ┌─────────┐  ┌───────────┐  ┌─────────┐      │
│  │  Codex  │  │ Gemini  │  │Antigravity│  │ Claude  │      │
│  │  (CLI)  │  │  (CLI)  │  │ (Manual)  │  │  (CLI)  │      │
│  └────┬────┘  └────┬────┘  └─────┬─────┘  └────┬────┘      │
└───────┼────────────┼─────────────┼─────────────┼────────────┘
        │            │             │             │
        ▼            ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│                     DATA PLANE                              │
│                  LiYe OS Context Store                      │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │ events.jsonl  │  │   missions/   │  │  index.json   │   │
│  │  (immutable)  │  │   (outputs)   │  │ (rebuildable) │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Core Principle

> **Context written once, brokers are disposable.**

- Context is stored once, models can be swapped anytime
- Artifacts and evidence are retained, not chat history
- No dependency on any platform's conversation history

## Broker Routing Strategy

### Default Routes

| Command Type | Default Broker | Use Case |
|-------------|----------------|----------|
| `ask` | codex | Text interaction, Q&A |
| `build`, `ship`, `refactor` | claude | Engineering tasks |
| `batch`, `outline`, `summarize` | gemini | Cost-optimized batch processing |
| `research`, `browser` | antigravity | Cross-browser exploration |

### Override

```bash
# Override default broker
liye ask "question" --broker gemini
liye mission new --slug task --broker antigravity
```

## Broker Specifications

### 1. Codex Broker (CLI)

- **Binary**: `codex`
- **Default Model**: `gpt-4.1`
- **Features**:
  - Text interaction
  - Light engineering tasks
  - ChatGPT Web replacement
- **Governance**:
  - Approval: `on-request`
  - Sandbox: `read-only`

### 2. Gemini Broker (CLI)

- **Binary**: `gemini` or `gemini-cli`
- **Default Model**: `gemini-2.5-pro`
- **Features**:
  - Low-cost, high-frequency tasks
  - Batch processing
  - Structured output
- **Governance**:
  - Approval: `on-request`
  - Sandbox: `read-only`

### 3. Antigravity Broker (Manual)

- **Type**: Manual execution
- **Features**:
  - Cross-browser automation
  - Long-chain exploration
  - External tool integration
- **Workflow**:
  1. Generate prompt file
  2. User executes in Antigravity
  3. User saves outputs/evidence
  4. Run `liye mission ingest`

### 4. Claude Broker (CLI)

- **Binary**: `claude`
- **Default Model**: `claude-sonnet-4-20250514`
- **Features**:
  - Engineering tasks
  - Code generation
  - Refactoring
- **Governance**:
  - Full access to codebase
  - Follows CLAUDE.md guidelines

## Governance Rules

### Budget Constraints

All brokers must respect:

```yaml
budget:
  maxSteps: 50          # Maximum execution steps
  maxTokens: 100000     # Maximum token usage
  maxTimeMinutes: 30    # Maximum execution time
```

### Approval Policies

| Policy | Description |
|--------|-------------|
| `none` | No approval required |
| `on-request` | Approval on destructive actions |
| `always` | Approval for every action |

### Sandbox Modes

| Mode | Description |
|------|-------------|
| `read-only` | Can only read files |
| `full-access` | Can read and write files |

## Prohibited Actions

1. **No Web Sync**: Never sync or scrape ChatGPT Web / Gemini Web
2. **No Unlimited Exploration**: All tasks must have budget limits
3. **No Unlogged Actions**: All actions must be logged to events.jsonl

## Event Logging

All broker actions are logged to `events.jsonl`:

```json
{
  "id": "evt_1735660800_a1b2c3d4",
  "ts": "2025-12-31T12:00:00.000Z",
  "type": "start",
  "broker": "codex",
  "model": "gpt-4.1",
  "mission_id": "20251231-1200__amazon__analyze-keywords",
  "objective": "Analyze Amazon keywords",
  "tags": ["amazon"]
}
```

## Output Requirements

### Deliverables (Required)

All brokers must write to `outputs/`:

- `answer.md` - Main response
- Additional artifacts as needed

### Evidence (Recommended)

Evidence should be saved to `evidence/`:

- `screenshots/` - Visual proof
- `links.txt` - Referenced URLs
- `steps.md` - Action log
- `recordings/` - Screen recordings

## Usage Examples

### Quick Ask

```bash
# Default: uses codex broker
liye ask "What is the best practice for React hooks?"

# Override to gemini for cost savings
liye ask "Summarize this document" --broker gemini
```

### Full Mission Workflow

```bash
# 1. Create mission
liye mission new --slug "keyword-analysis" --broker codex --project amazon

# 2. Edit context
# Edit data/missions/<id>/context.md

# 3. Run mission
liye mission run <mission-dir>

# 4. Ingest results (if manual)
liye mission ingest <mission-dir>

# 5. View results
liye mission status <mission-dir>
```

### Broker Management

```bash
# List available brokers
liye broker list

# Check broker availability
liye broker check

# View routing strategy
liye broker routes
```

## Cost Governance

### Cost Report Command

```bash
# Generate cost governance report (default: last 7 days)
liye cost report

# Specify time range
liye cost report --days 30
liye cost report --from 2025-12-01 --to 2025-12-31

# Filter by broker/route
liye cost report --broker codex
liye cost report --route ask

# Output formats
liye cost report --format json
```

### Report Metrics

The cost report aggregates from `data/events.jsonl`:

| Metric | Description |
|--------|-------------|
| Success Rate | `ok / (ok + fail + needs_manual)` |
| Needs Manual Rate | Broker availability risk indicator |
| Avg Runtime | Average execution time per broker/route |
| Error Code Distribution | Top errors (BROKER_NOT_INSTALLED, AUTH_REQUIRED, etc.) |
| Dangerous Action Blocks | FORBIDDEN_ACTION count |

### Actionable Recommendations

The report generates rule-based recommendations:

- High needs_manual rate → Check broker CLI availability
- BROKER_NOT_INSTALLED → Install missing CLIs
- AUTH_REQUIRED → Configure authentication
- FORBIDDEN_ACTION → Review prompts for policy violations
- Slow runtime → Optimize prompts or use faster models

### Report Storage

Reports are saved to: `reports/cost/<YYYYMMDD>_cost_report.md`

## Auto-Summary (Ingest Enhancement)

When `liye mission ingest` runs and `outputs/answer.md` exists:

1. Generates `outputs/summary.md` (≤10 lines)
2. Prioritizes content from "结论/总结/建议/决策" sections
3. Logs artifact event with `artifact_kind: "summary"`

### Summary Rules (Deterministic)

- Max 10 lines, each ≤120 characters
- Header: `> Auto-summary (deterministic) · Generated at <timestamp>`
- Priority: conclusion sections → first N lines of content
- Truncated lines end with `…`

### Rebuilding Summary

Summary is a derived artifact and can be regenerated:

```bash
# Re-run ingest to regenerate summary
liye mission ingest <mission-dir>
```

## Architecture Boundaries

### LiYe CLI (Control Plane)

- Command routing
- Mission pack generation
- Broker selection
- Event logging

### Brokers (Execution Plane)

- Task execution
- Output generation
- Evidence collection

### Context Store (Data Plane)

- Event log (immutable)
- Mission outputs
- Searchable index

---

**Version**: 1.0
**Last Updated**: 2025-12-31
