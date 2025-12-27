# Literature Search Strategy Template

**用途**: 系统化记录文献检索过程，确保可重复性和透明度
**适用场景**: 所有循证医学研究、系统综述、Meta-analysis

---

## 🔍 Literature Search Strategy

### 1. Research Question (PICO Framework)

| Element | Details |
|---------|---------|
| **P** (Population) | [目标患者群体] |
| **I** (Intervention) | [干预措施/暴露因素] |
| **C** (Comparison) | [对照/比较措施] |
| **O** (Outcome) | [关注结局指标] |
| **Study Design** | [期望研究类型：RCT / Observational / All] |
| **Time Frame** | [文献时间范围：如 2015-2025] |

**Example**:
```
P: HER2阳性转移性乳腺癌患者，既往接受过曲妥珠单抗治疗
I: Trastuzumab deruxtecan (T-DXd)
C: 其他HER2靶向治疗（T-DM1, Tucatinib等）
O: 主要关注 PFS, OS, ORR；次要关注 CNS疗效, 安全性
Study Design: 优先RCT，接受高质量单臂研究
Time Frame: 2018-2025（T-DXd首次报道至今）
```

---

### 2. Search Databases & Dates

| Database | Search Date | Date Range | Results |
|----------|-------------|------------|---------|
| PubMed | YYYY-MM-DD | 起始-终止 | n篇 |
| Cochrane Library | YYYY-MM-DD | 起始-终止 | n篇 |
| Embase | YYYY-MM-DD | 起始-终止 | n篇 |
| ClinicalTrials.gov | YYYY-MM-DD | All | n项试验 |
| ASCO/ESMO Abstracts | YYYY-MM-DD | 最近2年 | n篇摘要 |

**Example**:
```
PubMed         | 2025-12-07 | 2018-2025 | 156
Cochrane       | 2025-12-07 | All       | 12
Embase         | 2025-12-07 | 2018-2025 | 234
ClinicalTrials | 2025-12-07 | All       | 23
ASCO/ESMO      | 2025-12-07 | 2024-2025 | 18
```

---

### 3. Search Strategy (Detailed)

#### 3.1 PubMed Search Strategy

**Search Date**: [YYYY-MM-DD]
**Filters Applied**: [语言/文章类型/时间范围]

```
#1  "Breast Neoplasms"[Mesh] OR "breast cancer"[tiab] OR "breast carcinoma"[tiab]
#2  "Receptor, ErbB-2"[Mesh] OR "HER2"[tiab] OR "ERBB2"[tiab] OR "HER2-positive"[tiab]
#3  #1 AND #2
#4  "trastuzumab deruxtecan"[tiab] OR "T-DXd"[tiab] OR "DS-8201"[tiab] OR "Enhertu"[tiab]
#5  #3 AND #4
#6  "Neoplasm Metastasis"[Mesh] OR "metastatic"[tiab] OR "advanced"[tiab]
#7  #5 AND #6
#8  #7 AND ("2018/01/01"[PDAT] : "2025/12/07"[PDAT])
#9  #8 AND (English[lang] OR Chinese[lang])
#10 #9 AND (Clinical Trial[ptyp] OR Randomized Controlled Trial[ptyp] OR Review[ptyp])

FINAL SEARCH: #10
Results: 156 articles
```

**Search String (复制版)**:
```
("Breast Neoplasms"[Mesh] OR "breast cancer"[tiab]) AND
("Receptor, ErbB-2"[Mesh] OR "HER2"[tiab] OR "HER2-positive"[tiab]) AND
("trastuzumab deruxtecan"[tiab] OR "T-DXd"[tiab] OR "DS-8201"[tiab] OR "Enhertu"[tiab]) AND
("Neoplasm Metastasis"[Mesh] OR "metastatic"[tiab]) AND
("2018/01/01"[PDAT] : "2025/12/07"[PDAT]) AND
(English[lang] OR Chinese[lang])
```

#### 3.2 Embase Search Strategy

