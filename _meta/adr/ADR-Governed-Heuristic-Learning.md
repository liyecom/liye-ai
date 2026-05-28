---
artifact_scope: meta
artifact_name: Governed-Heuristic-Learning
artifact_role: contract
target_layer: cross
is_bghs_doctrine: no
---

# ADR — Governed Heuristic Learning (GHL)

**Status**: Accepted
**Date**: 2026-05-14
**Accepted-Date**: 2026-05-19
**Decision Makers**: LiYe
**SSOT**: `_meta/adr/ADR-Governed-Heuristic-Learning.md`
**References**:
- `_meta/adr/ADR-Architecture-Doctrine-BGHS-Separation.md` (必读前置 — BGHS 四分法)
- `_meta/portfolio/SYSTEMS.md` (系统级 SSOT — Layer 0/1/2/3 与依赖)
- `_meta/adr/ADR-005-Hermes-Skill-Lifecycle.md` (P1-b — lifecycle FSM 现状)
- `_meta/adr/ADR-Loamwise-Guard-Content-Security.md` (P1-d — P3 governance 现状)

**Normative Inputs** (per errata-v2 §8 EV2-N-01):
- **N-1**: `.planning/baseline/GHL-evolution-plan-v4.1.md` (frozen baseline, 663 lines @ 2026-05-09)
- **N-2**: `.planning/baseline/GHL-v4.1-errata.md` (errata-v1, 635 lines @ 2026-05-10)
- **N-3**: `.planning/baseline/GHL-v4.1-errata-v2.md` (errata-v2, 488 lines @ 2026-05-14)

Conflict resolution: N-3 > N-2 > N-1. Any ADR clause conflicting with the latest normative input is amended on the ADR side, not the input side.

**Supporting References** (not normative, per EV2-N-01):
- S-1: `.planning/baseline/GHL-v4.1-readiness-report.md` (10-item read-only audit @ 2026-05-10)
- S-2: `.planning/baseline/GHL-v4.1-to-ADR-intake.md` (ADR drafting checklist @ 2026-05-10)

**Commit anchor**: normative inputs (N-1, N-2, N-3) and supporting references (S-1, S-2) are landed by this PR as the GHL v4.1 baseline; their paths above are the canonical references. The post-squash merge commit on `liye_os/main` becomes the durable anchor; no pre-squash SHA is normative.

---

## Context

LiYe Systems 已经在 `_meta/contracts/learning/` 与 `.claude/scripts/learning/` 部署了 v0.1 学习管线（schema、policy_crystallizer_v0、heartbeat_runner、build-learned-bundle 等共 8 个模块），但因长期缺少真实业务事实输入而休眠 ── 当前 `state/runtime/proactive/heartbeat_learning_state.json` 标 `enabled: false`，最后运行时间停留在 `2026-02-14`。

与此同时，Layer-2 域引擎 AGE 持续产出大量 evaluation / inference / regression replay artifacts（`verification.json` / `policy_suggestions.json` / `step_evaluation_v1` / `regression/keyword_kill/*.yaml` 等），其中蕴含可学习的策略信号 ── 但这些事实未进入 liye_os 学习食物链。

Jiayi Weng "Learning Beyond Gradients"（OpenAI 研究院）提出了 coding-agent-as-learner 范式（trials.jsonl + regression + simplification），证明在小规模 agent 系统内通过纯文本启发式即可实现可观测的能力提升。但其假设是单 agent 自我进化；LiYe 是多 Layer 多 repo 治理生态，简单照搬会破坏 SYSTEMS.md 依赖方向、与已有 trust/lifecycle/candidate 系统形成命名碰撞。

**本 ADR 萃取 HL 的学习闭环骨架，用来唤醒 v0.1 管线 + 串联 AGE 事实流，但不重建新平台，不引入新治理范畴**。

### 上游核心做法（Jiayi Weng HL）

1. **trials.jsonl** — agent 每次尝试记录三元组（输入 / 行动 / verdict）
2. **policy distillation** — 从 trials 中抽取启发式规则
3. **regression pack** — 用 frozen 测试集守门，新规则上线必须不破坏旧任务
4. **simplification** — 启发式规则要简洁可读，否则迭代不可持续

### 吸收什么

