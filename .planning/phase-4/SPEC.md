# Phase-4 SPEC v1.0 — GHL execute_limited Entry Gate（11 条前置只读聚合门）

**Status**: v1.0（GHL 治理链首个触及 **Hard Gate 8（production write 永锁）解锁面**的切片；2a 整组（α `d341e76` / β `e523ba1` / γ `052d749`）SPEC+IMPL 全收官；Phase-4 entry gate = 验证 plan §6 11 条前置硬约束全成立的**只读聚合门**，产 `PASS/PASS_WITH_OVERRIDE/BLOCKED/INDETERMINATE` 裁决喂 operator 决定是否启动 execute_limited；**8 fork（D-P4-0..D-P4-7）全裁**：D-P4-7/D-P4-2 经 operator 拍板，余 6 按起草包推荐；**门 ship 后默认仍 0 production write，Hard Gate 8 仍锁**——门先 idle ship，production unlock = 独立下游 exec SPEC；**incorporating 5-lens 自红队 `wf_b30ecd36`（39 agents / ~1.9M tok；2 CRITICAL + 多 HIGH fold，含 ADR L86 冲突披露 + γ row untrusted 重校验）**；2026-06-02；下一步 doc-only PR，**不自 merge**）

> **本 SPEC = 设计/契约定稿，不写实现代码。** 单一聚焦：把 plan §6 的 11 条 Phase-4 前置硬约束聚合成一个**离散 operator 决策点**前跑的只读 gate-check，输出 production-unlock 就绪裁决。**消费 γ 输出（#4/#5）+ 其余 9 条前置**。
> **D-P4-0 首裁（最高优先）**：entry-gate-check **ONLY**——只读 11 条聚合，**0 production write**。门 ship 后 Hard Gate 8 **仍锁**；execute_limited 的生产写本体 + abort 运行时 = 独立、刻意、单独红队的**下游 exec SPEC**。**本 SPEC 全程 0 Hard Gate 8 crack。**

**Out of scope（→ Phase-4 exec SPEC / 2b / 2c，§6 硬边界）**：
- **execute_limited 生产写本体 + abort 运行时** = 真 Hard Gate 8 crossing = 下游 exec SPEC（本门只校验 Runbook abort 段**存在**，**不实现** abort——R-P4-2）。
- **γ reducer 本体 / 1e producer 本体 / evaluator / heartbeat / crystallizer（2b/2c）/ candidate·promotion·production 写路径**：门**纯只读**，0 触上游产物。
- **门不产 KPI 值**：γ 已产 `operator_agreement_rate_30d` / `critical_false_negative_count_30d` / `window_end_utc`；门只**消费 + 裁决**，不重算（R-γ3 边界继承）。

---

## §0 Normative Anchors（两源核验，2026-06-02 实测 @ `origin/main` `052d749`）

| ID | 锚点 | blob | Phase-4 门关系 |
|----|------|------|----------------|
| N-0 | canonical plan `.planning/baseline/GHL-evolution-plan-v4.1.md` §6 L173-184 | — | **11 条前置权威源**（本 SPEC §2 转录，以 plan 为准）|
| N-1 | γ 输出契约 `_meta/contracts/learning/d11_rolling_30d_v1.schema.yaml` | `535935c4` | **#4/#5 数据源**：`operator_agreement_rate_30d`(软) / `critical_false_negative_count_30d`(硬) / `window_end_utc`(freshness) / `kpi_unavailable_reasons`(四态)；门**只读其输出 jsonl** |
| N-2 | γ reducer `.claude/scripts/learning/d11_rolling_30d_producer.mjs` | `96285406` | **范式 + 只读对象**；门读 `state/runtime/learning/d11_rolling_30d.jsonl`，**0 触 reducer 代码** |
| N-3 | 2a-α exit-gate `.claude/scripts/learning/phase_1_exit_gate_check.mjs` | `a510fb14` | **三态 verdict + all-of-window + `--asof` + fail-closed(exit 0/2/1) 范式源**，Phase-4 门**复用此骨架并扩为四态** |
| N-4 | 2a-β predicate `.claude/scripts/learning/trial_observation_predicate.mjs` | `dfbde771` | **只读 gate-check 范式 + R-β7 reduce-fence 继承**（门是聚合算子，无副作用、无写、无 verdict 回写）|
| N-5 | heartbeat File-A `.claude/scripts/learning/heartbeat_runner.mjs` | `54944884` | **#1 数据源**：manifest-validator 连续-PASS streak（heartbeat_state_v2）；门**只读 streak** |
| N-6 | 1e producer `.claude/scripts/learning/metrics_daily_producer.mjs` | `5057fc5a` | **#2/#8 数据源**：`metrics_daily.jsonl` 连续性 + dedupe/conflict 计数；**0 触本体** |
| N-7 | File-B `scripts/heartbeat_runner.mjs` | `e63cf86c` | 永 frozen，0 触 |
| N-8 | GHL ADR `_meta/adr/ADR-Governed-Heuristic-Learning.md` | — | **#10 数据源**：`Status: Accepted` / `Accepted-Date: 2026-05-19`。**ADR commit-anchor (L33) 只管文档落地/provenance，不作为 #11 时钟依据**（#11 锚见 §0.2 SA-1）|

**核验结果**：main HEAD == `052d749` ✓；7 sealed blob（N-1..N-7）两源 0-diff ✓；validate-contracts 现 **20** pass（含 γ `d11_rolling_30d_v1` L530）✓。

---

## §0.1 ⚠ CODE/SCHEMA-AUTHORITATIVE 关键前提（实读核验 2026-06-02）

1. **【γ 输出 = 四态 totality，门 MUST 把 kpi_unavailable 当 NOT-PASS（D-P4-4，全 SPEC 最该被红队盯死）】** γ `d11_rolling_30d_v1`(`535935c4` L32-39) 强制 totality：`kpi_unavailable_reasons` 非空 ⟺ **全四个数值字段（rate / agree_count / eligible_count / critical_false_negative_count）== null**；空 ⟺ 全四个为实值（`critical=0` 才是 hard-gate **PASS 值**）。→ **门绝不可把 `critical_false_negative_count_30d == null`（unavailable）读成 `0`（已过 hard gate）**。空窗/不足窗（`insufficient_window` / `no_trials_in_window` / `no_operator_feedback_in_window` / `denominator_zero_all_needs_more_evidence`）→ 门对 **#5 一律 BLOCKED**（绝不静默 PASS）。这是 catastrophic-false-negative 假阴性面跨 γ/Phase-4 边界的落点。

