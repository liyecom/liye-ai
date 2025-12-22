# 🔄 Medical Research Analyst - Evolution Log

**Skill Name**: Medical Research Analyst
**Created**: 2025-12-07
**Current Version**: v1.0

---

## 📊 Version History

### v1.0 - 2025-12-07 (Initial Release)

**Status**: ✅ Active
**Creator**: LiYe OS Initialization
**Milestone**: First demonstration Skill in LiYe OS Skills system

#### 创建内容

**Core Components**:
- ✅ skill_definition.md (完整10模块定义)
- ✅ README.md (使用指南)
- ✅ evolution_log.md (本文件)
- ✅ methods.md (详细方法文档)
- ✅ templates/ (4个初始模板)
  - evidence_summary_table.md
  - treatment_comparison_matrix.md
  - literature_search_strategy.md
  - decision_framework.md
- ✅ artifacts/ (项目输出目录)

#### 能力范围

**核心能力矩阵**:

| Capability Domain | Sub-capabilities | Maturity Level |
|-------------------|------------------|----------------|
| Evidence-Based Research | 文献检索、质量评估、证据分级 | ⭐⭐⭐⭐☆ (4/5) |
| Clinical Reasoning | PICO框架、NNT计算、贝叶斯推理 | ⭐⭐⭐⭐☆ (4/5) |
| Critical Analysis | 偏倚识别、效应量评估、异质性分析 | ⭐⭐⭐⭐☆ (4/5) |
| Structured Communication | 分层报告、可视化、决策树 | ⭐⭐⭐☆☆ (3/5) |

**知识覆盖**:
- 肿瘤学（Oncology）: ⭐⭐⭐⭐⭐
- 心血管（Cardiology）: ⭐⭐⭐☆☆
- 神经学（Neurology）: ⭐⭐⭐☆☆
- 其他领域: ⭐⭐☆☆☆

#### 设计决策

**核心设计原则**:
1. **Evidence-First**: 始终优先高质量证据（RCT > 观察性研究）
2. **PICO-Driven**: 用PICO框架结构化所有研究问题
3. **Actionable Output**: 输出必须包含明确的临床决策建议
4. **Transparent Limitation**: 明确标注证据质量和不确定性

**模板选择理由**:
- **Treatment Analysis**: 最常见的临床决策场景
- **Drug Evaluation**: 新药评估和适应症扩展需求
- **Biomarker Analysis**: 精准医疗时代的核心需求

**未包含的功能**（v1.0范围外）:
- ❌ 自动化Meta-analysis（需额外统计模块）
- ❌ 实时文献监测（需定时任务支持）
- ❌ 多语言文献处理（目前仅英文+中文）

---

## 🎯 Artifacts Feedback Record

### 反馈机制说明

每次使用 Medical Research Analyst 产生的项目输出（Artifacts）都会触发以下5步反馈循环：

```
[Artifacts]
    ↓
1. Categorization（分类归档）
    ↓
2. Insight Extraction（洞察提取）
    ↓
3. Methods Update（方法优化）
    ↓
4. Template Enrichment（模板丰富）
    ↓
5. Knowledge Graph Building（知识图谱）
    ↓
[Skill Evolution] → 下一次执行更强
```

### Artifacts 记录表

| # | 日期 | 项目名称 | 类型 | 疾病领域 | 关键洞察 | 触发的进化 |
|---|------|---------|------|----------|---------|-----------|
| - | - | (暂无) | - | - | - | - |

**示例格式**（待未来填充）:
```
| 001 | 2025-12-10 | HER2+乳腺癌脑转移治疗选择 | Treatment Analysis | Oncology/Breast | T-DXd在CNS疗效优于Tucatinib组合 | 新增"脑转移特定评估维度"到Template 1 |
```

---

## 📈 Evolution Metrics

### 累计使用统计

| Metric | v1.0 | v1.1 | v1.2 | Target |
|--------|------|------|------|--------|
| **总执行次数** | 0 | - | - | 100+ |
| **平均质量评分** | - | - | - | ≥85/100 |
| **用户满意度** | - | - | - | ≥90% |
| **证据质量分布** | - | - | - | 80% Level 1-2 |
| **输出及时性** | - | - | - | <30min |

### 知识增长曲线

