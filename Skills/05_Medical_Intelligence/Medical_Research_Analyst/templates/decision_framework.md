# Decision Framework Template

**用途**: 结构化临床决策过程，从证据到推荐的完整逻辑链条
**适用场景**: 治疗方案选择、诊断策略、风险评估

---

## 🎯 Clinical Decision Framework

### Framework Overview

```
[Clinical Question]
        ↓
[Evidence Synthesis] → [Quality Assessment]
        ↓
[Benefit-Risk Analysis] → [Patient Values Integration]
        ↓
[Recommendation] → [Confidence Level] → [Implementation Considerations]
```

---

## 1️⃣ Clinical Question Definition

### PICO Framework

| Element | Details | Clinical Relevance |
|---------|---------|-------------------|
| **P** (Population) | [患者特征] | [为什么这个群体特殊？] |
| **I** (Intervention) | [干预措施] | [作用机制/理论基础] |
| **C** (Comparison) | [对照措施] | [当前标准治疗] |
| **O** (Outcomes) | [关注结局] | [对患者最重要的是什么？] |

**Example**:
```
P: 55岁HER2+ HR+乳腺癌患者，一线T/P治疗后进展，现有脑转移3个病灶
I: T-DXd 5.4mg/kg IV q3w
C: T-DM1 3.6mg/kg q3w 或 Tucatinib组合治疗
O: 主要关注PFS（尤其CNS-PFS）、OS、安全性；次要关注QoL

Clinical Relevance:
- 脑转移是预后不良因素，需要CNS穿透性好的药物
- 既往已接受T/P，需要非交叉耐药的方案
- HR+提示可能受益于内分泌治疗联合（未来考虑）
```

### Key Decision Points（关键决策点）

1. **Primary Decision**: [核心治疗选择问题]
2. **Secondary Decisions**:
   - [剂量选择]
   - [联合用药]
   - [治疗持续时间]
3. **Contingency Plans**: [如果一线方案失败/不耐受，备选方案是什么？]

---

## 2️⃣ Evidence Synthesis

### Evidence Base Summary

| Evidence Type | Number of Studies | Total Patients | Quality | Key Findings |
|---------------|------------------|----------------|---------|--------------|
| **RCTs** | n | N | ⭐⭐⭐⭐⭐ | [主要发现] |
| **Single-arm trials** | n | N | ⭐⭐⭐⭐☆ | [主要发现] |
| **Observational** | n | N | ⭐⭐⭐☆☆ | [主要发现] |
| **Systematic Reviews** | n | N meta | ⭐⭐⭐⭐⭐ | [主要发现] |

**Example**:
```
RCTs: 1个 (DESTINY-Breast03, N=524) | ⭐⭐⭐⭐⭐ | T-DXd vs T-DM1: mPFS 28.8m vs 6.8m (HR 0.33)
Single-arm: 2个 (DESTINY-Breast01/02, N=184+608) | ⭐⭐⭐⭐☆ | ORR 60-61%, mPFS 16-17m
Observational: 3个 (Real-world evidence, N=~500) | ⭐⭐⭐☆☆ | 与RCT结果一致
```

### GRADE Evidence Profile

| Outcome | № of patients (studies) | Certainty | Effect Estimate | Importance |
|---------|------------------------|-----------|-----------------|-----------|
| PFS | 524 (1 RCT) | ⊕⊕⊕⊕ HIGH | HR 0.33 (0.26-0.43) | CRITICAL |
| OS | 524 (1 RCT) | ⊕⊕⊕⊕ HIGH | HR 0.64 (0.47-0.87) | CRITICAL |
| ORR | 524 (1 RCT) | ⊕⊕⊕⊕ HIGH | RR 2.33 (1.95-2.79) | IMPORTANT |
| CNS-PFS | ~100 (subgroup) | ⊕⊕⊕⊝ MODERATE | HR 0.25 (0.13-0.50) | CRITICAL |
| Grade≥3 AE | 524 (1 RCT) | ⊕⊕⊕⊕ HIGH | RR 1.15 (0.92-1.43) | IMPORTANT |

**GRADE Certainty Levels**:
- ⊕⊕⊕⊕ = HIGH: Very confident that the true effect lies close to estimate
- ⊕⊕⊕⊝ = MODERATE: Moderately confident (true effect likely close, but could be different)
- ⊕⊕⊝⊝ = LOW: Limited confidence (true effect may differ substantially)
- ⊕⊝⊝⊝ = VERY LOW: Very little confidence (true effect likely substantially different)

