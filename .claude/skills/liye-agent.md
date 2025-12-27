# LiYe Agent Operations

Skill for working with LiYe AI agents and crews.

## When to Use

This skill should be used when:
- Creating or modifying agent definitions
- Setting up agent crews
- Running agent workflows
- Debugging agent behavior

## Prerequisites

- Working in the LiYe AI repository
- Understanding of the four-layer architecture

## Instructions

### Working with Agents

#### Creating a New Agent

1. Copy `Agents/_template.yaml` to `Agents/core/` or `Agents/domain/`
2. Fill in the three-part specification:
   - **Persona**: WHO the agent is (role, goal, backstory)
   - **Skills**: WHAT capabilities it has
   - **Runtime**: HOW it executes

3. Validate the YAML structure
4. Test with: `npx liye-ai agent test <agent-id>`

#### Agent Specification Reference

```yaml
agent:
  id: kebab-case-identifier
  name: Human Readable Name
  version: 1.0.0
  domain: core | amazon-growth | medical-research | geo-os

persona:
  role: "What role this agent plays"
  goal: "Primary objective"
  backstory: "Background that shapes behavior"

skills:
  atomic: [skill1, skill2]
  composite: [combined_skill]

runtime:
  process: sequential | hierarchical | parallel
  memory: true
  delegation: false
```

### Working with Crews

#### Creating a New Crew

1. Copy `Crews/_template.yaml` to `Crews/core/` or `Crews/domain/`
2. Define team composition (agents and roles)
3. Configure process type and goals
4. Set constraints and guardrails

#### Running a Crew

```typescript
import { loadCrew } from '@liye-ai/runtime';

const crew = await loadCrew('core/research-team');
const result = await crew.kickoff({
  topic: 'your research topic',
  constraints: { /* optional overrides */ }
});
```

## Best Practices

- Keep agent responsibilities focused (single responsibility)
- Use hierarchical process for complex workflows
- Set realistic timeouts and iteration limits
- Enable evolution for continuous improvement

## Common Issues

### Issue: Agent not found
**Solution**: Check that agent ID matches filename (without .yaml)

### Issue: Skill not available
**Solution**: Verify skill is defined in `src/skill/` directory

### Issue: Crew timeout
**Solution**: Increase timeout in constraints or simplify workflow