**疾病领域覆盖**（目标）:
- v1.0: 肿瘤学（深度）
- v1.1: + 心血管、神经学（中度）
- v1.2: + 内分泌、风湿免疫（基础）
- v2.0: 覆盖主要临床领域

**模板库扩展**（目标）:
- v1.0: 3个通用模板
- v1.1: +2个疾病特定模板（乳腺癌、NSCLC）
- v1.2: +3个分析类型模板（预后分析、诊断评估、治疗序列）
- v2.0: 10+模板覆盖主要应用场景

---

## 🔧 Methods & Templates Updates

### v1.0 初始方法库

**SOP 组件**:
- ✅ Phase 1: Problem Definition
- ✅ Phase 2: Literature Search
- ✅ Phase 3: Critical Appraisal
- ✅ Phase 4: Synthesis & Analysis
- ✅ Phase 5: Structured Output

**Templates 组件**:
- ✅ Template 1: Treatment Option Analysis Report
- ✅ Template 2: Drug/Therapy Evaluation
- ✅ Template 3: Diagnostic/Prognostic Biomarker Analysis

### 待添加方法（Backlog）

**优先级 P0（必需）**:
- [ ] 自动化检索式构建工具
- [ ] 质量评估Checklist（RoB 2.0完整版）
- [ ] NNT/NNH计算器

**优先级 P1（重要）**:
- [ ] Meta-analysis森林图生成
- [ ] 证据-推荐映射矩阵
- [ ] 患者特征匹配算法

**优先级 P2（增强）**:
- [ ] 多语言摘要翻译
- [ ] 自动化表格生成
- [ ] 交互式决策树

---

## 💡 Insights & Learnings

### 从 Artifacts 中学到的模式

**重复出现的研究问题类型**:
- (待积累数据)

**常见决策困境**:
- (待积累数据)

**高频使用的证据来源**:
- (待积累数据)

### 用户反馈摘要

| 反馈日期 | 反馈内容 | 改进措施 | 状态 |
|---------|---------|---------|------|
| - | (暂无) | - | - |

**示例格式**:
```
| 2025-12-15 | "希望增加中医治疗的证据评估" | 计划v1.2增加补充替代医学(CAM)评估模块 | Planned |
```

---

## 🎓 Knowledge Graph Building

### 药物-适应症知识图谱

**目标**: 建立基于真实世界证据的药物-适应症-疗效关系网络

**当前状态**: 未启动（需至少50个artifacts才能构建有意义的图谱）

**设计思路**:
```
[Drug A] --{indication}--> [Disease X]
    |
    +--{efficacy: HR 0.6}
    +--{safety: Grade 3+ AE 15%}
    +--{evidence: RCT, N=500}
    +--{population: EGFR+, 2L}
```

### 临床指南-证据映射

**目标**: 追踪各大临床指南的推荐依据和更新

**当前状态**: 未启动

**设计思路**:
```
NCCN Breast Cancer v5.2024
    → Recommendation: "T-DXd for HER2+ 2L"
        ← Evidence: DESTINY-Breast03 (Level 1)
        ← Updates: 2024-03 (新增脑转移适应症)
```

---

## 🔄 Self-Evolution Trigger Points

### 自动触发进化的条件

| Trigger Condition | Action | Priority |
|-------------------|--------|----------|
| **新增10个同领域Artifacts** | 生成该领域专用模板 | P0 |
| **某类模板使用>20次** | 优化该模板结构 | P0 |
| **质量评分连续5次<75分** | 审查SOP流程 | P1 |
| **新发表重大临床试验** | 更新证据库 | P1 |
| **用户反馈同一问题3次+** | 优先修复 | P0 |

### 定期维护计划

**每月维护**:
- [ ] 审查过去30天的Artifacts
- [ ] 提取至少3个有价值洞察
- [ ] 更新证据数据库（新增重要研究）

**每季度维护**:
- [ ] 评估整体质量指标
- [ ] 规划下一版本功能
- [ ] 清理过时模板/方法

**每年维护**:
- [ ] 大版本更新（v2.0, v3.0...）
- [ ] 重构核心方法论（如有重大突破）
- [ ] 发布年度报告

---

## 📌 Pending Issues & Feature Requests

### Known Limitations (v1.0)

