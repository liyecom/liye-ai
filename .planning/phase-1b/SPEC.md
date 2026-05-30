# Phase 1b SPEC v1.0 — liye_os fact importer (`import_facts.mjs`)

**Status**: APPROVED (user review 2026-05-30, v0.1 → v1.0 incorporating Q1–Q4 + adversarial-analysis corrections + ground-truth verification)
**Scope**: liye_os 单边新增 `import_facts.mjs` —— 从 AGE `out/facts/<UTC_DATE>/` pull event sidecar → dual-hash 校验/去重 → 写 canonical `fact_run_outcome_record_v1` 到 `state/memory/facts/fact_run_outcome_records.jsonl` + conflict/reject sinks
**Out of scope**: evaluator / policy_trial (1c) · heartbeat v2 (1d) · candidate/promotion (2+) · AGE 任何改动 · loamwise · scheduler · flip registry `enabled:true` · pin `expected_manifest_hash`
**Drafted**: 2026-05-30
**Anchor for implementation**: 本文件是 Phase 1b 实施指令包的 normative input；实施时 SPEC 锁版本 (file blob SHA)，禁止悄改。

---

## §0 Normative Anchors

| Tier | Source | 锁定内容 |
|---|---|---|
| N-1 | `liye_os/.planning/baseline/GHL-evolution-plan-v4.1.md` §3 (Phase 1b row) | importer deliverable + 前置依赖 (1a + 0d registry) |
| N-1 | 同上 §2 (8 Hard Gates) | Gate 4/5/6/8 + Pilot 1 invariant |
| N-2 | `liye_os/.planning/baseline/GHL-v4.1-errata.md` §4 I-01 | `learning_sources.yaml` 字段 (allowed_branches + expected_manifest_hash) + provenance_dirty 公式 |
| N-2 | 同上 §4 I-02 | canonical record path `state/memory/facts/fact_run_outcome_records.jsonl` |
| N-2 | 同上 §3 B-05 §3.4 | duplicate_conflict 双落点 (情形1 importer 层 conflict-write，无 policy_trial) |
| N-3 | `liye_os/.planning/baseline/GHL-v4.1-errata-v2.md` §4 EV2-I-01 | date-sharded UTC + event sidecar 术语 + 目录名=date partition |
| N-3 | 同上 §5 EV2-I-02 | legacy fact path `fact_run_outcomes.jsonl` 在 Phase 1b freeze (importer abstinence) |
| **CODE-SSOT** | AGE `emit_fact.py` @ main `7b28956` (canonicalization / 8-key identity / content-exclusion / path-defense) | hash 算法**以可执行代码为准**；见 §0.1 |
| 契约 (OUTPUT) | `liye_os/_meta/contracts/learning/fact_run_outcome_record_v1.schema.yaml` (blob, **inline-expanded**, `additionalProperties:false`) | importer 写出的 record schema |
| 契约 (INPUT) | `liye_os/_meta/contracts/learning/fact_run_outcome_event_v1.schema.yaml` | importer 校验的 event schema |
| 现状 | `learning_sources.yaml` (v1) | AGE `enabled:false`, `allowed_branches:[main]`, `expected_manifest_hash:null` |
| 现状 | `validate_manifest_reality.py` (Phase 0c.4, main) | R1–R6 reality checks；**不计算 manifest hash** (见 §9-F4) |

**冲突优先级**：CODE-SSOT > N-3 > N-2 > N-1 > 现状描述。

### §0.1 ⚠ CODE-AUTHORITATIVE 警告 (对抗分析关键发现)

event schema 的散文描述与可执行算法**矛盾**，importer 必须按代码实现：

- event schema 对 `event_identity_key` 的描述是**字符串拼接** `sha256(source_system + source_repo + trace_id + artifact_type + artifact_path + playbook_ref + step_id + source_commit_sha)`（顺序还与代码不同）。**真实算法** = `emit_fact.py::compute_event_identity_key`：对**字母序排列的 LOCKED 8-key dict** 做 `json.dumps(sort_keys=True, separators=(",",":"), ensure_ascii=False)` 再 sha256。
- `event_content_hash` 散文仅说 "canonical payload excluding volatile"，真实算法见 §1.7.B。

