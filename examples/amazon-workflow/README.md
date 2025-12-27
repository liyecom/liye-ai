# Amazon Workflow Example

Demonstrates how to use the Amazon Growth domain workflows.

## Overview

This example shows how to:
1. Load domain configuration
2. Execute a multi-phase workflow
3. Coordinate multiple agents
4. Handle workflow outputs

## Available Workflows

### amazon-launch
Complete product launch workflow with market research, keyword analysis, and listing optimization.

### amazon-optimize
Continuous optimization workflow for existing products.

### amazon-diagnose
Quick diagnosis workflow for performance issues.

## Running

```bash
# View workflow definition
cat src/domain/amazon-growth/workflows/diagnose.yaml

# Execute workflow (coming soon)
npx liye-ai workflow run amazon-diagnose --asin B01EXAMPLE
```

## Workflow Structure

```yaml
workflow:
  id: amazon-diagnose
  track: quick

phases:
  - id: collect
    agents: [diagnostic-architect, review-sentinel]
    tasks:
      - collect-performance
      - collect-reviews
      - collect-ppc

  - id: analyze
    depends_on: [collect]
    agents: [diagnostic-architect]
    tasks:
      - traffic-analysis
      - conversion-analysis
      - synthesize
```

## Agents Involved

| Agent | Role |
|-------|------|
| market-analyst | Market intelligence and research |
| keyword-architect | Keyword strategy and optimization |
| listing-optimizer | Listing content optimization |
| diagnostic-architect | Performance diagnosis |
| ppc-strategist | PPC campaign optimization |
| review-sentinel | Review monitoring and analysis |
| sprint-orchestrator | Workflow coordination |
