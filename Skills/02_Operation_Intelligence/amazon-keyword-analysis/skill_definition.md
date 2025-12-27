# 🎯 Amazon Keyword Analysis & Optimization Skill

**Version**: v3.0 (Complete Keyword Lifecycle Management)
**Created**: 2025-12-13
**Updated**: 2025-12-26
**Domain**: 02_Operation_Intelligence
**Status**: ✅ Active

---

## 🔹01. Skill Identity

**Skill Name**: Amazon Keyword Analysis & Optimization / 亚马逊关键词分析与优化

**Core Mission**:
提供**关键词全生命周期管理**，从卖家精灵的市场洞察（TES 模型）到 Search Term Report 的实战优化（5级分层），涵盖关键词挖掘、效能分析、投放优化和持续迭代的完整闭环。

**Key Value Proposition**:
- **双引擎驱动**: TES 模型（市场洞察）+ 5级分层（实战优化）
- **数据驱动**: 一切决策基于数据，而非直觉
- **闭环管理**: 发现 → 投放 → 分析 → 优化 → 复盘
- **实战落地**: 直接产出否定词清单、竞价调整方案、执行 Checklist

**Applicable Scenarios**:
1. **新品上架**: 使用 TES 模型挖掘高潜力关键词
2. **月度复盘**: 使用 Search Term 分析识别垃圾词和明星词
3. **ACOS 优化**: 当 ACOS 超过目标时，深入到关键词级别诊断
4. **广告扩量**: 识别 S级明星词，加大投入
5. **预算节省**: 识别 C/D级垃圾词，立即否定

**NOT Applicable**:
- 品牌词防御（应使用 amazon-brand-protection Skill）
- Listing SEO 优化（应使用 amazon-listing-optimizer Skill）
- 竞品关键词拦截（需结合 amazon-competitive-intelligence Skill）

---

## 🔹02. Capability Model

### Key Competencies

#### A. 关键词挖掘 (Keyword Discovery)
- **数据源**: 卖家精灵 (SellersSprite) Excel 导出
- **核心能力**: 从海量关键词中筛选高潜力词
- **输出**: Top 100 候选关键词清单

#### B. 效能分析 (Efficiency Analysis)
- **核心能力**: 计算 TES 效能分数
- **公式**: `TES = (月搜索量 * 购买率) / (标题密度 + 1)`
- **分层**: Winner (TES > 100) / Potential (TES 10-100) / Broad (TES < 10)

#### C. 实战验证 (Live Performance Analysis)
- **数据源**: Amazon Search Term Report (30天实际投放数据)
- **核心能力**: 识别哪些词真正带来了订单，哪些在烧钱
- **输出**: 关键词5级分层（S/A/B/C/D）

#### D. 关键词级别优化 (Keyword-Level Optimization)
- **核心能力**: 精细化优化到每个关键词
- **方法**: 否定垃圾词、降低观察词竞价、加码明星词
- **预期**: ACOS 降低 6-10%

#### E. 否定词管理 (Negative Keyword Management)
- **核心能力**: 自动生成否定词清单
- **类型**: Exact Negative (精准否定) + Phrase Negative (词组否定)
- **策略**: C级问题词 + D级垃圾词 → 立即否定

---

## 🔹03. Mental Models / Principles

### Core Thinking Frameworks

#### 1. TES 流量效能模型 (Market Discovery)

**概念**:
将关键词视为**投资标的**：
- **收益** = 流量 × 转化率 (购买率)
- **成本** = 竞争度 (标题密度)
- **投资回报** = TES = 收益 / 成本

**应用场景**: 新品上架时选词（从卖家精灵数据）

**示例**:
```
关键词A: 月搜索量 6000, 购买率 12%, 标题密度 150
TES = (6000 * 0.12) / (150 + 1) = 4.77 → Potential 级

关键词B: 月搜索量 500, 购买率 18%, 标题密度 30
TES = (500 * 0.18) / (30 + 1) = 2.90 → Potential 级（但性价比更高）
```

---

#### 2. 关键词5级分层模型 (Live Optimization)

**概念**（基于专家研讨会共识）:
根据实际投放数据（ACOS、销售、转化率），将关键词分为5级：

| 级别 | 标准 | ACOS | 销售 | 策略 | 行动 |
|------|------|------|------|------|------|
| **S级-明星词** | 低 ACOS + 高销售 | < 30% | > $100 | 加大投入 | 竞价 +20% |
| **A级-优秀词** | 中等 ACOS + 稳定销售 | 30-40% | > $50 | 保持现状 | 维持竞价 |
| **B级-观察词** | 偏高 ACOS + 少量销售 | 40-60% | > $20 | 降低成本 | 竞价 -30% |
| **C级-问题词** | 高 ACOS 或低转化 | > 60% | 任意 | 否定 | Negative Keyword |
| **D级-垃圾词** | 有花费但零销售 | 999% | $0 | 立即否定 | Negative Exact |