---

## 3️⃣ Benefit-Risk Analysis

### Benefit Assessment

| Outcome | Absolute Benefit | NNT | Clinical Significance |
|---------|------------------|-----|----------------------|
| **Primary Efficacy** | | | |
| PFS improvement | +22.0 months | - | 显著延长（3.2倍） |
| OS improvement | +9.9 months | ~4 | 临床有意义（>3个月） |
| CNS-PFS improvement | HR 0.25 | - | 脑转移控制优异 |
| **Response** | | | |
| ORR increase | +45.5% (79.7% vs 34.2%) | 2.2 | 大多数患者获益 |
| CR rate | +19.8% (24.5% vs 4.7%) | 5.1 | 深度缓解率高 |

**NNT (Number Needed to Treat)**: 需要治疗多少患者，才能使1人获益

### Risk Assessment

| Adverse Event | Incidence Increase | NNH | Management Strategy |
|---------------|-------------------|-----|---------------------|
| **Serious AEs** | | | |
| Grade≥3 AEs | +6% (45% vs 39%) | 16.7 | 可接受（多为可逆性血液学毒性） |
| ILD (any grade) | +13.6% vs baseline | 7.4 | 需密切监测肺部症状 |
| ILD (Grade≥3) | +2.7% | 37 | 低发生率，可管理 |
| **Common AEs** | | | |
| 恶心 | +70% vs 48% | 4.5 | 对症处理，少影响治疗 |
| 脱发 | +36% vs 3% | 3.0 | 可逆，QoL影响 |

**NNH (Number Needed to Harm)**: 需要治疗多少患者，会导致1人发生不良事件

### Benefit-Risk Ratio

```
Benefit (PFS gain):     +22.0 months
Risk (Grade≥3 AE):      +6% (NNH=16.7)
Serious Risk (ILD≥3):   +2.7% (NNH=37)

Benefit-Risk Ratio = 22.0m PFS gain / 6% additional Grade≥3 AE
                   = 明显正向（benefit远超risk）

特殊关注: ILD需监测但发生率可控
```

---

## 4️⃣ Patient Values Integration

### Shared Decision-Making Considerations

| Patient Value/Preference | How it affects decision | Example |
|--------------------------|------------------------|---------|
| **治疗目标** | | |
| 追求最大生存获益 | 优选疗效最强方案 | → T-DXd（PFS/OS最优） |
| 优先考虑生活质量 | 平衡疗效与毒性 | → 需评估ILD风险接受度 |
| 控制症状（如脑转移） | 优选CNS穿透性好的药物 | → T-DXd（CNS-PFS HR 0.25） |
| **治疗便利性** | | |
| 希望减少医院往返 | 优选口服药物 | → Tucatinib组合（但疗效略差） |
| 接受静脉治疗 | IV q3w可接受 | → T-DXd或T-DM1均可 |
| **风险承受度** | | |
| 低风险偏好 | 优先安全性更好的方案 | → T-DM1（副作用略低） |
| 高风险承受（为疗效） | 可接受较高毒性 | → T-DXd（接受ILD风险） |
| **经济考量** | | |
| 费用敏感 | 优先考虑性价比 | → 评估自费vs医保报销情况 |
| 费用不是主要考虑 | 优选疗效最优方案 | → T-DXd |

### Patient-Specific Modifiers

**增加T-DXd优先级的因素** ⬆️:
- ✅ 有脑转移（CNS疗效优）
- ✅ 年轻、PS好（能耐受治疗）
- ✅ 追求最大疗效
- ✅ 无肺部基础疾病

**降低T-DXd优先级的因素** ⬇️:
- ⚠️ 既往ILD病史
- ⚠️ 严重肺部基础疾病（肺纤维化、慢阻肺）
- ⚠️ 老年多并发症（>75岁 + ECOG PS≥2）
- ⚠️ 强烈偏好口服治疗

---

## 5️⃣ Recommendation

### Primary Recommendation

**推荐方案**: [方案名称]

**推荐强度**:
- 🟢 **Strong Recommendation** (强推荐): 绝大多数患者适用
- 🟡 **Conditional Recommendation** (条件推荐): 部分患者适用，需个体化
- 🔴 **Against** (不推荐): 不建议使用