**铁律**：importer **按 `emit_fact.py` 实现，禁止照 schema 散文字面实现**（照散文实现 → 每条 record 双 hash 全错、100% reject）。schema 散文 drift 记为 deferred doc-fix（schema 已冻结于 Phase 0b，1b 不改）。

---

## §1 9-Item Contract Surface

### 1) CLI / API Contract

**Module location** (Q1 决议 = 新文件，不改 legacy)：

```
liye_os/.claude/scripts/learning/
├── discover_new_runs.mjs        # legacy v0.1 (data/runs scanner) — 不动
├── heartbeat_runner.mjs         # legacy 消费者 — 不动 (heartbeat 升级是 1d)
└── import_facts.mjs             # Phase 1b 主交付物 (NEW)
```

**为何新文件**：`discover_new_runs.mjs` 是 data/runs 扫描器，唯一消费者是 `heartbeat_runner.mjs`（其依赖 legacy 返回结构）；heartbeat 升级是 Phase 1d。原地重写或同文件 additive 都会把 1d 才该动的 heartbeat 拖入 1b。新文件最 boundary-safe、可逆。本决策**有意偏离 plan §3 字面 "改 discover_new_runs.mjs"**，依据 = 单消费者依赖实证 (见 §9)。

**CLI 形态**:

```
node import_facts.mjs \
    --source amazon-growth-engine     # 可选; 缺省遍历 registry 所有 enabled source
    --since <ISO8601>                 # 可选; 按 UTC date 目录过滤
    --mode {dry_run,live}             # 默认 dry_run (Phase 1b 锁 dry-run-first)
    --records-out <path>              # 默认 state/memory/facts/fact_run_outcome_records.jsonl; 测试可重定向
    [--engine-repo <dir>]             # 可选; AGE repo 根 (validator + realpath 解析); 缺省走 registry repo_local_path
    [--json]                          # 输出 RunReport JSON
```

**Exit code 语义**:

| Code | 名称 | 触发 |
|---|---|---|
| 0 | SUCCESS | 全部 sidecar 处理完，0 reject（NEW/SKIP/CONFLICT 任意组合）|
| 2 | REJECTS_PRESENT | ≥ 1 个 sidecar 落入 `fact_rejects/`（schema/path/integrity/filename fail）|
| 1 | UNEXPECTED | 其他错误 |

> DUPLICATE_CONFLICT **不**提升 exit code（默认非致命，记 RunReport + 写 fact_conflicts/）。

**Node API 形态**:

```js
import { importFacts } from "./import_facts.mjs";
const report = importFacts({
  source: "amazon-growth-engine",
  since: null,
  mode: "dry_run",            // dry_run 为纯函数, 无任何落盘副作用
  recordsOut: "state/memory/facts/fact_run_outcome_records.jsonl",
  engineRepo: null,
});
```

**RunReport** (审计用):

```js
{
  source, mode,
  scanned, new_records, silent_skips, conflicts, rejects,
  per_reject: [{ reason, sidecar_path, sink_path }],   // reason ∈ SCHEMA_INVALID|PATH_UNSAFE|FILENAME_MISMATCH|IDENTITY_MISMATCH|CONTENT_MISMATCH
  per_conflict: [{ event_identity_key, sink_path }],
  provenance_dirty_all: true,                          // Phase 1b 恒 true (见 §1.7.P)
  records_out, window_start, window_end
}
```

### 2) Pull Source — 定位 + Authoritative Input

- **registry-driven**：读 `liye_os/.claude/config/learning_sources.yaml`，per-source 取 `enabled` / `allowed_branches` / `expected_manifest_hash` / `fact_emit_path` / `event_sidecar_path` / `engine_repo`(local path)。
- **AGE 路径定位** (EV2-I-01)：扫 `<engine_repo>/out/facts/<UTC_DATE>/*.json`；目录名即 UTC date partition key（不重新解析 emitted_at 取 date）。
- **event sidecar `<event_identity_key>.json` 为 authoritative input**（EV2-I-01）。同目录 `fact_run_outcome_events.jsonl` 仅作 cross-check：同一 `event_identity_key` 在 sidecar 与 jsonl-line 内容不一致 → 走 reject（不静默偏向任一）。
- **读盘机制 (F3 关键)**：sidecar 是 **compact canonical bytes**（emit_fact 用 `canonical_json_bytes` 写，`--pretty` 仅影响 CLI stdout）。importer **直接对 sidecar 原始字节做 hash 校验**，**禁止 `JSON.parse → Number`**（会把 `1` 与 `1.0` 折叠、>2^53 整数损精）。需结构化时用 token-preserving 解析。

