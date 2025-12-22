# Evidence Summary Table Template

**用途**: 系统化汇总和比较多项研究的关键信息
**适用场景**: 治疗方案比较、药物评估、Meta-analysis准备

---

## 📊 Evidence Summary Table

| Study | Design | Population | N | Intervention | Comparator | Primary Outcome | Effect Size | Evidence Level | Notes |
|-------|--------|------------|---|--------------|------------|-----------------|-------------|----------------|-------|
| [研究名称/NCT号] | [RCT/观察性/Meta] | [患者特征] | [样本量] | [干预措施] | [对照组] | [主要终点] | [HR/OR/RR + 95%CI] | [Level 1-5] | [关键信息] |
| | | | | | | | | | |
| | | | | | | | | | |

---

## 📝 填写说明

### Study（研究标识）
**格式**: `作者名 et al. (年份)` 或 `NCT号`
**示例**:
- `Modi et al. NEJM 2020 (DESTINY-Breast01)`
- `NCT03529110`

### Design（研究设计）
**选项**:
- `RCT` - 随机对照试验
- `Single-arm Phase II` - 单臂II期
- `Retrospective cohort` - 回顾性队列
- `Meta-analysis` - Meta分析
- `Registry study` - 注册登记研究

### Population（患者群体）
**关键要素**（用简洁语言描述）:
- 疾病类型及分期
- 关键生物标志物（如HER2+, EGFR mut）
- 既往治疗线数
- 特殊人群（如脑转移、老年人）

**示例**:
- `HER2+ mBC, 2L+, 既往T-DM1治疗`
- `EGFR exon19del/L858R NSCLC, 1L`

### N（样本量）
**格式**: 直接填写数字
**注意**: 如果有多个治疗组，填写总样本量

**示例**:
- `184` (单臂研究)
- `524 (262 vs 262)` (RCT)

### Intervention（干预措施）
**格式**: `药物名 剂量 给药方案`

**示例**:
- `T-DXd 5.4mg/kg IV q3w`
- `Osimertinib 80mg PO QD`
- `Tucatinib 300mg PO BID + Capecitabine + Trastuzumab`

### Comparator（对照组）
**格式**: 同Intervention
**注意**: 单臂研究填写 `N/A` 或 `Historical control`

**示例**:
- `Physician's choice (T-DM1/Capecitabine+Trastuzumab/Lapatinib+Capecitabine)`
- `Placebo + BSC`

### Primary Outcome（主要终点）
**常见终点缩写**:
- `ORR` - 客观缓解率
- `PFS` - 无进展生存期
- `OS` - 总生存期
- `pCR` - 病理完全缓解率
- `DFS` - 无病生存期

**格式**: `终点名称 (定义)`

**示例**:
- `ORR (CR+PR per RECIST 1.1)`
- `PFS (BICR)`
- `OS (death from any cause)`

### Effect Size（效应量）
**格式取决于结局类型**:

**二分类结局（ORR, pCR）**:
```
ORR: 60.9% vs 20.2% (p<0.001)
或
ORR: 60.9% (95% CI: 53.4-68.0)
```

**时间-事件结局（PFS, OS）**:
```
Median PFS: 16.8m vs 6.9m
HR 0.44 (95% CI: 0.36-0.55, p<0.001)
```

**连续性结局**:
```
Mean change: -2.3 vs -0.8 (p=0.02)
```

### Evidence Level（证据等级）
**使用Oxford CEBM或GRADE系统**

**Oxford CEBM Levels**:
- `Level 1` - 高质量RCT或系统综述
- `Level 2` - 较低质量RCT或高质量观察性研究
- `Level 3` - 病例对照研究
- `Level 4` - 病例系列
- `Level 5` - 专家意见

**GRADE分级** (可选):
- `High` - 高质量
- `Moderate` - 中等质量
- `Low` - 低质量
- `Very Low` - 极低质量

### Notes（备注）
**记录关键信息**:
- 研究的独特优势
- 重要的局限性
- 亚组分析发现
- 安全性信号

**示例**:
- `脑转移亚组: ORR 45.5% vs 33.3%`
- `Grade ≥3 AE: 45% (主要为血液学毒性)`
- `中位随访时间仅8.2个月，OS数据不成熟`

---

## 💡 使用示例

### 示例1: HER2+乳腺癌二线治疗比较

