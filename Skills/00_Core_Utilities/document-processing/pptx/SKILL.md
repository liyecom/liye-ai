---
name: pptx
description: PowerPoint 演示文稿创建与编辑工具
domain: 00_Core_Utilities
category: document-processing
version: 1.0.0
status: active
source: awesome-claude-skills
source_url: https://github.com/ComposioHQ/awesome-claude-skills
license: Apache-2.0

# SFC v0.1 Required Fields
skeleton: "task"
triggers:
  commands: ["/pptx"]
  patterns: ["pptx"]
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

# PPTX Presentation Processing

> **来源**: ComposioHQ/awesome-claude-skills
> **适配**: LiYe OS 三层架构

读取、生成、调整 PowerPoint 演示文稿，支持布局管理、模板应用、内容提取。

## When to Use This Skill

当需要处理演示文稿时：
- 创建专业演示文稿
- 修改现有 PPT 内容
- 应用模板和主题
- 提取幻灯片内容
- 批量生成演示材料

## Core Capabilities

### 1. 幻灯片创建
```python
from pptx import Presentation
from pptx.util import Inches

prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[1])
title = slide.shapes.title
title.text = "演示标题"
prs.save('presentation.pptx')
```

### 2. 布局管理
- 标题幻灯片
- 内容布局
- 两栏布局
- 空白布局
- 自定义布局

### 3. 内容元素
- 文本框
- 图片插入
- 表格
- 图表
- 形状和图标
- SmartArt（有限支持）

### 4. 模板应用
- 主题颜色
- 字体方案
- 背景设计
- 母版幻灯片

### 5. 演讲者备注
- 添加备注
- 提取备注
- 备注格式化

## Usage Examples

### 示例 1: 周报演示
```
用户: 帮我把这周的工作总结做成 PPT
Claude: [使用 pptx 创建带数据图表、工作亮点、下周计划的演示文稿]
```

### 示例 2: 产品介绍
```
用户: 帮我做一个新产品的发布演示
Claude: [使用 pptx 创建产品特性、竞争优势、定价策略的专业 PPT]
```

### 示例 3: 培训材料
```
用户: 把这份培训文档转成 PPT 课件
Claude: [使用 pptx 提取关键点、创建分章节的培训幻灯片]
```

## Dependencies

- python-pptx (Python)
- Apache POI (Java)
- 或其他 OOXML 兼容库

## LiYe OS Integration

### 业务域引用
此技能被以下业务域引用：
- **08_Communication**: 演示汇报（主域）
- **04_Business_Operations**: 商务演示

### 与其他技能的配合
- **canvas-design**: 设计素材插入 PPT
- **theme-factory**: 应用统一主题风格
- **content-writer**: 演讲稿撰写配合

### 三层架构位置
- **物理层 (本文件)**: Skills/00_Core_Utilities/document-processing/pptx/
- **逻辑层索引**: Skills/{domain}/index.yaml
- **L3 指令层**: .claude/skills/{domain}/pptx/

---
**Created**: 2025-12-28 | **Adapted for LiYe OS**
