# Phase 2a-α SPEC v0.1 — GHL `dry_run → trialing` 升级（flip-readiness + reversible authorization）

**Status**: v1.0（user **D-A 分层** + **α 边界**(operator_rollback∈α、30d reducer∈γ) + **7 OQ 全裁** + **1c/1d-test carve-out cement**；**incorporating 5-lens 自红队 `wf_bba76c12`：3 HIGH + 13 MED + 20 LOW，HIGH/MED 全 fold、LOW fix-or-document、9 refuted=proof-of-coverage**，2026-05-31；下一步 PR，不 merge）
**Phase**: GHL Phase **2a-α**（`evaluating_metrics_only → trialing` 的**最小可激活切片**）。GHL 第一次"live write 类升级"的**基础设施面**，非后果面。
**Layer**: liye_os Layer-0 单边。
**Scope（α = flip-readiness + authorization + rollback + runbook activation）** — 5 个 sub-deliverable：
- **2a.1** NEW `phase_1_exit_gate_check.mjs` — Phase-1 出口准则入口检查器（读 `metrics_daily.jsonl`，算 4 准则 7-day streak，输出 `{PASS, BLOCKED, INDETERMINATE}` verdict）。
- **2a.2** EDIT `heartbeat_runner.mjs`（File A，blob `3c30170a`）— ceiling relax：`ESCALATION_FLAGS` 移除 `trial_write_enabled`（1 行）+ 注释/docstring 时间窗修正。
- **2a.3** EDIT `policy_trial_evaluator.mjs`（blob `257cc0fe`）— `--mode live` 二次门：读 heartbeat live state 鉴权，新增 fail-closed reason `not_authorized_for_live`，+ 修正已失真的 "live disabled" posture 文案。
- **2a.4** EDIT `heartbeat_runner.mjs`（同 2a.2 文件）— `operator_rollback` classifyReason 分支（`trialing → evaluating_metrics_only` 优雅降级）；transition schema reason enum **已含** `operator_rollback`（零 schema 改动）。
- **2a.5** EDIT `_meta/docs/GHL-RUNBOOK.md`（blob `e1d820c1`）— 新增 **§2.2 Phase 2a Activation Playbook**（人工激活流程：bootstrap → exit-gate-check → operator confirm → flag flip → rollback）。

**Out of scope（→ β / γ，§6 硬边界 + Hard-NO 列死）**：
- **β（trialing 后果面，后续 fresh-session SPEC）**：`trial_history` 回写（F3）· confidence verdict（F2）+ legacy `confidence_basis` 迁移 spec · rolled-up trial-verdict observability（可能改 sealed `metrics_daily_v1` → 独立 schema-touching PR）· operator feedback flow + 2a→2b transition predicate。
- **γ（Phase-4 prep，独立）**：30-day D-11 rolling reducer（`operator_agreement_rate≥0.7` 软 / `critical_false_negative=0` 硬 = **Phase-4 前置**，非 2a-entry gate）。
- 永 frozen：File B `scripts/heartbeat_runner.mjs`（`e63cf86c`）· 全 1a-1e schema · `import_facts.mjs` / `canonical_json.mjs` / `metrics_daily_producer.mjs` · `emit_fact.py`（AGE）· loamwise · scheduler/cron。

**Drafted**: 2026-05-31
**Anchor for implementation**: 本文件是 Phase 2a-α 实施指令包的 normative input；实施时锁 SPEC blob SHA，禁止悄改。

---

## §0 Normative Anchors

| Tier | Source | 锁定内容 |
|---|---|---|
| N-1 | `GHL-evolution-plan-v4.1.md` **§4**（Phase 2，header L146；2a 行 = **L150**） | **⚠ 引用更正**：Phase 2 是 plan **§4** 非 §3（指令包/历史散文误写 §3——§3 是 Phase 1）。2a 字面行 L150 = `trial_write_enabled=true → current_phase=trialing；7–14 天观察 trial verdict 分布 + golden replay 复现 + negative evidence 命中率；写 trials.jsonl 但不写 candidate` |
| N-1 | 同上 L138-142 | **Phase 1 出口准则 1-4**（= **2a 入口** gate；2a.1 实现 streak/verdict 判定，1e 只产 per-day atom） |
| N-1 | 同上 L173-184 | **Phase 4 前置 11 条**（含 `operator_agreement_rate≥0.7` 30d + `critical_false_negative=0` 30d）= **γ**，**非** 2a-entry（边界纪律：30d reducer 不入 α） |
| N-1 | 同上 §8 D-04（L607）/ D-10（L613）/ D-11（L614） | D-04 = crystallizer 属 2b shadow + 2c cutover（**不入 2a**）；D-10 = `source_commit_sha` 必 pin（2c）；D-11 = operator 指标 agreement≥0.7 软 + false_negative=0 硬（Phase-4 gate） |
| **契约 (carve-out, 首次合法修改)** | 2 文件（§0.1-2） | `policy_trial_evaluator.mjs`（1c）+ `heartbeat_runner.mjs`（1d，File A）；其余全 frozen |
| **契约 (read, frozen)** | `heartbeat_state_v2.schema.yaml`（`4379a0ad`）· `policy_trial_v1.schema.yaml` · `heartbeat_phase_transition_v1.schema.yaml`（`6bccfcfa`）· `metrics_daily_v1.schema.yaml`（`7caccdf7`）· `learned_policy_ghl_v1.schema.yaml` · `confidence_formulas.yaml` | α 读不写；**0 schema crack**（§0.1-4） |
| 复用 (read-only) | 1e `metrics_daily.jsonl` 输出（2a.1 唯一输入）· 1d live state `heartbeat_learning_state.json`（2a.3 鉴权源）· ajv `{strict:false, allErrors:true, validateFormats:false}` | 不自实现 |

**冲突优先级**：CODE/SCHEMA-SSOT（frozen schema + 1c/1d/1e 实现真值）> N-1 plan 散文 > 历史 framing。

### §0.1 ⚠ CODE/SCHEMA-AUTHORITATIVE 关键前提（6-reader ground-truth recon `wf_23b585af` + 实读核验）

