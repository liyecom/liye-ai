# GHL Evolution Plan v4.1 (final pre-baseline)

> **Status**: baseline candidate, NOT yet ADR-bound. Cooling period 1–2 days before ADR drafting.
> **Supersedes**: `archive/GHL-evolution-plan-v3-superseded.md`
> **Authored**: 2026-05-09
> **Author handoff**: Claude Code (cc) primary drafter; ChatGPT Pro adversarial auditor
> **Doctrine ref**: `_meta/portfolio/SYSTEMS.md` (BGHS), `_meta/contracts/learning/` (existing v0.1 learning pipeline)

---

## 0. 战略主干（1 页讲完 GHL 是什么）

**GHL = Governed Heuristic Learning**

源头：吸收 Jiayi Weng "Learning Beyond Gradients" 提出的 coding-agent-as-learner 范式（trials.jsonl + regression + simplification），但**不**重建新平台。

**核心判断**：liye_os 已经在 `_meta/contracts/learning/` 与 `.claude/scripts/learning/` 部署了 v0.1 学习管线（schema、crystallizer、heartbeat、bundle），长期缺数据输入而休眠。GHL 的工作不是造新房，而是：

1. **复活** 现有 v0.1 管线（heartbeat 重启 + 真实数据接入）
2. **串联** AGE 的 step_evaluation/regression/aggregator 等域级 primitive 进入 fact 食物链
3. **限名** 通过 forbidden-name lint + glossary 防止"trial / candidate / trust_score / trust_matrix / evaluator"裸名跨系统冲突
4. **守门** 通过 execution_tiers + promotion_guardrails + manifest reality validator 控制晋级
5. **Pilot 1 = negative learning only**（系统识别 unsafe reuse 并由 operator 验证），**不**做自动 bid 优化

**3 句话定义成功**：
- 事实账本干净（fact_run_outcome event/record 拆分 + dedupe + provenance）
- 运行开关可读（heartbeat 7 字段 + derived current_phase + invalid fail-closed）
- 晋级规则唯一源（promotion_guardrails 集中在 execution_tiers.yaml）

**4 个不做的事**：
- 不引入新 trust 系统（已有 TrustScoreStore EMA / TrustMatrix quarantined / TrustLevel enum 三套）
- 不引入新 lifecycle FSM（已有 validation_status / SkillLifecycleState / SkillReviewQueue）
- 不让 Layer-2 (AGE) 直接写 Layer-0 (liye_os)，遵守 SYSTEMS.md 依赖方向
- 不把 BGHS 做成新平台层或目录结构

---

## 1. 演进矩阵（v3 → v4.0 → v4.1 → v4.1-final）

| 维度 | v3.0 | v4.0 | v4.1 | v4.1-final |
|---|---|---|---|---|
| 战略命名 | "进化方案" 模糊 | GHL 立名 + Pilot 1 negative | 同 v4.0 | 同 v4.0（封板） |
| Pilot 1 范围 | 自动 bid 优化 | negative learning + time-bounded non-goal | 同 v4.0 | 同 v4.0（封板） |
| schema 拆分 | 单一 fact_run_outcome | 单一 fact_run_outcome | event/record 拆 | event/record 拆（封板） |
| idempotency | sha256(混合字段) bug | 公式仍有 bug | 拆 3 hash 分布在 event/record | event 端 identity+content / record 端 canonical（封板） |
| heartbeat 字段 | mode 二元 | mode 二元 | 5 字段 + derived phase | **7 字段**（加 evaluator_enabled + trial_write_enabled）+ runtime-owned 标记 |
| current_phase 状态 | 不存在 | 不存在 | 5 phase | 8 phase（含 evaluating_metrics_only / paused_no_active_source / candidate_writing_sandbox / candidate_writing） |
| operator 指标 | 不区分 | approval_rate ≥ 0.7 | approval_rate ≥ 0.7 + false_negative=0 | **agreement_rate ≥ 0.7 + false_negative=0**（verdict enum AGREE/DISAGREE/NEEDS_MORE） |
| confidence 公式 | 在 schema 写 | 引用 success_signals 路径错 | 引用 success_signals 路径错 | 引用 confidence_basis 路径（不动 legacy schema） |
| promotion guardrail | 字段塞 schema | 字段塞 schema | 移到 execution_tiers.yaml require_includes 歧义 | execution_tiers.yaml allowed/required/negative 三块（封板） |
| negative evidence | NEEDS_HUMAN 全算 | NEEDS_HUMAN 全算 | NEEDS_HUMAN 全算 | NEEDS_HUMAN 限 reason_code 才算 |
| lifecycle ledger | 无 | 无 | jsonl + status 字段（违反 append-only） | **真 append-only**（transaction_id + TXN_STARTED/COMMITTED/ABORTED） |
| raw_payload | 无规则 | required 在 schema | ref+hash+summary+redaction | + path traversal 防护 + redaction=unknown 阻 candidate |
| duplicate conflict | 无规则 | 无规则 | 写 quarantine（混 policy） | 独立目录 fact_conflicts/ |
| Phase 顺序 | 无 | heartbeat 在 evaluator 前（错） | evaluator/writer 先于 heartbeat dry_run | 同 v4.1（封板） |
| forbidden-name lint | 无 | 无 | 全仓扫 | diff-only first，Phase 2 扩全扫 |
| Phase 0 计数 | 无 | "5 工件"（错） | "5 工件"（错） | 6 workstream（不数硬数字） |