| HL 模式 | LiYe 落地形式 |
|---|---|
| trials.jsonl | `state/runtime/learning/policy_trials.jsonl` (v4.1 schema `policy_trial_v1`) |
| policy distillation | 复活 `policy_crystallizer_v0` + 并行 v1 shadow (Phase 2b) |
| regression pack | AGE `eval/autoresearch/scenarios/keyword_kill/regression/*.yaml` 已存在；加 `golden_packs.yaml` registry |
| simplification | confidence_formulas.yaml 用 4 因素加权（exec/operator/business/regression），可读可解释 |
| pilot 1 = negative learning | 系统识别 "unsafe reuse"，operator 验证；**不**做自动 bid 优化 |

### 不吸收什么

| HL 假设 | 为什么拒绝 |
|---|---|
| 单 agent 自我闭环 | LiYe 跨 4 Layer，Layer-2 不直接写 Layer-0（SYSTEMS.md 依赖方向） |
| trial 即 candidate | LiYe 已有 SkillCandidate / learned_policy.validation_status=candidate / SkillReviewQueue 三套候选体系，再叠加会命名碰撞 |
| evaluator 自动 promote | promotion 必须经 governance gate (execution_tiers + operator review) |
| 全自动迭代 | Pilot 1 = negative learning only, time-bounded ≥ 90 天，期间无 production_write |

## Decision

LiYe Systems 实施 **Governed Heuristic Learning (GHL)** 进化方案，按以下原则：

### 核心 4 项原则

1. **复活**：唤醒 `_meta/contracts/learning/` + `.claude/scripts/learning/` 现有 v0.1 管线，**不**新建平台层
2. **串联**：AGE 显式 emit fact events (D-14) → liye_os importer 按 v4.1 canonical schema 入账 → evaluator 输出 policy_trial → crystallizer v1 shadow → candidate writing (sandbox→candidate)
3. **限名**：forbidden-name lint (identifier-level, per errata-v2 EV2-B-01) 防止裸 `trial / candidate / trust_score / trust_matrix / evaluator` 跨系统冲突
4. **守门**：execution_tiers.yaml 的 promotion_guardrails 唯一源（allowed/required evidence origins + negative_evidence_guardrail + data_safety_gates）

### 战略约束 3 项

- **Pilot 1 = negative learning only**（time-bounded ≥ 90 天 from baseline 2026-05-09，即 ≥ 2026-08-09）
- **AGE → liye_os 通过显式 fact emission**（D-14 选 A，拒绝 importer 反向适配 AGE 内部 trace 目录）
- **ADR Accept 与 Sprint 9 readout 双门槛**：ADR Accept 只解锁 Phase 0a-0f；Phase 1a 需 Sprint 9 readout (≥ 2026-05-13Z) 才能启动

## Hard Gates（8 条，治理不变量）

1. **不引入新 Trust 系统**（已有 TrustScoreStore EMA / TrustMatrix quarantined / TrustLevel enum）
2. **不引入新 Lifecycle FSM**（已有 validation_status / SkillLifecycleState / SkillReviewQueue）
3. **不引入新 Candidate 类型**
4. **Layer-2 (AGE) 不直接写 Layer-0 (liye_os)**（必须通过 fact pull importer）
5. **任何接入的 source 必须通过 manifest reality validator**（Phase 0c `validate_manifest_reality.py`）
6. **fact ingest 必须双 hash 幂等**（`event_identity_key` + `event_content_hash`，per N-1 §7.1）
7. **heartbeat 首次启动必须 dry_run**（`evaluator_enabled=true / trial_write_enabled=false → current_phase=evaluating_metrics_only`）
8. **Pilot 1 期间无 production_write，无 execute_limited**

## 与 LiYe Systems 分层与 BGHS 的映射

### Layer 归属

