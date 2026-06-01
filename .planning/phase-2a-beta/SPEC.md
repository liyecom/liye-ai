# Phase 2a-β SPEC v1.0 — GHL trialing 后果面（trial-history 回写 · confidence · operator-feedback flow · 2a→2b predicate）

**Status**: v1.0（user **D-A 分层** 续作；2a-α(flip-readiness, idle 门) 已 merge `d341e76`；β = trial **真流动后**的后果链；**6-fork 全裁 + ground-truth recon 修正 5 处假设**；**incorporating 5-lens 自红队 `wf_8a7ef6c8`：4 HIGH + 3 MED + 2 LOW，全 fold；9 refuted = proof-of-coverage**，2026-06-01；下一步 doc-only PR，不 merge）

> **β 是 SPEC（设计/契约定稿），不写实现代码。** 本 SPEC 把 6 个设计分叉裁死、把契约面冻结，留给后续 fresh-session 的 β-IMPL 指令包 expand。
> **红队 fold 关键结论**：D-β4「rollup atom 不在 schema → sidecar/独立 PR」**被 ground-truth 推翻**（per-day `by_system_verdict` 分布**已 sealed 且 1e 已产**）→ **β 收敛为单 β-main PR，0 schema-touching**。

**定位**：2a-α 只开了 `dry_run→trialing` 的门（idle，`trial_write_enabled=false`）。β 定义当 operator 激活 trialing、trial 真正流动后的**所有后果**：trial verdict 如何沉淀（trial_history）、confidence 如何随之产出、operator 如何对 verdict 表态并回流、何时满足 `2a→2b` 转移。**β 不激活 trialing**（激活仍是 RUNBOOK §2.2 operator 序列）；β 只定义"流动起来之后"的契约。

**Out of scope（→ γ / 2b / Phase-4，§6 硬边界 + Hard-NO 列死）**：
- **γ（Phase-4 prep，独立 fresh-session SPEC）**：30-day D-11 rolling reducer（`operator_agreement_rate≥0.7` 软 / `critical_false_negative=0` 硬 = Phase-4 前置）。**β 只产/沉淀 per-day 原子；任何跨日/30d 聚合 = γ。**
- **2b（candidate 评估）/ 2c（promotion）/ Phase-4（production）**：candidate/promotion/production write 路径**永锁**（Hard Gate 8）；crystallizer（D-04）∈ 2b/2c；Phase-4 gate **消费逻辑** ∈ Phase-4 SPEC。
- **system_verdict 语义扩面**：verdict 仍仅 `NEEDS_HUMAN`（duplicate_conflict 情形2，2a-α A5）；β **不扩 verdict 触发面**，confidence 是**正交新维度**非 verdict 子字段。

---

## §0 Normative Anchors（两源核验，2026-06-01 实测）

| ID | 锚点 | blob @ `origin/main` `d341e76` | β 关系 |
|----|------|-------------------------------|--------|
| N-0 | 2a-α SPEC `.planning/phase-2a/SPEC.md` | `e74f205f` | 上游宪法；§6 已前置框定 β 范围（注：α §6 关于 trial-verdict rollup "当前不存在" 的措辞被本 SPEC §0.1-2 ground-truth 修正）|
| N-1 | evaluator `src/reasoning/policy_trial_evaluator.mjs` | `0fe051f5` | β 主改面（carve-out）：trial_history 回写 + confidence 算/写 + feedback ingestion |
| N-2 | `policy_trial_v1.schema.yaml`（trial 写契约，strict `additionalProperties:false`）| `21f225d6` | **不改**（β 复用；`operator_feedback` 已 $ref 嵌入）；**亦为 γ 重建 late-arrival 的 sealed 源** |
| N-3 | `operator_feedback_v1.schema.yaml` | `4d917aef` | **D-β5 已存在且 γ-ready**；β **不造**，仅 finalize 充分性核验 + 定为 γ 外锚 |
| N-4 | `learned_policy_ghl_v1.schema.yaml` | `e67c7c10` | `trial_history`(optional `array<uuid>`, L504) + `confidence`/`confidence_basis`(required) 写目标 |
| N-5 | 1e producer `metrics_daily_producer.mjs` | `5057fc5a` | **不改本体**；β 的 feedback re-append 流喂其既有 read 路径；其 `by_system_verdict`/`d11_kpis`/late-arrival 拆分逻辑是 β/γ 共同事实源 |
| N-6 | `metrics_daily_v1.schema.yaml` | `7caccdf7` | `policy_trials_breakdown.by_system_verdict`(L266-287, **required, 已 sealed**) + `d11_kpis`(L341-394) + `phase_1_exit_signals`(L399-459) + `late_arrivals_ref`(L559-571, **pointer-only**) 均已存在；β **0 触** |
| N-7 | `confidence_formulas.yaml`（FROZEN）| `9b8c2044` | **D-β2 裁定不解冻**（公式正确，β 无需改）|
| N-8 | File-B `scripts/heartbeat_runner.mjs` | `e63cf86c` | **永 frozen**（0 触）|

