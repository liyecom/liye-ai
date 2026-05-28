# GHL v4.1 → ADR Intake Pack

**Status**: ADR intake preparation; ADR draft NOT started
**Date**: 2026-05-10
**ADR target**: `liye_os/_meta/adr/ADR-Governed-Heuristic-Learning.md`
**ADR phase**: `_meta/adr/` 起草节奏（写→停→改→GO，沿用 P1 ADR Doctrine 节奏）

**ADR consumes**:
- `liye_os/.planning/baseline/GHL-evolution-plan-v4.1.md` (baseline candidate, 663 lines, frozen)
- `liye_os/.planning/baseline/GHL-v4.1-errata.md` (修订叠加层)

ADR 起草必须同时 read 这两个文件；不可仅读 baseline。

---

## 1. Problem Statement

LiYe Systems 已经在 `liye_os/_meta/contracts/learning/` 与 `.claude/scripts/learning/` 部署了 v0.1 学习管线（schema、crystallizer、heartbeat、bundle），长期缺数据输入而休眠。同时 Layer-2 域引擎（AGE 现役 / chaming 即将接入）产出大量可学习的 evaluation/inference/replay artifacts，但这些产物没有进入 liye_os 学习食物链。

**Jiayi Weng "Learning Beyond Gradients"** 提出 coding-agent-as-learner 范式（trials.jsonl + regression + simplification），但其架构假设是单 agent 自我进化。LiYe 是多 Layer 多 repo 治理生态，简单照搬会破坏 SYSTEMS.md 依赖方向 + 已有 trust/lifecycle/candidate 系统。

**核心问题**：如何在不重建新平台、不破坏现有治理边界的前提下，让 v0.1 学习管线"复活 + 串联 + 限名 + 守门"，从 AGE 的真实业务事实学到 negative learning candidate，并通过 governance gate 上升为 production policy？

**Pilot 1 目标**：第一 pilot 仅做 **negative learning**（系统识别 unsafe reuse 并由 operator 验证），time-bounded ≥ 90 天。期间无 production_write、无 execute_limited、无自动 bid 优化。

## 2. Baseline Reference

**File**: `liye_os/.planning/baseline/GHL-evolution-plan-v4.1.md`

**Status**: baseline 候选，冻结（663 lines @ 2026-05-09）

**核心结构**：
- §0 战略主干（4 项原则 / 3 句话定义成功 / 4 个不做的事）
- §1 v3 → v4.0 → v4.1 → v4.1-final 演进矩阵
- §2 Phase 0 — 6 workstreams (0a-0f)
- §3 Phase 1 — 5 步硬序 (1a-1e)
- §4 Phase 2 — 3 steps (2a-2c)
- §5 Phase 3 — Sprint 9 readout 后联通
- §6 Phase 4 — execute_limited (11 项前置硬约束)
- §7 关键 Schema/Contract 9 个最终定义
- §8 Decision Log 13 项封板 (D-01 ~ D-13)
- §9 v4.1-final pre-baseline 6 patches 溯源
- §10 不做清单
- §11 落盘后下一步

**v4.1 已封板的 13 项决策** (D-01 ~ D-13)：
- D-01 schema 命名 `learned_policy_ghl_v1`
- D-02 Pilot 1 = negative learning only, time-bounded ≥ 90d
- D-03 拒绝 `shadow_learning` 命名，用 orthogonal heartbeat 字段
- D-04 crystallizer v1 → Phase 2b shadow + 2c cutover
- D-05 Phase 顺序：evaluator+writer (1c) 先于 heartbeat dry_run (1d)
- D-06 heartbeat 7 字段（含 evaluator_enabled + trial_write_enabled）
- D-07 manifest validator FAIL = soft fail（单 source 禁用）
- D-08 quarantine 选 C（status + 物理移动 + lifecycle ledger + redirects）
- D-09 policy_lifecycle_events.jsonl 纳入 Phase 0b
- D-10 source_commit_sha 在 Phase 2 必须 pin concrete SHA
- D-11 operator_agreement_rate ≥ 0.7 (软) + critical_false_negative_count = 0 (硬)
- D-12 NEEDS_HUMAN 算 negative evidence 仅当 reason_code ∈ {unsafe_reuse, regression_failed, business_context_changed}
- D-13 duplicate conflict 写独立 `state/runtime/learning/fact_conflicts/`

