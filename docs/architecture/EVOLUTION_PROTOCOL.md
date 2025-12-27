# LiYe AI Evolution Protocol

> **Version**: 3.1 Final
> **Status**: FROZEN
> **Date**: 2025-12-27
> **Governance**: Three Powers Separation

---

## 1. Overview

Evolution is LiYe AI's self-improvement mechanism. It learns from execution patterns and adapts agent behavior over time.

**Key Principle**: Three Powers Separation
- **Decision** (Method Layer): What to learn, how to judge
- **Execution** (Runtime Layer): Actual learning, recording, replaying
- **Configuration** (Domain Layer): Enable/disable only, cannot modify rules

---

## 2. Governance Model

```
┌─────────────────────────────────────────────────────────────┐
│                    EVOLUTION GOVERNANCE                      │
├─────────────────┬─────────────────┬─────────────────────────┤
│    DECISION     │    EXECUTION    │     CONFIGURATION       │
│   (Method)      │    (Runtime)    │      (Domain)           │
├─────────────────┼─────────────────┼─────────────────────────┤
│ • What to learn │ • Run learning  │ • Enable/disable        │
│ • How to judge  │ • Record data   │ • Set thresholds        │
│ • Define rules  │ • Replay        │ • ❌ Cannot modify rules│
│ • Set metrics   │ • Store results │ • ❌ Cannot change logic│
└─────────────────┴─────────────────┴─────────────────────────┘
```

---

## 3. Evolution Protocol (YAML)

```yaml
# Location: src/method/evolution/protocol.yaml

protocol:
  version: "3.1"
  status: frozen

# === 1. Learning Sources (What to Learn) ===
learn_from:
  - type: execution_logs
    description: Agent execution history
    weight: 0.4

  - type: workflow_completion
    description: Workflow success/failure rates
    weight: 0.3

  - type: user_feedback
    description: Explicit user signals
    weight: 0.2

  - type: proven_patterns
    description: Validated successful patterns
    weight: 0.1

# === 2. Judgment Rules (How to Judge) ===
judgment:
  success_criteria:
    - metric: task_completion_rate
      threshold: 0.85
      weight: 0.4

    - metric: quality_score
      threshold: 0.80
      weight: 0.3

    - metric: user_satisfaction
      threshold: 0.75
      weight: 0.3

  graduation_threshold: 0.85
  minimum_samples: 10

# === 3. Storage Configuration ===
storage:
  location: .liye/evolution/
  format: jsonl
  retention: 90d
  compression: gzip

# === 4. Replay Mechanism ===
replay:
  trigger: workflow_init
  mechanism: pattern_match
  fallback: default_behavior
  cache_ttl: 24h

# === 5. Safety Guards ===
guards:
  max_adaptation_per_cycle: 0.10  # Max 10% change per cycle
  require_validation: true
  rollback_on_regression: true
```

---

## 4. Learning Sources

### 4.1 Execution Logs

```jsonl
{"timestamp": "2025-12-27T10:00:00Z", "agent": "market-analyst", "task": "market-research", "status": "success", "duration": 120, "quality_score": 0.92}
{"timestamp": "2025-12-27T10:05:00Z", "agent": "market-analyst", "task": "competitor-analysis", "status": "success", "duration": 90, "quality_score": 0.88}
```

### 4.2 Workflow Completion

```jsonl
{"timestamp": "2025-12-27T12:00:00Z", "workflow": "amazon-launch", "phase": "analyze", "status": "complete", "score": 0.90}
```

### 4.3 User Feedback

```jsonl
{"timestamp": "2025-12-27T14:00:00Z", "type": "explicit", "signal": "approve", "agent": "market-analyst", "task": "market-research"}
```

### 4.4 Proven Patterns

```jsonl
{"pattern_id": "p001", "description": "Pre-fetch competitor data", "success_rate": 0.95, "samples": 50, "status": "graduated"}
```

---

## 5. Runtime Implementation

### 5.1 Evolution Engine

```typescript
// Location: src/runtime/evolution/engine.ts

import { EvolutionEngine } from '@liye-ai/runtime';

export class LiYeEvolutionEngine implements EvolutionEngine {
  private protocol: EvolutionProtocol;
  private storage: EvolutionStorage;

  constructor(protocol: EvolutionProtocol) {
    this.protocol = protocol;
    this.storage = new EvolutionStorage(protocol.storage);
  }

  // Record execution
  async record(event: ExecutionEvent): Promise<void> {
    await this.storage.append(event);
  }

  // Pattern matching for replay
  async match(context: ExecutionContext): Promise<Pattern | null> {
    const patterns = await this.storage.getGraduatedPatterns();
    return this.findBestMatch(patterns, context);
  }

  // Evaluate and graduate patterns
  async evaluate(): Promise<void> {
    const candidates = await this.storage.getCandidatePatterns();
    for (const pattern of candidates) {
      if (this.meetsGraduationCriteria(pattern)) {
        await this.graduate(pattern);
      }
    }
  }
}
```

