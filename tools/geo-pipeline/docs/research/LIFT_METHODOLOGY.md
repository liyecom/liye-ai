# Lift Methodology (Research Version)

> **Status**: SANITIZED FOR RESEARCH
> **Exposure Level**: E1
> **Created**: 2025-12-31
> **Note**: 已去除具体结果和权重，仅保留方法论框架

---

## Disclaimer

```
本文档仅供研究和方法论学习目的。
已去除所有具体 Lift 结果、权重和阈值。
不可直接复用，不构成效果保证。
引用须遵循 CITATION_POLICY.md。
```

---

## What is Lift

### Lift 定义

Lift 是衡量 T1 机制对推理质量提升程度的度量。

```
Lift = T1-Enabled Output Quality - Baseline Output Quality
```

### Lift 的意义

- **验证机制有效性**：机制是否真的改善推理
- **防止质量退化**：检测机制变更的负面影响
- **指导机制优化**：识别改进方向

---

## Lift Dimensions

### 四维度评估框架

```
┌─────────────────────────────────────────────────────────┐
│                   Lift Dimensions                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Causal Explicitness (因果明确性)                    │
│     衡量推理中因果链的清晰程度                           │
│                                                         │
│  2. Assumption Clarity (假设清晰度)                     │
│     衡量推理依赖假设的显式程度                           │
│                                                         │
│  3. Hallucination Risk (幻觉风险)                       │
│     衡量推理偏离事实的风险程度                           │
│                                                         │
│  4. Actionability (可行动性)                            │
│     衡量推理结论的可执行程度                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Dimension Definitions

### 1. Causal Explicitness (因果明确性)

**定义**: 推理输出中因果关系的明确程度

**评估问题**:
- 因果链是否完整？
- 传导机制是否明确？
- 是否有模糊的因果跳跃？

**高分特征**:
```
✓ 明确的 A → B → C 链条
✓ 每一步都有机制解释
✓ 无模糊的"所以"跳跃
```

**低分特征**:
```
✗ 直接从输入跳到结论
✗ 使用"显然"、"自然"等模糊词
✗ 因果方向不明确
```

---

### 2. Assumption Clarity (假设清晰度)

**定义**: 推理所依赖假设的显式程度

**评估问题**:
- 假设是否被明确列出？
- 假设的适用边界是否清晰？
- 假设违反时的后果是否说明？

**高分特征**:
```
✓ 明确列出所有关键假设
✓ 说明假设的适用范围
✓ 提示假设失效的情况
```

**低分特征**:
```
✗ 隐含假设未说明
✗ 边界条件模糊
✗ 假设失效无警告
```

---

### 3. Hallucination Risk (幻觉风险)

**定义**: 推理偏离事实或机制定义的风险

**评估问题**:
- 推理是否基于定义的机制？
- 是否引入了未定义的内容？
- 是否有自由发挥的成分？

**高分特征**（低风险）:
```
✓ 严格基于 T1 机制
✓ 无自创概念或规则
✓ 无主观臆断
```

**低分特征**（高风险）:
```
✗ 引入未定义的概念
✗ 自创规则或阈值
✗ 主观判断无依据
```

---

### 4. Actionability (可行动性)

**定义**: 推理结论的可执行程度

**评估问题**:
- 建议是否具体可执行？
- 是否有明确的下一步？
- 优先级是否明确？

**高分特征**:
```
✓ 具体的行动建议
✓ 明确的优先级
✓ 可度量的预期效果
```

**低分特征**:
```
✗ 过于抽象的建议
✗ 无优先级指引
✗ 无法验证的结论
```

---

## Evaluation Method

### 评估流程

```
┌─────────────────────────────────────────────────────────┐
│                   Lift Evaluation Flow                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. 准备阶段                                             │
│     ├── 定义 Case 场景                                   │
│     ├── 准备 Baseline 条件                               │
│     └── 准备 T1-Enabled 条件                             │
│                                                         │
│  2. 生成阶段                                             │
│     ├── 生成 Baseline 输出                               │
│     └── 生成 T1-Enabled 输出                             │
│                                                         │
│  3. 评估阶段                                             │
│     ├── 四维度独立评分                                   │
│     ├── 计算维度差异                                     │
│     └── 判定 Lift Verdict                               │
│                                                         │
│  4. 记录阶段                                             │
│     ├── 记录评估结果                                     │
│     └── 归档为 Case Baseline                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 评估条件控制

```yaml
control_requirements:
  baseline:
    - 无 T1 机制输入
    - 使用通用知识
    - 记录输出

  t1_enabled:
    - 显式提供 T1 机制
    - 使用机制逻辑
    - 记录输出

  comparison:
    - 同一评估者
    - 同一评估标准
    - 盲评（如可能）
```

---

## Verdict Classification

### Lift 判定

```yaml
verdict_types:
  POSITIVE_LIFT:
    definition: "T1 显著提升推理质量"
    criteria: "多维度正向提升"

  NEUTRAL:
    definition: "T1 对推理质量无显著影响"
    criteria: "维度变化不显著"

  NEGATIVE_LIFT:
    definition: "T1 降低推理质量"
    criteria: "多维度负向变化"
    action: "需调查原因"
```

---

## Regression Protection

### 防止 Lift 退化

```yaml
regression_protection:
  gate_trigger:
    - 机制修改
    - 版本升级
    - 配置变更

  gate_action:
    - 重新评估相关 Case
    - 比较新旧 Lift
    - 阻断显著退化
```

---

## Usage Restrictions

```
❌ 具体 Lift 数值已去除
❌ 具体权重已去除
❌ 具体 Case 结果已去除
❌ 不可用于效果承诺
❌ 不可用于自动化决策
```

---

**Version**: 1.0.0 (Research Sanitized)
**Original Source**: REASONING_LIFT_CRITERIA.md (Internal)