---

## §0.1 ⚠ CODE/SCHEMA-AUTHORITATIVE 关键前提（实读核验 2026-06-01；**修正 5 处假设**，含 1 处自红队 HIGH 推翻）

> 起草指令把 6 个 fork 当"待造"裁决；实读发现 **β 所需基础设施大部已在 Phase 0b/1c/1e 落地并 sealed**。SPEC 以现实为准（grounding = SPEC 职责）。"已存在"统指 **code/schema 契约定义已落地并 sealed**（§0.1 标题即 CODE/SCHEMA-AUTHORITATIVE），非指运行期已有 disk 实例（trialing 尚 idle，0 真 trial）。下列为防未来读者迷惑的 cement：

1. **【修正 A — operator_feedback schema 已存在】** `operator_feedback_v1.schema.yaml`(`4d917aef`) 是 Phase-0b B1 成熟契约：`{reviewer_id_hash, verdict∈{AGREE_WITH_SYSTEM,DISAGREE_WITH_SYSTEM,NEEDS_MORE_EVIDENCE}, reason_codes[∈5词表], reviewed_at, note?}`，`additionalProperties:false`。已是 `policy_trial_v1.operator_feedback` 的 `$ref` 目标（**containment 设计**，trial 关联靠包含，**无独立 trial_id FK 字段**）。→ **指令 D-β5 提议的扁平 `{trial_id, agreement(bool), critical_false_negative(bool)}` 是退化**；现存 3 值 enum + 派生指标更优。β **不造 schema**，只定 write-flow + 核验 γ 充分性。

2. **【修正 B ⚠ 自红队 HIGH 推翻指令 D-β4 前提 — per-day trial-verdict 分布已 sealed】** `metrics_daily_v1.policy_trials_breakdown.by_system_verdict`(schema L266-287, top-level **required** L56) **已是 sealed per-day 原子**，keys `{PASS, FAIL, DOWNGRADED, NEEDS_HUMAN}`；1e producer(`5057fc5a` L351 `bump(by_system_verdict,...)` + L427 写入) **已产**。→ **指令 + α §6 所称"trial-verdict rollup atom 当前不存在于 metrics_daily_v1"对 per-day 维度是错的**。per-day trial-verdict 分布 = **0 新 schema / 0 sidecar / 0 独立 PR**；F-predicate 直读已 sealed 的 `by_system_verdict`。**唯一可能 genuinely-new 的是跨日/30d rollup → 那是 γ，不在 β**。故 **D-β4 sidecar 决策作废**（详 §5 D-β4 重裁）。

3. **【修正 C — 异步 feedback 落点已解（containment 张力化解）】** 1e producer L298 注释 + L357/L548 实证：**异步 operator feedback = 整条 trial object 重新 append 到 `policy_trials.jsonl`，latest-wins by `trial_id` 去重**（producer read 侧）。append-only 不破（追加新全行）。on-time（`fb.reviewed_at` UTC-date == trial day）→ day-N `d11_kpis` 原子（hash-stable, L359-369）；late（日期不符）→ late-arrival ledger（L370-379，独立 deduped append by `${trial_id}|${feedback_reviewed_at}`，L548/L683）。→ **β 的 feedback read/aggregation 侧已存在**；β 真正新增 = **write/ingestion 侧**（人如何产出并 re-append 带 operator_feedback 的 trial object）。**注**：producer 的 read 侧 latest-wins(by trial_id) 与 late-arrival ledger 去重键(`feedback_reviewed_at`) **均不提供 ingestion 写侧幂等** → 写侧幂等是 β-IMPL **新增** invariant（详 F-flow）。

4. **【修正 D — trial_history 字段 + evidence side-car 已存在】** `learned_policy_ghl_v1.trial_history`(L504-509) 已是 optional `array<uuid>` "append-only by evaluator"。evidence side-car 写逻辑 `EVIDENCE_LEDGER_DIR='state/runtime/learning/policy_trials_evidence'`(evaluator L18, A3) 已在 code 定义（运行期 dir 尚未 materialize，trialing idle）。evaluator L27 明示 "no learned_policy write-back (trial_history deferred to β)"。→ **F3 = 把已写 trial 的 `trial_id` append 进已存在的 `trial_history`，0 新 schema / 0 新文件**；属 learned_policy 状态变更（Hard Gate 8 **observability-only 边界跨越**，§2 R-β2 论证非 promotion 写）。**约束**：trial_history append 是**就地 YAML 写**，须 re-pass `learned_policy_ghl_v1` validation（含 required `confidence_basis`）→ 故仅写**已合规 GHL 实例**（详 F3 production/legacy 守卫）。