### 5.2 Storage Interface

```typescript
// Location: src/runtime/evolution/storage.ts

export interface EvolutionStorage {
  append(event: ExecutionEvent): Promise<void>;
  query(filter: QueryFilter): Promise<ExecutionEvent[]>;
  getGraduatedPatterns(): Promise<Pattern[]>;
  getCandidatePatterns(): Promise<Pattern[]>;
  graduate(pattern: Pattern): Promise<void>;
}
```

---

## 6. Domain Configuration

Domains can only configure, not modify rules:

```yaml
# Location: src/domain/amazon-growth/config.yaml

evolution:
  enabled: true                    # ✅ Can enable/disable
  graduation_threshold: 0.90       # ✅ Can set threshold
  minimum_samples: 20              # ✅ Can set sample size

  # ❌ CANNOT DO:
  # learn_from: [...]             # Cannot change learning sources
  # judgment: {...}               # Cannot change judgment rules
  # replay: {...}                 # Cannot change replay mechanism
```

---

## 7. Pattern Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  OBSERVED   │ ──▶ │  CANDIDATE  │ ──▶ │  GRADUATED  │
│  (Raw Data) │     │ (Testing)   │     │ (Production)│
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   │                   │
       ▼                   ▼                   ▼
   Record in           Evaluate           Apply in
   storage             metrics            execution
```

### 7.1 States

| State | Description | Next State |
|-------|-------------|------------|
| `observed` | Raw execution data collected | `candidate` |
| `candidate` | Pattern identified, testing | `graduated` or `rejected` |
| `graduated` | Proven pattern, used in production | - |
| `rejected` | Failed evaluation | - |

### 7.2 Graduation Criteria

```yaml
graduation:
  required:
    - success_rate >= graduation_threshold
    - samples >= minimum_samples
    - no_regression: true
  optional:
    - user_approved: true
```

---

## 8. Safety Mechanisms

### 8.1 Adaptation Limits

```yaml
safety:
  max_adaptation_per_cycle: 0.10  # Max 10% behavior change
  require_validation: true        # Validate before applying
  rollback_on_regression: true    # Auto-rollback if performance drops
```

### 8.2 Rollback

```typescript
// Automatic rollback on regression
if (currentScore < previousScore * 0.95) {
  await this.rollback(previousVersion);
  await this.markPatternAsRejected(pattern);
}
```

---

## 9. Metrics

### 9.1 Core Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| `task_completion_rate` | Tasks completed successfully | ≥ 85% |
| `quality_score` | Output quality | ≥ 80% |
| `user_satisfaction` | User feedback score | ≥ 75% |
| `execution_time` | Task duration | ≤ baseline |

### 9.2 Tracking

```yaml
# .liye/evolution/metrics.jsonl
{"date": "2025-12-27", "agent": "market-analyst", "task_completion_rate": 0.92, "quality_score": 0.88, "patterns_graduated": 3}
```

---

## 10. Integration Points

### 10.1 Workflow Init (Replay Trigger)

```typescript
// Before workflow starts
const pattern = await evolutionEngine.match(workflowContext);
if (pattern) {
  applyPattern(pattern, workflow);
}
```

### 10.2 Task Complete (Record Trigger)

```typescript
// After task completes
await evolutionEngine.record({
  agent: task.agent,
  task: task.id,
  status: result.status,
  duration: result.duration,
  quality_score: result.qualityScore
});
```

---

## 11. Anti-Patterns (DO NOT DO)

```yaml
# ❌ WRONG: Domain modifying learning sources
# src/domain/amazon-growth/evolution.yaml
evolution:
  learn_from:                      # ← Domain CANNOT modify this!
    - type: custom_source

# ❌ WRONG: Domain modifying judgment rules
evolution:
  judgment:                        # ← Domain CANNOT modify this!
    success_criteria: [...]

# ✅ CORRECT: Domain only configures
evolution:
  enabled: true
  graduation_threshold: 0.90
```

---

**This document is FROZEN as of v3.1 Final (2025-12-27).**
