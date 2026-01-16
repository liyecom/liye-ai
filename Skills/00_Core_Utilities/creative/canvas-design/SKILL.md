---
name: canvas-design
description: 视觉设计与艺术创作工具
domain: 00_Core_Utilities
category: creative
version: 1.0.0
status: active
source: awesome-claude-skills
source_url: https://github.com/ComposioHQ/awesome-claude-skills
license: Apache-2.0

# SFC v0.1 Required Fields
skeleton: "workflow"
triggers:
  commands: ["/canvas-design"]
  patterns: ["canvas-design"]
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

# Canvas Design

> **来源**: ComposioHQ/awesome-claude-skills
> **适配**: LiYe OS 三层架构

使用设计哲学创建视觉艺术作品，输出 PNG 和 PDF 格式，适用于海报、设计稿、静态作品。

## When to Use This Skill

当需要创建视觉设计时：
- 创建海报和宣传材料
- 设计信息图表
- 制作演示用视觉素材
- 创作静态艺术作品
- 生成 PNG/PDF 格式输出

## Core Capabilities

### 1. 视觉设计原则
- **对比** (Contrast): 突出重要元素
- **重复** (Repetition): 建立一致性
- **对齐** (Alignment): 创造秩序感
- **亲密** (Proximity): 组织相关元素

### 2. 排版与构图
- 网格系统应用
- 视觉层次建立
- 留白运用
- 焦点引导

### 3. 色彩理论
- 色彩搭配原则
- 情绪与色彩关联
- 品牌色应用
- 对比度与可读性

### 4. 输出格式
- **PNG**: 高质量位图，适合网络
- **PDF**: 矢量格式，适合打印
- 分辨率优化
- 尺寸适配

### 5. 设计迭代
- 快速原型
- 版本对比
- 反馈整合
- 持续优化

## Usage Examples

### 示例 1: 产品海报
```
用户: 帮我设计一个 Amazon 产品的促销海报
Claude: [使用 canvas-design 创建视觉吸引的促销海报]
```

### 示例 2: 信息图表
```
用户: 把这些数据做成一个信息图表
Claude: [使用 canvas-design 设计数据可视化信息图]
```

### 示例 3: 社交媒体素材
```
用户: 帮我创建一套 Instagram 帖子素材
Claude: [使用 canvas-design 设计统一风格的社交媒体图片]
```

## Dependencies

- PNG/PDF 生成库
- 设计渲染引擎
- 可选：Canvas API、SVG 库

## LiYe OS Integration

### 业务域引用
此技能被以下业务域引用：
- **03_Creative_Production**: 视觉设计（主域）
- **02_Operation_Intelligence**: 产品图设计
- **08_Communication**: 演示素材

### 三层架构位置
- **物理层 (本文件)**: Skills/00_Core_Utilities/creative/canvas-design/
- **逻辑层索引**: Skills/{domain}/index.yaml
- **L3 指令层**: .claude/skills/{domain}/canvas-design/

---
**Created**: 2025-12-28 | **Adapted for LiYe OS**
