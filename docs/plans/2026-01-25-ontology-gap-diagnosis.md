# 本体缺失全面诊断报告（优化版）

> **版本**: v1.1
> **日期**: 2026-01-25
> **状态**: 待批准
> **范围**: LiYe OS + Amazon Growth Engine
> **原则**: 如非必要，勿增实体（不引入新平台/新数据库/新服务；优先 Contracts + Rules + Evidence Schema）

---

## 1. 执行摘要（Executive Summary）

本报告确认：LiYe OS 与 Amazon Growth Engine 目前具备强"计算+规则+治理"能力，但缺少"可解释推理（Why）所需的业务知识结构"，导致系统处于：

- ✅ 能测量（What）
- ✅ 能触发规则（Rule）
- ✅ 能给判决（Verdict）
- ❌ 不能稳定解释原因（Why）
- ❌ 不能输出可审计的因果链（Causal Chain）
- ❌ 不能做受控反事实（What-if）

### 三维诊断结论（保守但硬核）

| 维度 | 核心缺失 | 直接后果 | 严重程度 |
|------|---------|---------|----------|
| **因果推理** | 缺少"根因候选集 + 证据结构 + 反事实框架" | 只能告警/建议，不能诊断 | 🔴 高 |
| **概念关系** | 缺少"语义关系图 + 关系类型（affects/determines/requires）" | 规则不可解释、难复用 | 🔴 高 |
| **跨域映射** | 缺少"上位概念 + 域实例化 + 语义漂移显式化" | 扩展慢、知识无法迁移 | 🟡 中 |

### 核心洞察（v1.1 更准确表述）

> 当前系统不是"没有推理"，而是"推理缺少业务知识结构化表达"。
> 你已经有规则引擎与治理系统，但缺少"规则为什么成立"的可机器理解表达，从而无法形成高质量解释链与复用。

---

## 2. v1.0 报告的 3 个关键改进点（纠偏）

### 2.1 "语义层陷阱"表述过猛，需要校准

v1.0 将现状描述为"语义层思维：阈值→告警"。这对一部分模块是对的，但Amazon Growth Engine 实际已经有 Decision IDs + 策略分类，LiYe OS 有 Gate/Verdict/Trace。

**更准确的结论是**：

> 你们不是语义层 = 指标堆；你们是规则层 = 判定堆。
> 但规则层缺少业务本体化表达，所以"可解释性、可复用性、可迁移性"不足。

### 2.2 "本体 = 图谱"不是必须条件

v1.0 多次暗示"需要图谱型"。这会引导团队走向"新增复杂系统"。

**v1.1 强制改成**：

> 本体能力 ≠ 必须引入图数据库/OWL Reasoner。
> 你要的是 Ontology-lite（概念+关系+规则）作为 Contracts 文件存在，由现有 runtime 读取并生成解释链。

### 2.3 "跨域映射"现在不是 P0

跨域上位概念当然战略价值高，但你当前最迫切的是：

- **Amazon Growth Engine**：因果诊断 + 证据链 + 动作建议闭环
- **LiYe OS**：Verdict 的影响分析 + 反事实建议 + 可回放

所以 v1.1 的执行顺序是：

```
P0：因果推理 + 证据结构（同域内先闭环）
P1：概念关系（让规则可解释与可复用）
P2：跨域上位概念（作为规模化与迁移能力）
```

---

## 3. 维度一：因果推理缺失（Why / What-if）

### 3.1 问题定义（工程化）

因果推理并不等于"因果发现"。在你这里它至少要满足：

1. **根因候选集（Cause Candidates）**
2. **证据结构（Evidence Schema）**
3. **反事实建议（Counterfactual Fix）**
4. **可审计回放（Replayable Explanation）**

### 3.2 Amazon Growth Engine：告警有了，但缺少"诊断框架"

#### 典型断点：ACoS Too High

**现状**：触发 `ACOS_TOO_HIGH`
**缺失**：根因候选集 + 判别条件 + 建议动作 + 预估影响

**v1.1 标准答案应变成**：