---

## 2. Phase 0 — Pre-flight（6 workstreams）

**目标**：在不动 loamwise Sprint 9 baseline-protected 路径前提下，把 GHL 的"骨架文件"全部到位，保证 Phase 1 启动时无空引用。

### 0a — Doctrine
**Deliverables**:
- `liye_os/_meta/adr/ADR-Governed-Heuristic-Learning.md`（**仅起草，不 Accept**——baseline 冷却 1–2 天后再启动 P1 ADR 的"写→停→改→GO"节奏）
- 起草内容：战略叙事 + 8 条 Hard Gate + Glossary（命名禁用 5 项 / 命名允许 4 项）+ Open Questions（TrustMatrix post-readout 处置 / AGE 24 worktree 治理）

**8 条 Hard Gate**:
1. 不引入新 Trust 系统
2. 不引入新 Lifecycle FSM
3. 不引入新 Candidate 类型
4. Layer-2 不直接写 liye_os（必须通过 fact pull）
5. 任何接入的 source 必须通过 manifest reality validator
6. fact ingest 必须幂等（event_identity_key + event_content_hash 双 hash dedupe）
7. heartbeat 首次启动必须 dry_run（trial_write_enabled=false）
8. Pilot 1 = negative learning only（无 production_write，无 execute_limited）

### 0b — Schemas + Validators
**Deliverables**:
- `liye_os/_meta/contracts/learning/learned_policy_ghl_v1.schema.yaml`（GHL profile 扩展，不自我声明 promotion eligibility）
- `liye_os/_meta/contracts/learning/fact_run_outcome_event_v1.schema.yaml`（AGE-emitted source event）
- `liye_os/_meta/contracts/learning/fact_run_outcome_record_v1.schema.yaml`（liye_os-imported canonical record，allOf event + importer fields）
- `liye_os/_meta/contracts/learning/policy_lifecycle_event_v1.schema.yaml`（**纳入 0b** per decision）
- `liye_os/_meta/contracts/learning/confidence_formulas.yaml`（公式定义 + inputs 映射 + missing/boundary policy）
- 扩展 `liye_os/_meta/contracts/scripts/validate-contracts.mjs` 扫所有新 schema

详细字段见第 5 节 Schema 最终定义。

### 0c — Manifest Reality
**Deliverables**:
- `amazon-growth-engine/engine_manifest.yaml` 拆字段：`write_capability_declared / write_capability_effective / capabilities[] / runtime_gates`（仅正向语义；复用现有 `AGE_BD_SP_WRITE_ENABLED` 等 env var 名，**不**重命名）
- `liye_os/_meta/contracts/scripts/validate_manifest_reality.py`：输入 manifest+repo+commit_sha → 输出 PASS/WARN/FAIL
  - 比对 manifest 声明 vs `s2a_allowlist.yaml` / `write_automation_policy_v1.yaml` / env vars
- 运行点 1：AGE CI（manifest 改动 trigger）
- 运行点 2：liye_os importer preflight（每次 import 前 + Source Registry `require_manifest_reality_check: true`）
- FAIL 行为：source 标记 `import_disabled`，**不阻塞其他 source**（软失败 per 决策点 2）

### 0d — Registries
**Deliverables**:
- `liye_os/.claude/config/learning_sources.yaml`：每条 source 含 layer / repo_local_path / repo_remote_ref / required_commit_sha（Phase 1 可 null，Phase 2 必填，Phase 4 必 pin）/ fact_emission_path / schema / allowed_playbooks / import_mode / max_imports_per_day / require_manifest_reality_check
- `liye_os/.claude/config/golden_packs.yaml`：每个 pack 含 paths / content_hash_each / frozen / valid_for_playbooks / stale_action（severity-based，见 Patch 8）