## 3. Errata Reference

**File**: `liye_os/.planning/baseline/GHL-v4.1-errata.md`

**Status**: 修订叠加层；REQUIRED BEFORE ADR ACCEPT

**核心结构**：
- §3 Blocking Findings B-01 ~ B-05 (5 项)
- §4 Important Fixes I-01 ~ I-04 (4 项)
- §5 Final Schema Deltas (10 个 schema 文件)
- §6 Final Runtime Path Deltas (16 条路径)
- §7 Decision Log Addendum (D-14)
- §8 Required Corrections Before ADR Accept (9 项验收清单)
- §9 Non-goals Preserved
- §10 Next Step

**Errata 修订要点**：
- B-01 修复 schema required 写法非法
- B-02 engine_manifest schema migration 并入 Phase 0c
- B-03 lint word-boundary regex + self-test fixture
- B-04 governance_event_v1 与 fact_event 平级双流入账
- B-05 policy_trial_v1 / operator_feedback_v1 解耦
- I-01 learning_sources.yaml 补 allowed_branches + expected_manifest_hash
- I-02 canonical record path 固定 `state/memory/facts/fact_run_outcome_records.jsonl`
- I-03 D-14 选 A：AGE explicit emit_fact
- I-04 9 phase enum，不硬数工件

## 4. Final Decisions

**14 项已封板决策**（D-01 ~ D-14；ADR 起草期内不可重开）：

详见 baseline §8 + errata §7。重要扩展：

**D-14**: AGE → liye_os fact 流形态 = A（AGE explicit `emit_fact.py`），time-locked to ≥ 2026-05-13Z (Sprint 9 readout)。

## 5. Hard Gates

继承 v4.1 baseline §0 的 8 条 Hard Gate（ADR 起草时必须锁定为 ADR contract）：

1. **不引入新 Trust 系统**（已有 TrustScoreStore EMA / TrustMatrix quarantined / TrustLevel enum 三套）
2. **不引入新 Lifecycle FSM**（已有 validation_status / SkillLifecycleState / SkillReviewQueue）
3. **不引入新 Candidate 类型**
4. **Layer-2 (AGE) 不直接写 Layer-0 (liye_os)**（必须通过 fact pull）
5. **任何接入的 source 必须通过 manifest reality validator**
6. **fact ingest 必须双 hash 幂等**（event_identity_key + event_content_hash dedupe）
7. **heartbeat 首次启动必须 dry_run**（trial_write_enabled=false / evaluator_enabled=true → current_phase=evaluating_metrics_only）
8. **Pilot 1 = negative learning only**（无 production_write，无 execute_limited，time-bounded ≥ 90 天）

## 6. Required Corrections Before Accept

引用 errata §8 的 9 项验收清单。ADR Accept 前必须验证以下 9 项已在 errata 内确定（不要求实施）：

1. ✅ B-01: fact_run_outcome_record_v1 required 改纯字符串列表
2. ✅ B-02: engine_manifest.schema.v2.yaml + validate-contracts 双 schema 路由 + 兼容期 ≥ 30 天
3. ✅ B-03: lint word-boundary regex + diff-only first + self-test fixture (must_pass / must_fail) + CI 必跑
4. ✅ B-04: governance_event_v1 与 fact_event 平级，双流入账
5. ✅ B-05: policy_trial_v1 + operator_feedback_v1 解耦，duplicate_conflict 双落点
6. ✅ I-01: learning_sources.yaml 补 allowed_branches + expected_manifest_hash
7. ✅ I-02: canonical record path 固定 `state/memory/facts/fact_run_outcome_records.jsonl`
8. ✅ I-03: D-14 选 A，Phase 1a ≥ Sprint 9 readout
9. ✅ I-04: 9 phase enum，不硬数工件

ADR §"Required corrections before Accept" 章节直接引用 errata §8。

## 7. Non-goals

继承 baseline §10 + errata §9：

**SYSTEMS-level non-goals** (来自 evolution_roadmap.md)：
- Smart model routing / auto skill repair / Honcho 用户建模
- Vault 基础设施（先做 CredentialBroker seam）
- 统一 session 底层存储（先做 Federated Query）
- Monorepo
- 把 BGHS 做成新平台层或目录结构

