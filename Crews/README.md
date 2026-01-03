# LiYe AI Crews

Multi-agent teams that collaborate to accomplish complex tasks.

## Concept

A **Crew** is a coordinated team of agents working together on a shared objective.

```
Crew = Agents[] + Process + Goals + Constraints
```

## Directory Structure

```
Crews/
├── README.md              # This file
├── _template.yaml         # Crew definition template
├── core/                  # Core system crews
│   ├── research-team.yaml
│   └── analysis-team.yaml
└── domain/                # Domain-specific crews
```

## Crew Specification (v3.1)

```yaml
crew:
  id: unique-identifier
  name: Human Readable Name
  version: 1.0.0
  domain: core | skeleton | medical-research

agents:                    # Team members
  - role: lead
    agent_id: orchestrator
  - role: member
    agent_id: researcher

process:                   # Execution strategy
  type: sequential | hierarchical | parallel
  allow_delegation: true

goals:                     # Crew objectives
  primary: "Main objective"
  secondary: [...]

constraints:               # Operational limits
  max_iterations: 10
  timeout: 3600
```

## Core Crews

| Crew | Purpose | Agents |
|------|---------|--------|
| `research-team` | Information gathering & synthesis | orchestrator, researcher, analyst |
| `analysis-team` | Data analysis & insights | analyst, researcher |

## Usage

```typescript
import { loadCrew } from '@liye-ai/runtime';

const crew = await loadCrew('core/research-team');
const result = await crew.kickoff({ topic: 'market trends' });
```
