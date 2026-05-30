# Phase 1a SPEC v1.0 — AGE `emit_fact.py`

**Status**: APPROVED (user review 2026-05-29, v0.1 → v1.0 incorporating Q1/Q3 revisions + 3 tightenings)
**Scope**: AGE 单边新增 `scripts/learning/emit_fact.py` + pinned schema vendor + isolated dry-run harness
**Out of scope**: any importer / loamwise change / runtime side effect / manifest gate status change / live sidecar write
**Drafted**: 2026-05-29
**Anchor for implementation**: 此文件是 Phase 1a 实施指令包的 normative input；实施时 SPEC 锁版本 (file blob SHA)，禁止悄改。

## §0 Normative Anchors

| Tier | Source | 锁定内容 |
|---|---|---|
| N-1 | `liye_os/.planning/baseline/GHL-evolution-plan-v4.1.md` §3 Phase 1a row | deliverable + 前置依赖 |
| N-1 | `liye_os/.planning/baseline/GHL-evolution-plan-v4.1.md` §7.1 | fact_run_outcome_event_v1 schema 全字段 |
| N-2 | `liye_os/.planning/baseline/GHL-v4.1-errata.md` §I-03 (D-14) | A 显式 emit_fact (拒绝 importer adapter) |
| N-2 | `liye_os/.planning/baseline/GHL-v4.1-errata.md` §6 path table | runtime path lock |
| N-3 | `liye_os/.planning/baseline/GHL-v4.1-errata-v2.md` §4 EV2-I-01 | date-sharded UTC + event sidecar 术语 |
| 现状 | AGE `engine_manifest.yaml` (069a818) | emit_fact_enabled gate `default_state: closed`, `status: placeholder` |
| 现状 | AGE `pyproject.toml` (069a818) | deps: jsonschema ≥4.0, pyyaml ≥6.0, pydantic ≥2.11.10 |

**冲突优先级**：N-3 > N-2 > N-1 > 现状描述。

---

## §1 9-Item Contract Surface

### 1) CLI / API Contract

**Module location** (D-14 normative + AGE flat package layout):

```
amazon-growth-engine/
├── scripts/
│   └── learning/
│       ├── __init__.py             # 新建 (空)
│       └── emit_fact.py            # Phase 1a 主交付物
└── schemas/
    └── learning/
        └── fact_run_outcome_event_v1.schema.yaml   # 新建 (pinned vendor, 见 §1.3.0)
```

**Import path** (AGE pyproject.toml `pythonpath = [".", "src"]` → 仓库根可 import)：

```python
from scripts.learning.emit_fact import emit_fact, EmitMode, BusinessContext, EmitResult
```

**CLI 形态**:

```
python -m scripts.learning.emit_fact \
    --business-context-json <path>         # 必填; JSON file with BusinessContext payload
    --mode {dry_run,live,disabled}         # 默认从 env GHL_EMIT_FACT_MODE 取; 缺省 dry_run
    --output-base out/facts                # 默认 out/facts; 测试可重定向
    --schema-path <path>                   # 可选; 仅 ops/test 用; runtime 默认走 vendor copy
    [--allow-emitted-at-override]          # 显式开关; 若 BusinessContext 含 emitted_at_override 必须配此 flag
    [--pretty]                             # 仅影响 EmitResult JSON 缩进 (canonical hash 不变)
```

**Exit code 语义**:

| Code | 名称 | 触发 |
|---|---|---|
| 0 | SUCCESS | live=已写盘 / dry_run=校验通过 / disabled=no-op |
| 2 | SCHEMA_VALIDATION_FAIL | event payload 不符合 fact_run_outcome_event_v1 |
| 3 | MANIFEST_GATE_CLOSED_LIVE_BLOCKED | mode=live 但 manifest 未 active+open |
| 4 | PATH_TRAVERSAL_REJECT | raw_payload_ref / artifact_path 不合规 |
| 5 | TIMEZONE_OFFSET_MISSING | emitted_at 无 timezone offset |
| 6 | EMITTED_AT_OVERRIDE_NOT_ALLOWED | override 提供但 `--allow-emitted-at-override` 缺失 |
| 1 | UNEXPECTED | 其他错误 |

**Python API 形态**:

```python
result: EmitResult = emit_fact(
    business_context: BusinessContext,
    mode: EmitMode = EmitMode.from_env(),
    output_base: pathlib.Path = pathlib.Path("out/facts"),
    schema_path: Optional[pathlib.Path] = None,  # None → 走 vendor copy
)
```

**EmitResult** (caller / harness 审计用):

```python
@dataclass(frozen=True)
class EmitResult:
    status: Literal["emitted", "dry_run_validated", "disabled_noop",
                    "schema_fail", "gate_blocked", "path_reject",
                    "tz_missing", "override_blocked"]
    event_identity_key: Optional[str]      # 计算成功才有
    event_content_hash: Optional[str]      # 计算成功才有
    sidecar_path: Optional[pathlib.Path]   # would-write 或 actual-written
    events_log_path: Optional[pathlib.Path]
    mode_effective: EmitMode                # 决策表后实际生效的 mode
    emitted_at_utc: Optional[str]
    error_detail: Optional[str]             # 失败时给具体原因
```

---

### 2) Input Payload — Source + Format

**Decision (locked)**: `emit_fact` **不从磁盘扫描**任何 AGE 业务 trace 路径。Caller **显式**构造 `BusinessContext` dataclass 传入。

**Rationale**:
- D-14 拒绝 importer/scanner 反向工程 AGE 产物目录
- emit_fact 是显式契约边界 — caller 知道 raw payload 在哪、是什么类型

```python
@dataclass(frozen=True)
class BusinessContext:
    # business (5)
    trace_id: str
    artifact_type: Literal["verification_json", "policy_suggestions_json",
                           "step_evaluation_instance", "regression_replay_result"]
    artifact_path: str
    playbook_ref: str
    step_id: str
    # payload reference (4)
    raw_payload_ref: str          # AGE repo-relative path to existing artifact
    raw_payload_hash: str         # "sha256:..." pre-computed by caller
    raw_payload_summary: dict     # maxProperties=20, NO PII; caller-curated
    redaction_status: Literal["redacted", "no_sensitive_fields_detected", "unknown"]
    # optional override
    emitted_at_override: Optional[str] = None    # ISO 8601 with timezone offset
```

**emit_fact 自动派生** (caller 不提供):

| 字段 | 派生规则 |
|---|---|
| `source_system` | 常量 `"amazon-growth-engine"` |
| `source_repo` | 常量 `"amazon-growth-engine"` |
| `source_commit_sha` | `git rev-parse HEAD` from emit_fact CWD (40-char lowercase hex 校验) |
| `source_branch` | `git rev-parse --abbrev-ref HEAD` |
| `source_worktree_id` | basename of `git rev-parse --show-toplevel` |
| `source_dirty` | `bool(git status --porcelain stdout)` |
| `manifest_hash` | 见 §1.7.A (raw bytes sha256) |
| `emitted_at` | `business_context.emitted_at_override` (若开 `--allow-emitted-at-override`) 或 `datetime.now(timezone.utc).isoformat()` |
| `schema_version` | 常量 `"1.0.0"` |
| `event_identity_key` / `event_content_hash` | 见 §1.7 |

**强制 fail-closed 检查** (per EV2-I-01 §4.2):

| 检查 | 失败 |
|---|---|
| `emitted_at` 必须含 timezone offset (`Z` 或 `±HH:MM`) | exit 5 |
| `raw_payload_ref` repo-relative + 正则 `^[a-zA-Z0-9_./-]+$` + 无 `..` 段 + 无 `~` + 无前导 `/` | exit 4 |
| `artifact_path` 同上 | exit 4 |
| 解析后绝对路径 startswith `os.path.realpath(repo_root)` | exit 4 |
| 若解析路径含 symlink 指向 repo_root 外 | exit 4 |
| `emitted_at_override` 提供但 `--allow-emitted-at-override` flag 缺失 (或 API 调用 `allow_override=False`) | exit 6 |

---

### 3) Field Mapping — `fact_run_outcome_event_v1` 全 20 字段