### 0e — Operability
**Deliverables**:
- `liye_os/_meta/runbooks/GHL-RUNBOOK.md` skeleton 7 标题：
  1. Pause heartbeat
  2. Disable source
  3. Re-run manifest validator
  4. Replay golden pack
  5. Inspect policy_trials.jsonl & fact_conflicts/
  6. Quarantine learned policy（含 lifecycle transaction）
  7. Roll back crystallizer v1 to v0
- 每节先标题 + 一句话说明，详细命令在 Phase 1e 补完。

### 0f — Hygiene
**Deliverables**:
- `liye_os/.claude/scripts/learning/lint_forbidden_names.sh`（50 行 grep）
  - **阶段 1**（Phase 0f 起）：仅扫 PR diff / pre-commit staged files，archive/ 与 quarantine/ 排除
  - **阶段 2**（Phase 2 启动）：扩展到固定 GHL paths 全扫
  - 块词：`\btrial\b | \bcandidate\b | \btrust_score\b | \btrust_matrix\b | \bevaluator\b`（word boundary）
  - 白名单 regex：`\bpolicy_trial\b | \blearned_policy\.validation_status=candidate\b | \bPolicyTrialEvaluator\b | \bconfidence\b`
  - 违规即 fail（review blocker）

---

## 3. Phase 1 — 数据食物链（5 步硬性顺序）

| 步 | Deliverables | 必须前序 |
|---|---|---|
| **1a** | `amazon-growth-engine/scripts/learning/emit_fact.py` —— AGE 写本地 `out/facts/<YYYY-MM-DD>/<event_identity_key>.json` + 同目录追加 `fact_run_outcome_events.jsonl`（仅 event schema 字段） | Phase 0c manifest fix + 0b event schema |
| **1b** | 改 `liye_os/.claude/scripts/learning/discover_new_runs.mjs`：加 pull + dedupe（双 hash 决策树）+ canonical_record_hash + import_disabled 检查 + path traversal 防护 + duplicate conflict 写 `state/runtime/learning/fact_conflicts/` | 1a + 0d registry |
| **1c** | `liye_os/src/reasoning/policy_trial_evaluator.mjs` + `state/runtime/learning/policy_trials.jsonl` writer | 1b（evaluator 必须先于 heartbeat dry_run，**修复 v4.0 Phase 顺序倒置**） |
| **1d** | heartbeat v2 升级到 7 字段 + derived current_phase + invalid combination fail-closed + runtime-owned 校验；首次启动 `evaluator_enabled=true / trial_write_enabled=false / current_phase=evaluating_metrics_only` 7–14 天 | 1c |
| **1e** | Runbook 补完整命令（每节 ≥ 1 条 reproducible bash）+ `state/runtime/learning/metrics_daily.jsonl` 输出 | 1d |

**Phase 1 出口准则**：
- 至少 1 个 source（AGE）连续 7 天 `manifest_validator=PASS`
- dedupe 命中率稳定（同 trace 重 emit 全部 silent skip，无 DUPLICATE_CONFLICT 误判）
- evaluator metrics-only 期间 metrics_daily.jsonl 持续输出
- 0 例 path traversal 防护被触发（即 AGE emit 路径全合规）

---

## 4. Phase 2 — 消费端升级（3 步）

| 步 | Deliverables | 模式 |
|---|---|---|
| **2a** | dry_run 升级：`trial_write_enabled=true → current_phase=trialing`；7–14 天观察 trial verdict 分布 + golden replay 复现 + negative evidence 命中率 | 写 trials.jsonl 但**不**写 candidate |
| **2b** | `liye_os/.claude/scripts/learning/policy_crystallizer_v1.mjs`：与 v0 **parallel shadow run**，输出对比报告供运营审；v0 仍主用 | shadow only，不 cutover |
| **2c** | crystallizer v1 cutover；`current_phase=candidate_writing_sandbox`（target_status=sandbox）→ `candidate_writing`（target_status=candidate）；**source_commit_sha MUST be pinned**（决策点 2 选 A） | 仅 sandbox/candidate 写，禁止 promotion |

**Phase 2 出口准则**：
- crystallizer v1 与 v0 输出在 30 天 shadow 期内 ≥ 95% 一致
- 至少 3 个 negative learning candidate 在 sandbox 复现成功
- 0 例 redaction_status=unknown 的 trial 被升级为 candidate（data safety gate 验证）

---

## 5. Phase 3 — 联通（Sprint 9 readout 后）

**前置**：loamwise Sprint 9 readout 完成（earliest 2026-05-13Z），baseline-protected paths 解冻。

