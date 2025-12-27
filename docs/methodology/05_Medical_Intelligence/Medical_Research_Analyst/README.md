# 🏥 Medical Research Analyst Skill

**版本**: v1.0
**创建时间**: 2025-12-07
**所属领域**: 05_Medical_Intelligence
**状态**: ✅ Active

---

## 🎯 Skill 简介

Medical Research Analyst 是 LiYe OS 中专门用于医学研究分析和循证决策支持的核心能力。它将复杂的医学文献、临床指南和前沿研究转化为可执行的洞察和决策依据。

**核心价值**：
- 🔍 系统化医学文献检索与质量评估
- 📊 基于PICO框架的结构化分析
- 💊 治疗方案、药物评估、生物标志物分析
- 📈 证据等级分级（GRADE, Oxford CEBM）
- 🎯 可执行的临床决策建议

---

## 📂 文件结构

```
Medical_Research_Analyst/
├── README.md                    # 本文件 - 使用指南
├── skill_definition.md          # 完整技能定义（10模块）
├── methods.md                   # 详细方法与实施细节
├── evolution_log.md             # 技能进化记录
├── templates/                   # 输出模板库
│   ├── evidence_summary_table.md
│   ├── treatment_comparison_matrix.md
│   ├── literature_search_strategy.md
│   └── decision_framework.md
└── artifacts/                   # 项目输出存档
    └── (按日期/项目组织的研究报告)
```

---

## 🚀 快速开始

### 1. 基础调用方式

```markdown
**Activate Skill**: Medical Research Analyst

**Research Question**:
对于HER2+乳腺癌脑转移患者，T-DXd与Tucatinib+Capecitabine相比，哪个治疗方案更优？

**Context**:
- 患者：55岁女性，HER2+ HR+ 乳腺癌
- 既往治疗：曲妥珠单抗+帕妥珠单抗+紫杉醇一线治疗进展
- 现状：影像确诊脑转移（3个病灶，最大1.5cm）
- 决策因素：疗效、脑转移控制、副作用、生活质量

**Requirements**:
1. 提供高质量RCT证据比较
2. 重点评估脑转移的控制效果
3. 分析副作用差异
4. 给出优先推荐方案及理由
```

### 2. 标准化PICO调用

```markdown
**P** (Population): HER2+乳腺癌脑转移患者，二线治疗
**I** (Intervention): T-DXd (5.4mg/kg, q3w)
**C** (Comparison): Tucatinib + Capecitabine + Trastuzumab
**O** (Outcomes):
  - Primary: CNS PFS, ORR
  - Secondary: OS, safety profile, QoL

**Evidence Level Required**: Level 1-2 (RCT/Meta-analysis)
```

---

## 📋 核心能力

### 1. Evidence-Based Research（循证研究）
- 多源医学文献检索（PubMed, Cochrane, Embase）
- 文献质量评估（RCT vs 观察性研究）
- 证据等级分级（GRADE, Oxford CEBM）

### 2. Clinical Reasoning（临床推理）
- PICO框架结构化问题
- NNT/NNH计算与解释
- Bayesian思维（先验-后验概率）

### 3. Critical Analysis（批判性分析）
- 识别研究偏倚（Selection bias, Publication bias）
- 评估临床意义 vs 统计学意义
- 可推广性分析（External validity）

### 4. Structured Communication（结构化沟通）
- 分层输出（Executive Summary → 详细分析）
- 可视化数据呈现
- 决策树与推荐逻辑

---

## 🔄 标准工作流程（SOP）

### Phase 1: Problem Definition（问题定义）
1. 使用PICO框架结构化问题
2. 识别关键决策点
3. 确定证据等级需求

### Phase 2: Literature Search（文献检索）
1. 构建检索策略（MeSH terms + keywords）
2. 多数据库检索（PubMed, Cochrane, ClinicalTrials.gov）
3. 初步筛选（Title/Abstract screening）

### Phase 3: Critical Appraisal（批判性评估）
1. 全文筛选（Full-text review）
2. 质量评估（RoB 2.0, GRADE）
3. 数据提取（Outcomes, sample size, effect size）

### Phase 4: Synthesis & Analysis（综合分析）
1. 证据汇总（Evidence tables）
2. 效应量计算（HR, OR, NNT）
3. 异质性分析（I² statistic）

### Phase 5: Structured Output（结构化输出）
1. Executive Summary（1-2段核心结论）
2. 详细证据分析
3. 推荐方案及置信度等级

---

## 📊 输出模板

### Template 1: Treatment Option Analysis Report
用于**治疗方案比较**场景。

**适用场景**：
- 一线 vs 二线治疗选择
- 不同药物组合比较
- 标准治疗 vs 临床试验

**输出结构**：
1. Executive Summary
2. PICO Framework
3. Evidence Summary
4. Comparative Analysis
5. Risk-Benefit Assessment
6. Recommendation

### Template 2: Drug/Therapy Evaluation
用于**单一药物/疗法深度评估**。

**适用场景**：
- 新药上市评估
- 适应症扩展评估
- 长期安全性监测

### Template 3: Diagnostic/Prognostic Biomarker Analysis
用于**生物标志物临床应用评估**。

**适用场景**：
- 伴随诊断标志物评估
- 预后标志物临床意义
- 液体活检技术评估

---

## 🎯 使用示例

### 示例 1: 治疗方案选择

**输入**：
```
Question: 对于EGFR突变NSCLC患者，奥希替尼一线治疗 vs 第一代EGFR-TKI，哪个更优？

Context:
- 患者：65岁男性，EGFR exon 19缺失
- PS评分：1分
- 脑转移风险：中等
```

