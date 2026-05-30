# Phase 1c SPEC v1.0 — liye_os `policy_trial_evaluator.mjs`

**Status**: APPROVED-PENDING (user review 2026-05-30, v0.1 → v1.0 incorporating OPEN-A/B/C/D resolutions + adversarial-analysis findings + ground-truth verification)
**Scope**: liye_os 单边新增 `src/reasoning/policy_trial_evaluator.mjs` —— 读 1b importer 产出的 `state/memory/facts/fact_run_outcome_records.jsonl` + `state/runtime/learning/fact_conflicts/` → 显式绑定 `policy_id` → Pilot 1 negative-learning verdict（**仅 duplicate_conflict 情形2**）→ 写 `policy_trial_v1` 到 `state/runtime/learning/policy_trials.jsonl` + 旁挂 evidence-ledger。**dry-run-first**，observability-only（Hard Gate 8），单边（0 AGE / 0 loamwise / 0 heartbeat / 0 schema）。
**Out of scope**: heartbeat v2 7-flag 接入（1d）· crystallizer / candidate writing（2b/2c）· promotion / execute_limited（4）· `trial_write_enabled` 调度门（1d）· operator_feedback 写入路径（外部异步）· confidence-based / regression / golden-pack verdict 触发（2a）· 回写 `learned_policy.trial_history`（1d/2a）
**Drafted**: 2026-05-30
**Anchor for implementation**: 本文件是 Phase 1c 实施指令包的 normative input；实施时 SPEC 锁版本（file blob SHA），禁止悄改。

---

## §0 Normative Anchors

| Tier | Source | 锁定内容 |
|---|---|---|
| N-1 | `GHL-evolution-plan-v4.1.md` §3 (Phase 1c row, line 134) | deliverable = `src/reasoning/policy_trial_evaluator.mjs` + `policy_trials.jsonl` writer；前序 1b；**evaluator 必须先于 heartbeat dry_run**（D-05 修复 v4.0 顺序倒置）|
| N-1 | 同上 §2 Hard Gates 4/6/7/8 + Pilot 1 invariant | observability-only · 双 hash 幂等 · heartbeat 首启 dry_run · 无 production_write |
| N-1 | 同上 §7.4 `negative_evidence_guardrail` | FAIL/DOWNGRADED always qualify；NEEDS_HUMAN 仅当 operator reason ∈ 3 codes（D-12）—— **本期不实现 promotion 侧，仅记录边界** |
| N-1 | 同上 §7.5 `confidence_formulas` / `confidence_formulas.yaml` | `ghl_confidence_v1`；`missing_input=fail_closed`；boundary 0/1=`requires_review`（**本期不触发，见 §6 / §9-F2**）|
| N-2 | `GHL-v4.1-errata.md` §3 B-05 | `policy_trial_v1` schema + **duplicate_conflict 双落点（情形1 vs 情形2）** + `system_verdict_reason_codes` 与 `operator_feedback.reason_codes` 解耦 |
| **契约 (OUTPUT)** | `policy_trial_v1.schema.yaml` (blob, `additionalProperties:false`, 7 required) | evaluator 写出的 trial schema |
| **契约 (INPUT)** | `fact_run_outcome_record_v1.schema.yaml` (24 fields) | evaluator 读入的 record schema |
| 契约 (binding 目标) | `learned_policy_ghl_v1.schema.yaml` + legacy `learned_policy.schema.yaml` | `policy_id` 来源；二者皆带 `evidence[].trace_id` |
| 契约 ($ref) | `operator_feedback_v1.schema.yaml` | 异步追加，独立词表（本期不写）|
| **CODE-SSOT** | 1b `import_facts.mjs` (blob `39f02581`) + `canonical_json.mjs` (blob `42b05d04`) @ main `af0e0b4` | record 字节形态 / canonical 复算 / `canonical_record_hash` invariant / `resolveSymlinksAllowingMissing` |
| 现状 | `state/memory/learned/policies/` | candidate×1 (legacy `BID_RECOMMEND_..._17ED8F`) + production×1 (`SAMPLE_BID_OPT_POLICY`)；GHL-schema policy **尚不存在** |
| 现状 | `records.jsonl` / `fact_conflicts/` **尚不存在**（importer 未 live 跑）| evaluator 必须优雅处理空输入 → **expected bind=0 at 1c runtime**（见 §1.3）|