**Deliverables**:
- loamwise P3 SkillReviewQueue PROMOTED 事件 emit 到 `fact_run_outcome_events`
- TrustMatrix quarantine 处置决策：A 复活 / B 重写 / C 合并到 confidence（pending readout）

---

## 6. Phase 4 — execute_limited（数据驱动启动）

**前置硬约束**（全部成立才能启动 Phase 4）：
1. manifest validator 30 天连续 PASS
2. dedupe 稳定（dedupe_hit / DUPLICATE_CONFLICT 比例稳定）
3. dry_run/sandbox 期 0 重大异常
4. **operator_agreement_rate ≥ 0.7**（30 天滚动窗）
5. **critical_false_negative_count = 0**（30 天滚动窗，hard gate）
6. kill_switch 演练通过
7. Runbook 完整（含 Phase 4 专属 abort 路径）
8. metrics_daily.jsonl 可追踪
9. 至少 1 个 negative learning case 在 `production_observed` evidence 上验证过
10. ADR 已封板（cooling 期已过）
11. Pilot 1 time-bounded non-goal 复审决议（自 v4.1-final 落盘起 ≥ 90 天）

---

## 7. 关键 Schema/Contract 最终定义

### 7.1 fact_run_outcome_event_v1.schema.yaml（AGE emits）

```yaml
$schema: http://json-schema.org/draft-07/schema#
$id: liye_os/_meta/contracts/learning/fact_run_outcome_event_v1
type: object
required:
  # identity (5)
  - source_system
  - source_repo
  - source_commit_sha
  - source_branch
  - source_worktree_id
  # provenance (3)
  - source_dirty
  - manifest_hash
  - emitted_at
  # business (5)
  - trace_id
  - artifact_type
  - artifact_path
  - playbook_ref
  - step_id
  # payload reference (4) — NOT raw_payload itself
  - raw_payload_ref
  - raw_payload_hash
  - raw_payload_summary
  - redaction_status
  # hashes (2)
  - event_identity_key
  - event_content_hash
  # schema mgmt (1)
  - schema_version
properties:
  source_system: { type: string, enum: [amazon-growth-engine, chaming, loamwise] }
  source_repo: { type: string }
  source_commit_sha: { type: string, pattern: "^[0-9a-f]{40}$" }
  source_branch: { type: string }
  source_worktree_id: { type: string }
  source_dirty: { type: boolean }
  manifest_hash: { type: string, pattern: "^sha256:" }
  emitted_at: { type: string, format: date-time }
  trace_id: { type: string }
  artifact_type:
    enum: [verification_json, policy_suggestions_json, step_evaluation_instance, regression_replay_result]
  artifact_path: { type: string }
  playbook_ref: { type: string }
  step_id: { type: string }
  raw_payload_ref:
    type: string
    pattern: "^[a-zA-Z0-9_./-]+$"
    description: |
      MUST be repo-relative path. NO ".." segments, NO leading "/", NO "~".
      Importer MUST canonicalize and assert resolved path startswith source_repo realpath.
      Importer MUST reject if any path segment is symlink pointing outside source_repo.
  raw_payload_hash: { type: string, pattern: "^sha256:" }
  raw_payload_summary:
    type: object
    maxProperties: 20
    description: "NO PII fields. Schema-defined keys only."
  redaction_status:
    enum: [redacted, no_sensitive_fields_detected, unknown]
  event_identity_key:
    type: string
    pattern: "^sha256:"
    description: |
      sha256(source_system + source_repo + trace_id + artifact_type 
             + artifact_path + playbook_ref + step_id + source_commit_sha)
  event_content_hash:
    type: string
    pattern: "^sha256:"
    description: |
      sha256(canonical_event_payload_excluding_volatile_fields)
      excludes: [emitted_at, raw_payload_summary.metric_formatting_hint]
  schema_version: { const: "1.0.0" }
```

### 7.2 fact_run_outcome_record_v1.schema.yaml（liye_os imports）

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
      - provenance:
          - manifest_validator_status
          - provenance_dirty
    properties:
      ingested_at: { type: string, format: date-time }
      importer_version: { type: string, pattern: "^discover_new_runs@\\d+\\.\\d+\\.\\d+$" }
      canonical_record_hash: { type: string, pattern: "^sha256:" }
      provenance:
        type: object
        required: [manifest_validator_status, provenance_dirty]
        properties:
          manifest_validator_status: { enum: [PASS, WARN, FAIL] }
          provenance_dirty:
            type: boolean
            description: |
              MUST equal:
                source_dirty == true
                OR manifest_validator_status != PASS
                OR source_branch not in source_registry.allowed_branches
                OR manifest_hash != source_registry.expected_manifest_hash