```yaml
Observation: ACOS_TOO_HIGH
CauseCandidates:
  - NEW_PRODUCT_PHASE
  - LISTING_LOW_QUALITY
  - QUERY_MISMATCH
  - BID_TOO_HIGH
  - OFFER_WEAKNESS
EvidenceRequirements:
  - NEW_PRODUCT_PHASE: [days_since_launch, review_count]
  - LISTING_LOW_QUALITY: [ctr, main_image_ctr, sessions, unit_session_pct]
  - QUERY_MISMATCH: [search_term_relevance, wasted_spend_ratio]
  - BID_TOO_HIGH: [cpc_vs_category, top_of_search_share]
  - OFFER_WEAKNESS: [rating, price_percentile, competitor_gap]
CounterfactualFixes:
  - reduce_bid: expected_acos_delta, expected_sales_delta, risk_level
  - add_negative_keywords: expected_spend_delta, risk_level
  - improve_listing_assets: expected_ctr_delta, expected_cvr_delta
```

- ✅ 注意：这仍然是 YAML 文件 + runtime 解释生成
- ❌ 不需要图数据库、不需要新服务

### 3.3 LiYe OS：Verdict 有了，但缺少"影响分析与可修复路径"

你现在的 Verdict 结构只记录"违反了什么"，缺少"为什么这是问题、怎么修复"。

**v1.1 要求 Verdict 至少具备**：

- `violated_constraint`：违反的约束
- `impact_analysis`：影响（财务/合规/操作）
- `counterfactual`：如何改才能通过
- `recommendations`：可执行修复

---

## 4. 维度二：概念关系缺失（从"硬编码规则"到"可解释策略"）

### 4.1 Amazon Growth Engine：KeywordBucketer 属于"隐式知识"

`rank 1-7 => HARVEST` 这种逻辑，本质是"知识"，不是"代码常量"。

**缺失不是算法，而是 rationale（理由）+ 可变参数（可按类目调整）**：

```yaml
KeywordLifecycle:
  HARVEST:
    definition: "已有优势排名，目标转为利润最大化"
    rank_range:
      default: [1,7]
      high_competition: [1,5]
      low_competition: [1,10]
    rationale:
      - "首页顶部获取大部分点击，继续投入边际效益递减"
    determines:
      BidStrategy:
        primary_goal: profit_optimization
        acos_target: "category_avg_acos * 0.7"
```

**收益**：
- 规则解释自动生成（Why）
- 参数可配置（可随类目变化）
- 决策可审计（rationale 版本化）

### 4.2 LiYe OS：术语表有了，但缺少"协作关系"

LiYe OS 不需要大而全本体，只需要让系统能回答：

- Agent 需要哪些 Skill 才能执行任务？
- 某个 Action 属于哪类风险？对应治理策略是什么？
- Crew 编排是否类型匹配？

这是"能力本体（Capability Ontology-lite）"，依然是 Contracts 文件。

---

## 5. 维度三：跨域映射缺失（暂列 P1/P2）

### 5.1 Amazon Growth 内部的语义漂移（需要立即治理）

比如"转化率"多义性：CVR、Unit Session %、Purchase Rate……
这不是哲学问题，是会造成 **指标误用 → 决策错误** 的工程风险。

**v1.1 结论**：
- ✅ 先做 术语显式化（disambiguation）
- ❌ 不立刻做跨 LiYe OS 全域的上位 Customer 抽象（那是战略工程）

---

## 6. 统一根因：系统缺的是"可机器读取的业务解释资产"

两个系统的共同短板不是"缺规则"，而是缺：

1. **规则为什么成立**（rationale）
2. **规则需要哪些证据**（evidence requirements）
3. **规则可怎样修复**（counterfactual fixes）
4. **规则如何被审计回放**（traceable explanation）

这四项合在一起，我称为：

> **Reasoning Assets（推理资产）**
> 以 Contracts 文件存在，不新增平台。

---

## 7. 解决方案（v1.1）：Ontology-lite Overlay（零新增实体版）

### 7.1 方案定义

不新增"本体层服务"，只新增 3 类文件资产，挂到现有 Contracts 体系：

1. **Concept Dictionary**（概念词典）
2. **Relation Map**（关系映射）
3. **Reasoning Playbooks**（推理剧本：候选根因+证据+反事实）

