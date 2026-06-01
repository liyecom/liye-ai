# Phase 2a-γ SPEC v1.0 — GHL 30-day D-11 rolling reducer（Phase-4 prep）

**Status**: v1.0（user **D-A 分层** 收官切片；2a-α(`d341e76`)+2a-β SPEC(`8d39f58`/blob `d1b11bae`) 已 merge；γ = Phase-4 前置基础设施，30d D-11 rolling reducer；**7-fork 全裁 + ground-truth recon**；**incorporating 5-lens 自红队 `wf_86ea3985`：2 HIGH + 1 MED 全 fold，19 refuted=proof-of-coverage**，2026-06-01；下一步 doc-only PR，不 merge）

> **γ 是 SPEC（设计/契约定稿），不写实现代码。** 单一聚焦：把 1e 的**日级 nullable atom** 聚合成 Phase-4 entry gate 消费的 **30d 滚动 KPI**。
> **并行性**：3 输入锚已全 sealed（红队 `wf_8a7ef6c8` 确认）→ γ 与 2a-β IMPL 并行起草，无 EXTERNAL-PENDING。

**定位**：γ ≠ 2a-entry gate（2a-entry 只读 4 条 Phase-1 exit 准则，由 2a.1 实现，OQ-2 已锁）。γ 产 **Phase-4 前置 11 条中的 2 条**（plan §4 L173-184）：`operator_agreement_rate≥0.7`（30d 软）+ `critical_false_negative_count=0`（30d 硬）。其余 9 条前置 + **Phase-4 entry gate 消费逻辑本体 ∉ γ**（→ Phase-4 SPEC）。

**Out of scope（→ Phase-4 / 2b / 2c，§6 硬边界）**：
- **Phase-4 entry gate 消费逻辑**：读 γ 输出 + 其余 9 条前置 + kill_switch 演练 + ADR 封板等 = Phase-4 SPEC。
- **2b/2c**：crystallizer（D-04）· candidate/promotion write。
- **trial 层回写 / verdict / confidence**：γ 纯读+聚合，**不碰 evaluator / heartbeat / trial 层 / verdict / confidence_formulas**。

---

## §0 Normative Anchors（两源核验，2026-06-01 实测 @ `origin/main` `8d39f58`）

| ID | 锚点 | blob | γ 关系 |
|----|------|------|--------|
| N-0 | 2a-α SPEC `.planning/phase-2a/SPEC.md` | `e74f205f` | **OQ-2**（operator KPI 在 2a-entry 结构性不可观测，消费者 = γ Phase-4 30d gate）= γ raison d'être |
| N-β | 2a-β SPEC `.planning/phase-2a-beta/SPEC.md` | `d1b11bae` | §6 γ 输入锚 + R-β7（reduce 算子约束继承）+ F-flow 写侧幂等 + late_arrivals 从 policy_trial_v1 重建 |
| N-1 | `metrics_daily_v1.schema.yaml`（d11_kpis 日级源）| `7caccdf7` | γ 主输入：`d11_kpis`(L341-394) per-day **raw atoms**（Simpson-safe）+ `kpi_unavailable_reasons` |
| N-2 | `operator_feedback_v1.schema.yaml` | `4d917aef` | derivation 定义（AGREE/DISAGREE/NEEDS_MORE_EVIDENCE + critical reason codes）|
| N-3 | `policy_trial_v1.schema.yaml` | `21f225d6` | **late_arrivals 重建源**（ledger un-sealable，β fold C）|
| N-4 | 1e producer `metrics_daily_producer.mjs` | `5057fc5a` | **范式源**（pure-function hash H1 / same-hash skip-diverge / `--regenerate` / KIND 序 / UTC-day complete）；**本体 frozen 0 触** |
| N-5 | `confidence_formulas.yaml`（FROZEN）| `9b8c2044` | γ 0 触 |
| N-6 | File-B `scripts/heartbeat_runner.mjs` | `e63cf86c` | 永 frozen，0 触 |
| N-7 | plan `GHL-evolution-plan-v4.1.md` §4 L146-152（Phase 2）+ §6 L173-184（Phase 4 前置 11 条）| — | γ 产 #4(`agreement≥0.7` 30d 软) + #5(`critical_false_negative=0` 30d 硬)；余 9 条 ∉ γ |

