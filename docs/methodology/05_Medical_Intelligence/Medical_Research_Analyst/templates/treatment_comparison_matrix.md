# Treatment Comparison Matrix Template

**用途**: 多维度比较不同治疗方案，支持临床决策
**适用场景**: 治疗方案选择、多线治疗排序、个体化决策

---

## 🔄 Treatment Comparison Matrix

### 基础版（3维度比较）

| Dimension | Treatment A<br>[方案名称] | Treatment B<br>[方案名称] | Treatment C<br>[方案名称] |
|-----------|--------------------------|--------------------------|--------------------------|
| **Efficacy** | | | |
| Primary endpoint | [数据 + 证据等级] | [数据 + 证据等级] | [数据 + 证据等级] |
| **Safety** | | | |
| Grade ≥3 AE rate | [%] | [%] | [%] |
| **Accessibility** | | | |
| Approval status | [FDA/NMPA/EMA] | [FDA/NMPA/EMA] | [FDA/NMPA/EMA] |

### 完整版（8维度比较）

| Dimension | Weight | Treatment A | Treatment B | Treatment C | Winner |
|-----------|--------|-------------|-------------|-------------|--------|
| **1. Efficacy** | 35% | | | | |
| Primary outcome (PFS/OS) | | mPFS: 28.8m<br>(Level 1, HR 0.33) | mPFS: 16.4m<br>(Level 2, single-arm) | mPFS: 7.8m<br>(Level 1, HR 0.54) | A |
| ORR | | 79.7% | 60.9% | 33.5% | A |
| Response duration | | mDOR: 18.2m | mDOR: 14.8m | mDOR: 8.6m | A |
| **2. Safety** | 20% | | | | |
| Grade ≥3 AE rate | | 45% | 52% | 55% | A |
| Treatment discontinuation | | 15% | 18% | 21% | A |
| Specific concerns | | ILD (13.6%, 大多Grade 1-2) | 血液学毒性 | 腹泻 (Grade≥3: 13%) | Balanced |
| **3. CNS Efficacy** | 15% | | | | |
| CNS-specific outcome | | CNS-PFS HR 0.25<br>(强于全身) | CNS ORR: 45.5% | CNS-PFS HR 0.32 | A |
| **4. Quality of Life** | 10% | | | | |
| QoL measures | | EORTC QLQ-C30<br>(无显著下降) | 数据有限 | PRO: 改善 | C |
| Dosing convenience | | IV q3w (不便) | IV q3w (不便) | PO BID (方便) | C |
| **5. Evidence Quality** | 10% | | | | |
| Study design | | Phase III RCT | Phase II single-arm | Phase II RCT | A |
| Sample size | | 524 | 184 | 612 | C |
| Follow-up maturity | | 成熟 (OS数据可用) | 中等 | 成熟 | A/C |
| **6. Accessibility** | 5% | | | | |
| Regulatory approval | | FDA/NMPA/EMA | FDA/NMPA/EMA | FDA | A/B |
| Guideline recommendation | | NCCN 1类, ESMO I-A | NCCN 1类 | NCCN 2A | A |
| **7. Cost-Effectiveness** | 3% | | | | |
| Approximate cost | | ¥¥¥¥ | ¥¥¥¥ | ¥¥¥ | C |
| Cost-per-QALY | | 数据有限 | 数据有限 | 可能更优 | C |
| **8. Patient-Specific Factors** | 2% | | | | |
| Comorbidity considerations | | 需监测肺功能 | 需监测血象 | 需GI耐受 | 个体化 |
| Prior treatment impact | | T-DM1难治仍有效 | 专为T-DM1后设计 | 脑转移优选 | B/C (场景依赖) |

---

## 📝 填写说明

### 1. Dimension（比较维度）

**核心8大维度**:
1. **Efficacy（疗效）** - 最重要
2. **Safety（安全性）** - 平衡疗效
3. **CNS Efficacy（中枢神经系统疗效）** - 特定场景
4. **Quality of Life（生活质量）** - 患者视角
5. **Evidence Quality（证据质量）** - 可信度
6. **Accessibility（可及性）** - 现实因素
7. **Cost-Effectiveness（成本效益）** - 经济考量
8. **Patient-Specific Factors（患者特异性）** - 个体化

