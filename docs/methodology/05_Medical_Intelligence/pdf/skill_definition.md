# 📄 PDF Document Processing Skill

**Version**: 1.0
**Created**: 2025-12-28
**Last Updated**: 2025-12-28
**Status**: Active
**Source**: Awesome Claude Skills → LiYe OS Adapted

---

## 🔹01. Skill Identity（技能身份）

**Skill Name**: PDF Document Processing / PDF 文档处理

**Core Mission**:
为医疗研究提供 PDF 文档处理能力，支持医学文献、临床指南、研究论文的解析、提取和分析，是 Medical Research Analyst 技能的基础依赖。

**Capability Domain**: Medical Intelligence
- 医学文献 PDF 解析
- 临床指南提取
- 研究论文结构化
- 表格与图表提取
- 元数据与引用管理

**Target Scenarios**:
- 医学期刊论文解析（NEJM, Lancet, JAMA 等）
- 临床实践指南提取（NCCN, ESMO 等）
- 药物说明书解析
- 临床试验报告处理
- 系统综述/Meta 分析文献处理

---

## 🔹02. Capability Model（能力模型）

### Key Competencies（核心能力维度）

#### A. 文本提取
- 多栏布局识别
- 页眉页脚过滤
- 脚注/尾注处理
- 特殊字符与公式识别

#### B. 结构识别
- 标题层级解析
- 章节边界识别
- 摘要/正文/参考文献分区
- IMRAD 结构识别（Introduction, Methods, Results, Discussion）

#### C. 表格提取
- 复杂表格识别
- 跨页表格合并
- 表头识别与列对齐
- 数据类型推断

#### D. 图表处理
- 图片提取
- 图例识别
- 数据图表 OCR

#### E. 元数据提取
- 标题、作者、机构
- 发表日期、期刊
- DOI、PMID
- 引用列表

---

## 🔹03. Mental Models / Principles（思维模型 / 原则）

### Core Thinking Frameworks

#### 1. 医学论文 IMRAD 结构
```
Introduction（引言）
    ↓ 研究背景、目的
Methods（方法）
    ↓ 研究设计、样本、干预
Results（结果）
    ↓ 主要发现、数据
Discussion（讨论）
    ↓ 解释、局限、结论
```

#### 2. 证据提取优先级
```
高优先级：
├── Abstract（快速概览）
├── Results Tables（核心数据）
├── Forest Plot（Meta 分析）
└── Conclusion（主要结论）

中优先级：
├── Methods（可信度评估）
├── Discussion（解释与局限）
└── Figures（可视化数据）

低优先级：
├── Introduction（背景）
└── References（延伸阅读）
```

### Unbreakable Principles（不可违反原则）

1. **完整性保证**：不遗漏关键数据表格
2. **准确性优先**：数值提取必须精确
3. **结构保留**：维持原文逻辑层次
4. **来源标注**：标注页码和位置

---

## 🔹04. Methods & SOPs（方法论 / 操作手册）

### Standard Operating Procedure: PDF Processing

#### Phase 1: 文档预处理
```
Step 1.1 文档识别
  - 确认 PDF 类型（文本型/扫描型）
  - 检测语言（英文/中文/混合）
  - 评估文档质量

Step 1.2 结构分析
  - 识别文档类型（论文/指南/报告）
  - 确定章节结构
  - 标记提取目标区域
```

#### Phase 2: 内容提取
```
Step 2.1 文本提取
  - 按页提取文本
  - 处理多栏布局
  - 过滤页眉页脚

Step 2.2 表格提取
  - 识别表格边界
  - 解析表格结构
  - 验证数据完整性

Step 2.3 元数据提取
  - 提取标题和作者
  - 获取发表信息
  - 提取 DOI/PMID
```

#### Phase 3: 结构化输出
```
Step 3.1 组织内容
  - 按章节组织文本
  - 嵌入表格和图表
  - 添加交叉引用

Step 3.2 质量检查
  - 验证提取完整性
  - 校对关键数值
  - 确认格式正确
```

---

## 🔹05. Execution Protocols（执行协议）

### Pre-Execution Checklist

**必须确认的问题**：
1. ✓ PDF 文件是否可访问？
2. ✓ 需要提取的内容类型？（全文/摘要/表格/特定章节）
3. ✓ 输出格式要求？（Markdown/JSON/结构化表格）
4. ✓ 是否需要 OCR？（扫描件）

### Decision-Making Logic

**文本型 PDF**：
→ 直接文本提取
→ 使用 pdfplumber/PyPDF2

**扫描型 PDF**：
→ 需要 OCR 处理
→ 使用 Tesseract + pdf2image

**复杂表格**：
→ 使用 Camelot/Tabula
→ 人工验证结果

---

## 🔹06. Output Structure（标准化交付格式）

### Template: 医学文献解析报告

```markdown
# 文献解析报告

## 📋 元数据
- **标题**: [论文标题]
- **作者**: [作者列表]
- **期刊**: [期刊名称]
- **发表日期**: [YYYY-MM-DD]
- **DOI**: [DOI]
- **PMID**: [PMID]

## 📝 摘要
[原文摘要]

## 🎯 关键发现
1. [发现1]
2. [发现2]
3. [发现3]

## 📊 核心数据表
[提取的关键表格]

## 📈 主要图表
[图表描述或提取]

## 💡 研究结论
[原文结论摘要]

## ⚠️ 局限性
[研究局限性]

## 📚 关键引用
[重要参考文献]
```

---

## 🔹07. Templates & Prompts（模板库）

### 激活 Prompt

```
激活 PDF Document Processing Skill

文件：[PDF 文件路径]
提取目标：[全文/摘要/表格/特定章节]
输出格式：[Markdown/JSON/表格]

请按照 skill_definition.md 的 SOP 执行提取。
```

### 常用提取模式

```python
# 提取摘要
extract_section(pdf, "Abstract")

# 提取所有表格
extract_all_tables(pdf)

# 提取特定章节
extract_section(pdf, "Results")

# 提取元数据
extract_metadata(pdf)
```

---

## 🔹08. Tools Access / Knowledge Assets（工具 & 知识接口）

### Required Dependencies

**Python 库**：
- PyPDF2 / pypdf（基础读取）
- pdfplumber（文本+表格）
- Camelot / Tabula（复杂表格）
- pdf2image + Tesseract（OCR）

**Node.js 库**：
- pdf-parse
- pdf-lib
- pdf2json

### LiYe OS Integration Points

**上游来源**：
- PubMed 下载的论文
- 临床指南 PDF
- 药物说明书

**下游输出**：
- Medical Research Analyst Skill 的输入
- 证据表格构建
- 知识库更新

---

## 🔹09. Evaluation & Scoring（绩效 & 质量指标）

### Output Quality Metrics

| 维度 | 权重 | 评分标准 |
|------|------|----------|
| 文本准确性 | 35% | OCR 错误率 < 1% |
| 表格完整性 | 30% | 表格结构完整，数值正确 |
| 结构识别 | 20% | 章节边界准确 |
| 元数据完整 | 15% | 关键元数据无遗漏 |

### Self-Evaluation Checklist

- [ ] 所有页面已处理？
- [ ] 关键表格已提取？
- [ ] 数值已验证？
- [ ] 元数据完整？

---

## 🔹10. Feedback / Evolution Loop（进化循环机制）

### 持续改进触发条件

1. **新期刊格式**：更新布局识别规则
2. **OCR 错误模式**：添加后处理校正
3. **表格提取失败**：扩展 Camelot 配置

### 版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2025-12-28 | 初始版本创建 |

---

**END OF SKILL DEFINITION**
