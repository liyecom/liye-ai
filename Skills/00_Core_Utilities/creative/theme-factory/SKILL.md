---
name: theme-factory
description: 主题样式工厂 - 统一视觉风格应用
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
  commands: ["/theme-factory"]
  patterns: ["theme-factory"]
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

# Theme Factory

> **来源**: ComposioHQ/awesome-claude-skills
> **适配**: LiYe OS 三层架构

为幻灯片、文档、报告、Landing Page 应用专业主题，包含 10 个预设主题和自定义主题生成能力。

## When to Use This Skill

当需要统一视觉风格时：
- 为文档应用品牌主题
- 快速切换不同风格
- 保持跨格式一致性
- 创建自定义主题
- 批量应用视觉标准

## Core Capabilities

### 1. 预设主题 (10个)

| 主题名称 | 风格描述 | 适用场景 |
|---------|---------|---------|
| Corporate Blue | 专业商务蓝 | 企业报告、正式汇报 |
| Modern Minimal | 现代简约 | 科技产品、创业路演 |
| Creative Bold | 创意大胆 | 营销材料、品牌展示 |
| Nature Green | 自然绿色 | 环保、健康主题 |
| Warm Sunset | 温暖日落 | 生活方式、旅游 |
| Dark Professional | 深色专业 | 高端产品、金融 |
| Light Academic | 浅色学术 | 研究报告、论文 |
| Playful Bright | 活泼明亮 | 教育、儿童产品 |
| Elegant Luxury | 优雅奢华 | 高端品牌、奢侈品 |
| Tech Gradient | 科技渐变 | AI、软件产品 |

### 2. 主题元素
```yaml
theme:
  colors:
    primary: "#0066CC"
    secondary: "#004499"
    accent: "#FF6600"
    background: "#FFFFFF"
    text: "#333333"
  typography:
    heading: "Montserrat"
    body: "Open Sans"
    mono: "Fira Code"
  spacing:
    base: 8px
    scale: 1.5
```

### 3. 跨格式应用
- **文档**: Word, PDF
- **演示**: PowerPoint, Keynote
- **网页**: HTML, Landing Page
- **图片**: PNG, SVG 素材

### 4. 自定义主题生成
- 从品牌色生成完整配色
- 自动计算对比度
- 生成明暗变体
- 导出主题配置

### 5. 快速换肤
- 一键切换主题
- 保留内容结构
- 批量处理多文件

## Usage Examples

### 示例 1: 品牌统一
```
用户: 把这些材料都换成我们公司的品牌色
Claude: [使用 theme-factory 提取品牌色、生成主题、批量应用]
```

### 示例 2: 风格探索
```
用户: 这份报告用什么风格比较好？给我几个选择
Claude: [使用 theme-factory 预览 3-4 种主题效果供选择]
```

### 示例 3: 主题创建
```
用户: 帮我创建一个以深蓝色为主的专业主题
Claude: [使用 theme-factory 生成完整配色方案、字体组合、应用示例]
```

## Dependencies

- 色彩处理库
- 字体管理
- 模板引擎

## LiYe OS Integration

### 业务域引用
此技能被以下业务域引用：
- **03_Creative_Production**: 视觉风格（主域）
- **08_Communication**: 演示主题

### 与其他技能的配合
- **canvas-design**: 为设计稿应用主题
- **pptx**: 为演示文稿应用主题
- **docx**: 为文档应用主题
- **artifacts-builder**: 为 Web 组件应用主题

### 三层架构位置
- **物理层 (本文件)**: Skills/00_Core_Utilities/creative/theme-factory/
- **逻辑层索引**: Skills/{domain}/index.yaml
- **L3 指令层**: .claude/skills/{domain}/theme-factory/

---
**Created**: 2025-12-28 | **Adapted for LiYe OS**