```

### 7.3 heartbeat_learning_state.json v2（schema + sample）

```yaml
# liye_os/_meta/contracts/learning/heartbeat_state_v2.schema.yaml
required:
  - version
  - enabled
  - evaluator_enabled
  - trial_write_enabled
  - candidate_write_enabled
  - candidate_write_target_status
  - promotion_enabled
  - production_write_enabled
  - source_allowlist
  - max_trials_per_day
  - kill_switch_required
  - cooldown_minutes
  - _runtime_owned_fields
  - current_phase
  - current_phase_derived_at
  - last_run_at
properties:
  version: { const: 2 }
  enabled: { type: boolean }
  evaluator_enabled: { type: boolean }
  trial_write_enabled: { type: boolean }
  candidate_write_enabled: { type: boolean }
  candidate_write_target_status: { enum: [sandbox, candidate] }
  promotion_enabled: { type: boolean }
  production_write_enabled: { type: boolean }
  current_phase:
    enum:
      - paused
      - paused_no_active_source
      - ingesting_only
      - evaluating_metrics_only
      - trialing
      - candidate_writing_sandbox
      - candidate_writing
      - promoting
      - executing_limited
    description: "RUNTIME-OWNED. Set by heartbeat runner only. Diff against this field rejected by pre-commit hook."
  _runtime_owned_fields:
    type: array
    const: [current_phase, current_phase_derived_at, last_run_at]
```

**Phase 状态决策表**（runner 每次启动重新计算）：

| 条件（顺序短路评估） | current_phase |
|---|---|
| `enabled=false` | `paused` |
| `source_allowlist 内 active source = 0` | `paused_no_active_source` |
| `evaluator_enabled=false` | `ingesting_only` |
| `evaluator_enabled=true ∧ trial_write_enabled=false` | `evaluating_metrics_only` |
| `trial_write_enabled=true ∧ candidate_write_enabled=false` | `trialing` |
| `candidate_write_enabled=true ∧ target=sandbox ∧ promotion_enabled=false` | `candidate_writing_sandbox` |
| `candidate_write_enabled=true ∧ target=candidate ∧ promotion_enabled=false` | `candidate_writing` |
| `promotion_enabled=true ∧ production_write_enabled=false` | `promoting` |
| `production_write_enabled=true` | `executing_limited` |

**Invalid combinations**（fail-closed exit code != 0，**不**自动修正）：

```
1. production_write_enabled=true ∧ promotion_enabled=false
2. promotion_enabled=true ∧ candidate_write_enabled=false
3. candidate_write_enabled=false ∧ candidate_write_target_status=candidate
4. trial_write_enabled=true ∧ evaluator_enabled=false
5. trial_write_enabled=false ∧ candidate_write_enabled=true
6. enabled=false ∧ (任何 write/eval flag = true)
```

### 7.4 promotion_guardrails block（in execution_tiers.yaml）

```yaml
promotion_guardrails:
  allowed_evidence_origins:
    observe:           [production_observed, historical_replay, golden_regression, synthetic]
    recommend:         [production_observed, historical_replay, golden_regression]
    execute_limited:   [production_observed, historical_replay, golden_regression]
  required_evidence_origins:
    observe:           []
    recommend:         []
    execute_limited:   [production_observed]
  negative_evidence_guardrail:
    enabled_for: [recommend, execute_limited]
    qualifying_signals:
      - verdict: FAIL
        always_qualifies: true
      - verdict: DOWNGRADED
        always_qualifies: true
      - verdict: NEEDS_HUMAN
        always_qualifies: false
        requires_reason_code_any_of:
          - unsafe_reuse
          - regression_failed
          - business_context_changed
        # weak_evidence / acceptable 不计入 negative evidence
    minimum_qualifying_count: 1
    allow_documented_absence_for_observe: true
  data_safety_gates:
    redaction_required_for: [candidate_writing, promotion, execute_limited]
    blocked_redaction_statuses: [unknown]
  per_policy_override:
    allowed: true
    constraint: must_be_equal_or_stricter_than_global
    looser_requires: ADR_or_explicit_human_approval
  global_defaults:
    min_sample_size: 20
    boundary_confidence_requires_review: true
    confidence_boundary_values: [0.0, 1.0]
    forbid_only_synthetic_evidence: true
