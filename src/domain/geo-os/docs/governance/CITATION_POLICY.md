# Citation & Attribution Policy

> **Status**: CANONICAL
> **Purpose**: 研究产物引用与署名政策
> **Created**: 2025-12-31
> **Effective**: Immediately

---

## Purpose

本政策旨在：

1. **保护知识产权**：防止未经授权的使用和复制
2. **确保正确归属**：防止"被用成果却不署名"
3. **防止误导**：防止引用方式暗示效果保证
4. **明确边界**：明确允许和禁止的引用方式

---

## Citation Requirements

### 必须包含的元素

任何引用必须包含：

```
┌─────────────────────────────────────────────────────────┐
│                   引用必需元素                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 1. 来源标识                                              │
│    "Geo-OS T1 Reasoning Research Platform"              │
│                                                         │
│ 2. 版本信息                                              │
│    引用时的版本号和日期                                   │
│                                                         │
│ 3. 免责声明                                              │
│    "仅供研究参考，不构成效果保证"                         │
│                                                         │
│ 4. 使用限制说明                                          │
│    "不可用于自动化执行或商业承诺"                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Allowed Citation Formats

### 学术引用格式

```bibtex
@misc{geoos_t1_platform,
  title = {Geo-OS T1 Reasoning Research Platform},
  author = {Geo-OS Research Team},
  year = {2025},
  note = {Research methodology only. Not a guarantee of effects.},
  howpublished = {Internal Research Platform}
}
```

### 文档引用格式

```markdown
参考来源：Geo-OS T1 Reasoning Research Platform (v1.0.0, 2025)
免责声明：仅供方法论研究参考，不构成任何效果保证或商业承诺。
使用限制：不可用于自动化执行或作为业务决策的唯一依据。
```

### 简短引用格式

```
[Geo-OS T1 Platform, 2025] (研究参考，非效果保证)
```

---

## Prohibited Citation Formats

### 绝对禁止

以下引用方式严格禁止：

| 禁止格式 | 原因 |
|----------|------|
| ❌ "根据 Geo-OS 系统，效果可提升 X%" | 暗示效果保证 |
| ❌ "Geo-OS 证明了..." | 暗示科学结论 |
| ❌ "使用 Geo-OS 可以确保..." | 暗示确定性 |
| ❌ "Geo-OS 推荐..." | 暗示建议权威性 |
| ❌ "AI 系统 Geo-OS 表明..." | 过度神化 |

### 禁止的引用示例

```markdown
# ❌ 禁止的引用方式

"根据 Geo-OS 系统的分析，广告 ACoS 可降低 15%。"
→ 问题：暗示效果保证

"Geo-OS AI 推荐将竞价提升 20%。"
→ 问题：暗示 AI 建议权威性

"经 Geo-OS 验证，此策略有效。"
→ 问题：暗示验证结论
```

---

## Correct Citation Examples

### 正确引用示例

```markdown
# ✅ 正确的引用方式

"参考 Geo-OS T1 Platform 的机制分类框架（仅供方法论参考）..."
→ 正确：明确是方法论参考

"Geo-OS 研究平台提出了一种竞价策略分析的分类方法（v1.0.0, 2025）。
 注：此为研究方法论，非效果保证。"
→ 正确：注明版本和免责

"在机制设计方法上，我们参考了 Geo-OS T1 的分类框架
 [Geo-OS T1 Platform, 2025]，但具体阈值和参数由我们独立确定。"
→ 正确：明确参考范围
```

---

## Attribution Requirements

### 署名要求

当使用本平台的方法论时：

```yaml
attribution_requirements:
  academic_paper:
    - 在参考文献中列出
    - 在方法论章节说明参考范围
    - 添加免责声明

  technical_report:
    - 在引用部分列出
    - 说明具体参考内容
    - 添加使用限制

  presentation:
    - 在引用来源页列出
    - 口头说明仅供参考
    - 不可暗示效果保证

  internal_document:
    - 注明来源
    - 说明参考范围
    - 记录引用日期和版本
```

### 禁止的署名遗漏

```yaml
prohibited_omissions:
  - 使用方法论但不注明来源
  - 引用结论但不添加免责
  - 参考框架但声称原创
  - 复制内容但不说明出处
```

---

## Enforcement

### 违规处理

| 违规程度 | 处理方式 |
|----------|----------|
| 轻微（遗漏免责） | 要求补充 |
| 中度（错误暗示） | 要求撤回或修正 |
| 严重（效果承诺） | 正式投诉 + 可能法律行动 |
| 恶意（商业滥用） | 法律行动 |

### 违规发现途径

```yaml
violation_detection:
  - 定期搜索引用
  - 社区举报
  - 合作方反馈
  - 自动化监控（关键词）
```

---

## License Clarification

### 知识产权声明

```
Geo-OS T1 Reasoning Research Platform

版权所有 © 2025

本平台的方法论框架和分类体系受知识产权保护。
允许在遵循本引用政策的前提下进行学术和研究引用。
禁止未经授权的商业使用、复制或分发。
```

### 授权范围

```yaml
granted_rights:
  - 学术引用（遵循政策）
  - 研究参考（遵循政策）
  - 方法论学习
  - 内部讨论

reserved_rights:
  - 商业使用
  - 代码复制
  - 机制直接复用
  - 产品化应用
```

---

## Frequently Asked Questions

### Q: 我可以在论文中引用吗？

A: 可以，但必须：
- 使用正确引用格式
- 添加免责声明
- 注明仅为方法论参考

### Q: 我可以在公司内部报告中引用吗？

A: 可以，但必须：
- 注明来源
- 说明参考范围
- 不可作为决策唯一依据

### Q: 我可以基于这个框架开发自己的系统吗？

A: 方法论思想可以参考，但：
- 不可直接复制机制定义
- 不可复制具体实现
- 需独立开发和验证

### Q: 我发现有人违规引用怎么办？

A: 请通过以下方式报告：
- 记录违规证据
- 联系维护者
- 提供违规链接/截图

---

## Version History

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2025-12-31 | Initial citation policy |

---

**Version**: 1.0.0
**Effective**: 2025-12-31
**Review Cycle**: Annually
