# Medical Research Analyst - Detailed Methods

**Version**: 1.0
**Last Updated**: 2025-12-07
**Status**: Active

本文档提供 Medical Research Analyst Skill 的详细方法论、实施步骤和故障排除指南，是 `skill_definition.md` 中 Module 04 的扩展版本。

---

## 📋 Table of Contents

1. [Phase 1: Problem Definition](#phase-1-problem-definition)
2. [Phase 2: Literature Search](#phase-2-literature-search)
3. [Phase 3: Critical Appraisal](#phase-3-critical-appraisal)
4. [Phase 4: Synthesis & Analysis](#phase-4-synthesis--analysis)
5. [Phase 5: Structured Output](#phase-5-structured-output)
6. [Advanced Methods](#advanced-methods)
7. [Troubleshooting Guide](#troubleshooting-guide)
8. [Quality Assurance](#quality-assurance)

---

## Phase 1: Problem Definition

### Step 1.1: 使用PICO框架结构化问题

**详细流程**：

#### 1.1.1 识别核心临床情境

**问题类型分类**：
- **Treatment/Intervention**: 治疗方案选择（最常见）
- **Prognosis**: 预后评估
- **Diagnosis**: 诊断策略
- **Etiology/Harm**: 病因或危害因素
- **Prevention**: 预防措施

**示例对话脚本**：
```
Analyst: "请描述患者的基本情况和您面临的主要决策问题。"

User: "55岁女性，HER2+乳腺癌，一线曲妥珠单抗治疗后进展，现在有脑转移，需要选择二线治疗。"

Analyst思考:
→ Type: Treatment问题
→ P: HER2+ mBC, post-trastuzumab, with brain mets
→ I: 需要询问考虑哪些治疗选项
→ C: 需要了解标准对照是什么
→ O: 主要关注什么结局？疗效还是安全性？
```

#### 1.1.2 完整PICO定义（逐项询问法）

**P (Population) - 患者特征提取**：

**必问清单**：
- [ ] **疾病类型**: 具体诊断（如HER2+乳腺癌 vs 泛指乳腺癌）
- [ ] **分期**: 早期 vs 晚期/转移性
- [ ] **生物标志物**: HER2, ER/PR, EGFR, PD-L1等
- [ ] **既往治疗**: 几线治疗？用过什么药？
- [ ] **特殊部位转移**: 脑转移、肝转移、骨转移
- [ ] **患者一般状况**: 年龄、PS评分、并发症

**结构化记录模板**：
```markdown
## Population Definition

**Core Diagnosis**: HER2-positive metastatic breast cancer

**Key Characteristics**:
- Stage: IV (metastatic)
- Biomarkers: HER2 3+ (IHC), ER+/PR+ (HR-positive)
- Prior Treatment: 1L trastuzumab + pertuzumab + taxane (progressed after 12 months)
- Metastatic Sites: Brain (3 lesions, largest 1.5cm), bone, liver
- Patient Factors: 55 years old, ECOG PS 1, no major comorbidities

**Inclusion Criteria** (for literature search):
- HER2+ metastatic breast cancer
- Post-trastuzumab exposure
- Brain metastases present (or subgroup data available)

**Exclusion Criteria**:
- HER2-negative disease
- Early-stage only
- No prior anti-HER2 therapy (de novo)
```

**I (Intervention) - 干预措施明确**：

**详细要素**：
- **Drug Name** (通用名 + 商品名)
- **Dose & Schedule** (剂量和给药方案)
- **Route** (给药途径: IV, PO, SC)
- **Duration** (治疗持续时间: 固定疗程 vs 持续至进展)
- **Combination** (单药 vs 联合治疗)

**示例**：
```markdown
## Intervention

**Primary Intervention**: Trastuzumab deruxtecan (T-DXd, Enhertu®)
- Dose: 5.4 mg/kg
- Route: Intravenous infusion
- Schedule: Every 3 weeks (q3w)
- Duration: Until disease progression or unacceptable toxicity
- Combination: Monotherapy (no concurrent chemotherapy/endocrine therapy)
```

**C (Comparison) - 对照措施定义**：

**对照类型**：
1. **Active comparator**: 另一种活性治疗（如T-DM1）
2. **Standard of care**: 当前标准治疗
3. **Placebo + BSC**: 安慰剂+最佳支持治疗
4. **Historical control**: 历史对照（单臂研究）
5. **No comparison**: 单纯描述性研究

**示例**：
```markdown
## Comparator

**Primary Comparator**: Ado-trastuzumab emtansine (T-DM1, Kadcyla®)
- Rationale: Current standard 2L treatment for HER2+ mBC
- Dose: 3.6 mg/kg IV q3w

**Alternative Comparators** (secondary analysis):
- Tucatinib + capecitabine + trastuzumab
- Lapatinib + capecitabine
- Physician's choice chemotherapy
```

**O (Outcomes) - 结局指标分层**：

**按重要性分级**：

| Priority | Outcome | Type | Rationale |
|----------|---------|------|-----------|
| **CRITICAL** | Progression-Free Survival (PFS) | Time-to-event | 主要疗效终点 |
| **CRITICAL** | Overall Survival (OS) | Time-to-event | 最终获益指标 |
| **CRITICAL** | CNS-PFS | Time-to-event | 患者有脑转移 |
| **IMPORTANT** | Objective Response Rate (ORR) | Binary | 治疗有效性 |
| **IMPORTANT** | Grade≥3 Adverse Events | Safety | 安全性评估 |
| **IMPORTANT** | Quality of Life (QoL) | PRO | 患者视角 |
| **OPTIONAL** | Duration of Response (DOR) | Time-to-event | 缓解持久性 |

**结局定义标准化**：
```markdown
## Outcome Definitions

**Primary Outcomes**:
1. **PFS** (Progression-Free Survival)
   - Definition: Time from randomization to disease progression (RECIST 1.1) or death
   - Assessment: BICR (Blinded Independent Central Review) preferred

2. **OS** (Overall Survival)
   - Definition: Time from randomization to death from any cause
   - Note: May not be mature in all studies

3. **CNS-PFS**
   - Definition: Time to progression in CNS or death
   - Assessment: Brain MRI every 6-9 weeks

**Secondary Outcomes**:
4. **ORR** (Objective Response Rate)
   - Definition: CR + PR per RECIST 1.1
   - Assessment: Best overall response

5. **Safety**
   - Definition: Incidence of Grade≥3 AEs (CTCAE v5.0)
   - Special focus: ILD, hematologic toxicities

6. **QoL**
   - Instrument: EORTC QLQ-C30 / FACT-B
   - Minimally important difference: 10-point change
```

### Step 1.2: 识别关键决策点

**决策树构建**：

```
[Primary Decision] 选择二线治疗方案
       |
       ├─ 决策点1: 疗效优先 vs 安全性优先？
       |    ├─ 疗效优先 → 考虑T-DXd（PFS最优）
       |    └─ 安全性优先 → 考虑T-DM1或口服方案
       |
       ├─ 决策点2: 脑转移是否是主要关注点？
       |    ├─ Yes → T-DXd或Tucatinib（CNS穿透性好）
       |    └─ No → 所有选项均可考虑
       |
       ├─ 决策点3: 患者能否耐受静脉治疗？
       |    ├─ Yes → T-DXd/T-DM1均可
       |    └─ No → 口服方案（Tucatinib+Cap+T）
       |
       └─ 决策点4: 经济可及性？
            ├─ 可负担 → 首选最优疗效方案
            └─ 负担重 → 考虑临床试验或替代方案
```

**决策权重矩阵**：

| 决策因素 | 本案例权重 | 理由 |
|---------|----------|------|
| 疗效（PFS/OS） | 40% | 患者年轻、PS好，追求生存获益 |
| CNS疗效 | 30% | 有脑转移，CNS控制是关键 |
| 安全性 | 20% | 需要平衡，但不是首要考虑 |
| 生活质量 | 5% | 次要考虑 |
| 经济性 | 5% | 患者可负担 |

---

## Phase 2: Literature Search

### Step 2.1: 构建检索策略

#### 2.1.1 确定核心检索词

**按PICO要素分解**：

**P - Population Keywords**:
- MeSH Terms: `"Breast Neoplasms"[Mesh]`, `"Receptor, ErbB-2"[Mesh]`
- Text Words: `breast cancer`, `HER2-positive`, `HER2+`, `ERBB2`
- Modifiers: `metastatic`, `advanced`, `stage IV`

**I - Intervention Keywords**:
- MeSH Terms: `"Immunoconjugates"[Mesh]` (T-DXd是抗体偶联药物)
- Text Words: `trastuzumab deruxtecan`, `T-DXd`, `DS-8201`, `Enhertu`

**C - Comparator Keywords** (可选，head-to-head比较时使用):
- `ado-trastuzumab emtansine`, `T-DM1`, `Kadcyla`

**O - Outcome Keywords** (可选，精确检索时使用):
- `progression-free survival`, `PFS`, `overall survival`, `OS`

**Study Design Keywords** (可选，限定研究类型):
- MeSH: `"Randomized Controlled Trial"[Publication Type]`
- Filters: `Clinical Trial`, `Meta-Analysis`, `Systematic Review`

#### 2.1.2 布尔逻辑组合

**基本原则**：
- **AND**: 连接不同概念（P AND I）
- **OR**: 连接同义词（breast cancer OR breast carcinoma）
- **NOT**: 排除无关内容（谨慎使用，可能遗漏相关研究）

**优先级**: NOT > AND > OR

**括号使用**: 明确逻辑关系

**完整检索式示例（PubMed）**：

```
#1  ("Breast Neoplasms"[Mesh] OR "breast cancer"[tiab] OR "breast carcinoma"[tiab])
#2  ("Receptor, ErbB-2"[Mesh] OR "HER2"[tiab] OR "HER2-positive"[tiab] OR "HER2 positive"[tiab] OR "ERBB2"[tiab])
#3  #1 AND #2                                     // HER2+ breast cancer

#4  ("trastuzumab deruxtecan"[tiab] OR "T-DXd"[tiab] OR "T DXd"[tiab] OR "DS-8201"[tiab] OR "DS 8201"[tiab] OR "Enhertu"[tiab])
#5  #3 AND #4                                     // HER2+ BC + T-DXd

#6  ("Neoplasm Metastasis"[Mesh] OR "metastatic"[tiab] OR "advanced"[tiab] OR "stage IV"[tiab])
#7  #5 AND #6                                     // HER2+ metastatic BC + T-DXd

#8  #7 AND ("2018/01/01"[PDAT] : "2025/12/07"[PDAT])    // 时间限制

#9  #8 AND (English[lang] OR Chinese[lang])      // 语言限制

#10 #9 AND ("Clinical Trial"[ptyp] OR "Randomized Controlled Trial"[ptyp] OR "Meta-Analysis"[ptyp])
                                                  // 研究类型限制

FINAL: #10
```

**检索式优化技巧**：

1. **截词符使用**（PubMed中用*）:
   ```
   "metasta*"[tiab]  → 匹配 metastasis, metastatic, metastases, metastasize
   ```

2. **短语检索**（双引号）:
   ```
   "breast cancer"[tiab]  → 精确短语
   breast cancer[tiab]    → 分开匹配（breast AND cancer）
   ```

3. **字段限制**:
   ```
   [tiab] = Title/Abstract
   [Mesh] = MeSH Terms
   [au] = Author
   [PDAT] = Publication Date
   ```

4. **邻近运算符**（PubMed不直接支持，需用短语）:
   ```
   Embase: 'breast cancer' NEAR/5 'trastuzumab'  (5个词以内)
   ```

#### 2.1.3 数据库特定语法

**Embase Syntax**:
```
#1  'breast cancer'/exp OR 'breast cancer':ab,ti
#2  'erb b2 receptor'/exp OR 'her2':ab,ti
#3  #1 AND #2
#4  'trastuzumab deruxtecan':ab,ti,tn OR 't dxd':ab,ti OR 'ds 8201':ab,ti
#5  #3 AND #4
#6  'metastasis'/exp OR 'metastatic':ab,ti
#7  #5 AND #6
#8  #7 AND [2018-2025]/py
#9  #8 AND ([english]/lim OR [chinese]/lim)

:ab,ti = Abstract/Title
:tn = Trade Name (商品名)
/exp = explode (包含下位词)
/py = publication year
[randomized controlled trial]/lim = limit to RCTs
```

**Cochrane Library Syntax**:
```
#1  MeSH descriptor: [Breast Neoplasms] explode all trees
#2  (breast cancer OR breast carcinoma):ti,ab,kw
#3  #1 OR #2
#4  MeSH descriptor: [Receptor, ErbB-2] explode all trees
#5  (HER2 OR HER2-positive):ti,ab,kw
#6  #4 OR #5
#7  #3 AND #6
#8  (trastuzumab deruxtecan OR T-DXd OR DS-8201):ti,ab,kw
#9  #7 AND #8
#10 #9 with Cochrane Library publication date Between 2018 and 2025

:ti,ab,kw = Title/Abstract/Keywords
MeSH descriptor with "explode all trees" = 包含所有下位MeSH词
```

### Step 2.2: 执行多数据库检索

**检索顺序建议**：
1. PubMed（最comprehensive，免费）
2. Cochrane Library（高质量系统综述）
3. Embase（更全面，包含会议摘要，但需订阅）
4. ClinicalTrials.gov（临床试验注册信息）
5. 会议数据库（ASCO, ESMO, AACR）

**记录要点**：

| Database | Search Date | Strategy | Results | Notes |
|----------|-------------|----------|---------|-------|
| PubMed | 2025-12-07 | 见上#10 | 156 | 包含RCT和Meta-analysis |
| Embase | 2025-12-07 | 见上#9 | 234 | 与PubMed重复约65% |
| Cochrane | 2025-12-07 | 见上#10 | 12 | 系统综述为主 |
| ClinicalTrials.gov | 2025-12-07 | Advanced search | 23 | 包含进行中试验 |

**去重策略**：
1. **自动去重**（EndNote, Zotero等文献管理软件）
2. **手工去重**（检查DOI, PMID, NCT号）
3. **识别重复发表**（同一研究的不同时间点更新 → 保留最新最完整版）

### Step 2.3: 补充检索方法

#### 2.3.1 Citation Tracking (引文追踪)

**Forward Citation (被引用)**：
```
工具: Google Scholar, Web of Science, Scopus

步骤:
1. 识别关键研究（如DESTINY-Breast01, Modi et al. 2020）
2. 点击"Cited by"查看所有引用该研究的文献
3. 筛选相关更新、评论、Meta-analysis

示例: DESTINY-Breast01被引524次
    → 筛选标题包含"T-DXd"或"brain metastasis"的引用
    → 发现3篇新的真实世界研究和1篇Meta-analysis
```

**Backward Citation (参考文献)**：
```
步骤:
1. 阅读已纳入研究的参考文献列表
2. 识别可能遗漏的相关研究
3. 获取全文并评估纳入

示例: DESTINY-Breast03的References包含T-DM1的关键研究
    → 发现EMILIA和TH3RESA试验（T-DM1疗效数据）
    → 补充纳入作为对照数据
```

#### 2.3.2 Hand Search (手工检索)

**目标期刊列表**（Oncology high-impact journals）：
- New England Journal of Medicine (NEJM)
- The Lancet / Lancet Oncology
- Journal of Clinical Oncology (JCO)
- Journal of the National Cancer Institute (JNCI)
- Annals of Oncology

**检索策略**：
```
1. 访问期刊官网
2. 浏览最近2年的Table of Contents
3. 搜索期刊内部数据库（如NEJM.org搜索功能）
4. 识别可能未被PubMed及时索引的最新研究

时间投入: 每个期刊约15-20分钟
收益: 可能发现刚发表、尚未被数据库索引的关键研究
```

#### 2.3.3 Grey Literature (灰色文献)

**来源**：
1. **Clinical Trial Registries**:
   - ClinicalTrials.gov
   - EU Clinical Trials Register
   - ICTRP (WHO)

2. **Conference Abstracts**:
   - ASCO Annual Meeting & ASCO-GU/Breast/etc
   - ESMO Congress
   - AACR Annual Meeting
   - San Antonio Breast Cancer Symposium (SABCS)

3. **Regulatory Documents**:
   - FDA Drug Approval Packages
   - EMA Assessment Reports

**检索示例（ASCO Abstracts）**：
```
网站: https://meetings.asco.org/abstracts-presentations/

检索词: "trastuzumab deruxtecan" OR "T-DXd"
过滤器: Year (2024, 2025), Cancer Type (Breast)

结果: 12 abstracts
  → 6个已正式发表（排除）
  → 4个是亚组分析（纳入）
  → 2个是ongoing trials的interim results（纳入，标注数据未成熟）
```

---

## Phase 3: Critical Appraisal

### Step 3.1: 研究质量评估

#### 3.1.1 RCT质量评估 (RoB 2.0)

**Cochrane Risk of Bias Tool 2.0** (RoB 2.0)

**5个评估域**：

**Domain 1: Randomization Process (随机化过程)**

评估要点：
- [ ] 随机序列生成方法是否合适？（如计算机生成随机数）
- [ ] 分配隐藏是否充分？（如中央随机化、密封信封）
- [ ] 基线特征是否平衡？

判断标准：
```
Low risk:
- 明确描述了随机方法（如"computer-generated random sequence"）
- 分配隐藏充分（如"centralized web-based system"）
- 基线特征平衡（p>0.05 for all key variables）

Some concerns:
- 随机方法未详细描述，但无明显偏倚证据
- 基线部分特征不平衡，但已在分析中调整

High risk:
- 无随机化或伪随机化（如按就诊日期分组）
- 分配隐藏不充分（如开放式随机表）
- 基线严重不平衡且未调整
```

**示例评估（DESTINY-Breast03）**：
```
Randomization Process: Low risk
- Method: "Interactive web response system" (IWRS)
- Allocation concealment: Adequate (centralized)
- Baseline balance: Well balanced (Table 1, all p>0.1)

Judgment: Low risk of bias
```

**Domain 2: Deviations from Intended Interventions (偏离预期干预)**

评估要点：
- [ ] 是否有protocol deviations（方案偏离）？
- [ ] 偏离是否平衡（两组相似）？
- [ ] 分析是否采用ITT原则（intention-to-treat）？

判断标准：
```
Low risk:
- 极少方案偏离（<5%），且两组平衡
- 采用ITT分析（all randomized patients included）
- 无重大交叉污染（crossover）

Some concerns:
- 有方案偏离但已记录并分析
- 采用modified ITT（排除少数未接受任何治疗的患者）

High risk:
- 大量方案偏离（>15%）
- 偏离不平衡（如一组switch rate明显高）
- 仅分析完成治疗的患者（per-protocol only）
```

**示例评估（DESTINY-Breast03）**：
```
Deviations: Low risk
- Treatment discontinuation due to AE: 16% (T-DXd) vs 10% (T-DM1)
- Crossover: Not allowed
- Analysis: ITT (all 524 randomized patients included)

Judgment: Low risk of bias
```

**Domain 3: Missing Outcome Data (结局数据缺失)**

评估要点：
- [ ] 失访率（loss to follow-up）是否低？（通常<20%）
- [ ] 失访是否平衡？
- [ ] 是否进行了敏感性分析（sensitivity analysis）？

判断标准：
```
Low risk:
- 失访率<5%
- 两组失访率相似（difference <2%)
- 关键结局数据完整（如OS: 所有患者均有生存状态记录）

Some concerns:
- 失访率5-20%
- 进行了适当的missing data处理（如multiple imputation）

High risk:
- 失访率>20%
- 失访不平衡（difference >5%）
- 未处理missing data
```

**Domain 4: Measurement of the Outcome (结局测量)**

评估要点：
- [ ] 结局测量方法是否合适？
- [ ] 是否采用盲法评估（尤其是主观结局）？
- [ ] 评估者是否知道分组（assessor blinding）？

判断标准：
```
Low risk:
- 客观结局（OS, lab values）
- 主观结局采用盲法评估（BICR - Blinded Independent Central Review）
- 评估方法标准化（如RECIST 1.1 for PFS）

Some concerns:
- 主观结局但评估者盲法不明确
- 未采用BICR但有investigator assessment

High risk:
- 主观结局无盲法（如QoL评估，患者和医生都知道分组）
- 评估方法不标准
```

**示例评估（DESTINY-Breast03）**：
```
Measurement: Low risk
- PFS: BICR (Blinded Independent Central Review) using RECIST 1.1
- OS: Objective (death from any cause)
- ORR: BICR

Judgment: Low risk of bias
```

**Domain 5: Selection of the Reported Result (报告结果选择)**

评估要点：
- [ ] 是否预先注册了研究方案（trial registration）？
- [ ] 报告的结局是否与方案一致？
- [ ] 是否有选择性报告（selective reporting）的证据？

判断标准：
```
Low risk:
- 在ClinicalTrials.gov等注册
- 所有预先指定的结局均已报告
- 分析计划与方案一致

Some concerns:
- 注册但时间较晚（如首例入组后才注册）
- 部分次要结局未报告但有合理解释

High risk:
- 未注册
- 主要结局与方案不一致
- 明显选择性报告（如只报告阳性亚组）
```

**Overall RoB Judgment**:
```
Low risk: 所有域都是Low risk
Some concerns: 至少一个域是Some concerns，但无High risk
High risk: 至少一个域是High risk
```

**完整评估示例（DESTINY-Breast03）**：

| Domain | Judgment | Support |
|--------|----------|---------|
| D1: Randomization | Low risk | IWRS, centralized, baseline balanced |
| D2: Deviations | Low risk | ITT analysis, minimal crossover |
| D3: Missing data | Low risk | <3% loss to follow-up, balanced |
| D4: Measurement | Low risk | BICR for PFS/ORR, OS objective |
| D5: Selective reporting | Low risk | NCT03529110, all outcomes reported |
| **Overall** | **Low risk** | All domains low risk |

#### 3.1.2 单臂试验质量评估

**评估框架（adapted from MINORS）**：

| Criterion | Score | Evidence in Study |
|-----------|-------|-------------------|
| **1. Clearly stated aim** | 0/1/2 | 研究目的是否清晰明确？ |
| **2. Inclusion of consecutive patients** | 0/1/2 | 是否连续纳入符合条件的患者？ |
| **3. Prospective data collection** | 0/1/2 | 是否前瞻性收集数据？ |
| **4. Endpoints appropriate to study aim** | 0/1/2 | 终点与研究目的是否匹配？ |
| **5. Unbiased assessment of endpoints** | 0/1/2 | 终点评估是否无偏（如BICR）？ |
| **6. Appropriate follow-up duration** | 0/1/2 | 随访时间是否足够长？ |
| **7. Loss to follow-up <5%** | 0/1/2 | 失访率是否低？ |
| **8. Sample size calculation** | 0/1/2 | 是否有样本量计算？ |

**评分**：
- 2分 = 充分满足
- 1分 = 部分满足或不清楚
- 0分 = 不满足或缺失信息

**总分**: 0-16分
- **12-16分**: High quality
- **8-11分**: Moderate quality
- **0-7分**: Low quality

**示例评估（DESTINY-Breast01）**：

| Criterion | Score | Evidence |
|-----------|-------|----------|
| Clearly stated aim | 2 | Primary: ORR; Secondary: PFS, OS, safety |
| Consecutive patients | 2 | Multi-center enrollment, consecutive |
| Prospective collection | 2 | Prospective Phase II trial |
| Appropriate endpoints | 2 | ORR合适单臂试验主要终点 |
| Unbiased assessment | 2 | BICR for tumor response |
| Follow-up duration | 1 | Median 11.1m，OS数据不够成熟 |
| Loss to follow-up | 2 | <2% |
| Sample size calculation | 2 | Yes, based on ORR 40% (H0) vs 60% (H1) |
| **Total** | **15/16** | **High quality** |

### Step 3.2: 证据等级评定

#### 3.2.1 GRADE Evidence Quality

**GRADE分级系统**（Grading of Recommendations Assessment, Development and Evaluation）

**起始等级**（根据研究设计）：

| Study Design | Initial Grade |
|--------------|---------------|
| RCT | ⊕⊕⊕⊕ HIGH |
| Observational studies | ⊕⊕⊝⊝ LOW |
| Uncontrolled case series | ⊕⊝⊝⊝ VERY LOW |

**降级因素**（每个因素可降1-2级）：

1. **Risk of Bias (偏倚风险)**
   - 严重限制（-1）: 1个或多个域存在"Some concerns"
   - 非常严重限制（-2）: 1个或多个域为"High risk"

2. **Inconsistency (不一致性)**
   - 严重不一致（-1）: I²统计量50-75%，效应方向一致但大小差异大
   - 非常严重不一致（-2）: I²>75%或效应方向不一致

3. **Indirectness (间接性)**
   - 严重间接（-1）: PICO与研究问题部分不匹配（如不同人群或替代结局）
   - 非常严重间接（-2）: 重大差异（如动物实验外推至人类）

4. **Imprecision (不精确性)**
   - 严重不精确（-1）: 样本量小，95%CI宽（跨越无效线或包含临床重要差异的两侧）
   - 非常严重不精确（-2）: 样本量极小（N<100），CI极宽

5. **Publication Bias (发表偏倚)**
   - 可能存在（-1）: 漏斗图不对称，或仅有小样本阳性研究

**升级因素**（观察性研究可升级）：

1. **Large Effect (效应量大)**
   - 大效应（+1）: RR>2 或 RR<0.5（且无混杂）
   - 非常大效应（+2）: RR>5 或 RR<0.2

2. **Dose-Response Gradient (剂量反应关系)**
   - 明确剂量反应（+1）

3. **All Plausible Confounding Would Reduce Effect (所有混杂因素都会降低效应)**
   - 观察到的效应可能低估（+1）

**最终等级**：

| Grade | Definition | Implication |
|-------|------------|-------------|
| ⊕⊕⊕⊕ HIGH | 非常确信真实效应接近估计值 | Strong recommendation |
| ⊕⊕⊕⊝ MODERATE | 中等确信，真实效应可能接近 | Conditional recommendation |
| ⊕⊕⊝⊝ LOW | 有限确信，真实效应可能差异较大 | Weak recommendation |
| ⊕⊝⊝⊝ VERY LOW | 几乎不确信，真实效应可能显著不同 | No recommendation |

**示例评估（T-DXd vs T-DM1 for PFS）**：

```
Study: DESTINY-Breast03 RCT

Starting grade: ⊕⊕⊕⊕ HIGH (RCT)

Downgrading considerations:
1. Risk of Bias: No serious limitation (all domains low risk) → 0
2. Inconsistency: N/A (only 1 RCT) → 0
3. Indirectness: No serious indirectness (PICO matches) → 0
4. Imprecision: No serious imprecision (N=524, narrow CI, HR 0.33 [0.26-0.43]) → 0
5. Publication Bias: Unlikely (large RCT, registered, negative result would also be published) → 0

Upgrading considerations:
- Large effect: HR 0.33 (very large effect) → +1 (但RCT已是HIGH，不再升级)

Final Grade: ⊕⊕⊕⊕ HIGH

Interpretation:
非常确信T-DXd相比T-DM1显著延长PFS，真实效应非常接近HR 0.33 (0.26-0.43)
```

**示例评估2（T-DXd单臂试验 ORR）**：

```
Study: DESTINY-Breast01 (Single-arm Phase II)

Starting grade: ⊕⊕⊝⊝ LOW (non-comparative observational)
(注：单臂试验视为observational evidence for absolute effect estimation)

Downgrading:
1. Risk of Bias: No serious (high-quality design, BICR) → 0
2. Inconsistency: Consistent with DESTINY-Breast02/03 → 0
3. Indirectness: Directly applicable to target population → 0
4. Imprecision: Moderate precision (N=184, 95%CI 53-68% for ORR 60.9%) → 0
5. Publication Bias: Unlikely → 0

Upgrading:
- Large effect: ORR 60.9% (historical control ~20-30%, RR>2) → +1

Final Grade: ⊕⊕⊕⊝ MODERATE

Interpretation:
中等确信T-DXd的ORR约60%，真实效应可能在50-70%范围
```

#### 3.2.2 Oxford CEBM Levels of Evidence

**Oxford Centre for Evidence-Based Medicine (CEBM) Levels**

**治疗效果（Treatment Benefits）**：

| Level | Type of Evidence | Example |
|-------|------------------|---------|
| **Level 1** | Systematic review of RCTs | Cochrane review of T-DXd RCTs |
| **Level 2** | Individual RCT | DESTINY-Breast03 |
| **Level 3** | Non-randomized controlled cohort/follow-up study | Prospective cohort of T-DXd vs historical T-DM1 |
| **Level 4** | Case-series, case-control, or historically controlled studies | Retrospective case series of T-DXd |
| **Level 5** | Mechanism-based reasoning | Preclinical data on T-DXd mechanism |

**诊断准确性（Diagnostic Accuracy）**：

| Level | Type of Evidence |
|-------|------------------|
| **Level 1** | Systematic review of cross-sectional studies; CDR* with 1b studies |
| **Level 2** | Individual cross-sectional studies with consistently applied reference standard and blinding |
| **Level 3** | Non-consecutive studies, or studies without consistently applied reference standards |
| **Level 4** | Case-control studies, or poor or non-independent reference standard |
| **Level 5** | Mechanism-based reasoning |

*CDR = Clinical Decision Rule

**预后（Prognosis）**：

| Level | Type of Evidence |
|-------|------------------|
| **Level 1** | Systematic review of inception cohort studies; CDR validated in different populations |
| **Level 2** | Individual inception cohort study |
| **Level 3** | Cohort study or control arm of RCT |
| **Level 4** | Case-series or case-control studies, or poor quality prognostic cohort study |
| **Level 5** | Mechanism-based reasoning |

**使用场景**：
- Oxford CEBM更简单直观，适合快速分级
- GRADE更系统全面，适合指南制定和Meta-analysis

**建议**：
```
初步评估 → 使用Oxford Levels快速分类
深度分析/指南制定 → 使用GRADE详细评估
报告中 → 同时呈现两种分级，便于不同读者理解
```

---

## Phase 4: Synthesis & Analysis

### Step 4.1: 定性综合（Narrative Synthesis）

**适用场景**：
- 研究异质性太大，无法Meta-analysis
- 研究设计多样（RCT + 单臂 + 观察性）
- 结局指标不一致

**方法框架**：

#### 4.1.1 按研究设计分层综合

```markdown
## Evidence Synthesis

### High-Quality RCTs (Level 1)

**DESTINY-Breast03** (Cortés 2022, N=524):
- Design: Phase III, open-label RCT
- Population: HER2+ mBC, 2L, post-T ± pertuzumab
- Comparison: T-DXd 5.4mg/kg q3w vs T-DM1 3.6mg/kg q3w
- Results:
  * PFS: 28.8m vs 6.8m (HR 0.33, 95%CI 0.26-0.43, p<0.001)
  * OS: NR vs 34.2m (HR 0.64, 95%CI 0.47-0.87, p=0.0037)
  * ORR: 79.7% vs 34.2%
  * CNS-PFS (subgroup): HR 0.25 (95%CI 0.13-0.50)
- Safety: Grade≥3 AE 45% vs 39%; ILD 13.6% (Grade≥3: 2.7%)
- Quality: Low risk of bias (RoB 2.0)
- GRADE: ⊕⊕⊕⊕ HIGH

**Interpretation**:
高质量证据表明，T-DXd在HER2+乳腺癌二线治疗中显著优于T-DM1，PFS和OS均有显著获益，安全性可接受。CNS疗效尤其突出（HR 0.25）。

### Single-Arm Trials (Level 2)

**DESTINY-Breast01** (Modi 2020, N=184):
- Design: Phase II, single-arm
- Population: HER2+ mBC, heavily pretreated (median 6 prior therapies)
- Intervention: T-DXd 5.4mg/kg q3w
- Results:
  * ORR: 60.9% (95%CI 53.4-68.0)
  * mPFS: 16.4m (95%CI 12.7-NE)
  * mDOR: 14.8m
  * 12-month OS: 86.2%
- Safety: Grade≥3 AE 57.1%; ILD 13.6% (Grade≥3/4/5: 2.7%)
- Quality: 15/16 (MINORS score), high quality
- GRADE: ⊕⊕⊕⊝ MODERATE (single-arm, no direct comparator)

**Interpretation**:
在高度预治疗人群中，T-DXd显示出临床有意义的ORR（60.9%）和持久缓解（mDOR 14.8m），提示在晚线治疗中仍有活性。ILD需关注但发生率可控。

**DESTINY-Breast02** (André 2022, N=608):
- Similar design, confirms DESTINY-Breast01 findings
- ORR: 61.4%, mPFS: 17.8m
- Consistency强化了T-DXd疗效的可信度

### Real-World Evidence (Level 3-4)

**综合3项回顾性队列研究** (Total N~500):
- 真实世界ORR: 55-65%（与RCT一致）
- mPFS: 12-18m（略低于RCT，可能因更差的baseline特征）
- ILD发生率: 10-15%（与临床试验一致）
- 结论: Real-world outcomes与RCT一致，外部效度好
```

#### 4.1.2 按结局指标分层综合

```markdown
## Outcome-Specific Synthesis

### Efficacy Outcomes

**Primary Efficacy: Progression-Free Survival**

| Study | Design | Comparator | mPFS (T-DXd) | mPFS (Comparator) | HR (95%CI) | GRADE |
|-------|--------|------------|--------------|-------------------|------------|-------|
| DESTINY-Breast03 | RCT | T-DM1 | 28.8m | 6.8m | 0.33 (0.26-0.43) | ⊕⊕⊕⊕ |
| DESTINY-Breast01 | Single-arm | Historical | 16.4m | ~4-6m* | - | ⊕⊕⊕⊝ |
| DESTINY-Breast02 | Single-arm | Historical | 17.8m | ~4-6m* | - | ⊕⊕⊕⊝ |
| Real-world studies | Observational | Historical/T-DM1 | 12-18m | 5-7m | 0.35-0.50** | ⊕⊕⊝⊝ |

*Historical control from prior trials in similar population
**Adjusted HR from propensity score matching

**Synthesis**:
- 一致性强：所有研究均显示T-DXd显著延长PFS
- 效应量大：HR约0.33-0.35（RCT证据）
- RCT vs 真实世界: 真实世界PFS略短（12-18m vs 28.8m），可能因患者选择偏倚，但HR相似（0.35-0.50）
- 结论: ⊕⊕⊕⊕ HIGH certainty that T-DXd improves PFS vs T-DM1

**Overall Survival**

| Study | Design | mOS (T-DXd) | mOS (Comparator) | HR (95%CI) | Maturity | GRADE |
|-------|--------|-------------|------------------|------------|----------|-------|
| DESTINY-Breast03 | RCT | NR | 34.2m | 0.64 (0.47-0.87) | 44% events | ⊕⊕⊕⊕ |
| DESTINY-Breast01 | Single-arm | 29.1m | - | - | Mature | ⊕⊕⊕⊝ |

**Synthesis**:
- DESTINY-Breast03: OS显著改善（HR 0.64, p=0.0037），尽管数据尚未完全成熟
- 绝对获益: +9.9个月（临床有意义，>3个月）
- 结论: ⊕⊕⊕⊕ HIGH certainty that T-DXd improves OS vs T-DM1

**CNS-Specific Efficacy**

| Study | Population | CNS-PFS HR | CNS ORR | GRADE |
|-------|------------|-----------|---------|-------|
| DESTINY-Breast03 (subgroup) | Baseline brain mets (N=~100) | 0.25 (0.13-0.50) | 45.5% vs 21.1% | ⊕⊕⊕⊝* |
| DESTINY-Breast01 (subgroup) | Baseline brain mets (N=24) | - | 58.3% | ⊕⊕⊝⊝** |

*Downgraded for indirectness (subgroup analysis)
**Downgraded for small sample size and indirectness

**Synthesis**:
- T-DXd显示强大的CNS活性（CNS-PFS HR 0.25）
- CNS ORR 45-58%，高于全身ORR（脑转移通常难治）
- 结论: ⊕⊕⊕⊝ MODERATE certainty that T-DXd has superior CNS efficacy

### Safety Outcomes

**Grade≥3 Adverse Events**

| Study | T-DXd | Comparator | Difference | Common Grade≥3 AEs |
|-------|-------|------------|------------|-------------------|
| DESTINY-Breast03 | 45% | 39% (T-DM1) | +6% | 中性粒细胞减少(13% vs 8%), 恶心(8% vs 2%) |
| DESTINY-Breast01 | 57% | - | - | 中性粒细胞减少(21%), 贫血(9%), 恶心(8%) |

**Synthesis**:
- Grade≥3 AE率: 45-57%（中等，略高于T-DM1但可接受）
- 主要为血液学毒性（可逆，可管理）
- NNH (Number Needed to Harm): 16.7 (Grade≥3 AE increase)

**Interstitial Lung Disease (ILD) - Key Safety Concern**

| Study | ILD (Any Grade) | ILD (Grade≥3) | ILD (Grade 5) | Management |
|-------|----------------|---------------|---------------|------------|
| DESTINY-Breast03 | 13.6% | 2.7% | 0.4% | 大多数Grade 1-2, 可通过dose delay/reduction管理 |
| DESTINY-Breast01 | 13.6% | 2.7% | 2.2% | 早期识别和及时干预是关键 |
| Pooled analysis | ~12-15% | ~2-3% | ~0.5-2% | - |

**Synthesis**:
- ILD是T-DXd的特征性AE，发生率约13-15%
- 大多数为轻度（Grade 1-2），可通过停药或减量管理
- Grade≥3: ~2-3%（可接受）
- 致命ILD (Grade 5): 罕见(0.4-2.2%)，需密切监测和早期识别
- 缓解措施: 基线肺CT，治疗中定期问询呼吸道症状，有症状立即CT评估

**Treatment Discontinuation Due to AEs**

| Study | T-DXd | Comparator | Most Common Causes |
|-------|-------|------------|-------------------|
| DESTINY-Breast03 | 15.2% | 6.9% (T-DM1) | ILD (4%), decreased LVEF (1%), pneumonitis (1%) |

**Synthesis**:
- T-DXd的治疗中断率约15%，高于T-DM1 (7%)
- 主要原因: ILD（4%）
- NNH: 需治疗12位患者，会有1人因AE停药
- 大多数患者能完成治疗，discontinuation rate可接受
```

### Step 4.2: 定量综合（Meta-Analysis）

**适用场景**：
- ≥2个研究比较相同干预
- 结局定义一致
- 研究设计可比

**方法**：

#### 4.2.1 效应量提取与转换

**二分类结局（如ORR）**：

提取数据：
- 事件数 (Events)
- 总样本量 (Total)

计算效应量：
- Risk Ratio (RR) = [Events_Intervention / Total_Intervention] / [Events_Control / Total_Control]
- Odds Ratio (OR) = [Events_I / (Total_I - Events_I)] / [Events_C / (Total_C - Events_C)]

示例（DESTINY-Breast03）：
```
T-DXd arm: ORR = 208/261 = 79.7%
T-DM1 arm: ORR = 90/263 = 34.2%

RR = 0.797 / 0.342 = 2.33 (95%CI: 1.95-2.79)
OR = (208/53) / (90/173) = 3.93 / 0.52 = 7.56
```

**时间-事件结局（如PFS, OS）**：

提取数据：
- Hazard Ratio (HR)
- 95% Confidence Interval
- (如果未报告HR，从Kaplan-Meier曲线估算或使用median PFS)

HR解释：
- HR < 1: Intervention降低风险（有利）
- HR = 1: 无差异
- HR > 1: Intervention增加风险（不利）

示例：
```
DESTINY-Breast03: PFS HR = 0.33 (95%CI: 0.26-0.43)
解释: T-DXd使进展或死亡风险降低67% (1-0.33=0.67)
```

#### 4.2.2 异质性评估

**I² Statistic (I²统计量)**：

定义: 总变异中由异质性（而非抽样误差）解释的比例

公式: I² = [(Q - df) / Q] × 100%
- Q = Cochran's Q statistic (异质性检验统计量)
- df = degrees of freedom (研究数-1)

解释：
- I² = 0-40%: 可能不重要（might not be important）
- I² = 30-60%: 可能代表中等异质性（may represent moderate heterogeneity）
- I² = 50-90%: 可能代表substantial异质性
- I² = 75-100%: 相当大的异质性（considerable heterogeneity）

**τ² (Tau-squared)**：
- 研究间方差的估计值
- 用于随机效应模型

**Cochran's Q Test**：
- H0: 所有研究的真实效应相同（无异质性）
- p < 0.10: 拒绝H0，存在显著异质性

**处理异质性的策略**：

1. **低异质性 (I² < 50%)**:
   - 使用固定效应模型（Fixed-effect model）
   - 假设所有研究估计同一真实效应

2. **中-高异质性 (I² ≥ 50%)**:
   - 使用随机效应模型（Random-effects model）
   - 探索异质性来源（亚组分析、Meta-回归）
   - 如果I² > 75%且无法解释，考虑不进行Meta-analysis

3. **探索异质性来源**:
   - **亚组分析**: 按患者特征（如脑转移 vs 无脑转移）、治疗线数、地区分层
   - **Meta-回归**: 研究连续变量（如平均年龄、随访时间）与效应量的关系
   - **敏感性分析**: 排除某些研究后重新分析

示例：
```
假设我们有3个RCT比较T-DXd vs Control的PFS:

Study 1: HR 0.33 (0.26-0.43), Weight 45%
Study 2: HR 0.45 (0.30-0.68), Weight 30%
Study 3: HR 0.28 (0.18-0.44), Weight 25%

Meta-analysis:
Pooled HR = 0.35 (0.28-0.43)
I² = 35% (low-moderate heterogeneity)
Q test p = 0.18 (not significant)

Interpretation:
- 总体效应: HR 0.35，T-DXd显著降低进展风险65%
- 异质性: 低至中等（I²=35%），研究结果相对一致
- 结论: 可信赖Meta-analysis结果
```

#### 4.2.3 发表偏倚评估

**Funnel Plot (漏斗图)**：

原理:
- X轴: Effect size (如HR, OR)
- Y轴: Precision (如Standard Error, 1/SE, sample size)
- 无偏倚时: 小样本研究散布于大样本研究两侧，形成对称漏斗
- 有偏倚时: 漏斗不对称（如缺失小样本阴性研究）

**Egger's Test (Egger检验)**：

统计学检验漏斗图不对称性
- H0: 无发表偏倚（漏斗图对称）
- p < 0.05: 拒绝H0，可能存在发表偏倚

**Trim-and-Fill Method**：

假设缺失研究，填补后重新计算pooled effect
- 如果填补后效应显著改变 → 发表偏倚影响大
- 如果填补后效应相似 → 发表偏倚影响小

**注意事项**：
- 至少需要10个研究才能可靠评估发表偏倚
- 不对称也可能由其他原因（真实异质性、研究质量差异）导致
- 如果仅有大型RCT，发表偏倚通常不是主要问题

---

## Phase 5: Structured Output

### Step 5.1: Executive Summary撰写

**1-Minute Read原则**：
- 目标: 读者用1分钟了解核心结论和推荐
- 长度: 150-200词，最多3段
- 内容: 问题+证据+推荐

**结构模板**：

```markdown
# Executive Summary

**Clinical Question**: [1句话描述PICO]

**Bottom Line**: [Strong/Conditional] recommendation for [Intervention] based on [证据质量] evidence.

**Key Evidence**: [最关键的RCT或Meta-analysis结果]
- Efficacy: [主要终点效应量]
- Safety: [主要安全性问题]
- Evidence Quality: [GRADE等级]

**Recommendation**:
- **First-line**: [推荐方案]
- **Alternatives**: [备选方案及适用场景]
- **Monitoring**: [关键监测项]

**Confidence**: [High/Moderate/Low] - [简述理由]
```

**示例**：

```markdown
# Executive Summary

**Clinical Question**: 对于HER2阳性转移性乳腺癌二线治疗，T-DXd相比T-DM1是否更优？

**Bottom Line**: **Strong recommendation** for T-DXd 5.4mg/kg IV q3w based on **high-quality evidence** from a large Phase III RCT.

**Key Evidence** (DESTINY-Breast03, N=524):
- **Efficacy**: T-DXd显著优于T-DM1
  - PFS: 28.8m vs 6.8m (HR 0.33, 95%CI 0.26-0.43, p<0.001) - 绝对获益+22.0个月
  - OS: NR vs 34.2m (HR 0.64, p=0.0037) - 绝对获益+9.9个月
  - ORR: 79.7% vs 34.2% (RR 2.33)
  - **CNS-PFS**: HR 0.25（脑转移患者尤其获益）

- **Safety**: 可接受
  - Grade≥3 AE: 45% vs 39% (NNH=16.7)
  - ILD: 13.6% (大多数Grade 1-2，可管理；Grade≥3: 2.7%)
  - 治疗中断率: 15% vs 7% (主要因ILD)

- **Evidence Quality**: ⊕⊕⊕⊕ HIGH (large RCT, low risk of bias)

**Recommendation**:
- **First-line choice**: T-DXd 5.4mg/kg IV q3w，特别适合:
  - 有脑转移的患者（CNS疗效卓越）
  - 年轻、体能状态好、追求最大疗效的患者
  - 无ILD高危因素的患者

- **Alternatives**:
  - Tucatinib+Cap+T: 适用于ILD高风险或偏好口服治疗的患者
  - T-DM1: 适用于老年多并发症、优先安全性的患者

- **Key Monitoring**:
  - 基线肺CT（排除既往ILD）
  - 治疗中每次就诊询问呼吸道症状
  - 有症状立即胸部CT评估

**Confidence**: **High** - 基于大型RCT，效应量大（HR 0.33），结果一致性强，已纳入NCCN/ESMO一类推荐。安全性可控，获益远超风险。
```

### Step 5.2: 详细报告撰写

**完整报告结构（IMRaD + GRADE）**：

```markdown
# [Report Title]
## Subtitle: Evidence-Based Analysis

**Date**: YYYY-MM-DD
**Analyst**: Medical Research Analyst Skill
**Evidence Level**: ⊕⊕⊕⊕ HIGH

---

## Table of Contents
1. Executive Summary
2. Background & Clinical Question
3. Methods
4. Results
   - 4.1 Literature Search
   - 4.2 Study Characteristics
   - 4.3 Efficacy Outcomes
   - 4.4 Safety Outcomes
   - 4.5 Quality of Evidence
5. Discussion
6. Recommendations
7. Implementation Guidance
8. Appendices

---

## 1. Executive Summary
[见上节]

---

## 2. Background & Clinical Question

### 2.1 Clinical Context
[简述疾病背景、当前治疗现状、未满足的临床需求]

### 2.2 PICO Framework
[详细PICO定义，见Phase 1]

### 2.3 Key Decision Points
[决策树，见Phase 1]

---

## 3. Methods

### 3.1 Literature Search Strategy
**Databases**: PubMed, Embase, Cochrane Library, ClinicalTrials.gov
**Search Date**: 2025-12-07
**Search Terms**: [完整检索式，见Phase 2]

### 3.2 Inclusion/Exclusion Criteria
[详细纳排标准]

### 3.3 Study Selection
**PRISMA Flow**:
- Records identified: 443
- After deduplication: 85
- Full-text assessed: 85
- Studies included: 12 (3 RCTs, 6 single-arm, 3 observational)

### 3.4 Quality Assessment
- RCTs: Cochrane RoB 2.0
- Single-arm trials: MINORS
- Evidence grading: GRADE + Oxford CEBM

### 3.5 Data Extraction
- Efficacy: PFS, OS, ORR, CNS-PFS
- Safety: Grade≥3 AE, ILD, treatment discontinuation
- Subgroup: Brain metastases, HR status, age

---

## 4. Results

### 4.1 Literature Search Results
[Evidence Summary Table - 使用template]

### 4.2 Study Characteristics
[Baseline characteristics table]

### 4.3 Efficacy Outcomes

#### 4.3.1 Progression-Free Survival
[Forest plot if meta-analysis, or comparison table]

**DESTINY-Breast03**:
- mPFS: 28.8m (T-DXd) vs 6.8m (T-DM1)
- HR 0.33 (95%CI 0.26-0.43, p<0.001)
- 12m PFS rate: 75.8% vs 34.1%
- 24m PFS rate: 60.9% vs 14.4%

**Subgroup Analysis**:
[Forest plot of subgroups: brain mets, HR status, age, etc.]

**GRADE Assessment**: ⊕⊕⊕⊕ HIGH
- No serious limitations across all domains
- Large effect (HR 0.33)
- Consistent with single-arm trials

#### 4.3.2 Overall Survival
[Similar structure]

#### 4.3.3 Objective Response Rate
[Similar structure]

#### 4.3.4 CNS-Specific Outcomes
[Detailed CNS-PFS and CNS-ORR analysis]

### 4.4 Safety Outcomes

#### 4.4.1 Overall Adverse Events
[AE comparison table]

#### 4.4.2 Interstitial Lung Disease (ILD)
[Detailed ILD analysis: incidence, grading, management, risk factors]

#### 4.4.3 Treatment Discontinuation
[Reasons and rates]

### 4.5 Quality of Evidence

**GRADE Summary of Findings Table**:

| Outcome | Relative effect (95%CI) | Anticipated absolute effects | № of participants (studies) | Certainty | Comments |
|---------|------------------------|------------------------------|----------------------------|-----------|----------|
| PFS | HR 0.33 (0.26-0.43) | 28.8m vs 6.8m | 524 (1 RCT) | ⊕⊕⊕⊕ HIGH | Large effect, low RoB |
| OS | HR 0.64 (0.47-0.87) | NR vs 34.2m | 524 (1 RCT) | ⊕⊕⊕⊕ HIGH | Significant improvement |
| ORR | RR 2.33 (1.95-2.79) | 79.7% vs 34.2% | 524 (1 RCT) | ⊕⊕⊕⊕ HIGH | Clinically meaningful |
| CNS-PFS | HR 0.25 (0.13-0.50) | - | ~100 (subgroup) | ⊕⊕⊕⊝ MODERATE | Indirect (subgroup) |
| Grade≥3 AE | RR 1.15 (0.92-1.43) | 45% vs 39% | 524 (1 RCT) | ⊕⊕⊕⊕ HIGH | Acceptable |

---

## 5. Discussion

### 5.1 Summary of Key Findings
[Narrative synthesis]

### 5.2 Benefit-Risk Assessment
[NNT/NNH analysis, benefit-risk ratio]

### 5.3 Comparison with Guidelines
[NCCN, ESMO, ASCO recommendations]

### 5.4 Applicability to Target Population
[External validity, patient-specific considerations]

### 5.5 Limitations
- 证据局限（如OS数据未成熟）
- 研究局限（如缺少某些亚组数据）
- 分析局限（如未进行network meta-analysis）

### 5.6 Future Research Needs
[Knowledge gaps, ongoing trials]

---

## 6. Recommendations

### 6.1 Primary Recommendation
[详细推荐，见Decision Framework Template]

### 6.2 Alternative Recommendations
[场景特定推荐]

### 6.3 Patient-Specific Considerations
[个体化决策指导]

---

## 7. Implementation Guidance

### 7.1 Pre-Treatment Checklist
[详细checklist]

### 7.2 Monitoring Plan
[详细监测方案表格]

### 7.3 Dose Modification
[剂量调整方案]

### 7.4 Toxicity Management
[ILD及其他AE的管理算法]

---

## 8. Appendices

### Appendix A: Full Search Strategies
[所有数据库的完整检索式]

### Appendix B: Excluded Studies
[排除研究列表及原因]

### Appendix C: Risk of Bias Assessments
[所有纳入RCT的详细RoB评估]

### Appendix D: GRADE Evidence Profiles
[详细GRADE表格]

### Appendix E: Forest Plots
[Meta-analysis森林图 - 如适用]

### Appendix F: References
[完整参考文献列表]

---

**Document Information**:
- Version: 1.0
- Created: 2025-12-07
- Next Review: 2026-06-07 (或重大新证据发表时)
- Authors: Medical Research Analyst Skill, LiYe OS
- Evidence Quality: ⊕⊕⊕⊕ HIGH
- Recommendation Strength: Strong
```

---

## Advanced Methods

### Method 6.1: Network Meta-Analysis

**适用场景**: 多个干预措施，但缺少直接头对头比较

**原理**: 通过共同对照（如安慰剂或标准治疗）间接比较不同干预

**示例网络**:
```
       T-DXd
         |
         ↓
    [Standard Care] ← T-DM1
         ↑
         |
    Tucatinib+Cap+T
```

**分析步骤**:
1. 构建证据网络
2. 评估一致性（Consistency）: 直接证据 vs 间接证据是否一致
3. 进行Network Meta-analysis
4. 计算相对效应（所有干预两两比较）
5. 排序（SUCRA - Surface Under the Cumulative Ranking curve）

**软件**: R (netmeta package), Stata (network), WinBUGS

### Method 6.2: Bayesian Meta-Analysis

**优势**:
- 可纳入先验信息
- 更适合小样本研究
- 可计算后验概率（如"T-DXd优于T-DM1的概率是95%"）

**工具**: WinBUGS, JAGS, Stan (via R)

### Method 6.3: Individual Patient Data (IPD) Meta-Analysis

**优势**:
- 可进行更精确的亚组分析
- 可使用time-to-event数据进行更准确的分析
- 可调整患者水平的混杂因素

**挑战**:
- 需要获得原始患者数据（通常需要与研究作者/药厂联系）
- 数据整合复杂

---

## Troubleshooting Guide

### 问题1: 检索结果过多（>1000篇）

**原因**: 检索式太宽泛

**解决方案**:
1. 增加PICO的特异性（如限定population为"metastatic" AND "HER2-positive"）
2. 添加study design过滤器（如仅RCT）
3. 缩短时间范围（如最近5年）
4. 添加outcome关键词

**示例**:
```
过于宽泛: "breast cancer" AND "treatment"  → 50,000+ results
优化后: ("HER2-positive"[tiab] AND "metastatic breast cancer"[tiab]) AND ("trastuzumab deruxtecan"[tiab]) AND ("Clinical Trial"[ptyp])  → 156 results
```

### 问题2: 检索结果过少（<5篇）

**原因**: 检索式太窄，可能遗漏相关研究

**解决方案**:
1. 扩展同义词（如T-DXd还有DS-8201, Enhertu等别名）
2. 去掉部分限制（如不限定study design）
3. 扩大时间范围
4. 使用截词符（如metasta* 匹配 metastatic, metastasis, metastases）
5. 检查拼写和MeSH term是否正确

**检查清单**:
- [ ] 是否穷尽了干预措施的所有名称？（通用名、商品名、代号）
- [ ] 是否使用了MeSH Terms？
- [ ] 是否限制过多（如仅英文+仅RCT+仅最近1年）？

### 问题3: 无法找到关键研究的全文

**解决方案**:
1. **机构图书馆**: 通过大学或医院图书馆获取
2. **Open Access版本**: 检查PubMed Central, Europe PMC
3. **预印本**: 检查medRxiv, bioRxiv
4. **作者联系**: 发邮件请求PDF（通常作者愿意分享）
5. **ResearchGate / Academia.edu**: 研究者可能上传了全文
6. **付费下载**: 如确实需要且无其他途径

**邮件模板** (联系作者):
```
Subject: Request for full-text of your article on [topic]

Dear Dr. [Author Name],

I am conducting a systematic review on [topic] and came across your article
"[Full Title]" published in [Journal, Year]. Unfortunately, I do not have
institutional access to this journal.

Would you be willing to share a PDF of this article for research purposes?

Thank you for considering my request.

Best regards,
[Your Name]
```

### 问题4: 研究异质性太大，无法Meta-analysis

**判断标准**: I² > 75% 且无法解释来源

**解决方案**:
1. **不进行Meta-analysis**: 改用narrative synthesis
2. **亚组分析**: 按患者特征、治疗线数、地区分层后分别Meta-analysis
3. **Meta-回归**: 探索连续变量（如年龄、随访时间）对效应的影响
4. **仅Meta-分析高质量/可比研究**: 排除明显outliers

**报告方式**:
```markdown
由于纳入研究在[患者群体/干预剂量/结局定义]方面存在显著异质性（I²=85%, p<0.01），
我们未进行Meta-analysis，而是采用narrative synthesis分层总结证据。

各研究独立分析结果均显示T-DXd优于对照（HR范围: 0.28-0.50），
尽管效应量大小有差异，但方向一致。
```

### 问题5: 证据质量不足（仅有低质量观察性研究）

**判断**: GRADE评级为⊕⊕⊝⊝ LOW 或 ⊕⊝⊝⊝ VERY LOW

**解决方案**:
1. **明确标注证据限制**:
   ```markdown
   **Evidence Quality**: ⊕⊕⊝⊝ LOW

   **Limitations**:
   - 无RCT证据，仅有回顾性队列研究
   - 选择偏倚风险高（sick patients more likely to receive intervention）
   - 混杂因素未充分控制

   **Implication**:
   - 建议谨慎解读，真实效应可能与观察到的显著不同
   - 建议开展前瞻性RCT以提供高质量证据
   ```

2. **降低推荐强度**:
   - 从"Strong Recommendation"降为"Conditional Recommendation"
   - 或"No recommendation due to insufficient evidence"

3. **建议替代方案**:
   - 如有其他证据质量更好的治疗选择，优先推荐

### 问题6: 发现研究结果矛盾（有的阳性，有的阴性）

**示例**: 某个Meta-analysis显示T-DXd有效，但另一个RCT显示无效

**分析步骤**:
1. **检查PICO是否一致**:
   - 患者群体是否相同？（如一线 vs 二线）
   - 干预剂量是否一致？
   - 结局定义是否相同？（如PFS定义，RECIST 1.1 vs WHO criteria）

2. **评估研究质量**:
   - 阴性结果的研究是否样本量不足（statistical power低）？
   - 是否有高risk of bias？

3. **查看置信区间**:
   - 阳性研究: HR 0.33 (0.26-0.43) → CI不跨1，显著
   - 阴性研究: HR 0.85 (0.50-1.45) → CI跨1，不显著但点估计仍提示获益

4. **综合判断**:
   ```markdown
   研究结果存在不一致性：
   - DESTINY-Breast03 (N=524, RCT): HR 0.33, 显著
   - Study X (N=120, RCT): HR 0.85, 不显著

   可能原因分析:
   - Study X样本量小（statistical power不足以检出差异）
   - Study X患者群体更差（更多既往治疗线数，基线PS评分更低）

   综合判断:
   - 以大样本、高质量RCT (DESTINY-Breast03) 结果为主
   - Study X的阴性结果可能因power不足和患者选择偏倚
   - 总体证据支持T-DXd有效，但特定人群（如极heavily pretreated）获益可能有限
   ```

---

## Quality Assurance

### QA Checklist（质量保证检查清单）

**Phase 1: Problem Definition**
- [ ] PICO是否清晰明确，每个元素都已定义？
- [ ] 关键决策点是否识别？
- [ ] 与临床专家或用户确认了研究问题？

**Phase 2: Literature Search**
- [ ] 至少检索了3个主要数据库？
- [ ] 检索式是否记录完整（可重复）？
- [ ] 是否使用了补充检索方法（citation tracking, hand search）？
- [ ] 检索日期是否明确标注？

**Phase 3: Critical Appraisal**
- [ ] 所有纳入RCT都完成了RoB 2.0评估？
- [ ] 证据等级评定使用了GRADE或Oxford CEBM？
- [ ] 评估过程是否有记录（如RoB表格）？

**Phase 4: Synthesis**
- [ ] 证据综合是否系统化（按研究设计或结局分层）？
- [ ] 如进行Meta-analysis，是否评估了异质性和发表偏倚？
- [ ] 是否进行了敏感性分析或亚组分析？

**Phase 5: Output**
- [ ] Executive Summary是否简洁清晰（≤200词）？
- [ ] 推荐是否明确，强度和证据质量是否标注？
- [ ] 是否提供了implementation guidance？
- [ ] 所有数据是否有references支持？

**General**
- [ ] 是否无利益冲突（conflict of interest）？
- [ ] 报告是否客观，避免过度解读？
- [ ] 是否明确标注了证据限制和不确定性？
- [ ] 是否计划定期更新（如6-12个月）？

### Peer Review（同行评审）

**建议**: 如条件允许，请另一位医学研究分析师或临床医生审阅报告

**评审要点**:
1. **科学性**: 方法是否rigorous？结论是否有证据支持？
2. **完整性**: 是否遗漏了重要研究或关键信息？
3. **客观性**: 是否存在偏倚或过度解读？
4. **实用性**: 推荐是否可操作？是否考虑了临床实际？

---

**Document Information**:
- **Version**: 1.0
- **Created**: 2025-12-07
- **Last Updated**: 2025-12-07
- **Maintained by**: Medical Research Analyst Skill, LiYe OS
- **Review Cycle**: 每6个月或有新重大证据时更新

---

*This methods document is a living resource and will be continuously improved based on practical experience and user feedback.*