5. **【confidence 现状】** evaluator(`0fe051f5`) 当前**只产 `NEEDS_HUMAN`**（L452/L491 两路径），**不算 confidence**。`confidence_formulas.ghl_confidence_v1`(`9b8c2044`)：`0.2·exec_success_rate + 0.3·operator_agreement_rate + 0.4·business_score + 0.1·regression_pass_rate`，权重和=1.0，`missing_input_policy: fail_closed`，`boundary_output_policy: {0.0,1.0}→requires_review`。**inputs 路径**：`operator_agreement_rate`/`business_score`/`regression_pass_rate` 读 `$.confidence_basis.*`；**`exec_success_rate` 读 legacy path `$.success_signals.exec.success_rate`（不在 confidence_basis 下，3-of-4）** + legacy_alias `$.success_signals.operator.approval_rate`。`confidence_basis` 在 `learned_policy_ghl_v1` **required**，`success_signals.exec.success_rate` 在 legacy-v1 required 块 → 每个合规实例均有 → **legacy-迁移场景唯一缺失输入 = `confidence_basis`**。2a-α F-confidence 实测 legacy 树缺 `confidence_basis` → fail_closed → confidence 当前无法随 flip 跑。**注**：`confidence_basis.operator_agreement_rate` 是**逐 policy** scalar（fixed JSON pointer 读单实例），与 γ 的 **portfolio 级 30d rolling**（d11_kpis reducer）同名不同尺度、不同文件、不同聚合 — **结构性解耦**，β 的 confidence 不依赖 γ。

---

## §1 Contract Surface（2a-β，后果面）

> 每面标注：[新增/复用] · 触碰文件 · schema 影响 · PR 归属。**红队 fold 后 β = 单 β-main PR，0 sealed-schema 触碰。**

### F-flow — Operator Feedback Ingestion（write 侧；β-main）
- **[新增 write 路径]** operator 对某 `trial_id` 的 verdict 表态 → 产 `operator_feedback_v1` 实例（嵌入该 trial object）→ **re-append 整条 policy_trial 行**到 `policy_trials.jsonl`（read 侧 latest-wins 复用，§0.1-C）。
- 载体/schema：**0 改**（`operator_feedback_v1` `4d917aef` + `policy_trial_v1` `21f225d6` 均复用）。read/aggregation 侧：**0 改**（1e producer `5057fc5a` 已消费）。
- 形态：CLI / library-API（对齐 evaluator batch invocation 模型，2a-α OQ-4；**非 daemon**）。`reviewer_id_hash` 由 ingestion 侧按 project-namespace salt 计算（NO PII，pattern `^sha256:[0-9a-f]{64}$`）。
- **ingestion 写侧幂等（NEW invariant，非复用 — 红队 fold）**：producer 只提供 read 侧 latest-wins(by `trial_id`) + late-arrival ledger 去重(`${trial_id}|${feedback_reviewed_at}`)，**均非写侧幂等**。故 β-IMPL **新增**写前 membership 检查：
  - 同 `(trial_id, feedback.reviewed_at)` 重复 ingest → **no-op**（写前查 policy_trials.jsonl 是否已有该 trial 携带同 reviewed_at 的 feedback）。
  - 同 `trial_id` 但**不同** `reviewed_at` 再 ingest → 语义 = **latest-wins 覆盖**（read 侧 by-trial_id 会以最新行覆盖前序 feedback；**须显式声明**，因其改变 day-N d11_kpis 原子——不是隐式 drop）。
- **fail-closed**：ingest 的 trial object 须过 `policy_trial_v1` ajv（含 `operator_feedback` $ref）；invalid → 不 append + 非零退出（复用 evaluator schema-invalid fail-closed 范式）。

### F3 — trial_history 回写（evaluator carve-out；β-main）
- **[新增 evaluator write-back]** evaluator 写完一条 `policy_trial` 后，把 `trial_id` append 进对应 `learned_policy_ghl_v1.trial_history`（chronological, append-only）。
- schema：**0 改**（字段已存在 optional，§0.1-D）。文件：evaluator `0fe051f5`（carve-out）+ 其测试。
- **写入目标守卫（红队 fold — production/legacy 矛盾）**：trial_history append 是**就地 YAML 写**，须 re-pass `learned_policy_ghl_v1` validation（required `confidence_basis`）。故：
  - **仅写已合规 GHL 实例**（带 `confidence_basis` 的 sandbox/candidate）。
  - **production-dir 实例**（如 `state/memory/learned/policies/production/*.yaml`）+ **legacy 缺 confidence_basis 实例**：**skip trial_history 就地写**（否则破 DoD#9 production 0-diff，且 re-validation 因缺 confidence_basis 失败）。改为记入 evaluator report（observability）而非改文件，或 defer 到该 policy 迁移后（与 F2/D-β3 一致：不就地改写 legacy/production YAML）。
