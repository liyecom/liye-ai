# Validation Framework (Research Version)

> **Status**: SANITIZED FOR RESEARCH
> **Exposure Level**: E1
> **Created**: 2025-12-31
> **Note**: 已去除具体配置和结果，仅保留方法论框架

---

## Disclaimer

```
本文档仅供研究和方法论学习目的。
已去除所有具体配置、Case 内容和验证结果。
不可直接复用，不构成效果保证。
引用须遵循 CITATION_POLICY.md。
```

---

## Framework Overview

### 什么是验证框架

验证框架是确保 T1 机制质量的系统性方法。

```
┌─────────────────────────────────────────────────────────┐
│                   Validation Framework                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐     ┌─────────────┐     ┌───────────┐ │
│  │   Case      │ ──► │   Lift      │ ──► │ Regression│ │
│  │   Design    │     │ Evaluation  │     │   Gate    │ │
│  └─────────────┘     └─────────────┘     └───────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Case Design Method

### Case 定义

Case 是验证机制有效性的最小单元。

```yaml
case_structure:
  scenario:
    description: "模拟真实业务场景"
    context: "场景背景数据"
    question: "待回答的问题"

  baseline:
    description: "无 T1 机制的输出模式"
    pattern: "通用响应特征"

  t1_enabled:
    description: "有 T1 机制的预期输出"
    mechanisms: "使用的机制列表"
    expectations: "预期改进点"
```

### Case 设计原则

```yaml
design_principles:
  specificity:
    description: "场景必须具体"
    requirement: "有明确的上下文和约束"

  measurability:
    description: "改进必须可度量"
    requirement: "可通过 Lift 维度评估"

  reproducibility:
    description: "结果必须可复现"
    requirement: "同一输入产生一致输出"

  isolation:
    description: "变量必须隔离"
    requirement: "只变化 T1 机制，其他不变"
```

---

## Lift Evaluation Process

### 评估流程

```
┌─────────────────────────────────────────────────────────┐
│                 Lift Evaluation Process                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Step 1: 准备                                            │
│  ├── 选择 Case                                           │
│  ├── 准备输入数据                                        │
│  └── 配置评估环境                                        │
│                                                         │
│  Step 2: 生成                                            │
│  ├── 生成 Baseline 输出                                  │
│  ├── 生成 T1-Enabled 输出                                │
│  └── 记录两个输出                                        │
│                                                         │
│  Step 3: 评估                                            │
│  ├── 按四维度独立评分                                    │
│  ├── 计算 Baseline vs T1 差异                           │
│  └── 判定 Verdict                                       │
│                                                         │
│  Step 4: 记录                                            │
│  ├── 记录评估结果                                        │
│  ├── 归档 Case                                           │
│  └── 更新 Coverage                                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 评估控制

```yaml
evaluation_controls:
  environment:
    - "固定 LLM 配置"
    - "固定随机种子"
    - "固定评估标准"

  process:
    - "独立评估（避免偏见）"
    - "盲评（如可能）"
    - "多轮验证（如需要）"

  documentation:
    - "记录所有参数"
    - "记录评估依据"
    - "记录边界情况"
```

---

## Regression Gate Concept

### 什么是 Regression Gate

Regression Gate 防止机制变更导致 Lift 退化。

```
┌─────────────────────────────────────────────────────────┐
│                    Regression Gate                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  触发条件:                                               │
│  ├── T1 机制修改                                         │
│  ├── 机制版本升级                                        │
│  └── 配置变更                                            │
│                                                         │
│  检查内容:                                               │
│  ├── 相关 Case 的 Lift 是否下降                         │
│  ├── Verdict 是否从 POSITIVE 变为其他                   │
│  └── 是否使用黑名单机制类型                              │
│                                                         │
│  Gate 决策:                                              │
│  ├── PASS: 允许变更                                      │
│  └── FAIL: 阻断变更，需人工审查                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Gate 规则

```yaml
gate_rules:
  verdict_regression:
    description: "Verdict 不能从 POSITIVE 退化"
    action: "FAIL if POSITIVE → NEUTRAL/NEGATIVE"

  lift_threshold:
    description: "Lift 不能显著下降"
    action: "FAIL if drop exceeds threshold"

  blacklist_usage:
    description: "不能使用黑名单机制类型"
    action: "FAIL if blacklist type used"
```

---

## Quality Assurance Cycle

### 持续质量保障

```
┌─────────────────────────────────────────────────────────┐
│              Quality Assurance Cycle                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│       ┌──────────┐                                      │
│       │  Define  │ ◄── 定义新机制                        │
│       └────┬─────┘                                      │
│            │                                            │
│            ▼                                            │
│       ┌──────────┐                                      │
│       │   Test   │ ◄── 设计验证 Case                     │
│       └────┬─────┘                                      │
│            │                                            │
│            ▼                                            │
│       ┌──────────┐                                      │
│       │ Evaluate │ ◄── 评估 Lift                         │
│       └────┬─────┘                                      │
│            │                                            │
│            ▼                                            │
│       ┌──────────┐                                      │
│       │  Protect │ ◄── Gate 保护                         │
│       └────┬─────┘                                      │
│            │                                            │
│            ▼                                            │
│       ┌──────────┐                                      │
│       │ Iterate  │ ◄── 迭代改进                          │
│       └────┬─────┘                                      │
│            │                                            │
│            └──────────────────────────────┐             │
│                                           ▼             │
│                                    (回到 Define)        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Integration Points

### 与其他系统的集成

```yaml
integration:
  ci_cd:
    description: "持续集成中的自动化检查"
    components:
      - "Lift Regression Gate"
      - "Orphan Mechanism Detection"
      - "Version Compatibility Check"

  versioning:
    description: "与版本化系统的集成"
    components:
      - "Case 绑定机制版本"
      - "版本升级触发重验"

  audit:
    description: "审计日志"
    components:
      - "验证结果记录"
      - "Gate 决策记录"
```

---

## Usage Restrictions

```
❌ 具体 Case 内容已去除
❌ 具体验证结果已去除
❌ 具体配置已去除
❌ 不可直接作为实现模板
❌ 不可用于自动化执行
```

---

**Version**: 1.0.0 (Research Sanitized)
**Original Source**: P0_5_LIFT_REPRODUCTION.md, lift_regression_gate.py (Internal)
