---
name: kaizen
description: 持续改进方法论 - 基于精益思想
domain: 00_Core_Utilities
category: productivity
version: 1.0.0
status: active
source: awesome-claude-skills
source_url: https://github.com/ComposioHQ/awesome-claude-skills
license: Apache-2.0

# SFC v0.1 Required Fields
skeleton: "workflow"
triggers:
  commands: ["/kaizen"]
  patterns: ["kaizen"]
inputs:
  required: []
  optional: []
outputs:
  artifacts: ["SKILL.md"]
failure_modes:
  - symptom: "Missing required inputs or context"
    recovery: "Provide the missing info and retry"
  - symptom: "Unexpected tool/runtime failure"
    recovery: "Rerun with minimal steps; escalate after 3 failures"
verification:
  evidence_required: true
  how_to_verify: ["node .claude/scripts/sfc_lint.mjs <skill_dir>"]
governance:
  constitution: "_meta/governance/SKILL_CONSTITUTION_v0.1.md"
  policy: "_meta/policies/DEFAULT_SKILL_POLICY.md"
---

# Kaizen

> **来源**: ComposioHQ/awesome-claude-skills
> **适配**: LiYe OS 三层架构

应用持续改进方法论，基于日本改善哲学和精益方法论，提供多种分析方法。

## When to Use This Skill

当需要持续改进流程或系统时：
- 分析现有流程找出改进点
- 应用 PDCA 循环迭代改进
- 使用 5 Why 追溯根本原因
- 识别和消除浪费 (Muda)
- 制定渐进式改进计划

## Core Capabilities

### 1. PDCA 循环
```
Plan (计划)
  ↓ 识别问题，制定假设
Do (执行)
  ↓ 小规模试验
Check (检查)
  ↓ 分析结果
Act (行动)
  → 标准化或调整
```

### 2. 5 Why 分析
逐层追问"为什么"，找到根本原因：
```
问题: 报表生成时间过长
Why 1: 数据查询慢 → 为什么？
Why 2: 表没有索引 → 为什么？
Why 3: 没有 DBA 评审 → 为什么？
Why 4: 缺少代码审查流程 → 为什么？
Why 5: 团队没有建立标准 ← 根本原因
```

### 3. 价值流图 (Value Stream Mapping)
- 绘制当前状态流程
- 识别增值 vs 非增值活动
- 设计未来状态
- 制定转变计划

### 4. 浪费识别 (7 Muda)
| 浪费类型 | 含义 | 示例 |
|---------|------|------|
| 过度生产 | 做得比需要多 | 过多的报表 |
| 等待 | 空闲时间 | 等待审批 |
| 运输 | 不必要的移动 | 多次文件传输 |
| 过度加工 | 过度精细 | 过度优化代码 |
| 库存 | 堆积的工作 | 待处理任务积压 |
| 动作 | 不必要的操作 | 重复手动操作 |
| 缺陷 | 返工 | Bug 修复 |

### 5. 渐进式改进计划
- 小步快跑
- 每次只改一件事
- 快速验证
- 持续迭代

## Usage Examples

### 示例 1: 优化工作流程
```
用户: 我的日报流程太繁琐了，帮我优化
Claude: [使用 kaizen 绘制价值流图、识别浪费、提出改进方案]
```

### 示例 2: 复盘失败项目
```
用户: 这个项目延期了，帮我分析原因
Claude: [使用 kaizen 5 Why 分析、找到根本原因、制定预防措施]
```

### 示例 3: 建立改进循环
```
用户: 帮我建立一个持续改进的机制
Claude: [使用 kaizen 设计 PDCA 循环、定义检查点、建立反馈机制]
```

## Dependencies

无外部依赖，纯方法论技能。

## LiYe OS Integration

### 业务域引用
此技能被以下业务域引用：
- **12_Meta_Cognition**: 持续改进方法论（主域）
- **11_Life_Design**: 生活流程优化

### 与 Evolution Protocol 的关系
Kaizen 理念与 LiYe OS 的 Evolution Protocol 高度一致：
- 都强调持续改进
- 都基于数据驱动决策
- 都要求可追溯的记录

### 三层架构位置
- **物理层 (本文件)**: Skills/00_Core_Utilities/productivity/kaizen/
- **逻辑层索引**: Skills/{domain}/index.yaml
- **L3 指令层**: .claude/skills/{domain}/kaizen/

---
**Created**: 2025-12-28 | **Adapted for LiYe OS**
