---
name: docx
description: Word 文档创建、编辑与分析工具
domain: 00_Core_Utilities
category: document-processing
version: 1.0.0
status: active
source: awesome-claude-skills
source_url: https://github.com/ComposioHQ/awesome-claude-skills
license: Apache-2.0
---

# DOCX Document Processing

> **来源**: ComposioHQ/awesome-claude-skills
> **适配**: LiYe OS 三层架构

创建、编辑、分析 Word 文档，支持修订追踪、批注、格式保留、内容提取。

## When to Use This Skill

当需要处理 Word 文档时：
- 创建专业文档（合同、报告、提案）
- 编辑现有文档内容
- 处理修订追踪和批注
- 提取文档文本和结构
- 保留原始格式进行修改

## Core Capabilities

### 1. 文档创建
```python
from docx import Document

doc = Document()
doc.add_heading('报告标题', 0)
doc.add_paragraph('正文内容...')
doc.add_table(rows=3, cols=3)
doc.save('report.docx')
```

### 2. 修订追踪
- 查看修订历史
- 接受/拒绝修改
- 比较文档版本
- 合并多人修订

### 3. 批注管理
- 添加批注
- 回复批注
- 解决批注
- 导出批注列表

### 4. 格式保留
- 段落样式
- 字符格式
- 表格布局
- 页眉页脚
- 目录生成

### 5. 内容提取
- 纯文本提取
- 结构化数据提取
- 表格数据解析
- 图片提取

## Usage Examples

### 示例 1: 合同生成
```
用户: 帮我生成一份采购合同
Claude: [使用 docx 创建带公司抬头、条款、签名栏的专业合同]
```

### 示例 2: 报告编辑
```
用户: 帮我在这份报告中添加执行摘要
Claude: [使用 docx 读取文档、在开头插入摘要章节、保留原格式]
```

### 示例 3: 批量文档处理
```
用户: 把这些 Word 文档的内容提取出来
Claude: [使用 docx 批量提取文本、表格、元数据]
```

## Dependencies

- python-docx (Python)
- docx4j (Java)
- 或其他 OOXML 兼容库

## LiYe OS Integration

### 业务域引用
此技能被以下业务域引用：
- **04_Business_Operations**: 商务文档（主域）
- **08_Communication**: 正式文档撰写

### 与其他技能的配合
- **content-writer**: 内容生成后导出为 docx
- **pdf**: docx 转 PDF 发布

### 三层架构位置
- **物理层 (本文件)**: Skills/00_Core_Utilities/document-processing/docx/
- **逻辑层索引**: Skills/{domain}/index.yaml
- **L3 指令层**: .claude/skills/{domain}/docx/

---
**Created**: 2025-12-28 | **Adapted for LiYe OS**
