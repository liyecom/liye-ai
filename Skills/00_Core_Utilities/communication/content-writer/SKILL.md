---
name: content-writer
description: 内容研究与写作助手
domain: 00_Core_Utilities
category: communication
version: 1.0.0
status: active
source: awesome-claude-skills
source_url: https://github.com/ComposioHQ/awesome-claude-skills
license: Apache-2.0

# SFC v0.1 Required Fields
skeleton: "reference"
triggers:
  commands: ["/content-writer"]
  patterns: ["content-writer"]
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

# Content Research Writer

> **来源**: ComposioHQ/awesome-claude-skills
> **适配**: LiYe OS 三层架构

协助撰写高质量内容，通过研究收集资料、添加引用、优化开头、提供分节反馈。

## When to Use This Skill

当需要撰写高质量内容时：
- 研究并收集主题相关资料
- 撰写带引用的专业文章
- 优化文章开头吸引读者
- 获取结构和内容反馈
- 创作 SEO 友好的内容

## Core Capabilities

### 1. 主题研究
- 收集权威来源资料
- 整理关键信息点
- 识别知识缺口
- 验证事实准确性

### 2. 引用管理
- 添加内联引用
- 生成参考文献列表
- 支持多种引用格式 (APA, MLA, Chicago)
- 确保引用完整性

### 3. 开头优化
- 创作吸引人的开头
- 设置文章基调
- 建立读者兴趣
- A/B 测试不同开头

### 4. 结构建议
- 分析文章结构
- 建议章节划分
- 优化信息流
- 确保逻辑连贯

### 5. 分节反馈
- 逐节质量评估
- 改进建议
- 语言润色
- SEO 优化建议

## Usage Examples

### 示例 1: Amazon Listing 文案
```
用户: 帮我写一个厨房用具的 Amazon 产品描述
Claude: [使用 content-writer 研究竞品文案、提取卖点、撰写优化描述]
```

### 示例 2: 博客文章
```
用户: 写一篇关于跨境电商选品的深度文章
Claude: [使用 content-writer 研究资料、创建大纲、逐节撰写、添加引用]
```

### 示例 3: 技术文档
```
用户: 帮我优化这份 API 文档的结构和内容
Claude: [使用 content-writer 分析结构、提供反馈、改进内容]
```

## Dependencies

- 研究数据库访问（可选）
- 引用管理工具（可选）

## LiYe OS Integration

### 业务域引用
此技能被以下业务域引用：
- **08_Communication**: 内容创作（主域）
- **02_Operation_Intelligence**: Listing 文案优化

### 三层架构位置
- **物理层 (本文件)**: Skills/00_Core_Utilities/communication/content-writer/
- **逻辑层索引**: Skills/{domain}/index.yaml
- **L3 指令层**: .claude/skills/{domain}/content-writer/

---
**Created**: 2025-12-28 | **Adapted for LiYe OS**