它们的输出不是"知识图谱"，而是：

- 解释链（Why）
- 修复路径（How to fix）
- 风险等级（Risk）
- 可回放审计（Replay）

### 7.2 最小落地范围（P0：30 天内闭环）

只做 2 个场景闭环：

1. **ACoS Too High 的根因诊断闭环**（Amazon Growth Engine）
2. **Governance BLOCK 的修复建议闭环**（LiYe OS）

这两个场景一旦跑通，体系就成立。

---

## 8. P0 交付物（严格遵循"勿增实体"）

### 8.1 文件结构（建议）

```
docs/contracts/
  reasoning/
    amazon-growth/
      observations/
        ACOS_TOO_HIGH.yaml
        CVR_TOO_LOW.yaml
      concepts.yaml
      relations.yaml
    governance/
      verdict_enrichment.yaml
      concepts.yaml
      relations.yaml

src/
  domain/amazon-growth/runtime/
    explanation/
      build_explanation.mjs|py
  governance/
    verdict_enricher.mjs
```

- ✅ 没有新数据库
- ✅ 没有新服务
- ✅ 只是读取 contracts 生成 explanation

### 8.2 验收标准（DoD）

**输入一个 ACOS_TOO_HIGH observation**
输出必须包含：

- Top-3 root causes（带证据字段）
- 每个 root cause 的 rationale
- 修复动作建议（带 risk_level）
- 反事实（if reduce bid by 10% then …）

**输入一个 Governance BLOCK**
输出必须包含：

- impact_analysis
- counterfactual suggestions（至少 2 条）
- recommendation（可执行）

---

## 9. 风险与控制（防止"本体变成新宗教"）

### 9.1 必须禁止的三件事

1. ❌ 引入图数据库（Neo4j）作为 P0
2. ❌ 引入 OWL reasoner 作为 P0
3. ❌ 大规模跨域上位概念抽象作为 P0

### 9.2 必须坚持的三件事

1. ✅ Contracts 版本化 + CI Gate
2. ✅ 解释链必须可回放（trace → evidence → rule version）
3. ✅ 动作必须受 Write Capability Matrix 约束

---

## 10. 建议决策（给你直接拍板用）

### ✅ 批准项（建议批准）

- 批准 **Ontology-lite Overlay** 作为"推理资产模块"，不新增实体系统
- P0 只做 **2 个闭环场景**（ACoS、BLOCK 修复建议）

### ❌ 不批准项（建议不做）

- 不批准"新建 Business Ontology & Reasoning Layer 服务"
- 不批准 "图谱平台化" 与 "跨域上位概念大一统"

---

## 11. 下一步（批准后立刻执行的任务拆解）

1. 定义 **Evidence Schema v0.1**（必需字段清单）
2. 写 **ACOS_TOO_HIGH.yaml** 推理剧本（候选根因/证据/动作/反事实）
3. **Verdict Enricher**：把 BLOCK 输出升级为可修复建议
4. 加 **CI Gate**：Reasoning Assets 必须有单测样例（snapshot tests）
5. 接入增长作战室/驾驶舱：解释链可视化（先文本即可）

---

**报告版本**: v1.2
**优化完成时间**: 2026-01-25

---

## 12. P1 Done（执行记录）