### 3) Field Mapping — `fact_run_outcome_record_v1`

record schema 是 **inline-expanded**（NOT allOf `$ref`；原因见 schema header：draft-07 下 `allOf` + `additionalProperties:false` 会拒绝 importer 4 字段，EV2-I-03 锁 Phase 0b 仅 9 schema → 选展开）。

| 字段组 | 来源 |
|---|---|
| 20 event 字段 (source_*, manifest_hash, emitted_at, trace_id, artifact_*, playbook_ref, step_id, raw_payload_*, redaction_status, event_identity_key, event_content_hash, schema_version) | sidecar **passthrough** (经 §1.4 校验) |
| `ingested_at` | importer 写入时刻 ISO8601 + tz offset |
| `importer_version` | 常量 `"discover_new_runs@2.0.0"` —— ⚠ token 被 frozen 正则 `^discover_new_runs@\d+\.\d+\.\d+$` 锁定；即便文件名是 `import_facts.mjs` 仍须用 `discover_new_runs@` 前缀 (见 §9) |
| `canonical_record_hash` | 见 §1.7.R |
| `provenance` | `{manifest_validator_status, provenance_dirty}` 见 §1.7.P |

写出前 importer **validate record vs `fact_run_outcome_record_v1.schema.yaml`**（Draft7）；不符 → reject (SCHEMA_INVALID at record level)。

### 4) Dual-Hash 决策树 (Hard Gate 6 核心)

每个 sidecar 顺序短路评估：

| # | 检查 | 失败处置 |
|---|---|---|
| S1 | event schema validate (`fact_run_outcome_event_v1`) | `fact_rejects/` (SCHEMA_INVALID) |
| S2 | path 防护：`raw_payload_ref` **+ `artifact_path`** (见 §1.6) | `fact_rejects/` (PATH_UNSAFE) |
| S3 | filename-stem == declared `event_identity_key` | `fact_rejects/` (FILENAME_MISMATCH) |
| S4 | **Gate A**：recompute `event_identity_key` == declared | `fact_rejects/` (IDENTITY_MISMATCH) |
| S5 | **Gate B**：recompute `event_content_hash` == declared | `fact_rejects/` (CONTENT_MISMATCH) |
| S6 | dedup lookup (seen_index) | 见三态 |

**⚠ Gate B preimage 修正 (对抗分析抓到的 critical bug — 不修则 100% 假阳性)**：
importer recompute `event_content_hash` 的 preimage = event **去掉 `{emitted_at, raw_payload_summary.metric_formatting_hint, event_content_hash}`、保留 `event_identity_key`**。
原因：`emit_fact._build_event` 先赋 `event_identity_key` 再算 `event_content_hash`，算时 dict 已含 identity 但**尚未含 content_hash**。importer 读到的 sidecar **已含两个 hash**，故必须比 emit 端额外多 pop 一个 `event_content_hash`（emit 端的 exclusion tuple 没有它，因为 emit 时它根本不在 dict 上）。

**S6 三态** (seen_index = 启动时单次扫 `records.jsonl` 构建的 in-memory Map `event_identity_key → event_content_hash`；**无持久索引文件**，`records.jsonl` 为唯一 SSOT → verdict 是 `(records.jsonl, sidecar set)` 的纯函数 → full-re-run 幂等)：

| identity | content_hash | 动作 |
|---|---|---|
| 不存在 | — | **NEW**：算 provenance + canonical_record_hash → build record → record-schema validate → dry_run: would-write / live: append `records.jsonl` + 更新 seen_index |
| 存在 | 相同 | **SILENT SKIP**（已导入；log `[import_facts] skip identity=<key>`）|
| 存在 | 不同 | **DUPLICATE_CONFLICT**：写 `fact_conflicts/<source_system>/<event_identity_key>/{original.json,incoming.json,conflict_meta.yaml}`；**不生成 policy_trial**（情形1 only，per B-05 §3.4；policy_trial 是 1c evaluator 在绑定 policy_id 后才做）；非致命 |

