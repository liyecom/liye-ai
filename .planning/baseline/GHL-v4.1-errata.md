# GHL v4.1 Errata — Ground-truth Audit Corrections

**Status**: REQUIRED BEFORE ADR ACCEPT
**Base**: `liye_os/.planning/baseline/GHL-evolution-plan-v4.1.md`
**Source**: Codex 第 5 轮 ground-truth audit + 最强大脑裁决（2026-05-10）
**Decision**: baseline 正文不回改，errata 作为修订叠加层进入 ADR

---

## 0. Status

- v4.1 baseline 正文 **冻结**（663 lines @ 2026-05-09，untracked 本地候选）
- v4.1 errata 状态：**草稿**（冷却期内允许的 planning 产出，**不**触发 runtime/code/AGE/loamwise 改动）
- ADR 状态：**未启动**（errata 验收后才进入 ADR drafting）
- Cooling end target: 2026-05-11/12

## 1. Scope and Discipline

**This errata is a read-only overlay over the v4.1 baseline.**

允许：
- 在本文件内沉淀修订决策、final schema deltas、final runtime path deltas
- 引用 v4.1.md 的具体行号 / 节号
- 增加新决策（D-14）

禁止：
- 回改 `GHL-evolution-plan-v4.1.md` 正文
- 启动 ADR 正文（`_meta/adr/ADR-Governed-Heuristic-Learning.md`）
- 修改 `engine_manifest.yaml`（AGE / liye_os 任一侧）
- 修改 `discover_new_runs.mjs` / `heartbeat_runner.mjs` / `learned_policy*.schema.yaml`
- 新建 `emit_fact.py`
- 触碰 loamwise baseline-protected paths：`audit/`, `govern/`, `construct/candidates/`
- 新增 trust system / lifecycle FSM / candidate type
- 让 Layer-2 直接写 Layer-0

## 2. Decision Summary

| ID | 类型 | 决议 |
|---|---|---|
| B-01 | Schema bug | required 数组改纯字符串列表，子结构 required 移到 properties.<field>.required |
| B-02 | Schema migration | Phase 0c 增加 `engine_manifest.schema.v2.yaml`，validate-contracts 双 schema 兼容期 ≥ 30 天 |
| B-03 | Lint design | word-boundary regex + diff-only first + self-test fixture (must_pass / must_fail)，CI 必跑 |
| B-04 | Schema split | 新建 `governance_event_v1.schema.yaml` 与 fact_event 平级；双流入账 |
| B-05 | Schema split | 新建 `policy_trial_v1.schema.yaml`，system_verdict_reason_codes 与 operator_feedback.reason_codes 解耦 |
| I-01 | Registry fields | `learning_sources.yaml` 补 `allowed_branches` + `expected_manifest_hash` |
| I-02 | Path lock | canonical record path 固定为 `state/memory/facts/fact_run_outcome_records.jsonl` |
| I-03 | New decision | **D-14 选 A**：AGE explicit `emit_fact.py`；拒绝 importer source adapter |
| I-04 | Counting | phase enum 数量从 8 修正为 9；不再硬数"工件数" |

## 3. Blocking Findings

### B-01 — fact_run_outcome_record_v1 required 数组写法非法

**问题** (v4.1.md:275 附近):

```yaml
# 非法（违反 JSON Schema spec）
required:
  - ingested_at
  - importer_version
  - canonical_record_hash
  - provenance:
      - manifest_validator_status
      - provenance_dirty
```

JSON Schema 标准 `required` 必须是 `string[]`，不能嵌套对象。子结构的 required 必须放在对应 `properties.<field>.required`。

**Errata 修订**：

