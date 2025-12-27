# LiYe AI Skill Specification

> **Version**: 3.1 Final
> **Status**: FROZEN
> **Date**: 2025-12-27
> **Layer**: Skill Layer (Capability Only)

---

## 1. Overview

Skills are the **capability units** in LiYe AI, forked from Skill Forge.

**Key Principle**: Skills define **WHAT** can be done, not **WHO** does it or **HOW** it's done.
- No Agent concepts in Skills
- No Flow concepts in Skills
- Pure capability definitions

---

## 2. Skill Types

| Type | Description | Location |
|------|-------------|----------|
| **Atomic** | Single capability unit | `src/skill/atomic/` |
| **Composite** | Combination of atomic skills | `src/skill/composite/` |

---

## 3. Atomic Skill Structure

```typescript
// Location: src/skill/atomic/{skill_name}.ts

import { Skill, SkillInput, SkillOutput } from '@liye-ai/skill';

export const market_research: Skill = {
  // === Metadata ===
  id: 'market_research',
  name: 'Market Research',
  version: '1.0.0',
  description: 'Conducts comprehensive market research and analysis',

  // === Input/Output Schema ===
  input: {
    type: 'object',
    properties: {
      product_category: { type: 'string', required: true },
      target_market: { type: 'string', required: true },
      depth: { type: 'string', enum: ['basic', 'detailed', 'comprehensive'] }
    }
  },

  output: {
    type: 'object',
    properties: {
      market_size: { type: 'number' },
      growth_rate: { type: 'number' },
      key_players: { type: 'array', items: { type: 'string' } },
      trends: { type: 'array', items: { type: 'string' } },
      report: { type: 'string' }
    }
  },

  // === Execution ===
  async execute(input: SkillInput): Promise<SkillOutput> {
    // Implementation
    return {
      market_size: 1000000,
      growth_rate: 0.15,
      key_players: ['Player A', 'Player B'],
      trends: ['Trend 1', 'Trend 2'],
      report: 'Market research report...'
    };
  },

  // === Validation ===
  validate(input: SkillInput): boolean {
    return !!input.product_category && !!input.target_market;
  }
};
```

---

## 4. Composite Skill Structure

```typescript
// Location: src/skill/composite/{skill_name}.ts

import { CompositeSkill } from '@liye-ai/skill';

export const market_intelligence_report: CompositeSkill = {
  id: 'market_intelligence_report',
  name: 'Market Intelligence Report',
  version: '1.0.0',
  description: 'Generates comprehensive market intelligence report',

  // === Skill Chain ===
  chain: [
    {
      skill: 'market_research',
      input_mapping: {
        product_category: 'input.product_category',
        target_market: 'input.target_market'
      },
      output_alias: 'market_data'
    },
    {
      skill: 'competitor_analysis',
      input_mapping: {
        market_data: 'market_data',
        competitors: 'input.competitors'
      },
      output_alias: 'competitor_data'
    },
    {
      skill: 'report_generation',
      input_mapping: {
        market_data: 'market_data',
        competitor_data: 'competitor_data'
      },
      output_alias: 'final_report'
    }
  ],

  // === Final Output ===
  output_mapping: {
    report: 'final_report.report',
    summary: 'final_report.summary'
  }
};
```

---

## 5. Skill Registry

```typescript
// Location: src/skill/registry/index.ts

import { SkillRegistry } from '@liye-ai/skill';

// Register all atomic skills
import { market_research } from '../atomic/market_research';
import { competitor_analysis } from '../atomic/competitor_analysis';
import { trend_detection } from '../atomic/trend_detection';

// Register all composite skills
import { market_intelligence_report } from '../composite/market_intelligence_report';

export const registry = new SkillRegistry();

// Atomic skills
registry.register(market_research);
registry.register(competitor_analysis);
registry.register(trend_detection);

// Composite skills
registry.register(market_intelligence_report);

export default registry;
```

---

## 6. Skill Loader

```typescript
// Location: src/skill/loader/index.ts

import { SkillLoader } from '@liye-ai/skill';
import registry from '../registry';

export const loader = new SkillLoader(registry);

// Load skill by ID
const skill = loader.load('market_research');

// Load multiple skills
const skills = loader.loadMany(['market_research', 'competitor_analysis']);
```

---

## 7. Field Specifications

### 7.1 Skill Metadata

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (snake_case) |
| `name` | string | Yes | Human-readable name |
| `version` | semver | Yes | Semantic version |
| `description` | string | Yes | Skill description |

### 7.2 Input Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | `object` |
| `properties` | object | Yes | Property definitions |
| `required` | string[] | No | Required properties |

### 7.3 Output Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | `object` |
| `properties` | object | Yes | Property definitions |

---

## 8. Standard Skills

### 8.1 Research Skills

| ID | Name | Description |
|----|------|-------------|
| `market_research` | Market Research | Market analysis |
| `competitor_analysis` | Competitor Analysis | Competitor analysis |
| `trend_detection` | Trend Detection | Trend identification |
| `keyword_research` | Keyword Research | Keyword analysis |

### 8.2 Analysis Skills

| ID | Name | Description |
|----|------|-------------|
| `data_analysis` | Data Analysis | Data processing |
| `performance_diagnosis` | Performance Diagnosis | Performance analysis |
| `root_cause_analysis` | Root Cause Analysis | Problem diagnosis |

### 8.3 Optimization Skills

| ID | Name | Description |
|----|------|-------------|
| `content_optimization` | Content Optimization | Content improvement |
| `seo_optimization` | SEO Optimization | SEO enhancement |
| `bid_optimization` | Bid Optimization | PPC bid optimization |

### 8.4 Execution Skills

| ID | Name | Description |
|----|------|-------------|
| `task_execution` | Task Execution | Execute tasks |
| `progress_tracking` | Progress Tracking | Track progress |
| `quality_check` | Quality Check | Quality validation |

---

## 9. Domain-Specific Skills

Domains can define their own skills:

```
src/domain/amazon-growth/skills/
├── atomic/
│   ├── asin_research.ts
│   ├── review_analysis.ts
│   └── ppc_analysis.ts
└── composite/
    └── amazon_product_audit.ts
```

---

## 10. Validation Rules

### 10.1 Required Checks
- [ ] `id` must be unique in registry
- [ ] `id` must be snake_case
- [ ] `version` must follow semver
- [ ] `input` schema must be valid JSON Schema
- [ ] `output` schema must be valid JSON Schema
- [ ] `execute` function must be async

### 10.2 Composite Skill Checks
- [ ] All skills in chain must exist in registry
- [ ] Input mappings must reference valid paths
- [ ] Output mappings must reference valid aliases
- [ ] Chain must be acyclic

---

## 11. Anti-Patterns (DO NOT DO)

```typescript
// ❌ WRONG: Skill with Agent concept
export const analyst_skill = {
  agent: 'market-analyst',  // ← NO Agent in Skills!
  // ...
};

// ❌ WRONG: Skill with Flow concept
export const workflow_skill = {
  workflow: 'amazon-launch',  // ← NO Flow in Skills!
  // ...
};

// ✅ CORRECT: Pure capability
export const market_research = {
  id: 'market_research',
  // ...no agent, no workflow
};
```

---

**This document is FROZEN as of v3.1 Final (2025-12-27).**