**GHL-specific non-goals**：
- 不引入新 Trust 系统
- 不引入新 Lifecycle FSM
- 不引入新 Candidate 类型
- 不让 Layer-2 直接写 Layer-0
- Pilot 1 期内无 production_write / 无 execute_limited (time-bounded ≥ 90 天)
- 不在 Pilot 1 期做自动 bid 优化

**ADR 起草期专属 non-goals**：
- 不修改 v4.1 baseline 正文
- 不修改 errata 正文（除非新增 audit findings 进入 errata 续编）
- 不进入 Phase 0a/0b 实施（ADR Accept 后才启动）

## 8. Contract Deltas

**新增 schema 文件**（10 个，全部 Phase 0b 落地）：

| Schema 文件 | 状态 | 来源 |
|---|---|---|
| `learned_policy_ghl_v1.schema.yaml` | 新建 | baseline §7.1 |
| `fact_run_outcome_event_v1.schema.yaml` | 新建 | baseline §7.1 |
| `fact_run_outcome_record_v1.schema.yaml` | 新建（**B-01 修正**） | baseline §7.2 + errata B-01 |
| `governance_event_v1.schema.yaml` | **新建（B-04）** | errata §3 B-04 |
| `policy_trial_v1.schema.yaml` | **新建（B-05）** | errata §3 B-05 |
| `operator_feedback_v1.schema.yaml` | **新建（B-05 拆出独立文件）** | errata §3 B-05 |
| `policy_lifecycle_event_v1.schema.yaml` | 新建（D-09） | baseline §7.7 |
| `confidence_formulas.yaml` | 新建 | baseline §7.5 |
| `engine_manifest.schema.v2.yaml` | **新建（B-02）** | errata §3 B-02 |
| `heartbeat_state_v2.schema.yaml` | 新建 | baseline §7.3 |

**扩展 contract validators**：
- `validate-contracts.mjs` 扫所有新 schema + B-02 双 schema 路由
- `validate_manifest_reality.py` 新建（Phase 0c 末步）

**扩展配置文件**：
- `execution_tiers.yaml` 加 promotion_guardrails block（baseline §7.4）
- `learning_sources.yaml` 字段补全（errata I-01）
- `golden_packs.yaml` 含 stale_action severity（baseline §7.9）

## 9. Rollout Phases

继承 baseline §2-6，按 errata 修订后展开：

### Phase 0 — Pre-flight (6 workstreams)

| ID | Workstream | Deliverables |
|---|---|---|
| 0a | Doctrine | ADR-Governed-Heuristic-Learning.md（**仅起草，不 Accept**——baseline 冷却 1-2 天后启动）+ Glossary + 8 条 Hard Gate |
| 0b | Schemas | 10 个 schema 文件 + validate-contracts 扩展 + B-02 双 schema 路由 |
| 0c | Manifest reality | engine_manifest.schema.v2.yaml → validate-contracts 双 schema → AGE manifest v2 migration → validate_manifest_reality.py |
| 0d | Registries | learning_sources.yaml（含 allowed_branches + expected_manifest_hash）+ golden_packs.yaml |
| 0e | Operability | GHL-RUNBOOK.md skeleton (7 标题) |
| 0f | Hygiene | lint_forbidden_names.sh + self-test fixture + CI 接入；diff-only first |

### Phase 1 — 数据食物链 (5 步硬序)

| ID | Step | 必须前序 |
|---|---|---|
| 1a | AGE `scripts/learning/emit_fact.py` (D-14) | Phase 0c manifest fix + 0b event schema; **time-locked ≥ Sprint 9 readout (2026-05-13Z)** |
| 1b | liye_os `discover_new_runs.mjs` 升级（pull + 双 hash dedupe + canonical_record_hash + path traversal 防护 + duplicate conflict → fact_conflicts/） | 1a + 0d registry |
| 1c | `policy_trial_evaluator.mjs` + `policy_trials.jsonl` writer | 1b |
| 1d | heartbeat v2 (7 fields + 9-phase enum + invalid fail-closed)；首次 `evaluator_enabled=true / trial_write_enabled=false / current_phase=evaluating_metrics_only` 7-14 days | 1c |
| 1e | Runbook 完整命令 + metrics_daily.jsonl | 1d |

