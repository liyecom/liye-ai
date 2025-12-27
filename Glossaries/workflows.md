# Workflows Glossary

Terminology for LiYe AI workflows and processes.

---

## Core Concepts

### Workflow
**Definition**: A defined sequence of tasks that accomplish a goal.

**Format**: YAML declaration (Method Layer)

**Example**:
```yaml
workflow:
  id: research-workflow
  phases: [discover, analyze, synthesize]
```

---

### Task
**Definition**: A discrete unit of work within a workflow.

**Properties**:
- `description`: What to accomplish
- `agent`: Who performs it
- `expected_output`: Success criteria
- `dependencies`: Required prior tasks

---

### Phase
**Definition**: A major stage in a workflow.

**Standard Phases (BMad Method)**:
1. **Analyze** - Understand the problem
2. **Plan** - Design the solution
3. **Design** - Detail the approach
4. **Execute** - Implement and deliver

---

### Track
**Definition**: A scale-adapted workflow variant.

**Standard Tracks**:
| Track | Scope | Duration |
|-------|-------|----------|
| Quick | Small tasks | Hours |
| Standard | Regular projects | Days-Weeks |
| Enterprise | Large initiatives | Weeks-Months |

---

## Process Types

### Sequential Process
**Definition**: Tasks execute in order, one at a time.

```
Task A → Task B → Task C
```

**Use When**:
- Output of one task feeds the next
- Order is critical
- Resources are limited

---

### Hierarchical Process
**Definition**: A manager coordinates workers.

```
    Manager
   /   |   \
  A    B    C
```

**Use When**:
- Complex coordination needed
- Tasks need prioritization
- Quality control required

---

### Parallel Process
**Definition**: Multiple tasks execute simultaneously.

```
  ┌→ A ─┐
──┼→ B ─┼→
  └→ C ─┘
```

**Use When**:
- Tasks are independent
- Speed is critical
- Resources available

---

## DAG Concepts

### DAG (Directed Acyclic Graph)
**Definition**: Task dependency graph with no cycles.

**Properties**:
- Directed: Tasks have order
- Acyclic: No circular dependencies
- Graph: Multiple paths possible

---

### Dependency
**Definition**: A task that must complete before another can start.

```yaml
task:
  id: analyze-data
  dependencies: [gather-data, validate-data]
```

---

### Critical Path
**Definition**: Longest sequence of dependent tasks.

**Importance**: Determines minimum workflow duration.

---

## Workflow States

### Pending
**Definition**: Task not yet started.

### In Progress
**Definition**: Task currently executing.

### Blocked
**Definition**: Task waiting on dependencies.

### Completed
**Definition**: Task finished successfully.

### Failed
**Definition**: Task encountered unrecoverable error.

---

## Workflow DSL

### Workflow Definition
**Definition**: YAML schema for declaring workflows.

```yaml
workflow:
  id: workflow-id
  name: Workflow Name
  version: 1.0.0

  phases:
    - id: phase-1
      tasks:
        - id: task-1
          agent: agent-id
          description: What to do
```

---

### Stage Template
**Definition**: Reusable workflow pattern.

**Example**: "Launch: Step 1" defines standard launch activities.

---

### Story Template
**Definition**: User story format for task description.

**Format**: "As {role}, I want to {action} so that {outcome}"

---

## Execution

### Kickoff
**Definition**: Starting a workflow or crew execution.

```typescript
const result = await crew.kickoff({ inputs });
```

---

### Iteration
**Definition**: One cycle through the workflow logic.

**Limit**: `max_iterations` prevents infinite loops.

---

### Timeout
**Definition**: Maximum time allowed for execution.

**Scope**: Can be set at task, agent, or workflow level.

---

## Results

### Output
**Definition**: The deliverable produced by a task or workflow.

### Artifact
**Definition**: A persistent output stored for future reference.

**Location**: `Artifacts_Vault/`

---

## Quality

### Acceptance Criteria
**Definition**: Conditions that must be met for success.

### Quality Gate
**Definition**: Checkpoint that validates output before proceeding.

```yaml
quality_gate:
  checks:
    - completeness >= 0.95
    - accuracy >= 0.90
```
