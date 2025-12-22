# 📦 Artifacts Vault - 产出归档库

**作用**: 系统化存储所有项目产出，驱动Skills的自进化

**当前Artifacts数**: 0
**最后更新**: 2025-12-07

---

## 📁 目录结构

```
Artifacts_Vault/
├── by_skill/              # 主分类：按Skill归档
│   ├── Medical_Research_Analyst/
│   │   ├── 20251210_HER2_treatment_analysis.md
│   │   ├── 20251215_EGFR_TKI_comparison.md
│   │   └── ...
│   ├── Content_Creator/
│   └── ...
│
├── by_project/            # 交叉引用：按Project归档
│   ├── breast_cancer_research/
│   │   └── [符号链接到 by_skill/]
│   ├── website_development/
│   └── ...
│
├── by_date/               # 时间索引：按日期归档
│   ├── 2025-12/
│   │   ├── 2025-12-10_*.md -> ../../by_skill/*/...
│   │   └── ...
│   └── ...
│
└── knowledge_graph/       # 知识图谱（未来）
    ├── entities.json      # 实体（药物、疾病、方法等）
    ├── relations.json     # 关系（treats, compared_with等）
    └── visualizations/    # 可视化图谱
```

---

## 🎯 Artifact命名规范

### 文件命名格式

```
YYYYMMDD_[brief_description].md

示例：
- 20251210_HER2_treatment_comparison.md
- 20251215_content_strategy_social_media.md
- 20251220_system_architecture_design.md
```

**规则**:
- 日期前缀（8位数字）
- 下划线分隔
- 简洁描述（3-5个词）
- 小写字母 + 下划线
- Markdown格式

---

## 📝 Artifact元数据标准

每个Artifact必须包含YAML Front Matter：

```yaml
---
# Core Metadata
artifact_id: A20251210001              # 唯一ID（A + YYYYMMDD + 序号）
artifact_type: research_report         # 类型
skill: Medical_Research_Analyst        # 来源Skill
skill_version: v1.0                    # Skill版本
project: breast_cancer_treatment       # 所属Project（可选）
created_date: 2025-12-10
author: LiYe OS

# Quality
quality_score: 88                      # 质量评分（0-100）
quality_dimensions:
  evidence_rigor: 95
  clinical_relevance: 90
  clarity: 85
  utility: 82
  timeliness: 90

# Classification
tags: [HER2+, breast cancer, T-DXd, treatment comparison]
category: Medical Research
domain: 05_Medical_Intelligence

# Evolution Tracking
insights_extracted: false              # 是否已提取insights
methods_updated: false                 # 是否已反馈到methods
templates_enriched: false              # 是否已优化templates
evolution_date: null                   # 进化反馈日期

# Context (可选 - 特定领域可扩展)
pico:                                  # 医学研究特有
  population: HER2+ metastatic BC, 2L
  intervention: T-DXd 5.4mg/kg q3w
  comparison: T-DM1 3.6mg/kg q3w
  outcome: [PFS, OS, ORR]

# References
key_sources:
  - DESTINY-Breast03 (Cortés 2022)
  - NCCN Guidelines v5.2024
---

# [Artifact Content]
...
```

---

## 📊 Artifact类型

| Type | 说明 | 示例Skill |
|------|------|----------|
| **research_report** | 研究报告、文献综述 | Medical Research Analyst |
| **analysis** | 数据分析、战略分析 | Strategic Analyst |
| **content** | 创作内容（文章/视频/播客） | Content Creator |
| **code** | 代码、技术实现 | Full-Stack Developer |
| **design** | 设计稿、原型 | Design Thinker |
| **plan** | 计划、方案、策略 | Product Manager |
| **documentation** | 文档、说明 | Technical Writer |

---

## 🔄 归档流程

### Step 1: 完成Artifact

执行Skill产生输出（报告/代码/设计等）

### Step 2: 添加元数据

在文件头部添加完整YAML Front Matter

### Step 3: 归档到by_skill

```bash
# 保存到对应Skill目录
cp [artifact].md Artifacts_Vault/by_skill/[Skill_Name]/YYYYMMDD_[name].md
```

### Step 4: 创建交叉引用

```bash
# 如果属于某个Project，创建符号链接
cd Artifacts_Vault/by_project/[Project_Name]/
ln -s ../../by_skill/[Skill_Name]/YYYYMMDD_[name].md ./

# 创建日期索引
cd Artifacts_Vault/by_date/YYYY-MM/
ln -s ../../by_skill/[Skill_Name]/YYYYMMDD_[name].md ./
```

### Step 5: 更新Skill的artifacts/

```bash
# Skill目录下的artifacts/也链接过来
cd Skills/[Domain]/[Skill_Name]/artifacts/
ln -s ../../../../Artifacts_Vault/by_skill/[Skill_Name]/*.md ./
```