**冲突优先级**：CODE-SSOT > N-2 > N-1 > 现状描述。

### §0.1 ⚠ CODE/SCHEMA-AUTHORITATIVE 关键前提（对抗分析发现）

1. **`policy_trial_v1` 是密封 schema、无 record back-link**：7 required = `{trial_id, policy_id, system_verdict, system_verdict_reason_codes, evidence_origin, evaluated_at, schema_version}` + optional `operator_feedback`，`additionalProperties:false`。**没有 `canonical_record_hash` / `trace_id` / 源 event 引用 / `provenance_dirty` 字段**。→ trial 行内无法记录「哪条 record 驱动 verdict」或 provenance。**消解 = evidence-ledger 旁挂（§1.6）**，这是本仓库**定型范式**（镜像 1b 的 `conflict_meta.yaml` / `reject_meta.yaml`），**非过渡方案**；schema 冻结于 Phase 0b，1c 不改。
2. **record 无 `policy_id`**：绑定机制 baseline 未字面定义（B-05 情形2 只说"已绑 policy_id"）。→ 本 SPEC §1.3 定义 explicit-reference-only 绑定。
3. **现有 policies 是 legacy-schema**（缺 GHL-required `confidence_basis`）→ `ghl_confidence_v1` 对它们 `missing_input=fail_closed`。→ confidence-based verdict 在 1c 不可算、**本期不实现**（§9-F2）。
4. **`event_content_hash` / `canonical_record_hash` 复算遵 CODE-SSSOT（1b）**：禁照 schema 散文（1b 已实证 schema §1.7.X 的 "强制转义 U+2028/U+2029" 散文**错误** —— Python `json.dumps(ensure_ascii=False)` 原样发射）。1c 复用 `canonical_json.mjs`，不自实现 canonicalization；测试 fixture 禁 commit raw U+2028/U+2029（no-bidi gate）。

---

## §1 9-Item Contract Surface

### 1) CLI / API Contract

**Module location** = `src/reasoning/policy_trial_evaluator.mjs`（NEW；与兄弟 `playbook_evaluator.mjs` / `auto_eligibility_evaluator.mjs` / `feedback/action_outcome.mjs` 同目录、同风格）。

**导出**：`PolicyTrialEvaluator`（class，whitelisted 复合名）+ `evaluatePolicyTrials(options)` API。⚠ **forbidden-name 纪律**（承接 1b `candidate` 教训）：禁裸标识符 `evaluator` / `trial` / `candidate` / `trust_score` / `trust_matrix`；用 whitelisted `PolicyTrialEvaluator` / `policy_trial` / `policy_trial_evaluator.mjs` / `confidence`。

```
node policy_trial_evaluator.mjs \
    --records <path>        # 默认 state/memory/facts/fact_run_outcome_records.jsonl（metrics + binding 演练 + watermark 源）
    --conflicts <dir>       # 默认 state/runtime/learning/fact_conflicts/（情形2 = 唯一 trial 生产源）
    --policies <dir>        # 默认 state/memory/learned/policies/（binding 目标）
    --trials-out <path>     # 默认 state/runtime/learning/policy_trials.jsonl
    --since <ISO8601>       # 可选；运维便捷过滤（按 record.ingested_at / conflict detected_at），非正确性依赖
    --mode {dry_run,live}   # 默认 dry_run（锁 dry-run-first；0 落盘）
    [--engine-repo <dir>]   # 可选；AGE repo 根（artifact-deref realpath 解析）；缺省 sibling clone
    [--json]                # 输出 EvalReport JSON
    [--help]
```

**Exit code 语义**（镜像 1b）:

| Code | 名称 | 触发 |
|---|---|---|
| 0 | SUCCESS | 全部处理完，0 fail-closed |
| 2 | FAIL_CLOSED | ≥ 1 个 trial schema-invalid / canonicalization 失败 / 必填派生缺失（fail-closed，不写半成品）|
| 1 | UNEXPECTED | 其他错误 |