### Phase 2 — 消费端升级 (3 steps)

| ID | Step | 模式 |
|---|---|---|
| 2a | `trial_write_enabled=true → current_phase=trialing`，7-14 days | 写 trials.jsonl，**不**写 candidate |
| 2b | `policy_crystallizer_v1.mjs` parallel shadow with v0 | shadow only |
| 2c | crystallizer v1 cutover；`current_phase=candidate_writing_sandbox → candidate_writing`；**source_commit_sha MUST be pinned** (D-10) | sandbox/candidate 写，禁 promotion |

### Phase 3 — Sprint 9 readout 后联通

| ID | Step |
|---|---|
| 3a | loamwise SkillReviewQueue PROMOTED 事件 emit 到 governance_event_records (per B-04) |
| 3b | TrustMatrix quarantine 处置决策 (A 复活 / B 重写 / C 合并) — pending readout |

### Phase 4 — execute_limited (data-driven)

11 项前置硬约束（baseline §6）：
1. manifest validator 30 天连续 PASS
2. dedupe 稳定
3. dry_run/sandbox 期 0 重大异常
4. operator_agreement_rate ≥ 0.7 (30d 滚动) [软门槛]
5. critical_false_negative_count = 0 (30d 滚动) [硬 hard gate]
6. kill_switch 演练通过
7. Runbook 完整（含 Phase 4 abort）
8. metrics_daily.jsonl 可追踪
9. ≥ 1 negative learning case 在 production_observed evidence 上验证
10. ADR 已封板
11. Pilot 1 time-bounded non-goal 复审决议（自 v4.1 落盘起 ≥ 90 天，即 ≥ 2026-08-09）

## 10. Risk Register

| ID | Risk | 触发条件 | Mitigation |
|---|---|---|---|
| R-01 | AGE manifest schema migration 破坏现有 CI | Phase 0c 顺序错（先改 manifest 后改 schema） | errata B-02 强制顺序：schema v2 → validate-contracts 双 schema → manifest 迁移 |
| R-02 | discover_new_runs path traversal 攻击 | 恶意/错误 raw_payload_ref 含 `..` 或 symlink escape | errata + baseline §7.1：字符白名单 + canonicalize + realpath 校验 |
| R-03 | duplicate_conflict 误塞 policy quarantine | 实施时混淆 fact 层 vs policy 层 | errata B-05 双落点规则：无 policy_id 仅写 fact_conflicts/，已绑 policy_id 才写 policy_trials.jsonl |
| R-04 | forbidden-name lint 误伤 GHL 自身合法名 | regex 弱化或弃 word-boundary | errata B-03 self-test fixture (must_pass / must_fail) + CI 必跑 |
| R-05 | Phase 1a 时序冲突 Sprint 9 baseline 保护 | emit_fact.py 在 readout 前提交破坏 baseline | errata I-03 + D-14 time-lock：Phase 1a ≥ 2026-05-13Z |
| R-06 | TrustMatrix 处置决策受 Sprint 9 readout 影响 | readout 推迟 / TrustMatrix 复活方向变更 | Phase 3b 标 pending readout；不在 ADR Accept 前决策 |
| R-07 | operator_agreement_rate 与 legacy approval_rate 长期不一致 | confidence_formulas legacy alias 漂移 > 5% | baseline §7.5 evaluator emits warning if values diverge >5% over 30 days |
| R-08 | golden pack stale 影响范围 > 10 个 promoted policy | stale pack 影响面广 | baseline §7.9 + errata：≤10 单条入 drift queue；>10 batch_review 冻结 promotion，不全量入队 |
| R-09 | manifest validator FAIL 后 active source = 0 | 唯一 source (AGE) manifest 失真 | baseline + errata：自动 `current_phase=paused_no_active_source`；emit operator_alert |
| R-10 | Pilot 1 time-bounded non-goal 复审被遗忘 | 90 天后无 trigger | Phase 4 前置条件 11 显式要求复审决议（≥ 2026-08-09） |

## 11. Open Questions

