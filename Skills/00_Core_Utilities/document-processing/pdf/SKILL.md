---
name: pdf
description: PDF 综合操作工具：提取、合并、注释、表单处理
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
  commands: ["/pdf"]
  patterns: ["pdf"]
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

# pdf

> **来源**: ComposioHQ/awesome-claude-skills
> **适配**: LiYe OS 三层架构

综合 PDF 操作工具，支持提取文本/表格/元数据，合并/拆分文档，添加注释，处理表单。

## When to Use This Skill

当 Claude 需要处理 PDF 文件时：
- 从 PDF 中提取文本、表格或元数据
- 创建新的 PDF 文档
- 合并或拆分 PDF 文件
- 添加注释或批注
- 处理 PDF 表单

## Core Capabilities

### 1. 文本提取
- 提取全文内容
- 保留文档结构
- 识别标题和段落层级
- OCR 支持（扫描件）

### 2. 表格提取
- 识别表格结构
- 导出为结构化数据
- 支持复杂嵌套表格

### 3. 元数据处理
- 读取文档属性
- 提取作者、创建日期等信息
- 修改文档元数据

### 4. 文档操作
- 合并多个 PDF
- 拆分为多个文件
- 页面重排序
- 提取特定页面

### 5. 注释与表单
- 添加高亮和批注
- 填写表单字段
- 创建可填写表单

## Usage Examples

### 示例 1: 提取研究论文内容
```
用户: 提取这篇医学论文的摘要和结论
Claude: [使用 pdf 技能提取指定章节内容]
```

### 示例 2: 合并多个报告
```
用户: 把这些季度报告合并成一个年度汇总
Claude: [使用 pdf 技能合并文件，添加目录页]
```

### 示例 3: 提取表格数据
```
用户: 从这个 PDF 报告中提取数据表格
Claude: [使用 pdf 技能识别并提取表格，转为结构化格式]
```

## Dependencies

- Python: PyPDF2, pdfplumber, reportlab, PyMuPDF
- 或 Node.js: pdf-lib, pdf-parse

## LiYe OS Integration

### 业务域引用
此技能被以下业务域引用：
- **05_Medical_Intelligence**: 医学文献、临床指南解析
- **01_Research_Intelligence**: 学术论文分析
- **04_Business_Operations**: 商务文档处理

### 三层架构位置
- **物理层 (本文件)**: Skills/00_Core_Utilities/document-processing/pdf/
- **逻辑层索引**: Skills/{domain}/index.yaml
- **L3 指令层**: .claude/skills/{domain}/pdf/

---
**Created**: 2025-12-28 | **Adapted for LiYe OS**