**Search Date**: [YYYY-MM-DD]

```
#1  'breast cancer'/exp OR 'breast cancer':ab,ti
#2  'erb b2 receptor'/exp OR 'her2':ab,ti OR 'her2 positive':ab,ti
#3  #1 AND #2
#4  'trastuzumab deruxtecan'/exp OR 'trastuzumab deruxtecan':ab,ti OR 't dxd':ab,ti OR 'ds 8201':ab,ti
#5  #3 AND #4
#6  'metastasis'/exp OR 'metastatic':ab,ti OR 'advanced':ab,ti
#7  #5 AND #6
#8  #7 AND [2018-2025]/py
#9  #8 AND ([english]/lim OR [chinese]/lim)
#10 #9 AND ([article]/lim OR [review]/lim OR [randomized controlled trial]/lim)

FINAL SEARCH: #10
Results: 234 articles
```

#### 3.3 Cochrane Library Search Strategy

```
#1  MeSH descriptor: [Breast Neoplasms] explode all trees
#2  (breast cancer):ti,ab,kw OR (breast carcinoma):ti,ab,kw
#3  #1 OR #2
#4  MeSH descriptor: [Receptor, ErbB-2] explode all trees
#5  (HER2 OR ERBB2 OR HER2-positive):ti,ab,kw
#6  #4 OR #5
#7  #3 AND #6
#8  (trastuzumab deruxtecan OR T-DXd OR DS-8201 OR Enhertu):ti,ab,kw
#9  #7 AND #8
#10 (metastatic OR advanced):ti,ab,kw
#11 #9 AND #10 with Cochrane Library publication date Between 2018 and 2025

Results: 12 reviews
```

#### 3.4 ClinicalTrials.gov Search Strategy

**Search Interface**: Advanced Search

**Condition**: `Breast Cancer AND HER2-positive`
**Intervention**: `trastuzumab deruxtecan OR T-DXd OR DS-8201`
**Study Type**: `Interventional Studies (Clinical Trials)`
**Study Results**: `All Studies`
**Study Start**: `From 01/01/2018 to 12/07/2025`

**Results**: 23 trials

**Key Trials Identified**:
- NCT03529110 (DESTINY-Breast03)
- NCT03248492 (DESTINY-Breast01)
- NCT03523585 (DESTINY-Breast02)

#### 3.5 Conference Abstracts Search

**ASCO Annual Meeting (2024-2025)**:
- Search Term: `HER2-positive breast cancer trastuzumab deruxtecan`
- Results: 12 abstracts

**ESMO Congress (2024-2025)**:
- Search Term: `HER2+ breast cancer T-DXd`
- Results: 6 abstracts

---

### 4. Inclusion & Exclusion Criteria

#### Inclusion Criteria
- [ ] **Population**: HER2阳性转移性乳腺癌患者
- [ ] **Intervention**: 涉及T-DXd治疗（任何线数）
- [ ] **Comparator**: 有对照组或历史对照
- [ ] **Outcomes**: 报告至少一项关键疗效指标（PFS/OS/ORR）
- [ ] **Study Design**: RCT、单臂II期临床试验、大型队列研究(N≥50)
- [ ] **Language**: 英文或中文
- [ ] **Publication Type**: 全文发表或重要会议摘要

#### Exclusion Criteria
- [ ] **Population**: 仅包含HER2阴性患者
- [ ] **Study Design**: Case reports (N<10), 综述/社论（非系统综述）
- [ ] **Outcomes**: 仅报告药代动力学数据，无临床疗效
- [ ] **Duplication**: 重复发表（保留最新/最完整版本）
- [ ] **Quality**: 明显方法学缺陷的研究

---

### 5. Screening Process

#### Stage 1: Title & Abstract Screening