---

## §0.1 ⚠ CODE/SCHEMA-AUTHORITATIVE 关键前提（实读核验 2026-06-01）

1. **【d11_kpis = Simpson-safe raw atoms，30d 必先求和后除】** `metrics_daily_v1.d11_kpis`(L341-394) per-day 字段：`agreement_agree_count`（分子，on-time AGREE）+ `agreement_eligible_count`（分母，AGREE+DISAGREE，排 NEEDS_MORE_EVIDENCE）+ `operator_agreement_rate_today`（nullable convenience，**schema L364 明示「gate uses raw atoms」**）+ `critical_false_negative_count_today`（DISAGREE ∩ {unsafe_reuse,regression_failed,business_context_changed}）+ `operator_reason_codes` + `kpi_unavailable_reasons`(∈{`no_trials`,`no_operator_feedback`,`denominator_zero_all_needs_more_evidence`})。→ **γ 30d `operator_agreement_rate` = Σ agree / Σ eligible（raw atoms，Simpson-safe）**，**禁**平均每日 rate（Simpson 悖论）。

2. **【d11_kpis 是 on-time-only → γ 直接从 trials SSOT 归一重算，不做 hybrid 加和】** 1e producer(`5057fc5a` L357-379)：on-time feedback（`fb.reviewed_at` UTC-date == `evaluated_at` UTC-date）→ day-N d11_kpis 原子；**late（日期不符）→ late-arrival ledger，被 day-N 原子排除**。→ **若「Σ d11_kpis(on-time) ⊎ late」需复刻 producer 的 `utcDateOf(reviewed_at)===utcDateOf(evaluated_at)` 关系判定才能只取 late，否则双计数 on-time**（红队 consistency 命中）。**裁决 = REBUILD-ALL**：late-arrival ledger 记录形**无 schema**（`metrics_daily_v1` 仅 `late_arrivals_ref` pointer L559-571，un-sealable），故 γ 从**唯一 SSOT** `policy_trials.jsonl`(`policy_trial_v1` `21f225d6`) **一次性按 `reviewed_at` bucket 进 30d 窗、on-time+late 统一重算 numerator/denominator**（不分两路、不加和、零双计数）；d11_kpis 仅作 cross-check 哨兵（§1）。β fold C 的「漏 late」由 rebuild-all 天然解决。

3. **【空窗 fail-safe 危险点 — critical_false_negative=0 是通过值】** Phase-4 #5 是 **hard gate `critical_false_negative_count=0`**；0 = **通过值**。→ 空窗/无数据若产 `0` 会被 Phase-4 gate **误读为「已通过 hard gate」**（灾难性假阴性）。故 reducer 对空窗/不足窗**必须产 `kpi_unavailable`（而非 0）**，复用 1e `kpi_unavailable_reasons` 范式 + 窗口级新 reason（如 `insufficient_window`）。`operator_agreement_rate` 同理：空窗产 `null`+reason，非 0。

4. **【pure-function hash 范式（D-γ5）】** 1e `metric_record_hash` = `hashCanonical(parseCanonical(...))` over **PURE (date_utc + window + 6-input aggregate)**，**EXCLUDING snapshot/wall-clock/invocation**（producer L35-37，red-team H1）→ 闭合日重跑不 spurious diverge。γ rolling hash 须同范式（pure over `window_end + 30d-window + summed-atoms`，排 wall-clock）。same-hash skip-diverge guard（`buildSeenByDate` date→hash map，latest wins）+ `--regenerate` override + KIND 序（incomplete → input_unreadable → divergence → output_schema）+ UTC-day complete（严格早于当前 UTC 日）全可复用。