**应用场景**: 月度复盘时优化（从 Search Term Report）

**关键洞察（二八定律）**:
- 通常 5-10% 的关键词（S级）贡献 40-50% 的销售
- 通常 50-60% 的关键词（C/D级）浪费 30-40% 的预算

---

#### 3. 关键词生命周期模型 (Lifecycle Management)

**概念**:
关键词像产品一样有生命周期，需要动态管理：

```
发现期 (Discovery)
  ↓ TES 模型筛选
投放期 (Launch)
  ↓ 广告活动上线
验证期 (Validation)
  ↓ Search Term 数据积累
分层期 (Tiering)
  ↓ 5级分层评估
优化期 (Optimization)
  ↓ S级加码 / C/D级否定
成熟期 (Maturity)
  ↓ 持续监控
衰退期 (Decline)
  ↓ 季节性下降 / 竞争加剧 → 重新评估
```

**管理节奏**:
- **每7天**: 快速扫描，否定新的 D级垃圾词
- **每14天**: 完整重新分层，调整竞价
- **每30天**: 深度复盘，识别趋势变化

---

### Core Principles

1. **Purchase Rate is King (购买率至上)**:
   - 搜索量再大，不买都没用
   - 优先看购买率 > 8% 的词

2. **Avoid the Crowd (避开拥堵)**:
   - 标题密度 > 300 的词，除非是品牌词，否则不争首页
   - 宁做长尾词的头部，不做大词的尾部

3. **Negative is Positive (否定即收益)**:
   - 否定1个垃圾词 = 节省$10-50/月
   - 100个垃圾词 = 节省$1000-5000/月

4. **S-Tier Focus (明星词至上)**:
   - 80%的收益来自20%的关键词
   - 找到并加码 S级词，比优化100个B级词更有效

---

## 🔹04. Methods & SOPs

### SOP 1: TES 关键词挖掘法（Market Discovery）

**适用场景**: 新品上架、关键词扩展
**数据来源**: 卖家精灵 Excel 导出
**耗时**: 15分钟

#### Phase 1: 数据准备 (5分钟)
**Step 1.1**: 登录卖家精灵 → 关键词挖掘 → 市场分析
**Step 1.2**: 输入核心词 (如 `indoor door mat`)
**Step 1.3**: 导出 Excel 表格 (`KeywordResearch-xxx.xlsx`)

#### Phase 2: AI 分析 (2分钟)
**Step 2.1**: 打开 Claude / LiYe Chat
**Step 2.2**: 使用 Prompt Template（见 Module 07）
**Step 2.3**: 上传 Excel 或复制 Top 100 行数据

#### Phase 3: 策略执行 (10分钟)
**Step 3.1**: 接收 **Master Keyword Sheet**
**Step 3.2**: 执行广告架构:
- **TES > 100**: 放入 "SP-Exact-Winner" 广告组，给足预算
- **TES 10-100**: 放入 "SP-Phrase-Potential" 广告组，中等竞价
- **TES < 10**: 放入 "SP-Broad-Discovery" 广告组，低价捡漏

---

### SOP 2: Search Term 关键词优化法（Live Optimization）

**适用场景**: 月度复盘、ACOS 过高时诊断
**数据来源**: Amazon Search Term Report
**耗时**: 30分钟

#### Phase 1: 数据导出 (5分钟)
**Step 1.1**: 登录 Amazon Seller Central → Advertising → Campaign Manager
**Step 1.2**: 进入 Reports → Create report
**Step 1.3**: 选择 "Search term report"
**Step 1.4**: 日期范围: 近30天
**Step 1.5**: 下载 CSV 文件

**详细教程**: 参见 `tools/export_search_term_tutorial.md`

#### Phase 2: 数据分析 (3分钟)
**Step 2.1**: 将 CSV 文件放到 `examples/` 目录
**Step 2.2**: 运行分析脚本:
```bash
cd tools/
python analyze_search_terms.py
```
**Step 2.3**: 查看生成的报告: `examples/优化方案-YYYYMMDD.md`

#### Phase 3: 执行优化 (20分钟)

**P0 - 立即执行**（15分钟）:
- [ ] 否定 D级垃圾词（花费 > $5，销售 = $0）
  - 复制报告中的 "Negative Exact" 列表
  - 在 Amazon 后台批量添加
  - 预计节省: 通常 $150-300/月

