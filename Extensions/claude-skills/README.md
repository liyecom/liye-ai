# Claude Skills

Custom skills for Claude Code integration with LiYe AI.

## What are Claude Skills?

Claude Skills are markdown files that extend Claude Code's capabilities by providing:
- Domain-specific knowledge
- Workflow guidance
- Tool instructions
- Best practices

## Skill Format

Each skill file follows this structure:

```markdown
# Skill Name

Brief description of what this skill does.

## When to Use

- Trigger condition 1
- Trigger condition 2

## Instructions

Step-by-step instructions for Claude to follow.

## Examples

Example inputs and outputs.
```

## Available Skills

| Skill | Purpose | Trigger Keywords |
|-------|---------|------------------|
| `liye-agent.md` | Working with LiYe AI agents | agent, crew, workflow |
| `liye-research.md` | Research workflows | research, investigate, analyze |

## Creating a New Skill

1. Copy the template below
2. Fill in your skill-specific content
3. Save as `your-skill.md` in this directory
4. Test by asking Claude to use the skill

## Template

```markdown
# [Skill Name]

[Brief description]

## When to Use

This skill should be used when:
- [Condition 1]
- [Condition 2]

## Prerequisites

- [Prerequisite 1]
- [Prerequisite 2]

## Instructions

### Step 1: [First Step]
[Detailed instructions]

### Step 2: [Second Step]
[Detailed instructions]

## Best Practices

- [Practice 1]
- [Practice 2]

## Common Issues

### Issue: [Problem]
**Solution**: [How to fix]
```

## Integration

Skills in this directory are automatically available when Claude Code operates within the LiYe AI repository.
