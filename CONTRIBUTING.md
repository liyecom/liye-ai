# Contributing to LiYe AI

Thank you for your interest in contributing to LiYe AI! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

1. Check existing [Issues](https://github.com/liye-ai/liye-ai/issues) to avoid duplicates
2. Create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)

### Suggesting Features

1. Open an issue with the `enhancement` label
2. Describe the feature and its use case
3. Explain how it fits the four-layer architecture

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes following the style guide
4. Write or update tests as needed
5. Submit a pull request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/liye-ai.git
cd liye-ai

# Install dependencies
npm install

# Run tests
npm test

# Run linting
npm run lint
```

## Architecture Guidelines

LiYe AI uses a **four-layer domain-centric architecture**. When contributing, ensure your changes respect these boundaries:

### Layer Responsibilities

| Layer | Directory | Responsibility | Can Depend On |
|-------|-----------|----------------|---------------|
| **Method** | `src/method/` | WHY: Personas, workflows, evolution protocol | None (declaration only) |
| **Runtime** | `src/runtime/` | HOW: Execution, scheduling, memory | Method (read-only) |
| **Skill** | `src/skill/` | WHAT: Atomic/composite skills | None |
| **Domain** | `src/domain/` | WHERE: Business implementation | Method, Skill, Runtime |

### Key Rules

1. **Domain is the orchestrator**: Only Domain layer calls other layers
2. **Method is declaration-only**: No execution code in Method layer
3. **Skills are stateless**: Skills don't depend on Domain or Runtime
4. **Evolution three-power separation**:
   - Decision: Method layer
   - Execution: Runtime layer
   - Configuration: Domain layer

## Code Style

### TypeScript

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Export types alongside implementations

```typescript
// Good
export interface SkillInput {
  [key: string]: any;
}

export const mySkill: Skill = {
  id: 'my_skill',
  // ...
};
```

### YAML (Agent/Workflow definitions)

- Use the three-in-one Agent format
- Include all required sections: `agent`, `persona`, `skills`, `runtime`, `liyedata`

```yaml
agent:
  id: my-agent
  domain: my-domain

persona:
  role: "Role description"
  goal: "Goal description"

skills:
  atomic: [skill_1, skill_2]

runtime:
  process: sequential

liyedata:
  workflow_stage: "Stage name"
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | snake_case | `market_research.ts` |
| Agent IDs | kebab-case | `market-analyst` |
| Skill IDs | snake_case | `market_research` |
| Classes | PascalCase | `AgentExecutor` |
| Functions | camelCase | `executeTask` |

## Adding New Components

### Adding a Skill

1. Create file in `src/skill/atomic/` or `src/domain/[domain]/skills/atomic/`
2. Implement the `Skill` interface
3. Register in the skill registry

```typescript
// src/skill/atomic/my_skill.ts
import { Skill, SkillInput, SkillOutput } from '../types';

export const my_skill: Skill = {
  id: 'my_skill',
  name: 'My Skill',
  version: '1.0.0',
  description: 'Description of what this skill does',
  category: 'category-name',

  input: {
    type: 'object',
    properties: {
      // Define input schema
    }
  },

  output: {
    type: 'object',
    properties: {
      // Define output schema
    }
  },

  async execute(input: SkillInput): Promise<SkillOutput> {
    // Implementation
    return {};
  },

  validate(input: SkillInput): boolean {
    // Input validation
    return true;
  }
};

export default my_skill;
```

### Adding an Agent

1. Create YAML file in `src/domain/[domain]/agents/`
2. Follow the three-in-one format
3. Reference existing skills

### Adding a Workflow

1. Create YAML file in `src/domain/[domain]/workflows/`
2. Define phases, agents, and tasks
3. Specify transitions and guards

### Adding a Domain

1. Create directory structure:
   ```
   src/domain/my-domain/
   ├── config.yaml
   ├── agents/
   ├── skills/
   │   ├── atomic/
   │   └── composite/
   └── workflows/
   ```

2. Add to domain registry in `src/domain/index.ts`

## Testing

- Write tests for new skills and functionality
- Run the full test suite before submitting PR:

```bash
npm test
```

## Replay CI Gate Rule

Any change affecting:
- **Governance Kernel** (`src/governance/`, `src/audit/`)
- **Policy / Gate logic** (`src/reasoning/`)
- **Decision boundary** (verdict generation)
- **Evidence generation or hashing** (`docs/contracts/`)

**MUST pass Replay CI Gate.**

Failure indicates a breaking change to historical trust guarantees.

```bash
# Run locally before submitting PR
./scripts/ci/replay-gate.sh
```

If replay fails, your change breaks the ability to verify historical decisions.
This is considered a **breaking change** and cannot be merged.

## Documentation

- Update README.md if adding user-facing features
- Add JSDoc comments to public functions
- Update architecture docs if changing layer boundaries

## Commit Messages

Use clear, descriptive commit messages:

```
feat(skill): add market_research skill

- Implement market research with competitor analysis
- Add input/output schema validation
- Include tests for edge cases
```

Prefixes:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

## Questions?

- Open a [Discussion](https://github.com/liye-ai/liye-ai/discussions)
- Check existing documentation in `docs/`

---

Thank you for contributing to LiYe AI!