| Source | Initial Results | After Title/Abstract Screening | Excluded | Exclusion Reasons |
|--------|-----------------|-------------------------------|----------|-------------------|
| PubMed | 156 | 45 | 111 | 重复(32), 无关人群(45), Case reports(18), 综述(16) |
| Embase | 234 | 38 | 196 | 与PubMed重复(150), 其他同上 |
| Cochrane | 12 | 8 | 4 | 系统综述（纳入但单独分析） |
| ClinicalTrials | 23 | 15 | 8 | 已终止(3), 仅I期(5) |
| Conferences | 18 | 6 | 12 | 无新数据(已正式发表) |
| **Total** | **443** | **112** | **331** | - |

**去重后**: 85篇独立研究

#### Stage 2: Full-Text Screening

| Screening Result | Number | Key Studies |
|------------------|--------|-------------|
| **Included** | 12 | DESTINY-Breast01/02/03, 其他 |
| **Excluded** | 73 | 详见下表 |

**Exclusion Reasons (Full-Text)**:

| Reason | Count | Examples |
|--------|-------|----------|
| 无关结局指标 | 15 | 仅报告生物标志物，无临床结局 |
| 样本量过小(N<20) | 8 | 单中心经验 |
| 研究设计不符 | 12 | 回顾性病例对照，质量低 |
| 数据不完整 | 18 | 会议摘要，数据未成熟 |
| 重复报道 | 20 | 同一研究的不同时间点更新（保留最新） |

---

### 6. Final Included Studies

| Study ID | First Author | Year | Design | Population | N | Key Findings | Evidence Level |
|----------|--------------|------|--------|------------|---|--------------|----------------|
| 1 | Cortés J | 2022 | RCT Phase III | HER2+ mBC, 2L | 524 | T-DXd vs T-DM1: mPFS 28.8m vs 6.8m (HR 0.33) | Level 1 |
| 2 | Modi S | 2020 | Single-arm Phase II | HER2+ mBC, 3L+ | 184 | ORR 60.9%, mPFS 16.4m | Level 2 |
| 3 | ... | ... | ... | ... | ... | ... | ... |

**Total Included**: 12 studies
- RCTs: 3
- Single-arm trials: 6
- Observational studies: 3

---

### 7. Search Limitations & Biases

#### Acknowledged Limitations
- ✅ **Publication Bias**: 未系统检索灰色文献（学位论文、内部报告）
- ✅ **Language Bias**: 仅纳入英文和中文文献，可能遗漏其他语言重要研究
- ✅ **Time Lag**: 最新研究可能未被索引（检索时间：2025-12-07）
- ✅ **Database Coverage**: 未检索中文数据库（万方、知网）

#### Mitigation Strategies
- 检索了主要会议摘要（ASCO, ESMO）以纳入最新数据
- 手工检索了纳入研究的参考文献（snowballing）
- 咨询了临床专家，补充遗漏的关键研究

---

### 8. Supplementary Search Methods

#### Hand Search（手工检索）
- **Key Journals**:
  - New England Journal of Medicine
  - The Lancet Oncology
  - Journal of Clinical Oncology
  - Reviewed issues: 2020-2025

- **Results**: 2 additional studies identified

#### Citation Tracking（引文追踪）
- **Forward citation**: Google Scholar跟踪DESTINY-Breast01的引用（524篇引用中筛选）
- **Backward citation**: 检索纳入研究的参考文献

- **Results**: 3 additional relevant studies

#### Expert Consultation（专家咨询）
- **Experts**: 2位乳腺肿瘤专家
- **Method**: 提供初步纳入研究列表，询问是否遗漏重要研究

- **Results**: 确认未遗漏关键研究

---

### 9. Search Update Plan

**Initial Search Date**: 2025-12-07

**Planned Updates**:
- 每6个月更新一次（下次：2026-06-07）
- 重大临床试验结果公布时立即更新
- 临床指南更新时复核证据

**Update Alert Settings**:
- PubMed Auto-Alert: 设置关键词自动提醒
- ClinicalTrials.gov: 关注DESTINY系列试验进展

---

## 📋 PRISMA Flow Diagram（建议配图）

