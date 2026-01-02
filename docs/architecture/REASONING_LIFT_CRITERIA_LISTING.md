# Reasoning Lift Criteria: Listing Domain

> **Status**: CANONICAL
> **Purpose**: Listing 领域专用 Lift 评价标准
> **Scope**: 仅适用于 Listing Optimization 领域实验
> **Created**: 2025-12-31

---

## Core Principle

> **Listing 是 语义 → 转化 → Rank 的中枢层。**

Listing 的 Lift 判据不同于 PPC/BSR：
- PPC/BSR 评估"行为层"推理质量
- Listing 评估"语义层"推理质量

Listing 机制的 Lift 需要测量：
1. 语义结构是否更精确
2. 转化意图是否更明确
3. 信息效率是否更高
4. 是否能传导到下游信号

---

## Evaluation Dimensions

### Dimension 1: Semantic Coverage Gain (语义覆盖提升)

**定义**: 推理是否明确了 Listing 元素与搜索意图之间的语义映射关系

| Score | Criteria |
|-------|----------|
| LOW | 泛泛提及"要有关键词"、"覆盖搜索词" |
| MEDIUM | 区分了关键词类型（核心词、长尾词、变体词） |
| HIGH | 明确了语义对齐机制：哪些元素覆盖哪类意图，为什么这样分配 |

**指标**:
- 是否区分了"关键词存在"与"语义匹配"
- 是否解释了 A9 索引机制如何响应语义信号
- 是否给出了语义覆盖度的判断标准

---

### Dimension 2: Conversion Intent Match (转化意图匹配)

**定义**: 推理是否将 Listing 元素与用户购买决策路径对齐

| Score | Criteria |
|-------|----------|
| LOW | 仅描述"要写清楚卖点" |
| MEDIUM | 区分了功能卖点 vs 情感卖点 vs 信任信号 |
| HIGH | 明确了用户决策路径：扫描 → 兴趣 → 评估 → 决策，每阶段对应哪些 Listing 元素 |

**指标**:
- 是否理解用户在 Listing 页面的注意力分布
- 是否区分了"说服逻辑"与"信息堆砌"
- 是否给出了转化意图匹配的验证方法

---

### Dimension 3: Information Load Efficiency (信息负荷效率)

**定义**: 推理是否给出了信息密度与认知负荷之间的平衡机制

| Score | Criteria |
|-------|----------|
| LOW | 仅说"不要太长/太短" |
| MEDIUM | 给出了模糊的长度建议（如"5条 Bullet"） |
| HIGH | 给出了信息密度阈值：每条 Bullet 最多 N 个信息点，每个信息点最多 N 词，因为... |

**指标**:
- 是否量化了信息密度边界
- 是否解释了认知负荷导致转化下降的因果链
- 是否区分了"信息完整"与"信息有效"

---

### Dimension 4: Downstream Signal Sensitivity (下游信号敏感度)

**定义**: 推理是否明确了 Listing 变更对 PPC/BSR 的传导机制

| Score | Criteria |
|-------|----------|
| LOW | 将 Listing、PPC、BSR 视为独立问题 |
| MEDIUM | 提及 Listing 影响广告质量分或排名 |
| HIGH | 明确了传导路径：Listing 语义 → CTR/CVR → 质量分 → ACoS / BSR，带具体机制 |

**指标**:
- 是否理解 Listing 是 PPC 和 BSR 的上游变量
- 是否能预测 Listing 变更对广告效果的影响
- 是否给出了 Listing 优化与 PPC/BSR 联动的策略

---

## Scoring Protocol

### Numeric Mapping

| Level | Score |
|-------|-------|
| LOW | 1 |
| MEDIUM | 2 |
| HIGH | 3 |

### Lift Calculation

```
Baseline Score = D1 + D2 + D3 + D4 (max 12)
T1-Enabled Score = D1' + D2' + D3' + D4' (max 12)

Lift = T1-Enabled Score - Baseline Score
```

### Verdict Rules

| Condition | Verdict |
|-----------|---------|
| Lift ≥ 3 AND ≥ 2 dimensions improved | POSITIVE_LIFT |
| Lift = 0 OR < 2 dimensions improved | NEUTRAL |
| Lift < 0 | NEGATIVE_LIFT |

---

## Key Differences from PPC/BSR Criteria

| Aspect | PPC/BSR Criteria | Listing Criteria |
|--------|------------------|------------------|
| Focus | 行为层推理 | 语义层推理 |
| D1 | Causal Explicitness | Semantic Coverage Gain |
| D2 | Assumption Clarity | Conversion Intent Match |
| D3 | Hallucination Risk | Information Load Efficiency |
| D4 | Actionability | Downstream Signal Sensitivity |
| Why Different | PPC/BSR 评估因果链质量 | Listing 评估语义结构质量 |

---

## Usage

```markdown
### Evaluation Template

#### Baseline Condition
- D1 (Semantic Coverage): [LOW/MEDIUM/HIGH] - [reason]
- D2 (Intent Match): [LOW/MEDIUM/HIGH] - [reason]
- D3 (Info Efficiency): [LOW/MEDIUM/HIGH] - [reason]
- D4 (Downstream Signal): [LOW/MEDIUM/HIGH] - [reason]
- Total: X/12

#### T1-Enabled Condition
- D1 (Semantic Coverage): [LOW/MEDIUM/HIGH] - [reason]
- D2 (Intent Match): [LOW/MEDIUM/HIGH] - [reason]
- D3 (Info Efficiency): [LOW/MEDIUM/HIGH] - [reason]
- D4 (Downstream Signal): [LOW/MEDIUM/HIGH] - [reason]
- Total: X/12

#### Verdict
- Lift: +N
- Dimensions Improved: [list]
- Verdict: [POSITIVE_LIFT / NEUTRAL / NEGATIVE_LIFT]
```

---

## References

- `docs/architecture/REASONING_LIFT_CRITERIA.md` - PPC/BSR 通用判据
- `docs/architecture/T1_COVERAGE_MAP.md` - 覆盖地图
- `docs/architecture/T1_MECHANISM_WHITELIST.md` - 机制类型白名单

---

**Version**: 1.0.0
**Created**: 2025-12-31
