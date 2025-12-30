# BMAD → Runtime Boundary Dehydration Specification

**Version**: 2.0
**Date**: 2025-12-30
**Status**: Enforced (Schema + Semantic + CI)

---

## Core Principle

```
DESIGN produces STRUCTURE.
RUNTIME executes STRUCTURE.
METHOD must never execute itself.
```

**Runtime Agent = Deterministic Executor**

It may:
- Execute tasks
- Respect constraints
- Consume structured inputs
- Produce structured outputs

It must never:
- Identify itself as a designer
- Reference a method
- Expose reasoning or planning semantics

---

## Enforcement Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BMAD (Constitution)                       │
│                    Design-time Layer                         │
│                    Roles / Context                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ DEHYDRATION
                            │ (Structure only, no method)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Runtime Layer                             │
│                    src/agents/ src/runtime/                  │
│                    Agents/ (execution only)                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ CI GATES (3-layer)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Schema Validation    (runtime_agent.schema.json)        │
│  2. Semantic Scan        (bmad_semantic_blacklist.txt)      │
│  3. Boundary Check       (constitution-bmad-boundary-gate)  │
└─────────────────────────────────────────────────────────────┘
```

---

## Boundary Rules

### Prohibited in Runtime Layer

| Category | Examples | Why |
|----------|----------|-----|
| Role Identity | `architect`, `analyst`, `planner` as identity | Method vocabulary |
| Method Names | `BMAD`, `BMad`, `meta-architecture` | Design-time concept |
| Reasoning Process | `design decision`, `architecture reasoning` | Not executable |
| Design Phase Semantics | `decide`, `plan`, `reason` | Design-time verbs |
| Metadata Fields | `bmaddata`, `workflow_stage`, `story_template` | Method coupling |

### Allowed in Runtime Layer

| Category | Example | Rationale |
|----------|---------|-----------|
| Capability Labels | `system_decomposition`, `constraint_awareness` | Describes what agent CAN DO |
| Result Structures | `execution_plan.json`, `action_list.yaml` | Design OUTPUT, not METHOD |
| Interface Contracts | `input_schema: task_spec_v1` | Runtime behavior spec |
| Neutral Metadata | `capabilities: [...]`, `limits: [...]` | No method coupling |

---

## Runtime Agent Schema (v1.0)

File: `schemas/runtime_agent.schema.json`

```json
{
  "agent": {
    "name": "string (required)",
    "type": "runtime (required, enum)",
    "capabilities": ["array of strings (required)"],
    "inputs": {
      "schema": "string (required)"
    },
    "outputs": {
      "schema": "string (required)"
    },
    "limits": { /* optional constraints */ },
    "dependencies": ["optional agent list"]
  }
}
```

**Forbidden Fields (enforced by `not.anyOf`):**
- `role` - Identity leakage
- `method` - Method dependency
- `persona` - Identity leakage
- `bmaddata` - Metadata contamination

---

## Semantic Blacklist

File: `governance/bmad_semantic_blacklist.txt`

```
# Direct BMAD references
BMAD
bmad
BMad

# Design-time semantics
meta-architecture
design reasoning
planning phase
architecture decision
step-by-step reasoning

# Method dependency markers
bmad-method
bmaddata
workflow_stage
story_template
```

---

## Dehydration Transforms

### 1. Identity → Capability

```yaml
# BEFORE (Design)
persona:
  role: "BMAD architect"

# AFTER (Runtime)
agent:
  type: runtime
  capabilities:
    - system_decomposition
    - constraint_awareness
```

### 2. Reasoning → Artifact

```yaml
# BEFORE (Design)
process: "Step-by-step architecture reasoning"

# AFTER (Runtime)
inputs:
  schema: task_spec_v1
outputs:
  schema: execution_result_v1
```

### 3. Method → Contract

```yaml
# BEFORE (Design)
workflow: "Follow BMAD planning workflow"

# AFTER (Runtime)
agent:
  inputs:
    schema: task_spec_v1
  outputs:
    schema: action_list_v1
```

### 4. Semantic Metadata → Removed

```yaml
# BEFORE (Design)
bmaddata:
  workflow_stage: "Planning Phase"
  story_template: "As {role}..."

# AFTER (Runtime)
# Section REMOVED entirely
# No replacement needed
```

---

## CI Enforcement (3-Layer)

### Layer 1: BMAD Boundary Gate

File: `.github/workflows/constitution-bmad-boundary-gate.yml`

**Scope:** `Agents/`
**Check:** No BMAD references in agent definitions

### Layer 2: BMAD Dehydration Guard

File: `.github/workflows/bmad-dehydration-guard.yml`

**Scope:** `src/agents/`, `src/runtime/`
**Checks:**
1. JSON agent schema validation
2. Semantic blacklist scan

### Layer 3: Pre-commit Hook

```bash
# .claude/.githooks/pre-commit
if grep -rn "bmaddata:" Agents/ src/agents/ src/runtime/ 2>/dev/null; then
  echo "ERROR: bmaddata field detected"
  exit 1
fi
```

---

## Leak Classification

| Type | Name | Pattern | Fix Strategy |
|------|------|---------|--------------|
| **A** | Role Identity Leakage | Agent declares BMAD identity | Remove/rename role |
| **B** | Design-Time Vocabulary | "from BMad Method" comments | Remove vocabulary |
| **C** | Method Dependency | Runtime depends on BMAD URI | Remove URI reference |
| **D** | Metadata Contamination | `bmaddata:` field | Remove entire block |

---

## Judgment Rules

```
Any BMAD semantic in:
  - src/agents/
  - src/runtime/
  - Agents/

→ CI FAIL
→ Merge BLOCKED
→ Must dehydrate before merge
```

---

## Incident Log

| Date | Incident | Files | Resolution |
|------|----------|-------|------------|
| 2025-12-30 | 13 BMAD leaks in Agents/ | See `docs/incidents/2025-12-bmad-boundary/` | Batch dehydration |

---

## Related Documents

- Runtime Agent Schema: `schemas/runtime_agent.schema.json`
- Semantic Blacklist: `governance/bmad_semantic_blacklist.txt`
- Architecture Constitution: `_meta/docs/ARCHITECTURE_CONSTITUTION.md`
- Incident Report: `docs/incidents/2025-12-bmad-boundary/leaks_index.md`

---

## Metaphor

```
BMAD = Constitution (what we believe)
Runtime = Citizens (what we execute)
CI Gates = Courts (enforcement)

Citizens cannot rewrite the constitution.
Citizens can only execute within constitutional bounds.
Courts block any citizen that claims constitutional authority.
```

---

*Enforced by: 3-layer CI gate system*
*Owner: Architecture Team*
*Version: 2.0 (Schema + Semantic enforcement)*
