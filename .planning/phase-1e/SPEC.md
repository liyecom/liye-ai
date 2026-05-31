# Phase 1e SPEC v1.0 — liye_os `metrics_daily_producer.mjs` + GHL-RUNBOOK 收官

**Status**: APPROVED-PENDING（user 已裁决 F1–F5 single-direction + N1–N6 bake，2026-05-31；v0.1 → v1.0 incorporating 4-lens adversarial red-team：**1 HIGH + 8 MED + 7 LOW 全部 fold**）
**Scope**: liye_os 单边 · **Phase 1 字母链收官**。双交付：
- **A** NEW `.claude/scripts/learning/metrics_daily_producer.mjs` — standalone manual **下游 observability aggregator**：读 6 个 frozen 1b/1c/1d on-disk 产出，按 UTC 日历日聚合，写 `state/runtime/learning/metrics_daily.jsonl`（append-only）+ NEW sealed schema `metrics_daily_v1.schema.yaml`。
- **B** `_meta/docs/GHL-RUNBOOK.md` extend — §1/§3/§4/§5/§6 各补 ≥1 reproducible bash + 3 处 correctness fix。

**Out of scope**: Phase-1 exit GATE 判定 / 7-day streak 派生（= **2a 入口检查**，N2）· →`trialing` flip · `trial_history` 回写 · confidence verdict · evaluator-intrinsic 二次门 · 30-day rolling KPI gate 判定 · scheduler · 改任一 frozen 1a–1d artifact（含 `import_facts.mjs` 加 dedupe-ledger）· `scripts/heartbeat_runner.mjs`（File B）。
**Drafted**: 2026-05-31
**Anchor for implementation**: 本文件是 Phase 1e 实施指令包的 normative input；实施时 SPEC 锁版本（file blob SHA），禁止悄改。

---

## §0 Normative Anchors

| Tier | Source | 锁定内容 |
|---|---|---|
| N-1 | `GHL-evolution-plan-v4.1.md` §3 row 1e（L136） | deliverable = Runbook 补完整命令（每节 ≥ 1 条 reproducible bash）+ `state/runtime/learning/metrics_daily.jsonl` 输出；前序 = 1d（DONE，main `e2e52fb`） |
| N-1 | 同上 L138-142 | **Phase 1 出口准则 1-4**（1e 使之**可追踪**；准则文字 1e **不 own**，gate 判定在 2a） |
| N-1 | 同上 L177-178 + §7.6 | D-11 KPI 均 **30 天滚动窗** + `critical_false_negative_count` hard_gate ⇒ 1e 只产 **per-day atom**，30-day gate 下游（2a/Phase4）算 |
| N-1 | 同上 L181（KPI#8） | "metrics_daily.jsonl 可追踪" ⇒ field-pinned sealed contract（schema-first 的 normative 根据） |
| N-2 | `GHL-v4.1-errata.md` L465 / L559 | metrics_daily canonical path = `state/runtime/learning/metrics_daily.jsonl`（**仅路径声明、无字段规范** → 1e 定义所有者） |
| N-3 | `GHL-v4.1-errata-v2.md` EV2-I-01 | **EV2-I-01 明文** = date-shard 权威 = UTC date of `emitted_at` + 缺 tz offset **fail-closed**（仅约束 AGE emit / importer 侧）。**SPEC-author 推论**（非 EV2-I-01 明文）：metrics_daily 的 **fact-record** `date_utc` bucket 须与 AGE `out/facts/<UTC_DATE>/` shard 对齐（仅 records；conflicts/rejects 见 §1.2/§1.3） |
| **契约 (INPUT, frozen，读不写)** | 6 源（§1.2） | 实施基线 SoT；Hard NO 修改 |
| **契约 (OUTPUT, NEW 1e)** | `_meta/contracts/learning/metrics_daily_v1.schema.yaml`（draft-07 · `$id` · version 1.0.0 · `additionalProperties:false` · SSOT header 注释块，镜像 `heartbeat_phase_transition_v1.schema.yaml`） | metrics row 形状；**须在 `_meta/contracts/scripts/validate-contracts.mjs` schemaFiles 注册才被 gate 校验，§0.1-2** |
| **side-car (OUTPUT, NEW 1e)** | `state/runtime/learning/metrics_daily_late_arrivals.jsonl`（evidence-ledger 范式**第三次复用**，N4） | 记 late-arriving operator_feedback，使 closed daily atom 不被回改 |
| 复用 (read-only) | 1d `getPhaseWindowAge(transitionsPath, currentPhase)` export（`heartbeat_runner.mjs:217`）· 1b `canonical_json.mjs` `hashCanonical`/`parseCanonical`（blob `42b05d04`）· ajv `{strict:false, allErrors:true, validateFormats:false}` · atomic temp+renameSync · O_EXCL lock | 不自实现 |

**冲突优先级**：CODE/SCHEMA-SSOT（frozen input schemas + 1b/1c/1d 实现真值）> N-3 > N-2 > N-1 散文。

### §0.1 ⚠ CODE/SCHEMA-AUTHORITATIVE 关键前提（对抗分析 + 10-agent 核验 + 4-lens 红队 + user 裁决派生）