**Node API**:

```js
import { evaluatePolicyTrials } from "./policy_trial_evaluator.mjs";
const report = evaluatePolicyTrials({
  records: "state/memory/facts/fact_run_outcome_records.jsonl",
  conflicts: "state/runtime/learning/fact_conflicts",
  policies: "state/memory/learned/policies",
  trialsOut: "state/runtime/learning/policy_trials.jsonl",
  mode: "dry_run",   // dry_run 为纯函数, 0 落盘
  engineRepo: null,
  rootDir: undefined, // 测试 seam
});
```

**EvalReport**（审计用）:

```js
{
  mode,
  records_scanned, conflicts_scanned,
  bound, unbound,                          // binding 统计（1c expected bound=0）
  trials_new, trials_skipped_idempotent,   // 情形2 trial 生产 + 幂等去重
  needs_human,                             // == trials_new（1c 仅 NEEDS_HUMAN）
  metrics: {
    verdict_distribution,                  // 1c 恒 { NEEDS_HUMAN: n } 或空
    evidence_origin_distribution,
    bound_via_distribution                 // { conflict_trace_evidence, artifact_deref }
  },
  per_trial: [{ trial_id, policy_id, system_verdict, system_verdict_reason_codes, evidence_origin, bound_via, evidence_ledger_path }],
  trials_out, evidence_ledger_dir,
  window_start, window_end
}
```

### 2) Input Source 策略 — 双源 + 增量 watermark

- **trial 生产源** = `fact_conflicts/<source_system>/<event_identity_key>/`（1b importer 写）。每个 conflict 含 `original.json`（已存 record，24 字段）+ `incoming.json`（incoming 冲突 event 原始字节，20 字段）+ `conflict_meta.yaml`。→ **情形2 trial 的唯一来源**。
- **metrics + binding 演练 + watermark 源** = `records.jsonl`（逐行 **token-preserving 解析**，复用 `canonical_json.mjs`；禁 `JSON.parse→Number`，与 1b 同理由保 number 保真 + 复算 `canonical_record_hash`）。records 在 1c **不产 trial**（仅统计 + 演练 binding resolver）。
- **增量 watermark**：evaluator 自有去重 = **从 `policy_trials.jsonl` 重建已存 `trial_id` 集合**（单 SSOT，**无独立游标文件** → 与 1b seen_index 同构 → full-re-run 幂等）。`--since` 仅运维便捷过滤，非正确性依赖。
- **空/缺失输入**：records.jsonl / fact_conflicts/ 不存在 → EvalReport 全 0，exit 0（非错误；今态如此）。

### 3) policy_id Binding（A6 = explicit-reference-only，fail-closed）

record / conflict 无 `policy_id`。**仅在存在机器可校验的显式引用时绑定**，否则记 `unbound`（计入 metrics，不产 trial）。两通道：

| 通道 | 规则 | 1c 状态 |
|---|---|---|
| **情形2 trace↔evidence**（trial 生产）| 从 conflict 的 `incoming.json`/`original.json` 取 `trace_id` → 扫 `policies/*/*.yaml` 找 `evidence[].trace_id == trace_id` → 绑该 `policy_id` | **唯一 fire 路径**；legacy + GHL schema 皆带 `evidence[].trace_id` |
| **artifact-deref**（forward-carrying）| `artifact_type=policy_suggestions_json` 的 record → 解引用 `raw_payload_ref`（在 engine_repo 内，**复用 1b `resolveSymlinksAllowingMissing()` dangling-symlink 防御**）→ 取其中 `policy_id` | **1c 实现但 0 fire**（无 policy_suggestions artifact + GHL policy 出现后激活，承接 1d/2a）|

**⚠ Expected bind=0 at 1c runtime（by-design，非 bug）**：(a) records.jsonl/fact_conflicts/ 今为空；(b) 未来 AGE 真跑产生**全新 trace_id**，不匹配现有 policy 的历史 building-run `evidence[].trace_id`；(c) 无 `policy_suggestions_json` artifact。→ 1c live 跑 `bound=0`、`trials_new=0` 是**设计内正确行为**。binding resolver 机器正确、由测试 fixture 验证。

