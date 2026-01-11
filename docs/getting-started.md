# Getting Started with LiYe AI

This guide will help you get up and running with LiYe AI in minutes.

## Prerequisites

- Node.js 18+
- npm or yarn
- Git

## Installation

### Option 1: Clone the Repository

```bash
git clone https://github.com/liye-ai/liye-ai.git
cd liye-ai
npm install
```

### Option 2: Use npx (Coming Soon)

```bash
npx liye-ai init my-project
cd my-project
```

## Your First Commands

### Check System Status

```bash
node cli/index.js status
```

Output:
```
=== LiYe AI System Status ===

Version: 3.1.0
Architecture: Four-Layer (Method → Runtime → Skill → Domain)

Layers:
  ✓ Method Layer: 12 personas, 4 workflows
  ✓ Skill Layer: 4 atomic skills registered
  ✓ Runtime Layer: Agent executor ready
  ✓ Domain Layer: 3 domains configured

Domains:
  • skeleton (example application)
  • medical-research (application)
  • geo (core)
```

> **Note:** Domain-specific implementations (like Amazon Growth Engine) are in private repositories. This public framework includes skeleton examples and medical-research as demonstration domains.

### List Available Agents

```bash
node cli/index.js agent list
```

Output:
```
=== LiYe AI Agents ===

skeleton:
  • example-analyst - Example Analysis Agent
  • example-optimizer - Example Optimization Agent

medical-research:
  • literature-analyst - Literature Search Analyst
  • evidence-synthesizer - Evidence Synthesis Specialist
  • clinical-advisor - Clinical Decision Advisor
```

### List Available Skills

```bash
node cli/index.js skill list
```

## Understanding the Architecture

LiYe AI uses a four-layer architecture:

```
┌─────────────────────────────────────────────┐
│ Domain Layer (WHERE)                        │
│   Your business logic and agent configs     │
├─────────────────────────────────────────────┤
│ Skill Layer (WHAT)                          │
│   Reusable capability units                 │
├─────────────────────────────────────────────┤
│ Runtime Layer (HOW)                         │
│   Execution engine and scheduling           │
├─────────────────────────────────────────────┤
│ Method Layer (WHY)                          │
│   Personas, workflows, methodology          │
└─────────────────────────────────────────────┘
```

### Key Concepts

1. **Agents** = Persona + Skills + Runtime configuration
2. **Skills** = Reusable capability units (atomic or composite)
3. **Workflows** = Orchestrated sequences of agent tasks
4. **Domains** = Business-specific implementations

## Creating Your First Agent

### 1. Create the Agent YAML

```yaml
# src/domain/my-domain/agents/my-agent.yaml

agent:
  id: my-agent
  name: My Custom Agent
  version: 1.0.0
  domain: my-domain

persona:
  role: "Your Agent's Role"
  goal: "What this agent aims to achieve"
  backstory: "Background context for the agent"
  communication_style: "Concise, data-driven"

skills:
  atomic:
    - market_research
    - competitor_analysis
  composite: []

runtime:
  process: sequential
  memory: true
  max_iterations: 5

liyedata:
  workflow_stage: "Custom: Step 1"
  acceptance_criteria:
    - metric: task_completion
      threshold: 0.90

evolution:
  enabled: true
```

### 2. Create a Domain Configuration

```yaml
# src/domain/my-domain/config.yaml

domain:
  id: my-domain
  name: My Custom Domain
  version: 1.0.0
  description: Description of your domain

agents:
  enabled:
    - my-agent
  orchestrator: my-agent

workflows:
  available:
    - my-workflow
  default: my-workflow

skills:
  atomic:
    - my_custom_skill
  composite: []

evolution:
  enabled: true
  graduation_threshold: 0.85
```

## Creating a Custom Skill

### Atomic Skill

```typescript
// src/domain/my-domain/skills/atomic/my_skill.ts

import { Skill, SkillInput, SkillOutput } from '../../../../skill/types';

export const my_skill: Skill = {
  id: 'my_skill',
  name: 'My Custom Skill',
  version: '1.0.0',
  description: 'What this skill does',
  category: 'my-category',

  input: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        required: true,
        description: 'Input query'
      }
    }
  },

  output: {
    type: 'object',
    properties: {
      result: { type: 'string' },
      confidence: { type: 'number' }
    }
  },

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { query } = input;

    // Your skill logic here

    return {
      result: `Processed: ${query}`,
      confidence: 0.95
    };
  },

  validate(input: SkillInput): boolean {
    return typeof input.query === 'string' && input.query.length > 0;
  }
};

export default my_skill;
```

### Composite Skill (Skill Chain)

```typescript
// src/domain/my-domain/skills/composite/my_pipeline.ts

import { CompositeSkill } from '../../../../skill/types';

export const my_pipeline: CompositeSkill = {
  id: 'my_pipeline',
  name: 'My Skill Pipeline',
  version: '1.0.0',
  description: 'Chains multiple skills together',

  chain: [
    {
      skill: 'skill_1',
      input_mapping: { data: 'input.raw_data' },
      output_alias: 'step1_result'
    },
    {
      skill: 'skill_2',
      input_mapping: { processed: 'step1_result.output' },
      output_alias: 'step2_result'
    },
    {
      skill: 'skill_3',
      input_mapping: { final: 'step2_result.output' },
      output_alias: 'final_result'
    }
  ],

  output_mapping: {
    result: 'final_result',
    intermediate: 'step1_result'
  }
};

export default my_pipeline;
```

## Creating a Workflow

```yaml
# src/domain/my-domain/workflows/my-workflow.yaml

workflow:
  id: my-workflow
  name: My Custom Workflow
  version: 1.0.0
  track: standard
  domain: my-domain
  description: What this workflow accomplishes

phases:
  - id: analyze
    name: Analysis Phase
    description: Analyze the input
    agents:
      - my-agent
    tasks:
      - id: initial-analysis
        agent: my-agent
        skill: my_skill
        inputs:
          - raw_data
        outputs:
          - analysis_result

  - id: process
    name: Processing Phase
    description: Process the analyzed data
    depends_on: [analyze]
    agents:
      - my-agent
    tasks:
      - id: data-processing
        agent: my-agent
        skill: my_pipeline
        inputs:
          - analysis_result
        outputs:
          - final_output

transitions:
  - from: analyze
    to: process
    condition: "analysis_result.valid == true"

  - from: process
    to: complete
    condition: "final_output.success == true"

guards:
  - phase: analyze
    condition: "raw_data != null"
    action: block
    message: "Input data is required"
```

## Running a Workflow

```bash
# Coming soon
node cli/index.js workflow run my-workflow --input data.json
```

## Next Steps

1. **Explore existing domains**: Check `src/domain/medical-research/` or `src/domain/geo/` for examples
2. **Read the architecture docs**: See `docs/architecture/ARCHITECTURE.md`
3. **Create your own domain**: Follow the patterns above
4. **Contribute**: See [CONTRIBUTING.md](../CONTRIBUTING.md)

## Troubleshooting

### Common Issues

**CLI not found**
```bash
# Make sure you're in the project root
cd liye-ai
node cli/index.js status
```

**Module not found**
```bash
# Install dependencies
npm install
```

**YAML parse error**
- Check for proper indentation (2 spaces)
- Validate YAML syntax at [yaml-online-parser.appspot.com](https://yaml-online-parser.appspot.com)

## Getting Help

- [GitHub Issues](https://github.com/liye-ai/liye-ai/issues)
- [Discussions](https://github.com/liye-ai/liye-ai/discussions)
- [Documentation](https://liye.ai/docs)

---

Happy building with LiYe AI!