**可根据具体场景调整权重**（如脑转移患者提高CNS Efficacy权重至25-30%）

### 2. Weight（权重）

**默认权重分配**:
- Efficacy: 35%（最关键）
- Safety: 20%（必须考虑）
- CNS Efficacy: 15%（如适用；否则分配给Efficacy）
- QoL: 10%
- Evidence Quality: 10%
- Accessibility: 5%
- Cost: 3%
- Patient-Specific: 2%

**合计**: 100%

**权重调整原则**:
- 如果是选择**一线治疗** → Efficacy权重可提至40-45%
- 如果患者**严重并发症** → Safety权重提至25-30%
- 如果是**脑转移患者** → CNS Efficacy权重提至20-25%
- 如果是**自费患者** → Cost权重提至10-15%

### 3. Treatment Columns（治疗方案列）

**方案命名格式**:
```
Treatment A: T-DXd
(Trastuzumab deruxtecan 5.4mg/kg IV q3w)
```

**数据填写要点**:
- 包含具体数值 + 统计指标（HR, 95%CI, p-value）
- 标注证据等级（Level 1-5）
- 标注关键研究来源（如DESTINY-Breast03）

### 4. Winner（优胜方案）

**判断逻辑**:
- 单一维度明显优势 → 标注该方案字母
- 多方案接近 → 标注"Balanced"或"Tied"
- 取决于患者特征 → 标注"个体化"或"场景依赖"

---

## 💡 使用示例

### 示例1: HER2+乳腺癌二线治疗选择

**场景**: 55岁HER2+ HR+乳腺癌患者，一线T/P治疗后进展，现有脑转移

| Dimension | Weight | T-DXd | T-DM1 | Tucatinib组合 | Winner |
|-----------|--------|-------|-------|--------------|--------|
| **Efficacy** | 30% | | | | |
| PFS | | 28.8m (HR 0.33, L1) | 6.8m (ref) | 7.8m (HR 0.54, L1) | **T-DXd** |
| ORR | | 79.7% | 34.2% | 33.5% | **T-DXd** |
| **CNS Efficacy** | 25% | | | | |
| CNS-PFS | | HR 0.25 vs T-DM1 | ref | HR 0.32 vs placebo | **T-DXd** |
| CNS ORR | | 45.5% | ~20% | 47.3% | T-DXd/Tuc (Tied) |
| **Safety** | 20% | | | | |
| Grade≥3 AE | | 45% | 39% | 55% | **T-DM1** |
| 特殊关注 | | ILD 13.6% (大多轻度) | 血小板减少 | 腹泻 13% | Balanced |
| **QoL** | 10% | | | | |
| 给药便利性 | | IV q3w | IV q3w | PO BID | **Tucatinib** |
| **Evidence** | 10% | | | | |
| 研究质量 | | Phase III (DESTINY-Breast03) | Phase III (ref) | Phase II (HER2CLIMB) | T-DXd/T-DM1 |
| **Accessibility** | 3% | | | | |
| 指南推荐 | | NCCN 1类 | NCCN 1类 | NCCN 2A | T-DXd/T-DM1 |
| **Cost** | 2% | | | | |
| 相对成本 | | 极高 | 高 | 高 | **T-DM1** |

**加权总评**:
- T-DXd: **0.30×1.0 + 0.25×1.0 + 0.20×0.7 + 0.10×0.5 + 0.10×1.0 + 0.03×1.0 + 0.02×0.3 = 0.886**
- T-DM1: 0.30×0.3 + 0.25×0.3 + 0.20×1.0 + 0.10×0.5 + 0.10×1.0 + 0.03×1.0 + 0.02×1.0 = 0.447
- Tucatinib: 0.30×0.4 + 0.25×0.9 + 0.20×0.5 + 0.10×1.0 + 0.10×0.7 + 0.03×0.7 + 0.02×0.7 = 0.626

**结论**: **T-DXd 明显优于其他方案**（加权评分0.886 vs 0.447 vs 0.626）

### 示例2: EGFR+ NSCLC一线治疗选择

**场景**: 70岁EGFR exon19del NSCLC患者，PS 1，无脑转移

