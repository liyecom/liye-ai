# P1: Mechanism Deepening Sprint

> **Status**: ACTIVE
> **Purpose**: 将 Verified Domains 升级为「机制完整、可扩展、可复用」
> **Created**: 2025-12-31
> **Phase Priority**: Depth > Breadth

---

## Core Principle

> **P1 的目标是机制深度，不是领域扩展。**

P0/P0.5 已完成：
- 3 个 Domain 验证 Positive Lift
- 6 个 Repro Case 锁定
- Regression Gate 在 CI 生效

P1 的任务是：把这 3 个 Domain 从「可验证」升级为「机制完整」。

---

## Scope Constraints

### P1 允许做的事

| Activity | Status | 说明 |
|----------|--------|------|
| 深化已验证 Domain 机制 | ✅ 必须 | PPC/BSR/Listing |
| 新增绑定 Case | ✅ 必须 | 每机制至少 1 Case |
| 扩展 Repro Pack v2 | ✅ 必须 | 保留 v1，扩展 v2 |
| 更新 Regression Gate | ✅ 必须 | 增加孤立机制检查 |

### P1 明确禁止的事

| Activity | Status | 说明 |
|----------|--------|------|
| 新增 Domain | ❌ 禁止 | Keyword Research / A+ Content 等 |
| 接入 External LLM | ❌ 禁止 | 引入不可控变量 |
| 产品化 / UI | ❌ 禁止 | 未达交付成熟度 |
| 对外文案 / 宣传 | ❌ 禁止 | 内部能力积累阶段 |
| 主观优化 | ❌ 禁止 | "感觉上更好"不可接受 |

---

## Domain Targets

### PPC Domain

**Current**: 4 T1 units (Campaign Structure, Keyword Bundling, Budget Allocation)

**Target**: ≥ 8 T1 units

**New Mechanisms**:
1. Bid Strategy Escalation Logic
2. Negative Keyword Suppression Mechanism
3. Match Type Intent Drift Control
4. Budget Saturation Detection

### BSR Domain

**Current**: 5 T1 units (Buy Box Mechanism, Price Suppression)

**Target**: ≥ 8 T1 units

**New Mechanisms**:
1. Sales Velocity Acceleration
2. Conversion Rank Elasticity
3. Review Momentum Threshold
4. Price-Conversion Coupling

### Listing Domain

**Current**: 4 T1 units (Semantic Alignment, Title Tradeoff, Bullet Density, Image-Text)

**Target**: ≥ 8 T1 units

**New Mechanisms**:
1. Bullet Role Differentiation
2. Redundancy Suppression
3. Visual Intent Anchoring
4. Above-the-Fold Semantic Priority

**Explicitly Forbidden in Listing**:
- "最佳写法"
- "推荐句式"
- "模版内容"

---

## Mechanism File Schema

每个机制文件必须包含：

```json
{
  "id": "mechanism_xxx",
  "domain": "ppc | bsr | listing",
  "mechanism_type": "causal_chain | threshold_rule | failure_mode | optimization_tradeoff | constraint | platform_mechanism",
  "trigger_conditions": ["condition_1", "condition_2"],
  "expected_effect": "描述机制触发后的预期结果",
  "boundary_conditions": ["边界条件1", "边界条件2"],
  "whitelist_reference": "T1_MECHANISM_WHITELIST.md",
  "bound_cases": ["case_id_1", "case_id_2"],
  "locked": false
}
```

---

## Case Binding Rules

### 绑定要求

1. 每新增 1 个机制 → 至少新增 1 个 Case
2. Case 必须进入 Repro Pack v2
3. Case 必须通过 Regression Gate

### 禁止孤立机制

```
孤立机制 = mechanism.bound_cases.length === 0
```

Regression Gate 将拒绝无绑定 Case 的机制。

---

## Repro Pack Strategy

### v1 (Frozen)

- 6 cases 锁定不变
- 作为回归基准

### v2 (Expandable)

- 新增机制绑定 Case
- 每 Domain ≥ 4 POSITIVE_LIFT cases

---

## Success Criteria (DoD)

P1 视为完成，当且仅当：

```
✅ 每个 Domain ≥ 8 个 T1 Mechanisms
✅ 每个 Domain ≥ 4 个 POSITIVE_LIFT Case
✅ Repro Pack v2 全部 PASS
✅ Regression Gate 无例外放行
✅ 无孤立机制
```

---

## Depth Levels

| Level | Criteria |
|-------|----------|
| SHALLOW | < 4 mechanisms, < 2 cases |
| CORE | 4-7 mechanisms, 2-3 cases |
| DEEP | ≥ 8 mechanisms, ≥ 4 cases |

**P1 Target**: All 3 Domains reach DEEP level.

---

## Governance

### Mechanism Addition Gate

新增机制必须：
1. 符合 T1_MECHANISM_WHITELIST.md
2. 绑定至少 1 个 Case
3. 标记 domain
4. 通过 Regression Gate

### No Subjective Optimization

以下表述不可接受：
- "这样写更好"
- "建议使用..."
- "通常效果更佳"

必须：
- 有明确触发条件
- 有可验证效果
- 有边界条件

---

## References

- `docs/architecture/P0_5_LIFT_REPRODUCTION.md` - P0.5 阶段
- `docs/architecture/T1_MECHANISM_WHITELIST.md` - 机制白名单
- `experiments/repro_pack_v1/` - v1 基准
- `scripts/lift_regression_gate.py` - 回归 Gate

---

**Version**: 1.0.0
**Created**: 2025-12-31
