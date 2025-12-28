# Architecture Glossary

Terminology for LiYe AI's four-layer architecture.

---

## Four-Layer Architecture

### Method Layer
**Definition**: The declarative layer that defines WHAT should happen and WHY.

**Contains**:
- Personas (agent identities)
- Workflows (process definitions)
- Phases (execution stages)
- Tracks (scale adaptations)
- Evolution protocols

**Key Principle**: Only declarations, no execution code.

**Source**: Inspired by BMad Method (no source code included)

---

### Runtime Layer
**Definition**: The execution layer that handles HOW things run.

**Contains**:
- Agent Executor
- Task Scheduler
- Process Manager
- Memory Manager
- Evolution Engine

**Key Principle**: Only execution, no business semantics.

**Source**: Inspired by CrewAI patterns (pip dependency only)

---

### Skill Layer
**Definition**: The capability layer that defines WHAT can be done.

**Contains**:
- Atomic Skills (single capabilities)
- Composite Skills (skill combinations)
- Skill Registry
- Skill Loader

**Key Principle**: Only capabilities, no Agent/Flow concepts.

**Source**: Inspired by Skill Forge concepts (original implementation)

---

### Domain Layer
**Definition**: The application layer that specifies WHERE things apply.

**Contains**:
- Domain-specific agents
- Domain configurations
- Business logic
- Integration code

**Key Principle**: Assembles other layers, doesn't modify them.

**Source**: LiYe AI original

---

## Dependency Model

### Domain-Centric Fan-Out
**Definition**: Architecture pattern where Domain is the sole orchestrator.

```
        ┌─────────┐
        │ Domain  │  ← Only orchestrator
        └────┬────┘
     ┌───────┼───────┐
     ↓       ↓       ↓
  Method   Skill  Runtime
```

**Rule**: Domain calls the other three; they don't call each other directly.

---

### Evolution Three-Rights Separation
**Definition**: Governance model for the evolution system.

| Right | Owner | Scope |
|-------|-------|-------|
| Decision | Method | What to learn, rules |
| Execution | Runtime | Running, recording |
| Configuration | Domain | Enable/disable only |

---

## Key Patterns

### Agent Composition Formula
```
Agent = Persona (WHO) + Skills (WHAT) + Runtime (HOW)
```

### Builder Anti-Pattern
**Definition**: LiYe AI explicitly does NOT include code-generation builders.

**Policy**: "Builder = Template + Schema, never code generation"

---

## File Conventions

### Configuration Files
- `.yaml` - Agent/Crew/Workflow definitions
- `.json` - Runtime configurations
- `.md` - Documentation and glossaries

### Naming Conventions
- `kebab-case` - File names, agent IDs
- `PascalCase` - TypeScript classes
- `camelCase` - Variables and functions

---

## Tri-Fork Fusion

### Definition
LiYe OS 的架构融合模式，指从三个上游项目**借鉴理念**，而非复制代码。

### Key Principle
```
Tri-Fork ≠ Copy Source Code
Tri-Fork = 借鉴理念 + 原创实现 + 依赖调用
```

### Clarification

| 上游项目 | 融合方式 | LiYe OS 实现 |
|----------|---------|--------------|
| BMad Method | 理念借鉴 | 原创 YAML 规范 |
| CrewAI | pip 依赖 + 模式参考 | TypeScript Runtime + Python 调用 |
| Skill Forge | 概念参考 | TypeScript Skill 层 |

**See also**: [NON_FORK_STATEMENT.md](../docs/architecture/NON_FORK_STATEMENT.md)