1. **evaluator 已有完整 `--mode live` 写路径（指令包"现 dry-run 0 写"被证伪）**：`policy_trial_evaluator.mjs` 默认 `dry_run`（`:565` / CLI `:656`），dry_run 0 写盘；但 `emitPolicyTrial` 的 `if (ctx.mode === 'live')` 块（**`:487-493`**）**已经** `appendFileSync(ctx.trialsOutAbs, ...)`（`:489`，写 `policy_trials.jsonl`）+ `writeExclusive(...)`（`:492`，写 evidence-ledger sidecar）。⇒ **2a.3 不是"建 live 写"，是"给已存在的 live 写加授权二次门"**。当前模块 **0 处** 读 heartbeat/auth（recon 实证）。POSTURE docstring（`:20-24`）+ HELP（`:642`）声称 "Phase 1c locks dry-run-first / live disabled" **已失真**，α 加二次门时**必须同步改**（user 要求 #5）。
2. **carve-out 集（首次合法修改 frozen 1c/1d artifact；user cement）**：α 显式允许改动 = **(a)** `policy_trial_evaluator.mjs` 本体（frozen `257cc0fe`，加二次门 + docstring fix，2a.3）· **(b)** `heartbeat_runner.mjs` File A（`3c30170a`，ceiling relax + operator_rollback，2a.2+2a.4）· **(c)** **1c 既有 live-mode 测试 `src/reasoning/tests/policy_trial_evaluator.test.mjs`**（实测 12 处 `mode:'live'`，须喂 trialing live state，F-1ctest）· **(d)** 新增 α 代码 + 测试 + CI workflow + RUNBOOK §2.2 · **(e)** **1d 既有 heartbeat 测试 `tests/test_heartbeat_v2_runner.mjs`**（ceiling relax 使 `trial_write=true∧evaluator=true∧candidate=false` 派生 trialing 而非 ceiling-block → `CEILING_CASES` trial_write 用例 L219 + RUNNER-enforced 测试 L242-250 回归，**F-1dtest，与 F-1ctest 平行**）。**α 不改**：除 (a) 本体外的任何非测试 1c artifact / 1c/1d golden / fixture 语义（防 IMPL 改 1c/1d 测试被误读越界）。**仍永 frozen**：File B `scripts/heartbeat_runner.mjs`（`e63cf86c`）+ 全 schema + `confidence_formulas.yaml` + `import_facts`/`canonical_json`/`metrics_daily_producer` + AGE/loamwise。
3. **ceiling relax = 真 1 行 + 注释**：`ESCALATION_FLAGS`（`heartbeat_runner.mjs:90-92`）= `['trial_write_enabled','candidate_write_enabled','promotion_enabled','production_write_enabled']`。2a.2 移除 `trial_write_enabled` → 留 `['candidate_write_enabled','promotion_enabled','production_write_enabled']`。`checkCeiling`（`:200-210`）逻辑不变；`detail` 串（`:206`，硬编码 "must be false in Phase 1d ... production_write_enabled is Pilot-1-wide locked"）+ header 注释（`:13-15`,`:87-89`,`:196-198`）须更新时间窗（"1d locks all four" → "2a relaxes trial_write; candidate/promotion/production stay locked"）。**schema combo #4**（`heartbeat_state_v2.schema.yaml:181-189`）仍强制 `trial_write=true ⇒ evaluator_enabled=true` → flip 须 `trial_write=true ∧ evaluator_enabled=true`（schema-legal，无需改 schema）。
4. **α 加 0 schema（gate pass-count 维持 19，可证伪 DoD）**：trial 实写完美 fit `policy_trial_v1`（sealed，8 字段全在，recon 实证无缺字段）；flip 纯 flag（`trial_write_enabled` false→true → `current_phase=trialing`，`heartbeat_state_v2.schema.yaml:132`）；`operator_rollback` reason **已在** `heartbeat_phase_transition_v1.schema.yaml:75-82` 的 4-enum 内（header `:19` 明写 "2a-only, inert in 1d"）。⇒ `validate-contracts.mjs` schemaFiles 数组（14 条）**不增**，pass-count **维持 19**（注册前后无 delta；DoD 守之）。**实测 ground-truth（红队 L3-6 锚）**：`node _meta/contracts/scripts/validate-contracts.mjs` → `✅ Passed: 19 / Warnings: 0`（recon R6 + 红队 L1 live-run + drafting 三次独立测量一致）；DoD#14 = before==after==**19**（α 0 注册 → 0 delta）。
5. **exit-gate（2a.1）只读 `phase_1_exit_signals` + row-presence，不读 `d11_kpis`**：`metrics_daily_v1.schema.yaml:399-459` 的 `phase_1_exit_signals` = `c1_manifest_validator.per_source.{amazon-growth-engine,chaming,loamwise}.{pass,warn,fail}`（**strict PASS-only**：某 source 当日达标 iff `fail==0 ∧ warn==0 ∧ pass≥1`，`:415`）+ `c2_duplicate_conflict_count`（target 0）+ `c2_dedupe_hit_rate`（const `"unobservable_from_disk"`）+ `c4_path_unsafe_reject_count`（PATH_UNSAFE，live-only）；**无 c3 字段**（criterion-3「持续输出」= row 在场/节律，gate 观测，N1）。`d11_kpis`（`:341-394`，operator agreement/false_negative）是 **Phase-4 30d gate** 输入（γ），**不在** 2a-entry 准则（plan L138-142 vs L177-184 两套门）。**为何 2a-entry 结构性不需 operator KPI（OQ-2，防未来读者迷惑）**：`trial_write` 在 **2a 才** enable，入 2a **之前 0 真 trial** → 0 operator feedback atoms → operator KPI 在 2a-entry 时**结构性不可观测**；故 Phase-4 30d gate（=γ）才是其消费者，而非 2a-entry gate。
6. **1c fail-closed 是 COUNTER 非 typed-kind（与 1d 不同）**：`policy_trial_evaluator.mjs` 用 `report.fail_closed += 1` + `report.per_fail_closed.push({reason})`（`:374,:384,:449`），`main()` `return report.fail_closed > 0 ? EXIT.FAIL_CLOSED(2) : SUCCESS`（`:697`）。⇒ user 要求 #3 的 `not_authorized_for_live` **对齐 1c taxonomy = per_fail_closed reason 串（非新 kind enum）** + `report.fail_closed += 1` → exit 2；**不**引入 1d 式 typed-kind（避免 frozen blob `257cc0fe` 大改）。
7. **live state 当前缺盘 = firstBoot**：`state/runtime/learning/heartbeat_learning_state.json` 不存在（recon `ls` 实证）→ 任何 heartbeat run 是 firstBoot 需 `LIYE_HEARTBEAT_BOOTSTRAP_CONFIRM=1`；bootstrap 模板 ships `trial_write_enabled=false`（user 要求 #4：firstBoot 不变，α 不让首启自动进 trialing）。激活前置：先 1d bootstrap run 落 `evaluating_metrics_only` state，再 operator flip（§1 2a.5 playbook）。
8. **ship ≠ activation（user 要求 #1，α 核心不变量）**：α merge 后 live state `trial_write_enabled` 仍 false（或文件仍缺）→ `evaluator --mode live` 二次门 `not_authorized_for_live` fail-closed，**0 trial 写**；ceiling relax 仅"允许" trial_write=true，**不"触发"**。flip 是 §1 2a.5 的人工 Runbook 流程，**最早 2026-06-07**（7-day streak 前置；今日 2026-05-31 = 1e merge Day-0，`metrics_daily.jsonl` 尚不存在）。
9. **operator_rollback ≠ kill_switch（安全对称性）**：`operator_rollback`（`trialing → evaluating_metrics_only`，graceful trial_write true→false）须与 `kill_switch`（`enabled=false → paused`，紧急全停）区分。`classifyReason`（`heartbeat_runner.mjs:350-354`）当前只发 bootstrap/kill_switch/operator；α 加分支：`!firstBoot ∧ prevPhase==='trialing' ∧ 新 phase==='evaluating_metrics_only'` → `reason='operator_rollback'`（actor=operator）。reason enum 已许可（§0.1-4）。
10. **standalone / 无新依赖**：2a.1 exit-gate-check **不 spawn/import** heartbeat/evaluator/importer/producer，只读 `metrics_daily.jsonl`（N3 范式延续 1e）；evaluator 二次门只**读** live state JSON（不调 heartbeat runner）。**0 scheduler/cron**（Pilot-1 invariant）。
11. **完整 file-diff 表面 cement（OQ-7，防 IMPL 期"再发现遗漏"触发 SPEC drift / 红队红线——实施只动这些行号，多一处即 drift）**：
    - `heartbeat_runner.mjs`（File A）：`ESCALATION_FLAGS` 数组 **L90-92**（−`trial_write_enabled`）· `classifyReason` **函数体 L350-354**（扩签名 + operator_rollback 分支）+ **JSDoc L343-349**（删失真句 "operator_rollback ... unreachable in 1d" → "reachable in 2a after trial_write relax"，纯文案）· 调用点 **L474**（传 prevPhase/phase）· ceiling 注释时间窗 **L13-15 / L87-89 / L206**（纯文案；**L196-198 已是 2a 文案，仅核对一致性**，红队 L2-2）
    - `policy_trial_evaluator.mjs`：`evaluatePolicyTrials` live 二次门插入点 **L564-583 区**（mode 解析后、conflict 循环 L611 前；**live-state 读须 try/catch-wrap**，红队 L5-1）· `report` 加 `live_authorized` **L585-607 区** · POSTURE docstring **L20-24** + HELP **L642**（纯文案）
    - `src/reasoning/tests/policy_trial_evaluator.test.mjs`（1c）：**12 处** `mode:'live'`（L213/259/263/333/349/365/384/405/425/438/465/487）seed trialing live state（可加 `seedTrialingState(root)` helper，3-key partial: version=2 ∧ current_phase=trialing ∧ trial_write=true）
    - `tests/test_heartbeat_v2_runner.mjs`（1d，**F-1dtest**）：`CEILING_CASES` trial_write 用例 **L219**（删除或转正向 `→trialing` 断言）· RUNNER-enforced 测试 **L242-250**（期望从 `kind==='ceiling'` 翻为 `current_phase==='trialing'` success）；`deriveCurrentPhase` 既有断言 L169（trial_write=true∧candidate=false→trialing）**不动**（deriveCurrentPhase 未改）
    - NEW：`.claude/scripts/learning/phase_1_exit_gate_check.mjs` + `tests/test_phase2a_alpha.mjs` + `tests/fixtures/phase2a_alpha/` + `.github/workflows/learning-phase2a-alpha-tests.yml`
    - `_meta/docs/GHL-RUNBOOK.md`：新增 §2.2（additive）