5. **【gate 数 19→20 确定性 — 红队实测推翻「守 19」假设】** 起草指令 + 本 SPEC v0 草稿曾假设「schema 无 instance 时可能不增计数 → 守 19」。**实读 `validate-contracts.mjs` L508-559 推翻此假设**：`validateContractSchemas()` 遍历**硬编码 `schemaFiles` 数组**（L511-532，14 项），每项发一个 `logPass`（L555），**完全无需 runtime instance**。baseline 19 = 14 schemaFiles + 1 formula instance + 2 learned policies + 2 SSOT（engine manifests 计 0，ENGINE_MANIFEST_PATH 未设）。**铁证先例**：`metrics_daily_v1`（无 runtime instance 的 schema，与 γ 同境）于 Phase-1e #155 加入数组 L528 即贡献 1 pass。→ **治理新 `d11_rolling_30d_v1` 必须注册进 `schemaFiles` 数组 → 确定性 19→20，且编辑 `validate-contracts.mjs`（=脚本，非 sealed contract，编辑允许）**。`{governed, 守19}` 不可兼得：不注册=不校验=喂 hard gate 的 schema 失治（违 D-γ4）。→ **D-γ4 无条件走 schema-touching 路径，19→20 = 已决策的披露式 carve-out，非「实测可能守 19」开放项。**

---

## §1 Contract Surface（2a-γ，单一交付）

### Fγ — 30-day D-11 Rolling Reducer（NEW；纯读+聚合）
- **[新增 reducer] 输入裁决（红队 fold — 防双计数）= REBUILD-ALL-FROM-TRIALS（归一）**：γ 的 numerator/denominator **直接从 sealed `policy_trials.jsonl`（`21f225d6`）重算**，按 `operator_feedback.reviewed_at` 的 UTC-date bucket 进 30d 窗，**on-time + late 一次性统一计入**（不分两路、不 `⊎`）。**不**以 `d11_kpis` 作 numerator 源（否则「Σ d11_kpis(on-time) ⊎ late」需复刻 producer 的 `utcDateOf(reviewed_at)===utcDateOf(evaluated_at)` 关系判定才能只取 late，易双计数）。`metrics_daily.jsonl.d11_kpis`（`7caccdf7`）降为**可选 cross-check / divergence 哨兵**（γ 重算的 on-time 子集应与 1e 日级 d11_kpis 吻合，背离=数据完整性告警），**非** numerator 源。
- 输出：30d 滚动 KPI（命名 `_30d` 后缀，与 per-day `_today` atom 区分，防混）：
  - **`operator_agreement_rate_30d`** = `Σ AGREE / Σ (AGREE+DISAGREE)`（窗内全部 trial 的 operator_feedback，排 NEEDS_MORE_EVIDENCE；raw-count Σ 后除，Simpson-safe，§0.1-1）；分母 0 → `null` + `kpi_unavailable`。
  - **`critical_false_negative_count_30d`** = 窗内 `Σ (verdict==DISAGREE_WITH_SYSTEM ∧ reason_codes ∩ {unsafe_reuse,regression_failed,business_context_changed})`；**空窗/不足窗 → `kpi_unavailable`，绝不产 0**（§0.1-3）。
  - **`window_end_utc` + `window_start_utc`（红队 fold — freshness 契约）**：governed 输出字段，标注本产物覆盖的 30d 窗右/左边界（对齐 1e row 自带 `date_utc`/`window`/`complete_day` 范式，N-4）。**Phase-4-facing freshness 规则**：Phase-4 gate 读前 **MUST 验证 `window_end_utc == 当前 UTC 日 − 1`**（last complete UTC day）；陈旧产物（window_end 更早）→ Phase-4 视为 **unavailable，非 pass**（防 stale-but-complete 产物的旧 0/值被误当现态通过 hard gate）。**γ 只产 envelope；staleness enforcement 在 Phase-4**（R-γ3 边界不越）。
- **消费方 = Phase-4 entry gate**（读 γ 输出对照 #4 `≥0.7` 软 / #5 `=0` 硬 + freshness）；**Phase-4 gate 本体 ∉ γ**（§6）。
- 触碰：**0 sealed schema 改**（只读 N-1/N-2/N-3，产新 rolling 输出 + 其 governing schema `d11_rolling_30d_v1`，详 D-γ4）；reducer 落 `.claude/scripts/learning/`（对齐 1e/2a.1 位置）。