```

### 7.5 confidence_formulas.yaml

```yaml
version: 1
formulas:
  ghl_confidence_v1:
    valid_from: "2026-05-09"
    deprecation_notice: null
    inputs:
      exec_success_rate:        "$.success_signals.exec.success_rate"
      operator_agreement_rate:  "$.confidence_basis.operator_agreement_rate"
      business_score:           "$.confidence_basis.business_score"
      regression_pass_rate:     "$.confidence_basis.regression_pass_rate"
    legacy_aliases:
      operator_agreement_rate_legacy: "$.success_signals.operator.approval_rate"
        # evaluator reads both; emits warning if values diverge >5% over 30 days
    weights:
      exec_success_rate:        0.2
      operator_agreement_rate:  0.3
      business_score:           0.4
      regression_pass_rate:     0.1
    missing_input_policy: fail_closed
    boundary_output_policy:
      values: [0.0, 1.0]
      action: requires_review
```

### 7.6 operator_feedback schema (in learned_policy_ghl_v1)

```yaml
operator_feedback:
  type: object
  required: [reviewer_id_hash, verdict, reason_codes, reviewed_at]
  properties:
    reviewer_id_hash:
      type: string
      pattern: "^sha256:"
    verdict:
      enum: [AGREE_WITH_SYSTEM, DISAGREE_WITH_SYSTEM, NEEDS_MORE_EVIDENCE]
    reason_codes:
      type: array
      minItems: 1
      items:
        enum: [unsafe_reuse, weak_evidence, business_context_changed, regression_failed, acceptable]
    reviewed_at: { type: string, format: date-time }
    comment_summary: { type: string, maxLength: 200 }
```

**Phase 4 operator metrics**:

```yaml
operator_metrics:
  operator_agreement_rate:
    threshold: ">= 0.7"
    formula: |
      count(verdict = AGREE_WITH_SYSTEM)
      / count(verdict ∈ {AGREE_WITH_SYSTEM, DISAGREE_WITH_SYSTEM})
      # NEEDS_MORE_EVIDENCE excluded from denominator
  critical_false_negative_count:
    threshold: "= 0"
    formula: |
      count(
        system_verdict = PASS
        ∧ operator_verdict = DISAGREE_WITH_SYSTEM
        ∧ unsafe_reuse ∈ reason_codes
      )
      # system_verdict = NEEDS_HUMAN does NOT count (system explicitly asked for human review)
    review_window_days: 30
    hard_gate: true
```

### 7.7 policy_lifecycle_event_v1 schema（true append-only）

```yaml
$schema: http://json-schema.org/draft-07/schema#
$id: liye_os/_meta/contracts/learning/policy_lifecycle_event_v1
type: object
required:
  - event_id
  - transaction_id
  - action
  - policy_id
  - actor
  - occurred_at
properties:
  event_id: { type: string, format: uuid }
  transaction_id: { type: string, format: uuid }
  action:
    enum:
      - TXN_STARTED
      - TXN_COMMITTED
      - TXN_ABORTED
      - POLICY_FILE_UPDATED
      - FILE_MOVED
      - INDEX_UPDATED
      - COMPENSATING_RESTORE
      - COMPENSATING_REVERT_MOVE
  policy_id: { type: string }
  actor:
    type: string
    pattern: "^(human:|system:)"
  occurred_at: { type: string, format: date-time }
  intent:
    enum: [CREATE, PROMOTE, DEMOTE, QUARANTINE, RESTORE, EXPIRE, DISABLE]
    description: "Required when action=TXN_STARTED"
  planned_from_path: { type: string }
  planned_to_path: { type: string }
  from_path: { type: string }
  to_path: { type: string }
  content_hash_before: { type: string, pattern: "^sha256:" }
  content_hash_after: { type: string, pattern: "^sha256:" }
  reason_code: { type: string }
  reason_text: { type: string }
  compensating_actions:
    type: array
    items: { type: string }
```

**File**: `state/runtime/learning/policy_lifecycle_events.jsonl`（**真 append-only**，禁止 in-place mutation）

**Quarantine transaction example**（5 lines append, no mutation）:
```jsonl
{"event_id":"e_001","transaction_id":"txn_abc","action":"TXN_STARTED","intent":"QUARANTINE","policy_id":"BID_RECOMMEND_..._17ED8F","planned_from_path":"candidate/...","planned_to_path":"quarantine/...","actor":"system:tier_manager","occurred_at":"..."}
{"event_id":"e_002","transaction_id":"txn_abc","action":"POLICY_FILE_UPDATED","policy_id":"...","content_hash_before":"sha256:abc","content_hash_after":"sha256:def","occurred_at":"..."}
{"event_id":"e_003","transaction_id":"txn_abc","action":"FILE_MOVED","from_path":"...","to_path":"...","occurred_at":"..."}
{"event_id":"e_004","transaction_id":"txn_abc","action":"INDEX_UPDATED","occurred_at":"..."}
{"event_id":"e_005","transaction_id":"txn_abc","action":"TXN_COMMITTED","occurred_at":"..."}
```

**Recovery scan logic**（runner 启动时执行）:
```
group events by transaction_id
for each group, examine last action:
  TXN_COMMITTED  → completed, no action
  TXN_ABORTED    → already rolled back, no action
  TXN_STARTED only (no later events) → orphan, emit operator_alert, do NOT auto-decide
  POLICY_FILE_UPDATED/FILE_MOVED/INDEX_UPDATED but no TXN_COMMITTED/TXN_ABORTED → 
    interrupted mid-transaction, emit operator_alert with replay context