### 4) Trial Verdict Logic（A5 = 情形2 canonical + provenance 叠加；其余零代码引用）

**1c evaluator 模块内出现的 reason code 仅 3 个**：`duplicate_conflict`、`source_dirty`、`manifest_validator_failed`。其余 7 个 negative code（`golden_pack_stale` / `data_safety_unknown` / `regression_failure_severe` / `confidence_below_threshold` / `evidence_origin_insufficient` / `sample_size_insufficient` / `boundary_confidence_value`）+ `acceptable` 在 evaluator 模块 **零代码引用**（不 scaffold、不留占位常量 —— surgical，不臆造 baseline 未定义的判定）。

**唯一 fire 路径 = duplicate_conflict 情形2**：已绑 `policy_id` 的 conflict →
- `system_verdict = NEEDS_HUMAN`（1c 唯一 verdict 值）
- `system_verdict_reason_codes = [duplicate_conflict]` **叠加 provenance 派生 code**（item 6-i）：incoming record provenance `source_dirty==true` → 追加 `source_dirty`；`manifest_validator_status != PASS` → 追加 `manifest_validator_failed`。（minItems 1 恒满足。）

> PASS/FAIL/DOWNGRADED 在 1c **不产生**（无对应 fire 路径）。confidence / regression / golden-pack / sample-size / boundary / data-safety verdict 触发全部 defer Phase 2a。

### 5) Trial Idempotency（A4 = 确定化 uuidv5；append-only）

- `policy_trials.jsonl` **append-only**。
- **trial_id 确定化**：
  ```
  trial_id = uuidv5(NAMESPACE_GHL, canonical_record_hash + "|" + policy_id)
  ```
  - `canonical_record_hash` = 情形2 incoming 冲突 record 的 canonical_record_hash（经 1b invariant：`sha256("sha256:"-stripped canonical(incoming event 20 字段))` == `sha256(sidecar bytes)`；evaluator 复用 `canonical_json.mjs` 算，不自实现）。
  - **无 `verdict_context_tag`**（已砍）：一个 (record, policy) 对恰好一个 trial；verdict 是 (record, policy) 的函数，附加 context 冗余且会在 verdict 逻辑演进时漏去重。
  - `NAMESPACE_GHL` = `uuidv5(URL-namespace 6ba7b811-9dad-11d1-80b4-00c04fd430c8, "https://liye.com/contracts/learning/policy_trial.v1")`；实施时 pin 计算所得字面 UUID 常量 + 测试断言。满足 schema `format:uuid`。
- **去重**：startup 从 `policy_trials.jsonl` 重建 `trial_id` 集合；待写 trial 的 `trial_id` 已存在 → `trials_skipped_idempotent`，不重复 append。→ 同输入复跑 trials 行数不变（replay-stable）。

### 6) Provenance Propagation（A3 = evidence-ledger 旁挂 + reason_codes 双路）

record/conflict 的 provenance 如何进 trial？密封 schema 无字段 → **双路**：

- **(i) 进 verdict**：provenance → `system_verdict_reason_codes`（`source_dirty` / `manifest_validator_failed`，schema 已有这两 code）。
- **(ii) 外挂 evidence-ledger**（定型范式，非过渡）：
  ```
  state/runtime/learning/policy_trials_evidence/<trial_id>.yaml
  ```
  字段:
  ```yaml
  trial_id: "<uuid>"
  policy_id: "<POLICY_ID>"
  canonical_record_hash: "sha256:..."        # 情形2 incoming record
  source_event_identity_key: "sha256:..."
  trace_id: "<trace>"
  bound_via: conflict_trace_evidence          # | artifact_deref
  provenance_dirty: true
  provenance_reasons: [source_dirty, manifest_validator_failed, ...]  # 逐 clause（与 1b 同口径）
  conflict_dir: "state/runtime/learning/fact_conflicts/<source_system>/<event_identity_key>/"
  evaluated_at: "<ISO8601+offset>"
  ```
  policy_trials.jsonl 持 schema-valid trial；ledger 持 back-link + provenance + binding 溯源。trial → 证据可审计、可 replay。**O_EXCL append-once**（镜像 1b sink）。

