# Change Dilution Policy

> **Status**: CANONICAL
> **Purpose**: 防止平台在"善意补充"中被逐步掏空护城河
> **Created**: 2025-12-31
> **Effective**: Immediately

---

## Policy Statement

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   任何变更，无论动机多么善意，                                │
│   都必须证明它不会稀释平台的护城河。                          │
│                                                             │
│   "让内容更好理解" 往往意味着 "让内容更容易被抄袭"。           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Dilution Definition

### 什么是变更稀释

```yaml
dilution_definition:
  description: |
    变更稀释是指：一个看似无害或有益的修改，
    实际上降低了平台的独特性、专有性或复现门槛。

  examples:
    - "补充一个例子让读者更好理解" → 暴露了实现模式
    - "添加一个图表让关系更清晰" → 暴露了系统架构
    - "修正一个表述让逻辑更严谨" → 提供了可验证的细节
    - "回应一个问题让社区更满意" → 泄露了设计意图
```

### 稀释的危害

```
每一次稀释都是不可逆的。

稀释 #1: 看起来无害
稀释 #2: 看起来合理
稀释 #3: 看起来必要
...
稀释 #N: 护城河已经消失
```

---

## Mandatory Filters (强制过滤器)

### 任何变更必须通过全部三个检查

```yaml
mandatory_filters:
  filter_1:
    name: "执行能力检查"
    question: "此变更是否增加系统的执行能力？"
    pass_condition: "否"
    fail_action: "❌ 禁止变更"

  filter_2:
    name: "理解门槛检查"
    question: "此变更是否降低内容的理解门槛？"
    pass_condition: "否"
    fail_action: "❌ 禁止变更"

  filter_3:
    name: "可抄袭性检查"
    question: "此变更是否提高内容的可抄袭性？"
    pass_condition: "否"
    fail_action: "❌ 禁止变更"
```

### 检查流程图

```
                    提议变更
                       │
                       ▼
              ┌────────────────┐
              │ 增加执行能力？  │
              └────────┬───────┘
                   Yes │ No
                  ❌   │
                       ▼
              ┌────────────────┐
              │ 降低理解门槛？  │
              └────────┬───────┘
                   Yes │ No
                  ❌   │
                       ▼
              ┌────────────────┐
              │ 提高可抄袭性？  │
              └────────┬───────┘
                   Yes │ No
                  ❌   │
                       ▼
                    ✅ 允许
```

---

## Filter Definitions

### Filter 1: 执行能力检查

```yaml
execution_capability_check:
  definition: |
    执行能力 = 系统直接产生可操作输出的能力

  increase_examples:
    - 添加 API 端点
    - 添加 CLI 命令
    - 添加可运行脚本
    - 添加自动化工作流
    - 添加"一键执行"功能

  neutral_examples:
    - 修正文档 typo
    - 澄清方法论边界
    - 补充误用警告

  verdict:
    if_increase: "❌ 禁止"
    if_neutral: "→ 继续下一检查"
```

### Filter 2: 理解门槛检查

```yaml
understanding_threshold_check:
  definition: |
    理解门槛 = 读者需要的背景知识和思考深度

  decrease_examples:
    - 添加"简化版"说明
    - 添加"快速入门"指南
    - 添加"通俗解释"
    - 添加具体数字示例
    - 添加可直接套用的模板

  neutral_examples:
    - 修正逻辑错误
    - 补充学术引用
    - 添加"为什么不能简化"的说明

  verdict:
    if_decrease: "❌ 禁止"
    if_neutral: "→ 继续下一检查"
```

### Filter 3: 可抄袭性检查

```yaml
reproducibility_check:
  definition: |
    可抄袭性 = 外部实体复现系统核心能力的难度

  increase_examples:
    - 暴露具体阈值
    - 暴露参数配置
    - 暴露实现代码
    - 暴露 Case 结果
    - 暴露内部架构图
    - 回应"如何实现"的问题

  neutral_examples:
    - 保持抽象级别
    - 增加消毒层
    - 补充"为什么不公开"的说明

  verdict:
    if_increase: "❌ 禁止"
    if_neutral: "✅ 允许变更"
```

---

## Common Traps (常见陷阱)

### "善意"陷阱

```yaml
善意陷阱:
  trap_1:
    request: "能不能加个例子帮助理解？"
    hidden_risk: "例子会暴露实现模式"
    response: "❌ 拒绝，方法论已足够清晰"

  trap_2:
    request: "能不能解释一下这个阈值怎么来的？"
    hidden_risk: "解释会暴露设计依据"
    response: "❌ 拒绝，阈值属于内部实现"

  trap_3:
    request: "能不能提供一个 Demo？"
    hidden_risk: "Demo 会暴露系统行为"
    response: "❌ 拒绝，平台不提供执行接口"

  trap_4:
    request: "能不能修正这个'不清楚'的地方？"
    hidden_risk: "'不清楚'可能是刻意设计"
    response: "❓ 先评估是否需要保持模糊"
```

### "学术"陷阱

```yaml
学术陷阱:
  trap_1:
    request: "我在写论文，能不能引用你的具体结果？"
    hidden_risk: "结果属于内部数据"
    response: "❌ 只能引用方法论框架"

  trap_2:
    request: "能不能提供可复现的实验设置？"
    hidden_risk: "设置会暴露配置"
    response: "❌ 拒绝，参考 CITATION_POLICY"

  trap_3:
    request: "能不能共同发表？"
    hidden_risk: "共同发表需要共享实现"
    response: "❌ 平台不参与外部发表"
```

---

## Dilution Detection Signals

### 警告信号

```yaml
warning_signals:
  high_risk:
    - "让更多人理解"
    - "降低入门门槛"
    - "提供快速上手"
    - "增加实用性"
    - "回应社区需求"

  medium_risk:
    - "补充细节"
    - "添加示例"
    - "澄清模糊"
    - "修正理解偏差"

  low_risk:
    - "修正 typo"
    - "统一格式"
    - "更新日期"
```

### 自动化检测（建议）

```yaml
automated_detection:
  keywords_to_flag:
    - "example"
    - "demo"
    - "threshold"
    - "parameter"
    - "config"
    - "具体"
    - "实际"
    - "比如"
    - "例如"

  action: "触发人工审查"
```

---

## Reversal Protocol

### 如果已经发生稀释

```yaml
reversal_protocol:
  step_1:
    action: "识别稀释点"
    method: "Diff 分析"

  step_2:
    action: "评估损害程度"
    criteria:
      - 暴露了什么
      - 是否可追溯
      - 是否已被利用

  step_3:
    action: "执行回滚"
    priority: "P0"

  step_4:
    action: "记录至 MISUSE_CASES"
    purpose: "防止再次发生"

  step_5:
    action: "增强防护"
    method: "补充消毒层"
```

---

## Accountability

### 变更责任追溯

```yaml
accountability:
  principle: "谁批准，谁负责"

  record_required:
    - 变更内容
    - 审批人
    - 三项检查结果
    - 审批理由

  consequence:
    if_dilution_discovered: "审批人需解释并执行回滚"
```

---

## Version History

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2025-12-31 | Initial change dilution policy |

---

**Version**: 1.0.0
**Effective**: 2025-12-31
**Review Cycle**: Upon any change request
