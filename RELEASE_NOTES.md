# LiYe AI v3.1.0 Release Notes

> **First Public Release** | 2025-12-27

## What is LiYe AI?

LiYe AI is a modular, self-evolving AI system that combines three open-source frameworks into a unified four-layer architecture:

- **BMad Method** → Methodology & Personas (WHY)
- **CrewAI** → Execution Runtime (HOW)
- **Skill Forge** → Capability Composition (WHAT)

**Core Innovation**: `Agent = Persona + Skills + Runtime`

---

## Highlights

### Four-Layer Architecture

```
┌─────────────────────────────────────────┐
│ Domain Layer   — Business Logic         │
├─────────────────────────────────────────┤
│ Skill Layer    — Capability Units       │
├─────────────────────────────────────────┤
│ Runtime Layer  — Execution Engine       │
├─────────────────────────────────────────┤
│ Method Layer   — Personas & Workflows   │
└─────────────────────────────────────────┘
```

### Three Production Domains

| Domain | Type | Description |
|--------|------|-------------|
| **amazon-growth** | Application | 9 agents for Amazon product lifecycle |
| **medical-research** | Application | GRADE-based evidence synthesis |
| **geo-os** | Core | Knowledge extraction engine |

### Working CLI

```bash
npx liye-ai status      # System status
npx liye-ai agent list  # List all agents
npx liye-ai skill list  # List all skills
```

---

## What's Included

### Method Layer
- 12 standard personas (PM, Architect, Developer, QA, etc.)
- 4 workflow DSLs (analyze, plan, full-cycle, amazon-launch)
- Evolution protocol specification

### Runtime Layer
- Agent Executor with multi-mode execution
- DAG Scheduler for task dependencies
- Context Memory with history tracking

### Skill Layer
- 4 atomic skills (market_research, competitor_analysis, keyword_research, content_optimization)
- Skill Registry with auto-registration
- Skill Loader with caching

### Domain Layer
- amazon-growth: 9 agents, 4 domain skills, 2 workflows
- medical-research: 5 agents, 2 domain skills, 1 workflow
- geo-os: Knowledge processing pipeline
- Domain Registry for management

---

## Quick Start

```bash
# Clone
git clone https://github.com/liye-ai/liye-ai.git
cd liye-ai

# Install
npm install

# Run
node cli/index.js status
```

---

## Acknowledgements

This project builds upon:

- [BMad Method](https://github.com/bmad-code-org/BMAD-METHOD) (Apache 2.0)
- [CrewAI](https://github.com/joaomdmoura/crewAI) (MIT)
- [Skill Forge](https://github.com/anthropics/agent-skills) (MIT)

---

## What's Next

- [ ] Workflow execution engine
- [ ] Evolution learning implementation
- [ ] Additional domain examples
- [ ] Documentation site

---

## License

Apache 2.0

---

**Full Changelog**: Initial Release
