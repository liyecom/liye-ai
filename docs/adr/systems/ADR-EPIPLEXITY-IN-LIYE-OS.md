# ADR: Epiplexity Integration in LiYe OS

**Status**: Accepted (Phase 0-1 Only)
**Date**: 2026-01-21
**Decision Makers**: LiYe
**Scope**: Observation & Analysis (No Behavior Change)

---

## 1. Background: Why Epiplexity?

### The Problem
LiYe OS currently governs knowledge through **static heuristics**:
- Pack selection: keyword matching (0.7-0.95 confidence)
- Skill quality: structural debt scoring (missing keys = +8 debt)
- Context budget: hard character limits (CLAUDE.md ≤ 10K, Pack ≤ 15K)

**These heuristics do not measure whether Claude can actually learn from the content.**

### The Opportunity
Epiplexity theory (Finzi et al., 2025) provides a framework for measuring "learnable structure for computationally bounded observers."

**Our goal**: Evolve from "structural governance" to "learnable structure governance (ROI/reuse/drift)".

**The key question we want to answer**:
> 每 1 token 上下文/每一次策略沉淀，给任务成功带来了多少可复用增益？

---

## 2. What We Are NOT Doing (Phase 0-1 Constraints)

### Hard Constraints
| Constraint | Reason |
|------------|--------|
| **NO perplexity/token-loss dependency** | Runtime environment cannot access these signals |
| **NO new kernel subsystem** | `src/kernel/epiplexity/` is PROHIBITED in Phase 0-1 |
| **NO behavior change** | Pack selection, execution logic remain unchanged |
| **NO KPI on "epiplexity score"** | Primary KPI is always success_rate/revenue |
| **2-week hard deadline** | Scale/Kill decision must be made by end of Phase 1 |

### What We ARE Doing
| Allowed | Purpose |
|---------|---------|
| Trace fields (facts) | Observable signals for analysis |
| Contract (rules) | Thresholds definition (advisory only) |
| Report scripts (analysis) | Generate VFC reports |
| ADR (decision record) | This document |

---

## 3. Proxy Metrics (V0 Signals)

Since we cannot access perplexity/loss, we define **operational proxy signals**:

### 3.1 VFC (Value-for-Context) - Core Metric

```
VFC(pack) = ((success_rate(pack) - baseline_success) * (1 - drift_rate(pack))) / (avg_tokens(pack) / 1000)
```

**Interpretation**: Net success improvement per 1000 tokens.

### 3.2 Supporting Signals

| Signal | Definition | Purpose |
|--------|------------|---------|
| **success_rate(pack)** | Task success rate when pack is loaded | Value signal |
| **drift_rate(pack)** | Failure/drift tag incidence when pack is loaded | Risk signal |
| **avg_tokens(pack)** | Average token cost when pack is loaded | Cost signal |
| **baseline_success** | Global task success rate | Baseline |
| **Reuse Yield** | Cross-task reuse success (Phase 2) | Transferability |

---

## 4. Trace Schema (New Fields)

### 4.1 Trace File Location
```
data/traces/epiplexity/epiplexity-traces.jsonl
```

### 4.2 Required Fields (All Must Be Present)

| Field | Type | Description |
|-------|------|-------------|
| `trace_id` | string | Unique identifier: `{ISO_timestamp}__{random_suffix}` |
| `ts` | ISO8601 | Timestamp |
| `task_type` | string | Category: `amazon\|seo\|dev\|docs\|ops\|general` |
| `packs_loaded` | string[] | List of pack IDs loaded for this task |
| `context_tokens_total` | number | Estimated total context tokens |
| `task_success` | boolean | Whether task completed successfully |
| `quality_score` | number\|null | Optional quality metric (null if unavailable) |
| `strike_count` | number | Consecutive failure count (from 3-strike protocol) |
| `failure_mode_tags` | string[] | Array of failure mode identifiers (empty if success) |
| `duration_ms` | number | Task execution duration in milliseconds |
| `notes` | string | Optional notes |

### 4.3 Example Trace Record

```json
{
  "trace_id": "2026-01-21T10:12:33.123Z__abc123",
  "ts": "2026-01-21T10:12:33.123Z",
  "task_type": "amazon",
  "packs_loaded": ["operations", "infrastructure"],
  "context_tokens_total": 8420,
  "task_success": true,
  "quality_score": null,
  "strike_count": 0,
  "failure_mode_tags": [],
  "duration_ms": 18432,
  "notes": "phase0 observe only"
}
```

---

## 5. Phase 0-1 Acceptance Criteria

### Phase 0 (Week 1): Observation Foundation

| Deliverable | Status | Verification |
|-------------|--------|--------------|
| This ADR | Required | File exists, content complete |
| `epiplexity.contract.yaml` | Required | Valid YAML, enforcement=advisory |
| Trace emitter | Required | Traces written to jsonl file |
| `epiplexity_report.mjs` | Required | Can run and output basic stats |

### Phase 1 (Week 2): Correlation Analysis + Decision

| Deliverable | Status | Verification |
|-------------|--------|--------------|
| `PACK_VALUE_FOR_CONTEXT.md` | Required | VFC table with verdicts |
| `TOP_PACKS_BY_VFC.md` | Required | Top 20 high-value packs |
| `DRIFT_SOURCES.md` | Required | Top 20 drift risk packs |
| `SCALE_OR_KILL_DECISION.md` | Required | Clear Scale/Kill verdict |

### Two-Week Gate (Scale/Kill Decision Criteria)

**Scale Conditions** (≥2 required to continue):
1. Top 20% packs have VFC significantly higher than median
2. "High usage, low VFC" packs exist (optimization opportunity)
3. "Low usage, high VFC" packs exist (recall optimization opportunity)
4. Clear drift sources identified (governance opportunity)

**Kill Conditions** (≥1 triggers pause):
1. Pack vs success rate shows no differentiation (VFC ≈ 0)
2. Trace data insufficient or too noisy
3. Observation impacts execution efficiency unacceptably

---

## 6. Rollback Plan

### Disable Observation
```bash
# Option 1: Delete trace emitter integration
git revert <commit_hash>

# Option 2: Environment variable (if implemented)
export LIYE_EPIPLEXITY_OBSERVE=false
```

### Delete Traces
```bash
rm -rf data/traces/epiplexity/
```

### Impact Assessment
- **Production impact**: NONE (Phase 0-1 is observe-only)
- **Data loss**: Only epiplexity traces (no core data affected)
- **Rollback time**: < 5 minutes

---

## 7. Future Phases (NOT in This PR)

| Phase | Scope | Prerequisite |
|-------|-------|--------------|
| Phase 2 | Pack reranking by VFC | Scale decision from Phase 1 |
| Phase 3 | Skill maturation criteria | Phase 2 success metrics |
| P2 (AGE) | PPC structural playbook | Scale decision from Phase 1 |

---

## References

- Paper: "From Entropy to Epiplexity" (Finzi et al., 2025)
- Contract: `_meta/contracts/epiplexity.contract.yaml`
- Reports: `Artifacts_Vault/reports/PACK_VALUE_FOR_CONTEXT.md`