### 设计裁决（§5 摘要，§1 落地）
- **形态（D-γ1）**：producer 型（定时产滚动产物，对齐 1e；Phase-4 gate 读静态产物可审）。
- **窗口（D-γ2）**：30d = 滚动 30 完整 UTC 日（对齐 1e UTC-day + α all-of-window）；不足 30 完整日 → `kpi_unavailable`（`insufficient_window`，三态对齐 α OQ-1：足窗有数 = 可用 / 足窗空数 = `kpi_unavailable` / 不足窗 = `insufficient_window`）。
- **输出 schema（D-γ4，红队 fold — 无条件 schema-touching）**：rolling 产物喂 Phase-4 hard gate，**必须 governed**。新最小 schema `d11_rolling_30d_v1`，治理 = 注册进 `validate-contracts.mjs` 的 `schemaFiles` 数组（脚本，编辑允许）→ **确定性 gate 19→20**（§0.1-5 实测机制，非「可能守 19」）。19→20 = **已决策的披露式 carve-out**，IMPL 走 **schema + validator-touching 独立 PR**（DoD#10 三源实测确认 = 20）。
- **same-hash/divergence（D-γ5）**：pure-function rolling hash（排 wall-clock）+ same-hash skip-diverge + `--regenerate` fail-closed。
- **late-arrival（D-γ6，红队 fold — 归一无双计数）**：**rebuild-all-from-trials**（§1 输入裁决）—— 从 sealed `policy_trial_v1`（`21f225d6`）按 `reviewed_at` bucket **一次性统一** on-time+late，**无 `⊎`、无 late 单独抽取、无双计数**。late-arrival ledger un-sealable（仅 pointer），故 policy_trials.jsonl 是唯一 SSOT；evidence-ledger late-arrival 范式第 4 复用（1c/1e/β/γ）。
- **reduce 算子约束（D-γ7，继承 β R-β7）**：**仅 30d 固定窗**对这两个 KPI reduce；**不暴露任意 `--window`** 对 agreement/false-negative 做 reduce（防 operator 拿 reducer 当通用查询绕 Phase-4 gate 语义）。

---

## §2 Cross-Cutting Hard Constraints

### 仍永 frozen（0 触，实测核验）
- File-B `e63cf86c` · 1b import_facts/canonical_json（仅 import `hashCanonical`/`parseCanonical` 复用，0 改）· 1e producer **本体** `5057fc5a`（仅读其输出 `metrics_daily.jsonl`，0 改代码）· `learning_sources.yaml` · `confidence_formulas.yaml` `9b8c2044` · AGE/loamwise · scheduler。
- sealed 输入 schema：`metrics_daily_v1` `7caccdf7` · `operator_feedback_v1` `4d917aef` · `policy_trial_v1` `21f225d6` —— γ **0 触**（只读）。

### Hard-NO（列死）
- **R-γ1**：γ = **纯读 + 聚合**；**不回写 trial 层、不碰 verdict、不触 evaluator、不改 heartbeat、不改 1e producer**。
- **R-γ2**：candidate/promotion/production write 路径**永锁**（Hard Gate 8）；verdict 仍 NEEDS_HUMAN。
- **R-γ3**：**Phase-4 entry gate 消费逻辑 ∉ γ**；γ 只产 reducer 输出 + 输出契约，不画 gate 阈值判定/abort 逻辑（防 scope bleed）。
- **R-γ4（继承 β R-β7）**：reducer **不暴露任意窗口** 对 `operator_agreement_rate`/`critical_false_negative` reduce；仅 30d 固定窗。
- **R-γ5**：空窗/不足窗**绝不产 0**（尤其 critical_false_negative，0=通过值）；产 `kpi_unavailable`（§0.1-3）。
- **R-γ6（红队 fold）**：新 schema `d11_rolling_30d_v1` 注册进 `schemaFiles` 数组 → **确定性 gate 19→20**（§0.1-5 实测机制）；= 已决策的披露式 carve-out + 三源实测 + schema/validator-touching 独立 PR。**「守 19」不适用**（喂 hard gate 的 schema 必须 governed）。

---

## §3 验收标准（DoD，IMPL 期可证伪）

> 本 SPEC 自身 = **doc-only**（仅新增 `.planning/phase-2a-gamma/SPEC.md`）→ 0 schema crack，validate-contracts **19 before==after**（baseline 实测 2026-06-01 = 19/0/0）。

