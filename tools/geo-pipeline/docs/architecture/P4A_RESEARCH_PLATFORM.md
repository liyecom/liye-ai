# P4-A: Research Platform Definition

> **Status**: CANONICAL
> **Phase**: P4-A (Research Platform, not Product)
> **Created**: 2025-12-31
> **Exposure Level**: E0 → E1 (Research Disclosure)

---

## Core Principle

> **平台定义机制与验证方法，而非提供结果**

```
┌─────────────────────────────────────────────────────────┐
│                   Research Platform 本质                 │
│                                                         │
│   ✅ 定义：什么是 T1 机制                                │
│   ✅ 定义：如何验证机制有效性                            │
│   ✅ 定义：如何组织机制知识                              │
│   ✅ 定义：如何衡量推理质量                              │
│                                                         │
│   ❌ 不提供：具体业务结果                                │
│   ❌ 不提供：效果预测                                    │
│   ❌ 不提供：自动化执行                                  │
│   ❌ 不提供：商业解决方案                                │
└─────────────────────────────────────────────────────────┘
```

---

## Platform Definition

### 平台是什么

```yaml
platform_identity:
  name: "Geo-OS T1 Reasoning Research Platform"
  type: "Research & Methodology Platform"
  purpose: "定义、验证、组织因果推理机制的方法论平台"

  core_outputs:
    - "机制定义方法 (Mechanism Definition)"
    - "验证框架 (Lift Validation Framework)"
    - "质量度量 (Reasoning Quality Metrics)"
    - "知识组织 (Knowledge Taxonomy)"

  NOT_outputs:
    - "业务结果"
    - "效果保证"
    - "执行系统"
    - "商业产品"
```

### 平台不是什么

| 平台不是 | 说明 |
|----------|------|
| ❌ 工具 | 不是可直接使用的业务工具 |
| ❌ 产品 | 不是可售卖的商业产品 |
| ❌ 服务 | 不是提供结果的服务 |
| ❌ 自动化系统 | 不是自动执行决策的系统 |
| ❌ 预测引擎 | 不是预测业务效果的引擎 |

---

## Target Audience

### 主要受众

```yaml
primary_audience:
  - type: "研究者 (Researchers)"
    interest: "方法论研究、机制设计、验证框架"
    access_level: "E1 - Controlled Disclosure"
    permissions:
      - 阅读机制定义方法
      - 理解验证框架
      - 引用方法论（遵循 Citation Policy）

  - type: "高级从业者 (Advanced Practitioners)"
    interest: "理解机制分类、建立自有知识体系"
    access_level: "E1 - Controlled Disclosure"
    permissions:
      - 参考机制分类法
      - 学习验证方法
      - 不可直接复用机制内容

  - type: "内部方法团队 (Internal Methods Team)"
    interest: "方法论迭代、框架扩展"
    access_level: "E0 - Internal"
    permissions:
      - 完整访问
      - 方法论贡献
      - 框架扩展
```

### 非目标受众

```yaml
non_target_audience:
  - type: "普通用户"
    reason: "需要结果而非方法"

  - type: "自动化需求者"
    reason: "寻求执行能力而非理解"

  - type: "效果承诺寻求者"
    reason: "寻求保证而非方法"
```

---

## Explicit Non-Goals

### 明确非目标

```
┌─────────────────────────────────────────────────────────┐
│                   P4-A 明确非目标                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ❌ 工具售卖                                              │
│    平台不是待售商品，机制不是可购买的资产                 │
│                                                         │
│ ❌ 效果承诺                                              │
│    平台不承诺任何业务效果，只描述方法论                   │
│                                                         │
│ ❌ 自动化执行                                            │
│    平台不执行任何业务操作，只提供理解框架                 │
│                                                         │
│ ❌ 咨询服务                                              │
│    平台不提供咨询，只提供方法论参考                       │
│                                                         │
│ ❌ 结果交付                                              │
│    平台不交付业务结果，只交付方法论产物                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Research Outputs

### 允许发布的研究产物

| 产物 | 内容 | 限制 |
|------|------|------|
| Coverage Map | 机制覆盖情况 | 去除具体数值 |
| Mechanism Taxonomy | 机制分类法 | 不含具体阈值 |
| Lift Methodology | 验证方法论 | 不含具体结果 |
| Validation Framework | 质量评估框架 | 只描述方法 |

### 禁止发布的内容

| 禁止内容 | 理由 |
|----------|------|
| 具体机制阈值 | 可能被直接复用 |
| Case 具体结果 | 可能被误解为承诺 |
| Lift 具体数值 | 可能被误用 |
| 完整机制定义 | 保护知识产权 |

---

## Platform Boundaries

### 方法论边界

```yaml
methodology_scope:
  included:
    - "T1 机制的定义方法"
    - "机制类型分类法"
    - "Lift 验证的维度定义"
    - "Case 设计方法"
    - "质量度量方法"

  excluded:
    - "具体机制内容"
    - "具体阈值和参数"
    - "业务场景适用性"
    - "执行建议"
```

### 披露边界

```yaml
disclosure_scope:
  E0_internal:
    - "完整机制定义"
    - "所有 Case 和结果"
    - "完整配置"

  E1_research:
    - "方法论框架"
    - "分类法（无阈值）"
    - "验证维度定义"

  prohibited:
    - "可直接执行的机制"
    - "完整参数配置"
    - "自动化接口"
```

---

## Relationship to Other Phases

```
P0-P3 (已完成)
   │
   ├── P0: T1 基础填充
   ├── P0.5: Lift 验证与回归保护
   ├── P1: 机制深化
   ├── P2: 确定性 Runner
   └── P3: 外部暴露治理
       │
       ▼
P4-A: Research Platform (当前)
   │
   ├── 定义平台边界
   ├── 建立版本化规范
   ├── 发布研究产物
   └── 建立引用规则
       │
       ▼
P4-B: (未定义 - 需独立审批)
```

---

## Definition of Done (P4-A)

| Criterion | Status |
|-----------|--------|
| ✅ 机制可被讨论，但不可被直接复用 | ⏳ |
| ✅ 无任何执行接口暴露 | ✅ (P2/P3 保证) |
| ✅ 系统仍停留在 Exposure ≤ E1 | ✅ |
| ✅ 机制版本化规范建立 | ⏳ |
| ✅ 研究产物索引建立 | ⏳ |
| ✅ 引用政策建立 | ⏳ |

---

## Governance Integration

P4-A 不改变已有治理：

- Usage Boundary 仍然有效
- Productization Gate 仍然关闭
- Exposure Guard 仍然运行
- Regression Gate 仍然保护

---

**Version**: 1.0.0
**Phase**: P4-A (Research Platform)
**Exposure**: E0 → E1 (Research Disclosure)