### 5) `import_disabled` / `enabled` 检查
- per-source `enabled:false` → **跳过该 source**（不阻塞其他，soft-fail per D-07）。⚠ AGE 今天 `enabled:false` → 真实运行 0 import（与 dry-run-first 姿态一致）。
- validator FAIL → 该 source 标 `import_disabled`，不阻塞其他 source。

### 6) Path Traversal 防护 (importer 不信任 emitter)
- 对 `raw_payload_ref` **和 `artifact_path`** 都用 **stricter schema 正则** `^(?![~/])(?!.*\.\.)[a-zA-Z0-9_./-]+$`。
  - ⚠ **不要**用 emit_fact 的 `_REPO_RELATIVE_PATH_RE = ^[a-zA-Z0-9_./-]+$`（它更弱：允许前导 `/`、`..` 仅靠字符类不够严）。importer 是信任边界，用 schema 严格正则。
  - ⚠ `artifact_path` 在 event schema **无 `pattern`**（仅 type:string）→ 它是更弱守护字段，importer **必须**补查（它还是 LOCKED 8-key identity 之一）。
- realpath canonicalize + 断言 startswith `engine_repo` realpath + 无 symlink 逃逸：AGE 在场时执行；AGE 不在场 → 退化为 lexical 正则 only + provenance 标 WARN。
- **F2 冒号 (实证消解)**：真实 AGE `run_id` 全无冒号（实测 `20260520T020735Z` / `20260310-094500` / `20260407-aev2-eval`，仅用 `[A-Za-z0-9_-]`），正则原样通过。errata-v2 §4.3 那个含冒号示例 (`2026-05-09T14:30:00Z`) 是**写错的 ISO-extended 示例**（AGE 从不用）。importer 原样执行正则、**不放宽**；任何含冒号路径在 emit 端就被 exit 4 拒（双重 fail-closed）。详见 §9-F2。

### 7) Conflict / Reject Sinks (语义隔离)

| Sink | 用途 | 布局 |
|---|---|---|
| `state/runtime/learning/fact_conflicts/<source_system>/<event_identity_key>/` | **仅** dual-hash divergence（同 identity 不同 content；D-13 + B-05） | `original.json` + `incoming.json` + `conflict_meta.yaml` (detected_at, content_hash_diff_summary) |
| `state/runtime/learning/fact_rejects/<source_system\|unknown>/<sha256-of-raw-sidecar-bytes>/` | **NEW (Q4)**：schema-invalid / path-unsafe / hash-mismatch / filename-mismatch | `sidecar.json` (原始字节) + `reject_meta.yaml` (reason, detected_at, recomputed_vs_declared) |

⚠ schema-invalid event **不可**进 `fact_conflicts/`：(a) 会污染 D-13/B-05 的 conflict 语义；(b) 其 `event_identity_key` / `source_system` 字段不可信（可能缺失/非法），连 conflict path 都构造不出 → 必须用 **raw-bytes 的 sha256** 作 reject 目录名（不依赖任何 declared 字段）。

### 8) Trigger Model / Dry-Run-First
- **dry-run-first**（镜像 Phase 1a）：dry_run 完整 validate + 双 hash recompute + 算 record + would-write，但 **0 落盘**（不写 records / conflicts / rejects；可重复跑结果一致）。
- **manual CLI only**；**无 launchd / cron / 任何 scheduler**（调度是后续阶段）。
- live 准入：dry_run canary 通过 + Phase 1 出口准则起步（≥ 1 source 连续 7 天 `manifest_validator=PASS`，per N-1 §3）。
- **不 flip registry `enabled:true`**（go-live 是独立 user-signed 变更）；**不 pin `expected_manifest_hash`**（治理动作，见 §1.7.P + §9-F4）。

### 9) Test Strategy
见 §4。最高优先 = 跨语言 byte-equality golden test (F3)。

---

### §1.7 Hashing / Canonicalization / Provenance (锁定)

#### 1.7.X 跨语言 canonicalization (F3, Q2)