| GHL 工件 | Layer | 角色 |
|---|---|---|
| schemas (9 学习 schema + engine_manifest.schema.v2) | Layer 0 (liye_os) | Governance contract |
| importer (`discover_new_runs.mjs`) | Layer 0 (liye_os) | Hands |
| evaluator (`policy_trial_evaluator.mjs`) | Layer 0 (liye_os) | Brain |
| crystallizer v1 (`policy_crystallizer_v1.mjs`) | Layer 0 (liye_os) | Brain |
| heartbeat_runner | Layer 0 (liye_os) | Session orchestrator |
| `emit_fact.py` | Layer 2 (AGE) | Hands (source emitter) |
| governance_event_v1 events | Layer 1 (loamwise) → Layer 0 | Session (cross-Layer event log) |
| manifest reality validator | Layer 0 (liye_os) | Governance |

### BGHS 分类

| BGHS | GHL 体现 |
|---|---|
| **Brain** (model-contingent harness) | evaluator / crystallizer v1 (可换实现，不可换 contract) |
| **Governance** (model-independent invariants) | 9 schemas + execution_tiers.yaml promotion_guardrails + 8 Hard Gates |
| **Hands** (tools / executors / adapters) | importer / emit_fact / lint / validate_manifest_reality |
| **Session** (durable event log + replay contract) | fact_run_outcome_records.jsonl + governance_event_records.jsonl + policy_lifecycle_events.jsonl |

## Decision Log（D-01 ~ D-14，全部封板）

继承 N-1 §8 (D-01 ~ D-13) + N-2 §7 (D-14)。本 ADR 不重新列；冲突时以 N-1/N-2/N-3 为准。摘要：

| # | 决议 | 来源 |
|---|---|---|
| D-01 | schema 命名 `learned_policy_ghl_v1` | N-1 |
| D-02 | Pilot 1 = negative learning only, time-bounded ≥ 90d | N-1 |
| D-03 | 拒绝 `shadow_learning`，用 orthogonal heartbeat 字段 | N-1 |
| D-04 | crystallizer v1 → Phase 2b shadow + 2c cutover | N-1 |
| D-05 | Phase 顺序: evaluator+writer (1c) 先于 heartbeat dry_run (1d) | N-1 |
| D-06 | heartbeat 7 字段（含 evaluator_enabled + trial_write_enabled） | N-1 |
| D-07 | manifest validator FAIL = soft fail (单 source 禁用) | N-1 |
| D-08 | quarantine 选 C (status + 物理移动 + lifecycle ledger + redirects) | N-1 |
| D-09 | policy_lifecycle_events.jsonl 纳入 Phase 0b | N-1 |
| D-10 | source_commit_sha 在 Phase 2 必须 pin concrete SHA | N-1 |
| D-11 | operator_agreement_rate ≥ 0.7 (软) + critical_false_negative_count = 0 (硬) | N-1 |
| D-12 | NEEDS_HUMAN 算 negative evidence 仅当 reason_code ∈ {unsafe_reuse, regression_failed, business_context_changed} | N-1 |
| D-13 | duplicate conflict 写独立 `state/runtime/learning/fact_conflicts/` | N-1 |
| **D-14** | **AGE → liye_os fact 流 = A 显式 emit_fact.py；Phase 1a time-locked ≥ Sprint 9 readout** | **N-2** |

## Schema Deltas

继承 N-1 §7 + N-2 §5 + N-3 §6.2，本 ADR 不重复字段定义。**Phase 归属**（per N-3 EV2-I-03 锁定）：

### Phase 0b — Learning schemas only (9 文件)

1. `learned_policy_ghl_v1.schema.yaml`
2. `fact_run_outcome_event_v1.schema.yaml`
3. `fact_run_outcome_record_v1.schema.yaml` (with N-2 B-01 fix on required)
4. `governance_event_v1.schema.yaml` (N-2 B-04)
5. `policy_trial_v1.schema.yaml` (N-2 B-05)
6. `operator_feedback_v1.schema.yaml` (N-2 B-05 拆出独立)
7. `policy_lifecycle_event_v1.schema.yaml` (D-09)
8. `confidence_formulas.yaml`
9. `heartbeat_state_v2.schema.yaml`

Plus: validate-contracts.mjs 扩展以扫上述 9 schema。

### Phase 0c — Engine manifest reality (4 步序列，per N-3 §6.3)

```
0c.1: 新增 engine_manifest.schema.v2.yaml
0c.2: 扩展 validate-contracts.mjs 支持双 schema 路由
0c.3: AGE 迁移 engine_manifest.yaml 到 v2.0 (gated on Sprint 9 readout per D-14)
0c.4: 新建 validate_manifest_reality.py
```

