# Interaction Boundary v2

> **Status**: CANONICAL
> **Purpose**: 定义平台与外界互动的严格边界
> **Created**: 2025-12-31
> **Effective**: Immediately

---

## Boundary Declaration

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   本平台的外部互动模式是 只读化 的。                          │
│                                                             │
│   外界可以 阅读、引用、讨论 方法论框架。                       │
│   外界不可 获取、复现、执行 系统能力。                         │
│                                                             │
│   这不是限制，这是 设计。                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Allowed Interactions (允许的互动)

### 1. 讨论机制分类

```yaml
allowed_discussion_1:
  topic: "机制分类体系"

  allowed_questions:
    - "T1 机制有哪些类型？"
    - "因果链和阈值规则有什么区别？"
    - "失效模式的定义是什么？"
    - "平台机制是如何分类的？"

  allowed_answers:
    - 引用 MECHANISM_TAXONOMY.md 中的框架
    - 解释分类的逻辑依据
    - 说明各类型的适用场景

  forbidden_answers:
    - 具体机制的阈值
    - 具体机制的参数
    - 具体机制的实现
```

### 2. 讨论验证方法

```yaml
allowed_discussion_2:
  topic: "Lift 验证方法论"

  allowed_questions:
    - "Lift 是什么？"
    - "四个评估维度是什么？"
    - "如何设计验证 Case？"
    - "Regression Gate 的概念是什么？"

  allowed_answers:
    - 引用 LIFT_METHODOLOGY.md 中的框架
    - 解释评估维度的定义
    - 说明验证流程的逻辑

  forbidden_answers:
    - 具体 Lift 数值
    - 具体 Case 结果
    - 具体评估权重
```

### 3. 讨论"为什么不能直接用"

```yaml
allowed_discussion_3:
  topic: "平台定位与使用限制"

  allowed_questions:
    - "为什么不提供执行接口？"
    - "为什么不公开阈值？"
    - "为什么不能直接复用？"
    - "这是研究平台还是产品？"

  allowed_answers:
    - 解释研究平台的定位
    - 说明护城河设计的意图
    - 引用 USAGE_BOUNDARY.md 的限制
    - 解释消毒机制的目的

  forbidden_answers:
    - 任何暗示"可以变通"的内容
    - 任何暗示"未来会开放"的内容
```

---

## Forbidden Interactions (禁止的互动)

### 1. 要求给参数

```yaml
forbidden_interaction_1:
  type: "参数请求"

  examples:
    - "这个阈值具体是多少？"
    - "权重是怎么设置的？"
    - "温度参数是多少？"
    - "评分的具体公式是什么？"

  standard_response: |
    本平台不提供具体参数。
    参数属于内部实现，不在研究公开范围内。
    请参考 CITATION_POLICY.md 了解可引用的内容。

  reason: "参数是护城河的核心组成部分"
```

### 2. 要求给代码

```yaml
forbidden_interaction_2:
  type: "代码请求"

  examples:
    - "能不能分享实现代码？"
    - "有没有开源版本？"
    - "可以看一下 Runner 的代码吗？"
    - "能提供一个参考实现吗？"

  standard_response: |
    本平台不提供代码。
    代码属于内部实现，不在研究公开范围内。
    公开的仅限方法论框架文档。

  reason: "代码暴露会直接消除护城河"
```

### 3. 要求给可运行示例

```yaml
forbidden_interaction_3:
  type: "示例请求"

  examples:
    - "能给一个 Demo 吗？"
    - "有没有可以跑的例子？"
    - "能演示一下吗？"
    - "有 Playground 吗？"

  standard_response: |
    本平台不提供可运行示例。
    这是研究平台，不是产品或工具。
    请参考方法论文档进行学术讨论。

  reason: "可运行示例会暴露系统行为"
```

### 4. 要求对结果负责