- [ ] 否定 C级问题词（ACOS > 60%）
  - 同上操作
  - 预计节省: 通常 $300-500/月

**P1 - 3天内执行**（5分钟）:
- [ ] 提高 S级明星词竞价 +20%
  - 预计销售增长: 通常 +15-25%

- [ ] 降低 B级观察词竞价 -30%
  - 预计成本节省: 通常 $100-200/月

#### Phase 4: 效果复盘 (7天后)
**Step 4.1**: 重新导出 Search Term Report
**Step 4.2**: 再次运行分析脚本
**Step 4.3**: 对比优化前后:
- ACOS 变化
- 销售额变化
- 花费变化
- ROI 提升

**Step 4.4**: 更新 `evolution_log.md`，记录效果

---

## 🔹05. Execution Protocols

### 前置条件（TES 分析）
- [ ] 已有卖家精灵账号
- [ ] Excel 数据包含: "月搜索量", "购买率", "标题密度"
- [ ] 至少50个候选关键词

### 前置条件（Search Term 优化）
- [ ] 广告活动运行 ≥ 30 天
- [ ] 有足够的数据样本（≥ 100 个搜索词）
- [ ] Search Term Report 导出成功

### Quality Standards
- [ ] **数据新鲜度**: 使用近30天数据
- [ ] **样本充足**: 至少覆盖 50 个关键词
- [ ] **计算准确**: TES 和分层逻辑无误
- [ ] **可执行性**: 输出的建议可直接执行

### Success Criteria
- **TES 分析**: 识别出 ≥ 10 个 Winner/Potential 级关键词
- **Search Term 优化**:
  - ACOS 降低 ≥ 6%
  - 月花费节省 ≥ $300
  - 月销售增长 ≥ $200
  - 执行耗时 ≤ 30分钟

---

## 🔹06. Output Structure

### Template 1: Timo Master Keyword Sheet (TES 模型输出)

| 关键词 | 月搜索量 | 购买率 | 标题密度 | **TES效能分** | 分层 | 策略建议 | 广告组 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `washable door mat indoor` | 6721 | 15.9% | 150 | **7.0** | Potential | 🔥 Phrase Match | SP-Phrase-Potential |
| `indoor door mat non slip` | 5430 | 12.3% | 120 | **5.5** | Potential | ✅ Phrase Match | SP-Phrase-Potential |
| `doormat` | 50000 | 2.0% | 500 | **2.0** | Broad | ⚠️ Low Bid | SP-Broad-Discovery |

---

### Template 2: 关键词优化方案（Search Term 分析输出）

详见 `templates/optimization_plan_template.md`

**核心章节**:
1. **关键词健康度诊断**: 5级分层统计
2. **优化前后对比**: ACOS/销售/花费变化
3. **否定关键词清单**: 可直接复制粘贴
4. **明星词加码清单**: S级词列表 + 建议竞价
5. **执行 Checklist**: P0/P1/P2 分级任务

---

### Template 3: 否定关键词清单（Copy-Paste Ready）

详见 `templates/negative_keywords_template.md`

**格式**:
```
Negative Exact（精准否定）:
cheap door mat, free shipping door mat, diy door mat, tutorial door mat, ...

Negative Phrase（词组否定）:
free, cheap, tutorial, diy, clearance, wholesale, rental, bulk
```

---

## 🔹07. Templates & Prompts

### Prompt 1: TES 关键词分析（For Claude）

```markdown
**Role**: You are an Amazon SEO Expert specialized in **Timo Store Operations**.

**Task**: Analyze the provided SellersSprite Keyword Data using the **TES Model**.

**Input Data**:
[Paste Excel data here or upload file]

**Logic (TES Model)**:
1. **Calculate TES**: `TES = (月搜索量 * 购买率%) / (标题密度 + 1)`
   - 如果标题密度缺失，assume 100

2. **Tiering Strategy**:
   - **Winner Tier**: TES > 100 OR 购买率 > 10%
     → Action: "Exact Match, High Bid"
   - **Potential Tier**: TES 10-100 AND 购买率 > 5%
     → Action: "Phrase Match, Medium Bid"
   - **Broad Tier**: TES < 10 OR 购买率 < 5%
     → Action: "Broad Match, Low Bid for Discovery"

**Output**:
Generate **Timo Master Keyword Sheet** in table format:
| Keyword | Search Vol | Purchase Rate | Density | TES Score | Tier | Recommended Ad Group |
```

---

### Prompt 2: Search Term 优化分析（For Claude）

