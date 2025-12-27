# LiYe AI Agent Specification

> **Version**: 3.1 Final
> **Status**: FROZEN
> **Date**: 2025-12-27

---

## 1. Core Formula

```
Agent = Persona (BMad) + Skills (Skill Forge) + Runtime Shell (CrewAI)

┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   WHO       │ + │   WHAT      │ + │   HOW       │
│  Persona    │   │  Skills     │   │  Executor   │
│  ← BMad     │   │← SkillForge │   │  ← CrewAI   │
└─────────────┘   └─────────────┘   └─────────────┘
```

| Component | Source | Responsibility | Example |
|-----------|--------|----------------|---------|
| **Persona** | BMad Method | WHO: Role definition, personality, communication style | "Market analyst, rigorous, data-driven" |
| **Skills** | Skill Forge | WHAT: Executable capability set | `[market_research, competitor_analysis]` |
| **Runtime** | CrewAI | HOW: Execution engine, task scheduling | `sequential` / `hierarchical` |

---

## 2. Agent YAML Structure

```yaml
# Location: src/domain/{domain-name}/agents/{agent-id}.yaml

# === Basic Information ===
agent:
  id: market-analyst           # Unique identifier (kebab-case)
  name: Market Intelligence Analyst
  version: 1.0.0
  domain: amazon-growth        # Parent domain

# === ① Persona Layer (← BMad Method) ===
persona:
  role: "Market Intelligence Analyst"
  goal: "Provide accurate market insights to support product decisions"
  backstory: "10 years of Amazon market analysis experience, skilled in data-driven decision making"
  communication_style: "Rigorous, data-oriented, concise"

# === ② Skills Layer (← Skill Forge) ===
skills:
  atomic:                      # Atomic skills (single capability)
    - market_research
    - competitor_analysis
    - trend_detection
    - pricing_analysis
  composite:                   # Composite skills (skill chains)
    - market_intelligence_report   # = market_research + competitor_analysis

# === ③ Runtime Layer (← CrewAI) ===
runtime:
  process: sequential          # Execution mode: sequential | hierarchical | parallel
  memory: true                 # Enable context memory
  delegation: false            # Can delegate to other agents
  max_iterations: 5            # Maximum iterations
  verbose: false               # Verbose output

# === ④ LiYe Extension ===
liyedata:
  module: amazon-growth
  workflow_stage: "Launch: Step 1"
  story_template: "As {role}, I want to {action} so that {outcome}"

  acceptance_criteria:         # Acceptance criteria
    - metric: market_coverage
      threshold: 0.80
    - metric: data_freshness
      threshold: 7d

  guardrails:                  # Execution constraints
    max_change_magnitude: 0.20
    require_review: true
    timeout: 300s

# === ⑤ Evolution Configuration ===
evolution:
  enabled: true
  storage: .liye/evolution/market-analyst/
  learn_from:
    - execution_logs
    - user_feedback
  graduation_threshold: 0.85
```

---

## 3. Field Specifications

### 3.1 Agent Block (Required)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (kebab-case) |
| `name` | string | Yes | Human-readable name |
| `version` | semver | Yes | Semantic version |
| `domain` | string | Yes | Parent domain name |

### 3.2 Persona Block (Required)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | string | Yes | Agent's role title |
| `goal` | string | Yes | Agent's primary goal |
| `backstory` | string | No | Background story for context |
| `communication_style` | string | No | How the agent communicates |

### 3.3 Skills Block (Required)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `atomic` | string[] | Yes | List of atomic skill IDs |
| `composite` | string[] | No | List of composite skill IDs |

### 3.4 Runtime Block (Required)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `process` | enum | `sequential` | Execution mode |
| `memory` | boolean | `true` | Enable memory |
| `delegation` | boolean | `false` | Allow delegation |
| `max_iterations` | integer | `5` | Max iterations |
| `verbose` | boolean | `false` | Verbose output |

**Process Modes:**
- `sequential`: Tasks run one after another
- `hierarchical`: Manager agent delegates to workers
- `parallel`: Tasks run concurrently

### 3.5 LiYeData Block (Required)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `module` | string | Yes | Module identifier |
| `workflow_stage` | string | Yes | Current workflow stage |
| `story_template` | string | No | Story template |
| `acceptance_criteria` | array | No | Acceptance criteria |
| `guardrails` | object | No | Execution constraints |

### 3.6 Evolution Block (Optional)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable evolution |
| `storage` | string | `.liye/evolution/{id}/` | Storage path |
| `learn_from` | string[] | `[]` | Learning sources |
| `graduation_threshold` | float | `0.85` | Success threshold |

---

## 4. Standard Personas (Method Layer)

The following 12 standard personas are available in `src/method/personas/`:

| ID | Role | Description |
|----|------|-------------|
| `pm` | Product Manager | Defines requirements and priorities |
| `architect` | Architect | Designs system architecture |
| `developer` | Developer | Implements features |
| `qa` | QA Engineer | Ensures quality |
| `devops` | DevOps Engineer | Manages deployment |
| `analyst` | Business Analyst | Analyzes business needs |
| `designer` | Designer | Creates user experience |
| `researcher` | Researcher | Conducts research |
| `writer` | Technical Writer | Creates documentation |
| `reviewer` | Code Reviewer | Reviews code quality |
| `coordinator` | Sprint Coordinator | Orchestrates sprints |
| `guardian` | Quality Guardian | Guards quality gates |

---

## 5. Domain Agent Examples

### 5.1 amazon-growth Domain Agents

| Agent ID | Role | Skills |
|----------|------|--------|
| `market-analyst` | Market Intelligence | `market_research`, `competitor_analysis` |
| `keyword-architect` | Keyword Strategy | `keyword_research`, `seo_optimization` |
| `listing-optimizer` | Listing Optimization | `content_optimization`, `a_plus_content` |
| `ppc-strategist` | PPC Strategy | `campaign_analysis`, `bid_optimization` |
| `diagnostic-architect` | Diagnostic Analysis | `performance_diagnosis`, `root_cause_analysis` |
| `execution-agent` | Task Execution | `task_execution`, `progress_tracking` |
| `quality-gate` | Quality Assurance | `quality_check`, `compliance_validation` |
| `review-sentinel` | Review Management | `review_analysis`, `response_generation` |
| `sprint-orchestrator` | Sprint Management | `sprint_planning`, `task_coordination` |

---

## 6. Validation Rules

### 6.1 Required Checks
- [ ] `agent.id` must be unique within domain
- [ ] `agent.version` must follow semver
- [ ] `persona.role` and `persona.goal` must be non-empty
- [ ] `skills.atomic` must contain at least one skill
- [ ] All referenced skills must exist in Skill Registry

### 6.2 Recommended Checks
- [ ] `persona.backstory` should be provided for context
- [ ] `liyedata.acceptance_criteria` should define success metrics
- [ ] `evolution.enabled` should be true for production agents

---

## 7. Migration Guide

### From Legacy Format

```yaml
# Before (Legacy)
bmaddata:
  workflow_stage: "Launch: Step 1"
  story_template: "As {role}..."

# After (v3.1)
persona:
  role: "..."
  goal: "..."

skills:
  atomic: [...]

runtime:
  process: sequential

liyedata:
  workflow_stage: "Launch: Step 1"
  story_template: "As {role}..."
```

---

**This document is FROZEN as of v3.1 Final (2025-12-27).**