Node importer 必须 **byte-for-byte 复现** Python `json.dumps(sort_keys=True, separators=(",",":"), ensure_ascii=False).encode("utf-8")`。

**决议 (Q2 + 对抗实证)**：手写递归 canonical serializer（**Option A**），**拒绝 RFC8785/JCS 库**。
- ⚠ AGE `emit_fact.py` docstring 自称 "RFC8785-equivalent" **不准确**：JCS 强制 `\u` 转义大量码点 + ECMAScript 数字规范化；`ensure_ascii=False` 发 raw UTF-8 + Python-repr 浮点。**禁止引入真 RFC8785 库**（字节会不一致）。
- serializer 规则：递归 key 排序；`,`/`:` 无空格；raw UTF-8（**不** `\uXXXX` 转义非 ASCII）；**但强制转义 U+2028 / U+2029 + 控制符**（实证：Python `ensure_ascii=False` 仍转义 U+2028/2029，且引擎版本相关，不可信引擎默认）；Python-repr 浮点格式。
- **实测发散行 (Python vs Node `JSON.stringify`，golden 必覆盖)**：`1.0`→`1` · `1e+16`→`10000000000000000` · `1e-07`→`1e-7` · `-0.0`→`0` · big-int 无损 vs float64 损精 · U+2028 escaped vs raw。

**数值编码 (Q2 决议 = string-encode-all)**：`raw_payload_summary` 进 `event_content_hash`，为消除上述浮点/大整数发散面，**Pilot 1 caller 契约**：`raw_payload_summary` 内所有数值用**字符串编码**（如 `"0.42"`）。分数 ACoS/CVR 仍可作字符串导入。importer 检出非字符串数值 → reject（NUMERIC_NOT_STRING，归入 PATH/SCHEMA 同级的 content-policy reject）。此为 caller convention（AGE 冻结，summary 是 caller-curated），importer 侧强制。

#### 1.7.R `canonical_record_hash` (Q3 决议 = 排除全部 4 importer 字段)

```
canonical_record_hash = "sha256:" + sha256( canonicalize( record 删除 {ingested_at, importer_version, canonical_record_hash, provenance} ) )
```
- canonicalize = §1.7.X 的 locked Python 约定。
- **排除法（删 4 键）非白名单**（自动追踪 20-field schema，匹配 `emit_fact::_content_hash_view` 的 pop 风格；禁止枚举 INCLUDED 列表 —— 易 drift）。
- 哈希体 = 20 个 event 字段（含 `emitted_at`、`event_identity_key`、`event_content_hash`，皆 emit 时冻结于 sidecar → replay-stable）。
- 排除 `provenance` + `importer_version` 理由：二者依赖可变 import 环境（registry state / importer 版本）→ 纳入会破坏 schema 声称的 "stable across replay"。
- ⚠ 注意：哈希体含 `emitted_at`，故 `canonical_record_hash ≠ event_content_hash`（后者排除 `emitted_at`+`metric_formatting_hint`）。二者非冗余。

#### 1.7.P `provenance` 计算

- `manifest_validator_status` = best-effort 跑 `validate_manifest_reality.py --manifest-path <AGE manifest> --engine-repo <AGE> --json`，映射：exit 0 → `PASS` / exit 1 → `FAIL` / exit 2 → `FAIL`；**validator 不可运行 / AGE repo 或 manifest 不可定位 → `WARN`**。
  - ⚠ validator main() 在 `engine_repo` 非目录时 exit 1 → importer **必须 guard 调用**（先判 AGE 在场），不可无条件 invoke。
  - ⚠ **不要**因 `expected_manifest_hash=null` 就置 WARN —— 两维正交（hash 比对是独立的 provenance_dirty clause）。
- `provenance_dirty` = **字面 OR 4 clause**，逐 clause 记 reason（写入 reject/record meta 便于审计）：
  1. `source_dirty == true`
  2. `manifest_validator_status != PASS`
  3. `source_branch ∉ registry.allowed_branches`（今 `[main]`）
  4. `manifest_hash != registry.expected_manifest_hash.value`