1. **无任何 metrics_daily schema 存在**（`_meta/contracts/learning/` 共 13 文件，其中 `*.schema.yaml` 10 个，0 个 metrics*；repo-wide grep 全是 plan/errata 散文）→ 1e 是**定义所有者**，无可继承 baseline；schema-first 非判断题（**F1 MUST**）。
2. **schemaFiles 是 hardcoded 数组**（`validate-contracts.mjs` L511-528；`validateContractSchemas` 迭代该数组，**非** readdir 扫描 learning/）→ 不注册 = contracts-gate **静默跳过**（DoD + 负向测试守之）。⚠ **真实路径 = `_meta/contracts/scripts/validate-contracts.mjs`**；1d SPEC §0.1-9/§7 误写 `.claude/scripts/contracts/`（该路径不存在，已实证）——**本 SPEC 一律用真实路径**，并入 §9-N errata 承接。注册位 = L526 `heartbeat_phase_transition_v1` 行后，带 "Phase 1e" 注释。
3. **gate 只校验 schema 自身 well-formed、不读 instance 行**（metrics_daily.jsonl `.gitignore:330` 目录级忽略，git check-ignore 实证；无版本化 diff 面）→ **行级 conformance 只能 producer 写时 ajv fail-closed enforce**（镜像 1d `heartbeat_runner.mjs:106-124`，validators L115/L123）。schema 是 producer-side 强约束，非装饰。
4. **criterion-2「dedupe 命中率稳定」结构性半盲**（红队 load-bearing #1）：dedupe **silent-skip**（命中率分子 = 正常 re-emit，`import_facts.mjs:456-459`）**只 `report.silent_skips += 1` 内存计数、0 落盘**；只有 **DUPLICATE_CONFLICT** 落 `fact_conflicts/`（:461-467）。⇒ producer 读盘**无法算命中率**，只能数 conflict（应 ≈0）。**裁决（N1/N3 派生）**：1e producer 读盘 only，**不调 importer**；metrics 报 `c2_duplicate_conflict_count`（可观测，target 0）+ 显式 stamp `c2_dedupe_hit_rate: "unobservable_from_disk"`；criterion-2 文字 1e 不 own，记 §9-N errata（真命中率需未来 1b instrumentation phase，**1e 不改 frozen 1b**）。
5. **criterion-4「0 path traversal」可观测**：PATH_UNSAFE reject 在 **live 模式**落 `state/runtime/learning/fact_rejects/<source_segment>/<raw_sha256>/reject_meta.yaml`（reason==`PATH_UNSAFE`，`import_facts.mjs:292-308,:419`，O_EXCL 一次写）→ producer 数该 reject dir 即得 `c4_path_unsafe_reject_count`。caveat：dry_run import 不落 reject（:386-391 mode==='live' guard）→ criterion-4 仅 live import 期可证。
6. **decoy 文件陷阱**（红队）：`state/runtime/proactive/heartbeat_learning_state.json` **物理存在 = 旧 v1**（`version:1`、`enabled:false`、**无 `current_phase`**，pre-GHL）；1d SSOT = `state/runtime/learning/heartbeat_learning_state.json`（fresh checkout 尚不存在）。producer + RUNBOOK 必读 **`learning/`**，且容忍 absent / pre-v2（无 current_phase）→ `current_phase: null`，**绝不 crash、绝不读 proactive/**。
7. **bind=0 = day-1 真实态**（6 输入今天全不存在，ls 实证）→ producer 必 **graceful-empty-emit**（well-formed zeroed row + per-source 0 + `inputs_present` map + exit 0，镜像 `getPhaseWindowAge` existsSync→null guard `heartbeat_runner.mjs:218` + empty-entries→null `:227`）；**绝不 fail-on-empty**（否则 metrics-only 窗口第 1 天即 brick，违 criterion-3「持续输出」）。bind=0 是整个 7–14 天 metrics-only 窗口的 steady state。
8. **D-11 Simpson 陷阱**（红队）：日 ratio **不可加**——30 天滚动 gate 无法由 30 个日 ratio 重算（must un-average）。⇒ 必存 **raw 分子（`agreement_agree_count`）+ 分母（`agreement_eligible_count`）atom**；`operator_agreement_rate_today` 仅 nullable convenience；`critical_false_negative_count_today` 本身可加。30-day gate 下游（2a）由 atom sum 算（F4 + N2）。
9. **PII / forbidden-name 皆非问题**（显式声明防 reviewer churn）：`reviewer_id_hash` = sha256 salted「NO PII」（`operator_feedback_v1:36-41`）；D-11 从 `policy_trials.jsonl` 单源算（`operator_feedback` 经 `$ref` 内嵌，**0 额外输入文件、0 隐私面**）。forbidden-name regex（errata L179）只命中**声明位裸** `trial`/`candidate`/`trust_score`/`trust_matrix`/`evaluator`；复合名 `metrics_daily_producer`/`MetricsDailyProducer`/`policy_trial_count`/`aggregateDay` 实测安全（TAIL 为词字符）。`tools/lint_forbidden_names.sh`（v1.1.0，扫 staged `.mjs`）CI 自动跑 → DoD#17 自检。
10. **in-scope editable（非 File-A、非 frozen）**：✅ `_meta/contracts/scripts/validate-contracts.mjs`（注册新 schema）· ✅ `_meta/docs/GHL-RUNBOOK.md`（扩充 + 3 fix）。**`.gitignore` 无需改**（L330 已目录级覆盖 metrics_daily.jsonl + late_arrivals + lock）。

---

## §1 9-Item Contract Surface（Deliverable A — metrics_daily_producer）

### 1) CLI / API Contract

**Module location** = `.claude/scripts/learning/metrics_daily_producer.mjs`（learning 域，与 `import_facts.mjs`/`heartbeat_runner.mjs` 同目录同风格）。
**导出**：`MetricsDailyProducer`（class）+ `produceMetricsDaily(options)` + `aggregateDay(dateUtc, inputs)` + `computeMetricRecordHash(body)`。forbidden-name：复合名（§0.1-9），禁裸 `evaluator`/`trial`/`candidate`。

```
node .claude/scripts/learning/metrics_daily_producer.mjs \
    [--date YYYY-MM-DD]    # 目标 UTC 日；默认 = 昨日（last complete UTC day，F2）
    [--allow-incomplete]   # 允许产出当前（未闭合）UTC 日；缺则当前日 fail-closed kind=incomplete_day（F2）
    [--regenerate]         # 显式覆盖 divergence guard：重算与既有同日 row hash 不同时仍写新行（F3）
    [--dry-run]            # write 轴 = rehearse：aggregate+validate+report，0 落盘（≠ 系统/importer dry_run）
    [--fixtures DIR]       # root 轴（与 --dry-run 正交）：注入 rootDir，隔离全部 6 输入 + metrics_daily/late_arrivals/lock
    [--json]               # 打印 MetricsDailyReport JSON
    [--help]
```
**两正交轴**（红队 M2）：`--dry-run` = **write 轴**（persist↔rehearse）；`--fixtures` = **root 轴**（default_root↔fixtures_root）。二者可组合（`--dry-run --fixtures /tmp/x` = fixtures-root 上 rehearse）。**禁用 `live`/`dry_run` 作 producer mode token**（避与 importer mode 撞）。
**无 ENV gate**（区别 1d；producer 无 bootstrap-confirm 语义——它不管理 control-plane 状态，只聚合）。**无 scheduler**（standalone manual / library trigger only，Pilot-1 invariant，N3）。

**Exit code 语义**：

| Code | 名称 | 触发 |
|---|---|---|
| 0 | SUCCESS | 聚合/校验/写入通过（或 `--dry-run` 已 report；或 same-hash **skip** = idempotent no-op，F3） |
| 2 | FAIL_CLOSED | 命中 **§1.5 四 kind**（`incomplete_day` / `input_unreadable` / `divergence` / `output_schema`）。**不写半成品 row**。consumer 读 `report.fail_closed.kind` 区分 |
| 1 | UNEXPECTED | 其他异常（lock 争用、意外 I/O throw、坏 `--date` 格式、template/schema 文件缺失） |

**Node API**：
```js
import { produceMetricsDaily } from "./metrics_daily_producer.mjs";
const report = produceMetricsDaily({ dateUtc: undefined /* default=yesterday */, dryRun: false, rootDir: undefined });
```

**MetricsDailyReport**（审计用；**非** metrics row 本体——含运行态字段）：
```js
{
  write_mode: "persist" | "rehearse",        // ← --dry-run 决定（write 轴）
  root_mode:  "default_root" | "fixtures_root", // ← --fixtures 决定（root 轴，与 write_mode 正交）
  date_utc: "2026-05-30",
  complete_day: true,                         // false iff --allow-incomplete 产当前日
  action: "appended" | "skipped_same_hash" | "regenerated" | "none",
  metric_record_hash: "sha256:...",
  current_phase: "evaluating_metrics_only" | null,
  phase_window_age_seconds: 0 | null,
  counts: { fact_records_total, fact_conflicts_total, fact_rejects_total, policy_trials_total, transitions_total },
  inputs_present: { records, conflicts, rejects, trials, transitions, live_state },  // bool map（§0.1-7）
  late_arrivals_appended: 0,
  fail_closed: { kind: null | "incomplete_day" | "input_unreadable" | "divergence" | "output_schema", detail },
  generated_at_utc: "<iso8601+tz>"
}
```

### 2) Input Sources 策略（6 源，全 frozen，读不写）

| # | 源 | 路径 | bucket 字段（UTC-date） | 喂养 |
|---|---|---|---|---|
| 1 | 1b fact records | `state/memory/facts/fact_run_outcome_records.jsonl` | **`emitted_at`**（业务事件日，EV2-I-01，§0.1-7 recompute-from-source；与 AGE shard 对齐） | counts · manifest_validator{PASS/WARN/FAIL}（c1）· source_dirty/provenance_dirty · redaction · source_system · schema_version drift |
| 2 | 1b conflicts | `state/runtime/learning/fact_conflicts/<source_system>/<identityHex>/`（leaf = `identityHex` = `event_identity_key` 去 `sha256:` 前缀，**opaque 仅计数不 parse-back**；`import_facts.mjs:260,:276`） | **`conflict_meta.yaml` `detected_at`**（import wall-clock，`import_facts.mjs:281`；**禁用目录 mtime**——非 replayable） | `c2_duplicate_conflict_count`（criterion-2 可观测项，§0.1-4，**per-import-day**） |
| 3 | 1b rejects | `state/runtime/learning/fact_rejects/<source_segment>/<raw_sha256>/reject_meta.yaml`（scanner 须枚举**全部** source_segment 含字面 `unknown/`——pre-schema reject 时 source_system 未受信，`import_facts.mjs:396,:403`） | **`reject_meta.yaml` `detected_at`**（import wall-clock，`:300`） | `c4_path_unsafe_reject_count`（criterion-4，§0.1-5）+ reject by-reason（7-enum），**per-import-day** |
| 4 | 1c trials | `state/runtime/learning/policy_trials.jsonl`（+内嵌 `operator_feedback`） | trial `evaluated_at`；D-11 atom 按 trial `evaluated_at`，late `reviewed_at` → side-car（N4） | system_verdict · evidence_origin · system_reason_codes · D-11 |
| 5 | 1d transitions | `state/runtime/learning/heartbeat_phase_transitions.jsonl` | `transition_at` | `phase_window_age_seconds`（**复用 `getPhaseWindowAge`**）· transition reason 分布 |
| 6 | 1d live state | `state/runtime/learning/heartbeat_learning_state.json`（**learning/，非 proactive/ decoy**，§0.1-6） | snapshot（非 bucket，annotation-only，§1.5 排除出 hash） | `current_phase` + heartbeat_snapshot 块 |

**读策略**：fact-record 全量 recompute-from-source（**非增量**）→ 对 `--date` 目标日重算（emitted_at bucket ⇒ late/backfill 导入落回原 emitted 日，需重算该日 row）。conflicts/rejects 按 `detected_at` 计入其 import 日（**per-import-day observability，非 emitted_at-day atom**；红队 M3）。每源 **existsSync-guard**；缺 = 0/null（§0.1-7），present-但-corrupt（file 级不可解析 / 缺 tz offset）= `input_unreadable` fail-closed（§1.5），present-但单行 malformed = skip + `malformed_line_count`（镜像 `getPhaseWindowAge:224` continue）。

### 3) "Daily" 窗口定义（F2，锁）

- **UTC calendar day** `[YYYY-MM-DD 00:00:00Z, 次日 00:00:00Z)`，按各源 §1.2 bucket 字段 normalize-to-UTC 后取日期部分（缺 offset → `input_unreadable` fail-closed，EV2-I-01）。
- **默认 `--date` = 昨日**（last complete UTC day）。**当前（未闭合）日须 `--allow-incomplete`**；缺则 `fail_closed.kind=incomplete_day`（保护：避免把半天数据当完整日喂 exit-criteria 评估）。
- 跨 UTC-midnight worked example：fact record `emitted_at=2026-05-10T00:30:00+08:00` → UTC `2026-05-09T16:30:00Z` → `date_utc="2026-05-09"`（与 AGE `out/facts/2026-05-09/` shard 1:1 对账，**仅 fact records**；conflicts/rejects 按 detected_at 计 import 日，**不**保证与 emitted shard 同日，红队 M3）。
- DST 不适用（UTC 无 DST）。

### 4) Output Schema Field Set（`metrics_daily_v1.schema.yaml`，sealed，**RECOMMENDED 集**）

> 字段集 = RECOMMENDED（4 出口准则可观测项 + 10-agent corroboration 逼出的 blind-spot），全部 **schema-fixed-cardinality（enum/bool/const/可 bucket 时间）、零新上游耦合**。这是唯一未进 user F1–F5 的 SPEC-author 默认（§9-R1，PR review 可 trim 为 MINIMAL）。**enum 值一律对齐 frozen schema 全称 token**（红队 M8）。

**envelope（required）**：`schema_version`(const "1.0.0") · **`generator_version`**(`^metrics_daily_producer@\d+\.\d+\.\d+$`，**SSOT 版本 token**，镜像 importer_version 约定；hash-OUT) · `date_utc`(`^\d{4}-\d{2}-\d{2}$`) · `generated_at_utc`(date-time，hash-OUT) · `window`{`start_utc`,`end_utc`} · `write_mode`(enum persist|rehearse，hash-OUT) · `root_mode`(enum default_root|fixtures_root，hash-OUT) · `complete_day`(bool) · **`metric_record_hash`**(`^sha256:[0-9a-f]{64}$`，F3，§1.5 hash body 定义) · `current_phase`(9-enum **或 null**，snapshot annotation，**hash-OUT**) · `phase_window_age_seconds`(int≥0 **或 null**，snapshot，**hash-OUT**)。

**`counts`（required）**：`fact_records_total` · `fact_conflicts_total` · `fact_rejects_total` · `policy_trials_total` · `transitions_total`（int≥0；breakdown 各子映射之和须 == total，可断言不变量）。

**`fact_records_breakdown`（required）**：`by_source_system`{amazon-growth-engine,chaming,loamwise} · `by_manifest_validator_status`{PASS,WARN,FAIL} · `by_redaction_status`{redacted,no_sensitive_fields_detected,unknown} · `source_dirty`{true_count,false_count} · `provenance_dirty`{true_count,false_count}（**与 source_dirty 分开计**，provenance_dirty ⊇ source_dirty，红队）· `schema_version_drift_count`（schema_version≠"1.0.0" 计数，drift canary）。

**`fact_rejects_breakdown`（required）**：`by_reason`{SCHEMA_INVALID,NUMERIC_NOT_STRING,PATH_UNSAFE,FILENAME_MISMATCH,IDENTITY_MISMATCH,CONTENT_MISMATCH,SIDECAR_LOG_MISMATCH}（7-enum occurrence-count）。

**`policy_trials_breakdown`（required）**：`by_system_verdict`{PASS,FAIL,DOWNGRADED,NEEDS_HUMAN} · `by_evidence_origin`{production_observed,historical_replay,golden_regression,synthetic} · **`system_reason_codes`**{11-enum occurrence}（**与 operator reason 分命名空间**，红队：二者独立词表均含 `acceptable`，禁混一个 histogram；array-valued ⇒ occurrence-count 非 record-count）· `with_operator_feedback_count` · `schema_version_drift_count`。

**`d11_kpis`（required，F4 = 入 schema nullable + reasons；enum 全称，红队 M8，源 `operator_feedback_v1:46-48`）**：`agreement_agree_count`(int = verdict==`AGREE_WITH_SYSTEM`) · `agreement_eligible_count`(int = verdict∈{`AGREE_WITH_SYSTEM`,`DISAGREE_WITH_SYSTEM`}，分母排除 `NEEDS_MORE_EVIDENCE`) · `operator_agreement_rate_today`(number **或 null**；agree/eligible，eligible=0 时 null) · `critical_false_negative_count_today`(int = verdict==`DISAGREE_WITH_SYSTEM` ∧ reason_codes∩{unsafe_reuse,regression_failed,business_context_changed}≠∅) · **`operator_reason_codes`**{5-enum occurrence} · **`kpi_unavailable_reasons`**(array of enum {`no_trials`,`no_operator_feedback`,`denominator_zero_all_needs_more_evidence`}；解释为何某 KPI null)。

**`phase_1_exit_signals`（required，per-day atom only；N1 无 c3 自报、N2 无 streak/gate）**：
- `c1_manifest_validator`{`per_source`:{<source>:{pass,warn,fail}}}（**strict PASS-only**：c1 达标须 fail==0 **且** warn==0 **且** pass≥1，WARN≠pass，红队）
- `c2_duplicate_conflict_count`(int，应 0) + `c2_dedupe_hit_rate`(const "unobservable_from_disk"，§0.1-4)
- `c4_path_unsafe_reject_count`(int，应 0；live-only 可证，§0.1-5)
- **无 `c3` 自报字段**（N1：producer 不自证「持续输出」；E3 由 2a 入口观测 row 在场/节律判定）

**`heartbeat_snapshot`（required，或 null；snapshot annotation，**整块 hash-OUT**，§1.5）**：`current_phase`(9-enum|null) · `flags`{7 控制旗} · `max_trials_per_day` · `kill_switch_required` · `last_run_at`(staleness 信号：runner 今天是否真跑) · `state_version` · `source_allowlist_count`。（live state absent/pre-v2 → null；`production_write_enabled` snapshot = Gate-8 Pilot-1 不变量证据，须 false。）

**`provenance`（required，metrics-specific，无 content-hash，红队镜像 1d 不 hash report）**：`input_sources`[{`path`,`records_consumed`}]（**sort by path** 保 replay diff-stable）· `producer_invocation`{`write_mode`,`root_mode`}（**hash-OUT**；版本 token 用 envelope.generator_version SSOT，**不**在此重复）· `aggregation_window`(=date_utc)。

**`late_arrivals_ref`（required）**：`{ledger_path, appended_this_run}`（N4 side-car 指针）。

`additionalProperties: false`（紧封；新 metric 须 `metrics_daily_v2` bump，红队）。

### 5) Idempotency + Fail-Closed（F3 + N5，**4-kind 顺序**）

**写模型**：metrics_daily.jsonl 采用与 lifecycle ledger（D-09）/ records / trials / transitions jsonl **一致的真 append-only 范式（禁 in-place mutation）**。

**`metric_record_hash` 定义（红队 HIGH H1 修正）** = `hashCanonical`（`canonical_json.mjs`）over **hash body = (date_utc, window, 由 6 个 on-disk 输入按 §1.2 确定性派生的全部聚合内容)**——即 `counts` + `fact_records_breakdown` + `fact_rejects_breakdown` + `policy_trials_breakdown` + `d11_kpis` + `phase_1_exit_signals` + `provenance.input_sources`。
**hash body 排除全部 snapshot / wall-clock / invocation-context 字段**：`generated_at_utc`、`generator_version`、`write_mode`、`root_mode`、`complete_day`、`current_phase`、`phase_window_age_seconds`、整块 `heartbeat_snapshot`、`provenance.producer_invocation`、`late_arrivals_ref`。
> 根据：hash 须是 **(date_utc + 6 输入 as-of run time) 的纯函数**，divergence 才**仅当 per-day INPUT 内容变化**触发（F3「防悄漂移」原意），而非因 control-plane snapshot 推进（phase flip / window age 增长 / runner 又跑 / mode 不同）误触发。`current_phase`/`heartbeat_snapshot`/`phase_window_age` 是 first-generation 的 point-in-time annotation，skip 时保留首次值（observability 可接受）。

**F3 写时 guard**（重建 seen-by-date_utc 从 metrics_daily.jsonl 自身，镜像 1c `buildSeenTrialIds`）：
- 同 date_utc **无既有 row** → append（首写，`action=appended`）。
- 有既有 row ∧ **hash 相同** → **skip**（idempotent no-op，exit 0，`action=skipped_same_hash`）。
- 有既有 row ∧ **hash 不同**（divergence = per-day input 真变）→ **fail-closed exit 2 `kind=divergence`**，**除非 `--regenerate`** → append 新行（`action=regenerated`，consumer latest-wins per date_utc）。

**四 kind fail-closed（检查顺序，exit 2，不写半成品）**：
1. `incomplete_day` — `--date` = 当前未闭合 UTC 日 ∧ 无 `--allow-incomplete`（pre-flight，无 I/O）。
2. `input_unreadable` — 某输入 file 级不可解析 / 缺 tz offset（≠ 缺文件=graceful 0；≠ 单行 malformed=skip+count）。
3. `divergence` — 重算 hash ≠ 既有同日 row hash ∧ 无 `--regenerate`（compute 后、write 前）。
4. `output_schema` — 组装的 metrics row 过不了 `metrics_daily_v1` ajv（defense-in-depth，write 前）。

**lock**：O_EXCL `state/runtime/learning/metrics_daily.lock`（镜像 1d，防 manual double-invoke torn append）；`--dry-run` 不 lock（不落盘）。atomic = 单行 `appendFileSync`（sub-PIPE_BUF 原子）+ late_arrivals/lock 同目录。

### 6) Provenance + 下游边界（N1/N2/N3）

- **metrics-specific provenance**（§1.4）；**无 content-hash 输入聚合**（observability artifact，非 promotion evidence——promotion gate 读 trials+operator_feedback+confidence_formulas，不读 metrics roll-up）。
- **producer standalone**（N3）：**不 spawn/import** heartbeat_runner / policy_trial_evaluator / import_facts；只读 6 个 on-disk 产出。⇒ §0.1-4 criterion-2 silent-skip 保持读盘 unobservable（不靠 invoke importer 补）。
- **Phase-1 exit GATE = 2a 入口**（N2）：1e 只产 per-day atom；**7-day PASS streak 派生 + 4-criteria gate 判定 + pass/fail verdict 全在 2a**（→trialing flip predicate 之前的入口检查）。1e **不**实现 streak / gate / verdict。
- **N1**：producer **不自报 E3**（无 `metrics_emitted:true` 自证字段）；E3「持续输出」由 2a 入口观测 row 在场/节律判定。

### 7) Late-Arrival Handling — evidence-ledger 范式第三次复用（N4）

`operator_feedback` 是 OPTIONAL + **async**（trial 在 day N、feedback 可能 day N+3 才 append 进 `policy_trials.jsonl` 的 trial 对象）。daily atom **immutable**（append-only，不回改 closed day）。
- **机制**：producer 跑 `--date N` 时，对 trial `evaluated_at` ∈ day N 的 trial 计 D-11 atom；若发现 feedback 的 `reviewed_at` 的 UTC-date ∉ 该 trial 的 `evaluated_at` UTC-date（late arrival），**不回改 day N 的 closed row**，而是 append 一条到 `state/runtime/learning/metrics_daily_late_arrivals.jsonl`（side-car ledger，evidence-ledger 范式第 3 次复用：1c evidence-ledger + 1d cursor sidecar + 1e late-arrivals）：`{trial_id, trial_evaluated_date_utc, feedback_reviewed_at, operator_verdict, operator_reason_codes}`。
- **序列化**：side-car 用 **JSONL**（JSON.stringify by construction → injection-safe，落实 1c YAML-injection 教训：外部 scalar 一律 JSON.stringify-escape；JSONL 天然满足）。
- **下游（2a）**：30-day rolling D-11 reducer = Σ(daily atoms) ⊎ late_arrivals ledger，把 late feedback 重新归入正确历史日。1e **不**实现 reducer（N2）。

### 8) Trigger Model + 复用清单

- **Trigger** = manual CLI / library only，**无 scheduler / cron / launchd**（Pilot-1 invariant）。manual ⇒ 合并不触发写。
- **复用**（不自实现）：`getPhaseWindowAge`（1d export）· `hashCanonical`/`parseCanonical`（1b `canonical_json.mjs`）· ajv 配置 · atomic temp+rename · O_EXCL lock · existsSync→null graceful guard · malformed-line skip+count。

### 9) Test Strategy → §4 表

---

## §2 Cross-Cutting Hard Constraints

| Gate | Phase 1e 应用 |
|---|---|
| **Gate 4**（Layer-2 不写 Layer-0） | ✅ 1e 全在 liye_os Layer-0 内部 |
| **Gate 6**（fact ingest 双 hash 幂等） | ✅ 不涉（1e 不 ingest，只聚合） |
| **Gate 7**（heartbeat 首启 dry_run） | ✅ 不触 heartbeat state（只读 live state snapshot） |
| **Gate 8**（Pilot 1 无 production_write） | ✅ producer 只写 metrics_daily.jsonl + late_arrivals + lock；**0 trial/candidate/policy/production write** |
| **Pilot 1 invariant** | ✅ AGE `write_capability_effective: none` 全程不变；无 scheduler |

**禁触清单（frozen / Hard-NO）**：
- ❌ `scripts/heartbeat_runner.mjs`（File B / S1 execution-gate）
- ❌ 任一 frozen schema（`_meta/contracts/learning/*.schema.yaml` 已存在 **10 个 schema** 文件）+ `confidence_formulas.yaml`
- ❌ 1a/1b/1c/1d artifacts：`emit_fact.py` / `import_facts.mjs`（**含加 dedupe-ledger**）/ `canonical_json.mjs` / `policy_trial_evaluator.mjs` / `heartbeat_runner.mjs` / `records.jsonl` / `fact_conflicts/` / `fact_rejects/` / `policy_trials*` / `heartbeat_phase_transitions.jsonl`
- ❌ AGE / loamwise 任何文件
- ❌ spawn / import / 调用 heartbeat_runner / policy_trial_evaluator / import_facts（N3）
- ❌ 实现 7-day streak / exit gate / pass-fail verdict / 30-day rolling reducer（= 2a，N2）
- ❌ launchd / cron / scheduler · flip `learning_sources.yaml` enabled · amend / force-push / --no-verify / --admin / rebase

**in-scope editable（非 File-A 但非 frozen，§0.1-10）**：✅ `_meta/contracts/scripts/validate-contracts.mjs`（注册新 schema）· ✅ `_meta/docs/GHL-RUNBOOK.md`（扩充 + 3 fix，纯 additive + 事实修正，**不重开 sealed D-log/Gate**，runbook L276）· ✅ 新建 `metrics_daily_v1.schema.yaml` + producer + tests + workflow + committed fixtures。（`.gitignore` 无需改——L330 已覆盖。）

---

## §3 Phase 1e 验收标准 (DoD)

| # | Criterion | 验收方式 |
|---|---|---|
| 1 | `metrics_daily_producer.mjs` 提交 | `git ls-files .claude/scripts/learning/metrics_daily_producer.mjs` |
| 2 | CLI `--help`/`--json` 跑通 | `--help` exit 0；`--json` 输出 MetricsDailyReport（§4 smoke） |
| 3 | `metrics_daily_v1.schema.yaml` 提交 + **真过 contracts gate** | `git ls-files` + **在 `_meta/contracts/scripts/validate-contracts.mjs` schemaFiles（L526 后）注册** + 负向测试（损坏 schema → gate 红） |
| 4 | bind=0 graceful-empty-emit | 6 输入全缺 → well-formed zeroed row + `inputs_present` 全 false + exit 0（**不 fail**，§0.1-7） |
| 5 | UTC 日历日 bucket + 默认昨日 | records emitted_at / trials evaluated_at / transitions transition_at / conflicts+rejects detected_at UTC-date；默认 `--date`=昨日；当前日缺 `--allow-incomplete` → `kind=incomplete_day` |
| 6 | F3 idempotency + **hash 稳定性** | 同日同 hash → skip(exit 0)；diverge → exit 2 `kind=divergence`；`--regenerate` → append 新行；**hash 排除 snapshot/wall-clock（§1.5）：mutate live heartbeat state、相同 per-day 输入 → hash 不变、不 diverge**（红队 H1） |
| 7 | 四 kind fail-closed 顺序 | incomplete_day → input_unreadable → divergence → output_schema；每 kind exit 2 + 不写半成品 |
| 8 | row 写前过 `metrics_daily_v1` ajv | 组装 row ajv fail → `kind=output_schema` exit 2（producer-side 强 enforce，§0.1-3） |
| 9 | D-11 atom 正确（F4，全称 enum） | agree(`AGREE_WITH_SYSTEM`)/eligible({AGREE,DISAGREE}_WITH_SYSTEM) 分子分母；rate eligible=0→null + `kpi_unavailable_reasons`；critical_false_negative=`DISAGREE_WITH_SYSTEM`∩3codes |
| 10 | decoy 不读 + late-arrival ledger | 读 `learning/` 非 `proactive/`（§0.1-6）；late feedback（reviewed_at UTC-date ∉ trial day）→ `metrics_daily_late_arrivals.jsonl`（N4） |
| 11 | `getPhaseWindowAge` 复用 | `phase_window_age_seconds` 来自 1d export，非自实现 |
| 12 | append-only + O_EXCL lock | 不 in-place mutate；double-invoke 不 torn |
| 13 | RUNBOOK §1/§3/§4/§5/§6 各 ≥1 bash | grep 5 节各 ≥1 ```bash 块；按 F5 风格（§1 smoke / §3-§4 fixture-via-**producer** / §5 dry-run+warning / §6 静态，§7-C5 具体命令） |
| 14 | RUNBOOK 3 correctness fix | §2/§7 `proactive/`→`learning/`（L62/L257）；§2 pass-count → **注册后实跑真值**（当前真值 18，注册 +1 = 19，**禁从旧值 17 推算**，§9）；L3 status header flip；§2 内扩展 metrics 命令（**不新增 §8**，N6） |
| 15 | 1a/1b/1c/1d artifacts + frozen schemas + File B 0 改动 | `git diff origin/main -- <列表>` 空 |
| 16 | liye_os CI green + metrics tests CI-wired（本 PR） | GitHub PR checks（新 workflow `learning-metrics-daily-tests.yml` node 18/20/22 path-trigger） |
| 17 | forbidden-name lint green | `bash tools/lint_forbidden_names.sh` 对 producer+test 绿；复合名 only，0 裸 `evaluator`/`trial`/`candidate` 声明（§0.1-9） |

## §4 Required Test Coverage

| 类别 | 覆盖 |
|---|---|
| bind=0 / empty | 6 输入全缺 → zeroed row + exit 0；present-空文件 == 缺（`getPhaseWindowAge:218` existsSync + `:227` empty-entries 范式） |
| 单日聚合 | 合成 records/trials/transitions/conflicts/rejects → counts + 全 breakdown 正确 |
| 多日跨 UTC 边界 | record emitted_at 23:30+08:00 → 前一 UTC 日 bucket；只目标日计入 |
| F2 day-selection | 默认=昨日；当前日无 `--allow-incomplete` → `kind=incomplete_day`；有则产 `complete_day:false` |
| F3 idempotency + hash 稳定 | 同 hash skip；diverge fail-closed；`--regenerate` append；**mutate live heartbeat state + 同 per-day 输入 → hash 不变**（红队 H1） |
| 四 kind fail-closed | 每 kind 独立 → exit 2 + 0 row write；顺序正确 |
| output_schema enforce | 故意坏 row（缺 required / version≠const / 多 key）→ `kind=output_schema` |
| D-11（F4，全称 enum） | 分母=0→rate null + `kpi_unavailable_reasons`；critical_false_negative=`DISAGREE_WITH_SYSTEM`∩3codes；array reason occurrence-count |
| system vs operator reason 分命名空间 | 二者均含 `acceptable` 不混 |
| manifest strict PASS-only | WARN 不计 c1 pass（red-team） |
| criterion-4 path_unsafe | live reject dir reason==PATH_UNSAFE 计数（含 `unknown/` segment）；dry_run 0 |
| criterion-2 半盲 stamp | `c2_dedupe_hit_rate=="unobservable_from_disk"`；`c2_duplicate_conflict_count` 来自 fact_conflicts/ 按 detected_at |
| decoy 不读 | 存 `proactive/` v1 文件 + 缺 `learning/` → `current_phase:null`，**不读 proactive/** |
| late-arrival ledger | feedback reviewed_at UTC-date ∉ trial evaluated day → append `late_arrivals.jsonl`，closed row 不回改（N4） |
| `getPhaseWindowAge` 复用 | transitions 派生 window age；缺 transitions → null |
| append-only + lock | 不 in-place；O_EXCL 第二 invoke 拒/排队 |
| `--dry-run` 0 落盘 | 无 metrics_daily/late_arrivals/lock 写 |
| 三层路径隔离 | `--fixtures` rootDir seam；各产出各落各位；report `root_mode=fixtures_root` |
| 复用零自实现断言 | grep producer source：`getPhaseWindowAge`/`hashCanonical` 来自 import，不内联重写 canonical |
| contracts gate 负向 | 损坏 `metrics_daily_v1.schema.yaml` → `validate-contracts.mjs` 红（证已注册） |

## §5 Resolved Decision Log

| ID | Decision | Rationale |
|---|---|---|
| F1 | **schema-first MUST** | 无 metrics schema 存在 → 1e 定义所有者；gate 是 hardcoded 数组 → schema-less = 0 CI 覆盖；镜像 1a-1d sealed |
| F2 | **UTC 日历日 + 默认昨日 + 当前日 `--allow-incomplete`** | EV2-I-01 UTC-of-emitted_at；7-day PASS 仅 UTC 日可数；半天数据不当完整日喂 exit-criteria |
| F3 | **same-hash skip / diverge fail-closed + `--regenerate`** | append-only(D-09 范式) + 确定性 guard：divergence = 硬错（防悄漂移）；hash 须 per-day input 纯函数（红队 H1）；显式 override 才写新行 |
| F4 | **D-11 入 schema nullable + `kpi_unavailable_reasons[]`** | atoms(分子+分母)可加，避 Simpson；nullable+reasons 自证 null 因；30-day gate 下游(2a) |
| F5 | **Runbook bash 混合**：§1 smoke / §3-§4 fixture(via producer) / §5 dry-run+warning / §6 静态 | 每节风格匹配语义；fixture 经 producer `--fixtures`（importer/evaluator 无 fixture CLI seam，红队 M5） |
| N1 | **producer 不自报 E3** | 无自证字段；E3 由 2a 入口观测判定 |
| N2 | **Phase-1 exit gate = 2a 入口（不在 1e）** | 1e 只产 atom；streak/gate/verdict/30-day reducer 全 2a |
| N3 | **producer standalone（不调 heartbeat/evaluator/importer）** | 读盘 only；criterion-2 silent-skip 保持读盘 unobservable，不靠 invoke 补 |
| N4 | **late-arrival 走 evidence-ledger 范式第三次复用** | daily atom immutable；async late feedback → side-car ledger（JSONL，injection-safe） |
| N5 | **4-kind fail-closed 顺序** | incomplete_day→input_unreadable→divergence→output_schema；镜像 1d kind-taxonomy |
| N6 | **Runbook §2 内扩展 metrics，不新增 §8** | 收敛 section；metrics 属 Daily Operations |
| §0.1-4 | **criterion-2 半盲 → 读盘可观测 + stamp unobservable** | silent-skip 0 落盘（frozen 1b）；1e 不改 1b；errata §9 |
| §0.1-6 | **读 `learning/` 非 `proactive/` decoy** | 1d SSOT = learning/；proactive/ = pre-GHL v1 无 current_phase |
| §0.1-7 | **bind=0 graceful-empty-emit** | day-1 真实态；fail-on-empty 会 brick metrics-only 窗口 |
| H1（红队） | **metric_record_hash 排除全部 snapshot/wall-clock/invocation 字段** | hash = (date_utc + 6 输入) 纯函数；否则重跑闭合日因 control-plane 推进 spurious divergence，违 F3 |
| M3（红队） | **conflicts/rejects 按 detected_at 计 import 日；1:1 AGE-shard 仅 records** | conflicts/rejects 非 date-sharded，唯一时间 = import wall-clock；leaf=identityHex、reject 枚举 `unknown/` |

## §6 Out-of-Scope（硬边界）

- 7-day PASS streak 派生 + Phase-1 exit gate 判定 + pass/fail verdict → **Phase 2a 入口检查**（N2）
- 30-day rolling D-11 KPI gate 判定（operator_agreement_rate≥0.7 / critical_false_negative=0）→ **Phase 2a / Phase 4**
- `evaluating_metrics_only → trialing` flip → **2a** · `trial_history` 回写 → **2a** · confidence verdict → **2a** · evaluator-intrinsic 二次门 → **2a**
- 给 frozen `import_facts.mjs` 加 durable dedupe-ledger（关 criterion-2 真命中率）→ **未来 1b instrumentation phase**（1e 不改 frozen 1b）
- scheduler / cron / launchd → 永不在 1e · `scripts/heartbeat_runner.mjs`（File B）→ 永不
- flip `learning_sources.yaml` AGE `enabled:true` → 独立 0d
- FU-2 / errata-v3 → 不混入

## §7 Implementation Plan Skeleton（留给实施指令包 expand）

实施指令包至少覆盖（atomic commits，每个留绿 `node --test`）：
1. branch from liye_os `origin/main`（≥ `e2e52fb`）
2. **C1** `metrics_daily_v1.schema.yaml`（sealed，§1.4 field set，enum 全称对齐 frozen）**+ 在 `_meta/contracts/scripts/validate-contracts.mjs` schemaFiles L526 后注册**（"Phase 1e" 注释；否则 gate 静默跳过）
3. **C2** `metrics_daily_producer.mjs`（6-input aggregate · UTC bucket（records emitted_at / conflicts+rejects detected_at）+ 默认昨日/`--allow-incomplete` · F3 hash guard（hash body = §1.5 纯函数，排除 snapshot/wall-clock）+ `--regenerate` · 四 kind fail-closed · graceful-empty · decoy-safe · late-arrival ledger · 复用 getPhaseWindowAge/hashCanonical · O_EXCL lock · ajv output enforce · 正交 --dry-run/--fixtures）
4. **C3** committed fixture tree `tests/fixtures/metrics_daily/`（合成 records.jsonl + policy_trials.jsonl + transitions + conflicts/ + rejects/，**committable 非 gitignored**，红队 M5）+ `tests/test_metrics_daily_producer.mjs`（§4 矩阵；prefix-named → vitest 不收）+ contracts-gate 负向
5. **C4** CI workflow `.github/workflows/learning-metrics-daily-tests.yml`（path-trigger producer+tests+schema+fixtures+validate-contracts；node 18/20/22；显式 `node --test tests/test_metrics_daily_producer.mjs`；node-only 零 cross-repo）
6. **C5** `_meta/docs/GHL-RUNBOOK.md` extend（具体命令，全 dry-run-safe 实跑落 expected output）：
   - §1 **smoke**：`node _meta/contracts/scripts/validate-contracts.mjs --self-test`（Pass:7/Fail:0）
   - §3 **fixture(via producer)**：`node .claude/scripts/learning/metrics_daily_producer.mjs --fixtures tests/fixtures/metrics_daily --date <fixture-day> --dry-run --json`（展示 fact ingest 聚合，非调 importer）
   - §4 **fixture(via producer)**：同上 `--json` 读 `policy_trials_breakdown` + `d11_kpis`（展示 policy lifecycle 观测）
   - §5 **dry-run+warning**：`node ... metrics_daily_producer.mjs --date <yesterday> --dry-run --json` + 显式 warning 行「promotion/demotion 程序仍 gated 至 Phase 2c；此 dry-run 仅展示 WOULD-feed-future-promotion-review 的 metrics，**observability-only 非 promotion action**」
   - §6 **静态**：`head -40 _meta/contracts/learning/metrics_daily_v1.schema.yaml`（或 `cat` schema，**无 runtime state**，incident/quarantine 静态参考；observability-only）
   - §2 **内扩展** metrics 命令（**不新增 §8**，N6）+ 3 fix：proactive→learning（L62/L257）· pass-count → **注册后实跑** `validate-contracts.mjs` 取真值（当前 18 → 19，禁从旧值 17 推算）· status header（L3）flip
7. CI 全绿 + 自检（`--help` exit 0；bind=0 exit 0；`--dry-run` 0 落盘；hash 稳定性测试；复用零自实现 grep；contracts-gate 负向证非跳过；forbidden-name lint 绿；RUNBOOK 5 bash 各实跑落 expected output）
8. PR review：本 SPEC blob SHA reference + DoD 17 checklist + Hard NO 自审
9. Merge: squash; 0 force-push; 0 admin（**user 在 GitHub UI 用 liyecom merge**，REVIEW_REQUIRED）

**禁触**：File B / frozen schemas / 1a-1d artifacts / AGE / loamwise / heartbeat-evaluator-importer 调用 / scheduler / streak-gate-reducer。**in-scope editable**：validate-contracts.mjs / GHL-RUNBOOK.md（§0.1-10）。**forbidden-name**：复合名安全，禁裸 `evaluator`/`trial`/`candidate`（§0.1-9）。

## §8 SPEC Anchor / Version Control

- Phase 1e 实施指令包必须引用**本 SPEC 的 git blob SHA**（liye_os main 落盘后）；不引用 commit SHA。
- v1.0 → v1.1 任何修订须 user 显式 sign-off + version bump。
- SPEC blob 漂移 → 实施 PR review 必拒。
- 实施 PR description 必须 reference SPEC v1.0 blob SHA + 列举 DoD 17 checkbox + Hard NO 自审。

## §9 Findings / Open Items（带入实施 / 上游 doc-fix）

| ID | Finding | Disposition |
|---|---|---|
| **R1** | 字段集 = RECOMMENDED 集（含 blind-spot：evidence_origin / source_dirty+provenance_dirty 分计 / schema_version drift / heartbeat_snapshot）——唯一未进 user F1–F5 的 SPEC-author 默认 | 全 schema-fixed-cardinality 零新耦合，各映射一准则/不变量；**PR review 可 trim 为 MINIMAL**（4 出口准则项）。显式披露 |
| **N (path-typo 承接)** | 1d SPEC §0.1-9/§7 误写 validate-contracts 于 `.claude/scripts/contracts/`；真实 = `_meta/contracts/scripts/validate-contracts.mjs`（实证 dead path） | 本 SPEC 一律用真实路径；1d SPEC frozen 不改，记此 errata（doc-fix，非阻塞） |
| **H1（红队 HIGH，已 fold）** | metric_record_hash 原仅排除 generated_at+producer_invocation，仍含 current_phase/phase_window_age/heartbeat_snapshot/mode → 重跑闭合日因 control-plane snapshot 推进 spurious divergence，违 F3 | §1.5 修：hash body = (date_utc + 6 输入) 纯函数，排除全部 snapshot/wall-clock/invocation 字段；DoD#6 + §4 加 hash-稳定性测试（mutate live state 不改 hash） |
| **C2-blind** | criterion-2「dedupe 命中率稳定」silent-skip 分子 0 落盘（frozen 1b `import_facts.mjs:457` 内存计数）→ 读盘不可算命中率 | 1e 报 `c2_duplicate_conflict_count`(可观测) + stamp `unobservable_from_disk`；准则文字 1e 不 own（gate=2a）；真命中率需未来 1b instrumentation（1e 不改 frozen 1b） |
| **C4-live-only** | PATH_UNSAFE reject 仅 live import 落 `fact_rejects/`；dry_run 不落 | `c4_path_unsafe_reject_count` 仅 live import 期可证；SPEC 注明 |
| **bucket-asymmetry（红队 M3）** | conflicts/rejects 无 date-shard，唯一时间 = `detected_at`（import wall-clock）→ 按 import 日计，非 emitted_at-day；1:1 AGE-shard 对账仅 records | §1.2/§1.3/§0 N-3 已 scope；conflict leaf=identityHex（opaque 计数），reject 枚举 `unknown/` segment |
| **decoy** | `state/runtime/proactive/heartbeat_learning_state.json` 物理存在 = pre-GHL v1（无 current_phase） | producer + RUNBOOK 读 `learning/`，容忍 absent/pre-v2 → null；§0.1-6 + DoD#10 守之 |
| **RUNBOOK-stale** | §2/§7 heartbeat 路径 proactive/（L62/L257）+ §2 "17 pass"（**已 stale**：当前真值 18）+ L3 "Phase 0e Skeleton — gated" 过时 | 1e in-scope additive fix；pass-count **注册新 schema 后实跑 `validate-contracts.mjs` 取 verbatim Passed:N**（当前 18 + 1 = 19，**禁从旧值 17 算**，红队 M1） |
| **fixture-scope（红队 M5）** | RUNBOOK §3/§4 fixture-backed：importer/evaluator 无 fixture CLI seam，无可复用 committed fixtures | §3/§4 bash 经 **producer `--fixtures`**；1e 新建 committed fixture tree `tests/fixtures/metrics_daily/`（committable，非 gitignored state/）。net-new fixture authoring scope 披露 |
| **late-arrival** | operator_feedback async（trial day N、feedback day N+3） | evidence-ledger 范式第三次复用：side-car `metrics_daily_late_arrivals.jsonl`，closed atom 不回改；30-day reducer = 2a |

**4-lens 红队 disposition**：1 HIGH（H1 hash）+ 8 MED（pass-count×3→M1 / producer_mode→M2 / conflict-reject-bucket→M3+M7 / version-field→M4 / fixture-seam→M5 / §5-§6-命令→M6 / D-11-enum→M8 / schema-count→§2）+ 7 LOW（schema-count / :226→:227 / conflict-leaf / N-2-L559 / N-3-attrib / D-09-soften / forbidden-name-DoD）**全部 fold**。0 refuted-as-wrong（红队全 ground-truthed 命中）。

无 blocker。实施可在 user 批准 v1.0 PR 后开工（streak/gate/reducer/flip 均为 2a 独立改动，与 1e 解耦）。

---

**END OF SPEC v1.0**