```yaml
forbidden_interaction_4:
  type: "责任转移请求"

  examples:
    - "如果按你的方法做没效果怎么办？"
    - "这个方法能保证什么效果？"
    - "你们的数据准确吗？"
    - "能不能签个效果承诺？"

  standard_response: |
    本平台不对任何结果负责。
    公开内容仅供方法论研究参考。
    不构成任何效果保证或商业承诺。
    请参考 USAGE_BOUNDARY.md 第 4 条。

  reason: "责任边界必须清晰"
```

---

## Response Templates

### 标准拒绝模板

```yaml
rejection_templates:
  parameter_request: |
    感谢您的兴趣。
    本平台是研究平台，不提供具体参数。
    公开的方法论框架已在 docs/research/ 目录下。
    引用请遵循 CITATION_POLICY.md。

  code_request: |
    感谢您的兴趣。
    本平台不提供代码或实现。
    公开的仅限方法论讨论框架。
    如需技术咨询，请另行联系。

  demo_request: |
    感谢您的兴趣。
    本平台不提供演示或可运行示例。
    这是研究平台，非产品或工具。
    请参考方法论文档进行学术讨论。

  guarantee_request: |
    感谢您的兴趣。
    本平台不提供任何效果保证。
    公开内容仅供研究参考，非商业承诺。
    使用限制请参考 USAGE_BOUNDARY.md。
```

### 引导性响应模板

```yaml
redirective_templates:
  methodology_discussion: |
    很好的问题！关于方法论，您可以参考：
    - 机制分类：MECHANISM_TAXONOMY.md
    - 验证方法：LIFT_METHODOLOGY.md
    - 覆盖地图：COVERAGE_MAP_RESEARCH.md

    这些文档解释了"为什么这样设计"，
    而非"如何具体实现"。

  citation_guidance: |
    如需引用本平台，请遵循 CITATION_POLICY.md：
    - 必须标注来源
    - 必须添加免责声明
    - 必须注明仅供研究参考
    - 禁止暗示效果保证
```

---

## Escalation Protocol

### 持续追问处理

```yaml
escalation_protocol:
  level_1:
    trigger: "首次禁止请求"
    response: "使用标准拒绝模板"

  level_2:
    trigger: "重复同类请求"
    response: |
      再次重申：本请求超出平台边界。
      相关限制已在以下文档中明确：
      - INTERACTION_BOUNDARY.md (本文档)
      - USAGE_BOUNDARY.md
      - CITATION_POLICY.md

      进一步追问不会改变回答。

  level_3:
    trigger: "三次或以上同类请求"
    response: |
      本对话已超出建设性讨论范围。
      平台边界是设计决策，非谈判对象。
      建议：
      1. 阅读 docs/governance/ 下的政策文档
      2. 在边界内重新组织问题
      3. 或寻求其他资源

  level_4:
    trigger: "威胁/施压/尝试绕过"
    response: "终止互动，记录至 MISUSE_CASES.md"
```

---

## Boundary Visualization

```
┌─────────────────────────────────────────────────────────────┐
│                   Interaction Boundary                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   外界可访问                │    外界不可访问               │
│   ─────────────            │    ─────────────              │
│                            │                               │
│   ✅ 分类框架              │    ❌ 具体阈值                │
│   ✅ 方法论概念            │    ❌ 具体参数                │
│   ✅ 验证维度定义          │    ❌ 具体代码                │
│   ✅ 使用限制说明          │    ❌ 具体结果                │
│   ✅ 引用政策              │    ❌ 可运行示例              │
│   ✅ 误用案例              │    ❌ 效果保证                │
│                            │                               │
│            │               │                │              │
│            ▼               │                ▼              │
│       只读访问             │            完全阻断            │
│                            │                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Version History

| 版本 | 日期 | 变更 |
|------|------|------|
| 2.0.0 | 2025-12-31 | Upgraded from P3 read-only to P5 strict boundary |

---

**Version**: 2.0.0
**Effective**: 2025-12-31
**Supersedes**: READ_ONLY_INTERFACE.md (P3)