```yaml
$schema: http://json-schema.org/draft-07/schema#
$id: liye_os/_meta/contracts/learning/fact_run_outcome_record_v1
allOf:
  - $ref: fact_run_outcome_event_v1.schema.yaml#
  - type: object
    required:
      - ingested_at
      - importer_version
      - canonical_record_hash
      - provenance
    properties:
      ingested_at: { type: string, format: date-time }
      importer_version: { type: string, pattern: "^discover_new_runs@\\d+\\.\\d+\\.\\d+$" }
      canonical_record_hash: { type: string, pattern: "^sha256:" }
      provenance:
        type: object
        required:
          - manifest_validator_status
          - provenance_dirty
        properties:
          manifest_validator_status: { enum: [PASS, WARN, FAIL] }
          provenance_dirty:
            type: boolean
            description: |
              MUST equal:
                source_dirty == true
                OR manifest_validator_status != PASS
                OR source_branch not in source_registry.allowed_branches
                OR manifest_hash != source_registry.expected_manifest_hash.value
```

**约束**：
- root `required` 仅列字符串
- 子对象 required 在 `properties.<field>.required` 下
- B-01 是 Phase 0b schema validator 的 blocker；不修复则 schema 加载即失败

### B-02 — AGE manifest schema migration 必须并入 Phase 0c

**问题**：v4.1 计划把 AGE manifest 拆为 `write_capability_declared / effective / capabilities[] / runtime_gates`，但 `liye_os/_meta/contracts/engine/engine_manifest.schema.yaml:14` 仍 require 旧字段 `write_capability`。AGE manifest 一改即被现有 schema 拒绝。

**Errata 修订** — Phase 0c deliverables 必须按以下顺序：

1. **新增** `liye_os/_meta/contracts/engine/engine_manifest.schema.v2.yaml`
2. **扩展** `validate-contracts.mjs` 支持双 schema（按 manifest 自身 `schema_version` 字段路由）
3. **迁移** AGE `engine_manifest.yaml` 到 v2.0
4. **新建** `validate_manifest_reality.py`（Phase 0c 末步骤，依赖 v2 schema 已就位）

**Schema 版本迁移策略**：

```yaml
# engine_manifest.schema.v1.x (legacy, 兼容期保留)
required:
  - write_capability        # 现状
new_fields_optional:
  - write_capability_declared
  - write_capability_effective
  - capabilities
  - runtime_gates

# engine_manifest.schema.v2.0 (新版)
required:
  - schema_version          # 必须 = "2.0"
  - write_capability_declared
  - write_capability_effective
  - capabilities
  - runtime_gates
deprecated_but_accepted:
  - write_capability        # 弃用但仍接受 30 天
removed_in: schema.v2.1     # Phase 4 后

# engine_manifest.schema.v2.1 (Phase 4 后)
removed:
  - write_capability        # 完全移除
```

**validate-contracts.mjs 路由逻辑**：

```
读 manifest:
  if manifest.schema_version is missing or "1.x":
    use schema.v1.x
  elif manifest.schema_version == "2.0":
    use schema.v2.0
  elif manifest.schema_version == "2.1":
    use schema.v2.1
  else:
    fail-closed
```

**约束**：
- 必须先升级 schema，再迁移 AGE manifest
- 不允许直接删除 v1.x 的 `write_capability` 字段
- 兼容期 ≥ 30 天

### B-03 — Forbidden-name lint 必须 word-boundary + self-test

**问题**：lint 若用 `grep -F` 子串匹配，会误伤 `policy_trial_evaluator.mjs` / `candidate_write_enabled` / `PolicyTrialEvaluator` 等合法复合名。即便 v4.1.md:122 已写 word-boundary，实现层若弱化即破功。

**Errata 修订** — Phase 0f lint 设计必须满足：

1. **diff-only first**（Phase 0f 阶段）：仅扫 PR diff / pre-commit staged files
2. **word-boundary match only**：禁止 `grep -F` 子串匹配
3. **self-test fixture**：CI 必跑 self-test，失败即 CI red

**推荐 regex**（POSIX-compatible，避免依赖 PCRE）：

```bash
grep -E '(^|[^A-Za-z0-9_])(trial|candidate|trust_score|trust_matrix|evaluator)([^A-Za-z0-9_]|$)'
```

**Self-test fixture**:

```
liye_os/.claude/scripts/learning/tests/lint_forbidden_names_fixtures/
├── must_pass.txt
└── must_fail.txt
```

