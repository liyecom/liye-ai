# LiYe AI Workflow DSL Specification

> **Version**: 3.1 Final
> **Status**: FROZEN
> **Date**: 2025-12-27
> **Layer**: Method Layer (Declaration Only)

---

## 1. Overview

Workflow DSL is the **declarative** language for defining workflows in LiYe AI.

**Key Principle**: Workflows are **declarations**, not **executions**.
- Workflow DSL defines **what** should happen
- Runtime Layer handles **how** it happens

---

## 2. Workflow YAML Structure

```yaml
# Location: src/method/workflows/{workflow-id}.yaml

workflow:
  id: amazon-launch
  name: Amazon Product Launch Workflow
  version: 1.0.0
  track: standard              # quick | standard | enterprise

# Phases (4-Phase Methodology from BMad)
phases:
  - id: analyze
    name: Analyze
    description: Market and competitive analysis
    agents:
      - market-analyst
      - keyword-architect
    tasks:
      - id: market-research
        agent: market-analyst
        skill: market_research
        inputs:
          - product_category
          - target_market
        outputs:
          - market_report

      - id: competitor-analysis
        agent: market-analyst
        skill: competitor_analysis
        depends_on: [market-research]
        inputs:
          - market_report
        outputs:
          - competitor_report

  - id: plan
    name: Plan
    description: Strategy and planning
    depends_on: [analyze]
    agents:
      - keyword-architect
      - ppc-strategist

  - id: design
    name: Design
    description: Listing and content design
    depends_on: [plan]
    agents:
      - listing-optimizer

  - id: execute
    name: Execute
    description: Implementation and launch
    depends_on: [design]
    agents:
      - execution-agent
      - quality-gate

# Transitions
transitions:
  - from: analyze
    to: plan
    condition: "analyze.complete && analyze.quality_score >= 0.8"

  - from: plan
    to: design
    condition: "plan.approved"

  - from: design
    to: execute
    condition: "design.reviewed"

# Guards
guards:
  - phase: execute
    condition: "all_previous_phases.complete"
    action: block
```

---

## 3. Phase Structure

### 3.1 Phase Block

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Phase identifier |
| `name` | string | Yes | Human-readable name |
| `description` | string | No | Phase description |
| `depends_on` | string[] | No | Previous phase dependencies |
| `agents` | string[] | Yes | Agents involved in this phase |
| `tasks` | Task[] | Yes | Tasks in this phase |

### 3.2 Task Block

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Task identifier |
| `agent` | string | Yes | Agent to execute task |
| `skill` | string | Yes | Skill to use |
| `depends_on` | string[] | No | Task dependencies |
| `inputs` | string[] | No | Input data |
| `outputs` | string[] | No | Output data |
| `timeout` | duration | No | Task timeout |

---

## 4. Four-Phase Methodology

Based on BMad Method's 4-phase approach:

| Phase | ID | Purpose | Typical Agents |
|-------|-----|---------|----------------|
| **Analyze** | `analyze` | Research and analysis | analyst, researcher |
| **Plan** | `plan` | Strategy and planning | pm, architect |
| **Design** | `design` | Detailed design | designer, developer |
| **Execute** | `execute` | Implementation | developer, qa |

---

## 5. Track System

| Track | Description | Phase Duration | Review Requirements |
|-------|-------------|----------------|---------------------|
| `quick` | Fast-track for simple changes | 1-2 days | Minimal |
| `standard` | Normal development flow | 1-2 weeks | Standard |
| `enterprise` | Complex projects | 4-8 weeks | Full governance |

---

## 6. Transition Conditions

### 6.1 Syntax

```yaml
condition: "expression"
```

### 6.2 Available Variables

| Variable | Description |
|----------|-------------|
| `{phase_id}.complete` | Phase completion status |
| `{phase_id}.quality_score` | Quality score (0-1) |
| `{phase_id}.approved` | Approval status |
| `{phase_id}.reviewed` | Review status |
| `all_previous_phases.complete` | All previous phases complete |

### 6.3 Operators

| Operator | Description |
|----------|-------------|
| `&&` | Logical AND |
| `||` | Logical OR |
| `!` | Logical NOT |
| `>=`, `<=`, `==` | Comparison |

---

## 7. Guards

Guards prevent phase transitions until conditions are met.

```yaml
guards:
  - phase: execute
    condition: "quality_gate.passed"
    action: block          # block | warn | log
    message: "Quality gate must pass before execution"
```

### 7.1 Guard Actions

| Action | Description |
|--------|-------------|
| `block` | Prevent transition |
| `warn` | Allow with warning |
| `log` | Log and continue |

---

## 8. Standard Workflows

### 8.1 Available in `src/method/workflows/`

| ID | Name | Phases | Track |
|----|------|--------|-------|
| `analyze` | Analysis Only | analyze | quick |
| `plan` | Planning Only | plan | quick |
| `full-cycle` | Full Development | all 4 | standard |
| `amazon-launch` | Amazon Product Launch | all 4 | standard |
| `bug-fix` | Bug Fix Workflow | analyze, execute | quick |
| `feature-add` | Feature Addition | plan, design, execute | standard |

---

## 9. Domain-Specific Workflows

Domain layers can extend standard workflows:

```yaml
# src/domain/amazon-growth/workflows/product-launch.yaml

extends: full-cycle

workflow:
  id: amazon-product-launch
  domain: amazon-growth

phases:
  - id: analyze
    # Override with domain-specific agents
    agents:
      - market-analyst
      - keyword-architect
```

---

## 10. Validation Rules

### 10.1 Required Checks
- [ ] `workflow.id` must be unique
- [ ] All referenced agents must exist
- [ ] All referenced skills must exist
- [ ] Phase dependencies must be acyclic
- [ ] Task dependencies must be acyclic within phase

### 10.2 Recommended Checks
- [ ] Each phase should have at least one task
- [ ] Transitions should be defined between phases
- [ ] Guards should be defined for critical phases

---

**This document is FROZEN as of v3.1 Final (2025-12-27).**
