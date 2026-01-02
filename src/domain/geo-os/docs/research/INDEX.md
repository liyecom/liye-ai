# Research Artifacts Index

> **Status**: CANONICAL
> **Purpose**: 可公开研究产物索引
> **Exposure Level**: E1 (Research Disclosure)
> **Created**: 2025-12-31

---

## Overview

本索引列出所有可用于研究目的的公开产物。

```
┌─────────────────────────────────────────────────────────┐
│                   重要声明                               │
│                                                         │
│ 本索引中的产物仅供研究和方法论学习目的。                  │
│ 所有内容均已去除具体数值和可执行参数。                    │
│                                                         │
│ ❌ 不可直接复用                                          │
│ ❌ 不可作为效果承诺                                      │
│ ❌ 不可用于自动化执行                                    │
│                                                         │
│ 引用须遵循 CITATION_POLICY.md                           │
└─────────────────────────────────────────────────────────┘
```

---

## Available Artifacts

### 1. Coverage Map (Sanitized)

**文件**: `research/COVERAGE_MAP_RESEARCH.md`

**内容**:
- 机制覆盖领域概览
- 领域间关系图
- 覆盖深度分级定义

**已去除**:
- 具体机制数量
- 具体 Lift 数值
- Case 详细结果

```yaml
artifact:
  name: "Coverage Map (Sanitized)"
  type: "Methodology Overview"
  exposure: "E1"
  restrictions:
    - "No specific counts"
    - "No lift values"
    - "No case results"
```

---

### 2. Mechanism Taxonomy

**文件**: `research/MECHANISM_TAXONOMY.md`

**内容**:
- 机制类型分类法
- 类型定义和特征
- 类型间关系

**已去除**:
- 具体阈值
- 具体参数
- 实现细节

```yaml
artifact:
  name: "Mechanism Taxonomy"
  type: "Classification Framework"
  exposure: "E1"
  included_types:
    - causal_chain
    - threshold_rule
    - failure_mode
    - optimization_tradeoff
    - constraint
    - platform_mechanism
  restrictions:
    - "No thresholds"
    - "No parameters"
    - "No implementation"
```

---

### 3. Lift Methodology

**文件**: `research/LIFT_METHODOLOGY.md`

**内容**:
- Lift 验证维度定义
- 评估方法论
- 质量度量框架

**已去除**:
- 具体 Lift 结果
- Case 具体数据
- 阈值和权重

```yaml
artifact:
  name: "Lift Methodology"
  type: "Validation Framework"
  exposure: "E1"
  dimensions:
    - Causal Explicitness
    - Assumption Clarity
    - Hallucination Risk
    - Actionability
  restrictions:
    - "No specific results"
    - "No case data"
    - "No weights"
```

---

### 4. Validation Framework

**文件**: `research/VALIDATION_FRAMEWORK.md`

**内容**:
- 机制验证流程
- Case 设计方法
- 回归保护机制

**已去除**:
- 具体 Case 内容
- 验证结果
- 内部配置

```yaml
artifact:
  name: "Validation Framework"
  type: "Quality Assurance Method"
  exposure: "E1"
  components:
    - Case Design Method
    - Lift Evaluation Process
    - Regression Gate Concept
  restrictions:
    - "No case content"
    - "No results"
    - "No config"
```

---

## Artifact Creation Rules

### 创建新研究产物

新增研究产物必须：

1. 经过去敏处理（sanitization）
2. 去除所有具体数值
3. 去除所有可执行参数
4. 添加使用限制说明
5. 更新本索引

### 去敏检查清单

```yaml
sanitization_checklist:
  - [ ] 无具体机制阈值
  - [ ] 无具体 Lift 数值
  - [ ] 无具体 Case 结果
  - [ ] 无可执行代码
  - [ ] 无内部配置
  - [ ] 无参数定义
  - [ ] 有使用限制声明
  - [ ] 有引用要求说明
```

---

## Access Control

### 谁可以访问

| 受众 | 访问权限 |
|------|----------|
| 研究者 | ✅ 可阅读、可引用 |
| 高级从业者 | ✅ 可阅读、可参考 |
| 一般用户 | ⚠️ 需理解限制后可阅读 |
| 自动化系统 | ❌ 禁止访问 |

### 如何访问

```
1. 阅读本索引
2. 理解使用限制
3. 阅读 CITATION_POLICY.md
4. 访问具体产物
5. 遵循引用规则
```

---

## Research Artifacts Files

### 目录结构

```
docs/research/
├── INDEX.md                      # 本索引
├── COVERAGE_MAP_RESEARCH.md      # 覆盖地图（去敏）
├── MECHANISM_TAXONOMY.md         # 机制分类法
├── LIFT_METHODOLOGY.md           # Lift 方法论
└── VALIDATION_FRAMEWORK.md       # 验证框架
```

---

## Citation Requirement

所有研究产物的引用必须遵循 `CITATION_POLICY.md`。

基本要求：
- 注明来源
- 添加免责声明
- 不可暗示效果保证

---

## Version History

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2025-12-31 | Initial research artifacts index |

---

**Version**: 1.0.0
**Exposure**: E1 (Research Disclosure)
**Last Updated**: 2025-12-31