**技术限制**:
1. ⚠️ 无法直接访问付费数据库（Embase, UpToDate）
2. ⚠️ 统计学计算能力有限（复杂Meta-analysis需外部工具）
3. ⚠️ 图表生成依赖手工绘制（未自动化）

**内容限制**:
1. ⚠️ 罕见病证据较少（依赖Case reports）
2. ⚠️ 儿科证据库偏弱（主要覆盖成人）
3. ⚠️ 中医药证据评估标准不完善

**流程限制**:
1. ⚠️ 全文获取依赖人工（无自动PDF下载）
2. ⚠️ 多语言文献处理能力有限
3. ⚠️ 实时性不足（无主动文献监测）

### Feature Roadmap

**v1.1 (计划 2025-12-31)**:
- [ ] 新增2个疾病特定模板（乳腺癌、NSCLC）
- [ ] 优化检索策略模板
- [ ] 增强副作用数据库

**v1.2 (计划 2026-01-31)**:
- [ ] 集成自动化NNT计算
- [ ] 新增预后模型评估模板
- [ ] 支持中医药循证评估

**v2.0 (计划 2026-03-31)**:
- [ ] 引入AI辅助文献筛选
- [ ] 开发交互式决策支持工具
- [ ] 建立完整知识图谱系统

---

## 🔗 Integration & Dependencies

### 依赖的外部资源

**必需资源**:
- PubMed API (免费)
- Cochrane Library (免费检索)
- ClinicalTrials.gov (免费)

**可选资源**:
- Embase (付费，如有机构订阅)
- UpToDate (付费)
- DynaMed (付费)

### 与其他LiYe OS模块的协作

**当前集成**:
- `20 Areas/健康医疗.md` → 输入患者背景信息
- `artifacts/medical_research/` → 输出报告归档

**计划集成**:
- [ ] `Medical Data Analyst` Skill（统计分析协作）
- [ ] `Treatment Plan Designer` Skill（方案设计协作）
- [ ] `Medical Literature Monitor` Skill（文献推送协作）

---

## 📊 Success Metrics Dashboard

### 当前版本 (v1.0) 基线

| KPI | Current | Target | Status |
|-----|---------|--------|--------|
| **执行完成率** | - | ≥95% | 🟡 待数据 |
| **平均质量分** | - | ≥85/100 | 🟡 待数据 |
| **证据等级分布** | - | 80% L1-2 | 🟡 待数据 |
| **用户复用率** | - | ≥70% | 🟡 待数据 |
| **输出及时性** | - | <30min | 🟡 待数据 |

### 长期目标 (v2.0)

- 🎯 成为LiYe OS医疗决策的**首选Skill**
- 🎯 积累**500+ Artifacts**构建完整知识图谱
- 🎯 覆盖**10+临床领域**的深度分析能力
- 🎯 与**3+外部Skill**形成协作网络

---

## 📝 Change Log

### 详细变更记录

#### 2025-12-07 - v1.0 Release
- ✅ 创建完整10模块skill_definition
- ✅ 建立3个核心输出模板
- ✅ 定义5阶段标准SOP
- ✅ 设计artifacts反馈机制
- ✅ 建立质量评分体系

**Files Modified**:
- `skill_definition.md` (新建, 27KB)
- `README.md` (新建, 15KB)
- `evolution_log.md` (新建, 本文件)
- `methods.md` (新建)
- `templates/` (新建目录 + 4个模板)

**Contributors**: LiYe OS System

---

## 💬 Feedback & Discussion

### 反馈渠道

如有任何问题、建议或发现Bug，请在此记录：

**格式**:
```markdown
### [日期] 反馈标题
**Type**: Bug / Feature Request / Improvement
**Priority**: P0 / P1 / P2
**Description**: ...
**Proposed Solution**: ...
```

### 讨论区

(此区域用于记录重要的设计讨论和决策过程)

---

## 📅 Next Review Date

**下次审查日期**: 2025-12-31
**审查内容**:
- [ ] 检查是否有新增Artifacts
- [ ] 评估初步使用反馈
- [ ] 决定v1.1功能范围

---

*This evolution log is a living document and will be continuously updated as the Skill grows.*

**Last Updated**: 2025-12-07
**Next Scheduled Update**: 2025-12-31
**Maintained by**: LiYe OS Evolution Engine