2. **【γ freshness 强制（D-P4-3，γ R-γ3 显式 defer 至此，非可选）】** γ schema(`535935c4` L123-127) 明示 Phase-4-facing 契约：门读前 **MUST 验 `window_end_utc == 当前 UTC 日 − 1`**（last complete UTC day）；陈旧（window_end 更早）→ 门视为 **unavailable，非 pass**（防 stale-but-complete 旧 0/旧值被误当现态过 hard gate）。→ **#5 freshness 违反 = BLOCKED**（与 §0.1-1 kpi_unavailable 同终态，皆 hard fail-safe，**绝不 override**）。

3. **【三态 → 四态，HARD vs SOFT 分类（D-P4-2，operator 拍板）】** α exit-gate(`a510fb14` L58/231-238)：`VERDICT{PASS,BLOCKED,INDETERMINATE}`，BLOCKED 优先，PASS = all-of-window，fail-closed(exit 0/2/1)。Phase-4 门**扩为四态**：`PASS / PASS_WITH_OVERRIDE(仅 soft) / BLOCKED / INDETERMINATE`。**HARD = 绝对 BLOCK 无 override**（schema 无 override 字段）：#1,2,3,5,6,7,8,9,10,11 + #5 的三条 fail-safe（critical≠0 / freshness-stale / kpi_unavailable）。**SOFT = block-by-default 但可 operator-override-with-recorded-reason**：仅 #4 `agreement≥0.7`。override 永不触任何 HARD 条 / γ-freshness / kpi_unavailable fail-safe。

4. **【soft-override = governed attestation，非空白支票（D-P4-2）】** #4<0.7 → `BLOCKED-soft`；operator 可经 **signed + dated + reason∈枚举 + cite 实测 rate** 的 attestation 把 `BLOCKED-soft → PASS_WITH_OVERRIDE`。override 是 governed/audited artifact（落 evidence-ledger + report），**非静默 flag**，且 **MUST cite 实测值**（如 `agreement=0.62, override_reason=startup_low_volume`）。→ **#4 若 `kpi_unavailable`（无可 cite 实测值）→ BLOCKED，不可 override**（override 需引用实测 rate，无值即无支票）。v1 **不设软门数值地板**（operator 判断 + 审计链即控制；若收紧 = 加「override 须 rate≥X 否则连 soft 都不可绕」硬地板，留作 future tightening）。

5. **【gate 数 20→21 确定性（D-P4-6，γ 教训直接继承）】** 实读 `validate-contracts.mjs` L513-532：`validateContractSchemas()` 遍历**硬编码 `schemaFiles` 数组**（现 15 项含 γ `d11_rolling_30d_v1` L530），每项发 1 `logPass` **无需 runtime instance**（`metrics_daily_v1` L528 / γ L530 即先例）。→ **新 attestation envelope schema 注册进数组 → 确定性 20→21**（编辑 validator = 脚本，非 sealed contract，编辑允许）。门若不另产持久化 governed row（gate-check 输出为 ephemeral report，对齐 α `--json`，**不**注册输出 schema），则**唯一新 schema = attestation envelope → 20→21**。**「守 20」不适用**（喂 production-unlock 门的 operator 背书面必须 governed）。披露式 carve-out + 三源实测 after==21（DoD#10）。

6. **【门 = on-demand gate-check（D-P4-5），非 producer】** Phase-4 启动是**离散 operator 决策点**（不在 scheduler），门按需跑（对齐 α exit-gate `--asof`），无持久化副产物（R-P4-2 / R-β7 reduce-fence）。

7. **【γ row 跨文件边界 = UNTRUSTED，门 MUST 重校验 + 独立断言 totality 双条件（红队 FS-01 CRITICAL / NEW-WINDOW-SUFFICIENT-SHORTCUT，实读核验）】** γ schema(`535935c4`) **零跨字段约束**（grep `dependencies/if/then/oneOf/anyOf/allOf` 全空）：totality 双条件仅活在**注释 + producer write-time ajv**（schema L48-51 明示「contracts gate only proves THIS schema is well-formed; row-level conformance enforced by the reducer at write time」），**JSON Schema 本身允许** `critical=0 + rate=null + kpi_unavailable_reasons=[]` 这类 broken-coupling row ajv-VALID。门读 gitignored `d11_rolling_30d.jsonl`，**跨进程+文件边界**，**不可裸信任** producer write-time invariant（reducer 崩溃中途写 / 被换成 buggy 版 / 未来重构断耦 → 假 `critical=0` on 空窗 → 灾难性假阴性解锁不可逆生产写）。**规范要求**：门消费任何 γ 字段前 MUST **(a)** 用 ajv 对 `d11_rolling_30d_v1.schema.yaml` **重校验该 row**（镜像 F2「schema(ajv 通过)」）；**(b)** 独立断言 **availability 双条件**——γ row 视为 #4/#5 *available* **当且仅当** `kpi_unavailable_reasons==[]` **且**四个数值字段全为非-null 实值；任何违反（`critical=0` 带任一 null 兄弟 / reasons 非空带任一非-null 数值 / reasons 空带任一 null 数值）→ **MALFORMED-ROW → #4/#5 BLOCKED**（绝不读成 PASS）。**(c)** 门 **MUST NOT** 用 envelope 的 `window_sufficient`(bool) 或 `days_present` 作 availability 代理/PASS-shortcut（它们是 hash-OUT convenience，可与 body 不一致）；availability **唯一**判据 = 上述双条件。

8. **【row-selection + freshness 精确相等（红队 FS-02/FS-03/FS-04/P4-C3）】** `d11_rolling_30d.jsonl` 是 append-only 多行（latest-wins by `window_end_utc` + same-hash skip）。门 MUST 明确**选哪行**：取 `window_end_utc` 最大的 row（如并列取 `generated_at_utc` 最新；再校验 §0.1-7 双条件）。freshness 规则用**精确相等**`window_end_utc == asof_day − 1`（默认 `asof = yesterday`，则 == 当前 UTC 日 − 1）：**过去**（更早）→ stale → unavailable → #5 BLOCKED；**未来**（晚于 asof−1，时钟错乱/伪造）→ 同样 unavailable → BLOCKED（freshness 双向，不止防 stale）。**与 `--asof` 协调**：freshness 锚定 `--asof`（非裸 wall-clock now）——backfill/replay 用 `--asof <过去日>` 时，门找 `window_end_utc == 该 asof − 1` 的 row 并对该历史日裁决；wall-clock now 只入 `generated_at_utc`（裁决 OUT）。

9. **【fail-safe 泛化至所有机算源，非仅 γ（红队 NEW-FAILSAFE-NOT-GENERALIZED-8）】** D-P4-4「absent/unreadable source = NOT-PASS」**不止用于 γ #5**：任一 HARD 机算前置（#1 heartbeat 史 / #2 conflicts / #3 counters / #8 metrics_daily）的数据源**缺失/不可读/ajv 不合/不可追** → 该前置 **BLOCKED（fail-closed）**，绝不因「读不到」而默许 PASS。门对所有 HARD 源统一 fail-closed。

