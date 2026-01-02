# T1 Coverage Map

> **Status**: CANONICAL
> **Purpose**: T1 扩展优先级决策依据
> **Last Updated**: 2025-12-31 (P1 Complete)

---

## Core Principle

> **T1 扩展优先级 = Lift 已验证 × Coverage 空白度**

T1 扩展不是"抓更多内容"，而是"补机制空白"。

优先扩展：
1. 已验证 Lift 的领域中的空白子领域
2. 与已验证领域相邻的高价值领域

---

## Coverage Overview

| Domain | Depth Level | Mechanisms | Lift Verified | Verified Cases | Repro Status | Priority |
|--------|-------------|------------|---------------|----------------|--------------|----------|
| PPC / Advertising | DEEP | 8 | ✅ YES | 6 | STABLE | ✅ P1 Done |
| BSR / Ranking | DEEP | 8 | ✅ YES | 6 | STABLE | ✅ P1 Done |
| Listing Optimization | DEEP | 8 | ✅ YES | 6 | STABLE | ✅ P1 Done |
| Keyword Research | EMPTY | 0 | ❌ NO | 0 | - | P2 |
| A+ Content | EMPTY | 0 | ❌ NO | 0 | - | P2 |
| Cross-Platform | SHALLOW | 3 | ❌ NO | 0 | UNSTABLE | P3 |
| Influencer Marketing | SHALLOW | 3 | ❌ NO | 0 | UNSTABLE | P3 |
| FBA Operations | SHALLOW | 2 | ❌ NO | 0 | UNSTABLE | P3 |

### Depth Level Legend

- **DEEP**: ≥8 mechanisms, ≥4 POSITIVE_LIFT cases — P1 complete, ready for productization gate
- **CORE**: 4-7 mechanisms, some Lift verification — needs deepening
- **SHALLOW**: <4 mechanisms — not suitable for production
- **EMPTY**: 0 mechanisms — no coverage

### Repro Status Legend

- **STABLE**: Lift 在 Repro Pack 中经过验证，Regression Gate 保护
- **UNSTABLE**: 有 T1 覆盖但未经 Lift 验证，可能存在回归风险
- **-**: 无覆盖，无 Repro 需求

---

## Domain Detail

### PPC / Advertising

**Coverage**: DEEP (8 mechanisms, P1 complete)

| Sub-domain | Status | T1 Units | Bound Cases |
|------------|--------|----------|-------------|
| Bid Strategy Escalation | ✅ COVERED | 1 | case_08 |
| Negative Keyword Suppression | ✅ COVERED | 1 | case_09 |
| Match Type Drift Control | ✅ COVERED | 1 | case_10 |
| Budget Saturation Detection | ✅ COVERED | 1 | case_11 |
| Campaign Structure | ✅ COVERED | 2 | case_01, case_05 |
| Keyword Bundling | ✅ COVERED | 1 | - |
| Budget Allocation | ✅ COVERED | 1 | - |

**Mechanism Files**: `src/domain/geo-os/data/t1_units/ppc/`
- `bid_strategy_escalation.json`
- `negative_keyword_suppression.json`
- `match_type_drift_control.json`
- `budget_saturation_detection.json`

**Lift Verified**: ✅ YES (6 cases, avg +4 lift)

**Status**: ✅ P1 Complete - Ready for productization gate

---

### BSR / Ranking

**Coverage**: DEEP (8 mechanisms, P1 complete)

| Sub-domain | Status | T1 Units | Bound Cases |
|------------|--------|----------|-------------|
| Sales Velocity Acceleration | ✅ COVERED | 1 | case_12 |
| Conversion Rank Elasticity | ✅ COVERED | 1 | case_13 |
| Review Momentum Threshold | ✅ COVERED | 1 | case_14 |
| Price-Conversion Coupling | ✅ COVERED | 1 | case_15 |
| Buy Box Mechanism | ✅ COVERED | 2 | case_03, case_06 |
| Price Suppression | ✅ COVERED | 2 | - |

**Mechanism Files**: `src/domain/geo-os/data/t1_units/bsr/`
- `velocity_acceleration.json`
- `conversion_elasticity.json`
- `review_momentum_threshold.json`
- `price_conversion_coupling.json`

**Lift Verified**: ✅ YES (6 cases, avg +4 lift)

**Status**: ✅ P1 Complete - Ready for productization gate

---

### Listing Optimization

**Coverage**: DEEP (8 mechanisms, P1 complete)

| Sub-domain | Status | T1 Units | Bound Cases |
|------------|--------|----------|-------------|
| Bullet Role Differentiation | ✅ COVERED | 1 | case_16 |
| Information Redundancy Suppression | ✅ COVERED | 1 | case_17 |
| Visual-Intent Anchoring | ✅ COVERED | 1 | case_18 |
| Above-Fold Semantic Priority | ✅ COVERED | 1 | case_19 |
| Query-Bullet Semantic Alignment | ✅ COVERED | 1 | case_04 |
| Title Compression vs Recall | ✅ COVERED | 1 | case_07 |
| Bullet Information Density | ✅ COVERED | 1 | - |
| Image-Text Intent Consistency | ✅ COVERED | 1 | - |

**Mechanism Files**: `src/domain/geo-os/data/t1_units/listing/`
- `bullet_role_differentiation.json`
- `redundancy_suppression.json`
- `visual_intent_anchoring.json`
- `fold_semantic_priority.json`

**Lift Verified**: ✅ YES (6 cases, avg +4.5 lift, highest +7)

**Status**: ✅ P1 Complete - Ready for productization gate

---

### Keyword Research