兼容期：schema v1.x 30 天 ≥ 必须保留 `write_capability` 作为 deprecated_but_accepted；v2.1 (Phase 4 后) 才移除。

## Rollout Phases

继承 N-1 §2–6 + N-3 §6.2 phase 边界。Phase 摘要：

| Phase | Workstreams / Steps | Gating |
|---|---|---|
| 0a Doctrine | 本 ADR 自身 + Glossary + 8 Hard Gates | This ADR draft → 24h cooling → Accept |
| 0b Schemas | 9 learning schemas + validate-contracts 扩展 | ADR Accept |
| 0c Manifest reality | 4-step sequence (schema v2 → router → AGE migration → validator) | ADR Accept; **step 0c.3 + 0c.4 gated on Sprint 9 readout** |
| 0d Registries | learning_sources.yaml (含 allowed_branches + expected_manifest_hash, per N-2 I-01) + golden_packs.yaml | ADR Accept |
| 0e Operability | GHL-RUNBOOK.md 7-section skeleton | ADR Accept |
| 0f Hygiene | lint_forbidden_names.sh (identifier-level, per N-3 EV2-B-01) + self-test fixture + CI 接入 | ADR Accept |
| 1a–1e Data food chain | AGE emit_fact → importer upgrade → evaluator+writer → heartbeat v2 dry_run → Runbook 完整命令 | **Sprint 9 readout (≥ 2026-05-13Z)** |
| 2a–2c Consumption | trialing → crystallizer v1 shadow → candidate writing (sandbox→candidate) | Phase 1e complete + dry_run 7-14 days clean |
| 3a–3b Integration | loamwise governance_event_v1 emission + TrustMatrix disposition | Sprint 9 readout + OQ-01 / Phase 3b TrustMatrix disposition decision (per Open Questions §OQ-01) |
| 4 execute_limited | Data-driven gate (11 pre-conditions) | All Phase 0-3 + 11 hard pre-conditions |

## Required Corrections Before Accept

继承 N-2 §8 (9 项) + N-3 §9 (6 项扩展) = **15 项**。ADR Accept 前 reviewer 必须确认全部 15 项已在 normative inputs 内沉淀（实施不要求）：

**errata-v1 §8** (9 项, from Codex audit round 5):
1. B-01: `fact_run_outcome_record_v1` required 改纯字符串列表
2. B-02: `engine_manifest.schema.v2.yaml` + validate-contracts 双 schema 路由 + 兼容期 ≥ 30 天
3. B-03: lint word-boundary regex + diff-only first + self-test fixture
4. B-04: `governance_event_v1` 与 fact_event 平级，双流入账
5. B-05: `policy_trial_v1` + `operator_feedback_v1` 解耦，duplicate_conflict 双落点
6. I-01: `learning_sources.yaml` 补 `allowed_branches` + `expected_manifest_hash`
7. I-02: canonical record path 固定 `state/memory/facts/fact_run_outcome_records.jsonl`
8. I-03: D-14 选 A，Phase 1a ≥ Sprint 9 readout
9. I-04: 9 phase enum，不硬数工件

**errata-v2 §9** (6 项, from Codex audit round 6):
10. EV2-B-01: lint 改 identifier-level + declaration patterns + fixture 重写
11. EV2-I-01: date-sharded UTC log + event sidecar 术语
12. EV2-I-02: legacy path 修正为 `state/memory/facts/fact_run_outcomes.jsonl`
13. EV2-I-03: engine_manifest migration 锁定 Phase 0c (Phase 0b 仅 9 learning schemas)
14. EV2-W-01: evidence wording 精确化（"无 tracked diff" 替代"零写入"）
15. EV2-N-01: ADR normative inputs (N-1/N-2/N-3) vs supporting references (S-1/S-2) 规则

## Risk Register

继承 S-2 §10 (10 项)。ADR Reviewer 必须读 S-2 §10 表，本 ADR 不重复列。摘要风险类别：