---

## §0.2 Stated Assumptions（显式、可证伪，不埋默认）

> **SA-1（#11 日期锚，operator 2026-06-02 拍板 + 红队 fold 修订，D-P4-7）**：
> **门采用 floor = `2026-05-28 + 90d` = `2026-08-26`**（anchor = v4.1-final 落盘 = PR #138 post-squash merge `437e3e1` @ 2026-05-28）。
>
> **⚠ 与 sealed ADR 的冲突（红队 SA1-ADR-CONTRADICTION/SA1-BURIES-DEFAULT，实读核验，必须披露）**：governing ADR `ADR-Governed-Heuristic-Learning.md` **L86 逐字**：「Pilot 1 = negative learning only（time-bounded ≥ 90 天 from baseline **2026-05-09**，即 ≥ **2026-08-09**）」（L71 / D-02 corroborate）。即 **sealed/Accepted（2026-05-19）的 ADR 已显式把 90d 时钟锚在 baseline 2026-05-09**，并 state floor 为 2026-08-09。三个数须 reconcile：**2026-08-07**（05-09+90d 算术正确值）· **2026-08-09**（ADR L86 stated，含 2 天 ADR 自身算术 slip，须 flag upstream）· **2026-08-26**（门采用值）。
>
> **更正一**：本 SPEC v0 草稿曾以「ADR commit-anchor 教条」为 05-28 时钟依据——**此引用错误**。ADR commit-anchor 子句（L33）只管 *document-reference SHA provenance*（「no pre-squash SHA is normative」），**不管 Pilot-1 90d 时钟起点**。撤回该依据。
> **更正二**：门采用的 2026-08-26 **不是 ADR-derived，而是刻意 stricter-than-ADR 的 operator floor**，**唯一依据 = 不可逆守恒**（选更晚 floor 几乎零成本——顶多 operator 晚 ~17–19 天才能决议——却挡住「过早解锁不可逆 Hard-Gate-8 生产写」的尾险，payoff 不对称偏晚锚）。门为不可逆解锁采纳 *necessary floor ≥ max(ADR floor, 2026-08-26)*。
>
> **保守值 dominance（强化理据，红队 PLAN-LUODI-AMBIGUITY）**：候选锚有四（authored 05-09→08-07 算术 / ADR-stated 08-09 / plan-history 05-10→08-08 / merge 05-28→08-26）。**08-26 = 四者最大**，故采纳它对「落盘语义」之争 **robust**——无论哪个语义胜出，08-26 都 ≥ 其 floor，永不过早解锁。这把日期歧义从「必须先解决才能定门」降级为「不影响门安全性的上游 reconcile」。
>
> **ADR errata TODO（operator 已定 — 独立小 PR，不塞本 #162）**：ADR L86 走 errata 仅作事实/澄清——(1) 修 `2026-05-09 + 90d` 算术 slip：`≥ 2026-08-09` 澄清为 `≥ 2026-08-07`（除非明采 inclusive/其他口径）；(2) 澄清 commit-anchor (L33) 只管文档落地/provenance，不管 Pilot-1 90d clock。**不把 ADR 强改成 05-28 anchor**——Phase-4 的 2026-08-26 是 SPEC 侧额外保守 operator floor，独立于 ADR 锚。门逻辑（floor = anchor + 90d，可改 anchor 不改骨架）对各取值均成立。
>
> **SA-2（#11 floor 是必要条件，非门本身，D-P4-1/D-P4-7）**：#11 = 「日期门 + operator 背书」。门只算 `elapsed ≥ 90d from 2026-05-28` 作**必要 floor**；**真满足靠 operator 的 Pilot-1 non-goal 复审决议 attestation**（§5）。floor 未到 **或** attestation 缺/无效 → #11 非 PASS。

> **SA-3（#2 `dedupe 稳定` 谓词收紧，v1 保守默认）**：plan §6#2「dedupe_hit/DUPLICATE_CONFLICT 比例稳定」为定性表述。v1 门取**保守谓词**：trailing window 内 **0 条未决 `DUPLICATE_CONFLICT`**（`state/runtime/learning/fact_conflicts/`，plan D-13）**且** dedupe 管线连续 emit → PASS；任一未决 conflict → BLOCKED。可被 operator 收紧/放宽（改为比例阈值）；改谓词不改门骨架。

> **SA-4（#3 `0 重大异常` 谓词，红队 P4-C1，v1 保守默认）**：plan §6#3「dry_run/sandbox 期 0 重大异常」无机器谓词。v1 门取**保守谓词**：trailing 30 UTC-day 窗内 fail-closed counter（各 producer KIND-* fail-closed 事件 / incident ledger）**总和 == 0** → PASS；>0 → BLOCKED。**数据源 + 窗口须 IMPL pin**（建议复用 metrics_daily 已聚合的 fail-closed 计数 + `state/runtime/learning/` incident 落点）。可被 operator 收紧（按严重度分级）；改谓词不改骨架。

> **SA-5（日期门 UTC + #10 cooling，红队 FLOOR-UTC-UNSPECIFIED/ADR-10-COOLING-UNDERSPECIFIED）**：所有日期门用 **UTC 日历日**比较（与 γ `window_end_utc`/α `--asof` 同基准），不用本地时。#11 floor：`floor_utc_date(now or --asof) − floor_utc_date(2026-05-28) ≥ 90` 整日（anchor merge `437e3e1` @ 2026-05-28 04:10Z，取其 UTC 日历日 2026-05-28）。#10 cooling = ADR lifecycle 明示的 **24h**（ADR「First/Second 24h cooling」）：`Status==Accepted` 且 `Accepted-Date(2026-05-19) + 24h < now` → #10 PASS-able（现已远超）。

> **SA-6（verdict 有效期防 TOCTOU，红队 NEW-VERDICT-TOCTOU-UNLOCK）**：门产 verdict 是 point-in-time 快照；operator 的不可逆 Hard-Gate-8 解锁动作与 gate-check 之间存在 TOCTOU 窗。v1 要求：门 report 带 `generated_at_utc` + `valid_for_asof`(= asof 日)；**operator 解锁前 MUST 重跑门取 fresh PASS**（解锁动作绑定「当日 fresh PASS」，陈旧 PASS 不可用作解锁凭据）。真正的 TOCTOU 闭合（解锁动作内联门检查）属下游 exec SPEC（解锁本体在那里），本门只规定 verdict 时效契约。