- **Hard Gate 8 边界论证**（§2 R-β2）：trial_history 是 trial verdict 的 **back-reference 累积（observability）**，**非** candidate/promotion/production 写、**非** policy 内容/状态升级；`validation_status` / `promoted_at` / production dir 内容一律不动。
- **idempotency**：同 `trial_id` 不重复 append（写前 membership 检查）。
- **partial-write 安全**：先 trial 后 history；history 回写失败不回滚已写 trial（trial = SSOT，history = 派生索引，可由 policy_trials.jsonl 重建）。

### F2 — Confidence 产出 + legacy 迁移（evaluator carve-out；β-main）
- **[新增 confidence 计算/写]** 用**冻结**的 `ghl_confidence_v1` 公式算 confidence（3-of-4 输入读 `confidence_basis.*` + exec 读 legacy path，§0.1-5），写入 `learned_policy_ghl_v1.confidence` + 落 `confidence_basis` inputs。
- **正交性（D-β2 裁定）**：confidence 是 learned_policy 的**评分维度**，**不**改 `system_verdict`（仍 NEEDS_HUMAN）、**不**引入 promotion gate（`confidence_formulas` 自述 "Does NOT introduce a new promotion gate"）。β 只让 confidence "可算、可存"（readiness 维度），**不 gate 任何 β 内转移**。
- **不解冻 `confidence_formulas.yaml`**（§0.1-5）：公式权重/语义正确，β 无需改 → 0 carve-out 于该文件。
- **boundary 0.0/1.0 落点（红队 fold — DoD#3 sink）**：`requires_review` 标注 **落 evaluator report 输出字段**（machine-checkable），**不**落 learned_policy 文档（无此字段）、**不**走 `execution_tiers`（promotion-tier，β OUT）。DoD#3 据此可证伪。
- **legacy 迁移（D-β3 裁定 = forward-only + sidecar-backfill）**：
  - **forward**：新评估的 GHL policy 出生即带 `confidence_basis`（required 满足）→ confidence 可算。
  - **legacy（缺 confidence_basis）**：`missing_input_policy=fail_closed` → **不就地改写 legacy YAML**（避免污染历史 SSOT + 触 dual-schema routing 风险，learned_policy_ghl header L16-20 drift discipline）；改为 confidence **fail_closed skip + evaluator report 标 `confidence_unavailable`**（诚实表达"无历史 operator 数据不可回算"）。任何回填走 **sidecar overlay**（不动原文件），且回填 = 后续可选项，非 β 必交。
  - migration 是 **spec**（契约 + 处置规则），IMPL 的回填工具可 defer。

### F-predicate — 2a→2b Transition Predicate（NEW read-only gate-check；β-main）
- **[新增 read-only gate-check]** 判断 trialing 观察窗是否满足转 2b（RUNBOOK §2.2 step7 占位的 predicate，GHL-RUNBOOK L158/L182-185）。**消费方 = operator（跑 §2.2 playbook）**；β 不据 PASS 自动推进（L7 + 只读 0 写 + R-β1 三重锁）。
- **裁定（D-β6）= 复用 2a-α 三态 per-day + all-of-window PASS 范式**：per-day ∈ {BLOCKED / INDETERMINATE / contrib}，BLOCKED 短路优先，PASS = all-of-window ∧ daysPresent==window ∧ every-day contrib。
- **读什么信号（红队 fold — 字段级 fence + 数据源修正）**：**只读，0 写**，从 sealed `metrics_daily.jsonl` 直读：
  - `policy_trials_breakdown.by_system_verdict`（per-day trial verdict 分布，**已 sealed**，§0.1-2）— 同 exit-gate(2a.1) 读 metrics_daily 的范式，**无 sidecar**。
  - per-day 在场/节律（`daysPresent` vs window）+ d11_kpis 的**可得性字段**（`kpi_unavailable_reasons` / `with_operator_feedback_count` 存在性）。
  - **⛔ Hard-NO（R-β7）**：F-predicate **MUST NOT** 计算任何 windowed `operator_agreement_rate` 或 `critical_false_negative` 聚合 —— 无论窗口长度（7d/14d/30d）。这些 derivation 是 **γ-exclusive**（同 operation 仅窗口长度不同；γ-fence 按 operation-kind 而非仅 30d）。predicate 只可读 per-day 原子的**存在性/分布**，不可 reduce 出 agreement/false-negative gate 量。
- **窗口语义**：观察窗 N 天（RUNBOOK §2.2 step7 = 7-14 天）；predicate 取 **operator-supplied** window，缺省须显式声明而非猜测。
- **缺失处置**：metrics row 缺（`daysPresent<window`）→ 非 PASS（INDETERMINATE）。**无 sidecar 依赖**（红队 fold：原 sidecar-missing 分支随 D-β4 collapse 删除）。

---

## §2 Cross-Cutting Hard Constraints（核验后报告）