- **今天的必然态**：`expected_manifest_hash = null`，sidecar `manifest_hash` 是真 sha256 字符串 → clause 4 `"sha256:..." != null` = **true** → **所有 1b record `provenance_dirty=true`**（叠加 dry-run-first）。故 `provenance_dirty=false` / validator-PASS-clean 路径 **1b 不被覆盖**，其 fixture **推迟到 go-live**（pin + enable）变更。
- ⚠ **registry 注释勘误 (F4)**：`learning_sources.yaml` 注释称 "validate_manifest_reality.py must set hash" 是**错的** —— 该 validator 只做 R1–R6，**不算/不写 hash**。真正 `manifest_hash` 源 = emit 端 raw-bytes sha256（`emit_fact` `read_manifest_state`）；importer 做比对；pin 是**手工 registry 编辑**（reset_policy: ADR-required）。已知 pin 候选值 = `sha256:b25557edf6abd1df1fcef60c2869e0c90b7d81708bd3dcac827add650c688b2d`（AGE main `d5a2142` 的 engine_manifest.yaml raw-bytes sha256，**pin 时须重算确认**）。

---

## §2 Cross-Cutting Hard Constraints

| Gate | Phase 1b 应用 |
|---|---|
| **Gate 4** (Layer-2 不直写 Layer-0) | ✅ importer = liye_os **主动 pull**，仅写 `liye_os/state/`；不被 AGE push |
| **Gate 5** (source 须过 manifest reality validator) | ✅ importer best-effort 跑 `validate_manifest_reality.py` → provenance |
| **Gate 6** (双 hash 幂等) | ✅ recompute identity + content + 比对 declared + dedup + conflict-route（本 SPEC 核心）|
| **Gate 8** (Pilot 1 无 production_write) | ✅ 写 record = observability data；非 production_write；不碰 AGE `write_capability_effective` |
| **Pilot 1 invariant** | ✅ AGE manifest 全程只读 (validator 输入)，effective 保持 `none` |

**禁触清单 (Phase 1b 实施期间硬边界)**：
- ❌ 修改 AGE 任何文件（`emit_fact.py` / `engine_manifest.yaml` / `schemas/` 全冻结）
- ❌ 修改 loamwise 任何文件
- ❌ 修改 / 复用 / 写入 v0.1 legacy `state/memory/facts/fact_run_outcomes.jsonl`（importer abstinence；bit-for-bit 不动）
- ❌ 改 `discover_new_runs.mjs` / `heartbeat_runner.mjs`（legacy + 1d 边界）
- ❌ 改任何 frozen schema（含修 §0.1 散文 drift / §9 errata 示例 —— 那是上游 doc-fix）
- ❌ 生成 policy_trial / 建 evaluator（1c）
- ❌ heartbeat 升级 / 改 heartbeat `FACTS_FILE` 指针（1d）
- ❌ candidate / promotion 写（2+）
- ❌ 启动 launchd / cron / 任何 scheduler
- ❌ flip registry `enabled:true`（go-live 独立变更）
- ❌ pin `expected_manifest_hash`（治理动作）
- ❌ amend / force-push / --no-verify / --admin

---

## §3 Phase 1b 验收标准 (DoD)

| # | Criterion | 验收方式 |
|---|---|---|
| 1 | `import_facts.mjs` 提交 | `git ls-files .claude/scripts/learning/import_facts.mjs` |
| 2 | CLI `--help` 跑通 | `node import_facts.mjs --help` exit 0 |
| 3 | dry_run-first 默认 | 无 `--mode` → mode=dry_run，0 落盘 |
| 4 | Unit/integration tests 全通 | 见 §4 |
| 5 | **跨语言 byte-equality golden PASS** | Node recompute == Python emit_fact 的 identity/content hash（fixture by emit_fact dry-run）|
| 6 | dual-hash 三态 + 5 类 reject 全覆盖 | 测试断言每路 side effect |
| 7 | dedup 幂等 | 同 sidecar set 跑 2 次 → 第二次全 silent skip，records.jsonl 行数不变 |
| 8 | legacy `fact_run_outcomes.jsonl` 0 改动 | mtime/sha256 前后一致 |
| 9 | `discover_new_runs.mjs` / `heartbeat_runner.mjs` 0 改动 | `git diff` 空 |
| 10 | AGE / loamwise 0 commits in Phase 1b window | cross-repo `git log` |
| 11 | provenance_dirty 4-clause 正确 | 测试覆盖 source_dirty / non-main branch / null-hash / validator≠PASS |
| 12 | pre-commit hooks 全 PASS (含 forbidden-name lint) | 无 `--no-verify` 痕迹 |
| 13 | liye_os CI green on importer PR | GitHub PR checks（如 baseline 红则按 Phase 1a 同口径豁免 + 文档化）|