**Coverage**: EMPTY

| Sub-domain | Status | T1 Units | Gap |
|------------|--------|----------|-----|
| Search Volume Analysis | ❌ EMPTY | 0 | 需补充搜索量解读机制 |
| Relevance Scoring | ❌ EMPTY | 0 | 需补充相关性评估 |
| Competition Analysis | ❌ EMPTY | 0 | 需补充竞争度判断 |
| Long-tail Strategy | ❌ EMPTY | 0 | 需补充长尾词策略 |

**Lift Verified**: ❌ NO

**Expansion Priority**: P1 - 与 PPC 和 Listing 强相关

---

### A+ Content

**Coverage**: EMPTY

| Sub-domain | Status | T1 Units | Gap |
|------------|--------|----------|-----|
| Module Selection | ❌ EMPTY | 0 | 需补充模块选择机制 |
| Conversion Impact | ❌ EMPTY | 0 | 需补充转化提升机制 |
| Brand Story | ❌ EMPTY | 0 | 需补充品牌叙事机制 |

**Lift Verified**: ❌ NO

**Expansion Priority**: P2 - 转化优化子领域

---

### Cross-Platform

**Coverage**: PARTIAL

| Sub-domain | Status | T1 Units | Gap |
|------------|--------|----------|-----|
| TikTok Shop | ✅ COVERED | 8 | - |
| Content Repurposing | ✅ COVERED | 3 | - |
| MCF Integration | ✅ COVERED | 2 | - |
| Platform Arbitrage | ❌ EMPTY | 0 | 需补充跨平台定价 |

**Lift Verified**: ❌ NO

**Expansion Priority**: P3 - 非核心领域

---

### Influencer Marketing

**Coverage**: PARTIAL

| Sub-domain | Status | T1 Units | Gap |
|------------|--------|----------|-----|
| Product Selection | ✅ COVERED | 5 | - |
| Commission Strategy | ✅ COVERED | 3 | - |
| Content Format | ✅ COVERED | 4 | - |
| Algorithm Optimization | ✅ COVERED | 3 | - |

**Lift Verified**: ❌ NO

**Expansion Priority**: P3 - 覆盖较完整但未验证 Lift

---

### FBA Operations

**Coverage**: PARTIAL

| Sub-domain | Status | T1 Units | Gap |
|------------|--------|----------|-----|
| Fulfillment Errors | ✅ COVERED | 3 | - |
| Refund Fraud | ✅ COVERED | 2 | - |
| Inventory Management | ❌ EMPTY | 0 | 需补充库存策略 |
| Shipping Optimization | ❌ EMPTY | 0 | 需补充物流优化 |

**Lift Verified**: ❌ NO

**Expansion Priority**: P2 - 运营效率领域

---

## Expansion Roadmap

### Phase 1: 填补已验证领域的空白 (Priority P0-P1)

| Domain | Target Coverage | Estimated Units |
|--------|-----------------|-----------------|
| Listing Optimization | PARTIAL → FULL | +15-20 units |
| Keyword Research | EMPTY → PARTIAL | +10-15 units |
| PPC: Bid Strategy | EMPTY → COVERED | +5-8 units |
| BSR: Ranking Factors | EMPTY → COVERED | +5-8 units |

### Phase 2: 扩展相邻领域 (Priority P2)

| Domain | Target Coverage | Estimated Units |
|--------|-----------------|-----------------|
| A+ Content | EMPTY → PARTIAL | +8-10 units |
| FBA Operations | PARTIAL → FULL | +8-10 units |

### Phase 3: 验证新领域 Lift (Priority P3)

| Domain | Action |
|--------|--------|
| Cross-Platform | 设计 Lift 实验 |
| Influencer Marketing | 设计 Lift 实验 |

---

## Coverage Metrics

### Current State (P1 Complete - 2025-12-31)

```
Total Domains: 8
DEEP Coverage: 3 (PPC, BSR, Listing) ✅ P1 Complete
CORE Coverage: 0
SHALLOW Coverage: 3 (Cross-Platform, Influencer, FBA)
EMPTY Coverage: 2 (Keyword Research, A+ Content)

Total Mechanisms: 24 (PPC: 8, BSR: 8, Listing: 8)
Total Cases: 18 (Repro Pack v1: 6, Repro Pack v2: 12)
Lift Verified Domains: 3
Avg Lift Score: +4.2

P1 DoD Status:
✅ Each verified domain ≥8 mechanisms
✅ Each verified domain ≥4 POSITIVE_LIFT cases
✅ All mechanisms bound to cases (no orphans)
✅ Regression Gate coverage complete
```

### P2 Target State

```
Total Domains: 8
DEEP Coverage: 4 (+Keyword Research)
CORE Coverage: 1 (A+ Content)
SHALLOW Coverage: 3
EMPTY Coverage: 0

Lift Verified Domains: 4
```

---

## Decision Rules

### When to Expand a Domain

1. Domain is EMPTY and blocks verified Lift domains
2. Domain has verified Lift but PARTIAL coverage
3. Domain is strongly adjacent to verified domains

### When NOT to Expand a Domain

1. Domain has no clear causal mechanisms (content-only)
2. Domain Lift has not been verified and no adjacent verified domain
3. Expansion would dilute T1 quality

---

## References

- `experiments/reasoning_comparison/evaluation_summary.md` - Lift 验证结果
- `docs/architecture/T1_CANONICAL_DEFINITION.md` - T1 定义
- `docs/architecture/T1_MECHANISM_WHITELIST.md` - 机制类型白名单

---

**Version**: 1.0.0
**Created**: 2025-12-31
