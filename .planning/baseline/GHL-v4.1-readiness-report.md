# GHL v4.1 Readiness Report

**Status**: read-only audit; reports only, no fix attempted
**Date**: 2026-05-10
**Cooling period**: 2026-05-09 → 2026-05-11/12 (in progress)
**Audit scope**: post-errata-draft state check
**Sources audited**:
- `liye_os/.planning/baseline/GHL-evolution-plan-v4.1.md`
- `liye_os/.planning/baseline/GHL-v4.1-errata.md`
- `liye_os/.planning/baseline/archive/GHL-evolution-plan-v3-superseded.md`
- `liye_os/.planning/baseline/GHL-v4.1-to-ADR-intake.md` (companion artifact)
- `~/.claude/projects/-Users-liye-github/memory/MEMORY.md`
- `~/.claude/projects/-Users-liye-github/memory/project_ghl_baseline.md`
- `loamwise/audit/`, `loamwise/govern/`, `loamwise/construct/candidates/` (existence check)

---

## 检查项

### 1. v4.1 baseline 是否保持冻结

**状态**：✅ FROZEN

| 证据 | 值 |
|---|---|
| 文件路径 | `liye_os/.planning/baseline/GHL-evolution-plan-v4.1.md` |
| 行数 | 663 (无变化于落盘时刻 2026-05-09 23:41) |
| 大小 | 32003 bytes |
| 修改时间 | 2026-05-09 23:41（与落盘时刻一致） |
| Git 状态 | `??`（untracked，本地候选状态正确） |
| 内容修订 | 0 处 |

**判断**：v4.1 正文未被回改，errata 作为修订叠加层独立存在。冷却期纪律保持。

### 2. errata 是否覆盖 B-01 ~ B-05

**状态**：✅ COVERED (5/5)

| Finding | errata 节 | 修订内容 |
|---|---|---|
| B-01 required schema bug | §3 B-01 | root required 改纯字符串数组；子结构 required 移到 `properties.provenance.required` |
| B-02 engine_manifest schema migration | §3 B-02 | 新增 `engine_manifest.schema.v2.yaml` + validate-contracts 双 schema 路由 + 兼容期 ≥ 30 天 |
| B-03 forbidden-name lint word-boundary | §3 B-03 | POSIX regex `(^|[^A-Za-z0-9_])(...)([^A-Za-z0-9_]|$)` + diff-only first + self-test fixture (must_pass / must_fail) + CI 必跑 |
| B-04 governance_event_v1 split | §3 B-04 | 新建 `governance_event_v1.schema.yaml` 与 fact_event 平级；双流入账（facts/ + governance/） |
| B-05 policy_trial_v1 + fact_conflicts | §3 B-05 | 新建 `policy_trial_v1.schema.yaml` + `operator_feedback_v1.schema.yaml` 拆出独立；duplicate_conflict 双落点（fact_conflicts/ 必写，policy_trials.jsonl 仅当已绑 policy_id 时写） |

### 3. errata 是否覆盖 I-01 ~ I-04

**状态**：✅ COVERED (4/4)

| Finding | errata 节 | 修订内容 |
|---|---|---|
| I-01 learning_sources provenance fields | §4 I-01 | 补 `allowed_branches` 数组 + `expected_manifest_hash {value, pinned_at, reset_policy}` |
| I-02 canonical record path | §4 I-02 | 固定 `state/memory/facts/fact_run_outcome_records.jsonl`；禁止复用 v0.1 legacy 路径 |
| I-03 D-14 AGE explicit emit | §4 I-03 + §7 D-14 | 选项 A，emit_fact.py 落 AGE repo，Phase 1a ≥ 2026-05-13Z |
| I-04 phase enum 计数 | §4 I-04 | 9 phases；放弃硬数工件，改 workstream 表达 |

### 4. D-14 是否选择 A

**状态**：✅ A SELECTED, B REJECTED

| 字段 | 值 |
|---|---|
| Decision ID | D-14 |
| Decision text | "AGE → liye_os fact flow uses explicit AGE fact emission." |
| Selected | A. AGE adds `scripts/learning/emit_fact.py` |
| Rejected | B. liye_os importer source adapter over `out/{ASIN}/runs/{timestamp}/` |
| Rationale | 5 项（边界稳定 / 反向工程风险 / Layer-2 显式 contract / coupling / 未来 source pattern） |
| Time constraint | Phase 1a starts ONLY after Sprint 9 readout (≥ 2026-05-13Z) |
| Decision scope | errata Decision Log Addendum §7 |

### 5. Phase 1a 是否明确在 Sprint 9 readout 后

**状态**：✅ EXPLICITLY GATED

| 证据 | 内容 |
|---|---|
| errata §4 I-03 | "Phase 1a (emit_fact.py) starts ONLY after Sprint 9 readout (≥ 2026-05-13Z)" |
| errata §7 D-14 | "Time constraint: Phase 1a (emit_fact.py) starts ONLY after Sprint 9 readout" |
| errata §10 Next Step | "Sprint 9 readout 协调 — earliest 2026-05-13Z；ADR Accept 前不动 AGE / loamwise" |
| Sprint 9 状态参照 | `~/.claude/projects/-Users-liye-github/memory/sprint_7_status.md`：S9 GO with binding pre-conditions; baseline `3df1435` |
| AGE 当前保护态 | Sprint 9 baseline 保护期，AGE 改代码必须等 readout 后 |

### 6. governance_event 是否与 fact_event 分流

**状态**：✅ DUAL-STREAM CONFIRMED