> **SA-7（#7 RUNBOOK abort 段存在性谓词，红队 R-P4-2/P4-C9，v1 保守）**：门对 `_meta/docs/GHL-RUNBOOK.md` 检 **§Phase-4-abort 段存在**（标题锚 + 非空正文 + 含 execute_limited abort 步骤关键标记，确切谓词 IMPL pin）。**实读现状：该段不存在**（现 RUNBOOK 仅 heartbeat 级 kill switch L330）→ 门现产 BLOCKED = 正确 idle 态；该段属**下游可交付**（Phase-4 exec SPEC 期补，门只校验存在不实现 abort，R-P4-2）。

---

## §1 Contract Surface（Phase-4，两交付：gate-check 设计 + attestation envelope schema）

### F1 — execute_limited Entry Gate-Check（NEW；纯只读聚合，on-demand）
- **形态（D-P4-5）**：on-demand CLI gate-check（脚本落点建议 `.claude/scripts/learning/phase4_entry_gate_check.mjs`，IMPL 期定），对齐 α exit-gate：`[--asof <YYYY-MM-DD>] [--json] [--help]`（**无 `--window`**——Phase-4 11 条各自定义窗口/锚，R-P4-2 fence，对齐 R-γ4）。默认 `--asof = yesterday`（last complete UTC day）。
- **纯只读 + reduce-fence（R-β7 继承，N-4；红队 R-P4-1 收紧）**：门对**所有上游/governed/contract 路径 0 写**。唯一允许的 write = ephemeral `--json` stdout report，**及（可选）一条本地 gitignored 审计行**落 `state/runtime/learning/phase4_gate_audit.jsonl`（**非 governed row、非 contract、不注册 schema、永不被门读回作输入、不影响裁决**——纯人审计 trail）。该审计写**不构成** production/candidate/promotion write，Hard Gate 8 不受影响（R-P4-1）。门**不回写** verdict 到任何上游。
- **输出**：四态 verdict（§4）+ per-prereq breakdown（每条 11 前置的 state + 证据指针 + unavailable reason）+ `generated_at_utc`。`--json` = 完整 report；exit code 对齐 α（PASS/PASS_WITH_OVERRIDE → 0；BLOCKED/INDETERMINATE → 2；bad args/IO → 1）。
- **裁决纯函数**：window→verdict 为纯、可单测核心（对齐 α `a510fb14` L201-242）；wall-clock 仅入 `generated_at_utc`（hash/裁决 OUT）。

### F2 — Phase-4 Prereq Attestation Envelope（NEW schema；governed operator 背书面）
- **新 schema** `_meta/contracts/learning/phase4_prereq_attestation_v1.schema.yaml`（governed → 注册进 `validate-contracts.mjs` `schemaFiles` → **确定性 20→21**，§0.1-5）。
- **覆盖两类背书（discriminated，单 schema → 单计数增量）**：
  - `attestation_type: prereq_attestation` → #6 kill_switch 演练 / #9 negative-learning production-validated 判定 / #11 Pilot-1 复审决议。
  - `attestation_type: soft_override` → #4 软门 override（§0.1-4）。
- **公共字段集（v1）**：`schema_version`(const) · `attestation_type`(enum) · `prereq_id`(enum: `kill_switch_drill`/`negative_learning_production_validated`/`pilot1_nongoal_review`/`soft_agreement_override`) · `attested_at`(date-time) · `reviewer_id_hash`(`^sha256:[0-9a-f]{64}$`) · `statement`(被背书断言) · `evidence_refs`(array of repo-relative pointers/ledger ids) · `additionalProperties:false`。
- **per-prereq required-field 判别（红队 P4-C5，discriminated by `prereq_id`，schema 用 `allOf`/`if-then` 强制）**：
  - `kill_switch_drill`：额外 required `drill_record_ref`（演练记录 artifact 路径）+ `drill_outcome`(enum: passed)。
  - `negative_learning_production_validated`：额外 required `evidence_ledger_ref`（命中 case 的 ledger id）+ `production_observed_ref`。
  - `pilot1_nongoal_review`：额外 required `review_resolution_ref`（复审决议 artifact）+ `review_date`。
  - `soft_agreement_override`：额外 required `target_prereq`(const `operator_agreement_rate_30d`) · `override_reason`(enum，**成员须显式定义防 blank-check，红队 SO-2**；v1 建议 `{startup_low_volume, transient_measurement_dip, known_benign_disagreement_pattern}`，IMPL/operator pin) · **`cited_measured_value`**(实测 rate，如 0.62) · **`cited_window_end_utc`**(被 override 的具体 γ 窗右界，红队 SO-5)。
- **soft_override 绑定校验（红队 SO-1/SO-5，防伪造/防空白支票）**：门**MUST cross-check** `cited_measured_value` == 门当次实读 γ row 的 `operator_agreement_rate_30d`（精确或 IMPL 定容差）**且** `cited_window_end_utc` == 门当次裁决的 fresh 窗 `window_end_utc`。任一不符 → override **无效** → #4 BLOCKED（override 不能 cite 伪造值或为别的/陈旧窗签发）。`cited_measured_value` 为 null/unavailable → 无可 cite → override 不可签发（§0.1-4）。
- **门校验五维（D-P4-1 + 红队 SO-4）**：`presence` + `freshness`（`attested_at` 在 **per-prereq max-age** 内——红队 SO-4：max-age **必须定义**防 replay/stale-reuse，v1 保守默认如 kill_switch_drill ≤30d / soft_override ≤当次 asof 日内 / pilot1_review ≤90d，IMPL pin）+ `schema`（ajv 通过）+ `signature`（`reviewer_id_hash` 形合）+ `binding`（soft_override 的 cited 值/窗绑定校验）。任一维不过 → 背书无效 → 对应 prereq BLOCKED。
- **⚠ reviewer_id_hash 完整性限制披露（红队 SO-3，HIGH，v1 已知残余风险）**：`reviewer_id_hash` 复用 operator_feedback_v1(N-2) 范式，但**仅是 shape-validated 身份串，非密码学签名**——不防伪造/不防抵赖（持有任意 sha256 串即可冒充）。v1 接受此残余风险（与现存 GHL operator_feedback 同级，审计链 + evidence-ledger append-only + binding 校验为补偿控制）。**真密码学签名（detached sig / GPG）= future tightening**，留 schema 扩展位 `signature_block`(optional)。门 v1 的 `signature` 维 = 形合校验，**不**宣称防伪。
- **persisted**：背书实例落 evidence-ledger（append-only，governed by F2 schema），**writer = operator 工具/ops 侧（∉ 门**，R-P4-3）；门**只读**之（不产背书、不改背书）。

---

## §2 11 条前置 · 分类 + 数据源 + 裁决贡献（plan §6 L173-184 权威转录）