ADR 起草期可保留，但必须在 ADR Accept 前确定方向：

| OQ-ID | Question | Status |
|---|---|---|
| OQ-01 | TrustMatrix post-readout 处置（A 复活 / B 重写 / C 合并到 confidence） | Pending Sprint 9 readout（≥ 2026-05-13Z）；ADR §Open Questions 列出，readout 后做专题决策 |
| OQ-02 | AGE 24 worktree 治理（多 worktree 并行 trial 时 evidence 归一化） | baseline 已加 source_worktree_id + provenance_dirty 字段；ADR §Open Questions 保留运营手册细化 |
| OQ-03 | chaming 接入 GHL 的时序与 fact_emission_path 命名规范 | Pilot 1 Phase 1-2 期间不接入；ADR §Open Questions 标 deferred |
| OQ-04 | confidence_formulas legacy alias 何时 deprecation | Phase 4 后；具体 deprecation date 由 ADR Phase 4 readout 决定 |
| OQ-05 | Phase 2c source_commit_sha pin 的 reset 流程 | learning_sources.yaml `expected_manifest_hash.reset_policy: ADR-required` 已声明；具体 reset workflow 由 ADR §Operations 章节细化 |
| OQ-06 | Phase 0a ADR Accept 后是否立即启动 Phase 0b 还是再加 1 cooling 周 | 倾向立即启动（Phase 0b 是 schema 文件 + lint，不动 runtime）；待 ADR Accept 时确认 |
| OQ-07 | govern/ baseline-protected 路径解冻条件 | Sprint 9 readout 后 governance batch；ADR §Cross-Repo 章节引用 sprint_7_status.md |

---

## Appendix A: ADR 起草节奏（沿用 P1 ADR Doctrine）

P1 ADR 通用节奏：写→停→有条件通过硬补丁+软优化→GO

**ADR-Governed-Heuristic-Learning.md 起草顺序**:

1. **写**: 起草 ADR 全文（基于 baseline + errata + 本 intake pack）
2. **停**: 起草完成后停 24h 不动文件，让审查方独立审
3. **改**: 根据审查 issue 应用 hard patch (blocking) + soft optimization (non-blocking)
4. **GO**: 应用完毕后投票 Accept；Accept 后才启动 Phase 0a 实施

**ADR Accept 后**:
- 进入 baseline §11 Next Step 节奏
- Phase 0a (Doctrine) → Phase 0b (Schemas) → Phase 0c (Manifest) → Phase 0d-0f → Phase 1a (Sprint 9 readout 后)

---

## Appendix B: ADR 应引用的关键资料

ADR 起草时必须 cross-reference：

| Resource | Path |
|---|---|
| Baseline | `liye_os/.planning/baseline/GHL-evolution-plan-v4.1.md` |
| Errata | `liye_os/.planning/baseline/GHL-v4.1-errata.md` |
| Readiness Report | `liye_os/.planning/baseline/GHL-v4.1-readiness-report.md` |
| ADR Intake (this) | `liye_os/.planning/baseline/GHL-v4.1-to-ADR-intake.md` |
| SYSTEMS SSOT | `liye_os/_meta/portfolio/SYSTEMS.md` |
| Existing learning pipeline | `liye_os/_meta/contracts/learning/` + `liye_os/.claude/scripts/learning/` |
| Existing engine manifest schema | `liye_os/_meta/contracts/engine/engine_manifest.schema.yaml` |
| AGE current state | `amazon-growth-engine/engine_manifest.yaml` + `amazon-growth-engine/contracts/step_evaluation_v1.schema.json` + `amazon-growth-engine/eval/autoresearch/scenarios/keyword_kill/regression/` |
| Sprint 9 status | `~/.claude/projects/-Users-liye-github/memory/sprint_7_status.md` |
| Evolution Roadmap | `~/.claude/projects/-Users-liye-github/memory/evolution_roadmap.md` |
| Memory baseline pointer | `~/.claude/projects/-Users-liye-github/memory/project_ghl_baseline.md` |

---

**Authored**: 2026-05-10
**Status**: ADR intake pack ready; ADR draft NOT yet started
**Next**: errata 验收（2026-05-11/12 冷却结束后）→ ADR drafting (写→停→改→GO)