| 流 | event schema | 落账本路径 |
|---|---|---|
| 业务事实 | `fact_run_outcome_event_v1` (AGE emits) → `fact_run_outcome_record_v1` (importer canonical) | `state/memory/facts/fact_run_outcome_records.jsonl` |
| 治理决策 | `governance_event_v1` | `state/memory/governance/governance_event_records.jsonl` |

| Schema enum 区隔 | 内容 |
|---|---|
| `artifact_type` (in fact event) | verification_json / policy_suggestions_json / step_evaluation_instance / regression_replay_result |
| `governance_event_type` (in governance event) | skill_review_promoted / skill_review_demoted / policy_lifecycle_committed / trust_matrix_decision |

无 enum 值跨 schema 混用。importer 双轨道，validate 各走各的。

### 7. duplicate_conflict 是否拥有 fact_conflicts + policy_trial 双落点

**状态**：✅ DUAL-LOCATION RULES DEFINED

| 情形 | 落点规则 |
|---|---|
| Importer-only conflict (无 policy_id) | `state/runtime/learning/fact_conflicts/<source_system>/<event_identity_key>/` （original.json + incoming.json + conflict_meta.yaml）；**不**生成 policy_trial |
| Conflict + 已绑定 policy_id | fact_conflicts/ 仍写；**额外** policy_trial_v1（system_verdict=NEEDS_HUMAN, system_verdict_reason_codes=[duplicate_conflict]）写 `state/runtime/learning/policy_trials.jsonl` |

**禁止**：把所有 duplicate conflict 都硬塞进 policy_trials.jsonl（无 policy_id 的 conflict 仅是 importer 层事件，不是 trial）。

### 8. engine_manifest schema v2 migration 是否进入 Phase 0c

**状态**：✅ INTEGRATED INTO PHASE 0C

| 顺序 | 步骤 | 来源 |
|---|---|---|
| 1 | 新增 `engine_manifest.schema.v2.yaml` | errata B-02 |
| 2 | 扩展 `validate-contracts.mjs` 支持双 schema 路由 | errata B-02 |
| 3 | 迁移 AGE `engine_manifest.yaml` 到 v2.0 | errata B-02 |
| 4 | 新建 `validate_manifest_reality.py` | v4.1 + errata B-02 顺序约束 |

**约束**：
- 必须先升级 schema (步骤 1-2)，再迁移 AGE manifest (步骤 3)
- 不允许直接删除 v1.x 的 `write_capability` 字段
- 兼容期 ≥ 30 天（v2.0 deprecated_but_accepted；v2.1 移除）
- AGE 实际改 manifest 锁定在 Sprint 9 readout 后（与 D-14 时序一致）

### 9. canonical fact record path 是否固定为 state/memory/facts/fact_run_outcome_records.jsonl

**状态**：✅ PATH LOCKED

| 项 | 路径 |
|---|---|
| 决议路径 | `liye_os/state/memory/facts/fact_run_outcome_records.jsonl` |
| 旧 v0.1 路径状态 | `liye_os/state/memory/learned/runs/fact_run_outcomes.jsonl` 标记 archive，禁止混写 |
| 引用位置 | errata §4 I-02 + §6 Final Runtime Path Deltas |

旧 v0.1 jsonl 的 schema 与 v4.1 canonical record 不兼容：
- v0.1 缺 event_identity_key / event_content_hash / canonical_record_hash
- v0.1 缺 provenance block
- 混写会污染 dedupe / hash / lineage / replay

### 10. loamwise baseline-protected paths 是否仍不触碰

**状态**：✅ UNTOUCHED

| Path | 存在 | 文件示例 | 修改证据 |
|---|---|---|---|
| `loamwise/audit/` | ✅ | `__init__.py`, `emitter.py`, `backends/` | 无；mtime `Apr 3 / May 6` |
| `loamwise/govern/` | ✅（Bash output 截断未显示，但根据 evolution_roadmap baseline 3df1435 与 Sprint 9 状态推断存在） | — | 无；errata 阶段未触碰 |
| `loamwise/construct/candidates/` | ✅ | `review_queue.py`, `skill_candidate*.py`, `skill_review_queue.py` | 无；mtime 最新 `Apr 25 19:15` |

errata 全部产出仅在 `liye_os/.planning/baseline/`。loamwise 仓库零写入。

---

## 全局判断

| 维度 | 状态 |
|---|---|
| Cooling discipline | ✅ 严守（v4.1 正文 0 修改，runtime 0 修改，AGE 0 修改，loamwise 0 修改） |
| Errata coverage | ✅ 9/9 findings (5 blocking + 4 important) 全部覆盖 |
| Decision Log addendum | ✅ D-14 已封板（A 选定，时序锁定） |
| Schema deltas | ✅ 4 个新 schema 文件已规划（governance_event_v1 / policy_trial_v1 / operator_feedback_v1 / engine_manifest.schema.v2） |
| Runtime path deltas | ✅ 6 条新路径锁定，1 条 v0.1 legacy 路径标记 archive |
| Forbidden artifacts | ✅ 0 项触发禁止事项（无 ADR 正文 / 无 runtime code / 无 AGE 改动 / 无 loamwise 触碰） |

## Pre-flight Verdict

**Errata 草稿就绪，等待人工审核。**

冷却结束前：
- **不**修改本 readiness report
- **不**修改 errata 正文
- **不**启动 ADR
- **不**进入 Phase 0a/0b

冷却结束后（2026-05-11/12）按 errata §10 Next Step 节奏推进。

---

**Authored**: 2026-05-10
**Type**: read-only audit report; no remediation performed
