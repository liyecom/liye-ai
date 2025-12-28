---
name: prompt-engineering
description: 提示工程技术与 Agent 设计模式
domain: 00_Core_Utilities
category: meta
version: 1.0.0
status: active
source: awesome-claude-skills
source_url: https://github.com/ComposioHQ/awesome-claude-skills
license: Apache-2.0
---

# Prompt Engineering

> **来源**: ComposioHQ/awesome-claude-skills
> **适配**: LiYe OS 三层架构

教授提示工程技术，包括 Anthropic 最佳实践、Agent 设计模式、上下文工程。

## When to Use This Skill

当需要优化 AI 交互时：
- 设计高效 System Prompt
- 优化用户提示
- 构建 Agent 工作流
- 减少 Token 消耗
- 提升输出质量

## Core Capabilities

### 1. 提示结构设计

```markdown
# System Prompt 结构

## 角色定义
你是 [角色]，专长于 [领域]。

## 核心指令
1. [首要任务]
2. [次要任务]

## 约束条件
- [限制 1]
- [限制 2]

## 输出格式
[期望的输出格式说明]

## 示例
[Few-shot 示例]
```

### 2. Anthropic 最佳实践

| 技术 | 描述 | 效果 |
|------|------|------|
| **XML 标签** | 使用 `<tag>` 结构化内容 | 提升解析准确度 |
| **Chain of Thought** | 引导逐步推理 | 提升复杂任务表现 |
| **角色扮演** | 明确定义 AI 角色 | 输出更一致 |
| **Few-shot** | 提供示例 | 输出格式更稳定 |
| **显式约束** | 明确禁止行为 | 减少意外输出 |

### 3. 上下文工程

```
┌─────────────────────────────────┐
│        System Prompt            │ ← 角色、规则、格式
├─────────────────────────────────┤
│      Retrieved Context          │ ← RAG 检索内容
├─────────────────────────────────┤
│      Conversation History       │ ← 对话历史
├─────────────────────────────────┤
│        User Message             │ ← 用户输入
└─────────────────────────────────┘
```

### 4. Agent 设计模式

**ReAct 模式**:
```
Thought: 我需要...
Action: [工具调用]
Observation: [结果]
Thought: 根据结果...
Action: [下一步]
...
Final Answer: [最终答案]
```

**Plan-and-Execute**:
```
1. 分析任务 → 生成计划
2. 逐步执行计划
3. 根据反馈调整
4. 汇总结果
```

**Multi-Agent 协作**:
```
Coordinator → Researcher → Writer → Reviewer
     ↑__________________________________|
```

### 5. Token 优化策略
- 简洁表达
- 避免冗余说明
- 使用缩写和符号
- 结构化而非叙述
- 懒加载上下文

## Usage Examples

### 示例 1: System Prompt 设计
```
用户: 帮我设计一个代码审查 Agent 的 System Prompt
Claude: [使用 prompt-engineering 设计角色、规则、输出格式]
```

### 示例 2: 提示优化
```
用户: 这个提示效果不好，帮我优化
Claude: [使用 prompt-engineering 分析问题、应用技术、重写提示]
```

### 示例 3: Agent 工作流
```
用户: 我想让 Claude 自动完成研究任务
Claude: [使用 prompt-engineering 设计 ReAct 循环、定义工具、编排流程]
```

## Dependencies

无外部依赖，纯方法论技能。

## LiYe OS Integration

### 业务域引用
此技能被以下业务域引用：
- **12_Meta_Cognition**: 提示工程（主域）
- **06_Technical_Development**: Agent 开发

### 与 LiYe OS 的关系
本技能直接服务于 LiYe OS 的核心交互层：
- 优化 `.claude/packs/` 的 Context Packs
- 提升 Skill 描述的触发准确度
- 改进 Agent 协作效率

### 三层架构位置
- **物理层 (本文件)**: Skills/00_Core_Utilities/meta/prompt-engineering/
- **逻辑层索引**: Skills/{domain}/index.yaml
- **L3 指令层**: .claude/skills/{domain}/prompt-engineering/

---
**Created**: 2025-12-28 | **Adapted for LiYe OS**