### 7) Output Schema Mapping（record/conflict → `policy_trial_v1`）

| trial 字段 | 来源 / 派生规则 |
|---|---|
| `trial_id` | item 5 确定化 uuidv5 |
| `policy_id` | item 3 绑定结果 |
| `system_verdict` | item 4 → 1c 恒 `NEEDS_HUMAN`（情形2）|
| `system_verdict_reason_codes` | `[duplicate_conflict]` + provenance 叠加（minItems 1 满足）|
| `evidence_origin` | **派生**：默认 `production_observed`（情形2 = 真实 imported facts）；incoming record `artifact_type==regression_replay_result` → `golden_regression`；测试 fixture 经 seam → `synthetic`。（`historical_replay` 留 2a；映射表见 §9-F4，可在 PR review 调整）|
| `evaluated_at` | evaluator 写入时刻 ISO8601 + tz offset |
| `operator_feedback` | **不**由 evaluator 写（异步外部追加；1c 仅留 `$ref` schema 兼容）|
| `schema_version` | 常量 `"1.0.0"` |

写出前 **validate trial vs `policy_trial_v1.schema.yaml`**（ajv Draft-07，`{strict:false, allErrors:true, validateFormats:false}`，与 1b 同口径）；不符 → fail-closed（exit 2，不写半成品）。

### 8) Trigger Model / Dry-Run-First

- **dry-run-first**（镜像 1a/1b）：dry_run 完整 绑定 + 判定 + 构 trial + validate + would-write，**0 落盘**（不写 trials.jsonl / evidence-ledger；可重复跑结果一致）。`--mode live` 才落盘。
- **manual CLI only；无 launchd / cron / 任何 scheduler**。
- **1d 边界**：heartbeat `evaluator_enabled` / `trial_write_enabled`（7-flag，`heartbeat_state_v2.schema.yaml`）**不在 1c**。1c 的 `--mode dry_run` 默认 == `trial_write_enabled=false` 姿态；真正调度翻转（→`evaluating_metrics_only`→`trialing`）是 1d/2a。
- **不回写 learned_policy 实例**（含 `trial_history` append —— §9-F3：schema 注释称 evaluator append，但 1c dry-run-first 不动 policy 文件，回写 defer 1d/2a）。

### 9) Test Strategy

- **fixture record 来源（混合）**：(a) **1b importer 真生成**高保真 golden（emit_fact LIVE+tmp seam → import_facts dry/live 到 tmp → records.jsonl + fact_conflicts/，构造一个 identity-collision 触发 情形2）；(b) synthetic record/conflict（覆盖 provenance 各 clause、binding 命中/未命中、evidence_origin 各分支、空输入）。
- 覆盖矩阵见 §4。最高优先 = **情形2 端到端**（conflict → trace↔evidence 绑定 → NEEDS_HUMAN trial schema-valid + evidence-ledger back-link + 幂等）。

---

## §2 Cross-Cutting Hard Constraints

| Gate | Phase 1c 应用 |
|---|---|
| **Gate 4** (Layer-2 不直写 Layer-0) | ✅ evaluator 在 liye_os 内，只读 records/conflicts/policies、只写 `liye_os/state/runtime/learning/` |
| **Gate 6** (双 hash 幂等) | ✅ 复用已算 `canonical_record_hash`（经 1b invariant，不重算 record hash）；`trial_id` 确定化 uuidv5 幂等 |
| **Gate 7** (heartbeat 首启 dry_run) | ✅ 1c 不触 heartbeat；evaluator 自身 dry-run-first |
| **Gate 8** (Pilot 1 无 production_write) | ✅ trial = observability data；trial_write 默认 off（dry_run）；不碰 AGE `write_capability_effective` |
| **Pilot 1 invariant** | ✅ AGE `write_capability_effective: none` 全程不变 |