**输出**（简化版）：
```markdown
# Executive Summary
**推荐方案**: 奥希替尼一线治疗 (Strong Recommendation, High-quality evidence)

**核心依据**:
- FLAURA研究（RCT, N=556）显示奥希替尼 vs 第一代TKI:
  - PFS: 18.9m vs 10.2m (HR 0.46, p<0.001)
  - CNS PFS: 未达到 vs 13.9m (HR 0.48)
  - OS: 38.6m vs 31.8m (HR 0.80, p=0.046)

**关键优势**:
1. 显著延长PFS（+8.7个月）
2. 更强的脑转移预防效果
3. OS获益（+6.8个月）

**需权衡的点**:
- 费用较高
- 某些副作用（腹泻、皮疹）发生率相似
```

### 示例 2: 生物标志物评估

**输入**：
```
Question: ctDNA检测用于早期乳腺癌术后MRD监测的临床价值？

Context:
- 目标人群：II-III期乳腺癌术后患者
- 关注结局：复发预测、治疗决策指导
```

**输出**（简化版）：
```markdown
# Executive Summary
**临床应用价值**: 中等（Moderate evidence, 需进一步验证研究）

**核心证据**:
1. Meta-analysis (8 studies, N=1,847): ctDNA阳性 vs 阴性
   - 复发风险: HR 10.9 (95% CI: 5.8-20.4)
   - 提前检测时间: 平均7.9个月先于影像学

2. 敏感性/特异性:
   - 敏感性: 60-85%（取决于检测时间点）
   - 特异性: 90-98%

**临床应用建议**:
1. ✅ 可用于高危患者的复发监测
2. ⚠️ 不应作为唯一治疗决策依据（需结合影像）
3. ❌ 不建议用于低危患者的常规筛查（成本效益比不佳）
```

---

## 🔧 质量控制

### 输出质量评分维度

| 维度 | 权重 | 评分标准 |
|------|------|---------|
| **Evidence Rigor** | 35% | 证据等级、研究质量、样本量 |
| **Clinical Relevance** | 30% | 与患者特征匹配度、临床可操作性 |
| **Communication Clarity** | 20% | 结构清晰度、术语准确性 |
| **Decision Utility** | 10% | 推荐明确性、置信度标注 |
| **Timeliness** | 5% | 文献发表时间、指南版本 |

**合格标准**: 总分 ≥ 75/100

---

## 🔄 进化机制

### Artifacts 反馈循环

每次执行 Medical Research Analyst 产生的报告都会存入 `artifacts/` 目录，并触发以下进化机制：

1. **Artifacts Categorization（分类）**
   - 按疾病领域归档
   - 按分析类型分类

2. **Insight Extraction（洞察提取）**
   - 识别高频研究问题
   - 提取常见决策模式

3. **Methods Update（方法更新）**
   - 优化检索策略
   - 改进质量评估标准

4. **Template Enrichment（模板丰富）**
   - 新增疾病特定模板
   - 优化输出结构

5. **Knowledge Graph Building（知识图谱）**
   - 构建药物-适应症关系图
   - 构建证据-推荐映射

**进化记录**: 所有更新记录在 `evolution_log.md`

---

## 🔗 集成接口

### 与 LiYe OS 其他模块的连接

#### 输入接口
- **从 PARA 获取背景信息**:
  - `20 Areas/健康医疗.md` → 患者历史背景
  - `30 Resources/技术文档.md` → 医学数据库使用指南

#### 输出接口
- **输出到 Artifacts Vault**:
  - `artifacts/medical_research/` → 研究报告归档
  - 自动触发进化反馈机制

#### 跨 Skill 协作
- **与其他 Skills 的协同**:
  - → `Medical Data Analyst`: 提供原始数据后由该skill进行统计分析
  - → `Treatment Plan Designer`: 提供循证依据后由该skill设计具体治疗方案
  - ← `Medical Literature Monitor`: 接收最新文献推送

---

## 📚 参考资源

### 必备数据库
- **PubMed**: https://pubmed.ncbi.nlm.nih.gov/
- **Cochrane Library**: https://www.cochranelibrary.com/
- **ClinicalTrials.gov**: https://clinicaltrials.gov/
- **Embase**: (需机构订阅)

### 临床指南
- **NCCN Guidelines**: https://www.nccn.org/guidelines
- **ESMO Guidelines**: https://www.esmo.org/guidelines
- **ASCO Guidelines**: https://www.asco.org/practice-patients/guidelines

### 证据分级系统
- **GRADE Handbook**: https://gdt.gradepro.org/app/handbook/handbook.html
- **Oxford CEBM Levels**: https://www.cebm.ox.ac.uk/resources/levels-of-evidence

---

## 📝 维护日志

详细的版本更新和进化记录见 `evolution_log.md`。

**当前版本**: v1.0
**最后更新**: 2025-12-07
**下一步计划**:
- [ ] 创建首个实战案例（乳腺癌治疗方案分析）
- [ ] 建立医学术语词汇表
- [ ] 开发自动化文献筛选脚本

---

## 🆘 故障排除

### 常见问题

**Q1: 找不到足够的高质量证据怎么办？**
- 降低证据等级要求（接受观察性研究）
- 扩大检索范围（包含会议摘要）
- 明确标注证据限制

**Q2: 不同研究结果矛盾怎么处理？**
- 评估研究质量差异
- 分析患者群体异质性
- 进行亚组分析
- 明确标注不确定性

**Q3: 如何处理极新的研究（如刚发表的会议摘要）？**
- 标注为"初步证据"
- 说明数据成熟度限制
- 建议等待全文发表后再次评估

---

## 📧 联系与反馈

如有问题或改进建议，请记录在 `evolution_log.md` 的反馈区。

---

*This Skill is part of LiYe OS - A self-evolving personal AI capability system.*