---

## §1 Contract Surface（2a-α，5 sub-deliverable）

### 2a.1 — Phase-1 Exit-Gate Check（NEW `phase_1_exit_gate_check.mjs`）

**Module location** = `.claude/scripts/learning/phase_1_exit_gate_check.mjs`（learning 域，与 producer/heartbeat 同目录同风格）。forbidden-name：复合名安全，禁裸 `evaluator`/`trial`/`candidate`。
**导出**：`checkPhase1ExitGate(options)` + `Phase1ExitGateChecker`（class）+ `evaluateWindow(rows, opts)`（纯函数，可单测）。

```
node .claude/scripts/learning/phase_1_exit_gate_check.mjs \
    [--metrics PATH]       # metrics_daily.jsonl 路径；默认 state/runtime/learning/metrics_daily.jsonl
    [--source NAME]        # criterion-1 target source；默认 amazon-growth-engine（Pilot-1 唯一 enabled source）
    [--asof YYYY-MM-DD]    # streak 窗口右端（含）；默认 = 昨日（last complete UTC day）
    [--window N]           # streak 长度；默认 7（Phase-1 准则1「连续 7 天」）
    [--json]               # 打印 Phase1ExitGateReport JSON
    [--help]
```

**算法（read-only；不 spawn）**：
1. 读 `metrics_daily.jsonl`，按 `date_utc` 索引（**latest-wins per date_utc**，对齐 1e `--regenerate` append 语义）。坏行 skip+count；文件缺 → verdict `INDETERMINATE`（无数据）。
2. 取 `[asof-(window-1) .. asof]` 共 `window` 个 UTC 日。
3. **per-day 三态分类（OQ-1 refine：区别"显式失败"vs"数据缺失"——后者 = AGE 那日没 emit / `learning_sources` flip 前的常态，**不可误判 BLOCKED**，否则 OQ-5 长链上拖死 verdict）**。对 window 内每个 UTC 日，按 `--source` 读该日 row 的 `phase_1_exit_signals`，**按 BLOCKED-day → INDETERMINATE-day → STREAK-contrib 顺序首命中赋值 `per_day[].classification`（三态短路求值，谓词非并集；BLOCKED 先判，红队 L3-1）**：
   - **BLOCKED-day（显式失败，先判）**：C1 `fail>0 ∨ warn>0`（manifest 真坏，strict PASS-only §0.1-5）**∨** C2 `c2_duplicate_conflict_count>0`（dedupe 误判）**∨** C4 `c4_path_unsafe_reject_count>0`（path traversal）。
   - **INDETERMINATE-day（非 BLOCKED ∧ 数据缺失，streak resets）**：row 缺失（C3 断）**∨** row 在场但 `phase_1_exit_signals` 缺/partial（防御性 optional-chaining 读，hand-rolled/pre-1e row，红队 L4-6）**∨** C1 `pass==0 ∧ fail==0 ∧ warn==0`（source 那日没 emit）。**空日两形态**（row-absent / row-present-AGE-`{0,0,0}`，取决于 1e producer 在 AGE 未 emit 日写不写 row，红队 L3-3）均 INDETERMINATE-day，分别落 `days_missing[]` 与 `per_day[].row_present=true`，verdict 等价。
   - **STREAK-contrib（兜底，干净达标日）**：row 在场 ∧ C1 `pass≥1 ∧ fail==0 ∧ warn==0` ∧ C2 `dup==0` ∧ C4 `path_unsafe==0`。
4. **window → verdict（fail-closed，非 PASS 一律 exit 2）**：
   - **BLOCKED**（exit 2，**优先级最高**）— window 内**任一** BLOCKED-day（显式失败 = 硬阻止 flip，需人工介入修）；report 列 `blocked_days[]` + `failed_criteria[]` + per-day 证据。
   - **PASS**（exit 0）— **单一判据（红队 L3-2）**：`0 BLOCKED-day ∧ days_present==window ∧ window 日全 classification=='STREAK-contrib'`（**all-of-window，非 `streak_len>=window`**；`streak_len` 仅诊断字段非判据，避免双 source-of-truth）。
   - **INDETERMINATE**（exit 2）— 0 BLOCKED-day ∧ ≥1 INDETERMINATE-day（无显式失败但 all-of-window 未满 = 数据不足/未起算；**这是 AGE emit 前 / ramp-up 期的 steady state**，尚不能 flip 但非被阻，时间会解）。e.g. day1=INDETERMINATE ∧ day2-7=STREAK → INDETERMINATE（6<window=7）。
5. **fail-closed 纪律**：任何非 `PASS` → exit 2（"do not flip"）。verdict 字段区分 **BLOCKED**（显式失败，需修）vs **INDETERMINATE**（等数据）。gate 是**入口检查器**，不改任何状态、不触发 flip（flip 在 2a.5 人工流程）。

**Phase1ExitGateReport**：
```js
{
  verdict: "PASS" | "BLOCKED" | "INDETERMINATE",
  source: "amazon-growth-engine",
  window: { start_utc, end_utc, length: 7 },
  days_present: 7, days_missing: [],
  per_day: [{ date_utc, classification: "STREAK-contrib"|"BLOCKED-day"|"INDETERMINATE-day",
              row_present, c1: {pass,warn,fail}, c2_duplicate_conflict_count, c4_path_unsafe_reject_count }],
  blocked_days: [],        // dates with explicit failure (any one => verdict BLOCKED)
  streak_len: 7,           // DIAGNOSTIC ONLY (trailing consecutive STREAK-contrib); PASS 判据是 all-of-window 非 streak_len
  failed_criteria: [],     // which of c1/c2/c4 caused any BLOCKED-day
  generated_at_utc: "<iso8601+tz>"
}
```

### 2a.2 — Heartbeat Ceiling Relax（EDIT `heartbeat_runner.mjs`，File A）