**must_pass.txt** 至少包含：
```
policy_trial_evaluator.mjs
candidate_write_enabled
candidate_writing_sandbox
candidate_writing
PolicyTrialEvaluator
policy_trials.jsonl
learned_policy.validation_status=candidate
state/memory/learned/policies/candidate/
state/memory/learned/policies/candidate/BID_RECOMMEND_..._17ED8F.yaml
trial_write_enabled
candidate_write_target_status
```

**must_fail.txt** 至少包含：
```
trial = ...
candidate = ...
evaluator = ...
trust_score = ...
trust_matrix = ...
const trial_id = ...
def evaluator():
class TrustScore:
```

**Lint 脚本结构**：

```bash
# liye_os/.claude/scripts/learning/lint_forbidden_names.sh
set -euo pipefail
REGEX='(^|[^A-Za-z0-9_])(trial|candidate|trust_score|trust_matrix|evaluator)([^A-Za-z0-9_]|$)'

# Self-test 必先跑
bash "$(dirname "$0")/lint_forbidden_names_self_test.sh" || exit 2

# Diff-only 模式
if [[ "${1:-}" == "--staged" ]]; then
  files=$(git diff --cached --name-only --diff-filter=ACM)
else
  files=$(git diff --name-only --diff-filter=ACM HEAD)
fi

# 排除 archive/, quarantine/
echo "$files" | grep -vE '(^|/)archive/|(^|/)quarantine/' \
  | xargs -I{} grep -nE "$REGEX" {} 2>/dev/null \
  && { echo "FORBIDDEN BARE NAMES DETECTED"; exit 1; } || exit 0
```

**Phase 演进**：
- Phase 0f：diff-only
- Phase 2 启动后：扩展到固定 GHL paths 全扫（仍排除 archive/ quarantine/）

### B-04 — loamwise governance event 不塞进 AGE artifact_type

**问题**：`artifact_type` enum 仅 4 个值（verification_json / policy_suggestions_json / step_evaluation_instance / regression_replay_result），全部是 AGE evaluation/inference/replay artifacts。Phase 3 计划让 loamwise SkillReviewQueue PROMOTED 写 fact_run_outcome_events 是语义错误——governance decision ≠ AGE fact outcome。

**Errata 修订** — 新建独立 schema：

`liye_os/_meta/contracts/learning/governance_event_v1.schema.yaml`

```yaml
$schema: http://json-schema.org/draft-07/schema#
$id: liye_os/_meta/contracts/learning/governance_event_v1
type: object
required:
  # identity (5) — 与 fact event 共享
  - source_system
  - source_repo
  - source_commit_sha
  - source_branch
  - source_worktree_id
  # provenance (3) — 与 fact event 共享
  - source_dirty
  - manifest_hash
  - emitted_at
  # governance-specific (3)
  - governance_event_type
  - subject_ref
  - decision_payload_ref
  # hashes (2) — 与 fact event 同公式
  - event_identity_key
  - event_content_hash
  # schema mgmt (1)
  - schema_version
properties:
  governance_event_type:
    enum:
      - skill_review_promoted
      - skill_review_demoted
      - policy_lifecycle_committed
      - trust_matrix_decision
  subject_ref:
    type: string
    description: |
      Subject identity. e.g.:
        SkillReviewQueue:promoted_skill_id=skill_xyz123
        PolicyLifecycle:transaction_id=txn_abc
        TrustMatrix:decision_id=dec_def456
  decision_payload_ref:
    type: string
    pattern: "^[a-zA-Z0-9_./-]+$"
    description: "Repo-relative path to detail JSON. Same path-traversal rules as fact event raw_payload_ref."
  event_identity_key:
    description: |
      sha256(source_system + source_repo + governance_event_type + subject_ref 
             + decision_payload_ref + source_commit_sha)
  event_content_hash:
    description: "sha256(canonical_governance_event_payload_excluding_volatile_fields)"
  schema_version: { const: "1.0.0" }
```

**双流入账**：

| 流 | event schema | 落账本路径 |
|---|---|---|
| 业务事实 | fact_run_outcome_event_v1 | `state/memory/facts/fact_run_outcome_records.jsonl` |
| 治理决策 | governance_event_v1 | `state/memory/governance/governance_event_records.jsonl` |