**证据质量**:
- ⭐⭐⭐⭐⭐ High-quality evidence
- ⭐⭐⭐⭐☆ Moderate-quality evidence
- ⭐⭐⭐☆☆ Low-quality evidence

**Example**:
```
Primary Recommendation: T-DXd 5.4mg/kg IV q3w

Strength: 🟢 Strong Recommendation
Evidence: ⭐⭐⭐⭐⭐ High-quality (基于DESTINY-Breast03 RCT)

Rationale:
1. 显著PFS获益（HR 0.33，绝对获益+22个月）
2. OS改善（HR 0.64，绝对获益+9.9个月）
3. CNS疗效优异（HR 0.25，适合有脑转移的患者）
4. 安全性可控（Grade≥3 AE 45% vs 39%，ILD可管理）
5. 已纳入多个指南一类推荐（NCCN, ESMO）
```

### Alternative Recommendations

**备选方案1**: [方案名称]

**适用场景**: [何时考虑此方案？]

**Example**:
```
Alternative 1: Tucatinib + Capecitabine + Trastuzumab

适用场景:
- 患者有ILD高风险因素或既往ILD病史
- 强烈偏好口服治疗
- T-DXd不可及或不耐受

Evidence: ⭐⭐⭐⭐☆ (HER2CLIMB, Phase II RCT)
Strength: 🟡 Conditional（特定场景下推荐）
```

**备选方案2**: T-DM1 3.6mg/kg IV q3w

```
适用场景:
- 老年患者（>75岁）或PS较差（ECOG 2）
- 多种并发症，优先考虑安全性
- T-DXd不可及

Evidence: ⭐⭐⭐⭐⭐ (多个RCT)
Strength: 🟡 Conditional（安全性优先场景）
Note: 疗效劣于T-DXd（DESTINY-Breast03直接比较）
```

### Recommendation for Special Populations

| Subgroup | Recommendation | Modification from standard |
|----------|---------------|---------------------------|
| **脑转移患者** | T-DXd (Strong) | 无需调整，CNS疗效优异 |
| **老年患者(>75岁)** | T-DXd (Conditional) | 需评估器官功能，可能需dose reduction |
| **肾功能不全** | T-DXd (Conditional) | CrCl>30可用，需密切监测 |
| **肝功能不全** | 谨慎使用 | 轻度可用，中重度避免 |
| **既往ILD** | 不推荐T-DXd | 选择Tucatinib组合或T-DM1 |

---

## 6️⃣ Implementation Considerations

### Pre-Treatment Checklist

**必须完成的评估**:
- [ ] 确认HER2状态（IHC 3+ 或 FISH+）
- [ ] 基线肺部CT（排除ILD）
- [ ] 肝肾功能评估
- [ ] LVEF评估（基线≥50%）
- [ ] 患者教育（ILD症状识别）

### Monitoring Plan

| Parameter | Baseline | During Treatment | Post-Treatment |
|-----------|----------|------------------|----------------|
| **疗效监测** | | | |
| 影像学评估 | CT/MRI | 每2-3个周期 | 进展后 |
| 肿瘤标志物 | CA 15-3, CEA | 每周期 | 进展后 |
| **安全性监测** | | | |
| 肺部症状问询 | - | 每次就诊 | - |
| 胸部CT | CT | 有症状时或每6个周期 | - |
| LVEF | 基线 | 每3个月 | - |
| 肝肾功能 | 基线 | 每周期 | - |
| 血常规 | 基线 | 每周期 | - |

### Dose Modification

**T-DXd剂量调整标准**:

| Toxicity | Grade | Action |
|----------|-------|--------|
| **ILD** | Grade 1 | 暂停，症状缓解后可考虑5.4→4.4→3.2mg/kg |
| | Grade 2+ | 永久停药 |
| **中性粒细胞减少** | Grade 3 | 暂停至恢复≥Grade 1，减量 |
| | Grade 4 | 暂停，恢复后减量，考虑G-CSF支持 |
| **恶心/呕吐** | Grade 3-4 | 加强止吐，暂停至≤Grade 1 |

**剂量梯度**: 5.4 mg/kg → 4.4 mg/kg → 3.2 mg/kg

### When to Discontinue

**治疗终止指征**:
1. ✅ 疾病进展（RECIST 1.1标准）
2. ✅ 不可耐受的毒性（尤其ILD Grade≥2）
3. ✅ 患者拒绝继续
4. ✅ 死亡

