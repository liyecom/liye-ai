# Custom Agent Example

Demonstrates how to create and configure a custom agent.

## Files

- `my-agent.yaml` - Agent definition using the three-in-one format
- `my-skill.ts` - Custom skill implementation
- `run.ts` - Agent execution example

## Structure

```
custom-agent/
├── README.md
├── my-agent.yaml     # Agent definition
├── my-skill.ts       # Custom skill
└── run.ts            # Execution script
```

## Key Concepts

### Agent = Persona + Skills + Runtime

```yaml
persona:              # WHO the agent is (from BMad)
skills:               # WHAT the agent can do (from Skill Forge)
runtime:              # HOW the agent executes (from CrewAI)
```

## Running

```bash
npx ts-node examples/custom-agent/run.ts
```