**原则**：业务事实流 ≠ 治理决策流。importer 双轨道，schema validate 各走各的。

### B-05 — duplicate_conflict 需要明确 schema 落点

**问题**：`duplicate_conflict` 是 system verdict reason，不是 operator feedback reason；v4.1 仍有混淆风险（v4.1.md:577 vs:458）。

**Errata 修订** — 新建独立 schema：

`liye_os/_meta/contracts/learning/policy_trial_v1.schema.yaml`

```yaml
$schema: http://json-schema.org/draft-07/schema#
$id: liye_os/_meta/contracts/learning/policy_trial_v1
type: object
required:
  - trial_id
  - policy_id
  - system_verdict
  - system_verdict_reason_codes
  - evidence_origin
  - evaluated_at
  - schema_version
properties:
  trial_id: { type: string, format: uuid }
  policy_id: { type: string }
  system_verdict:
    enum: [PASS, FAIL, DOWNGRADED, NEEDS_HUMAN]
  system_verdict_reason_codes:
    type: array
    minItems: 1
    items:
      enum:
        - duplicate_conflict
        - golden_pack_stale
        - data_safety_unknown
        - regression_failure_severe
        - confidence_below_threshold
        - evidence_origin_insufficient
        - manifest_validator_failed
        - source_dirty
        - sample_size_insufficient
        - boundary_confidence_value
        - acceptable
  evidence_origin:
    enum: [production_observed, historical_replay, golden_regression, synthetic]
  evaluated_at: { type: string, format: date-time }
  operator_feedback:
    $ref: operator_feedback_v1.schema.yaml#
    description: "Optional. May be added asynchronously after system verdict."
  schema_version: { const: "1.0.0" }
```

**operator_feedback_v1.schema.yaml** 独立文件，reason_codes 保持原 5 项：

```yaml
required: [reviewer_id_hash, verdict, reason_codes, reviewed_at]
properties:
  verdict:
    enum: [AGREE_WITH_SYSTEM, DISAGREE_WITH_SYSTEM, NEEDS_MORE_EVIDENCE]
  reason_codes:
    type: array
    minItems: 1
    items:
      enum:
        - unsafe_reuse
        - weak_evidence
        - business_context_changed
        - regression_failed
        - acceptable
```

**关键区分**：

| 字段 | 主体 | 含义 |
|---|---|---|
| `policy_trial.system_verdict_reason_codes` | 系统 | 系统为什么这么判 |
| `policy_trial.operator_feedback.reason_codes` | 人 | 人为什么同意/反对系统 |

**duplicate_conflict 的双落点规则**：

```
情形 1: importer detects duplicate (event_identity_key 重复 + content_hash 不同)
  └── 写 state/runtime/learning/fact_conflicts/<source_system>/<event_identity_key>/
        ├── original.json
        ├── incoming.json
        └── conflict_meta.yaml
  └── 不生成 policy_trial（因为还没绑到 policy_id）

情形 2: 该 conflict 已绑 policy_id 并进入 evaluator
  └── 在 fact_conflicts/ 写完后
  └── 额外生成 policy_trial_v1:
        system_verdict = NEEDS_HUMAN
        system_verdict_reason_codes = [duplicate_conflict]
  └── 写 state/runtime/learning/policy_trials.jsonl
```

**禁止**：把所有 duplicate conflict 都硬塞进 policy_trials.jsonl（无 policy_id 的 conflict 仅是 importer 层事件，不是 trial）。

## 4. Important Fixes

### I-01 — learning_sources.yaml 补 allowed_branches / expected_manifest_hash

**问题**：v4.1 provenance_dirty 公式引用了这两个字段（v4.1.md:297），但 Source Registry 字段表（v4.1.md:102）未定义。

**Errata 修订** — Phase 0d learning_sources.yaml 字段表补：