| 字段 | 来源 | 派生 |
|---|---|---|
| `source_system` | 派生 | 常量 |
| `source_repo` | 派生 | 常量 |
| `source_commit_sha` | 派生 | git CLI |
| `source_branch` | 派生 | git CLI |
| `source_worktree_id` | 派生 | git CLI + basename |
| `source_dirty` | 派生 | git CLI |
| `manifest_hash` | 派生 | §1.7.A |
| `emitted_at` | caller-or-now | §1.2 |
| `trace_id` | caller | passthrough |
| `artifact_type` | caller | enum 校验 |
| `artifact_path` | caller | path 安全校验 |
| `playbook_ref` | caller | passthrough |
| `step_id` | caller | passthrough |
| `raw_payload_ref` | caller | path 安全校验 |
| `raw_payload_hash` | caller | regex `^sha256:` 校验 |
| `raw_payload_summary` | caller | maxProperties=20 校验, key 数与值类型校验 |
| `redaction_status` | caller | enum 校验 |
| `event_identity_key` | 计算 | §1.7.B |
| `event_content_hash` | 计算 | §1.7.C |
| `schema_version` | 派生 | 常量 `"1.0.0"` |

**Pre-emit schema validation** (per Q1 A')：

- runtime 默认 schema source = AGE 内 vendor copy: `amazon-growth-engine/schemas/learning/fact_run_outcome_event_v1.schema.yaml`
- vendor copy header 写明:
  ```
  # PINNED VENDOR COPY — DO NOT EDIT BY HAND
  # Source: liye_os/_meta/contracts/learning/fact_run_outcome_event_v1.schema.yaml
  # Source commit: <liye_os HEAD sha at vendor time, expected ≥ 437e3e1>
  # Schema $id: liye_os/_meta/contracts/learning/fact_run_outcome_event_v1
  # Vendored: <date> by <phase 1a impl PR ref>
  # Re-vendor protocol: bump SOURCE_COMMIT below + run scripts/learning/tests/test_vendor_schema_freshness.py
  ```
- 测试/ops 可用 env `GHL_FACT_EVENT_SCHEMA_PATH` 或 CLI `--schema-path` override
- runtime path **不依赖** liye_os checkout 存在
- 使用 `jsonschema.Draft7Validator` (AGE 现有 dep)
- 失败 → exit 2 + EmitResult.status="schema_fail"

**Test required**: `test_vendor_schema_freshness.py` — 通过 sha256 比对（或 manifest hash record），守护 vendor copy 与 liye_os 上游 437e3e1 blob 一致；上游变 → test 标 fail; 实施者必须显式 re-vendor + bump source_commit comment + 通过 review.

---

### 4) `emit_fact_enabled` Gate Position

**当前 manifest 状态** (AGE 069a818):

```yaml
runtime_gates:
  - name: emit_fact_enabled
    default_state: closed
    status: placeholder
```

**Phase 1a 期间不修改 manifest**。代码读 manifest 并按下表决策：

| manifest `status` | manifest `default_state` | caller mode 请求 | 实际 mode | EmitResult.status |
|---|---|---|---|---|
| placeholder | closed | * | `disabled` | `disabled_noop` |
| placeholder | open | * | `dry_run` (best-effort safety; gate 尚未 governance-approved 启用) | `dry_run_validated` |
| active | closed | dry_run | dry_run | `dry_run_validated` |
| active | closed | live | (reject) | `gate_blocked` (exit 3) |
| active | open | dry_run | dry_run | `dry_run_validated` |
| active | open | live | live | `emitted` |

**Phase 1a DoD**: manifest 仍 `status: placeholder` + `default_state: closed` → 任何 caller mode 请求都 coerced to `disabled` → no side effect。Phase 1b 才提 PR 改 manifest。

**Gate 读取位置**: emit_fact.py 启动时 (CLI 或 API 入口) 即读 manifest，构造 `effective_mode` 后再走主流程。manifest 文件 missing → exit 1 (unexpected; AGE repo 总应有 manifest)。

---

### 5) Dry-Run / Live 首次策略

**Phase 1a 行为锁定 = dry_run only**:

- 完整执行 schema validation + hash 计算 + 路径解析 + manifest hash 计算
- **不写** sidecar.json (绝对禁止)
- **不 append** events.jsonl (绝对禁止)
- **不创建** `out/facts/` 目录 (绝对禁止 — 即使为空)
- 返回 EmitResult 含 `would-write` 路径与 hash
- 输出 stderr/log 行：`[emit_fact][dry_run] event_identity_key=<key> would_write_sidecar={path} would_append_events_log={path}`

**Q5 决议 A**: 无 staging 目录; EmitResult 已含完整 audit info.

**Live 准入** (Phase 1b 范围, 非本期):
- 必须先有 manifest commit `status: placeholder → active`
- 必须先有 importer (Phase 1b discover_new_runs.mjs 升级) 在 dedupe / DUPLICATE_CONFLICT 测试通过
- 首次 live 必须有 ≥ 3 canary event 在 ops 监控下 emit 验证 sidecar+events 双写一致

**Phase 1a 验收的 emission 目标** (Q3 B):
- AGE 内 isolated dry-run harness/wrapper 跑 ≥ 1 次成功调用
- 0 sidecar 落盘
- harness **不接** AGE business 主流程 (write_engine.py / verification / playbook executor 全不动)

---

### 6) Output Paths (LOCKED, EV2-I-01)

| 内容 | 路径 |
|---|---|
| Sidecar | `<output_base>/<UTC_DATE_FROM_emitted_at>/<event_identity_key_without_sha256_prefix>.json` |
| Events log | `<output_base>/<UTC_DATE_FROM_emitted_at>/fact_run_outcome_events.jsonl` |

`<output_base>` runtime 默认 `out/facts/` (AGE repo-relative)。CLI/API 可重定向 (test/ops)。

**`<UTC_DATE_FROM_emitted_at>` 计算**:
1. parse `emitted_at` ISO 8601 (必须含 offset, 否则 §1.2 exit 5)
2. convert to UTC: `dt.astimezone(timezone.utc)`
3. `dt_utc.date().isoformat()` → `"YYYY-MM-DD"`

例: `"2026-05-30T08:30:00+08:00"` → UTC `2026-05-30T00:30:00Z` → date `"2026-05-30"`
例: `"2026-05-29T23:30:00-07:00"` → UTC `2026-05-30T06:30:00Z` → date `"2026-05-30"`

**`<event_identity_key_without_sha256_prefix>`** = strip `"sha256:"` prefix → 64 hex chars. 文件名仅 64 hex chars 更友好。

**Live 写入语义** (Phase 1a 实现路径函数 + idempotency 写法, 但运行时不触发):

- Directory: `pathlib.Path(...).mkdir(parents=True, exist_ok=True)`
- Sidecar: open with `O_CREAT|O_EXCL`. 若 `FileExistsError` → silent skip + log `[emit_fact][live] sidecar exists for event_identity_key=<key>, skipping`
- Events log: open with `O_APPEND|O_CREAT`. **但若 sidecar 已存在则跳过 events log append** (避免 sidecar dedupe 但 events.jsonl 重复). 顺序 = 先 sidecar O_EXCL, 成功才 append events log.
- Sidecar content = canonical RFC8785 JSON of event payload (sorted keys, no whitespace, UTF-8, no trailing newline)
- Events log line = same canonical JSON + `\n` (one event per line)

**强制 test 覆盖 (per user §3 tightening)**:
- 单元测试必须验证 O_EXCL 重复 skip 行为
- 单元测试必须验证 sidecar 已存在情况下 events log 不被 append
- 测试用 `output_base = tmp_path` (pytest fixture)，运行 emit_fact 两次同 BusinessContext → 第二次返回 silent skip + 文件计数不变

---

### 7) Idempotency / Dedupe Keys

#### 7.A `manifest_hash` canonicalization

**Decision (per user §1 tightening)**: **raw bytes sha256**, 不做 YAML normalize。

```python
manifest_hash = "sha256:" + hashlib.sha256(
    pathlib.Path("engine_manifest.yaml").read_bytes()
).hexdigest()
```

**Rationale**:
- 与 reality validator (`validate_manifest_reality.py` Phase 0c.4) 口径一致
- 避免 YAML loader 重排 key / 格式化 whitespace 导致 hash 漂移
- manifest 是 ASCII YAML，编辑器换行风格变化也会改 hash — **这是 feature 不是 bug**，能精确捕获任何 manifest 变更

#### 7.B `event_identity_key`

**Decision (per Q2 B + user §2 tightening)**: RFC8785 canonical JSON of fixed identity dict。

**LOCKED identity dict key set** (8 keys, 不得增减):

```
{
  "artifact_path": <str>,
  "artifact_type": <str>,
  "playbook_ref": <str>,
  "source_commit_sha": <str>,
  "source_repo": <str>,
  "source_system": <str>,
  "step_id": <str>,
  "trace_id": <str>
}
```

```python
import json
# RFC8785 canonical JSON: sorted keys, no whitespace, UTF-8, integer-no-trailing-zero, etc.
canonical = json.dumps(identity_dict, sort_keys=True, separators=(",", ":"),
                       ensure_ascii=False).encode("utf-8")
event_identity_key = "sha256:" + hashlib.sha256(canonical).hexdigest()
```

**Lock 规则**: 此 key set 一旦 Phase 1a SPEC 锁定，**任何字段增减都是 schema breaking change** → 必须新 ADR + schema_version bump。Phase 1b importer 用相同 key set 必须 byte-for-byte 复现。

> Note: Python stdlib `json.dumps(sort_keys=True, separators=...)` 对 string-only dict 等价于 RFC8785；若未来 identity 含数值/Unicode 边界 case，应升级到第三方 `jcs` 库。Phase 1a 全 string，stdlib 即可。

#### 7.C `event_content_hash`

```python
content_dict = dict(full_event_payload)
content_dict.pop("emitted_at", None)
if "raw_payload_summary" in content_dict and isinstance(content_dict["raw_payload_summary"], dict):
    content_dict["raw_payload_summary"].pop("metric_formatting_hint", None)
canonical = json.dumps(content_dict, sort_keys=True, separators=(",", ":"),
                       ensure_ascii=False).encode("utf-8")
event_content_hash = "sha256:" + hashlib.sha256(canonical).hexdigest()
```

排除字段固定为 `emitted_at` + `raw_payload_summary.metric_formatting_hint` (per §7.1 schema)。**禁止扩展排除集** without ADR.

#### Dedupe 行为 (Phase 1a 范围)

- 同 process 内连续调用同 BusinessContext → emit_fact **不内置 in-memory dedupe** (importer 才去重)
- 但 `live` 模式 sidecar O_EXCL 写入是去重底线 (importer 故障时仍保证 sidecar 唯一)
- `dry_run` 模式可重复 invoke 同 context, EmitResult 每次相同 (purely functional)

---

### 8) Rollback / Disable Path

| Level | 触发 | 操作 | 时间 |
|---|---|---|---|
| L0 紧急 (live 阶段写废数据) | runtime 异常 / 数据污染 | env `GHL_EMIT_FACT_KILLSWITCH=1` 或 caller 改 mode=disabled | < 1 min |
| L1 (live 阶段需短期暂停) | 治理决策暂停 fact emission | manifest commit `status: active → placeholder` | < 10 min (1 PR) |
| L2 (代码层 bug) | bug 发现 | revert emit_fact.py PR + revert harness 接入点 | < 30 min |
| L3 (架构错误) | 设计层错误 | full revert + 删除 `out/facts/` | 需 ADR 决议 |

**Phase 1a 实际 rollback 难度 ≈ 0**: dry_run only + 无 sidecar 落盘 → revert = 清零。

**Killswitch 实现** (emit_fact 启动顺序检查, 任一命中即 `effective_mode=disabled`):

1. env `GHL_EMIT_FACT_KILLSWITCH=1` → hard killswitch
2. manifest `status: placeholder` (Phase 1a 期间始终命中此条)
3. manifest `default_state: closed` + caller request `live` → exit 3 (`gate_blocked`)

---

### 9) loamwise 参与 / AGE 单边

**Decision (per D-14, locked)**: Phase 1a = **AGE 单边**. loamwise **0 commits, 0 改动**.

**Phase 1b 才介入 loamwise** (单独 SPEC):
- `liye_os/.claude/scripts/learning/discover_new_runs.mjs` 升级 (importer)
- pull + dedupe 双 hash 决策树 + canonical_record_hash + path traversal 防护
- duplicate conflict 写 `liye_os/state/runtime/learning/fact_conflicts/`

**Phase 1a 期间 loamwise 应做的**: 无。Phase 1a 完成不应触发 loamwise 任何变更。

---

## §2 Cross-Cutting Hard Constraints

| Gate | Phase 1a 应用 |
|---|---|
| **Gate 4** (Layer-2 不直写 Layer-0) | ✅ emit 写 AGE-local `out/facts/`; 不写 liye_os |
| **Gate 6** (双 hash 幂等) | ✅ identity + content 都实现; sidecar O_EXCL 是底线; importer 双判 留 Phase 1b |
| **Gate 7** (heartbeat 首次 dry_run) | N/A (Phase 1a 不触 heartbeat) |
| **Gate 8** (Pilot 1 无 production_write) | ✅ fact emission = observability data; 非 production_write; manifest `write_capability_effective` 保持全 disabled |
| **Pilot 1 invariant** | ✅ 不动 `write_capability_effective`; gate `status` 保持 `placeholder` |

**禁触清单 (Phase 1a 实施期间硬边界)**:

- ❌ 修改 AGE `engine_manifest.yaml` (任何字段)
- ❌ 修改 liye_os 任何文件 (含 schema source — vendor copy 在 AGE)
- ❌ 修改 loamwise 任何文件
- ❌ 真正写盘到 `out/facts/` (dry_run only; tests 用 `tmp_path`)
- ❌ 接入 AGE business 主流程 (write_engine.py / verification / playbook executor 全不动; 仅 isolated harness)
- ❌ 启动 launchd / cron / 任何自动调度
- ❌ amend / force-push / --no-verify / --admin
- ❌ 复用 `out/{ASIN}/runs/{timestamp}/` 任何路径作为 fact source (D-14 拒绝 coupling)
- ❌ 复用 v0.1 legacy 路径 `state/memory/learned/runs/fact_run_outcomes.jsonl` (errata-v1 I-02 禁止)

---

## §3 Phase 1a 验收标准 (DoD)

| # | Criterion | 验收方式 |
|---|---|---|
| 1 | `amazon-growth-engine/scripts/learning/emit_fact.py` 提交 | `git ls-files scripts/learning/emit_fact.py` |
| 2 | `amazon-growth-engine/schemas/learning/fact_run_outcome_event_v1.schema.yaml` vendored | header 含 source commit sha; `test_vendor_schema_freshness.py` PASS |
| 3 | CLI `--help` 跑通 | `python -m scripts.learning.emit_fact --help` exit 0 |
| 4 | Unit tests 全通 | pytest pass; 覆盖范围见 §4 |
| 5 | isolated dry-run harness 跑通 | `scripts/learning/tests/harness_dry_run.py` 或 pytest case 调 emit_fact() 返回 EmitResult.status="dry_run_validated" |
| 6 | `out/facts/` 在 Phase 1a 完成时 0 存在 | `! test -d out/facts` |
| 7 | engine_manifest.yaml gate `status` 仍 `placeholder` | `grep -A2 emit_fact_enabled engine_manifest.yaml \| grep "status: placeholder"` |
| 8 | engine_manifest.yaml gate `default_state` 仍 `closed` | grep 验证 |
| 9 | engine_manifest.yaml `write_capability_effective` 仍全 disabled | grep 验证 (Pilot 1 invariant) |
| 10 | liye_os / loamwise 0 commits in Phase 1a window | `git log` cross-check |
| 11 | pre-commit hooks 全 PASS | 无 `--no-verify` 痕迹 |
| 12 | AGE CI green on emit_fact PR | GitHub PR check status |

---

## §4 Required Test Coverage

| Test category | 覆盖 |
|---|---|
| Hash determinism | `event_identity_key` against 3 known fixture vectors; `event_content_hash` 同样 |
| Hash exclusion | `event_content_hash` 在 emitted_at 变化时不变 |
| Hash exclusion | `event_content_hash` 在 `raw_payload_summary.metric_formatting_hint` 变化时不变 |
| Identity key set lock | 测试 RFC8785 canonical 输出 byte-for-byte equal to expected 64-hex |
| Schema validation pass | 1 valid fixture → exit 0 |
| Schema validation fail | 3 invalid fixtures (missing required field × 1; wrong enum × 1; raw_payload_hash 格式错 × 1) → exit 2 |
| Path traversal | 4 fail vectors: `..` 段 / `/abs` / `~/home` / symlink 指向 repo 外 → exit 4 |
| Timezone offset missing | `emitted_at="2026-05-29T10:00:00"` (no offset) → exit 5 |
| Manifest gate decision table | 6 行各 1 个 test (placeholder/closed/* + placeholder/open/* + active/closed/dry_run + active/closed/live + active/open/dry_run + active/open/live) |
| O_EXCL duplicate skip | 同 BusinessContext + `output_base=tmp_path` 两次调 live → 第二次 silent skip, 文件计数不变, events.jsonl 行数不变 |
| Vendor schema freshness | sha256 of vendor copy vs recorded source_commit checkpoint match |
| Override gate | `emitted_at_override` 提供但 flag 缺失 → exit 6 |
| Override allowed | flag 显式开 → emitted_at 用 override 值 + warning log 输出 |

---

## §5 Resolved Decision Log (Q1–Q7)

| ID | Decision | Rationale |
|---|---|---|
| Q1 | **A' Vendor pinned schema copy** in AGE `schemas/learning/`; runtime default uses vendor copy; env/CLI override **仅** test/ops 用 | 避免 runtime cross-repo coupling (不依赖 liye_os checkout 存在); 避免 env 配置漂移; vendor copy header + freshness test 守护一致性 |
| Q2 | **B RFC8785 canonical JSON** of identity dict | 业界标准; importer 也用; 减少自创格式风险; LOCKED 8-key set |
| Q3 | **B Isolated dry-run harness** (新建 wrapper, 不接 business main flow) | 满足 DoD "caller integration" 同时不污染 AGE business path; Phase 1b 才接主流程 |
| Q4 | **A Allow `emitted_at_override`** + 强制 `--allow-emitted-at-override` flag + warning log | replay test + ops 调试需要; flag gate 防止误用 |
| Q5 | **A No staging** dir; EmitResult 已含完整 audit info | 简化 rollback; 减少代码路径 |
| Q6 | **B Use AGE existing deps** (jsonschema / pyyaml / pydantic 全已在 pyproject.toml) | 无新依赖 |
| Q7 | **A Land SPEC at `liye_os/.planning/phase-1a/SPEC.md`** | liye_os 是治理 SSOT; Phase 1a 是治理框架的实施 |

---

## §6 Out-of-Scope (硬边界)

- 任何 importer 改动 → Phase 1b
- live emission → Phase 1b (准入条件见 §1.5)
- manifest gate `status: placeholder → active` → Phase 1b
- canonical record write 到 liye_os → Phase 1b
- dedupe / DUPLICATE_CONFLICT 决策树 → Phase 1b
- heartbeat 接入 → Phase 1c-1d
- loamwise 任何代码 → Phase 1b+
- 接入 AGE business 主流程 (write_engine.py 等) → Phase 1b+
- Phase 1a launchd / cron 调度 → 永不在 Phase 1a

---

## §7 Implementation Plan Skeleton (留给实施指令包 expand)

实施指令包 (待 user 二次裁决后产出, ≥ 2026-05-30 if 48h observation 满) 至少覆盖:

1. PR-1 branch from AGE main HEAD (069a818 或更晚 origin/main)
2. PR-1 contents (atomic commits):
   - C1 `scripts/learning/__init__.py` (empty)
   - C2 `schemas/learning/fact_run_outcome_event_v1.schema.yaml` (vendor pinned from liye_os 437e3e1)
   - C3 `scripts/learning/emit_fact.py` (core implementation)
   - C4 `scripts/learning/tests/` (unit tests + freshness test)
   - C5 `scripts/learning/tests/harness_dry_run.py` (isolated harness)
   - C6 (optional) docs / CHANGELOG
3. CI 全绿 + 自检 (`python -m scripts.learning.emit_fact --help` exit 0)
4. PR review: at minimum SPEC blob SHA reference + DoD checklist
5. Merge: squash; 0 force-push; 0 admin override
6. Post-merge: 24h observation, 0 production touch

**禁触**: liye_os, loamwise, AGE manifest, AGE business path.

---

## §8 SPEC Anchor / Version Control

- Phase 1a 实施指令包必须引用 **本 SPEC 的 git blob SHA** (在 liye_os main 落盘后); 不引用 commit SHA (commit 可能改, blob 不可)
- SPEC v1.0 → v1.1 任何修订必须有 user 显式 sign-off + version bump
- SPEC SHA 漂移 → 实施 PR review 必拒
- 实施 PR description 必须 reference SPEC v1.0 blob SHA + 列举 DoD checkbox

---

## §9 Open Items After v1.0 (no blocker)

无 blocker。实施可在 48h observation 满 + user 二次裁决后开工。

---

**END OF SPEC v1.0**
