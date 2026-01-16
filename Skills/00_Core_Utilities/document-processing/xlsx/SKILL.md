---
name: xlsx
description: 电子表格创建、编辑与分析工具包
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
  commands: ["/xlsx"]
  patterns: ["xlsx"]
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

# xlsx

> **来源**: ComposioHQ/awesome-claude-skills
> **适配**: LiYe OS 三层架构

综合电子表格操作工具，支持创建、编辑、分析 Excel 文件，包括公式、图表、数据转换等完整功能。

## When to Use This Skill

当 Claude 需要处理电子表格文件时：
- 创建新的电子表格并填充数据
- 读取或分析现有的 .xlsx, .xlsm, .csv, .tsv 文件
- 修改现有电子表格并保留公式
- 执行数据分析和可视化
- 重新计算公式

## Core Capabilities

### 1. 文件读写
- 支持 .xlsx, .xlsm, .csv, .tsv 格式
- 保留原有公式和格式
- 处理多工作表工作簿

### 2. 公式与计算
- 创建和编辑公式
- 支持常用函数 (SUM, AVERAGE, VLOOKUP, IF 等)
- 公式重新计算

### 3. 数据可视化
- 创建图表 (柱状图、折线图、饼图等)
- 条件格式化
- 数据透视表

### 4. 格式化
- 单元格样式 (字体、颜色、边框)
- 数字格式 (货币、百分比、日期)
- 列宽行高调整

### 5. 数据分析
- 数据筛选和排序
- 统计分析
- 数据验证

## Usage Examples

### 示例 1: 读取并分析销售数据
```
用户: 分析这个 Amazon 销售报表的趋势
Claude: [使用 xlsx 技能读取文件，提取数据，生成趋势分析]
```

### 示例 2: 创建关键词矩阵
```
用户: 帮我创建一个关键词研究矩阵表格
Claude: [使用 xlsx 技能创建结构化表格，添加公式计算搜索量权重]
```

### 示例 3: 合并多个数据源
```
用户: 把这三个 CSV 文件合并成一个 Excel 报表
Claude: [使用 xlsx 技能读取多个文件，合并数据，生成格式化报表]
```

## Dependencies

- Python: openpyxl, pandas, xlsxwriter
- 或 Node.js: xlsx, exceljs

## LiYe OS Integration

### 业务域引用
此技能被以下业务域引用：
- **02_Operation_Intelligence**: Amazon 销售/关键词/PPC 报表分析
- **07_Data_Science**: 通用数据分析
- **04_Business_Operations**: 商务报表处理

### 三层架构位置
- **物理层 (本文件)**: Skills/00_Core_Utilities/document-processing/xlsx/
- **逻辑层索引**: Skills/{domain}/index.yaml
- **L3 指令层**: .claude/skills/{domain}/xlsx/

---
**Created**: 2025-12-28 | **Adapted for LiYe OS**