---

## §4 Required Test Coverage

| 类别 | 覆盖 |
|---|---|
| 跨语言 hash byte-equality | golden fixture：full valid event（40-hex commit / tz-aware emitted_at / 合规 path）+ Python emit_fact 算出的 identity/content hash → Node 复现一致；覆盖 §1.7.X 全部发散行 + 含 string-encoded 数值的 summary |
| Gate B preimage 回归 | 含 populated `raw_payload_summary` 的 sidecar，断言 importer recompute（多 pop `event_content_hash`）== declared |
| 决策树三态 | NEW write / silent skip / DUPLICATE_CONFLICT 各 1 + side-effect 断言 |
| 5 类 reject | SCHEMA_INVALID / PATH_UNSAFE（含 `artifact_path` 无 pattern 的冒号注入）/ FILENAME_MISMATCH / IDENTITY_MISMATCH / CONTENT_MISMATCH → 各落 `fact_rejects/` + reason 正确 |
| conflict 语义隔离 | DUPLICATE_CONFLICT 落 `fact_conflicts/`、schema-invalid 落 `fact_rejects/`，二者不混；无 policy_trial 生成 |
| sidecar vs jsonl cross-check | 同 identity 内容不一致 → reject |
| dedup 幂等 | 双跑行数不变（seen_index 从 records.jsonl 重建）|
| canonical_record_hash | 排除 4 importer 字段；同 event 跨 importer 版本/环境 → 同 hash（replay-stable）|
| provenance_dirty | 4 clause 各触发 1 例；今态恒 dirty |
| numeric-not-string | summary 含原生 number → reject |
| import_disabled | enabled:false source 跳过、不阻塞其他 |
| dry_run 0 落盘 | dry_run 后 records/conflicts/rejects 目录无新增 |
| validator guard | AGE repo 缺失 → manifest_validator_status=WARN，不 crash |

---

## §5 Resolved Decision Log

| ID | Decision | Rationale |
|---|---|---|
| Q1 | **新文件 `import_facts.mjs`**（不改 legacy / heartbeat） | legacy 单消费者=heartbeat（1d 边界）；新文件最 boundary-safe 可逆；有意偏离 plan §3 字面 |
| Q2 | **`raw_payload_summary` 数值一律 string 编码** + 手写 canonical serializer（拒 RFC8785 库） | 消除 Node↔Python 浮点/大整数发散面；JCS 与 Python json.dumps 不字节一致 |
| Q3 | **`canonical_record_hash` 排除全部 4 importer 字段** | 最大 replay 稳定性；provenance/importer_version 依赖可变环境 |
| Q4 | **新 `fact_rejects/` sink**（与 fact_conflicts 隔离） | schema-invalid event 字段不可信、不能进 conflict；raw-bytes sha256 作目录名 |
| A1 | **CODE-AUTHORITATIVE**：按 emit_fact.py 实现，schema 散文非规范 | schema 散文把 identity 写成字符串拼接，与代码矛盾 |
| A2 | **Gate B preimage 多 pop `event_content_hash`** | emit 算 content 时 dict 无 content_hash；importer 读到的已含 → 不多 pop 则 100% 假阳性 |
| A3 | **dry-run-first + 无 scheduler + 不 flip enabled + 不 pin hash** | 镜像 Phase 1a；go-live/pin 是独立治理变更 |
| A4 | **provenance_dirty 字面 4-clause；validator-status 与 hash 维度正交** | WARN 仅给 validator 不可运行；null-hash 经 clause 4 必然 dirty |
| A5 | **sidecar authoritative；禁 JSON.parse→Number** | sidecar 是 compact canonical bytes；parse 会损 number 保真 |

---

## §6 Out-of-Scope (硬边界)