| Study | Design | Population | N | Intervention | Comparator | Primary Outcome | Effect Size | Evidence Level | Notes |
|-------|--------|------------|---|--------------|------------|-----------------|-------------|----------------|-------|
| DESTINY-Breast03 (Cortés 2022) | RCT, Phase III | HER2+ mBC, 2L, 既往T/P治疗 | 524 (261 vs 263) | T-DXd 5.4mg/kg q3w | T-DM1 3.6mg/kg q3w | PFS (BICR) | mPFS: 28.8m vs 6.8m<br>HR 0.33 (0.26-0.43, p<0.001) | Level 1 | ORR: 79.7% vs 34.2%<br>脑转移亚组HR 0.25<br>Grade≥3 AE: 45% vs 39% |
| DESTINY-Breast01 (Modi 2020) | Single-arm Phase II | HER2+ mBC, 3L+, 既往T-DM1 | 184 | T-DXd 5.4mg/kg q3w | N/A | ORR (BICR) | ORR: 60.9% (53.4-68.0)<br>mPFS: 16.4m | Level 2 | DOR: 14.8m<br>ILD发生率: 13.6% (Grade≥3: 2.7%) |
| HER2CLIMB (Murthy 2020) | RCT, Phase II | HER2+ mBC with brain mets, 2L+ | 612 (410 vs 202) | Tucatinib + Cap + T | Placebo + Cap + T | PFS (ITT) | mPFS: 7.8m vs 5.6m<br>HR 0.54 (0.42-0.71, p<0.00001) | Level 1 | CNS-PFS: 9.9m vs 4.2m (HR 0.32)<br>腹泻 Grade≥3: 13% |

### 示例2: EGFR-TKI一线治疗比较（NSCLC）

| Study | Design | Population | N | Intervention | Comparator | Primary Outcome | Effect Size | Evidence Level | Notes |
|-------|--------|------------|---|--------------|------------|-----------------|-------------|----------------|-------|
| FLAURA (Soria 2018) | RCT, Phase III | EGFR mut NSCLC, 1L | 556 (279 vs 277) | Osimertinib 80mg QD | Gefitinib/Erlotinib | PFS (INV) | mPFS: 18.9m vs 10.2m<br>HR 0.46 (0.37-0.57, p<0.001) | Level 1 | CNS-PFS: NR vs 13.9m (HR 0.48)<br>OS: 38.6m vs 31.8m (HR 0.80, p=0.046) |
| ARCHER 1050 (Wu 2020) | RCT, Phase III | EGFR exon19del NSCLC, 1L | 452 (226 vs 226) | Dacomitinib 45mg QD | Gefitinib 250mg QD | PFS (BICR) | mPFS: 14.7m vs 9.2m<br>HR 0.59 (0.47-0.74, p<0.001) | Level 1 | OS: 34.1m vs 27.0m (HR 0.76, p=0.044)<br>皮疹/腹泻更常见，需dose adjustment |

---

## 🔍 质量检查清单

填表完成后，确认以下要点：

- [ ] **完整性**: 所有关键列都已填写（至少包含Study, N, Intervention, Primary Outcome, Effect Size）
- [ ] **一致性**: 效应量的表达格式统一（如都用HR + 95%CI）
- [ ] **准确性**: 数字直接来自原文，未进行四舍五入或估算
- [ ] **可比性**: 如果是比较多个研究，患者群体和终点定义可比
- [ ] **透明性**: Notes列标注了重要的异质性来源或研究局限

---

## 📌 高级用法

### 用法1: 分层展示（按证据等级）

**Level 1 Evidence (High-quality RCTs)**

| Study | ... | Effect Size | Notes |
|-------|-----|-------------|-------|
| ... | ... | ... | ... |

**Level 2 Evidence (Lower-quality RCTs / High-quality observational)**

| Study | ... | Effect Size | Notes |
|-------|-----|-------------|-------|
| ... | ... | ... | ... |

### 用法2: 按亚组分层

**Overall Population**

| Study | ... | Effect Size | Notes |
|-------|-----|-------------|-------|
| ... | ... | ... | ... |

**Subgroup: Brain Metastases**

| Study | ... | Effect Size | Notes |
|-------|-----|-------------|-------|
| ... | ... | ... | ... |

### 用法3: 整合安全性数据

在主表后添加安全性汇总表：

**Safety Summary**

| Study | Grade ≥3 AE (%) | Treatment Discontinuation (%) | Common AEs (Grade ≥3) | Special Warnings |
|-------|-----------------|-------------------------------|----------------------|------------------|
| ... | 45% | 15% | 中性粒细胞减少(20%), 恶心(8%) | ILD风险 (13.6%) |

---

## 🎯 输出建议

**在报告中的使用**:

1. **放置位置**: 通常在"Evidence Summary"或"Results"章节
2. **配合文字**: 表格前用1-2段文字介绍研究检索策略和纳入标准
3. **表格后分析**: 表格后用文字总结关键发现、异质性和证据质量
4. **可视化**: 如有条件，可将关键数据转化为森林图或气泡图

**示例文字（表格前）**:
```markdown
## Evidence Summary

We conducted a systematic search of PubMed, Embase, and ClinicalTrials.gov
(search date: 2025-12-07) using the terms "HER2-positive breast cancer" AND
"trastuzumab deruxtecan" OR "T-DXd". Studies were included if they reported
efficacy outcomes in patients with HER2+ metastatic breast cancer previously
treated with trastuzumab-based therapy.

**Search Results**: 156 articles identified → 45 full-text reviewed → 3 key studies included

The following table summarizes the key evidence:

[插入表格]

**Key Findings**: ...
```

---

*Template Version: 1.0*
*Last Updated: 2025-12-07*
*Part of: Medical Research Analyst Skill - LiYe OS*
