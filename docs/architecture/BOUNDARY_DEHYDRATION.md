# BMAD → Runtime Boundary Dehydration Specification

**Version**: 1.0
**Date**: 2025-12-30
**Status**: Enforced

---

## Core Principle

```
DESIGN produces STRUCTURE.
RUNTIME executes STRUCTURE.
METHOD must never execute itself.
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

### Allowed in Runtime Layer

| Category | Example | Rationale |
|----------|---------|-----------|
| Capability Labels | `system_decomposition`, `constraint_awareness` | Describes what agent CAN DO |
| Result Structures | `execution_plan.json`, `action_list.yaml` | Design OUTPUT, not METHOD |
| Interface Contracts | `input_schema: task_spec_v1` | Runtime behavior spec |
| Neutral Metadata | `capabilities: [...]`, `limits: [...]` | No method coupling |

---

## Dehydration Transforms

### 1. Identity → Capability

```yaml
# BEFORE (Design)
persona:
  role: "BMAD architect"

# AFTER (Runtime)
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
  - constraints
  - objective
outputs:
  - execution_plan.json
```

### 3. Method → Contract

```yaml
# BEFORE (Design)
workflow: "Follow BMAD planning workflow"

# AFTER (Runtime)
contract:
  input_schema: task_spec_v1
  output_schema: action_list_v1
```

### 4. Semantic Metadata → Neutral Fields

```yaml
# BEFORE (Design)
bmaddata:
  workflow_stage: "Planning Phase"
  story_template: "As {role}..."

# AFTER (Runtime)
# Section removed entirely OR replaced with:
liyedata:
  workflow_stage: "Planning Phase"
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

## Enforcement

### CI Gate

File: `.github/workflows/trace-governance-gate.yml`

```yaml
bmad-boundary:
  name: BMad Boundary Gate
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Check BMAD Boundary
      run: |
        BMAD_COUNT=$(grep -rn "BMAD\|bmad\|BMad" Agents/ src/runtime/ 2>/dev/null | \
          grep -v "analyst\|architect" | wc -l || echo 0)
        if [ "$BMAD_COUNT" -gt 0 ]; then
          echo "BMAD boundary violation detected"
          exit 1
        fi
```

### Pre-commit Hook

```bash
# .claude/.githooks/pre-commit
if grep -rn "bmaddata:" Agents/ 2>/dev/null; then
  echo "ERROR: bmaddata field detected in Agents/"
  exit 1
fi
```

---

## Incident Log

| Date | Incident | Files | Resolution |
|------|----------|-------|------------|
| 2025-12-30 | 13 BMAD leaks in Agents/ | See `docs/incidents/2025-12-bmad-boundary/` | Batch dehydration |

---

## Related Documents

- Architecture Constitution: `_meta/docs/ARCHITECTURE_CONSTITUTION.md`
- Incident Report: `docs/incidents/2025-12-bmad-boundary/leaks_index.md`

---

*Enforced by: bmad-boundary CI gate*
*Owner: Architecture Team*