| Dimension | Weight | Osimertinib | Gefitinib | Dacomitinib | Winner |
|-----------|--------|-------------|-----------|-------------|--------|
| **Efficacy** | 40% | | | | |
| PFS | | 18.9m (HR 0.46) | 10.2m (ref) | 14.7m (HR 0.59) | **Osimertinib** |
| OS | | 38.6m (HR 0.80) | 31.8m (ref) | 34.1m (HR 0.76) | **Osimertinib** |
| **CNS Efficacy** | 20% | | | | |
| CNS-PFS | | NR (HR 0.48) | 13.9m (ref) | 数据有限 | **Osimertinib** |
| **Safety** | 20% | | | | |
| Grade≥3 AE | | 42% | 35% | 58% | **Gefitinib** |
| 需dose reduction | | 4% | 6% | 67% | Osimertinib |
| **QoL** | 10% | | | | |
| 症状改善时间 | | 更快 | ref | 更快但副作用多 | Osimertinib |
| **Evidence** | 5% | | | | |
| 研究质量 | | FLAURA (Phase III) | FLAURA (ref) | ARCHER 1050 (Phase III) | All high |
| **Accessibility** | 3% | | | | |
| 可及性 | | 中国已上市 | 中国已上市 | 中国未上市 | Osi/Gefi |
| **Cost** | 2% | | | | |
| 相对成本 | | 极高 | 低 | 高 | **Gefitinib** |

**结论**:
- **首选: Osimertinib**（PFS/OS/CNS疗效均优，耐受性可接受）
- **替代: Gefitinib**（如经济负担重 + 无脑转移风险）
- **不推荐: Dacomitinib**（虽有OS获益但副作用大，需频繁dose reduction）

---

## 🎯 决策树整合

矩阵比较后，可结合决策树给出推荐：

```
[HER2+乳腺癌二线治疗]
       |
       ├─ 有脑转移？
       |    ├─ Yes → T-DXd (CNS疗效最优)
       |    └─ No  → 继续评估
       |
       ├─ 经济负担？
       |    ├─ 能承受 → T-DXd (整体疗效最优)
       |    └─ 困难 → 考虑临床试验或Tucatinib组合
       |
       └─ ILD风险因素？
            ├─ 有(肺纤维化/既往ILD) → Tucatinib组合
            └─ 无 → T-DXd (严密监测)
```

---

## 📊 可视化建议

**雷达图（Radar Chart）**:
将8个维度制作成雷达图，直观显示各方案优劣势

**热力图（Heatmap）**:
用颜色深浅表示各维度得分（绿色=优，黄色=中，红色=劣）

**加权柱状图**:
最终加权总分的柱状图比较

---

## 🔍 质量检查清单

- [ ] **完整性**: 所有关键维度都已评估
- [ ] **一致性**: 数据来源和时间点一致（避免跨研究直接比较）
- [ ] **权重合理**: 权重分配符合患者实际情况
- [ ] **证据标注**: 每个数据点都标注了证据等级
- [ ] **个体化**: 考虑了患者特异性因素

---

## 🎓 高级用法

### 场景依赖矩阵

**不同患者场景下的最优选择**:

| 场景 | 推荐方案 | 理由 |
|------|---------|------|
| 有脑转移 | T-DXd | CNS-PFS HR 0.25 |
| 无脑转移 + 年轻 + 追求最佳疗效 | T-DXd | PFS/OS最优 |
| 既往ILD病史 | Tucatinib组合 | 避免ILD风险 |
| 经济困难 | 临床试验 或 Tucatinib | 相对可及 |
| 老年 + 多并发症 | T-DM1 或低剂量方案 | 安全性优先 |

### 敏感性分析

**改变权重后的结果变化**:

```markdown
**基础场景**（标准权重）: T-DXd胜出
**场景A**（安全性权重↑至35%）: T-DM1可能更优
**场景B**（成本权重↑至20%）: Tucatinib组合可能更优
**场景C**（CNS疗效权重↑至40%）: T-DXd优势更明显
```

---

*Template Version: 1.0*
*Last Updated: 2025-12-07*
*Part of: Medical Research Analyst Skill - LiYe OS*