**禁触清单（Phase 1c 实施期间硬边界）**：
- ❌ 修改 AGE 任何文件（`emit_fact.py` / `engine_manifest.yaml` / `schemas/` 全冻结）
- ❌ 修改 loamwise 任何文件
- ❌ 修改 Phase 1a/1b artifacts（`emit_fact.py` / `import_facts.mjs` / `canonical_json.mjs` / vendor schema 全冻结）
- ❌ 修改任何 `_meta/contracts/` schema（含 `policy_trial_v1` —— 若发现不足走上游 doc-fix，1c 不改）
- ❌ 改 `heartbeat_runner.mjs` / `discover_new_runs.mjs` / 写/改 `records.jsonl` / `fact_conflicts/`（1b 产物只读）
- ❌ 回写 `learned_policy` 实例（含 `trial_history`）
- ❌ 生成 candidate / promotion 写（2+）
- ❌ 启动 launchd / cron / 任何 scheduler
- ❌ 在 evaluator 模块引用 7 个 defer reason code / `acceptable`（A5 surgical）
- ❌ 引入 RFC8785/JCS 库 / 自实现 canonicalization（复用 `canonical_json.mjs`）
- ❌ amend / force-push / --no-verify / --admin

---

## §3 Phase 1c 验收标准 (DoD)

| # | Criterion | 验收方式 |
|---|---|---|
| 1 | `src/reasoning/policy_trial_evaluator.mjs` 提交 | `git ls-files src/reasoning/policy_trial_evaluator.mjs` |
| 2 | CLI `--help` 跑通 | `node policy_trial_evaluator.mjs --help` exit 0 |
| 3 | dry-run-first 默认 | 无 `--mode` → mode=dry_run，0 落盘（trials.jsonl / evidence-ledger 无新增）|
| 4 | Unit/integration tests 全通 | 见 §4 |
| 5 | **情形2 端到端** | conflict（绑定 trace↔evidence）→ `NEEDS_HUMAN` trial，schema-valid，写 trials.jsonl + evidence-ledger |
| 6 | trial schema validate | 密封 `policy_trial_v1` 符合（多/缺字段 → fail-closed，不写）|
| 7 | 幂等 | 同输入跑 2 次 → 第二次全 `trials_skipped_idempotent`，trials.jsonl 行数不变 |
| 8 | provenance → reason_code 映射 | `source_dirty` / `manifest_validator_failed` 叠加正确（逐 clause）|
| 9 | evidence-ledger back-link 完整 | 每 trial 有 `<trial_id>.yaml` 含 canonical_record_hash / trace_id / bound_via / provenance |
| 10 | binding fail-closed + 空输入 | 无显式引用 → unbound 不产 trial；空 records/conflicts → exit 0；**expected bind=0** |
| 11 | 1a/1b artifacts + records.jsonl + schemas 0 改动 | `git diff` 空（cross-check）|
| 12 | pre-commit hooks 全 PASS（含 forbidden-name lint）| 无 `--no-verify` 痕迹；无裸 `evaluator`/`trial`/`candidate` 标识符 |
| 13 | liye_os CI green + evaluator tests CI-wired | GitHub PR checks；**A7**：实施期一并接 `.github/workflows/`（扩 `learning-importer-tests.yml` 或 sibling）path-trigger `src/reasoning/policy_trial_evaluator.mjs` + tests（吸取 1b 教训，不留 CI-wiring 二次 PR follow-up）|

---

## §4 Required Test Coverage

