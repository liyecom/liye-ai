# Misuse Knowledge Base

> **Status**: LIVING DOCUMENT
> **Purpose**: 记录常见误解与滥用模式，主动防御护城河
> **Created**: 2025-12-31
> **Last Updated**: 2025-12-31

---

## Purpose

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   这是一个 反向护城河。                                       │
│                                                             │
│   我们主动公开"不能做什么"，                                  │
│   而非"能做什么"。                                           │
│                                                             │
│   每一条误用案例，都是对边界的强化。                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Misuse Categories

| 类别 | 代码 | 描述 |
|------|------|------|
| 产品化误用 | MU-PROD | 试图将平台作为产品或工具使用 |
| 效果承诺误用 | MU-GUAR | 试图获取或声称效果保证 |
| 实现泄露误用 | MU-IMPL | 试图获取内部实现细节 |
| 引用违规 | MU-CITE | 不当引用或虚假署名 |
| 边界突破 | MU-BNDRY | 试图绕过既定边界 |

---

## Misuse Case Registry

### MU-PROD-001: "开箱即用"期望

```yaml
case_id: MU-PROD-001
category: MU-PROD
status: ACTIVE

misunderstanding: |
  "这个系统应该可以直接拿来用，
  只需要把我的数据导入就行。"

why_wrong: |
  本平台是研究平台，不是产品。
  没有"导入"功能，没有"执行"功能。
  公开的仅是方法论框架，不是可运行系统。

why_designed_this_way: |
  如果可以"开箱即用"，护城河将不复存在。
  任何人都可以复制系统能力。
  研究平台的价值在于方法论，不在于执行。

standard_response: |
  本平台是研究平台，不提供执行能力。
  请参考 P4A_RESEARCH_PLATFORM.md 了解定位。

prevention_measures:
  - 无任何 API 端点
  - 无任何 CLI 命令
  - 无任何可执行脚本暴露
```

### MU-PROD-002: "API 请求"

```yaml
case_id: MU-PROD-002
category: MU-PROD
status: ACTIVE

misunderstanding: |
  "有没有 API 可以调用？
  我想把这个集成到我的系统里。"

why_wrong: |
  本平台不存在任何 API。
  Exposure Level 锁定在 E1，永不提升到 E3。
  "集成"与平台定位完全冲突。

why_designed_this_way: |
  API = 可复现的执行能力。
  一旦提供 API，系统核心能力可被任意复制。
  这是对护城河的致命破坏。

standard_response: |
  本平台不提供 API，这是设计决策。
  请参考 EXTERNAL_EXPOSURE_LEVELS.md。
  E3 (Public API) 被永久禁止。

prevention_measures:
  - PRODUCTIZATION_GATE 阻断
  - exposure-guard.yml CI 检查
  - E3 永久禁止条款
```

### MU-GUAR-001: "效果保证请求"

```yaml
case_id: MU-GUAR-001
category: MU-GUAR
status: ACTIVE

misunderstanding: |
  "按照你的方法做，能保证什么效果？
  有没有案例数据可以参考？"

why_wrong: |
  本平台不提供任何效果保证。
  所有 Case 结果已消毒移除。
  公开内容仅供方法论参考。

why_designed_this_way: |
  1. 效果依赖于执行质量，平台不控制执行
  2. 效果保证 = 商业承诺 = 产品化
  3. Case 结果暴露 = 验证系统被逆向工程

standard_response: |
  本平台不提供效果保证。
  公开内容仅供研究参考，不构成商业承诺。
  请参考 USAGE_BOUNDARY.md 第 4 条。

prevention_measures:
  - 所有 Case 结果已消毒
  - 所有 Lift 数值已移除
  - CITATION_POLICY 禁止效果声称
```

### MU-GUAR-002: "成功案例分享"