### 仍永 frozen（0 触，实测核验）
- File-B `scripts/heartbeat_runner.mjs` `e63cf86c` · 1b import_facts/canonical_json · 1e producer **本体** `5057fc5a`（仅其 read 路径被 β 的 write 流喂数据，**不改 producer 代码**）· `learning_sources.yaml` · AGE/loamwise · scheduler。
- `confidence_formulas.yaml` `9b8c2044`（D-β2 不解冻）· `policy_trial_v1` `21f225d6` · `operator_feedback_v1` `4d917aef` · `metrics_daily_v1` `7caccdf7`（**β 全程 0 触**；red-team fold 后 D-β4 不再有 schema-touching 子 PR）· `learned_policy_ghl_v1` `e67c7c10`（仅写已声明的 optional `trial_history` + required `confidence`/`confidence_basis` 实例字段，**schema 本身 0 改**）。

### Hard-NO（列死）
- **R-β1**：candidate/promotion/production write 路径**永锁**（Hard Gate 8）。β 只动 **trial 层 + trial 的 back-reference/confidence/feedback**。`validation_status` 升级、`promoted_at`、production dir 内容写 = **全 OUT**。
- **R-β2**：trial_history 回写 = **observability-only learned_policy 状态变更**（back-reference 索引，仅写已合规 GHL 实例，§F3 守卫），**非** policy 内容/状态/promotion 写。confidence 写 = **评分维度**，**非** promotion gate。两者均不改 verdict 语义。
- **R-β3**：verdict 仍仅 `NEEDS_HUMAN`（2a-α A5）；β **不扩 system_verdict reason-code 触发面**。
- **R-β4**：Hard Gate 7（首启 dry_run）不违；β 不改 ceiling / ESCALATION_FLAGS（2a-α 已完成面）。
- **R-β5**：30d / 任何跨日 rolling reducer = γ；Phase-4 entry gate = Phase-4 SPEC。**β 不产跨日聚合、不画 Phase-4 gate 逻辑**。
- **R-β6**：任何 sealed schema 改（若未来确需 genuinely-new atom）→ §0.1 显式披露 + **拆独立 PR** + gate 数三源实测写进 DoD 可证伪项。（**当前 β 无此项** —— red-team fold 后 0 schema-touching。）
- **R-β7（红队新增）**：F-predicate **MUST NOT** 计算任何 windowed `operator_agreement_rate`/`critical_false_negative` 聚合（任何窗口长度）；只读 per-day 原子存在性/分布。agreement/false-negative reduction = γ-exclusive。

---

## §3 Phase 2a-β 验收标准（DoD，IMPL 期可证伪）

> 本 SPEC 自身 = **doc-only**（仅新增 `.planning/phase-2a-beta/SPEC.md`）→ 0 schema crack，validate-contracts **19 before==after**（baseline 实测 2026-06-01 = 19/0/0）。下列 DoD 供 **β-IMPL 期**核验。

1. **#1 trial_history 回写**：evaluator 写 trial 后 `trial_id` 出现在对应**合规 GHL** policy 的 `trial_history`；同 trial_id 不重复；history 可由 policy_trials.jsonl 重建（派生性测试）。
2. **#2 trial_history schema 不变**：`learned_policy_ghl_v1` blob == `e67c7c10`（0 改）。
3. **#3 confidence boundary 可证伪**：boundary 0.0/1.0 → **evaluator report 输出字段**标 `requires_review`（machine-checkable sink，非 policy 文档）；带 confidence_basis 的 GHL policy → confidence == `ghl_confidence_v1` 输出（权重和=1.0 校验）。
4. **#4 confidence legacy fail-closed**：缺 confidence_basis 的 legacy/production policy → confidence **不就地写**、report 标 `confidence_unavailable`、evaluator 非零退出（不 default 0/0.5）。原 YAML 字节不变。
5. **#5 confidence_formulas 不解冻**：blob == `9b8c2044`（0 改）。
6. **#6 verdict 不变**：system_verdict 仍仅 `NEEDS_HUMAN`；reason-code enum 不扩。
7. **#7 feedback ingestion 写侧幂等（NEW invariant）**：同 `(trial_id, reviewed_at)` re-append → no-op（写前 membership 检查）；同 trial_id 不同 reviewed_at → latest-wins 覆盖且 day-N d11_kpis on-time 原子相应变化（显式确定性，非隐式 drop）；late→late-arrival ledger；invalid→不 append + 非零退出。
8. **#8 operator_feedback schema 不变**：blob == `4d917aef`（β 不改；γ 外锚稳定性）。
9. **#9 Hard Gate 8 + production 0-diff**：0 candidate/promotion/production write；`validation_status`/`promoted_at`/production dir 内容全 0-diff（grep + 字节实证）；trial_history 写**跳过 production/legacy-incomplete 实例**（§F3 守卫）→ 不与本项冲突。
10. **#10 frozen 0 触**：File-B `e63cf86c` / 1b / 1e producer 本体 `5057fc5a` / learning_sources / AGE / loamwise / scheduler 全 0-diff。
11. **#11 0 sealed-schema 触碰（red-team fold）**：`metrics_daily_v1` `7caccdf7` / `policy_trial_v1` `21f225d6` / `operator_feedback_v1` `4d917aef` / `confidence_formulas` `9b8c2044` / `learned_policy_ghl_v1` `e67c7c10` 全 0-diff；**无 sidecar / 无 schema-touching 子 PR**。
12. **#12 2a→2b predicate 三态 + 字段 fence**：BLOCKED 短路优先；PASS=all-of-window ∧ daysPresent==window；只读 0 写（0 副作用断言）；**predicate code 含 0 处 windowed agreement_rate/critical_false_negative reduction**（R-β7 负向断言，grep 实证）。
13. **#13 γ 解耦 + 完整输入锚**：β 不产跨日聚合；γ 的输入锚 = `d11_kpis`(`7caccdf7`) + `operator_feedback_v1`(`4d917aef`) + **`policy_trial_v1`(`21f225d6`，供 γ 重建 late-arrival)** 由 β 保持 sealed。
14. **#14 validate-contracts**：β == 19（0 crack，单 β-main PR）。