> **完成日期**: 2026-01-25
> **Tag**: `reasoning-assets-p1`
> **PR**: [#77](https://github.com/liyecom/liye-ai/pull/77)

### 12.1 交付成果

#### Playbooks (12 total)

| Phase | Observation | Causes | Status |
|-------|-------------|--------|--------|
| P0 | `ACOS_TOO_HIGH` | 5 | ✅ |
| P0 | `BLOCK_BUDGET_EXCEED` | 3 | ✅ |
| P1 | `SPEND_TOO_HIGH_WITH_LOW_SALES` | 4 | ✅ |
| P1 | `SEARCH_TERM_WASTE_HIGH` | 4 | ✅ |
| P1 | `CTR_TOO_LOW` | 5 | ✅ |
| P1 | `CVR_TOO_LOW` | 5 | ✅ |
| P1 | `BUDGET_EXHAUST_EARLY` | 4 | ✅ |
| P1 | `IMPRESSIONS_TOO_LOW` | 5 | ✅ |
| P1 | `RANKING_DECLINING` | 5 | ✅ |
| P1 | `COMPETITOR_PRICE_UNDERCUT` | 5 | ✅ |

#### Assets Updated

| Asset | Version | Changes |
|-------|---------|---------|
| `concepts.yaml` | v0.2 | +10 concepts (ORGANIC_RANK, WASTED_SPEND_RATIO, BUDGET_PACING, etc.) |
| `evidence_fetch_map.yaml` | v0.2 | +50 evidence fields with sources |
| `explain_observation.mjs` | - | Register 8 P1 observations |

#### Test Coverage

```
Gate v0.2:        12 playbooks validated  ✅
ACOS tests:        5 passed               ✅
explain tests:     6 passed               ✅
P1 snapshot tests: 56 passed              ✅
---
Total:            67 tests passing
```

### 12.2 P1 约束遵守确认

- ❌ 无新增服务/数据库/平台
- ❌ 无图数据库/OWL reasoner
- ❌ 无 GDP/T1 Truth schema 变更
- ✅ 只新增 Contracts (YAML) + snapshot tests
- ✅ 所有推理可审计回放：`rule_version` + `evidence_ref`
- ✅ 缺失 evidence 严格降级：`confidence=low`

### 12.3 P1 → P2 过渡

P1 已验证 Ontology-lite Overlay 方案可行，P2 将聚焦：

1. **P2.1**: 解释展示对象 (`executive_summary`, `next_best_actions`, `confidence_overall`)
2. **P2.2**: 效果验证事件 (`ActionOutcomeEvent`)
3. **P2.3**: Playbook 评估器 (`playbook_evaluator.mjs`)
4. **P2.4**: 安全执行模式 (`execution_mode`, `write_guardrail_ref`)

---

## 13. P4 Done（执行记录）

> **完成日期**: 2026-01-29
> **Tag**: `reasoning-assets-p4`
> **PR**: [#82](https://github.com/liyecom/liye-ai/pull/82)

### 13.1 交付成果

#### Threshold Profiles v0.2

| Profile | wasted_spend_ratio | clicks | spend | orders | 用途 |
|---------|-------------------|--------|-------|--------|------|
| **conservative** | ≥0.35 | ≥25 | ≥$20 | =0 | 高门槛，低误判风险 |
| **balanced** (默认) | ≥0.30 | ≥20 | ≥$15 | =0 | 推荐默认，覆盖率与准确率平衡 |
| **aggressive** | ≥0.25 | ≥15 | ≥$10 | =0 | 低门槛，高覆盖，需监控误判 |

#### Calibration Fixtures (12 samples)

| Group | 数量 | 用途 | 期望状态 |
|-------|------|------|----------|
| **A** | 4 | 应 auto-execute | AUTO_EXECUTED / DRY_RUN |
| **B** | 4 | 应降级 (eligibility fail) | SUGGEST_ONLY |
| **C** | 4 | 应阻断/拒绝 | BLOCKED / DENY |

#### Assets

| Asset | Path | Description |
|-------|------|-------------|
| Action Playbook v0.2 | `docs/contracts/reasoning/amazon-growth/actions/ADD_NEGATIVE_KEYWORDS.yaml` | 新增 profiles + active_profile |
| Calibration Samples | `tests/fixtures/reasoning/p4/calibration_samples.json` | 12 个确定性样本 |
| Evaluator | `src/reasoning/auto_eligibility_evaluator.mjs` | 生成校准报告 |
| Test Matrix | `tests/execution/test_p4_threshold_calibration_matrix.mjs` | 17 个测试 |
| Calibration Report | `docs/reasoning/reports/P4_AUTO_ELIGIBILITY_CALIBRATION_2026-01-29.md` | 可复现报告 |

### 13.2 校准结论

| Profile | A 组 Eligible | B 组 Degrade | 风险评估 |
|---------|--------------|--------------|----------|
| Conservative | 3/4 (75%) | 4/4 ✅ | 太严格，漏边界 case |
| **Balanced** | **4/4 (100%)** | **4/4 ✅** | **推荐默认** |
| Aggressive | 4/4 (100%) | 3/4 ⚠️ | **B 组出现误判风险** |

**结论**: `balanced` 作为 `active_profile` 默认值

### 13.3 P4 约束遵守确认

- ❌ 无新增服务/数据库/队列
- ❌ 无图数据库/OWL
- ❌ 无 GDP/T1 Truth schema 变更
- ✅ 只新增 Contracts + Fixtures + Evaluator
- ✅ 所有样本确定性输入 → 确定性输出
- ✅ Kill switch 默认关闭，演练时才临时开启

---

## 14. P5-A Done（执行记录）

> **完成日期**: 2026-01-29
> **Tag**: `reasoning-assets-p5`
> **PR**: [#84](https://github.com/liyecom/liye-ai/pull/84)

### 14.1 交付成果

#### Demo Runner

| 命令 | 描述 |
|------|------|
| `pnpm demo:reasoning` | 一键运行，默认 balanced profile |
| `pnpm demo:reasoning --profile=conservative` | 指定 profile |
| `pnpm demo:reasoning --cases=A1_boundary_eligible,B1_spend_below` | 指定 cases |

#### 输出资产

| 文件 | 描述 |
|------|------|
| `demo_summary.json` | 机器可读执行摘要 |
| `DEMO_REPORT_<date>.md` | 人可读 6 板块报告 |
| `EVALUATOR_REPORT_<date>.md` | 链接的评估器报告 |

#### Demo 报告 6 板块

1. **What it does** - 可控自动化 + 审计价值说明
2. **Inputs** - Profile/Cases/阈值配置
3. **Results table** - 每个 case 的状态/原因/候选词/回滚/事件
4. **Deep dives** - 1 个 DRY_RUN + 1 个 SUGGEST_ONLY 详细流程
5. **Safety proof** - `force_dry_run=true`, `writes_attempted=0`
6. **Next steps** - Expansion criteria 清单

### 14.2 强制安全保障

| 检查项 | 保障 |
|--------|------|
| `force_dry_run` | `true` (硬编码，无法覆盖) |
| `writes_attempted` | `0` (测试 + CI 验证) |
| Real API calls | 无 - 数据来自合成 fixtures |
| `demo_mode` | 绕过 kill switch，但保持 force_dry_run |

### 14.3 CI 集成

| 触发方式 | 配置 |
|----------|------|
| 手动触发 | `.github/workflows/reasoning-demo.yml` (workflow_dispatch) |
| PR Label | 添加 `demo` label |
| Artifact | 上传并保留 30 天 |

### 14.4 测试覆盖

```
Demo Runner Tests:        7 tests passing  ✅
- FORCE_DRY_RUN constant
- Load samples structure
- Execute single case
- ZERO WRITES verification
- Deep dive case selection
- Snapshot stability
- Full demo run
```

### 14.5 资产治理

| 规则 | 实现 |
|------|------|
| 示例输出 | `docs/reasoning/demo_runs/2026-01-29/` (已提交) |
| 本地输出 | `.gitignore` 排除新运行输出 |
| 使用规范 | `docs/reasoning/README.md` (演示使用指南) |

### 14.6 P5-A 约束遵守确认

- ❌ 无新增服务/数据库/队列
- ❌ 无 GDP schema 变更
- ✅ Demo 默认 dry-run（`FORCE_DRY_RUN=true` 硬编码）
- ✅ Demo 可复现（固定 fixtures 输入）
- ✅ Demo 产出"可对外展示"报告（无敏感字段）
- ✅ CI workflow 可手动触发并产出 artifact

---

## 15. P6-A Done（执行记录）

> **完成日期**: 2026-01-31
> **Tag**: `reasoning-assets-p6a`
> **PR**: [#87](https://github.com/liyecom/liye-ai/pull/87)

### 15.1 交付成果

#### 三层只读锁机制

| Layer | 机制 | 控制点 |
|-------|------|--------|
| Layer 1 | OAuth Scope | `ADS_OAUTH_MODE=readonly` |
| Layer 2 | Config | `execution_flags.yaml: readonly=true` |
| Layer 3 | Runtime | `DENY_READONLY_ENV=true` |

#### 覆盖率指标体系 (7-Metric Output)

| # | 指标 | P6-A 值 | 说明 |
|---|------|---------|------|
| 1 | declared_total | 141 | evidence_fetch_map 全部字段 |
| 2 | declared_t1 | 35 | T1_TRUTH 字段（非 unavailable） |
| 3 | reachable_t1 | 35 | 可查询的 T1 字段 |
| 4 | coverage_t1 | 100% | reachable_t1 / declared_t1 |
| 5 | required_by_active_playbooks | 31 | 活跃 playbook 所需字段 |
| 6 | reachable_required | 31 | 所需字段中可达的 |
| 7 | **coverage_required** | **100%** | **Gate 指标** (≥70%) |

#### CI Gate

- `reasoning_assets_gate.mjs` v0.3：强制 `coverage_required >= 70%`
- 2 个 P6-A snapshot tests：验证 ACOS_TOO_HIGH 和 SEARCH_TERM_WASTE_HIGH 覆盖率

### 15.2 P6-A 约束遵守确认

- ❌ 无新增服务/数据库
- ❌ 无 GDP schema 变更
- ✅ 三层只读锁 (ZERO WRITES)
- ✅ 覆盖率指标可审计
- ✅ active_playbooks.yaml 确定性来源

---

## 16. P6-B Done（执行记录）

> **完成日期**: 2026-01-31
> **Tag**: `reasoning-assets-p6b`
> **PR**: [#88](https://github.com/liyecom/liye-ai/pull/88)

### 16.1 交付成果

#### B1: 基线分布报告

**文件**: `docs/reasoning/reports/p6b/P6B_BASELINE_DISTRIBUTION_DEMO_US_14D.md`

| 指标 | P50 | P75 | P90 | P95 |
|------|-----|-----|-----|-----|
| spend (per term) | $0.42 | $1.85 | $5.12 | $12.38 |
| clicks (per term) | 0 | 1 | 4 | 9 |

- **zero_conversion_spend_pct**: 78.0%
- **match_type_distribution**: BROAD 46%, PHRASE 32%, EXACT 22%
- **Eligible proposals**: 12 (under balanced thresholds)

#### B2: Balanced 校准决策

**结论**: ❌ **无需调整阈值**

| 证据 | 值 | 结论 |
|------|-----|------|
| clicks P95 | 9 | clicks_gte=20 是 2x P95，保证统计显著性 |
| waste_ratio P50 | 0.85 | 大部分词已超 0.30 阈值 |
| $15-30 bucket zero-order rate | 77.4% | spend_gte=15 适当 |

放宽阈值会增加误判风险而无明显收益。

#### B3: 稳定性测试

**文件**: `tests/reasoning/p6b/test_cause_ranking_stability.mjs`

| 测试 | Perturbations | Swaps | 状态 |
|------|---------------|-------|------|
| ACOS_TOO_HIGH - NEW_PRODUCT_PHASE | 8 | 0 | ✅ |
| ACOS_TOO_HIGH - BID_TOO_HIGH | 6 | 0 | ✅ |
| ACOS_TOO_HIGH - LISTING_LOW_QUALITY | 8 | 0 | ✅ |
| ACOS_TOO_HIGH - Boundary (BID vs OFFER) | 6 | 0 | ✅ |
| SEARCH_TERM_WASTE_HIGH - BROAD_MATCH | 6 | 0 | ✅ |
| SEARCH_TERM_WASTE_HIGH - INSUFFICIENT_NEG | 8 | 0 | ✅ |
| SEARCH_TERM_WASTE_HIGH - AUTO_UNCONSTRAINED | 8 | 0 | ✅ |
| SEARCH_TERM_WASTE_HIGH - Boundary | 6 | 0 | ✅ |

**保证**: ±1% perturbations 不会导致意外的 Top1/Top2 排序翻转

### 16.2 P6-B 约束遵守确认

- ❌ 无新增服务/数据库
- ❌ 无 GDP schema 变更
- ✅ ZERO WRITES 维持
- ✅ 基线报告已归档
- ✅ 稳定性测试全绿
- ✅ 校准决策有证据支持
