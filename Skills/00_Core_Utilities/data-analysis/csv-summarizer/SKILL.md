---
name: csv-summarizer
description: CSV 数据自动分析与洞察生成工具
domain: 00_Core_Utilities
category: data-analysis
version: 1.0.0
status: active
source: awesome-claude-skills
source_url: https://github.com/ComposioHQ/awesome-claude-skills
license: Apache-2.0
---

# CSV Data Summarizer

> **来源**: ComposioHQ/awesome-claude-skills
> **适配**: LiYe OS 三层架构

自动分析 CSV 文件并生成综合洞察报告，无需用户手动提示即可识别数据模式并创建可视化。

## When to Use This Skill

当 Claude 需要分析 CSV 数据时：
- 自动生成数据摘要和统计
- 识别数据中的模式和趋势
- 检测异常值
- 创建数据可视化
- 生成分析报告

## Core Capabilities

### 1. 自动数据摘要
- 数据类型识别
- 缺失值检测
- 数据质量评估
- 基础统计量计算

### 2. 统计分析
- 均值、中位数、标准差
- 分位数分布
- 相关性分析
- 分组统计

### 3. 异常值检测
- 基于统计方法的异常识别
- 离群点标记
- 数据质量警告

### 4. 趋势识别
- 时间序列分析
- 增长/下降趋势
- 周期性模式识别
- 预测建议

### 5. 自动可视化
- 分布直方图
- 趋势折线图
- 相关性热力图
- 分类对比图

## Usage Examples

### 示例 1: 销售数据分析
```
用户: 分析这个销售数据 CSV
Claude: [使用 csv-summarizer 自动生成销售趋势、Top 产品、异常订单等洞察]
```

### 示例 2: 关键词性能分析
```
用户: 帮我分析这份关键词报表的性能
Claude: [使用 csv-summarizer 计算各关键词的 CTR、转化率，标记异常值]
```

### 示例 3: 用户行为分析
```
用户: 从这个用户数据中找出有价值的洞察
Claude: [使用 csv-summarizer 生成用户分群、行为模式、留存分析]
```

## Dependencies

- Python: pandas, matplotlib, seaborn, scipy
- 或 Node.js: csv-parse, chart.js

## LiYe OS Integration

### 业务域引用
此技能被以下业务域引用：
- **07_Data_Science**: 通用数据分析（主域）
- **02_Operation_Intelligence**: Amazon 运营报表分析

### 三层架构位置
- **物理层 (本文件)**: Skills/00_Core_Utilities/data-analysis/csv-summarizer/
- **逻辑层索引**: Skills/{domain}/index.yaml
- **L3 指令层**: .claude/skills/{domain}/csv-summarizer/

---
**Created**: 2025-12-28 | **Adapted for LiYe OS**