```markdown
**Role**: Amazon PPC 优化专家

**Task**: 分析 Search Term Report，识别垃圾词和明星词

**Input Data**:
[Attach Search Term Report CSV or paste key data]

**Method**: 5级分层标准
- S级: ACOS < 30%, 销售 > $100 → 竞价 +20%
- A级: ACOS 30-40%, 销售 > $50 → 保持
- B级: ACOS 40-60%, 销售 > $20 → 竞价 -30%
- C级: ACOS > 60% OR CVR < 2% → 否定
- D级: 花费 > $5, 销售 = $0 → 立即否定

**Output**:
1. 关键词5级分层统计表
2. 否定词清单（Exact + Phrase）
3. 明星词加码清单（S级）
4. 预期优化效果（ACOS 前后对比）
5. 执行 Checklist（P0/P1/P2）
```

---

## 🔹08. Tools Access

| Tool | Type | Purpose | Reliability | Cost |
|------|------|---------|-------------|------|
| **卖家精灵 (SellersSprite)** | 数据平台 | 市场洞察、TES 模型数据源 | ⭐⭐⭐⭐⭐ | Paid |
| **Search Term Report** | Amazon 原生 | 实际投放效果数据 | ⭐⭐⭐⭐⭐ | Free |
| **analyze_search_terms.py** | Python 脚本 | 自动化5级分层分析 | ⭐⭐⭐⭐⭐ | Free |
| **飞轮 (Flywheel)** | 第三方工具 | 验证 ACOS 和投放效果 | ⭐⭐⭐⭐ | Paid |
| **Claude Code** | AI 助手 | 数据处理、TES 运算、策略生成 | ⭐⭐⭐⭐⭐ | - |

**Tool Location**:
- `tools/analyze_search_terms.py`: Search Term 自动化分析脚本
- `tools/export_search_term_tutorial.md`: 导出教程

---

## 🔹09. Evaluation & Scoring

### Performance Metrics

**TES 分析质量评分**:
- **数据完整性** (30分): 是否包含所有必需字段
- **TES 计算准确性** (30分): 公式是否正确
- **分层合理性** (20分): Winner/Potential/Broad 分布是否合理
- **可执行性** (20分): 输出是否可直接用于广告投放

**Search Term 优化效果评分**:
- **ACOS 改善** (40分): 优化后 ACOS 降低 ≥ 6% = 满分
- **销售增长** (30分): 销售增长 ≥ 15% = 满分
- **ROI 提升** (20分): 投入效率提升 ≥ 20% = 满分
- **执行效率** (10分): 完成优化耗时 ≤ 30分钟 = 满分

### Benchmarks

**优秀案例**（Based on TIMO-US 2025-12-25）:
- ACOS 降低: 7.36% ✅
- 否定词数量: 130 个 ✅
- 明星词数量: 12 个 ✅
- 预期销售增长: $336.84/月 ✅
- 预期花费节省: $486.04/月 ✅

---

## 🔹10. Feedback / Evolution Loop

### Evolution Trigger
- **TES 模型**:
  - 卖家精灵数据字段变化
  - 发现 TES 公式在特定品类失效
  - 有更优的效能计算方法

- **Search Term 优化**:
  - 7天后复盘发现效果不达标
  - Amazon Search Term Report 格式变化
  - 5级分层标准需要调整

### Changelog

**v3.0** (2025-12-26):
- ✅ 整合 Search Term 分析能力（5级分层模型）
- ✅ 新增 SOP 2: Search Term 关键词优化法
- ✅ 新增工具: `analyze_search_terms.py`
- ✅ 新增模板: 优化方案、否定词清单
- ✅ 扩展思维模型: 二八定律、关键词生命周期
- ✅ 首个验证案例: TIMO-US（ACOS 降低 7.36%）

**v2.0** (2025-12-13):
- ✅ 升级为 Timo 定制版
- ✅ 引入 TES 模型
- ✅ 整合卖家精灵工作流

**v1.0** (2025-12-13):
- ✅ 初始通用版本（Cerebro-based）

### Related Skills
- `amazon-operations-crew`: CrewAI 智能体，可调用本 Skill 的分析结果自动执行
- `amazon-listing-optimizer`: Listing SEO 优化（关键词埋入）
- `amazon-brand-protection`: 品牌词防御策略

---

**Next Evolution** (待验证):
- [ ] 整合 DuckDB 数据湖（自动读取历史数据）
- [ ] 开发 Streamlit Dashboard（可视化关键词表现）
- [ ] 自动化执行（调用 Amazon Ads API 批量添加否定词）

---

*This Skill is part of LiYe OS - A self-evolving personal AI capability system.*
