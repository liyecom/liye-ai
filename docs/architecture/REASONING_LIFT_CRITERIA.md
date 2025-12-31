# Reasoning Lift Criteria

> **Status**: CANONICAL
> **Purpose**: 可复用的推理增益评估标准
> **Usage**: T1 reasoning substrate 效果验证

---

## Overview

本文档定义了评估 T1 作为 reasoning substrate 是否产生推理增益的标准。

评估采用定性三档制：**High / Medium / Low**

---

## Evaluation Dimensions

### 1. Causal Explicitness (因果明确性)

> 推理是否明确说明因果关系？

| Level | Description |
|-------|-------------|
| **High** | 明确使用"因为...所以..."、"导致"、"由于"等因果句式；因果链条完整可追溯 |
| **Medium** | 存在因果暗示但未显式表达；部分因果链条缺失 |
| **Low** | 无因果说明；仅陈述结论；因果关系需要读者自行推断 |

**评估问题**：
- 推理中是否每个结论都有明确的原因？
- 因果链条是否可以反向追溯？
- 是否存在"跳跃式"结论？

---

### 2. Assumption Clarity (假设显式性)

> 推理是否显式列出前提假设？

| Level | Description |
|-------|-------------|
| **High** | 显式列出所有关键假设；说明假设的来源和边界条件 |
| **Medium** | 部分假设被提及；但存在隐含假设未说明 |
| **Low** | 无假设说明；推理建立在隐含前提上；读者无法判断适用范围 |

**评估问题**：
- 推理依赖哪些前提条件？
- 这些前提是否被显式说明？
- 是否说明了结论的适用边界？

---

### 3. Hallucination Risk (幻觉风险)

> 推理是否包含不可验证的断言？

| Level | Description |
|-------|-------------|
| **High** | 存在多个不可验证断言；引用不存在的数据/来源；自信地陈述虚假信息 |
| **Medium** | 少量模糊断言；过度泛化；缺乏具体支撑 |
| **Low** | 所有断言均可验证或明确标注为推测；不确定性被恰当表达 |

**评估问题**：
- 是否存在"据统计..."但无来源的断言？
- 是否有不可能知道的细节被断言为事实？
- 推测性内容是否被标注为推测？

**注意**：此维度使用 **Low = Good, High = Bad** 的反向评分。

---

### 4. Actionability (可执行性)

> 推理结论是否可转化为可执行策略？

| Level | Description |
|-------|-------------|
| **High** | 结论可直接转化为行动步骤；包含具体数值/阈值；说明执行条件 |
| **Medium** | 结论指明方向但缺乏具体步骤；需要进一步细化才能执行 |
| **Low** | 结论过于抽象；无法转化为行动；仅为观点陈述 |

**评估问题**：
- 读完推理后，用户知道下一步该做什么吗？
- 结论是否包含可量化的指标或阈值？
- 是否说明了执行的前提条件？

---

## Scoring Summary

| Dimension | Good Direction | Ideal Target |
|-----------|----------------|--------------|
| Causal Explicitness | High | High |
| Assumption Clarity | High | High |
| Hallucination Risk | Low | Low |
| Actionability | High | High |

---

## Reasoning Lift Definition

**Reasoning Lift** = T1-Enabled 组相比 Baseline 组的评分提升。

```
Lift = Score(T1-Enabled) - Score(Baseline)
```

### Lift 判定标准

| Lift Result | Interpretation |
|-------------|----------------|
| **Positive Lift** | 至少 2 个维度提升，且无维度下降 |
| **Neutral** | 提升和下降维度数量相当 |
| **Negative Lift** | 多个维度下降，或 Hallucination Risk 上升 |

---

## Evaluation Template

```markdown
## Case: [案例名称]

### Baseline Evaluation
| Dimension | Level | Notes |
|-----------|-------|-------|
| Causal Explicitness | | |
| Assumption Clarity | | |
| Hallucination Risk | | |
| Actionability | | |

### T1-Enabled Evaluation
| Dimension | Level | Notes |
|-----------|-------|-------|
| Causal Explicitness | | |
| Assumption Clarity | | |
| Hallucination Risk | | |
| Actionability | | |

### Lift Summary
| Dimension | Baseline | T1-Enabled | Lift |
|-----------|----------|------------|------|
| Causal Explicitness | | | |
| Assumption Clarity | | | |
| Hallucination Risk | | | |
| Actionability | | | |

**Overall Lift**: [Positive / Neutral / Negative]
```

---

## Anti-Patterns

### 评估时应避免

| Anti-Pattern | 说明 |
|--------------|------|
| 以长度判质量 | 更长的回答不等于更好的推理 |
| 以流畅度判质量 | 语言流畅不等于逻辑严密 |
| 主观偏好 | 必须基于上述四维度评估 |
| 结论导向 | 不因"结论正确"而忽视推理过程缺陷 |

---

## References

- `docs/architecture/T1_CANONICAL_DEFINITION.md` - T1 定义
- `docs/architecture/T1_CONSUMPTION_RULES.md` - T1 消费规则
- `experiments/reasoning_comparison/` - 对照实验结果

---

**Version**: 1.0.0
**Created**: 2025-12-30