| # | 前置（plan §6） | 类型 | 数据源（只读） | HARD/SOFT | 不满足/缺数据 → 门 state |
|---|------|------|------|------|------|
| 1 | manifest validator 30 天连续 PASS | 机算 | **门计算** 30 UTC-day 连续-PASS（源 = File-A heartbeat 运行史 / manifest-validation 连续性）；**注意 `heartbeat_state_v2`(`54944884`) 无 streak 字段**（红队 NEW-PREREQ1：实读确认），streak 非存储态须门派生，**IMPL pin 计算源**（运行 log / metrics_daily manifest 行）| HARD | streak<30 且无 break → **INDETERMINATE**(ramp/wait)；break → **BLOCKED**；源不可读 → **BLOCKED**(§0.1-9) |
| 2 | dedupe 稳定 | 机算 | `fact_conflicts/`（D-13）+ metrics_daily（N-6）| HARD | 未决 conflict → **BLOCKED**（SA-3 谓词）|
| 3 | dry_run/sandbox 期 0 重大异常 | 机算(计数) | fail-closed counters / incident（30 UTC-day 窗，谓词见 **SA-4**）| HARD | count>0 → **BLOCKED**；源不可读 → **BLOCKED**(§0.1-9) |
| **4** | **operator_agreement_rate ≥ 0.7（30d）软** | **机算·γ** | **γ `operator_agreement_rate_30d`（N-1）** | **SOFT** | <0.7 无 override → **BLOCKED**；有效 override → **PASS_WITH_OVERRIDE**；unavailable（无可 cite 值）→ **BLOCKED**（不可 override，§0.1-4）|
| **5** | **critical_false_negative_count = 0（30d）硬** | **机算·γ** | **γ `critical_false_negative_count_30d`（N-1）** | **HARD** | ≠0 → **BLOCKED**；`null`(kpi_unavailable) → **BLOCKED**；`window_end_utc` stale → **BLOCKED**（三条 fail-safe，绝不 override，§0.1-1/2）|
| 6 | kill_switch 演练通过 | operator 背书 | F2 attestation（`kill_switch_drill`）| HARD | 缺/无效背书 → **BLOCKED** |
| 7 | Runbook 完整（含 Phase-4 专属 abort 路径）| 文档存在性 | **锚 `_meta/docs/GHL-RUNBOOK.md` §Phase-4-abort 段存在性**（实读：现 RUNBOOK 无该段，**属下游待建**，门校验存在性，未建→BLOCKED 正确）；存在性谓词见 **SA-7** | HARD | 缺段 → **BLOCKED**（门**不**实现 abort，仅校验段存在，R-P4-2）|
| 8 | metrics_daily.jsonl 可追踪 | 机算 | `state/runtime/learning/metrics_daily.jsonl` 连续性（N-6）| HARD | gap/不可追/不可读 → **BLOCKED**(§0.1-9) |
| 9 | ≥1 negative learning case 在 `production_observed` evidence 验证 | 机算(查询) + operator 判定 | evidence-ledger 查询（源 = `fact_run_outcome_record_v1` / evidence-ledger，**精确 ledger 路径 + `production_observed` 状态字段 IMPL pin**，红队 P4-C2）+ F2 attestation(`negative_learning_production_validated`)；**recency bound**：命中 case 须在 trailing window 内（红队 NEW-PREREQ9，避免单条远古 case 永久满足）| HARD | 0 命中 / 全过期 → **INDETERMINATE**(wait)；命中但「验证」判定缺/无效背书 → **BLOCKED** |
| 10 | ADR 已封板（cooling 期已过）| 日期门 | ADR `Status`+`Accepted-Date`（N-8）| HARD | `Status≠Accepted` 或 cooling 未过 → **BLOCKED**；**现状已满足**（Accepted @ 2026-05-19，cooling 早过）|
| 11 | Pilot-1 non-goal 复审决议（≥90d 自 v4.1-final 落盘）| 日期门 + operator 背书 | floor(`now − 2026-05-28 ≥ 90d`, SA-1) + F2 attestation(`pilot1_nongoal_review`) | HARD | floor 未到（<2026-08-26）→ **INDETERMINATE**(wait)；floor 已到但缺/无效背书 → **BLOCKED**（SA-2）|

> **混合门构成（红队 P4-C10 修正计数）**：**6 条机算（1,2,3,4,5,8）** + 3 条 operator 背书（6,9 部分,11 部分）+ 2 条文档/日期（7,10）。**核心张力 = operator 背书面经 F2 governed attestation 摄入（presence+freshness+schema+signature），而非裸「trust me」**（D-P4-1）。

---

## §3 Gate Verdict 语义（四态，fail-closed，BLOCKED 优先）

```
per-prereq state ∈ { PASS, BLOCKED, INDETERMINATE }   （#4 另有 BLOCKED-soft / PASS-with-override）
gate verdict（聚合，对齐 α BLOCKED-优先 + all-of-window）:
  BLOCKED            : 任一 HARD 条 BLOCKED（含 #5 三条 fail-safe / 缺·无效背书 / #4 unavailable）
  INDETERMINATE      : 0 HARD-BLOCKED，但 ≥1 条仅「not-yet-eligible」(ramp/floor/wait：#1 ramp · #9 0命中 · #11 floor未到)
  PASS_WITH_OVERRIDE : 全 HARD PASS 且 #4 经有效 soft_override（其余条件等同 PASS）
  PASS               : 全 HARD PASS 且 #4 ≥0.7（真实值）
仅 PASS / PASS_WITH_OVERRIDE → operator eligible 启动 execute_limited（exit 0）
BLOCKED / INDETERMINATE → 不解锁（exit 2，fail-closed）
```

- **不可逆面铁律**：HARD 一律 fail-closed；kpi_unavailable·stale 对 hard **一律按 BLOCKED 绝不静默**（§0.1-1/2）。override **只**作用 soft 面，永不触 hard / freshness / fail-safe。
- **idle 态正确性**：activation + 30d 真数据到位前，#5 因 `insufficient_window`(kpi_unavailable) 持续 → 门持续产 **BLOCKED**；#11 floor 未到 → **INDETERMINATE**。**这是正确的 idle 态，非缺陷**（package §6）。门 ship ≠ Phase-4 activation（镜像 2a-α ship≠activation）。

---

## §4 Cross-Cutting Hard Constraints

### 仍永 frozen（0 触，实测核验）
- File-B `e63cf86c`（N-7）· γ reducer `96285406`（只读其 jsonl 输出，N-2）· 1e producer `5057fc5a`（只读，N-6）· evaluator · heartbeat File-A（只读 streak，N-5）· 全 sealed schema · `confidence_formulas` · learning_sources · AGE/loamwise · scheduler。