```yaml
sources:
  amazon-growth-engine:
    layer: 2
    repo_local_path: "../amazon-growth-engine"
    repo_remote_ref: "git@github.com:loudmirror/amazon-growth-engine.git"
    required_commit_sha: null              # Phase 1 可 null；Phase 2 必填；Phase 4 必 pin
    fact_emission_path: "out/facts/fact_run_outcome_events.jsonl"
    schema: fact_run_outcome_event_v1
    allowed_playbooks: [bid_recommend, anomaly_detect]
    import_mode: pull
    max_imports_per_day: 100
    require_manifest_reality_check: true
    
    allowed_branches:                      # 新增
      - main
      - feat/p3-governed-learning-loop
      - feat/golden-evaluation-system
    
    expected_manifest_hash:                # 新增
      value: "sha256:<TBD-after-AGE-manifest-v2-migration>"
      pinned_at: "2026-05-12"              # 计划 pin 日（冷却结束 + Phase 0c 后）
      reset_policy: "ADR-required"
```

**provenance_dirty 公式**（确认）:

```
provenance_dirty = (
  source_dirty == true
  OR manifest_validator_status != PASS
  OR source_branch NOT IN source_registry.allowed_branches
  OR manifest_hash != source_registry.expected_manifest_hash.value
)
```

`expected_manifest_hash.value` 在 AGE manifest v2 落地后才 pin（Phase 0c 完成后 + Phase 1a 启动前）。

### I-02 — canonical record path 固定

**Errata 决议**：

| 内容 | 路径 |
|---|---|
| Canonical fact records (v4.1 schema) | `state/memory/facts/fact_run_outcome_records.jsonl` |
| Canonical governance records (B-04) | `state/memory/governance/governance_event_records.jsonl` |
| Fact conflicts | `state/runtime/learning/fact_conflicts/<source_system>/<event_identity_key>/` |
| Policy trials | `state/runtime/learning/policy_trials.jsonl` |
| Policy lifecycle events | `state/runtime/learning/policy_lifecycle_events.jsonl` |
| Metrics daily | `state/runtime/learning/metrics_daily.jsonl` |

**禁止复用** `state/memory/learned/runs/fact_run_outcomes.jsonl`（v0.1 schema，混写破坏 dedupe / hash / lineage / replay）。旧路径标记 archive，新数据全部走新路径。

**heartbeat_runner.mjs 路径变更** 是 Phase 1 范围，errata 阶段不动代码；仅记录路径决议。

### I-03 — D-14 决策：AGE explicit fact emission

**Decision D-14** (写入 Decision Log):

```
AGE → liye_os fact flow uses explicit AGE fact emission.

Selected:  A. AGE adds scripts/learning/emit_fact.py
Rejected:  B. liye_os importer source adapter over out/{ASIN}/runs/{timestamp}/

Rationale:
1. AGE 现有产物路径是 out/{ASIN}/runs/{timestamp}/（per write_engine.py:885 / 
   docs/asin-growth-v4.3-artifacts-and-data-dictionary.md:37），不是 out/facts/。
2. liye_os 不应反向工程 AGE 内部目录结构（强耦合，AGE 改产物即破 importer）。
3. AGE source system 应显式 emit 对外 fact contract（Layer-2 → Layer-0 边界）。
4. emit_fact.py 是稳定边界；importer adapter 是反向工程。
5. 未来 chaming / loamwise 接入时同样走 source emits facts pattern。

Time constraint:
Phase 1a (emit_fact.py) starts ONLY after Sprint 9 readout (≥ 2026-05-13Z).
AGE 当前在 Sprint 9 baseline 保护期，改代码必须等 readout 后。
```

**实施约束**：
- emit_fact.py 落在 AGE repo: `amazon-growth-engine/scripts/learning/emit_fact.py`
- 输出路径：`out/facts/<YYYY-MM-DD>/<event_identity_key>.json` + 同目录 append `fact_run_outcome_events.jsonl`
- 仅 emit fact_run_outcome_event_v1 schema 字段
- 不改现有 `out/{ASIN}/runs/{timestamp}/` 路径
- 不复用现有 trace 产物作为 fact source（避免 coupling）

### I-04 — phase enum 计数修正