1. **#1 Simpson-safe**：`operator_agreement_rate_30d` == Σagree/Σeligible（raw atoms）；**断言 ≠ 平均每日 rate**（构造 Simpson 反例测试）。
2. **#2 late-arrival 补全**：30d 含 late feedback（从 policy_trials.jsonl `reviewed_at` 重建）；断言不漏 late（与只-Σ-d11_kpis 的对照测试可见差异）。
3. **#3 空窗 fail-safe**：空窗/不足 30 完整日 → `critical_false_negative_count_30d` = `kpi_unavailable`（**非 0**）+ reason；`operator_agreement_rate_30d` = `null`+reason。
4. **#4 三态窗口**：足窗有数=可用 / 足窗 Σeligible==0=`kpi_unavailable(denominator_zero...)` / 不足窗=`kpi_unavailable(insufficient_window)`。
5. **#5 pure-function hash**：同输入闭合窗重跑 → 同 rolling hash（排 wall-clock/snapshot）；same-hash → skip-diverge；hash 变 → divergence fail-closed（KIND 序）；`--regenerate` override。
6. **#6 reduce 算子约束**：reducer 代码**无任意 `--window`** 对 agreement/false-negative 的 reduce 路径（R-γ4 负向 grep 断言）；仅 30d 固定。
7. **#7 frozen 0 触**：File-B `e63cf86c` / 1b / 1e producer 本体 `5057fc5a` / confidence_formulas `9b8c2044` / 3 输入 schema / AGE / loamwise / scheduler / heartbeat 全 0-diff。
8. **#8 Hard Gate 8**：0 candidate/promotion/production write；0 trial 层回写；verdict NEEDS_HUMAN；evaluator/heartbeat 0-diff。
9. **#9 Phase-4 gate 边界**：γ 输出**不含** gate 阈值判定/PASS-FAIL/abort 逻辑（R-γ3）；只产 KPI 值 + 可用性。
10. **#10 gate 数 19→20（确定性，红队 fold）**：注册 `d11_rolling_30d_v1` 进 `schemaFiles` → validate-contracts after == **20**（三源实测确认 = 20，before 19）；19→20 披露为 carve-out；schema/validator-touching 独立 PR。**「守 19」已被实测推翻**（§0.1-5）。
11. **#11 输入锚不变**：`7caccdf7`/`4d917aef`/`21f225d6` 全 0-diff（γ 只读）。

---

## §4 Required Test Coverage（γ-IMPL 期，SPEC 预置矩阵）

- **Simpson-safe**：raw-atom Σ 后除 vs 平均日 rate 的 Simpson 反例 / 分母 0 → null+reason。
- **late-arrival**：late feedback（reviewed_at 在窗内但 trial day 不符）从 policy_trials.jsonl 重建计入 / on-time+late 统一不重复 / 与只-d11_kpis 对照差异可见。
- **空窗 fail-safe**：0 trial / 0 operator feedback / Σeligible==0 / 不足 30 完整日 → 各产对应 `kpi_unavailable` reason，**critical_false_negative 绝不 0**。
- **窗口语义**：滚动 30 完整 UTC 日 / 边界日（第 30 日 in，第 31 日 out）/ 不足窗三态 / UTC-day complete（严格早于当前日）。
- **pure-function hash**：闭合窗重跑同 hash / wall-clock 变不影响 hash / same-hash skip / hash 变 divergence / `--regenerate` / KIND 序。
- **reduce 算子约束（负向）**：无任意窗口 reduce 路径 / 仅 30d 固定 / 不暴露通用查询。
- **invariant 守卫（负向）**：0 trial 回写 / 0 verdict 改 / 0 candidate-promotion-production write / 3 输入 schema 0-diff / 1e producer 本体 0-diff / Phase-4 gate 逻辑不在 γ。
- **CI**：prefix-named node:test 独立 workflow（对齐 1c/1d/1e/2a-α A7）；纯 node 自包含 synthetic root / committed fixtures（0 跨 repo / 0 网络）。

---

## §5 Resolved Decision Log（7 fork 全裁）

