# LiYe AI Agents

Agent definitions following the **Three-Part Formula**:

```
Agent = Persona + Skills + Runtime
```

## Directory Structure

```
Agents/
├── README.md           # This file
├── _template.yaml      # Agent definition template
├── core/               # Core system agents
│   ├── orchestrator.yaml
│   ├── researcher.yaml
│   └── analyst.yaml
└── domain/             # Domain-specific agents (symlinks to src/domain/*/agents/)
```

## Agent Specification (v3.1)

Each agent YAML follows this schema:

```yaml
agent:
  id: unique-identifier
  name: Human Readable Name
  version: 1.0.0
  domain: core | skeleton | medical-research | geo

persona:           # Agent Identity
  role: ...
  goal: ...
  backstory: ...

skills:            # WHAT - from Skill Forge
  atomic: [...]
  composite: [...]

runtime:           # HOW - from CrewAI
  process: sequential | hierarchical | parallel
  memory: true | false
  delegation: true | false

liyedata:          # LiYe extensions
  workflow_stage: ...
  acceptance_criteria: [...]

evolution:         # Learning configuration
  enabled: true | false
```

## Core Agents

| Agent | Role | Primary Skills |
|-------|------|----------------|
| `orchestrator` | Task coordination | task_decomposition, agent_selection |
| `researcher` | Information gathering | web_search, document_analysis |
| `analyst` | Data analysis | pattern_recognition, insight_generation |

## Usage

```typescript
import { loadAgent } from '@liye-ai/runtime';

const agent = await loadAgent('core/orchestrator');
await agent.execute(task);
```
