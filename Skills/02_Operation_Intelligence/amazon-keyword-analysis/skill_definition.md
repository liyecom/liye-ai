# 🎯 Amazon Keyword Analysis Skill (亚马逊关键词分析)

**Version**: v2.0 (Timo Custom Edition)
**Created**: 2025-12-13
**Domain**: 02_Operation_Intelligence
**Status**: ✅ Active

---

## 🔹01. Skill Identity

**Skill Name**: Amazon Keyword Analysis / 亚马逊关键词分析 (Timo标准版)

**Core Mission**:
基于 **卖家精灵 (SellersSprite)** 的市场数据，利用 **TES效能模型**，精准筛选出高流量、高转化且竞争适度的关键词，指导 Timo 店铺的 Listing 优化与 PPC 投放。

**Key Value Proposition**:
- **效能优先**: 拒绝盲目追大词，只投产出比 (ROI) 最高的词。
- **数据驱动**: 一切决策基于 TES 分数，而非直觉。
- **实战落地**: 直接产出 PPC 广告架构表。

**Applicable Scenarios**:
1.  **月度关键词复盘**: 每月导出一次数据进行诊断。
2.  **新品上架**: 确定 Title 和 Search Terms 的核心词。
3.  **PPC 优化**: 筛选出 "High Value, Low Competition" 的蓝海词。

---

## 🔹02. Capability Model

### Key Competencies

#### A. 数据采集 (Data Collection)
- **核心能力**: 从卖家精灵/飞轮导出 Excel 原始数据。
- **标准**: 必须包含 "月搜索量", "购买率", "标题密度", "SPR"。

#### B. 效能分析 (Efficiency Analysis)
- **核心能力**: 计算 TES 分数。
- **公式**: `TES = (月搜索量 * 购买率) / (标题密度 + 1)`

#### C. 策略分层 (Strategic Tiering)
- **红海区**: 高流量但低 TES -> Broad 捡漏。
- **蓝海区**: 高 TES 分数 -> Exact 强打。
- **捡漏区**: 长尾词 -> Low Hanging Fruit 策略。

---

## 🔹03. Mental Models / Principles

### Core Thinking Framework: TES Model (流量效能模型)

**Concept**:
在这个模型中，我们将关键词视为 **"投资标的"**。
*   **收益** = 流量 x 转化率 (购买率)
*   **成本** = 竞争度 (标题密度)

我们只投资 **收益/成本比 (TES)** 最高的标的。

### Core Principles

1.  **Purchase Rate is King (购买率至上)**: 搜索量再大，不买都没用。我们优先看购买率 > 8% 的词。
2.  **Avoid the Crowd (避开拥堵)**: 标题密度 > 300 的词，除非是品牌词，否则不争首页。
3.  **Washable Strategy (可洗策略)**: 对于 Timo 地垫，"功能词" (Washable/Non-slip) 的价值往往高于"品类词" (Doormat)。

---

## 🔹04. Methods & SOPs

### Standard Operating Procedure: 卖家精灵 TES 分析法

#### Phase 1: 数据准备 (Data Prep)
**Duration**: 5分钟

**Step 1.1**: 登录卖家精灵 -> 关键词挖掘 -> 市场分析。
**Step 1.2**: 输入核心词 (如 `indoor door mat`)。
**Step 1.3**: 导出 Excel 表格 (`KeywordResearch-xxx.xlsx`)。

#### Phase 2: AI 分析 (AI Analysis)
**Duration**: 2分钟

**Step 2.1**: 打开 Claude / LiYe Chat。
**Step 2.2**: 复制 Prompt (见下方 Section 07)。
**Step 2.3**: 复制/上传 Excel 文件中的 Top 100 行数据给 Claude。

#### Phase 3: 策略输出 (Strategy Action)
**Duration**: 10分钟

**Step 3.1**: 接收 Claude 生成的 **Master Keyword Sheet**。
**Step 3.2**: 执行广告调整：
- **TES > 100 的词**: 放入 "SP-Exact-Winner" 广告组，给足预算。
- **TES < 10 的大词**: 放入 "SP-Broad-Discovery" 广告组，低价跑。

---

## 🔹05. Execution Protocols

### Quality Standards
- [ ] **数据源**: 必须使用最新(近30天)的卖家精灵数据。
- [ ] **完整性**: 分析必须覆盖至少 50 个核心词。
- [ ] **准确性**: TES 计算逻辑无误。

---

## 🔹06. Output Structure

### Template: Timo Master Keyword Sheet

| 关键词 | 月搜索量 | 购买率 | 标题密度 | **TES效能分** | 策略建议 | 广告组 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `indoor door mat washable` | 6721 | 15.9% | 150 | **7.0** | 🔥 重仓 | Exact-Winner |
| `doormat` | 50000 | 2.0% | 500 | **2.0** | ⚠️ 观察 | Broad-Discovery |
| ... | ... | ... | ... | ... | ... | ... |

---

## 🔹07. Templates & Prompts

### Default Activation Prompt (For Claude)

```markdown
**Role**: You are an Amazon SEO Expert specialized in **Timo Store Operations**.

**Task**: Analyze the provided SellersSprite Keyword Data using the **TES Model**.

**Input Data**:
- **Raw Data**: [I will paste the Excel content here]

**Logic (TES Model)**:
1.  **Calculate TES**: `Recall: (Monthly Search Volume * Purchase Rate %) / (Title Density + 1)`
    *   *Note: Normalize Title Density if it's missing (assume 100).*

2.  **Tiering Strategy**:
    *   **Tier 1 (Winner)**: TES Score is Top 10% OR Purchase Rate > 10%. -> Action: "Exact Match, High Bid".
    *   **Tier 2 (Potential)**: Purchase Rate > 5% but Density is high. -> Action: "Phrase Match".
    *   **Tier 3 (Broad)**: High Volume, Low Purchase Rate. -> Action: "Broad Match, Low Bid".

**Output**:
Please generate the **Timo Master Keyword Sheet** (Table format) containing:
Keyword | Search Vol | Purchase Rate | Density | TES Score | Tier | Recommended Ad Group
```

---

## 🔹08. Tools Access

| Tool | Reliability | Purpose | Cost |
|------|-------------|---------|------|
| **卖家精灵导出 (Excel)** | ⭐⭐⭐⭐⭐ | 核心数据源 (包含购买率等关键指标) | Paid |
| **飞轮数据 (Excel)** | ⭐⭐⭐⭐⭐ | 验证实际投放效果 (ACOS) | Paid |
| **Claude (LiYe)** | ⭐⭐⭐⭐⭐ | 数据处理与 TES 运算 | - |

---

## 🔹10. Feedback / Evolution Loop

### Evolution Trigger
- 当卖家精灵的数据字段发生变化时 (如不再提供"标题密度")。
- 当 Timo 店铺品类扩展到非地垫类目时 (需验证 TES 模型是否通用)。

### Changelog
- v2.0 (2025-12-13): 升级为 Timo 定制版，引入 TES 模型和卖家精灵工作流。
- v1.0 (2025-12-13): 初始通用版本 (Cerebro)。

---

*This Skill is part of LiYe OS - A self-evolving personal AI capability system.*
