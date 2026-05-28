# GHL Glossary — Governed Heuristic Learning 术语表

**SSOT**: `_meta/contracts/learning/GHL-glossary.md`
**Normative inputs**: `.planning/baseline/GHL-evolution-plan-v4.1.md` (N-1) + `GHL-v4.1-errata.md` (N-2) + `GHL-v4.1-errata-v2.md` (N-3)
**ADR**: `_meta/adr/ADR-Governed-Heuristic-Learning.md` (Accepted 2026-05-19, commit `67e6fea`)
**Layer**: 0 (liye_os) — governance contract

本文件是 Checkpoint B1 - Phase 0a 的术语 SSOT。所有 GHL 工件命名 / 文档 / lint / runbook 必须遵守本词表；冲突时以最晚 normative input 为准（N-3 > N-2 > N-1）。

---

## 1. 核心理念

| 术语 | 定义 | 反义 / 易混淆 |
|---|---|---|
| **Governed Heuristic Learning (GHL)** | LiYe Systems 多 Layer 多 repo 治理生态下的"复活 + 串联 + 限名 + 守门" 启发式学习方案 | 不是新平台层；不是 single-agent self-evolution |
| **Pilot 1** | 第一阶段试点，**negative learning only**，time-bounded ≥ 90 天（从 baseline 2026-05-09 起，**90 天精确日 = 2026-08-07**；ADR §Decision 写的 2026-08-09 是 operational review target，留 2 天 buffer） | 不是 positive learning；不允许 `production_write` / `execute_limited` |
| **Negative learning** | 系统识别 "unsafe reuse" 候选 → operator 验证 → 形成 `policy_trial` 负面证据 | 不是 reinforcement learning；不自动 promote |
| **复活 (revive)** | 唤醒 `_meta/contracts/learning/` + `.claude/scripts/learning/` 现有 v0.1 管线 | 不是重建新平台 |
| **串联 (connect)** | AGE 显式 emit fact events (D-14) → liye_os importer → evaluator → crystallizer v1 shadow → candidate writing | 不是 single-process pipeline |
| **限名 (name-restrict)** | `forbidden-name lint` (identifier-level, per EV2-B-01) 防止裸 `trial / candidate / trust_score / trust_matrix / evaluator` 跨系统冲突 | 不扫字符串 / enum / 路径 / markdown |
| **守门 (gate-keep)** | `execution_tiers.yaml` 的 `promotion_guardrails` 作为唯一 source of truth | 不是 schema-level gate |

## 2. 数据 / Schema 类型

| 术语 | Schema 文件 | 写入方 | 角色 |
|---|---|---|---|
| **Fact event** | `fact_run_outcome_event_v1.schema.yaml` | AGE (Layer 2) | Source-of-truth event，未经 canonicalization |
| **Fact record** | `fact_run_outcome_record_v1.schema.yaml` | liye_os importer (Layer 0) | Canonical record，allOf event + importer provenance |
| **Event identity key** | 字段在 fact event 内 | AGE | 跨 emit/import 的稳定标识，与 content_hash 一起做双 hash dedupe |
| **Event content hash** | 字段在 fact event 内 | AGE | 内容指纹，event_identity_key 相同但内容变化时触发 conflict |
| **Canonical record hash** | 字段在 fact record 内 | liye_os importer | 入账后的稳定哈希，replay 必须等值 |
| **Event sidecar** (per EV2-I-01) | `<UTC_DATE>/<event_identity_key>.json` (date-sharded) | AGE | 单 event 的 JSON 副本，与 raw payload 概念解耦 |
| **Governance event** | `governance_event_v1.schema.yaml` | loamwise (Layer 1) → liye_os | 治理决策事件（skill_review / lifecycle / trust_matrix），与 fact event 平级（per N-2 B-04） |
| **Policy trial** | `policy_trial_v1.schema.yaml` | liye_os evaluator | System verdict + reason_codes（与 operator_feedback 解耦） |
| **Operator feedback** | `operator_feedback_v1.schema.yaml` | Operator | Operator 反馈结构，独立文件（per N-2 B-05） |
| **Policy lifecycle event** | `policy_lifecycle_event_v1.schema.yaml` | liye_os FSM | **真 append-only**，禁止 in-place mutation；TXN_STARTED / TXN_COMMITTED / TXN_ABORTED |
| **Confidence formulas** | `confidence_formulas.yaml` | liye_os | 4 因素加权（exec / operator / business / regression）公式定义 |
| **Heartbeat state v2** | `heartbeat_state_v2.schema.yaml` | liye_os heartbeat_runner | 7 字段 + 9-phase enum |
| **GHL learned policy** | `learned_policy_ghl_v1.schema.yaml` | liye_os | GHL profile 扩展，不自我声明 promotion eligibility |