- evaluator / policy_trial 生成 → Phase 1c
- heartbeat v2 升级 / 改 heartbeat `FACTS_FILE` 指针 / freeze 操作 legacy 文件 → Phase 1d（1b 仅 importer abstinence）
- candidate writing / promotion → Phase 2+
- loamwise 任何代码 → Phase 1b 不碰
- AGE 任何改动（emit_fact / manifest / schema / errata 示例修正）→ 上游独立
- flip registry `enabled:true` → 独立 user-signed go-live
- pin `expected_manifest_hash` → 治理动作 (ADR-required reset)
- `provenance_dirty=false` clean 路径 fixture → go-live 阶段（1b 恒 dirty）
- scheduler (launchd/cron) → 永不在 1b
- 修 schema 散文 drift / errata-v2 §4.3 冒号示例 / registry 注释勘误 → 上游 doc-fix (见 §9)

---

## §7 Implementation Plan Skeleton (留给实施指令包 expand)

实施指令包至少覆盖（atomic commits）：
1. branch from liye_os `origin/main` (≥ `03c1faa`)
2. C1 `import_facts.mjs` 核心（registry 读 / scan / 决策树 / 双 hash recompute / canonical serializer / provenance / sinks）
3. C2 canonical serializer + hash util（独立模块，便于跨语言 golden 测）
4. C3 tests：跨语言 golden（emit_fact dry-run 生成 fixture，用 `--manifest-path` / `source_provenance` test seam 越过 placeholder/closed manifest）+ 决策树 + reject + dedup + provenance
5. C4 (optional) RUNBOOK §5 补 importer 命令（"Inspect fact_conflicts/ & fact_rejects/"）
6. CI 全绿 + 自检 (`node import_facts.mjs --help` exit 0；dry_run 0 落盘)
7. PR review：SPEC blob SHA reference + DoD checklist
8. Merge: squash; 0 force-push; 0 admin（**user 在 GitHub UI 用 liyecom merge**，liye_os branch protection REVIEW_REQUIRED）

**禁触**：AGE / loamwise / frozen schema / legacy mjs / heartbeat / scheduler。

---

## §8 SPEC Anchor / Version Control

- Phase 1b 实施指令包必须引用**本 SPEC 的 git blob SHA**（liye_os main 落盘后）；不引用 commit SHA。
- v1.0 → v1.1 任何修订须 user 显式 sign-off + version bump。
- SPEC blob 漂移 → 实施 PR review 必拒。
- 实施 PR description 必须 reference SPEC v1.0 blob SHA + 列举 DoD checkbox。

---

## §9 Findings / Open Items (带入实施 / 上游 doc-fix)

| ID | Finding | Disposition |
|---|---|---|
| **F2** | errata-v2 §4.3 的 `raw_payload_ref` 示例含冒号 (`2026-05-09T14:30:00Z`)，但 schema 正则 + emit_fact 均禁冒号；**实测真实 AGE run_id 全无冒号** | **非 1b blocker**。importer 原样执行正则。建议上游 errata-v3 把示例改成真实 colon-free 格式（doc-only，可选）|
| **F1 (schema 散文 drift)** | event schema 把 `event_identity_key` 描述为字符串拼接，与代码（sorted 8-key dict json.dumps）矛盾 | §0.1 锁 CODE-AUTHORITATIVE。上游 deferred doc-fix（schema 冻结，1b 不改）|
| **F4 (registry 注释勘误)** | `learning_sources.yaml` 注释称 validator 设 manifest hash；实际 validator 只做 R1–R6 不算 hash | importer 自己比对（hash 源=emit 端 raw-bytes sha256）。建议上游修注释（非 1b 代码范围）|
| **F5 (record schema volatile section 空)** | record schema 未枚举 canonical_record_hash 的 volatile 排除集 | 由本 SPEC §1.7.R 定义（排除 4 importer 字段）|
| **N0 (ground-truth 确认)** | event schema `source_branch` 在 required 且 properties 仅一次（对抗 agent 曾误报重复/缺失，已用实读否决）| 无需动作 |

无 blocker。实施可在 user 批准 v1.0 PR 后开工（live emission / enable / pin 是后续独立 go-live 变更）。

---

**END OF SPEC v1.0**