### Hard-NO（列死）
- **R-P4-1（D-P4-0 选推荐之结果）**：本 SPEC **0 production write**，**Hard Gate 8 仍锁**；门只读聚合。production unlock = 下游 exec SPEC（execute_limited 写本体 + abort 运行时 = 真 Hard Gate 8 crossing）。
- **R-P4-2 边界**：门只产「11 条就绪裁决」；execute_limited 的写逻辑 / abort 运行时 **∉ 本 SPEC**（#7 门只校验 Runbook abort 段**存在**，不实现 abort）。门无 `--window`（各前置自定义窗/锚，对齐 R-γ4）。
- **R-P4-3 只读 + reduce-fence（R-β7 继承）**：门无副作用、不写上游、不回写 verdict、不改任何上游产物（candidate/promotion/production 写路径仍锁；verdict 仍 NEEDS_HUMAN）。**attestation envelope 的 writer ∉ 门**（红队 R-P4-3）：背书由 operator 工具/流程产并落 evidence-ledger（属 exec/ops 侧），门**只读校验**之，既不产也不改背书。
- **R-P4-4 fail-safe 不可绕（D-P4-4，红队 FS-01 fold — 4 条 leg）**：#5 fail-safe → 终态 BLOCKED，**无 override 字段、无路可绕**，四条 leg：**(1)** `critical≠0`；**(2)** `kpi_unavailable`（reasons 非空 / 任一数值 null）；**(3)** `window_end_utc` stale 或 future（§0.1-8）；**(4) totality 违反 / ajv 重校验失败**（§0.1-7）——门**绝不**裸信任 producer write-time invariant，`critical=0` 仅当该 row 独立通过 ajv **且** all-four-real 双条件才算 PASS 值；门绝不把 `null`/malformed 读成 `0`，也不用 `window_sufficient`/`days_present` 作 PASS-shortcut。
- **R-P4-5 override 受控**：soft override 仅 #4，须 signed+dated+reason∈enum+cite 实测值的 governed attestation（§0.1-4），落 evidence-ledger，**非静默 flag**。
- **R-P4-6 gate 数 20→21**：新 attestation envelope schema 注册进 `schemaFiles` → 确定性 20→21（§0.1-5）；披露式 carve-out + 三源实测（继承 γ R-γ6）写进 DoD。

---

## §5 验收标准（DoD，IMPL 期可证伪）

1. **#1 gate-check 脚本**：on-demand CLI（`--asof`/`--json`/`--help`，**无 `--window`**），纯只读，0 写上游；裁决纯函数可单测。
2. **#2 11 条全覆盖**：§2 表每条有 state 映射 + 数据源只读路径 + unavailable→state 行为；per-prereq breakdown 在 `--json`。
3. **#3 四态 verdict**：`PASS/PASS_WITH_OVERRIDE/BLOCKED/INDETERMINATE`，BLOCKED 优先，fail-closed exit 0/2/1（对齐 α）。
4. **#4 D-P4-4 fail-safe（最关键正确性，含红队 FS-01 fold）**：构造「空窗 `kpi_unavailable`/`critical=null`/stale `window_end_utc`」→ 门对 #5 **必 BLOCKED**，**绝不**读成 `critical=0` PASS。**+ broken-coupling 反例**：`critical=0 + rate=null + kpi_unavailable_reasons=[]`（及对称 `reasons 非空 + critical=0`）→ 门 ajv 重校验 + 双条件断言 → **MALFORMED-ROW → BLOCKED**（绝不 PASS）。门 cite `window_sufficient=true` 也不得作 PASS-shortcut（红队反例 §7 必被 BLOCK）。
5. **#5 γ freshness 强制**：`window_end_utc ≠ 当前 UTC 日−1` → #5 BLOCKED（unavailable，非 pass）。
6. **#6 soft/hard 分类**：#4 SOFT（override-able，cite 实测值）；#5 + 其余 9 条 HARD（无 override 字段）；override 永不触 hard/freshness/fail-safe（grep + 单测可证）。
7. **#7 attestation envelope schema**：`phase4_prereq_attestation_v1` 落盘，四维校验（presence/freshness/schema/signature），discriminated 两类（prereq_attestation/soft_override），`reviewer_id_hash` 形合 operator_feedback_v1。
8. **#8 SA-1 锚定**：#11 floor = `2026-05-28 + 90d = 2026-08-26`，写成 §0.2 显式 Stated Assumption（可证伪）；floor 计算单测；SA-2「floor 是必要条件非门本身」体现。
9. **#9 #10 现状**：ADR `Status==Accepted` + `Accepted-Date 2026-05-19` 实读 → #10 现状 PASS-able；SA-3 #2 保守谓词。
10. **#10 gate 数 20→21（确定性）**：注册 `phase4_prereq_attestation_v1` 进 `schemaFiles` → validate-contracts after==**21**（三源实测，before 20）；披露式 carve-out；schema/validator-touching 路径。
11. **#11 0 production write / Hard Gate 8 仍锁**：grep + 功能核验门 0 写 candidate/promotion/production；R-P4-1..R-P4-6 全列死；7 frozen 锚 0-diff。

**红队 fold 追加（§12）**：
12. **#12 γ row untrusted 重校验（FS-01）**：门读 γ row → ajv 重校验 + all-four-real 双条件断言 + 不用 `window_sufficient`/`days_present` 作代理（§0.1-7）；broken-coupling row → BLOCKED。
13. **#13 row-selection + 双向 freshness（FS-02/03/04）**：明确取 `window_end_utc` 最大 row；freshness 精确相等（stale **及** future 皆 unavailable→BLOCKED）；锚定 `--asof` 非裸 wall-clock（backfill/replay 自洽）。
14. **#14 soft-override 绑定（SO-1/04/05）**：override cite 实测 rate + `cited_window_end_utc`，门 cross-check == 当次实读值/窗；per-prereq max-age 防 replay；cited=null→不可签发；reviewer_id_hash 完整性限制已披露（SO-3）。
15. **#15 ADR 冲突披露（SA1-ADR-CONTRADICTION/BURIES-DEFAULT）**：SA-1 撤回 commit-anchor 时钟依据、披露 ADR L86 锚 05-09→08-09（+08-07 算术 slip）、08-26 重述为刻意 stricter-than-ADR floor、ADR amendment 列为独立 operator TODO（不塞本 PR）。
16. **#16 谓词/源补全（P4-C1/C2/C5/C10/NEW-PREREQ1/9）**：#1 phantom source 重述 + #3 SA-4 + #9 evidence 源/recency + #7 SA-7 锚 + F2 per-prereq required-field + footer 6 机算计数 + fail-safe 泛化全机算源（§0.1-9）。

---

## §6 Resolved Decision Log（8 fork 全裁）