| 类别 | 覆盖 |
|---|---|
| 情形2 端到端 | conflict → trace↔evidence 绑定 → `NEEDS_HUMAN` trial（schema-valid）+ evidence-ledger + reason_codes |
| 确定化 trial_id 幂等 | 同 (incoming record, policy) 双跑 → 同 `trial_id` uuidv5；trials.jsonl 行数不变 |
| provenance 叠加 | incoming record `source_dirty`/validator≠PASS → reason_codes 追加正确（逐 clause）|
| binding fail-closed | 无显式引用（trace 不匹配 / 非 policy_suggestions）→ unbound，0 trial |
| artifact-deref（forward）| `policy_suggestions_json` + 合成 GHL policy → 解引用绑定（含 dangling-symlink 防御复用），但确认 1c default 无此输入 → 0 fire |
| evidence_origin 派生 | `production_observed`（默认）/ `golden_regression`（regression_replay_result）/ `synthetic`（test seam）各 1 |
| 密封 schema validate | trial 多字段 / 缺 required → fail-closed（exit 2，不写半成品）|
| token-preserving 读 | record number 保真（不 JSON.parse→Number）；canonical_record_hash 复算 == 1b invariant |
| 空输入 | records.jsonl / fact_conflicts/ 缺失 → EvalReport 全 0，exit 0 |
| dry_run 0 落盘 | dry_run 后 trials.jsonl / evidence-ledger 目录无新增 |
| 模块零引用断言 | grep evaluator 源：7 defer reason code + `acceptable` 字符串 0 出现（A5 守护）|

---

## §5 Resolved Decision Log

| ID | Decision | Rationale |
|---|---|---|
| A1 | **dry-run-first**（镜像 1a/1b），manual CLI，无 scheduler | go-live / trial_write 翻转是 1d/2a 独立变更 |
| A2 | **watermark = 从 `policy_trials.jsonl` 重建 `trial_id` 集合**（无独立游标文件）| 单 SSOT → full-re-run 幂等，与 1b seen_index 同构 |
| A3 | **evidence-ledger 旁挂**（`policy_trials_evidence/<trial_id>.yaml`，含 `bound_via`）+ reason_codes 双路 | 密封 schema 无 back-link 槽；旁挂是本仓库**定型范式**（镜像 conflict_meta/reject_meta），非过渡 |
| A4 | **`trial_id = uuidv5(NAMESPACE_GHL, canonical_record_hash + "\|" + policy_id)`**，无 `verdict_context_tag` | (record,policy) 一对一 trial；确定化 → 幂等 + replay-stable + 满足 `format:uuid` |
| A5 | **verdict scope = 情形2 `NEEDS_HUMAN` + provenance 叠加**；7 defer code + `acceptable` 零代码引用 | B-05 唯一字面规定的端到端 verdict；其余依赖 1c runtime 不具备的 GHL policy/golden_packs → defer 2a；surgical 不臆造 |
| A6 | **binding = explicit-reference-only**（情形2 trace↔evidence fire + artifact-deref forward-carrying，复用 1b dangling-symlink 防御）；**expected bind=0** | fail-closed 不误绑；负学习=检测已知 policy 的 unsafe reuse；1c 无匹配数据 = 设计内 |
| A7 | **evaluator tests 实施期一并 CI-wire** | 吸取 1b CI-wiring 二次 PR（#149）教训，从一开始接 CI，不留 follow-up |
| A8 | **evidence_origin 默认 `production_observed`**（regression_replay→`golden_regression`，test→`synthetic`）| 情形2 = 真实 imported facts；`historical_replay` 留 2a；映射表可 PR review 调整 |

---

## §6 Out-of-Scope（硬边界）

- heartbeat v2 7-flag 接入 / `evaluator_enabled` / `trial_write_enabled` 调度 → Phase 1d
- crystallizer v1 / candidate writing / `learned_policy.trial_history` 回写 → Phase 2b/2c（+ 1d）
- confidence-based verdict（`confidence_below_threshold` / `boundary_confidence_value`）触发 → Phase 2a（依赖 GHL `confidence_basis`，现有 legacy 实例缺）
- regression / golden-pack / sample-size / data-safety verdict 触发 → Phase 2a
- `operator_feedback` 写入 UI / 路径 → 外部异步（1c 仅留 `$ref` 兼容，不写）
- promotion / execute_limited / `negative_evidence_guardrail` 消费 → Phase 4
- PASS/FAIL/DOWNGRADED verdict → 无 1c fire 路径（defer）
- scheduler（launchd/cron）→ 永不在 1c
- 修 `policy_trial_v1` schema 加 `evidence_ref` 字段 → 上游 doc-fix（评估，1c 不改；ledger 已消解，见 §9-F1）

