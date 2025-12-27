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

**Source**: Fork of BMad Method

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

**Source**: Fork of CrewAI

---

### Skill Layer
**Definition**: The capability layer that defines WHAT can be done.

**Contains**:
- Atomic Skills (single capabilities)
- Composite Skills (skill combinations)
- Skill Registry
- Skill Loader

**Key Principle**: Only capabilities, no Agent/Flow concepts.

**Source**: Fork of Skill Forge

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