```
                     Records identified through database searching
                                    (n = 443)
                                       ↓
                  ┌──────────────────────────────────────┐
                  │  Records after duplicates removed    │
                  │           (n = 85)                   │
                  └──────────────────────────────────────┘
                                       ↓
                  ┌──────────────────────────────────────┐
                  │  Records screened                    │
                  │  (Title/Abstract)                    │
                  │           (n = 85)                   │
                  └──────────────────────────────────────┘
                                       ↓
                              Records excluded (n = 0)
                  ┌──────────────────────────────────────┐
                  │  Full-text articles assessed         │
                  │  for eligibility                     │
                  │           (n = 85)                   │
                  └──────────────────────────────────────┘
                                       ↓
                     Full-text excluded (n = 73)
                     Reasons:
                     - 无关结局: 15
                     - 样本量小: 8
                     - 设计不符: 12
                     - 数据不全: 18
                     - 重复报道: 20
                  ┌──────────────────────────────────────┐
                  │  Studies included in                 │
                  │  qualitative synthesis               │
                  │           (n = 12)                   │
                  └──────────────────────────────────────┘
                                       ↓
                  ┌──────────────────────────────────────┐
                  │  Studies included in                 │
                  │  quantitative synthesis              │
                  │  (meta-analysis)                     │
                  │           (n = 3 RCTs)               │
                  └──────────────────────────────────────┘
```

---

## 🔍 Search Quality Checklist

完成检索后，确认以下要点：

- [ ] **PICO明确**: 研究问题用PICO框架清晰定义
- [ ] **多数据库**: 至少检索3个主要数据库
- [ ] **检索式记录**: 完整记录每个数据库的检索策略（可重复）
- [ ] **纳排标准**: 明确定义纳入和排除标准
- [ ] **筛选流程**: 记录每一步筛选的数量和原因
- [ ] **偏倚考虑**: 识别并说明可能的偏倚来源
- [ ] **补充检索**: 使用了至少一种补充检索方法（手检/引文/专家）
- [ ] **时效性**: 明确标注检索日期和计划更新时间

---

## 💡 Common Search Terms by Specialty

### Oncology（肿瘤学）

**MeSH Terms**:
- Neoplasms / [specific cancer type]
- Antineoplastic Agents
- Molecular Targeted Therapy

**Keywords**:
- cancer, carcinoma, tumor, malignancy
- chemotherapy, immunotherapy, targeted therapy
- PFS, OS, ORR, DFS, pCR

### Cardiology（心血管）

**MeSH Terms**:
- Cardiovascular Diseases
- Myocardial Infarction
- Heart Failure

**Keywords**:
- MACE, LVEF, NT-proBNP
- anticoagulation, antiplatelet

### Neurology（神经学）

**MeSH Terms**:
- Nervous System Diseases
- Stroke, Alzheimer Disease

**Keywords**:
- neuroprotection, cognitive function
- NIHSS, mRS, MMSE

---

## 🎯 Tips for Efficient Search

**1. 从宽到窄（Funnel Approach）**:
```
Step 1: 宽泛检索（高灵敏度） → 确保不遗漏
Step 2: 精确筛选（高特异度） → 排除无关
```

**2. 善用MeSH Terms**:
```
错误: 仅用关键词 "breast cancer"
正确: "Breast Neoplasms"[Mesh] OR "breast cancer"[tiab]
（MeSH能自动涵盖下位词）
```

**3. 布尔运算符优先级**:
```
错误: A OR B AND C （可能产生歧义）
正确: (A OR B) AND C （明确逻辑关系）
```

**4. 截词符使用**:
```
PubMed: metasta* （匹配 metastasis, metastatic, metastases）
Embase: $ 符号
```

**5. 邻近运算符**:
```
PubMed: "breast cancer"[tiab] （精确短语）
Embase: 'breast cancer':ab,ti （标题或摘要）
```

---

*Template Version: 1.0*
*Last Updated: 2025-12-07*
*Part of: Medical Research Analyst Skill - LiYe OS*
