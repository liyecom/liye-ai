# Mechanism Taxonomy (Research Version)

> **Status**: SANITIZED FOR RESEARCH
> **Exposure Level**: E1
> **Created**: 2025-12-31
> **Note**: 已去除具体阈值和参数，仅保留分类框架

---

## Disclaimer

```
本文档仅供研究和方法论学习目的。
已去除所有具体阈值、参数和实现细节。
不可直接复用，不构成效果保证。
引用须遵循 CITATION_POLICY.md。
```

---

## Taxonomy Overview

### 什么是 T1 机制

T1 机制是编码因果逻辑的知识单元，具有：

- **明确的因果链**：输入 → 过程 → 输出
- **可验证的边界**：适用条件明确
- **可度量的效果**：可通过 Lift 验证

### 机制类型分类

```
┌─────────────────────────────────────────────────────────┐
│                   Mechanism Taxonomy                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Causal Chain (因果链)                               │
│     └── 描述 A → B → C 的因果传导                       │
│                                                         │
│  2. Threshold Rule (阈值规则)                           │
│     └── 描述临界点触发的行为变化                         │
│                                                         │
│  3. Failure Mode (失效模式)                             │
│     └── 描述错误如何产生和传播                           │
│                                                         │
│  4. Optimization Tradeoff (优化权衡)                    │
│     └── 描述多目标间的取舍关系                           │
│                                                         │
│  5. Constraint (约束)                                   │
│     └── 描述必须遵守的限制条件                           │
│                                                         │
│  6. Platform Mechanism (平台机制)                       │
│     └── 描述平台规则驱动的行为                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Type Definitions

### 1. Causal Chain (因果链)

**定义**: 描述变量间因果传导的机制

**结构**:
```
Trigger → Intermediate Effect → Final Effect
```

**特征**:
- 明确的因果方向
- 可追踪的传导路径
- 可验证的效果关系

**示例模式**（去除具体值）:
```
[输入变化] → [中间状态变化] → [最终指标变化]
```

---

### 2. Threshold Rule (阈值规则)

**定义**: 描述临界点触发状态变化的机制

**结构**:
```
Condition < Threshold → State A
Condition ≥ Threshold → State B
```

**特征**:
- 存在明确的临界点
- 跨越临界点后行为突变
- 可用于决策边界定义

**示例模式**（阈值已去除）:
```
[度量] 低于临界点 → [状态 A]
[度量] 达到临界点 → [状态 B]
```

---

### 3. Failure Mode (失效模式)

**定义**: 描述错误产生和传播的机制

**结构**:
```
Root Cause → Error Propagation → Observable Symptom
```

**特征**:
- 根因可追溯
- 传播路径可识别
- 症状可观察

**示例模式**:
```
[根本原因] → [错误扩散] → [可观察症状]
```

---

### 4. Optimization Tradeoff (优化权衡)

**定义**: 描述多目标间取舍关系的机制

**结构**:
```
Optimize(Objective A) ↔ Sacrifice(Objective B)
```

**特征**:
- 存在竞争目标
- 需要权衡决策
- 有边际效应

**示例模式**:
```
[目标 A 优化] ←→ [目标 B 牺牲]
寻找平衡点
```

---

### 5. Constraint (约束)

**定义**: 描述必须遵守的限制条件

**结构**:
```
Action must satisfy Constraint
Violation → Penalty
```

**特征**:
- 明确的规则边界
- 违反有明确后果
- 可用于合规检查

**示例模式**:
```
[操作] 必须满足 [约束]
违反 → [惩罚]
```

---

### 6. Platform Mechanism (平台机制)

**定义**: 描述平台规则驱动行为的机制

**结构**:
```
Platform Rule → Observed Behavior → Strategic Response
```

**特征**:
- 由平台规则驱动
- 需要观察和适应
- 可能随平台更新变化

**示例模式**:
```
[平台规则] → [可观察行为] → [应对策略]
```

---

## Type Selection Guide

### 如何选择机制类型

```yaml
selection_guide:
  causal_chain:
    when: "需要解释'为什么 A 导致 B'"
    question: "什么因素通过什么路径影响结果？"

  threshold_rule:
    when: "需要定义'什么时候采取行动'"
    question: "什么条件触发状态变化？"

  failure_mode:
    when: "需要诊断'为什么出错了'"
    question: "错误从哪里开始如何传播？"

  optimization_tradeoff:
    when: "需要权衡'要这个还是那个'"
    question: "如何在竞争目标间取得平衡？"

  constraint:
    when: "需要明确'必须遵守什么'"
    question: "什么是不可违反的规则？"

  platform_mechanism:
    when: "需要理解'平台为什么这样'"
    question: "平台规则如何影响行为？"
```

---

## Quality Criteria

### 机制质量标准

```yaml
quality_criteria:
  causal_explicitness:
    definition: "因果关系的清晰程度"
    high: "因果链完整、可追踪"
    low: "因果关系模糊或缺失"

  boundary_clarity:
    definition: "边界条件的明确程度"
    high: "边界条件具体、可验证"
    low: "边界条件模糊或缺失"

  actionability:
    definition: "可执行性"
    high: "可直接指导行动"
    low: "过于抽象无法行动"

  testability:
    definition: "可测试性"
    high: "可通过 Case 验证"
    low: "无法设计验证 Case"
```

---

## Usage Restrictions

```
❌ 具体阈值已去除
❌ 具体参数已去除
❌ 具体实现已去除
❌ 不可直接作为机制模板
❌ 不可用于自动化执行
```

---

**Version**: 1.0.0 (Research Sanitized)
**Original Source**: T1_MECHANISM_WHITELIST.md (Internal)