---

## §4 Required Test Coverage（β-IMPL 期，SPEC 预置矩阵）

- **trial_history**：append 生效（合规 GHL 实例）/ 同 trial_id 幂等 / 多 trial chronological / 重建一致性 / 回写失败不回滚 trial / **production+legacy-incomplete 实例 skip 就地写**（DoD#9 守卫）。
- **confidence**：forward 公式正确（含 3-of-4 输入路径 + 权重和校验）/ boundary 0.0&1.0→report `requires_review` / legacy 缺 confidence_basis→fail_closed skip+report `confidence_unavailable`+非零退出 / YAML 字节不变 / legacy_alias divergence>5%→WARN。
- **feedback ingestion**：合法 re-append→latest-wins→d11_kpis on-time 原子变化 / late(日期不符)→late-arrival ledger / invalid schema→拒 + 非零 / 同(trial_id,reviewed_at) no-op（写侧 membership）/ 同 trial_id 不同 reviewed_at→latest-wins 覆盖确定性 / reviewer_id_hash NO-PII pattern。
- **predicate**：三态 per-day / BLOCKED 短路 / PASS=all-of-window / daysPresent<window→非 PASS（INDETERMINATE）/ 只读断言（0 写副作用）/ **R-β7 负向**：predicate 不含 windowed agreement_rate/critical_false_negative reduction（读 by_system_verdict 分布 OK，reduce 出 gate 量 NOT）。
- **invariant 守卫（负向）**：candidate/promotion/production write 不触发 / verdict 不扩 / confidence_formulas 不读改 / 5 个 sealed schema 全 0-diff / production dir 内容 0-diff。
- **CI**：β 复用 1c(policy_trial_evaluator)/1e(metrics_daily) 既有 suite + 新 β predicate/feedback/confidence suite（prefix-named node:test 须独立 workflow，对齐 2a-α A7）。

---

## §5 Resolved Decision Log（6 fork 全裁；含红队 fold 重裁）

| ID | 裁决 | 依据（ground-truth）|
|----|------|--------------------|
| **D-β1** trial_history 载体 | **复用既有 `policy_trials.jsonl`(records) + evidence side-car(A3) + `trial_history`(back-ref pointer)；0 新 schema / 0 新文件** | §0.1-D：三者均已 code/schema 定义；evidence-ledger 模式已 3 度复用（1c/1e），不造第 4。F3 = 把 trial_id append 进已存在 optional 字段 |
| **D-β2** confidence 写路径 | **confidence = learned_policy 正交评分维度（非 verdict 子字段）；不解冻 `confidence_formulas`；不引 promotion gate；boundary 标注落 evaluator report（非 policy 文档/execution_tiers）** | §0.1-5：公式正确、formulas 自述非 promotion gate；verdict 仍 NEEDS_HUMAN（A5）。逐-policy operator_agreement(fixed pointer) 与 γ portfolio-30d 结构性解耦 |
| **D-β3** legacy confidence_basis 迁移 | **forward-only + legacy/production fail_closed skip(report `confidence_unavailable`) + 任何回填走 sidecar overlay（不就地改 legacy YAML）** | learned_policy_ghl header L16-20 drift discipline + missing_input_policy=fail_closed；legacy-迁移唯一缺失输入 = confidence_basis（§0.1-5）；不污染历史 SSOT |
| **D-β4** observability 落点（原"最高风险"）| **⚠ 重裁（红队 HIGH 推翻）：per-day `by_system_verdict` 分布已 sealed(`metrics_daily_v1` L266-287)且 1e 已产 → 0 新 atom / 0 sidecar / 0 独立 PR；F-predicate 直读 sealed 原子。跨日 rollup（若需）= γ** | §0.1-2：指令/α §6 "rollup atom 不在 schema" 对 per-day 维度错误；ground-truth 实测 by_system_verdict required+produced |
| **D-β5** operator feedback atom | **schema 已存在(`4d917aef`)、γ-ready、不造；β 只定 write-flow + 写侧幂等(NEW invariant) + 核验充分性；containment 张力由 re-append latest-wins 化解（§0.1-C）** | §0.1-A/C：3 值 enum + 派生指标优于指令扁平 bool 提议；1e 已消费；producer 不提供写侧幂等 → β 新增 |
| **D-β6** 2a→2b predicate | **复用 2a-α 三态 per-day + all-of-window PASS 范式；read-only gate-check；直读 sealed metrics_daily.jsonl 的 by_system_verdict（无 sidecar）；字段 fence + R-β7 禁 windowed agreement/false-negative reduce；窗口 operator-supplied** | RUNBOOK §2.2 step7 占位；一致性 + 已验证范式；红队 fold 去 sidecar 耦合 + 加 operation-kind fence |
| **D-A**（续）| **β = 单 β-main PR（red-team fold 后 0 schema-touching）：F-flow + F3 + F2 + F-predicate** | Policy 9 Surgical Scope；D-β4 collapse 后无需拆 schema-touching PR |