**Errata 校准**：v4.1.md 文中"扩展 phase 到 8 种 / 8 phase" 表述错误。enum 实际 9 个 phase（v4.1.md:331）：

```
1. paused
2. paused_no_active_source
3. ingesting_only
4. evaluating_metrics_only
5. trialing
6. candidate_writing_sandbox
7. candidate_writing
8. promoting
9. executing_limited
```

**ADR 与未来文档统一表述**：
```
heartbeat current_phase: 9 phases enum
```

**工件计数原则**：
- 不再硬数"X 工件"
- Phase 0: 6 workstreams
- Phase 1: 5 hard-sequence steps
- Phase 2: 3 steps
- Phase 3: post Sprint 9 linkage (1 step)
- Phase 4: data-driven execute_limited gate (11 hard pre-conditions)

## 5. Final Schema Deltas

errata 修订后的最终 schema 文件清单（**Phase 0b 全部新增/扩展**）：

| Schema 文件 | 状态 | 说明 |
|---|---|---|
| `learned_policy_ghl_v1.schema.yaml` | 新建（v4.1 已规划） | learned_policy GHL profile 扩展 |
| `fact_run_outcome_event_v1.schema.yaml` | 新建（v4.1 已规划） | AGE-emitted source event |
| `fact_run_outcome_record_v1.schema.yaml` | 新建（v4.1 规划，**B-01 修正 required**） | liye_os-imported canonical record |
| `governance_event_v1.schema.yaml` | **errata 新增（B-04）** | loamwise governance decisions |
| `policy_trial_v1.schema.yaml` | **errata 新增（B-05）** | system verdict + reason_codes |
| `operator_feedback_v1.schema.yaml` | **errata 拆出独立文件（B-05）** | operator feedback structure |
| `policy_lifecycle_event_v1.schema.yaml` | 新建（v4.1 已规划，D-09） | append-only with transaction_id |
| `confidence_formulas.yaml` | 新建（v4.1 已规划） | 公式定义 + inputs 映射 |
| `engine_manifest.schema.v2.yaml` | **errata 新增（B-02）** | AGE manifest v2 schema |
| `validate-contracts.mjs` 扩展 | v4.1 规划 + **errata 加双 schema 路由（B-02）** | manifest schema 版本路由 |

## 6. Final Runtime Path Deltas

| 路径 | 用途 | 来源 |
|---|---|---|
| `amazon-growth-engine/scripts/learning/emit_fact.py` | AGE fact emission entry | **D-14 (errata I-03)** |
| `amazon-growth-engine/out/facts/<YYYY-MM-DD>/<event_identity_key>.json` | AGE fact JSON | **D-14 (errata I-03)** |
| `amazon-growth-engine/out/facts/fact_run_outcome_events.jsonl` | AGE fact events log | **D-14 (errata I-03)** |
| `liye_os/state/memory/facts/fact_run_outcome_records.jsonl` | Canonical fact records | **errata I-02** |
| `liye_os/state/memory/governance/governance_event_records.jsonl` | Canonical governance records | **errata B-04 + I-02** |
| `liye_os/state/runtime/learning/fact_conflicts/<source_system>/<event_identity_key>/` | Importer duplicate conflicts | **errata B-05 + v4.1** |
| `liye_os/state/runtime/learning/policy_trials.jsonl` | Policy trial outputs | v4.1 |
| `liye_os/state/runtime/learning/policy_lifecycle_events.jsonl` | Policy state transitions | v4.1 D-09 |
| `liye_os/state/runtime/learning/metrics_daily.jsonl` | Daily metrics | v4.1 |
| `liye_os/state/memory/learned/policies/_redirects.yaml` | Quarantine redirects | v4.1 D-08 |
| `liye_os/.claude/config/learning_sources.yaml` | Source registry | v4.1 + **errata I-01** |
| `liye_os/.claude/config/golden_packs.yaml` | Golden pack registry | v4.1 |
| `liye_os/.claude/config/execution_tiers.yaml` | promotion_guardrails block | v4.1 |
| `liye_os/.claude/scripts/learning/lint_forbidden_names.sh` | Forbidden-name lint | v4.1 + **errata B-03** |
| `liye_os/.claude/scripts/learning/tests/lint_forbidden_names_fixtures/` | Lint self-test | **errata B-03** |

