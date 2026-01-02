# T1 Consumption Rules

> **Status**: CANONICAL
> **Type**: Consumption Interface Specification
> **Enforcement**: Runtime + Agent System Prompt

---

## Core Principle

**T1 is not an answer source. It is a reasoning substrate.**

T1 单元不是内容库，不是笔记库，不是教程集合。
T1 是 Agent 推理系统的燃料，必须通过推理转化后才能产生价值。

---

## Authorized Consumers

以下系统/角色被授权消费 T1：

| Consumer | Access Level | Usage Pattern |
|----------|--------------|---------------|
| **Analyst Agent** | Full | 作为分析推理的输入 |
| **Strategy Agent** | Full | 作为策略制定的依据 |
| **OS-level Reasoning Modules** | Full | 作为系统推理的基础 |
| **Refinement Pipeline** | Read-only | 仅用于质量验证 |

### 授权使用方式

```
T1 Unit → Agent Reasoning → Synthesized Output → User
           ↑                      ↑
        必须经过推理           不是直接复制
```

---

## Unauthorized Usage

以下使用方式被 **明确禁止**：

### ❌ 人类直接阅读当教程

```
PROHIBITED:
  User: "给我看看 T1 里关于 PPC 的内容"
  System: [直接展示 T1 单元内容]

CORRECT:
  User: "帮我分析 PPC 策略"
  Agent: [基于 T1 推理后生成分析]
```

**原因**: T1 单元是原子化的机制描述，不是可读的教程。直接阅读会导致：
- 信息碎片化
- 缺乏上下文
- 误解机制的适用范围

### ❌ 内容生成直接复用

```
PROHIBITED:
  - 将 T1 内容直接粘贴到回复中
  - 将 T1 作为引用来源展示给用户
  - 基于 T1 生成"知识卡片"或"学习笔记"

CORRECT:
  - Agent 内部消费 T1 进行推理
  - 推理结果经过综合后输出
  - 输出不直接暴露 T1 原文
```

**原因**: T1 的价值在于其机制/因果关系的精确性，直接复用会：
- 丢失推理过程
- 用户无法理解适用条件
- 将"燃料"当成"产品"

### ❌ 作为 RAG 检索的直接输出

```
PROHIBITED:
  Query → Retrieve T1 → Return T1 content as answer

CORRECT:
  Query → Retrieve T1 → Agent reasons with T1 → Synthesized answer
```

---

## Usage Specification

### Rule 1: T1 必须作为 reasoning input

T1 单元进入 Agent 系统后，必须经过推理模块处理：

```python
# CORRECT
def answer_query(query, t1_units):
    relevant_units = retrieve(query, t1_units)
    reasoning_context = format_for_reasoning(relevant_units)
    answer = agent.reason(query, reasoning_context)  # 推理过程
    return answer

# PROHIBITED
def answer_query(query, t1_units):
    relevant_units = retrieve(query, t1_units)
    return format_as_answer(relevant_units)  # 直接返回
```

### Rule 2: 不允许直接作为 answer output

Agent 的输出必须是推理结果，而非 T1 原文：

| Input | Processing | Output |
|-------|------------|--------|
| User Query | T1 作为推理输入 | 综合分析结果 |
| User Query | T1 作为知识背景 | 策略建议 |
| User Query | T1 作为验证依据 | 决策支持 |

**禁止输出模式**:
- "根据 T1 单元 xxx，..."
- "T1 知识库显示..."
- 直接引用 T1 content 字段

### Rule 3: T1 单元 ID 不应暴露给用户

T1 是系统内部资源，其 ID、结构、元数据不应出现在用户界面：

```
# PROHIBITED
"Based on t1_helium_10_HowtoStartanAmazonBu_0..."

# CORRECT
"Based on market analysis and conversion patterns..."
```

---

## Enforcement

### Agent System Prompt 约束

在 Agent 系统提示中加入：

```
T1 CONSUMPTION CONSTRAINT:
- T1 units are reasoning fuel, not answer sources
- Never quote T1 content directly to users
- Always synthesize T1 through reasoning before output
- T1 unit IDs must not appear in user-facing responses
```

### Runtime 验证

Export 脚本输出时包含消费规则提醒：

```json
{
  "consumption_rules": "docs/architecture/T1_CONSUMPTION_RULES.md",
  "warning": "T1 is not an answer source. It is a reasoning substrate.",
  "authorized_consumers": ["Analyst Agent", "Strategy Agent", "OS Reasoning Modules"]
}
```

---

## Anti-Pattern Examples

### Anti-Pattern 1: T1 作为知识问答

```
❌ User: "什么是 ACoS？"
   System: [从 T1 找到 ACoS 相关单元，直接返回内容]

✅ User: "什么是 ACoS？"
   Agent: [基于 T1 中的 ACoS 机制，结合用户上下文，生成解释]
```

### Anti-Pattern 2: T1 作为内容聚合

```
❌ "这里是关于 PPC 的所有 T1 单元..." [列出10个单元]

✅ "基于多个机制的综合分析，PPC 优化应该关注..." [推理结果]
```

### Anti-Pattern 3: T1 作为学习材料

```
❌ "学习 Amazon 运营，请阅读以下 T1 单元..."

✅ "让我帮你分析 Amazon 运营的关键因素..." [Agent 推理输出]
```

---

## Summary

| Aspect | Rule |
|--------|------|
| Identity | T1 is reasoning substrate, not content library |
| Consumption | Only through Agent reasoning modules |
| Output | Must be synthesized, never raw T1 |
| Visibility | T1 internals hidden from users |
| Purpose | Fuel for reasoning, not answers |

---

## References

- `docs/architecture/T1_CANONICAL_DEFINITION.md` - T1 定义
- `docs/architecture/TRUTH_SOURCE_TIERS.md` - 层级模型
- `refinement/README.md` - 精炼管道说明

---

**Canonical Statement**:

> **T1 is not an answer source. It is a reasoning substrate.**