**脑转移局部进展处理**:
- 如仅CNS进展，全身疾病控制 → 考虑局部治疗（SRS）后继续T-DXd
- 如全身+CNS进展 → 换线治疗

---

## 7️⃣ Evidence-to-Recommendation Logic Chain

### Logic Pathway

```
[Question]: HER2+ mBC二线治疗选择

        ↓

[Evidence]: DESTINY-Breast03 RCT
            - T-DXd vs T-DM1
            - mPFS: 28.8m vs 6.8m (HR 0.33, p<0.001)
            - mOS: 未达到 vs 34.2m (HR 0.64, p=0.001)
            - CNS-PFS: HR 0.25

        ↓

[Quality]: ⭐⭐⭐⭐⭐ High
            - RCT, large sample (N=524)
            - Low risk of bias
            - Consistent results across subgroups

        ↓

[Benefit]: +22.0m PFS, +9.9m OS, ORR +45.5%
            临床意义显著（>3倍PFS延长）

        ↓

[Risk]:     Grade≥3 AE +6% (NNH=16.7)
            ILD风险+13.6% (但Grade≥3仅2.7%)
            可管理，benefit远超risk

        ↓

[Patient Values]:
            - 大多数患者优先考虑疗效（尤其有脑转移）
            - ILD风险可通过监测管理
            - 静脉给药q3w接受度高

        ↓

[Recommendation]: 🟢 Strong Recommendation for T-DXd
                  证据充分、获益明确、风险可控

        ↓

[Implementation]:
            - 基线肺CT筛查
            - 治疗中密切监测ILD
            - 患者教育症状识别
```

---

## 8️⃣ Uncertainty & Future Directions

### Remaining Uncertainties

| Question | Current Evidence | What's Needed |
|----------|------------------|---------------|
| **最佳治疗线数** | 二线数据最充分 | 一线vs T/P的头对头RCT（DESTINY-Breast09进行中） |
| **最佳治疗持续时间** | 持续至进展为标准 | 固定疗程 vs 持续治疗的研究 |
| **与免疫治疗联合** | 缺乏数据 | T-DXd + PD-1抑制剂的II期试验 |
| **生物标志物预测** | HER2 IHC/FISH为准 | HER2低表达、PIK3CA突变等的预测价值 |

### Ongoing Trials

| Trial ID | Design | Question | Expected Results |
|----------|--------|----------|------------------|
| NCT03734029 | Phase III | T-DXd vs investigator's choice (1L) | 2026 |
| NCT04538742 | Phase III | T-DXd vs T-DM1 (adjuvant) | 2027 |
| NCT04622319 | Phase Ib/II | T-DXd + pembrolizumab | 2025 |

**如何更新推荐**:
- DESTINY-Breast09结果公布 → 可能将T-DXd推荐提前至一线
- 辅助治疗试验阳性 → 扩展至早期乳腺癌
- 联合免疫治疗数据成熟 → 可能改变治疗策略

---

## 🎯 Decision Summary (One-Pager)

### For Quick Reference

**Clinical Question**: HER2+乳腺癌二线治疗选择

**Best Option**: T-DXd 5.4mg/kg IV q3w

**Evidence**: ⭐⭐⭐⭐⭐ RCT (DESTINY-Breast03)

**Benefit**: mPFS 28.8m vs 6.8m (HR 0.33), mOS 未达到 vs 34.2m (HR 0.64)

**Risk**: Grade≥3 AE 45%, ILD 13.6% (Grade≥3: 2.7%)

**Recommendation Strength**: 🟢 Strong

**Who benefits most**: 有脑转移、年轻、PS好、追求最大疗效的患者

**Who should avoid**: 既往ILD、严重肺病、老年多并发症

**Alternatives**: Tucatinib组合（口服偏好/ILD高风险）、T-DM1（安全性优先）

**Key Monitoring**: 肺部症状、每次问诊询问呼吸困难/咳嗽

---

## 📚 References

1. Cortés J, et al. N Engl J Med. 2022;386(12):1143-1154. (DESTINY-Breast03)
2. Modi S, et al. N Engl J Med. 2020;382(7):610-621. (DESTINY-Breast01)
3. NCCN Guidelines: Breast Cancer v5.2024
4. ESMO Clinical Practice Guidelines: Breast Cancer 2023

---

*Template Version: 1.0*
*Last Updated: 2025-12-07*
*Part of: Medical Research Analyst Skill - LiYe OS*