**禁止**复用：`liye_os/state/memory/learned/runs/fact_run_outcomes.jsonl`（v0.1 legacy）

## 7. Decision Log Addendum

延续 v4.1.md §8 Decision Log（D-01 ~ D-13）：

| # | 决策点 | 选项 | 决策 | 决策时间 | 决策方 |
|---|---|---|---|---|---|
| **D-14** | AGE → liye_os fact 流形态 | A 显式 emit_fact / B importer adapter | **A 显式 emit_fact**；Phase 1a 锁定 ≥ 2026-05-13Z | 2026-05-10 | Codex audit + user 拍板 |

(D-15 ~ D-1n 留给 ADR 起草期。)

## 8. Required Corrections Before ADR Accept

ADR Accept 前必须验证以下 9 项已在 errata 内确定（不要求实现）：

1. ✅ B-01: fact_run_outcome_record_v1 required 改纯字符串列表
2. ✅ B-02: engine_manifest.schema.v2.yaml + validate-contracts 双 schema 路由 + 兼容期 ≥ 30 天
3. ✅ B-03: lint word-boundary regex + diff-only first + self-test fixture (must_pass / must_fail) + CI 必跑
4. ✅ B-04: governance_event_v1 与 fact_event 平级，双流入账
5. ✅ B-05: policy_trial_v1 + operator_feedback_v1 解耦，duplicate_conflict 双落点
6. ✅ I-01: learning_sources.yaml 补 allowed_branches + expected_manifest_hash
7. ✅ I-02: canonical record path 固定 `state/memory/facts/fact_run_outcome_records.jsonl`
8. ✅ I-03: D-14 选 A，Phase 1a ≥ Sprint 9 readout
9. ✅ I-04: 9 phase enum，不硬数工件

未列入实施清单（ADR 起草后才动）：runtime code / AGE manifest 实际改动 / loamwise protected paths。

## 9. Non-goals Preserved

继承 v4.1.md §10 全部不做清单：

**SYSTEMS-level non-goals**:
- Smart model routing / auto skill repair / Honcho 用户建模
- Vault 基础设施
- 统一 session 底层存储
- Monorepo
- BGHS 平台层

**GHL-specific non-goals**:
- 不引入新 Trust 系统
- 不引入新 Lifecycle FSM
- 不引入新 Candidate 类型
- 不让 Layer-2 直接写 Layer-0
- Pilot 1 期内无 production_write / 无 execute_limited（time-bounded ≥ 90 天）

**Errata 期专属 non-goals**:
- 不改 v4.1.md 正文
- 不写 ADR 正文
- 不改任何 runtime 代码（liye_os / AGE / loamwise）
- 不触碰 loamwise baseline-protected paths

## 10. Next Step

冷却结束（2026-05-11/12）后：

1. **审 errata** — 用户审 + 可选第 6 轮 Codex/ChatGPT ground-truth audit
2. **errata 验收** — 通过后开始 ADR intake pack（`GHL-v4.1-to-ADR-intake.md`，本批次同期产出）
3. **ADR 启动** — `_meta/adr/ADR-Governed-Heuristic-Learning.md` 走 P1 ADR 节奏（写→停→改→GO）
   - ADR consumes: `GHL-evolution-plan-v4.1.md` + `GHL-v4.1-errata.md`
   - ADR §"Required corrections before Accept" 引用本 errata §8
4. **Sprint 9 readout 协调** — earliest 2026-05-13Z；ADR Accept 前不动 AGE / loamwise
5. **Phase 0a 启动** — ADR Accept 后才进入

---

**Authored**: 2026-05-10 (errata 草稿；冷却期内 planning 产出)
**Audit chain**: cc primary drafter → ChatGPT v3-v4-v4.1-v4.1-final → Codex 第 5 轮 ground-truth → cc errata 沉淀
**Next review**: 2026-05-11/12 冷却结束