---

## §6 Out-of-Scope（硬边界 → γ / 2b / Phase-4）

- **γ（独立 fresh-session SPEC）**：30-day D-11 rolling reducer（`Σ per-day d11_kpis ⊎ late_arrivals → operator_agreement_rate≥0.7 软 / critical_false_negative=0 硬`）。
  - **γ 输入锚（红队 fold — late_arrivals 补全）**：`metrics_daily_v1.d11_kpis`(`7caccdf7`, on-time per-day 原子) + `operator_feedback_v1`(`4d917aef`, derivation 定义) + **`policy_trial_v1`(`21f225d6`)**。
  - **⚠ late_arrivals 处置**：γ 的 `⊎ late_arrivals` 项是 load-bearing（异步 feedback 落在与 trial 不同 UTC 日者被 d11_kpis on-time 原子**排除**，进 late-arrival ledger，§0.1-C）。但 `metrics_daily_late_arrivals.jsonl` ledger **记录形无 schema**（`metrics_daily_v1` 仅有 `late_arrivals_ref` pointer L559-571，**un-sealable**）。→ **γ 应从 sealed `policy_trials.jsonl`(`policy_trial_v1` `21f225d6`) 重建 late-arrival**（trial object + 嵌入 operator_feedback 含 `reviewed_at`，可重算 on-time/late 拆分），**而非依赖 un-sealable ledger**。或 γ 自带 `metrics_daily_late_arrivals_v1` schema（schema-touching → γ 自己的独立 PR）。
  - **"不必等 β merge"修正**：γ **可基于已 sealed 契约锚现在起草**（drafting）；但 γ 的运行期真数据须待 β 的 F-flow 写侧 ship（trialing idle 时 0 真 feedback，OQ-2）。drafting 解耦 ✓，runtime 数据依赖 β ✓ —— 两者区分清楚。
- **2b/2c**：candidate 评估 / promotion / crystallizer（D-04）。
- **Phase-4**：30d gate **消费逻辑** + production write。
- **永不在 2a**：candidate/promotion/production write · scheduler · File-B · AGE/loamwise · verdict 语义扩面 · daemon evaluator（OQ-4 batch 假设保持）。

---

## §7 Implementation Plan Skeleton（留给 β-IMPL 指令包 expand）

**PR 结构（red-team fold 后 = 单 PR）**：
- **β-main PR**（**0 sealed-schema 触碰**）：F-flow(ingestion + 写侧幂等) + F3(trial_history 回写 + production/legacy 守卫) + F2(confidence + boundary report sink + legacy 迁移 spec) + F-predicate(2a→2b，直读 sealed by_system_verdict + R-β7 fence)。
- carve-out = evaluator `0fe051f5` + 其测试 + 新 ingestion/predicate mjs + 新 β CI workflow。

**禁触**：File-B / 1e producer 本体 / confidence_formulas / policy_trial_v1 / operator_feedback_v1 / metrics_daily_v1 / learned_policy_ghl_v1(schema) / import_facts / canonical_json / AGE / loamwise / scheduler / candidate-promotion-production write / γ-2b-Phase4 项。
**carve-out**：evaluator `0fe051f5` + 其授权测试。

**实施顺序建议**：F3 + F2(forward) 先（evaluator 内聚）→ F-flow(ingestion，独立 entry)→ F-predicate(直读 sealed metrics_daily，无 PR 前置依赖)。

---

## §8 SPEC Anchor / Version Control