```yaml
case_id: MU-GUAR-002
category: MU-GUAR
status: ACTIVE

misunderstanding: |
  "能不能分享一些成功案例？
  看看别人是怎么用的。"

why_wrong: |
  本平台不分享任何案例。
  案例 = 执行证据 = 可被复制的模式。
  "别人怎么用"假设存在"用户"，但不存在。

why_designed_this_way: |
  研究平台没有"用户"，只有"读者"。
  读者阅读方法论，不"使用"系统。
  案例分享会强化产品化误解。

standard_response: |
  本平台是研究平台，没有"用户"和"案例"。
  公开的是方法论框架，不是使用指南。
  请参考 P4A_RESEARCH_PLATFORM.md。

prevention_measures:
  - 无案例库
  - 无使用指南
  - 无"最佳实践"文档
```

### MU-IMPL-001: "阈值请求"

```yaml
case_id: MU-IMPL-001
category: MU-IMPL
status: ACTIVE

misunderstanding: |
  "这个机制里的阈值具体是多少？
  比如 ACoS 多少算高？"

why_wrong: |
  阈值是内部实现，不公开。
  公开的机制分类框架已消毒移除所有阈值。
  这是刻意设计，不是遗漏。

why_designed_this_way: |
  阈值 = 可复现的决策规则。
  暴露阈值 = 暴露系统核心判断能力。
  这是护城河的关键组成部分。

standard_response: |
  本平台不提供具体阈值。
  公开的方法论框架已消毒移除所有参数。
  请参考 MECHANISM_TAXONOMY.md 了解分类概念。

prevention_measures:
  - 研究产物强制消毒
  - CHANGE_DILUTION_POLICY Filter 3
  - 8 点消毒清单
```

### MU-IMPL-002: "代码请求"

```yaml
case_id: MU-IMPL-002
category: MU-IMPL
status: ACTIVE

misunderstanding: |
  "能不能分享一下实现代码？
  或者有开源版本吗？"

why_wrong: |
  本平台不提供任何代码。
  Runner 模块、Gate 脚本均为内部实现。
  没有开源版本，也不会有。

why_designed_this_way: |
  代码 = 可直接复制的执行能力。
  开源 = 护城河消失。
  这与平台的生存策略完全冲突。

standard_response: |
  本平台不提供代码或开源版本。
  公开的仅限方法论讨论框架。
  这是设计决策，请参考 P5_STEADY_STATE_MODE.md。

prevention_measures:
  - 无代码公开
  - 无 GitHub 仓库
  - exposure-guard.yml 阻断
```

### MU-CITE-001: "效果归因"

```yaml
case_id: MU-CITE-001
category: MU-CITE
status: ACTIVE

misunderstanding: |
  "根据 Geo-OS 系统，我们的 ACoS 降低了 15%。"
  （用于商业宣传或客户报告）

why_wrong: |
  这种引用方式暗示效果保证。
  违反 CITATION_POLICY 第 4 条。
  属于严重的引用违规。

why_designed_this_way: |
  平台不对任何执行结果负责。
  效果归因 = 变相效果保证。
  这种引用会误导第三方。

standard_response: |
  此引用方式违反 CITATION_POLICY。
  禁止任何暗示效果保证的引用格式。
  请立即撤回或修正。

prevention_measures:
  - CITATION_POLICY 明确禁止
  - 定期搜索监控
  - 违规处理流程
```

### MU-CITE-002: "未署名复用"

```yaml
case_id: MU-CITE-002
category: MU-CITE
status: ACTIVE

misunderstanding: |
  （直接使用方法论框架但不署名来源）
  "这是我们自己开发的方法论。"

why_wrong: |
  方法论框架受知识产权保护。
  使用必须署名来源。
  不署名 = 侵权。

why_designed_this_way: |
  知识产权是平台的核心资产。
  署名要求保护创作者权益。
  也防止"用成果却不负责"。

standard_response: |
  使用本平台方法论必须署名来源。
  请补充署名或停止使用。
  严重情况将采取法律行动。

prevention_measures:
  - CITATION_POLICY 强制
  - 社区举报机制
  - 法律追诉准备
```

### MU-BNDRY-001: "渐进式突破"

