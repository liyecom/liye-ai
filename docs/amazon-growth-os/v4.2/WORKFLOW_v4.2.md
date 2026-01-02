# Amazon Growth OS v4.2 WORKFLOW

**Version:** 4.2
**Date:** 2025-12-30
**Status:** Production Ready

---

## Golden Rules

1. **Single Write Path:** `traces/` is the only source of truth
2. **Derived layers are caches:** rebuildable from `traces/` via `scripts/derive_all.sh`
3. **No Trace, No Execution:** Any change without a TRACE will be BLOCKED
4. **Hypotheses, Not Truths:** Priority Score, Intent Fit, Rufus Factor are hypotheses
5. **Freeze Rate > 50%:** North star KPI for operational maturity

---

## P0 Roles

| Agent | Role | Key Output |
|-------|------|------------|
| **Intent Analyst** | 产出意图桶 | `semantic/intent_buckets/{ASIN}/` |
| **Trace Scribe** | 写入路径治理 | `traces/TRACE-*.yaml` |
| **Guardrail Governor** | 护栏执行 | PASS / BLOCK / ESCALATE |

---

## Operating Loop (Weekly)

```
Week Start
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. OBSERVATION (trace_type: observation)                    │
│    - Collect data from uploads/                             │
│    - Extract key metrics                                    │
│    - Detect anomalies                                       │
│    - Evidence: uri + sha256 + captured_at                   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. HYPOTHESIS (trace_type: hypothesis)                      │
│    - Formulate testable hypothesis                          │
│    - Set verification window (7-14 days)                    │
│    - Define success criteria                                │
│    - Register in world_model/experiments/EXP-*.yaml         │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. DECISION (trace_type: decision) + Guardrail Check        │
│    - Consider options                                       │
│    - Select action with rationale                           │
│    - Run through Guardrail Governor                         │
│    - Record priority_score used (hypothesis!)               │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. EXECUTION (recorded in trace.execution)                  │
│    - Apply changes (bid, budget, content)                   │
│    - Record guardrail_check result                          │
│    - Human approval if ESCALATE                             │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. VERIFICATION (fill trace.verification after window)      │
│    - Collect actual outcomes                                │
│    - Compare to expected outcomes                           │
│    - Mark hypothesis: confirmed / rejected / inconclusive   │
│    - Update confidence (+0.10 / -0.15)                      │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. WORLD MODEL UPDATE                                       │
│    - Update hypothesis confidence                           │
│    - Extract patterns to world_model/emerged_patterns/      │
│    - Update causal laws if verified                         │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
Week End → Loop
```

---

## 6 Enhancements (v4.2)

| # | Enhancement | File |
|---|-------------|------|
| 1 | Trace Type Profiles (最小字段集) | `config/amazon-growth/trace_type_profiles.yaml` |
| 2 | Derive All Script (派生层重建) | `scripts/derive_all.sh` |
| 3 | Evidence Pointer (可审计证据) | In `TRACE_TEMPLATE_v4_2.yaml` |
| 4 | Multi-tenant Support (多店铺) | In `TRACE_TEMPLATE_v4_2.yaml` |
| 5 | Experiment Registry (实验登记) | `templates/world_model/EXPERIMENT_TEMPLATE.yaml` |
| 6 | Freeze/Unfreeze Events (事件强制) | `config/amazon-growth/event_clock_rules.yaml` |

---

## Commands

```bash
# Run governance check
./scripts/trace_guard.sh

# Rebuild derived layers from traces/
./scripts/derive_all.sh

# Clean and rebuild
./scripts/derive_all.sh --clean
```

---

## File Structure

```
~/github/liye_os/
├── Agents/amazon-growth/
│   ├── intent-analyst.yaml        # P0
│   ├── trace-scribe.yaml          # P0
│   └── guardrail-governor.yaml    # P0
│
├── config/amazon-growth/
│   ├── guardrails.yaml            # 5层护栏
│   ├── priority_score.yaml        # PS假设参数
│   ├── bucket_lifecycle.yaml      # 意图桶生命周期
│   ├── trace_type_profiles.yaml   # Enhancement 1
│   └── event_clock_rules.yaml     # Enhancement 6
│
├── templates/
│   ├── trace/
│   │   └── TRACE_TEMPLATE_v4_2.yaml
│   └── world_model/
│       ├── HYPOTHESIS_TEMPLATE.yaml
│       └── EXPERIMENT_TEMPLATE.yaml
│
├── scripts/
│   ├── trace_guard.sh             # CI governance
│   └── derive_all.sh              # Enhancement 2
│
└── .github/workflows/
    └── trace-governance-gate.yml  # CI gate

~/Documents/amazon-runtime/        # Runtime directory
├── traces/                        # ✅ Single write path
├── semantic/                      # Derived
├── state/                         # Derived
├── event_clock/                   # Derived (Enhancement 6)
└── world_model/                   # Derived (Enhancement 5)
    └── experiments/               # Experiment registry
```

---

## Next Steps

1. **Week 1:** Single ASIN closed loop
2. **Week 2-3:** Validate hypotheses, expand to 5 ASINs
3. **Week 4:** MVP delivery, pattern extraction
4. **Week 5-10:** Scale to full store

---

*Generated: 2025-12-30*
