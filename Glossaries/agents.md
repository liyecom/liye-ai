# Agents Glossary

Terminology for LiYe AI agents and multi-agent systems.

---

## Core Concepts

### Agent
**Definition**: An autonomous unit that can perceive, decide, and act.

**Composition**:
```
Agent = Persona + Skills + Runtime
```

**Example**: Market Analyst agent with research skills running sequentially.

---

### Persona
**Definition**: The identity and behavioral profile of an agent.

**Components**:
- **Role**: What position the agent fills
- **Goal**: Primary objective
- **Backstory**: Context that shapes behavior
- **Communication Style**: How the agent expresses itself

**Source**: BMad Method

---

### Skill
**Definition**: A discrete capability that an agent can use.

**Types**:
| Type | Description | Example |
|------|-------------|---------|
| Atomic | Single-purpose | `web_search` |
| Composite | Combined skills | `systematic_review` |

**Source**: Skill Forge

---

### Runtime
**Definition**: Execution configuration for an agent.

**Properties**:
- `process`: Execution pattern (sequential/hierarchical/parallel)
- `memory`: Whether to maintain context
- `delegation`: Can pass tasks to others
- `max_iterations`: Execution limit
- `timeout`: Time limit

**Source**: CrewAI

---

## Multi-Agent Concepts

### Crew
**Definition**: A coordinated team of agents working toward a shared goal.

**Structure**:
```yaml
crew:
  agents: [lead, members...]
  process: hierarchical
  goals: [primary, secondary...]
```

---

### Delegation
**Definition**: An agent passing a subtask to another agent.

**Requirements**:
- `delegation: true` in agent runtime config
- Target agent must have required skills
- Orchestrator must permit delegation

---

### Memory Types

#### Short-Term Memory
**Definition**: Context that persists within a single execution.

#### Long-Term Memory
**Definition**: Learned patterns that persist across executions.

#### Entity Memory
**Definition**: Knowledge about specific entities (people, projects, etc.).

---

## Agent Roles

### Lead
**Definition**: Agent that coordinates crew activities.

**Responsibilities**:
- Task decomposition
- Agent assignment
- Progress monitoring
- Final decisions

---

### Member
**Definition**: Standard crew participant.

**Responsibilities**:
- Execute assigned tasks
- Report progress
- Collaborate with team

---

### Specialist
**Definition**: Agent with deep expertise in specific domain.

**Characteristics**:
- Focused skill set
- High accuracy in domain
- Called for specific tasks

---

## Execution Patterns

### Sequential Process
**Definition**: Agents execute one after another.

**Use When**: Tasks have dependencies, order matters.

### Hierarchical Process
**Definition**: Lead coordinates, delegates to members.

**Use When**: Complex tasks requiring coordination.

### Parallel Process
**Definition**: Agents execute simultaneously.

**Use When**: Independent subtasks, speed critical.

---

## Evolution

### Agent Evolution
**Definition**: System for agents to improve over time.

**Learns From**:
- Execution logs
- User feedback
- Success/failure patterns

**Storage**: `.liye/evolution/{agent_id}/`

---

## Guardrails

### Acceptance Criteria
**Definition**: Metrics that determine task success.

```yaml
acceptance_criteria:
  - metric: completion_rate
    threshold: 0.95
```

### Guardrail Rules
**Definition**: Constraints that prevent harmful actions.

```yaml
guardrails:
  max_change_magnitude: 0.20
  require_review: true
```