| ID | 裁决 | 依据（ground-truth）|
|----|------|--------------------|
| **D-γ1** reducer 形态 | **producer 型**（定时产滚动静态产物，对齐 1e；Phase-4 gate 读静态产物可审）| 指令建议 + 1e 范式（N-4）；静态产物利审计/replay |
| **D-γ2** 窗口语义 | **滚动 30 完整 UTC 日**；不足窗三态（可用/空数 kpi_unavailable/不足窗 insufficient_window，对齐 α OQ-1 三态 + 1e UTC-day）| §0.1-1/3；α exit-gate 三态范式 |
| **D-γ3** 输入缺失 | **空窗/不足窗 → `kpi_unavailable` 绝不 0**（critical_false_negative 0=通过值，0 会被 Phase-4 误读「已过 hard gate」）；复用 `kpi_unavailable_reasons` + `insufficient_window` | §0.1-3（灾难性假阴性防护）；1e nullable atom 设计 |
| **D-γ4** 输出落点+schema | **最小新 `d11_rolling_30d_v1`（governed，喂 hard gate 必须可治理）；注册进 `validate-contracts.mjs` `schemaFiles` 数组 → 确定性 gate 19→20（披露式 carve-out）；schema/validator-touching 独立 PR。「守 19」已被红队实测推翻** | §0.1-5 实读 validate-contracts L508-559（硬编码数组每项 1 pass，无需 instance；metrics_daily_v1 L528 先例）；hard-gate 输入须 governed |
| **D-γ5** 同一性/divergence | **pure-function rolling hash（排 wall-clock/snapshot，对齐 metric_record_hash H1）+ same-hash skip-diverge + `--regenerate` fail-closed + KIND 序** | §0.1-4；1e producer N-4 范式直接复用 |
| **D-γ6** late-arrival | **从 sealed `policy_trial_v1`(`21f225d6`) 重建（ledger un-sealable）**；evidence-ledger late-arrival 范式第 4 复用 | §0.1-2；β fold C（producer 去重键属 late-arrival ledger 域，非写侧）|
| **D-γ7** reduce 算子约束 | **仅 30d 固定窗 reduce 这两 KPI；不暴露任意 `--window`**（防 reducer 当通用查询绕 Phase-4 gate 语义）| 继承 β R-β7 |

---

## §6 Out-of-Scope（硬边界 → Phase-4 / 2b / 2c）

- **Phase-4 entry gate 消费逻辑（独立 Phase-4 SPEC）**：读 γ 输出 + 其余 9 条前置（manifest 30d PASS / dedupe 稳定 / kill_switch 演练 / ADR 封板 / Pilot-1 复审 等）+ 阈值判定（`≥0.7` 软 / `=0` 硬）+ abort 路径。**γ 只交付 reducer + 输出契约，不画 gate 本体。**
- **2b/2c**：crystallizer（D-04）· candidate/promotion write。
- **永不在 2a/γ**：candidate/promotion/production write · scheduler · File-B · AGE/loamwise · verdict 语义改 · evaluator/heartbeat 改 · 1e producer 本体改 · confidence_formulas 改。

---

## §7 Implementation Plan Skeleton（留给 γ-IMPL 指令包 expand）

**PR 结构（红队 fold — schema-touching 确定路径）**：
- **本 SPEC PR = doc-only**（仅新增本文件）→ validate-contracts 19 before==after。
- **γ-IMPL = schema/validator-touching PR**：新 `d11_rolling_30d_v1` schema + 注册进 `validate-contracts.mjs` `schemaFiles` 数组（确定性 19→20，披露式 carve-out）+ reducer mjs + CI + tests。可拆为「schema+validator 子 PR」与「reducer 子 PR」两步，或合一 PR 内 §0.1 carve-out 披露；三源实测 after==20 写进 DoD#10。

**禁触**：File-B / 1b / 1e producer 本体 / confidence_formulas / 3 输入 schema(只读) / evaluator / heartbeat / AGE / loamwise / scheduler / candidate-promotion-production write / Phase-4 gate 本体 / 2b-2c 项。
**新增**：rolling reducer mjs（`.claude/scripts/learning/`）+ 最小 schema + 独立 CI workflow + node:test suite + fixtures。

**实施顺序建议**：schema(若需) → reducer 核心（Σ raw atoms + late 重建 + fail-safe）→ pure-hash/divergence guard → CLI(`--date`/`--regenerate`，无任意 window) → CI/fixtures。

---

## §8 SPEC Anchor / Version Control