- **唯一功能改动**：`ESCALATION_FLAGS`（`:90-92`）移除 `'trial_write_enabled'` → `['candidate_write_enabled','promotion_enabled','production_write_enabled']`。`checkCeiling`（`:200-210`）逻辑不变（仍 filter any-true → fail-closed kind=`ceiling`）。
- **MUST-STAY-LOCKED**（α 后仍 ceiling-block）：`candidate_write_enabled`（2c）· `promotion_enabled`（Phase-4）· `production_write_enabled`（**Pilot-1-wide / Hard Gate 8，永不在 2a 放**）。
- **注释/docstring 时间窗修正**（user 要求 #5，纯文案非逻辑；红队 L2-2 精确化）：**仍含旧时间窗的具体行** = `:206` detail（"must be false in Phase 1d" → "Phase 2a relaxes trial_write_enabled; candidate/promotion/production stay locked, production_write Pilot-1-wide per Hard Gate 8"）· `:13-15`（header "1d locks the 4"）· `:87-89`（"1d locks all four false"）。**`:196-198` checkCeiling docstring 已部分 2a 化**（L197 已写 "2a relaxes trial_write_enabled"）→ **仅核对一致性、不盲改**（防 §0.1-11 "多一处即 drift" 困惑）。
- **不变**：schema combo #4 仍要求 `trial_write=true ⇒ evaluator_enabled=true`（runner `checkInvalidCombos:177-179` + schema `:181-189` 双层，α 不动）。

### 2a.3 — Evaluator Live 二次门（EDIT `policy_trial_evaluator.mjs`）