| 类别 | Risk IDs (per S-2) |
|---|---|
| Phase 顺序冲突 | R-01 (AGE manifest migration 破坏 CI), R-05 (Phase 1a 时序冲突 Sprint 9) |
| 安全边界 | R-02 (path traversal), R-04 (lint 误伤 GHL 自身) |
| Schema 一致性 | R-03 (duplicate_conflict 误塞 policy quarantine) |
| 跨系统协调 | R-06 (TrustMatrix 处置 pending readout), R-09 (active source = 0) |
| Long-term drift | R-07 (operator_agreement_rate vs legacy approval_rate 漂移), R-10 (Pilot 1 time-bound 遗忘) |
| Promotion gate | R-08 (golden pack stale 大面积影响) |

## Open Questions

继承 S-2 §11 (7 项) + 本 ADR 新增 1 项 (per N-3 EV2-B-01 §3.4):

| OQ-ID | Question | Status |
|---|---|---|
| OQ-01 | TrustMatrix post-readout 处置 (A 复活 / B 重写 / C 合并) | Pending Sprint 9 readout |
| OQ-02 | AGE 24 worktree 治理 | Deferred to operations runbook |
| OQ-03 | chaming 接入 GHL 时序 | Deferred to post-Pilot 1 |
| OQ-04 | confidence_formulas legacy alias deprecation date | Phase 4 readout 决定 |
| OQ-05 | source_commit_sha pin reset workflow | ADR §Operations 章节细化（Phase 0a 末写） |
| OQ-06 | Phase 0b 启动是否再加 1 cooling 周 | 倾向立即启动（不动 runtime） |
| OQ-07 | govern/ baseline-protected 路径解冻 | Sprint 9 readout governance batch |
| **OQ-08** | **CamelCase 裸 identifier 是否进入 Phase 0f 第一 pilot** | **Deferred；Phase 0f-extended 或 Phase 2 用 ast-grep 处理** |

## Non-goals

继承 N-1 §10 + N-2 §9 + N-3 §10。GHL-specific non-goals 重申：

- 不重建新学习平台
- 不引入新 trust / lifecycle / candidate 系统
- 不让 Layer-2 直接写 Layer-0
- 不在 Pilot 1 期做自动 bid 优化
- 不在 Pilot 1 期允许 production_write 或 execute_limited
- 不把 BGHS 做成新平台层或目录结构

SYSTEMS-level non-goals 继承 evolution_roadmap.md。

## Adoption Checkpoints

### Checkpoint A — ADR Accept 准入

- [x] 15 项 Required Corrections 全部已在 N-1/N-2/N-3 内沉淀（reviewer 验证）
- [x] ADR draft 写完后停 24h（沿用 P1 ADR Doctrine 节奏）
- [x] Reviewer 阅读 N-1 + N-2 + N-3 三个 normative inputs（S-1 + S-2 为参考）
- [x] Reviewer 签字接受
- [x] ADR Status 由 Proposed → Accepted

### Checkpoint B1 — Phase 0 partial（ADR Accept 后允许，不依赖 Sprint 9 readout）

- [ ] 0a: 本 ADR Accepted
- [ ] 0b: 9 learning schemas + validate-contracts 扫描全过（liye_os repo only）
- [ ] 0c.1: `engine_manifest.schema.v2.yaml` committed（liye_os repo only，不动 AGE）
- [ ] 0c.2: `validate-contracts.mjs` 双 schema 路由实施（liye_os repo only）
- [ ] 0d: `learning_sources.yaml` + `golden_packs.yaml` committed
- [ ] 0e: GHL-RUNBOOK.md 7-section skeleton 就位
- [ ] 0f: `lint_forbidden_names.sh` + self-test must_pass/must_fail 全过 + CI 接入

### Checkpoint B2 — Phase 0 complete（解锁 Phase 1，gated on Sprint 9 readout）

- [ ] Checkpoint B1 全部 done
- [ ] Sprint 9 readout 签发（≥ 2026-05-13Z）
- [ ] 0c.3: AGE `engine_manifest.yaml` 迁移到 v2.0（gated on D-14 时序）
- [ ] 0c.4: `validate_manifest_reality.py` 实施 + CI 接入（依赖 0c.3 完成，per N-3 §6.3 顺序约束）

### Checkpoint C — Phase 1 完成（解锁 Phase 2）