- **base**：`origin/main` `8d39f58`（2a-β SPEC squash, PR #158）。
- **branch**：`planning/phase-2a-gamma-spec-v1.0`。
- **SPEC 路径**：`.planning/phase-2a-gamma/SPEC.md`。
- **上游 sealed anchors**：见 §0（8 条，2026-06-01 实测）。
- **doc-only PR**；**operator UI merge（不自 merge）**。merge 后 post-squash blob 锁 + spawn `project_ghl_phase_2a_gamma_spec.md` + 更新 MEMORY.md 索引。**γ 完成 = 2a 整组（α/β/γ）SPEC 收官** → 余 2a-β IMPL + 2a-γ IMPL → Phase-4 解锁。

---

## §9 Findings / Open Items

- **F-simpson（已裁）**：30d rate 必 raw-atom Σ 后除（schema L364「gate uses raw atoms」），非平均日 rate（D-γ1/§0.1-1）。
- **F-late（已裁）**：d11_kpis on-time-only，late 须从 policy_trial_v1 重建补全（D-γ6/§0.1-2）。
- **F-failsafe（已裁）**：空窗 critical_false_negative 绝不 0（Phase-4 hard-gate 假阴性防护，D-γ3/§0.1-3）。
- **F-gatecount（红队推翻「守19」，已裁确定 19→20）**：validate-contracts 遍历硬编码 `schemaFiles` 数组（每项 1 pass，无需 instance）→ 治理 `d11_rolling_30d_v1` 必注册 → 确定性 19→20，披露式 carve-out（§0.1-5/D-γ4/DoD#10）。
- **F-doublecount（红队，已裁 rebuild-all）**：hybrid Σ⊎ 易双计数 → 归一从 policy_trials.jsonl 重算（§1/§0.1-2/D-γ6）。
- **F-freshness（红队，已裁）**：加 window_end_utc 输出 + Phase-4 freshness 规则防 stale 产物误过 hard gate（§1 Fγ）。
- **OQ-γ1（留 IMPL/user）**：rolling 产物落点文件名 + 是否随每日 1e run 联动产出还是独立调度（倾向独立 producer，不入 scheduler R-γ1）。
- **OQ-γ2（留 IMPL/user）**：`insufficient_window` 之外是否需区分「窗内有 trial 无 feedback」vs「窗内 0 trial」（复用 per-day `no_trials`/`no_operator_feedback` 提升至窗口级）。

### 5-lens 红队 fold（`wf_86ea3985`，~1.24M tok / 27 agents；3 confirmed / 19 refuted）

- **HIGH（gate-count，frozen-touch）fold**：实读 `validate-contracts.mjs` L508-559 推翻「守 19」假设——`schemaFiles` 是 14 项硬编码数组，每项 1 pass，无需 instance；`metrics_daily_v1`(L528) 即先例 → 治理 `d11_rolling_30d_v1` 必注册 → **确定性 19→20**（§0.1-5, D-γ4, R-γ6, DoD#10, §7 全改为无条件 schema-touching 披露式 carve-out）。
- **HIGH→MED（double-count，consistency）fold**：原 §1「Σ d11_kpis(on-time) ⊎ late 重建」hybrid 需复刻 producer on-time/late 关系判定否则双计数 → 改 **REBUILD-ALL-FROM-TRIALS 归一**（从 policy_trials.jsonl 按 reviewed_at 一次性统一 on-time+late，d11_kpis 降为 cross-check 哨兵；§1, §0.1-2, D-γ6）。
- **MED（window anchor/freshness，downstream-phase4）fold**：producer 型静态产物缺 window_end 输出 + Phase-4 无法辨 stale → 加 `window_end_utc`/`window_start_utc` governed 输出字段 + Phase-4-facing freshness 规则（MUST 验 window_end==当前UTC−1，陈旧=unavailable 非 pass；γ 产 envelope，enforcement 在 Phase-4，R-γ3 不越；§1 Fγ）。
- **19 refuted = proof-of-coverage**（红队全 ground-truthed，0 假阳）：含 R-γ4 fence 是 operation-kind 非 flag-surface（DoD#6+L108「无任意窗口 reduce 路径」已 falsifiable）· `--date` 可移右边界固定 30d span 非通用查询（对齐 α exit-gate `--asof`）· Simpson-safe / 空窗 fail-safe / pure-hash / Phase-4 边界等均确认 OUT 或已覆盖。

**无 blocker**。5-lens 红队 fold 完成 → v1.0 → doc-only PR（不 merge）。γ 与 β IMPL 解耦并行；γ-IMPL = schema-touching（19→20 披露）。