| Fork | 裁决 | 依据 |
|------|------|------|
| **D-P4-0** scoping（首裁）| **entry-gate-check ONLY，0 production write，Hard Gate 8 仍锁；unlock = 下游 exec SPEC** | 镜像 2a-α ship≠activation；不可逆面分两 SPEC、独立红队（起草包推荐）|
| **D-P4-1** operator 背书摄入 | **F2 governed attestation envelope（presence+freshness+schema+signature），data-driven 面门直接算** | 背书须 governed 非裸信任；`reviewer_id_hash` 复用 operator_feedback_v1 范式 |
| **D-P4-2** soft/hard 语义（operator 拍板）| **HARD=绝对 BLOCK 无 override（#5 含三 fail-safe + 其余 9 条）；SOFT=block-by-default 但可 governed override（仅 #4，cite 实测值）；四态扩展；v1 无软门数值地板** | operator 2026-06-02；plan「软 vs 硬 hard gate」明文区分；override 同构 D-P4-1 |
| **D-P4-3** γ freshness 强制 | **门 MUST 验 `window_end_utc==当前UTC日−1`；stale→unavailable(非pass)→#5 BLOCKED** | γ R-γ3 显式 defer 至此（schema `535935c4` L123-127），非可选 |
| **D-P4-4** #5 fail-safe 消费（最关键）| **kpi_unavailable/`null`/stale 一律当 NOT-PASS（BLOCKED）；绝不把缺数据读成「0=已过」** | γ totality（schema L32-39）；catastrophic-false-negative 跨边界落点；§7 红队反例必 BLOCK |
| **D-P4-5** 门形态 | **on-demand gate-check（对齐 α `--asof`），非 producer 静态 envelope** | Phase-4 启动是离散 operator 决策点，按需算最贴合（起草包推荐）|
| **D-P4-6** gate 数影响 | **新 attestation schema → 确定性 20→21；披露式 carve-out + 三源实测** | γ 教训直接继承（§0.1-5 实读 validate-contracts L513-532）|
| **D-P4-7** 日期锚（operator 拍板）| **#11 anchor = v4.1-final 落盘 = PR #138 merge `437e3e1` @ 2026-05-28；earliest floor = 2026-08-26；写成显式 SA + floor 仅必要条件** | operator 2026-06-02 拍板更严 operator floor；不可逆守恒偏晚锚 + dominance（08-26 ≥ 全 4 候选 floor）（SA-1/SA-2）|

---

## §7 Required Test Coverage（Phase-4-IMPL 期，SPEC 预置矩阵）

| 类 | 用例 |
|----|------|
| **fail-safe（最关键，D-P4-4）** | 空窗 `kpi_unavailable`→#5 BLOCKED（非 0 PASS）· `critical=null`→BLOCKED · `critical=0`(实值)→#5 PASS-able · stale `window_end_utc`→BLOCKED |
| **soft/hard（D-P4-2）** | #4=0.62 无 override→BLOCKED · #4=0.62 + 有效 override→PASS_WITH_OVERRIDE · #4 unavailable→BLOCKED(不可 override) · #5≠0 + override→仍 BLOCKED（hard 不可绕）|
| **attestation（F2）** | presence 缺→BLOCKED · freshness 过期→BLOCKED · schema 不合→BLOCKED · `reviewer_id_hash` 形不合→BLOCKED · override 缺 `cited_measured_value`→无效 |
| **日期门（SA-1/SA-2）** | #11 floor `now<2026-08-26`→INDETERMINATE · floor 到但缺背书→BLOCKED · #10 ADR Accepted+cooling 过→PASS-able |
| **四态聚合** | 全 HARD PASS+#4≥0.7→PASS · 任一 HARD BLOCKED→BLOCKED(优先) · 仅 ramp/floor→INDETERMINATE · idle 态(activation 前)→BLOCKED(#5 insufficient_window) |
| **fence（R-P4-2/3）** | grep 门无 `--window` · grep 门 0 写 candidate/promotion/production · grep 门无 abort 实现（仅校验 RUNBOOK 段存在）· 纯只读核验 |
| **gate 数（D-P4-6）** | 三源实测 validate-contracts before==20 / after==21 · 注册 `phase4_prereq_attestation_v1` |
| **frozen** | 7 sealed 锚 0-diff（sha256-pin in suite）· γ reducer/1e producer/File-B/evaluator/heartbeat 0 触 |
| **untrusted-row（FS-01/02/03/04）** | broken-coupling row(`critical=0+rate=null+reasons=[]`)→BLOCKED · 对称(reasons 非空+critical=0)→BLOCKED · ajv-fail row→BLOCKED · `window_sufficient=true` 不作 shortcut · 多行取 max `window_end_utc` · future `window_end`→BLOCKED · `--asof` 历史日 freshness 自洽 |
| **override 绑定（SO-1/04/05）** | cited rate≠实读→无效 · cited_window≠当次窗→无效 · cited=null→不可签发 · 过 max-age→无效(replay) |
| **fail-safe 泛化（NEW-FAILSAFE-8）** | #1/#2/#3/#8 源缺失/不可读 → 各自 BLOCKED（非默许 PASS）|
| **per-prereq 判别（P4-C5）** | kill_switch 缺 drill_record_ref→无效 · #9 缺 evidence_ledger_ref→无效 · #11 缺 review_resolution_ref→无效 |
| **日期门 UTC（SA-5/FLOOR-UTC）** | floor 用 UTC 日历日 · #10 cooling 24h from Accepted-Date · #11 floor 2026-08-26 边界 |

---

## §8 Out-of-Scope（硬边界 → Phase-4 exec SPEC / 2b / 2c）

- **execute_limited 生产写本体 + abort 运行时** = 真 Hard Gate 8 crossing = 下游 exec SPEC（门只校验 RUNBOOK abort 段存在）。
- **2b/2c**：crystallizer（D-04）shadow/cutover · candidate/promotion write。
- **KPI 重算 / trial 层 / verdict / confidence**：门纯只读 + 聚合，0 触 γ reducer / 1e producer / evaluator / heartbeat / trial 层 / verdict / confidence_formulas。

---

## §9 Implementation Plan Skeleton（留给 Phase-4-IMPL 指令包 expand）

**PR 结构（schema-touching 确定路径，继承 γ）**：
- **Phase-4-IMPL = schema/validator-touching PR**：新 `phase4_prereq_attestation_v1` schema + 注册进 `validate-contracts.mjs` `schemaFiles`（确定性 20→21，披露式 carve-out）+ gate-check mjs + CI + tests。可拆「schema+validator 子 PR」与「gate-check 子 PR」或合一 PR 内 §0.1 carve-out 披露；三源实测 after==21 写进 DoD#10。
- **依赖解耦**：契约 + 门逻辑设计/实现**现在就能做**，不依赖 runtime。
- **runtime PASS 阻塞**：门算出真 PASS 须 **activation + 30d 真数据**（trialing 跑满 30 天产非-kpi_unavailable γ 值）+ #11 floor 2026-08-26 + operator 背书。activation 卡 **AGE 0d `learning_sources` flip**（外部 blocking）；**Phase-4 earliest PASS ≈ max(activation+30d, 2026-08-26) + operator 背书齐**。门 ship 后真数据到位前持续产 BLOCKED/INDETERMINATE = **正确 idle 态**。