- [ ] Checkpoint B2 全部 done
- [ ] 1a: AGE emit_fact.py 部署 + 写入 date-sharded UTC log + event sidecar
- [ ] 1b: importer 升级，双 hash dedupe 稳定，0 path traversal alert
- [ ] 1c: evaluator 输出 policy_trials.jsonl
- [ ] 1d: heartbeat v2 进入 `evaluating_metrics_only` phase 7-14 天清洁
- [ ] 1e: RUNBOOK 完整命令验证通过

### Checkpoint D — Phase 4 准入（11 hard pre-conditions）

继承 N-1 §6（11 项），其中 D-11 已包含 `critical_false_negative_count = 0` hard gate；本 ADR 不新增。

## Appendix A: Audit Chain

| 轮 | Date | 主审 | 输入 | 输出 |
|---|---|---|---|---|
| 1 | 2026-05-09 | cc | (HL 论文 + codex 草案) | v3.0 (now `archive/GHL-evolution-plan-v3-superseded.md`) |
| 2 | 2026-05-09 | ChatGPT | v3.0 | v4.0 (GHL 立名 + Pilot 1 negative) |
| 3 | 2026-05-09 | ChatGPT | v4.0 | v4.1 (event/record 拆分 + Phase 顺序) |
| 4 | 2026-05-09 | ChatGPT | v4.1 | v4.1-final (heartbeat 7 字段 + agreement_rate + append-only ledger) |
| 5 | 2026-05-10 | Codex ground-truth | v4.1.md (落盘) | errata-v1 (5 blocking + 4 important + D-14) |
| 6 | 2026-05-10 | Codex ground-truth | v4.1 + errata-v1 (落盘) | errata-v2 (6 项二次修订) |

## Appendix B: Cross-references

| 文件 | 角色 | Path |
|---|---|---|
| N-1 baseline | Normative input | `.planning/baseline/GHL-evolution-plan-v4.1.md` |
| N-2 errata-v1 | Normative input | `.planning/baseline/GHL-v4.1-errata.md` |
| N-3 errata-v2 | Normative input | `.planning/baseline/GHL-v4.1-errata-v2.md` |
| S-1 readiness | Supporting reference | `.planning/baseline/GHL-v4.1-readiness-report.md` |
| S-2 ADR intake | Supporting reference | `.planning/baseline/GHL-v4.1-to-ADR-intake.md` |
| Sprint 9 plan | External dependency | `loamwise/.planning/acceptance/sprint-9-window-plan.md` |
| Sprint 9 baseline | External dependency | `loamwise/feat/p3-governed-learning-loop @ 3df1435` |
| AGE current manifest | External dependency | `amazon-growth-engine/engine_manifest.yaml` |
| Existing learning pipeline | Internal | `liye_os/_meta/contracts/learning/` + `.claude/scripts/learning/` |
| Existing engine manifest schema | Internal | `liye_os/_meta/contracts/engine/engine_manifest.schema.yaml` (v1.x) |

---

## ADR Lifecycle

This document has completed the P1 ADR Doctrine "写→停→改→GO" rhythm and is now Accepted:

- **2026-05-14**: ADR drafted (Status: Proposed) — 写
- **2026-05-14 → 2026-05-16**: First 24h cooling — 停
- **2026-05-16**: Round 7 (cc independent review) — 5 patches applied on ADR draft only (NOT 回改 baseline/errata)：artifact_role contract / commit anchor 6 files / OQ-01 disposition reference / Checkpoint B1+B2 拆分 / D-11 继承 — 改
- **2026-05-16 → 2026-05-17**: Second 24h cooling — 停
- **2026-05-19**: Final delta review (cc internal) — 无新 hard finding；Round 8 外部 reviewer 价值不足以抵其延迟，跳过 — GO
- **Now (post-Accept)**: 进入 Checkpoint B1 scope（Phase 0a + 0b + 0c.1 + 0c.2 + 0d + 0e + 0f，与 Sprint 9 解耦）
- **Pending Sprint 9 readout (Checkpoint B2)**: Phase 0c.3 + 0c.4
- **Pending Sprint 9 readout + Phase 0 complete (Checkpoint C)**: Phase 1a-1e

---

**Authored**: 2026-05-14
**Accepted**: 2026-05-19
**Status**: Accepted