## 3. Heartbeat 9-phase enum (per D-06)

| Phase | 含义 |
|---|---|
| `paused` | 完全停用 |
| `paused_no_active_source` | 无 active source（registry 空） |
| `ingesting_only` | 仅 importer 跑，evaluator/writer 关闭 |
| `evaluating_metrics_only` | evaluator 跑但 trial_write_enabled=false（dry_run） |
| `trialing` | trial_write_enabled=true，写 policy_trials.jsonl |
| `candidate_writing_sandbox` | 写 candidate to sandbox 路径 |
| `candidate_writing` | 写 candidate to 正式 candidate 目录 |
| `promoting` | 进入 promotion gate |
| `executing_limited` | `execute_limited` tier 允许（Phase 4 后） |

## 4. Operator Feedback enum (per N-1 §7.6 + D-12)

| Enum value | 含义 | 是否计入 negative evidence |
|---|---|---|
| `AGREE_WITH_SYSTEM` | Operator 同意系统 verdict | 计入 agreement_rate 分子 |
| `DISAGREE_WITH_SYSTEM` | Operator 不同意系统 verdict | 计入 agreement_rate 分母不分子 |
| `NEEDS_MORE_EVIDENCE` | 证据不足，挂起 | 不计入 agreement_rate |

**`NEEDS_HUMAN` system verdict 算 negative evidence 的限制条件** (per D-12)：仅当 `system_verdict_reason_codes` 包含 `{unsafe_reuse, regression_failed, business_context_changed}` 之一时计入。

## 5. 关键 Operator 指标 (per D-11)

| 指标 | 阈值 | 类型 |
|---|---|---|
| `operator_agreement_rate` | ≥ 0.7 | **软**门槛 |
| `critical_false_negative_count` | = 0 | **硬**门槛 |

## 6. Conflict / Duplicate 落点 (per D-13 + B-05)

| 情形 | 落点 |
|---|---|
| Importer-only conflict（无 policy_id） | `state/runtime/learning/fact_conflicts/<source_system>/<event_identity_key>/`（original.json + incoming.json + conflict_meta.yaml） |
| Conflict + 已绑定 policy_id | fact_conflicts/ 仍写；**额外** `policy_trial_v1` (system_verdict=NEEDS_HUMAN, reason_codes=[duplicate_conflict]) 写 `policy_trials.jsonl` |

**禁止**：把所有 duplicate conflict 都硬塞进 policy_trials.jsonl。

## 7. 关键 Runtime 路径