```

**Redirects sidecar**: `state/memory/learned/policies/_redirects.yaml`
```yaml
redirects:
  - from: candidate/BID_RECOMMEND_..._17ED8F.yaml
    to:   quarantine/BID_RECOMMEND_..._17ED8F.yaml
    moved_at: "2026-05-09T..."
    transaction_id: txn_abc
```

读取流程：任何工具读 `candidate/X.yaml` 若 ENOENT → 查 `_redirects.yaml` → 若有 redirect 按重定向路径读 + emit warning（policy_id 已 quarantined）。

### 7.8 fact_conflicts/ 目录结构（独立于 policy quarantine）

```
state/runtime/learning/fact_conflicts/
└── <source_system>/
    └── <event_identity_key>/
        ├── original.json        # existing record at first import
        ├── incoming.json        # new event with same identity but different content
        └── conflict_meta.yaml   # detected_at, content_hash_diff_summary, related_trial_id
```

关联 policy trial（如已生成）verdict = NEEDS_HUMAN + reason_code = duplicate_conflict。

### 7.9 golden_packs.yaml stale_action（severity 2 档，第一 pilot）

```yaml
stale_action:
  on_new_trial: NEEDS_HUMAN
  on_existing_candidate_promotion_evidence: promotion_blocked
  on_promoted_policy_dependents:
    threshold_for_per_item_review: 10
    threshold_exceeded_action: batch_review_freeze_promotion
  severity:
    low:
      criteria: "stale pack 仅影响 ≤ 10 个 sandbox candidate"
      action: block_new_promotion
    high:
      criteria: "stale pack 是 ≥ 1 个 candidate 的唯一 regression evidence OR 影响 ≥ 1 个 production_observed policy"
      action: block_new_promotion + batch_review + emit operator_alert
  # Phase 4 启动后扩展第三档 medium：含 demote_execute_limited_to_recommend