- **base**：`origin/main` `d341e76`（2a-α IMPL squash, PR #157）。
- **branch**：`planning/phase-2a-beta-spec-v1.0`。
- **SPEC 路径**：`.planning/phase-2a-beta/SPEC.md`（与 α 的 `.planning/phase-2a/` 分目录）。
- **上游 sealed anchors**：见 §0（8 条，2026-06-01 实测 blob）。
- **doc-only PR**；**operator UI merge（不自 merge）**。merge 后 post-squash blob 锁 + spawn `project_ghl_phase_2a_beta_spec.md` + 记 D-β5 atom（`operator_feedback_v1` `4d917aef` + d11_kpis `7caccdf7` + policy_trial_v1 `21f225d6`）供 γ 引用。

---

## §9 Findings / Open Items（5-lens 自红队 `wf_8a7ef6c8` fold 见下）

- **F-async-attach（已解）**：containment($ref) vs append-only ledger 张力 → re-append latest-wins（§0.1-C），无 blocker。
- **F-confidence-legacy（裁 forward-only）**：legacy/production 树缺 confidence_basis 不可回算 → fail_closed skip + report 标注 + sidecar backfill 可选（D-β3）。
- **F-γ-coupling（红队修正）**：γ 输入锚补全 late_arrivals 重建源（policy_trial_v1）；"不必等 β"限定为 drafting-against-sealed-anchors，runtime 数据仍依赖 β F-flow（DoD#13）。
- **OQ-β1（留 IMPL/user）**：F-predicate 观察窗缺省天数（RUNBOOK 7-14 区间）— operator-supplied，IMPL 不猜测。
- **OQ-β2（留 IMPL/user）**：confidence forward 是否在 trialing 阶段主动算（readiness）还是 defer 到 2b 评估触发 — 倾向 readiness-only 算+存、不 gate（input scope 仍为 fixed-pointer per-policy，非 γ 30d，§0.1-5）。

### 5-lens 红队 fold（9 confirmed / 9 refuted）

- **2 HIGH（D-β4 推翻，frozen-touch + consistency 双确认）fold**：per-day `by_system_verdict` 已 sealed+produced → D-β4 sidecar/独立 PR 作废（§0.1-2, §5 D-β4, N-6）；F-predicate 直读 sealed 原子（§F-predicate）；β 收敛单 PR（§7, DoD#11/#14）。
- **1 HIGH（F-flow idempotency，consistency）fold**：producer 去重键(`feedback_reviewed_at`, late-arrival ledger 域)非写侧幂等 → ingestion 写侧幂等改为 **NEW invariant**（写前 membership + latest-wins 覆盖语义显式，§F-flow, DoD#7）。
- **1 HIGH（γ anchors，downstream-gamma）fold**：γ `⊎ late_arrivals` 项漏列且 ledger un-sealable → 补 policy_trial_v1 重建源 + 限定 drafting 解耦（§6, DoD#13）。
- **1 MED（F-predicate windowed-reduce 未 fence，scope-bleed）fold**：加 R-β7（禁任何窗口长度的 agreement/false-negative reduce）+ 字段级 fence + 负向 DoD#12（§F-predicate, §2, §4）。
- **1 MED（F-flow key 名/域，frozen-touch）fold**：同上 F-flow（key 名 `feedback_reviewed_at` + 域 = late-arrival ledger，纠正）。
- **1 MED（predicate→sidecar 耦合，consistency）fold**：随 D-β4 collapse，删 sidecar-missing INDETERMINATE 分支（§F-predicate, DoD#12）。
- **1 LOW（trial_history vs production-dir/DoD#9/F2，frozen-touch）fold**：F3 加 production/legacy-incomplete skip 守卫 + 与 D-β3 就地写一致（§F3, R-β2, DoD#9）。
- **1 LOW（DoD#3 requires_review sink 未定，consistency）fold**：sink = evaluator report 字段（§F2 boundary, DoD#3）。
- **9 refuted = proof-of-coverage**（红队全 ground-truthed 命中，0 假阳）：F-predicate 自动推进担忧（只读0写+L7+R-β1 三锁已防）· F-flow on-time key 误读（SPEC 引的是 late-arrival 语义）· evidence side-car "已存在"= code 级（§0.1 即 CODE-AUTHORITATIVE）· §0.1-C key 名 nit（语义引用已指 canonical 行）· §0.1-5 "4 输入"已精确化 3-of-4（本次 fold 顺带修）· DoD#7 on-time 限定已在文本 · "γ 不必等 β"已限定 drafting（本 fold 再强化）· per-policy vs portfolio agreement 结构性解耦（fixed pointer 强制）· Phase-4 gate OUT 确认。

**无 blocker**。5-lens 红队 fold 完成 → v1.0 → doc-only PR（不 merge）。β = 单 PR，0 schema-touching；γ 可与 β 并行起草（§6）。