---

## §7 Implementation Plan Skeleton（留给实施指令包 expand）

实施指令包至少覆盖（atomic commits，每个留绿 `node --test`）:
1. branch from liye_os `origin/main`（≥ `af0e0b4`）
2. C1 `policy_trial_evaluator.mjs` 核心（读 records/conflicts/policies · explicit-reference binding（双通道）· 情形2 verdict + provenance 叠加 · 确定化 trial_id · evidence-ledger 旁挂 · trial schema validate · dry-run-first sinks）
3. C2 tests（混合 fixture：1b importer 真生成 golden + synthetic；情形2 端到端 / 幂等 / provenance / binding fail-closed / 空输入 / dry_run 0 落盘 / 模块零引用断言）
4. C3 CI workflow（A7：扩 `learning-importer-tests.yml` paths 或新增 sibling，path-trigger `src/reasoning/policy_trial_evaluator.mjs` + tests + `policy_trial_v1.schema.yaml`；`node --test`）
5. C4 (optional) RUNBOOK §5 "Inspect policy_trials.jsonl & evidence-ledger"
6. CI 全绿 + 自检（`--help` exit 0；dry_run 0 落盘）
7. PR review：本 SPEC blob SHA reference + DoD checklist + Hard NO 自审
8. Merge: squash; 0 force-push; 0 admin（**user 在 GitHub UI 用 liyecom merge**，liye_os branch protection REVIEW_REQUIRED）

**禁触**：AGE / loamwise / 1a-1b artifacts / frozen schema / heartbeat / records.jsonl / scheduler。**forbidden-name**：whitelisted `PolicyTrialEvaluator` / `policy_trial`，禁裸 `evaluator`/`trial`/`candidate`。

---

## §8 SPEC Anchor / Version Control

- Phase 1c 实施指令包必须引用**本 SPEC 的 git blob SHA**（liye_os main 落盘后）；不引用 commit SHA。
- v1.0 → v1.1 任何修订须 user 显式 sign-off + version bump。
- SPEC blob 漂移 → 实施 PR review 必拒。
- 实施 PR description 必须 reference SPEC v1.0 blob SHA + 列举 DoD checkbox + Hard NO 自审。

---

## §9 Findings / Open Items（带入实施 / 上游 doc-fix）

| ID | Finding | Disposition |
|---|---|---|
| **F1** | `policy_trial_v1` 密封、无 record/provenance back-link 槽 | **evidence-ledger 旁挂消解**（§1.6，本仓库定型范式）。可选上游评估 `policy_trial_v1.1` 加 `evidence_ref`（deferred doc-fix；1c 不改 schema，**不**框为过渡）|
| **F2** | 现有 policies 是 legacy-schema，缺 GHL `confidence_basis` → `ghl_confidence_v1` fail_closed | confidence-based verdict **本期不实现**；强化「情形2 canonical / confidence defer 2a」|
| **F3** | `learned_policy_ghl_v1.trial_history` 注释称 "append-only by evaluator"，但 1c dry-run-first 不回写 policy 文件 | 回写 defer 1d/2a（记为边界，§1.8）|
| **F4** | record 无直接 `evidence_origin` 信号，靠 `artifact_type` + provenance 派生 | §1.7 / A8 默认 `production_observed`；映射表可 PR review 调整（非 blocker）|
| **F5** | bind=0 at 1c runtime | **by-design**（§1.3）：空数据 + 新 trace_id 不匹配历史 evidence + 无 policy_suggestions artifact。binding resolver 由 fixture 测试，非运行时数据验证 |
| **N0** | legacy candidate 实例**确带** `evidence[].trace_id`（ground-truth 实读）| binding 读 `evidence[].trace_id`（两 schema 皆有）；bind=0 原因是数据不匹配而非字段缺失（精度更正，不影响 A6 决议）|

无 blocker。实施可在 user 批准 v1.0 PR 后开工（heartbeat 接入 / trial_write 翻转 / confidence verdict 是后续阶段独立变更）。

---

**END OF SPEC v1.0**