- **seam = up-front 鉴权（user Q&A OQ-4，提议 up-front 非 per-trial）**：`evaluatePolicyTrials`（`:564`）解析 `mode` 后（`:565`），若 `mode==='live'`，在处理任何 conflict（`:611`）**之前**做一次授权检查 → 失败即 fail-closed return（**0 trial 处理/写**，落实 ship≠activation）。
- **鉴权读源**：`${rootDir}/state/runtime/learning/heartbeat_learning_state.json`（与 heartbeat `LIVE_STATE_REL`(`:64`) 同路径；fixtures rootDir seam 一致）。**IMPL 复制同一相对路径字面量，不 import File-A 常量**（避免建 1c→1d 模块耦合反扩 blast radius，红队 L2-1）；`learning/` 是 CODE-SSOT，schema header 的 `proactive/` 是 v1-dormant decoy（`metrics_daily_v1.schema.yaml:466`），**绝不读 proactive/**（红队 L1-3）。
- **`not_authorized_for_live` 触发条件（user 要求 #3，4 类全覆盖；**全部 fail-closed exit 2，0 trial 写**）**：
  1. live state 文件**缺失**；
  2. **shape 错**（不可 parse / `version !== 2` / 缺 `current_phase`）。**`version` 用严格整数 `=== 2`**（字符串 `"2"` / 缺失 / 其它 → deny，fail-closed 方向不做类型强转，红队 L3-5）。**live-state 读必 try/catch-wrap**：`JSON.parse` throw 须 catch → not_authorized（shape 错），**不可** propagate 到 `main()` `:684`（会误映 exit 1 而非 exit 2，红队 L5-1）。
  3. `trial_write_enabled !== true`；
  4. `current_phase !== 'trialing'`。**条件 3/4 非冗余（红队 L3-4）**：live state 是 operator 手写，可能 `trial_write=true` 但 `candidate_write=true`（`deriveCurrentPhase:153-155` 派生 `candidate_writing` 而非 `trialing`）；要求 `current_phase==='trialing'` 是对派生一致性的 defense-in-depth，只在严格 trialing 态放行（fail-closed 收窄越权态）。
- **taxonomy 对齐 1c（§0.1-6）**：命中任一 → `report.fail_closed += 1` + `report.per_fail_closed.push({reason: 'not_authorized_for_live', detail})` + `report.live_authorized = false` + 立即 return；`main()` 既有 `:697` 逻辑产 **exit 2**。**不**引入新 kind enum（faithful 1c counter taxonomy）。`dry_run` 模式**不**鉴权（不写盘，无需授权；维持 1c 现状）。
- **docstring fix（user 要求 #5）**：`:20-24` POSTURE 块 + HELP `:642` 改为「`dry_run` 默认 0 写；`live` 受 heartbeat `current_phase==trialing` 二次门授权（Phase 2a-α）」——去掉已失真的 "Phase 1c locks dry-run-first / live disabled" 绝对禁止文案。
- **taxonomy 取舍（OQ-3，有意决定）**：保 1c counter 体系 = **consistency-with-1c-evaluator > fail-closed-taxonomy-uniformity-with-1d**；blast radius on frozen `257cc0fe` 最小化（不引 1d 式 typed-kind 重构）。
- **invocation-model 声明（OQ-4，防未来 daemon 潜伏 bug）**：up-front 一次性鉴权的前提 = **evaluator 是 batch invocation（minute-scale，manual/library CLI）**；**long-running daemon 模式不在 α scope**——若未来改 daemon，鉴权-时滞窗口（authorize 后 live state 中途被 operator rollback）是潜伏 bug，须由未来 SPEC 加 per-trial 重审。α 锁定 batch 假设。
- **不变**：live 写路径本体（`:487-493`）· verdict 仍仅 `NEEDS_HUMAN`（duplicate_conflict 情形2，A5）**不扩 reason-code 触发面**（β/later）· trial schema-invalid fail-closed（`:448-452`）· idempotency（`buildSeenTrialIds`）。

### 2a.4 — operator_rollback classifyReason 分支（EDIT `heartbeat_runner.mjs`，同 2a.2 文件）

- **改动**：`classifyReason`（函数体 `:350-354`）当前签名只看 `firstBoot` + `flags.enabled`。α 扩签名为 `classifyReason(firstBoot, flags, prevPhase, newPhase)`，加分支：`!firstBoot ∧ prevPhase==='trialing' ∧ newPhase==='evaluating_metrics_only'` → `{reason:'operator_rollback', actor:'operator'}`（在 kill_switch 检查之后、generic operator 之前；**flip 方向 `evaluating_metrics_only→trialing` 不匹配此谓词 → 落 generic `operator`**，DoD 守之）。调用点 `:474` 传入 `prevPhase`(已有 `:430`) + `phase`(已有 `:459`)。
- **JSDoc 同步修正（红队 L4-4，纯文案）**：`classifyReason` JSDoc（`:343-349`）现写 "operator_rollback ... is 2a-only and unreachable in 1d (the ceiling locks trial_write false)" —— 2a 后 ceiling 放开 trial_write、该句**已失真**，改为 "reachable in 2a after the trial_write ceiling relax (graceful trialing→evaluating_metrics_only downgrade)"。入 DoD#12 grep 集。
- **零 schema 改动**：`operator_rollback` 已在 transition reason 4-enum（§0.1-4）。
- **安全对称性（user 裁决）**：允许 `false→true`（flip，2a.2 解锁）必须同时允许 graceful `true→false`（rollback），否则只有 kill_switch，风险模型不对。
- **不变**：`kill_switch`（enabled=false→paused）/ `bootstrap`（firstBoot）/ `operator`（其余）分支保留；transition append-before-write（`:469-479`）幂等语义不变。

### 2a.5 — RUNBOOK §2.2 Phase 2a Activation Playbook（EDIT `GHL-RUNBOOK.md`）

新增 **§2.2**（紧接 §2.1 Daily Metrics Roll-Up 之后，§3 之前；recon 确认最自然插入点）。

**完整 activation chain（OQ-5，含 0d 外部依赖 + min-activation-date 函数；防"前置"被误读为可跳）**：
```
earliest_activation_date = max(2026-06-07, age_0d_flip_date + 7d) + 1d(exit-gate PASS verify)
chain:  age_0d_flip_date  (learning_sources.yaml AGE enabled:true; 独立 0d task, ∉α, α 外部 blocking 依赖)
      → +7d              (AGE 连续 emit + manifest PASS streak 累积; streak 时钟要 AGE 真 emit 才起算)
      → +1d              (phase_1_exit_gate_check verdict==PASS 验证)
      → bootstrap        (若 live state 缺, 1d 既有机制)
      → operator flip    (trial_write_enabled:true → trialing)
```
- **2026-06-07** 是 floor（假定 AGE 自今日 Day-0 即 emit）；若 AGE flip 晚于今日（`age_0d_flip_date` 更晚），则 `earliest = age_0d_flip_date + 7d + 1d`。**`learning_sources.yaml` AGE `enabled:true` flip 是 α 外部 blocking 依赖**（独立 0d，不入 α 代码；无 AGE emit 则 exit-gate 永 INDETERMINATE）。
- **`age_0d_flip_date` 定义（红队 L4-5）**：= operator 手动 flip `learning_sources.yaml` AGE `enabled:true` 的日历日，**operator-supplied planning input，非 gate 程序读取值**（`learning_sources.yaml` 无 date/`enabled_at` 字段，grep 实证）。operator 须记录该日期（PR/runbook log）。上式是**人工 planning 辅助**非机器求值；gate 唯一程序判据 = `phase_1_exit_gate_check --json` verdict==PASS（本征要求 7 天 AGE emit）。

人工激活流程（**全 dry-run-safe 命令实跑落 expected output**，复用 1e bash 范式）：
1. **前置 bootstrap**（若 live state 缺）：`LIYE_HEARTBEAT_BOOTSTRAP_CONFIRM=1 node .claude/scripts/learning/heartbeat_runner.mjs`（落 `evaluating_metrics_only` state；1d 既有机制，α 不改）。
2. **exit-gate check**：`node .claude/scripts/learning/phase_1_exit_gate_check.mjs --json` → 须 `verdict==PASS`（7-day streak，**最早 2026-06-07**）。BLOCKED/INDETERMINATE → 不 flip。
3. **operator confirm**：人工复核 verdict 证据 + golden replay 复现 + negative evidence 命中（plan L150 三观察）。
4. **flip**：operator 编辑 live state `trial_write_enabled: true`（`evaluator_enabled` 已 true）→ 重跑 heartbeat runner → `current_phase=trialing` + transition reason=`operator`。**此为唯一激活动作，非 α 代码自动**。
5. **live evaluator**：flip 后 `node src/reasoning/policy_trial_evaluator.mjs --mode live` 二次门放行 → 写 `policy_trials.jsonl`。
6. **rollback**（安全反向）：operator 编辑 `trial_write_enabled: false` → 重跑 → `evaluating_metrics_only` + transition reason=`operator_rollback`。
7. **观察窗 7-14 天**（plan L150）：trial verdict 分布 / golden replay / negative evidence 命中率。**2a→2b transition predicate = β**（本 playbook 仅标"观察期满后转 2b 评估"占位）。

复用 1e 既有 §（§5 Promotion/Demotion 仍 GATED until 2c，不动）。

---

## §2 Cross-Cutting Hard Constraints

| Gate | Phase 2a-α 应用 |
|---|---|
| **Gate 4**（Layer-2 不写 Layer-0） | ✅ α 全在 liye_os Layer-0；不碰 AGE |
| **Gate 7**（heartbeat 首启 dry_run，`trial_write=false`） | ✅ **首次合法 phase-versioned departure**：α deploy 后 firstBoot 仍 `evaluating_metrics_only`（bootstrap 模板 false，§0.1-7）；flip 是 trialing 转移**非** HG7 违反（HG7 约束"首启"，trialing 是首启后 operator-driven 转移） |
| **Gate 8**（Pilot-1 无 production_write / execute_limited） | ✅ ceiling relax 仅碰 `trial_write_enabled`；`candidate_write`/`promotion`/`production_write` 全留锁；trialing 最高 tier，0 production/candidate write |
| **Pilot-1 invariant** | ✅ negative learning only（verdict 仍 NEEDS_HUMAN）；AGE `write_capability_effective: none` 不变；无 scheduler；≥90 天（anchor 2026-05-09） |

**carve-out 集（首次合法修改，§0.1-2）**：✅ `policy_trial_evaluator.mjs`（2a.3）· ✅ `heartbeat_runner.mjs` File A（2a.2+2a.4）· ✅ **1c 测试 `src/reasoning/tests/policy_trial_evaluator.test.mjs`**（12 处 `mode:live` seed trialing，§0.1-2c）· ✅ **1d 测试 `tests/test_heartbeat_v2_runner.mjs`**（ceiling 用例更新，§0.1-2e F-1dtest）· ✅ 新建 `phase_1_exit_gate_check.mjs` + tests + CI workflow · ✅ `GHL-RUNBOOK.md`（§2.2）。

**禁触清单（frozen / Hard-NO）**：
- ❌ File B `scripts/heartbeat_runner.mjs`（`e63cf86c`，永锁）
- ❌ 任一 schema（`heartbeat_state_v2` / `policy_trial_v1` / `heartbeat_phase_transition_v1` / `metrics_daily_v1` / `learned_policy_ghl_v1` / `operator_feedback_v1` 等）+ `confidence_formulas.yaml`（**α 0 schema crack**，§0.1-4）
- ❌ `import_facts.mjs` / `canonical_json.mjs` / `metrics_daily_producer.mjs`（frozen 1b/1e）· `emit_fact.py`（AGE）· loamwise
- ❌ **写 candidate / promotion / production**（plan L150 "不写 candidate" + Hard Gate 8 + Pilot-1）
- ❌ **β 项**：`trial_history` 回写 · confidence verdict · legacy `confidence_basis` 迁移 · rolled-up trial-verdict metrics（改 `metrics_daily_v1`）· operator feedback flow
- ❌ **γ 项**：30-day D-11 rolling reducer
- ❌ 扩 evaluator reason-code 触发面（其余 7 negative codes + acceptable 仍 0 fire，A5）· verdict 引入非 NEEDS_HUMAN auto-promote
- ❌ scheduler / cron / launchd · flip `learning_sources.yaml`（独立 0d）· amend / force-push / --no-verify / --admin / rebase
- ❌ **α 代码自动 flip**（trial_write 由 false→true 永远是 operator 人工动作，非 runner/evaluator 自动）

---

## §3 Phase 2a-α 验收标准（DoD）

| # | Criterion | 验收方式 |
|---|---|---|
| 1 | `phase_1_exit_gate_check.mjs` 提交 | `git ls-files .claude/scripts/learning/phase_1_exit_gate_check.mjs` |
| 2 | exit-gate CLI `--help`/`--json` 跑通 | `--help` exit 0；`--json` 输出 Phase1ExitGateReport |
| 3 | exit-gate verdict 三态 + per-day 分类正确 | 合成 fixture：7 天全 STREAK-contrib→`PASS`(exit0)；任一 BLOCKED-day(fail/warn/dup/path_unsafe)→`BLOCKED`(exit2)+`blocked_days`；0 BLOCKED-day ∧ 有空日(pass==0)或缺 row→`INDETERMINATE`(exit2)。**BLOCKED 优先级 > INDETERMINATE** |
| 4 | C1 strict PASS-only | 某天 `warn>0` 或 `pass==0`(bind=0) → C1 FAIL（streak 断）；7 天全 `fail==0∧warn==0∧pass≥1` → C1 pass |
| 5 | ceiling relax | `heartbeat_runner.mjs` `ESCALATION_FLAGS` 不含 `trial_write_enabled`；含其余 3；`trial_write=true∧evaluator=true∧candidate=false` → runner 出 `current_phase=trialing` exit 0（非 ceiling fail-closed）|
| 6 | ceiling 仍锁 candidate/promotion/production | `candidate_write=true`(或 promotion/production) → 仍 `kind=ceiling` exit 2 |
| 7 | evaluator 二次门 fail-closed（ship≠activation） | 5 类 → `not_authorized_for_live` + `report.fail_closed>0` **exit 2（非 exit 1）** + **0 trial 写**：(a) 文件缺 · (b) **unparseable JSON（try/catch→exit 2**，红队 L5-1）· (c) `version!==2`(严格整数) · (d) 缺 `current_phase` · (e) `trial_write=false` 或 `phase!=trialing` |
| 8 | evaluator 二次门放行 | live state `version=2∧current_phase=trialing∧trial_write=true` → `--mode live` 写 `policy_trials.jsonl`（既有 `:489` 路径）exit 0 |
| 9 | dry_run 不鉴权不写 | `--mode dry_run`（默认）→ 不读 live state、0 写、exit 0（1c 现状不回归）|
| 10 | operator_rollback 分支 + flip reason | `trialing→evaluating_metrics_only` ⇒ reason==`operator_rollback`（过 transition ajv，enum 已含）；**`evaluating_metrics_only→trialing`(flip) ⇒ reason==`operator`**（红队 L3-7）；**`prevPhase≠trialing→evaluating_metrics_only`(如 ingesting_only→) ⇒ `operator` 不误判 rollback**（红队 L4-6）；`enabled=false→paused` ⇒ `kill_switch` |
| 11 | operator_rollback ≠ kill_switch | `enabled=false→paused` 仍 reason==`kill_switch`；rollback 独立分支 |
| 12 | docstring fix（grep 证） | evaluator POSTURE(`:20-24`)/HELP(`:642`) 去 "live disabled / dry-run-first locks"；heartbeat ceiling detail(`:206`)/header(`:13-15`,`:87-89`) 去 "1d locks"；**classifyReason JSDoc(`:343-349`) 去 "operator_rollback unreachable in 1d"**（红队 L4-4）|
| 13 | RUNBOOK §2.2 activation playbook | grep `§2.2`；含 bootstrap→exit-gate→confirm→flip→live→rollback 7 步；命令 dry-run-safe 实跑落 expected |
| 14 | **0 schema crack + gate 维持 19** | `git diff origin/main -- '_meta/contracts/learning/*.schema.yaml' '_meta/contracts/learning/confidence_formulas.yaml'` 空；`validate-contracts.mjs` pass-count **注册前后均 19**（无 delta；α 不注册新 schema）|
| 15 | frozen 0 改动 | `git diff origin/main` 仅含 carve-out 集；File B `e63cf86c` / 全 schema / `import_facts`/`canonical_json`/`metrics_daily_producer` / AGE / loamwise 0-diff |
| 16 | CI green + 新 tests CI-wired（本 PR） | 新 workflow `learning-phase2a-alpha-tests.yml`（node 18/20/22）。**3 既有 workflow 因 path-trigger 会跑**（红队 L4-2）：① `learning-policy-trial-evaluator-tests.yml`（改 evaluator）→ **1c 12 处 live 测试更新**（F-1ctest）才绿；② `learning-heartbeat-runner-tests.yml`（改 heartbeat_runner.mjs）→ **1d `test_heartbeat_v2_runner.mjs` ceiling 测试更新**（F-1dtest，L219+L242-250）才绿；③ `learning-metrics-daily-tests.yml`（heartbeat dep path-trigger）→ `getPhaseWindowAge` 未动应保持绿（F-metricsCI）。全本 PR 内更新 |
| 17 | forbidden-name lint green | `bash tools/lint_forbidden_names.sh` 对新 file + 改动 file 绿；复合名 only，0 裸 `evaluator`/`trial`/`candidate` 声明 |

## §4 Required Test Coverage

| 类别 | 覆盖 |
|---|---|
| exit-gate verdict 三态 + per-day 分类 | BLOCKED-day(fail/warn/dup/path) → BLOCKED；7 天全 STREAK-contrib → PASS；空日/缺 row(无显式失败) → INDETERMINATE(非 BLOCKED)；BLOCKED 优先 INDETERMINATE；exit code 对 |
| **空日 ≠ BLOCKED（OQ-1 核心）** | `pass==0∧fail==0∧warn==0`(AGE 没 emit) → INDETERMINATE-day(streak reset)，**不** BLOCKED；混 1 个显式失败日 → 立即 BLOCKED |
| C1 strict PASS-only | warn>0/fail>0 → BLOCKED-day；pass==0 → INDETERMINATE-day；连续 7 天 `pass≥1∧fail==0∧warn==0` → STREAK；第 4 天 warn → BLOCKED |
| C2/C4 准则 | `c2_duplicate_conflict_count>0` 任一天 → BLOCKED；`c4_path_unsafe_reject_count>0` → BLOCKED |
| C3 continuity | 缺 1 天 row → C3 FAIL + `days_missing`；7 天齐 → pass |
| latest-wins per date_utc | metrics 同日多行（1e `--regenerate`）→ 取最后一行 |
| metrics 缺/坏 | 文件缺 → INDETERMINATE；坏行 skip+count；<window 完整日 → INDETERMINATE |
| ceiling relax | `trial_write=true` 不再 ceiling-block → trialing；其余 3 flag 仍 block |
| ceiling 矩阵 | trial_write{T/F}×candidate{T/F}×promotion{T/F}×production{T/F} 关键组合 → 正确 phase / ceiling fail |
| 二次门 fail-closed（5 类，exit 2 非 1） | {文件缺 / **unparseable-JSON(try/catch→exit 2)** / version!==2(严格整数) / 缺 current_phase / trial_write=false / phase!=trialing} 各 → `not_authorized_for_live` exit 2 + 0 写（红队 L5-1/L5-2）|
| 二次门放行 | 合成 trialing live state(version=2∧phase=trialing∧trial_write=true) → live 写成功 |
| ship≠activation e2e（2 子态，红队 L3-9） | (a) live state 文件缺(merge 后未 bootstrap)→条件1→0 写；(b) bootstrap 后 evaluating_metrics_only(trial_write=false)→条件3/4→0 写 |
| dry_run 不回归 | 默认 dry_run 不读 live state、0 写（1c 行为不变）|
| operator_rollback + flip + 负向守卫 | trialing→evaluating_metrics_only → reason=operator_rollback 过 schema；**evaluating_metrics_only→trialing(flip) → reason=operator**（L3-7）；**ingesting_only/paused→evaluating_metrics_only → reason=operator 非 rollback**（L4-6）；kill_switch/bootstrap 不误判 |
| gate 防御性读（L4-6） | row 在场但 `phase_1_exit_signals` 缺/partial(hand-rolled/pre-1e) → INDETERMINATE-day 不 crash（optional-chaining）|
| fixtures 隔离（红队 L4-3） | exit-gate `--metrics` + heartbeat `--fixtures` CLI 各隔离；**evaluator 二次门经 library API `evaluatePolicyTrials({rootDir,mode:'live'})` 测**（evaluator CLI 无 `--fixtures`/`--rootDir`，`--mode live` 故意读真 PROJECT_ROOT 供 activation；α 不加 CLI flag 以最小 blast radius）|
| forbidden-name + 0-schema grep | lint 绿；`git diff` schema 空断言 |

## §5 Resolved Decision Log

| ID | Decision | Rationale |
|---|---|---|
| **D-A** | **2a 分层 α/β/γ 多 SPEC 多 IMPL**（user 裁决） | α=能 flip 的最小基础设施（复用已注册 contract，0 schema）；β=flip 后果；γ=Phase-4 prep。Policy 9 Surgical Scope 禁 5-7 deliverable bundle |
| **α-1** | **α = flip-readiness + authorization + rollback + runbook activation**（user 裁决） | α 只铺"可审计、可回滚、默认 idle 的 trialing 门"；trialing 后果链全留 β |
| **α-2（边界）** | **operator_rollback ∈ α**（user 裁决） | 安全对称性：允许 false→true 的控制面必须同时允许 graceful true→false；同 File-A 同 classifyReason 区；reason enum 已许可（0 schema） |
| **α-3（边界）** | **30d D-11 reducer ∈ γ（∉ α）**（user 裁决） | operator_agreement≥0.7/false_neg=0 是 Phase-4 前置（plan L177-184），非 2a-entry gate（plan L138-142）；exit-gate 读 phase_1_exit_signals 不读 d11_kpis（§0.1-5）|
| **R1** | **ship ≠ activation**（user 要求 #1） | merge 后 trial_write 仍 false；live 二次门 fail-closed；ceiling relax 只"允许"不"触发"；0 trial 写 |
| **R2** | **activation = Runbook 人工流程**（user 要求 #2） | exit-gate PASS + operator confirm + live-state flag edit；最早 2026-06-07（7-day streak）；α 代码不自动 flip |
| **R3** | **`not_authorized_for_live` 对齐 1c counter taxonomy**（user 要求 #3 + §0.1-6） | 1c 用 fail_closed counter + per_fail_closed reason（非 1d typed-kind）；新 reason 串 + exit 2；不大改 frozen blob 257cc0fe |
| **R4** | **firstBoot 不变**（user 要求 #4 + §0.1-7） | bootstrap 模板 trial_write=false；α 不让首启自动进 trialing |
| **R5** | **docstring fix 进 α**（user 要求 #5） | evaluator "live disabled" + heartbeat "1d locks all four" 已失真；加二次门/relax 时同步改 |
| **R6** | **β/γ Hard-NO 列死**（user 要求 #6） | §2 + §6 显式禁 trial_history / confidence 迁移 / metrics schema 改 / 30d reducer |
| **G1** | **carve-out = 仅 2 frozen 文件**（§0.1-2，首次合法解锁） | evaluator + heartbeat File-A；其余全 frozen；File B 永锁 |
| **G2** | **exit-gate up-front 二次门 + standalone read-only**（§0.1-10） | gate/二次门均不 spawn sibling；gate 读 metrics_daily.jsonl，二次门读 live state JSON |
| **G3** | **§4 非 §3 引用更正**（recon ground-truth） | Phase 2 = plan §4 L150；历史 framing 误写 §3（§3 是 Phase 1）|
| **OQ-1r** | exit-gate per-day 三态：BLOCKED-day(显式失败) / STREAK-contrib / INDETERMINATE-day(数据缺失 streak-reset) | 空日(AGE 没 emit)≠BLOCKED 否则 ramp-up/OQ-5 长链误阻死 verdict；BLOCKED 优先级 > INDETERMINATE |
| **OQ-3r** | `not_authorized_for_live` = 1c counter（非 1d typed-kind） | consistency-with-1c-evaluator > taxonomy-uniformity-with-1d；frozen `257cc0fe` blast radius 最小 |
| **OQ-4r** | up-front 鉴权前提 = batch-invocation（minute-scale）；daemon ∉α | daemon 模式鉴权-时滞是潜伏 bug，留未来 SPEC per-trial 重审 |
| **OQ-5r** | activation = `max(2026-06-07, age_0d_flip+7d)+1d` 函数 | AGE `enabled` flip 是 α 外部 blocking 依赖；§2.2 列全链防"前置"被跳 |
| **OQ-7r** | §0.1-11 cement 全 file-diff 行号表面 | IMPL 只动列举行号，多一处 = SPEC drift / 红队红线 |
| **CT-1ctest** | carve-out 含 1c live-mode 测试（12 处 `mode:'live'`）+ `seedTrialingState` helper | 改 1c 测试非越界（§0.1-2(c) cement）；非测试 1c artifact 不动 |
| **CT-1dtest（红队 L4-1）** | carve-out 含 1d ceiling 测试（`test_heartbeat_v2_runner.mjs` L219 + L242-250）| ceiling relax 改 trial_write 语义 → 1d ceiling 测试须更新（§0.1-2(e)，与 1c 平行；否则 1d workflow CI 红）|

## §6 Out-of-Scope（硬边界 → β / γ）

- **β（trialing 后果面，后续 fresh-session SPEC）**：
  - `trial_history` 回写（F3）— `learned_policy_ghl_v1.trial_history`（已存 optional `array<uuid>` "append-only by evaluator"，**无需 schema 改**但属 learned_policy 状态变更，Hard Gate 8 observability-only 边界跨越，归 β）
  - confidence verdict（F2）— `confidence_formulas.yaml` 4 输入 3 个 root 在 `confidence_basis`；两 legacy policy + 整个 `state/memory/learned/` 树**真缺** `confidence_basis`（recon 实证），`missing_input_policy=fail_closed` → **confidence 无法随 flip 跑**，必须先迁移
  - legacy `confidence_basis` 迁移 spec（candidate `BID_RECOMMEND_..._17ED8F` + production `SAMPLE_BID_OPT_POLICY`）
  - rolled-up trial-verdict observability — 该 atom **当前不存在于** `metrics_daily_v1`（β 新增）；新 rolled-up trial-verdict atom = **改 sealed `metrics_daily_v1` → 独立 schema-touching PR**。（注：`metrics_daily_v1:396-401` 已 defer 的是 **Phase-1 exit gate-verdict/streak**，由 2a.1 在 mjs 侧算、非 producer——与 trial-verdict rollup 是两个不同 deferred atom，勿混，红队 L1-2）
  - operator feedback flow + **2a→2b transition predicate**（观察窗满判定）
- **γ（Phase-4 prep，独立）**：30-day D-11 rolling reducer（Σ daily atoms ⊎ late_arrivals；operator_agreement≥0.7 软 / critical_false_negative=0 硬 = Phase-4 gate）
- **永不在 2a**：candidate/promotion/production write · crystallizer（D-04 = 2b/2c）· scheduler · File B · AGE/loamwise 改动

## §7 Implementation Plan Skeleton（留给实施指令包 expand）

实施指令包至少覆盖（atomic commits，每个留绿 `node --test`）：
1. branch from liye_os `origin/main` HEAD（branch 时锁定 resolved commit SHA；当前 = `d2abef9` 但以 branch 时实际 origin/main 为准，红队 L2-3）
2. **C1** `phase_1_exit_gate_check.mjs`（read-only metrics_daily.jsonl · 4 准则 · 三态 verdict · strict PASS-only · latest-wins · INDETERMINATE 数据不足 · `--source`/`--asof`/`--window`/`--json`/`--help`）
3. **C2** `heartbeat_runner.mjs` ceiling relax（`ESCALATION_FLAGS` -1 + `:206`/`:13-15`/`:87-89` 注释时间窗修正，`:196-198` 仅核对）**+ 同 commit 更新 1d ceiling 测试** `tests/test_heartbeat_v2_runner.mjs`（L219 trial_write 用例删/转正向、L242-250 期望翻 trialing-success，F-1dtest）→ 保 1d workflow 绿
4. **C3** `heartbeat_runner.mjs` operator_rollback（`classifyReason` 扩签名 + 分支 + **JSDoc `:343-349` 失真句修**；调用点 `:474` 传 prevPhase/phase）
5. **C4** `policy_trial_evaluator.mjs` 二次门（up-front mode==live 鉴权读 live state **try/catch-wrap** · `version===2` 严格 · 4 条件 · `not_authorized_for_live` per_fail_closed reason + exit 2 · `report.live_authorized` · POSTURE/HELP docstring fix）**+ 同 commit 更新 1c live 测试** `src/reasoning/tests/policy_trial_evaluator.test.mjs`（12 处 `mode:'live'` 加 `seedTrialingState(root)`，F-1ctest）→ 保 1c workflow 绿
6. **C5** committed fixtures `tests/fixtures/phase2a_alpha/`（合成 metrics_daily 7-day 三态矩阵 + 合成 trialing/non-trialing live state）+ `tests/test_phase2a_alpha.mjs`（§4 矩阵，prefix-named）
7. **C6** CI workflow `.github/workflows/learning-phase2a-alpha-tests.yml`（path-trigger 3 改动 file + gate-check + fixtures + tests；node 18/20/22）
8. **C7** `GHL-RUNBOOK.md` §2.2 activation playbook（命令 dry-run-safe 实跑落 expected）
9. CI 全绿 + 自检（exit-gate 三态；二次门 4-类 fail-closed + 放行；ship≠activation e2e 0 写；ceiling 矩阵；rollback;0-schema grep；forbidden-name；1c/1d 既有 workflow 不回归）
10. PR review：本 SPEC blob SHA + DoD 17 + Hard-NO 自审；squash via liyecom UI（REVIEW_REQUIRED）

**禁触**：File B / schemas / confidence_formulas / import_facts / canonical_json / metrics_daily_producer / AGE / loamwise / scheduler / β-γ 项。**carve-out**：evaluator + heartbeat File-A（§0.1-2）。

## §8 SPEC Anchor / Version Control

- Phase 2a-α 实施指令包必须引用**本 SPEC 的 git blob SHA**（**本 SPEC 自身 merge 入 main 后生成**；实施指令包在 SPEC merge 之后起草，消除 commit-vs-blob 先后歧义，红队 L2-3）；不引用 commit SHA。
- v0.1 → v1.0：user 7-OQ Q&A 裁定 + 5-lens 红队 fold 后 bump（本版）；任何后续修订须 user 显式 sign-off + version bump。
- SPEC blob 漂移 → 实施 PR review 必拒。

## §9 Findings / Open Items（7 OQ 全 resolved → §5 OQ-*r；5-lens 红队 fold 见下）

**Findings（已 ground-truth，带入实施）**：

| ID | Finding | Disposition |
|---|---|---|
| F-live | evaluator 已有完整 live 写（`:487-493`），非"dry-run-only"（指令包 framing 证伪） | 2a.3 = 加授权门非建写；docstring 同步改（§0.1-1）|
| F-rollback | `operator_rollback` 已在 transition reason enum（`:75-82`）+ classifyReason 注释已预留（`:346-348`） | 2a.4 零 schema crack，只加 classifyReason 分支（§0.1-4,9）|
| F-confidence | `confidence_basis` 全树真缺 + `missing_input_policy=fail_closed` → confidence 无法随 flip 跑 | confidence + legacy 迁移 → **β**（§6）|
| F-gate19 | α 0 schema → `validate-contracts` pass-count 维持 19 | DoD#14 可证伪断言 |
| F-§4 | Phase 2 = plan **§4** L150 非 §3 | §0 N-1 更正，全程用 §4 |
| **F-1ctest（自红队 step-4 catch，user 升级为 §0.1-2(c) carve-out）** | 加 up-front live 二次门改了 evaluator live 语义 → `src/reasoning/tests/policy_trial_evaluator.test.mjs` **实测 12 处** `evaluatePolicyTrials({mode:'live'})`（L213/259/263/333/349/365/384/405/425/438/465/487）将全部 `not_authorized_for_live` fail-closed 回归 | **carve-out 显式含 1c 测试更新**（§0.1-2(c)）：12 处须 seed 合成 trialing `heartbeat_learning_state.json`（version=2 ∧ current_phase=trialing ∧ trial_write=true）；实施可加 `seedTrialingState(root)` helper。dry_run 测试不受影响。DoD#16 校正 |
| **F-metricsCI** | metrics CI workflow path-trigger 含 `heartbeat_runner.mjs`（1e dep）→ 本 PR 会触发 metrics tests | 2a.2/2a.4 不动 `getPhaseWindowAge`（`:217-237`）→ metrics producer import + tests 应保持绿；DoD#16 守之 |
| **F-1dtest（红队 L4-1/L4-2 HIGH，与 F-1ctest 平行）** | 2a.2 ceiling relax 移 trial_write → `tests/test_heartbeat_v2_runner.mjs` `CEILING_CASES` trial_write 用例(L219) + RUNNER-enforced 测试(L242-250) 的 `kind==='ceiling'` 断言回归（trial_write=true∧evaluator=true∧candidate=false 现派生 trialing 非 ceiling）| **carve-out §0.1-2(e)**：更新 L219(删/转正向 `→trialing`)+L242-250(期望翻为 `current_phase=trialing` success)；`deriveCurrentPhase` 断言 L169 不动。1d workflow path-trigger heartbeat → 本 PR 内更新才绿（DoD#16②）|
| **F-c4-rampup（红队 L3-10）** | C4(`path_unsafe`) `live import only`（dry_run 不落 reject）→ AGE flip 前/dry_run 期恒 0、BLOCKED-via-C4 ramp-up 期结构性罕触发 | 与 OQ-2 同类"结构性不可观测"；C4 保留为 live 期 traversal 硬阻断，§4 仍含 c4>0→BLOCKED 用例证逻辑接通 |

**OQ Resolution（7 OQ + 1 CT 全裁，2026-05-31；裁定见 §5 OQ-1r..OQ-7r + CT-1ctest/CT-1dtest）**：OQ-1 三态 refine（BLOCKED-day/STREAK-contrib/INDETERMINATE-day，空日≠BLOCKED）· OQ-2 不含 operator KPI（结构性不可观测论证 §0.1-5）· OQ-3 1c counter taxonomy · OQ-4 up-front（batch-invocation 假设）· OQ-5 activation-chain 函数 + age_0d_flip_date operator-supplied（§2.2）· OQ-6 §2.2 文档化 2 步 · OQ-7 全量注释 hygiene（精确化 §2a.2/§0.1-11）· CT 1c+1d 测试 carve-out cement。

**5-lens 红队 disposition（`wf_bba76c12`，3 HIGH + 13 MED + 20 LOW）**：
- **3 HIGH 全 fold**：L3-6（gate-19 实测锚 → §0.1-4 三源测量=19 + DoD#14 before==after==19）· L4-1（ceiling relax 回归 1d ceiling 测试 → §0.1-2(e) F-1dtest carve-out + §0.1-11 cement L219/L242-250）· L4-2（DoD#16 改写：3 既有 workflow path-trigger，1c+1d 测试本 PR 更新）。
- **13 MED 全 fold**：L1-1/L3-8/L4-4/L4-7（classifyReason 函数体 L350-354 vs JSDoc L343-349 + JSDoc 失真句修，DoD#12）· L3-1（三态短路非并集）· L3-2（PASS=all-of-window，streak_len 降诊断）· L3-5（version 严格整数 ===2）· L3-7（flip→operator reason 测试）· L5-1（parse-throw try/catch→exit 2 非 1）· L4-3（evaluator 无 CLI fixtures→library-API 测）· L4-5（age_0d_flip_date operator-supplied）· L4-6（rollback 负向守卫 + gate 防御性读）· L2-1（路径字面量不 import File-A）· L2-2（注释精确行）· L3-3（空日两形态 defer）。
- **20 LOW**：fix（L1-2 §6 conflation · L2-3 baseline SHA · L2-9 §2 表加 1c/1d 测试 · L3-4 cond3/4 非冗余 · L3-9 e2e 2 子态 · L5-2 split parse 测试行）+ document（L1-3 proactive decoy 注 · L3-10 C4 ramp-up · L4-8 seedTrialingState 3-key 足够）。
- **9 refuted = proof-of-coverage（红队全 ground-truthed 命中，0 假阳）**：L2-4/5/6/7/8（β/γ bleed + frozen touch + ceiling escalation + candidate write 全确认 OUT）· L4-8 · L5-3/4/5（ship≠activation + rollback 不误火 + ceiling 双锁 candidate）。

**无 blocker**。实施可在 user 批准 v1.0 PR 后开工（β/γ 与 α 解耦）。

---

**END OF SPEC v1.0**