| 路径 | 用途 | 来源 |
|---|---|---|
| `liye_os/state/memory/facts/fact_run_outcomes.jsonl` | v0.1 legacy（frozen on Phase 1b） | EV2-I-02 事实修正 |
| `liye_os/state/memory/facts/fact_run_outcome_records.jsonl` | v4.1 canonical record（Phase 1b 新写入） | N-2 I-02 |
| `liye_os/state/memory/governance/governance_event_records.jsonl` | Governance event records | N-2 B-04 |
| `liye_os/state/runtime/learning/fact_conflicts/<source>/<event_identity_key>/` | Importer duplicate conflicts | D-13 + N-2 B-05 |
| `liye_os/state/runtime/learning/policy_trials.jsonl` | Policy trial outputs | N-1 |
| `liye_os/state/runtime/learning/policy_lifecycle_events.jsonl` | Lifecycle FSM events（append-only with transaction_id） | D-09 |
| `amazon-growth-engine/out/facts/<UTC_DATE_FROM_emitted_at>/fact_run_outcome_events.jsonl` | AGE daily fact events log（date-sharded UTC） | EV2-I-01 |
| `amazon-growth-engine/out/facts/<UTC_DATE_FROM_emitted_at>/<event_identity_key>.json` | AGE event sidecar | EV2-I-01 |
| `amazon-growth-engine/scripts/learning/emit_fact.py` | AGE fact emission entry | D-14 |

## 8. 8 Hard Gates (ADR §"Hard Gates" restatement)

1. **不引入新 Trust 系统**（已有 TrustScoreStore EMA / TrustMatrix quarantined / TrustLevel enum）
2. **不引入新 Lifecycle FSM**（已有 validation_status / SkillLifecycleState / SkillReviewQueue）
3. **不引入新 Candidate 类型**
4. **Layer-2 (AGE) 不直接写 Layer-0 (liye_os)**（必须通过 fact pull importer）
5. **任何接入的 source 必须通过 manifest reality validator**（Phase 0c `validate_manifest_reality.py`）
6. **fact ingest 必须双 hash 幂等**（`event_identity_key` + `event_content_hash`，per N-1 §7.1）
7. **heartbeat 首次启动必须 dry_run**（`evaluator_enabled=true / trial_write_enabled=false → current_phase=evaluating_metrics_only`）
8. **Pilot 1 期间无 production_write，无 execute_limited**

## 9. 禁用 / 易混淆术语

| 不要用 | 用这个 |
|---|---|
| `trial` (裸标识符) | `policy_trial` |
| `candidate` (裸标识符) | `policy_candidate` / `skill_candidate`（看上下文） |
| `trust_score` / `trust_matrix` (裸标识符) | 引用现有系统命名 |
| `evaluator` (裸标识符) | `policy_trial_evaluator` |
| `confidence` (新 GHL formula source 输入) | `confidence_basis.*`（per P-01）。**legacy `learned_policy.confidence` (root 字段，per `_meta/contracts/learning/learned_policy.schema.yaml`) 保留**，不在 0f lint 范围内 |
| `success_signals.operator.approval_rate` | `operator_agreement_rate`（legacy alias 保留，per P-01） |
| `shadow_learning` (字段名) | 用 heartbeat orthogonal 字段表达（per D-03） |
| `learned_policy_v2` (schema 名) | `learned_policy_ghl_v1`（per D-01） |
| `production_write` (Pilot 1 期) | 禁用 |
| `execute_limited` (Pilot 1 期) | 禁用 |

## 10. Cross-references

| Concept | Source-of-truth |
|---|---|
| 14 Decision Log (D-01 ~ D-14) | N-1 §8 + N-2 §7 |
| 15 Required Corrections | N-2 §8 (9) + N-3 §9 (6) |
| 8 Hard Gates | ADR §"Hard Gates" |
| 9 schema files (Phase 0b) | ADR §"Schema Deltas" + 本词表 §2 |
| engine_manifest schema v2 | N-2 §3 B-02 + `_meta/contracts/engine/engine_manifest.schema.v2.yaml` |
| Phase 0c 4-step sequence | N-2 §3 B-02 + N-3 §6.3 |

---

**Version**: 1.0.0
**Authored**: 2026-05-19
**Status**: Active (post-ADR-Accept)
**Next review**: Phase 0b 9 schemas 全部就位后做一致性 cross-check