```

---

## 8. Decision Log（13 项封板决策）

| # | 决策点 | 选项 | 决策 | 决策时间 | 决策方 |
|---|---|---|---|---|---|
| D-01 | schema 命名 | learned_policy_ghl_v1 vs learned_policy_v2 | learned_policy_ghl_v1 | 2026-05-09 (v4.0) | cc + ChatGPT |
| D-02 | Pilot 1 战略 | bid optimization vs negative learning | negative learning, time-bounded ≥ 90d | 2026-05-09 (v4.0) | cc + ChatGPT |
| D-03 | shadow_learning 命名 | 引入 vs 拒绝 | 拒绝，用 orthogonal heartbeat 字段 | 2026-05-09 (v4.0) | cc + ChatGPT |
| D-04 | crystallizer v1 阶段 | Phase 1 vs Phase 2 | Phase 2b shadow + Phase 2c cutover | 2026-05-09 (v4.0) | cc + ChatGPT |
| D-05 | Phase 顺序 | heartbeat 先 vs evaluator 先 | evaluator+writer 先 (Phase 1c) → heartbeat dry_run (Phase 1d) | 2026-05-09 (v4.1) | ChatGPT 硬伤 4 |
| D-06 | heartbeat 字段数 | 5 字段 vs 7 字段 | 7 字段（加 evaluator_enabled + trial_write_enabled） | 2026-05-09 (v4.1-final) | ChatGPT patch 1+3 |
| D-07 | manifest validator FAIL 行为 | hard fail (heartbeat 全停) vs soft fail (单 source 禁用) | soft fail；active source = 0 时自动 paused_no_active_source | 2026-05-09 (v4.1) | cc 推荐 |
| D-08 | quarantine 语义 | A status only / B move only / C 全套 | C 全套 + lifecycle ledger + redirects | 2026-05-09 (v4.1) | cc 推荐 |
| D-09 | policy_lifecycle_events.jsonl 阶段 | Phase 0b vs Phase 2c | **Phase 0b**（与 schemas 同期落地） | 2026-05-09 (v4.1-final) | user 拍板 |
| D-10 | source_commit_sha 在 Phase 2 | A 必须 pin / B branch_ref+timestamp | **A 必须 pin** | 2026-05-09 (v4.1-final) | user 拍板 |
| D-11 | operator 指标口径 | approval_rate vs agreement_rate+false_negative | agreement_rate ≥ 0.7 (软) + false_negative=0 (硬 hard gate) | 2026-05-09 (v4.1-final) | ChatGPT patch 2 |
| D-12 | NEEDS_HUMAN 是否算 negative evidence | always vs conditional | conditional：仅当 reason_code ∈ {unsafe_reuse, regression_failed, business_context_changed} | 2026-05-09 (v4.1-final) | ChatGPT patch 5 |
| D-13 | duplicate conflict 存储 | 混 policy quarantine vs 独立目录 | 独立 `state/runtime/learning/fact_conflicts/` | 2026-05-09 (v4.1-final) | ChatGPT patch 6 |

---

## 9. v4.1-final pre-baseline patches 溯源（6 patches）

| Patch | 命中漏洞 | 提出方 | 修订内容 |
|---|---|---|---|
| P-01 | confidence_formulas 引用不存在的字段路径 | ChatGPT | 改引 `confidence_basis.*`，legacy `success_signals.operator.approval_rate` 保留 alias 不硬改名 |
| P-02 | operator verdict enum 含虚构的 APPROVE_WITH_REASON；NEEDS_HUMAN 误算 false_negative | ChatGPT | enum 改 AGREE_WITH_SYSTEM / DISAGREE_WITH_SYSTEM / NEEDS_MORE_EVIDENCE；false_negative 严格限定 system_verdict=PASS |
| P-03 | heartbeat phase 语义混淆（evaluator metrics-only 被错当 ingesting_only）；current_phase 未声明 runtime-owned | ChatGPT | 加 evaluator_enabled 字段；扩展 phase 到 8 种；加 _runtime_owned_fields 元字段 + pre-commit hook reject diff |
| P-04 | lifecycle ledger 用 status: PENDING→COMMITTED 违反 append-only | ChatGPT | 改用 transaction_id + action enum (TXN_STARTED/COMMITTED/ABORTED)，每个状态变迁追加新行 |
| P-05 | NEEDS_HUMAN 无条件算 negative evidence | ChatGPT | 限定 reason_code ∈ {unsafe_reuse, regression_failed, business_context_changed} 才算 |
| P-06 | raw_payload_ref 缺 path traversal 防护；redaction=unknown 未阻 candidate；duplicate conflict 混 policy quarantine | ChatGPT | 加字符白名单 + canonicalize 校验；redaction=unknown 阻 candidate_writing+promotion+execute_limited；conflict 写独立 fact_conflicts/ 目录 |

---

## 10. 不做清单（硬边界）

继承 SYSTEMS.md / evolution_roadmap：
- Smart model routing / auto skill repair / Honcho 用户建模
- Vault 基础设施（先做 CredentialBroker seam）
- 统一 session 底层存储（先做 Federated Query）
- Monorepo
- 把 BGHS 做成新平台层或目录结构

GHL-specific：
- 不引入新 Trust 系统
- 不引入新 Lifecycle FSM
- 不引入新 Candidate 类型
- 不让 Layer-2 直接写 liye_os
- 不在 Pilot 1 期做自动 bid 优化（time-bounded ≥ 90 天）

---

## 11. 落盘后下一步

1. **冷却期**：本文件落盘后 1–2 天内不动，让团队回看
2. **ADR 起草**：冷却结束后启动 `_meta/adr/ADR-Governed-Heuristic-Learning.md` 的 P1 ADR 节奏（写→停→改→GO）
3. **Phase 0a 执行**：ADR Accept 后启动 schemas + validators（Phase 0b）
4. **Sprint 9 协调**：earliest 2026-05-13Z window 期间 GHL 仅做 Phase 0 文件起草，**不**触碰 loamwise baseline-protected paths（audit/, govern/, construct/candidates/）
5. **Memory 更新**：本 baseline 落盘后更新 `~/.claude/projects/-Users-liye-github/memory/evolution_roadmap.md`

---

**Authored**: 2026-05-09 (cc primary drafter, ChatGPT Pro adversarial auditor across 4 audit rounds: v3 → v4.0 → v4.1 → v4.1-final)
**Status**: baseline candidate, awaiting cooling period before ADR
**Next review**: 2026-05-11 ~ 2026-05-12（cooling end）