---

## §10 SPEC Anchor / Version Control

- **Anchor**：main `052d749`（2a 整组收官）；7 sealed blob 两源 0-diff（§0 N-1..N-7）；validate-contracts == 20（含 γ）。
- **Branch**：`planning/phase-4-spec-v1.0`（off `052d749`）；SPEC 落 `.planning/phase-4/SPEC.md`；doc-only PR；**operator UI merge（不自 merge）**。
- **Version**：v1.0（8 fork 全裁；D-P4-7/D-P4-2 operator 拍板；待 5-lens 红队 fold）。

---

## §11 Findings / Open Items（红队后回填）

- **F-failsafe（D-P4-4，最关键）**：kpi_unavailable/null/stale 一律 NOT-PASS（BLOCKED），绝不读成 0=已过 hard gate（§0.1-1/§3/DoD#4）。
- **F-freshness（D-P4-3，γ defer 至此）**：`window_end_utc==当前UTC日−1` 强制，stale→unavailable（§0.1-2/DoD#5）。
- **F-override（D-P4-2，operator 裁）**：soft 仅 #4，governed attestation cite 实测值，永不触 hard（§0.1-4/§3/R-P4-4/5）。
- **F-anchor（D-P4-7，operator 裁）**：#11 floor=2026-08-26，显式 SA-1/SA-2（可证伪）（§0.2/DoD#8）。
- **F-gatecount（D-P4-6，γ 继承）**：确定性 20→21，披露式 carve-out（§0.1-5/R-P4-6/DoD#10）。

> **状态**：5-lens 红队 `wf_b30ecd36` 完成并 fold（见 §12）→ v1.0 → doc-only PR（**不自 merge**）。

---

## §12 5-lens 红队 fold（`wf_b30ecd36`，39 agents / ~1.9M tok；33 findings → 22 CONFIRMED / 11 REFUTED）

> 5 lens：failsafe（D-P4-4 重点）· fence（Hard Gate 8）· override（D-P4-2）· anchor（D-P4-7/gate 数）· completeness。每 finding 经默认-refute 对抗验证 + completeness critic 补 5 条 NEW。

**CRITICAL fold（2）**：
- **FS-01（γ row untrusted，最关键）**：γ schema 零跨字段约束，totality 双条件仅注释+producer write-time → 门跨文件边界裸信任会被 broken-coupling row（`critical=0+rate=null+reasons=[]`）骗过 → 假阴性解锁不可逆生产写。**fold**：§0.1-7（门 ajv 重校验 + 独立断言 all-four-real 双条件 + 禁 `window_sufficient` shortcut）· R-P4-4 第 4 leg · DoD#12 · §7 untrusted-row 测试行。
- **SA1-ADR-CONTRADICTION（+ SA1-BURIES-DEFAULT）**：实读 ADR L86 逐字锚 Pilot-1 时钟于 baseline 2026-05-09→≥2026-08-09，且我引的 commit-anchor 教条实际不管时钟 → SA-1 与 sealed ADR 冲突且误引依据。**fold**：SA-1 全重写（撤回错误依据 + 披露 ADR L86 冲突 + 08-07/08-09 算术 slip flag + 08-26 重述为刻意 stricter-than-ADR floor + 保守值 dominance 论证 + ADR amendment 列为独立 operator TODO）· DoD#15。

**HIGH fold**：FS-02（row-selection: max window_end_utc）· FS-03（future window_end→BLOCKED）· SO-1（override cite 须绑实读 rate）· SO-3（reviewer_id_hash 完整性限制披露 + signature_block 扩展位）· SO-4（per-prereq max-age 防 replay）· P4-C1（#3 谓词 SA-4）· P4-C2（#9 evidence 源/recency）· P4-C3（freshness vs --asof 自洽）· NEW-WINDOW-SUFFICIENT-SHORTCUT（§0.1-7 禁代理）· NEW-PREREQ1-PHANTOM-SOURCE（#1 heartbeat 无 streak 字段，重述计算源）· NEW-VERDICT-TOCTOU-UNLOCK（SA-6 verdict 时效）。
**MED/LOW fold**：FS-04（freshness 锚 asof）· R-P4-1（审计-write 收紧为本地非-governed）· R-P4-3（attestation writer ∉ 门）· R-P4-2/P4-C9（#7 SA-7 锚 GHL-RUNBOOK）· SO-5（cited_window_end_utc）· P4-C5（per-prereq required-field）· FLOOR-UTC（SA-5 UTC 日历日）· ADR-10-COOLING（24h）· P4-C10（footer 6 机算）· NEW-PREREQ9（recency bound）· NEW-FAILSAFE-8（§0.1-9 泛化全机算源）· SO-2（override_reason enum 成员）。

**11 REFUTED = proof-of-coverage**（默认-refute 全 ground-truthed）：GATE-COUNT-ACCURATE（20→21 实测准）· FLOOR-NOT-MET-MAPPING-OK（floor 未到→INDETERMINATE 正确）· P4-C7（05-28+90d=08-26 算术正确）· P4-C4/C6（INDETERMINATE 优先级 / #1 ramp 映射，已 internally consistent）· SO-6/P4-C8（schema 注册不校验 instance = 设计如此，与 γ 同范式）· PLAN-LUODI-AMBIGUITY（第四候选 05-10，但被 08-26 dominance 吸收）· FS-05/SO-2 等（已另行最小 fold 或属 IMPL 细节）。

> **⚠ Governance 决策（operator 已定，2026-06-02）**：ADR 走**独立 errata 小 PR**（不塞本 #162），范围仅限事实与澄清：(1) 修 `2026-05-09 + 90d` 算术 slip——`2026-08-09` 澄清为 `2026-08-07`（除非明确采 inclusive/其他口径）；(2) 澄清 commit-anchor (L33) 只管文档落地/provenance，不管 Pilot-1 90d clock。**Phase-4 继续采用 2026-08-26 作更严 operator floor（额外保守门槛，不需把 ADR 强改成 05-28 anchor）**。注：SPEC v0 误把 commit-anchor 当时钟依据是**起草错误（SPEC 侧，已在 SA-1「更正一」撤回）**，非 ADR 错误——errata 不含「撤回 ADR 误引」。门安全不依赖该 errata（dominance 保证）。

**无 blocker**。5-lens 红队 fold 完成 → v1.0 → doc-only PR（**不自 merge**）。