```yaml
case_id: MU-BNDRY-001
category: MU-BNDRY
status: ACTIVE

misunderstanding: |
  "先给我一个小例子..."
  "只是想理解一下，不会真的用..."
  "学术目的而已..."

why_wrong: |
  这是试图通过"无害"请求逐步突破边界。
  每一个"小例子"都是稀释。
  "学术目的"不是免责条款。

why_designed_this_way: |
  边界没有"小突破"。
  一旦开口子，后续请求会援引先例。
  唯一安全的做法是零容忍。

standard_response: |
  本请求超出平台边界。
  边界是设计决策，非谈判对象。
  请在边界内重新组织问题。

prevention_measures:
  - INTERACTION_BOUNDARY 严格执行
  - 升级协议 Level 2-4
  - 无例外原则
```

### MU-BNDRY-002: "紧急例外请求"

```yaml
case_id: MU-BNDRY-002
category: MU-BNDRY
status: ACTIVE

misunderstanding: |
  "这是紧急情况，能不能破例一次？"
  "老板/客户急需..."
  "deadline 是明天..."

why_wrong: |
  紧急情况不是突破边界的理由。
  外部压力不能改变设计决策。
  这是经典的社工攻击模式。

why_designed_this_way: |
  如果"紧急"可以破例，那每个请求都会变成"紧急"。
  边界的价值在于无条件遵守。
  妥协一次 = 边界失效。

standard_response: |
  平台边界不因紧急情况改变。
  这是设计决策，非灵活政策。
  请寻求其他资源解决您的问题。

prevention_measures:
  - RELEASE_CADENCE 冷静期
  - 无紧急例外
  - 决策记录追溯
```

---

## Adding New Cases

### 新增案例流程

```yaml
new_case_process:
  step_1:
    action: "识别误用模式"
    criteria:
      - 是否是常见误解？
      - 是否可能被多人犯？
      - 是否威胁护城河？

  step_2:
    action: "分类"
    options:
      - MU-PROD: 产品化误用
      - MU-GUAR: 效果保证误用
      - MU-IMPL: 实现泄露误用
      - MU-CITE: 引用违规
      - MU-BNDRY: 边界突破

  step_3:
    action: "填写模板"
    template: |
      ### MU-XXX-NNN: [标题]

      ```yaml
      case_id: MU-XXX-NNN
      category: MU-XXX
      status: ACTIVE

      misunderstanding: |
        [常见误解的具体表述]

      why_wrong: |
        [为什么是错的]

      why_designed_this_way: |
        [为什么系统刻意不支持]

      standard_response: |
        [标准回应话术]

      prevention_measures:
        - [预防措施 1]
        - [预防措施 2]
      ```

  step_4:
    action: "审批并合并"
    approval: "视为 PATCH 发布"
```

### 案例模板

```yaml
# 复制此模板添加新案例

case_id: MU-XXX-NNN
category: MU-XXX
status: ACTIVE  # ACTIVE / RESOLVED / DEPRECATED

misunderstanding: |
  [外界常见的错误理解或请求]

why_wrong: |
  [解释为什么这是误解]
  [引用相关政策文档]

why_designed_this_way: |
  [解释系统为什么刻意不支持这种用法]
  [强调设计意图]

standard_response: |
  [标准化的拒绝/澄清话术]
  [可直接复制使用]

prevention_measures:
  - [技术层面的防护措施]
  - [政策层面的防护措施]
  - [监控层面的防护措施]

reported_by: [可选：谁发现的]
reported_date: [可选：发现日期]
resolution_date: [可选：解决日期]
```

---

## Statistics

### 当前状态

| 类别 | 活跃案例 | 已解决 | 已废弃 |
|------|----------|--------|--------|
| MU-PROD | 2 | 0 | 0 |
| MU-GUAR | 2 | 0 | 0 |
| MU-IMPL | 2 | 0 | 0 |
| MU-CITE | 2 | 0 | 0 |
| MU-BNDRY | 2 | 0 | 0 |
| **Total** | **10** | **0** | **0** |

---

## Version History

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2025-12-31 | Initial misuse knowledge base with 10 cases |

---

**Version**: 1.0.0
**Last Updated**: 2025-12-31
**Next Review**: On new misuse discovery
