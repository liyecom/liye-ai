# LiYe AI

> AI-Powered Personal Operating System | 三叉融合架构

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-3.1.0-green.svg)](package.json)

**LiYe AI** is a modular, self-evolving AI system that combines the best of three open-source frameworks:
- **BMad Method** - AI-driven methodology (WHY)
- **CrewAI** - Multi-agent orchestration (HOW)
- **Skill Forge** - Capability composition (WHAT)

---

## Architecture

LiYe AI uses a **four-layer domain-centric architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│ ④ Domain Layer    (WHERE)  — Business Implementation       │
│    amazon-growth, medical-research, geo-os                  │
├─────────────────────────────────────────────────────────────┤
│ ③ Skill Layer     (WHAT)   — Capability Units              │
│    Atomic skills, Composite skills, Registry                │
├─────────────────────────────────────────────────────────────┤
│ ② Runtime Layer   (HOW)    — Execution Engine              │
│    Agent Executor, DAG Scheduler, Memory Manager            │
├─────────────────────────────────────────────────────────────┤
│ ① Method Layer    (WHY)    — Methodology & Personas        │
│    Agent Personas, Workflow DSL, Evolution Protocol         │
└─────────────────────────────────────────────────────────────┘
```

**Key Innovation**: Agent = Persona (BMad) + Skills (Skill Forge) + Runtime (CrewAI)

---

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/liye-ai/liye-ai.git
cd liye-ai

# Install dependencies
npm install

# Run CLI
npx liye-ai status
npx liye-ai agent list
```

### CLI Commands

```bash
# System status
npx liye-ai status

# List agents
npx liye-ai agent list

# List skills
npx liye-ai skill list

# Run workflow (coming soon)
npx liye-ai workflow run amazon-launch
```

---

## Domains

LiYe AI includes three domains:

### Amazon Growth (Application)
Multi-agent system for Amazon product lifecycle management.
- 9 specialized agents (Market Analyst, Keyword Architect, PPC Strategist, etc.)
- 3 workflows (launch, optimize, diagnose)
- Domain-specific skills (TES calculation, ACOS analysis, review sentiment)

### Medical Research (Application)
AI-powered medical research and evidence synthesis.
- 5 agents (Literature Analyst, Evidence Synthesizer, Clinical Advisor, etc.)
- GRADE methodology for evidence grading
- PRISMA-compliant systematic review workflow

### GEO OS (Core Infrastructure)
Knowledge extraction and processing engine.
- Document normalization (PDF, DOCX → Markdown)
- Semantic chunking and structure extraction
- Exports structured `geo_units.json` for consumption

---

## Project Structure

```
liye-ai/
├── src/
│   ├── method/           # ① Method Layer (BMad fork)
│   │   ├── personas/     # 12 standard personas
│   │   ├── workflows/    # Workflow DSL definitions
│   │   ├── phases/       # Phase definitions
│   │   └── evolution/    # Evolution protocol
│   │
│   ├── runtime/          # ② Runtime Layer (CrewAI fork)
│   │   ├── executor/     # Agent executor
│   │   ├── scheduler/    # DAG task scheduler
│   │   └── memory/       # Context memory
│   │
│   ├── skill/            # ③ Skill Layer (Skill Forge fork)
│   │   ├── atomic/       # Single-purpose skills
│   │   ├── composite/    # Skill chains
│   │   ├── registry/     # Skill registration
│   │   └── loader/       # Dynamic loading
│   │
│   └── domain/           # ④ Domain Layer (Original)
│       ├── amazon-growth/
│       ├── medical-research/
│       ├── geo-os/
│       ├── registry.ts   # Domain registry
│       └── index.ts      # Domain exports
│
├── skills/               # Human-readable methodology library
├── cli/                  # CLI entry point
├── docs/                 # Documentation
└── examples/             # Usage examples
```

---

## Core Concepts

### Agents

Agents are defined using a three-in-one YAML format:

```yaml
agent:
  id: market-analyst
  domain: amazon-growth

persona:                      # ← BMad Method
  role: "Market Intelligence Analyst"
  goal: "Provide accurate market insights"
  communication_style: "Data-driven, concise"

skills:                       # ← Skill Forge
  atomic: [market_research, competitor_analysis]
  composite: [market_intelligence_report]

runtime:                      # ← CrewAI
  process: sequential
  memory: true

liyedata:                     # ← LiYe Extensions
  workflow_stage: "Launch: Step 1"
  acceptance_criteria:
    - metric: market_coverage
      threshold: 0.80

evolution:
  enabled: true
```

### Skills

Skills are composable capability units:

```typescript
// Atomic Skill
export const market_research: Skill = {
  id: 'market_research',
  execute: async (input) => { /* ... */ }
};

// Composite Skill (skill chain)
export const market_intelligence: CompositeSkill = {
  chain: [
    { skill: 'market_research', output_alias: 'market_data' },
    { skill: 'competitor_analysis', input_mapping: { data: 'market_data' } }
  ]
};
```

### Workflows

Workflows orchestrate agents and skills:

```yaml
workflow:
  id: amazon-launch
  track: standard

phases:
  - id: research
    agents: [market-analyst, keyword-architect]
    tasks:
      - id: market-analysis
        skill: market_research

  - id: optimize
    depends_on: [research]
    agents: [listing-optimizer]
```

---

## Evolution System

LiYe AI includes a self-evolution mechanism:

- **Decision (Method Layer)**: What to learn, evaluation criteria
- **Execution (Runtime Layer)**: Actual learning, storage, replay
- **Configuration (Domain Layer)**: Enable/disable per domain

```yaml
evolution:
  enabled: true
  learn_from:
    - agent_execution_logs
    - workflow_completion_rate
    - user_feedback_signals
  graduation_threshold: 0.85
```

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Lint
npm run lint
```

---

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgements

LiYe AI builds upon concepts and code from these pioneering projects:

- **[BMad Method](https://github.com/bmad-code-org/BMAD-METHOD)** (Apache 2.0)
  - AI-driven agile development methodology
  - Agent personas and workflow DSL

- **[CrewAI](https://github.com/joaomdmoura/crewAI)** (MIT)
  - Multi-agent orchestration framework
  - Task scheduling and execution runtime

- **[Skill Forge](https://github.com/anthropics/agent-skills)** (MIT)
  - Agent skill creation and management
  - Atomic and composite skill patterns

We gratefully acknowledge these teams for their foundational work.

---

## Links

- **Website**: [liye.ai](https://liye.ai)
- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/liye-ai/liye-ai/issues)

---

*"The system that learns from itself becomes unstoppable."*

**LiYe AI v3.1** | 2025