### Step 6: 触发Evolution Loop

在Skill的evolution_log.md中记录新Artifact，提取insights

---

## 🔍 查找Artifacts

### 按Skill查找

```bash
# 列出某个Skill的所有产出
ls Artifacts_Vault/by_skill/Medical_Research_Analyst/

# 统计数量
ls Artifacts_Vault/by_skill/Medical_Research_Analyst/ | wc -l
```

### 按Project查找

```bash
# 查看某个Project的所有Artifacts
ls -l Artifacts_Vault/by_project/breast_cancer_research/
```

### 按日期查找

```bash
# 查看某个月的所有产出
ls -l Artifacts_Vault/by_date/2025-12/
```

### 按标签查找（需要脚本）

```bash
# 查找包含特定tag的所有Artifacts
grep -l "tags:.*HER2+" Artifacts_Vault/by_skill/*/*.md
```

---

## 📈 统计与分析

### 基础统计

```bash
# 总Artifacts数
find Artifacts_Vault/by_skill -name "*.md" | wc -l

# 各Skill产出数量
for dir in Artifacts_Vault/by_skill/*; do
  echo "$(basename $dir): $(ls $dir/*.md 2>/dev/null | wc -l)"
done

# 本月产出数
ls Artifacts_Vault/by_date/$(date +%Y-%m)/*.md 2>/dev/null | wc -l
```

### 质量分析

```bash
# 平均质量分（需要解析YAML）
grep "quality_score:" Artifacts_Vault/by_skill/*/*.md | \
  awk -F': ' '{sum+=$2; count++} END {print sum/count}'
```

---

## 🧠 Knowledge Graph（未来功能）

### 实体类型

**Medical Intelligence领域**:
- 药物（Drugs）: T-DXd, T-DM1, Osimertinib...
- 疾病（Diseases）: HER2+ Breast Cancer, NSCLC...
- 研究（Studies）: DESTINY-Breast03, FLAURA...
- 方法（Methods）: PICO, GRADE, RCT...

**其他领域**:
- 工具（Tools）
- 概念（Concepts）
- 人物（People）
- 组织（Organizations）

### 关系类型

- **treats**: Drug treats Disease
- **compared_in**: Drug_A compared_in Study_X
- **uses_method**: Artifact uses_method PICO
- **references**: Artifact_A references Study_B
- **followed_by**: Project_A followed_by Project_B

### 应用场景

1. **快速检索**: "找到所有关于T-DXd的Artifacts"
2. **关联发现**: "T-DXd还在哪些研究中出现？"
3. **知识空白**: "EGFR-TKI还没有系统综述"
4. **推荐**: "基于你的兴趣，可能需要这些Skills"

### 实现方式（v2.0）

```json
// entities.json
{
  "drugs": [
    {
      "id": "drug_001",
      "name": "Trastuzumab deruxtecan",
      "aliases": ["T-DXd", "DS-8201", "Enhertu"],
      "type": "ADC",
      "target": "HER2"
    }
  ],
  "diseases": [...],
  "studies": [...]
}

// relations.json
{
  "treats": [
    {
      "subject": "drug_001",
      "object": "disease_002",
      "evidence": ["artifact_A20251210001"],
      "strength": "strong"
    }
  ],
  "compared_in": [...]
}
```

---

## 💡 最佳实践

### 1. 及时归档

- ✅ 项目完成后立即归档
- ✅ 添加完整元数据
- ❌ 不要积压，避免遗忘细节

### 2. 质量优先

- ✅ 每个Artifact都经过质量评分
- ✅ 低质量产出(<60分)需改进后再归档
- ✅ 高质量产出(>85分)标注为exemplar

### 3. 元数据完整

- ✅ 至少包含核心metadata
- ✅ tags要准确且丰富
- ✅ 关联到正确的Skill和Project

### 4. 定期回顾

- ✅ 每月回顾本月Artifacts
- ✅ 提取insights反馈到Skills
- ✅ 识别高频场景，创建新templates

### 5. 知识连接

- ✅ 在Artifact中引用相关Artifacts
- ✅ 建立跨领域连接
- ✅ 丰富知识图谱

---

## 🎯 Evolution Loop集成

Artifacts是Skills进化的核心驱动力。每个Artifact归档后，应触发以下流程：

```
[Artifact归档]
     ↓
[提取Insights]
     ↓
[更新Skill的methods.md]
     ↓
[优化/创建templates]
     ↓
[更新evolution_log.md]
     ↓
[Skill进化到v1.x]
```

详见各Skill的evolution_log.md和Module 10定义。

---

## 📞 维护与支持

- **维护者**: LiYe OS Evolution Engine
- **更新周期**: 持续更新
- **质量监控**: 自动化脚本（v2.0）

---

*"Every Artifact is a seed for future growth."*

**— Artifacts Vault**
