---
artifact_scope: meta
artifact_name: Learning-Fact-Artifact-Type-Taxonomy
artifact_role: contract
target_layer: 0
is_bghs_doctrine: no
---

# ADR — Learning Fact `artifact_type` 分类边界：通用 `write_outcome` 类（CBU write/execution receipts）

> 文件名采非数字前缀（`ADR-Learning-Fact-Artifact-Type-Taxonomy.md`）以进入 CI-wired BGHS frontmatter gate（`adr-bghs-gate.yml`）的有效扫描域。

**Status**: Accepted
**Date**: 2026-06-14
**Accepted-Date**: 2026-06-14
**Decision Makers**: LiYe
**SSOT**: 本文件（artifact_type 分类教条）；schema SSOT = `_meta/contracts/learning/fact_run_outcome_event_v1.schema.yaml`（canonical）；AGE 端为 byte-pinned vendored copy
**References**:
- N-1（Normative）: `_meta/contracts/learning/fact_run_outcome_event_v1.schema.yaml` —— `artifact_type` enum（实测落点：本 PR 前为 4 值 `verification_json / policy_suggestions_json / step_evaluation_instance / regression_replay_result`）；`event_identity_key` description 实证 `artifact_type` ∈ 8-key identity 原像；`event_content_hash` 排除集 = `[emitted_at, raw_payload_summary.metric_formatting_hint]`（**`raw_payload_summary.action_kind` 进 content hash，不进排除集**）
- N-2（Normative）: `_meta/contracts/learning/fact_run_outcome_record_v1.schema.yaml` —— `artifact_type` 为**展开副本（非 $ref）**；文件头 line-15 维护契约「本文件 event 字段必须与 event_v1 保持同步」 → enum 拓宽**必须双改**，否则 importer record-validate（`import_facts.mjs:489`）拒
- N-3（Normative）: `.claude/scripts/learning/import_facts.mjs` —— `buildValidators()`（:141，ajv `strict:false, validateFormats:false`，匹配 Python jsonschema 默认）双 schema compile；三关 S1 event-validate（:402）/ S1b NUMERIC_NOT_STRING（:411，`raw_payload_summary` 内任意 native number 即拒，Pilot 1 string-encode-all）/ record-validate（:489）
- N-4（Normative）: `src/reasoning/policy_trial_evaluator.mjs` —— `artifact_type` 仅两处 handling 且均**无 unknown-value throw/allowlist**：`deriveEvidenceOrigin`（:302）`regression_replay_result`→`golden_regression`，**else→default `production_observed`**（write_outcome 落此）；records-scan（:558）仅 `policy_suggestions_json` 驱动 artifact-deref，余者 `continue`（write_outcome 无 deref）
- N-5（Normative）: `_meta/contracts/scripts/validate-contracts.mjs:511-536` —— schema 校验逐项 `logPass` over `schemaFiles[]`（显式 16-entry 数组）。**21 是全局 Summary pass 计数**（= 2 SSOT-ish + 16 schemas + 1 formula instance + 2 policy instances），非数组长度。本决策**编辑既有数组成员的 enum 值、不新增数组 entry** → schema-pass 计数与全局总数皆**零变化（守 21）**；`validateContractSchemas` 仅 parse YAML + 查 `$schema/$id/required` 在场，不做 instance 校验
- S-1（Supporting）: 2026-06-14 CBU fact artifact_type micro-discuss（`wf_0b114a29`，critic verdict ISSUES_FOUND：`generic_is_lossless=true` / `would_break_importer=false`，3 minor 已 fold 入本 ADR）；先行 AGE #403 activation-readiness audit v2（`wf_526da5e9`，`BLOCKED_BY_KNOWN_SEAM`）确立两门模型 —— 承重事实以本 ADR 逐项 file:line 实测为准，非以 workflow 自证
**Commit anchor**: 对齐 ADR-GHL 教条「the post-squash merge commit becomes the durable anchor; no pre-squash SHA is normative」。**Accept≠merge**：Accept 时 anchor=pending（承载本 ADR 的 liye_os schema/ADR PR 仍 open，frontmatter 不预编 SHA）；PR squash-merge 后回填 post-squash merge SHA 为 durable anchor（docs-only follow-up）。

---

## Context

GHL A 主线已 build-complete，撞 activation 墙：唯一缺口是「首条 APPLIED production CBU fact 进 learning 流」（见 AGE #403 / audit v2 两门模型 —— Door1 APPLIED 物理写代码完整、Door2 fact-into-stream seam 缺）。在动任何 AGE wiring 之前，必须先把「write/execution receipt 映射成 fact」后那条 fact 的**输出形状**钉死，否则后续所有 CBU wiring 会各自发明 artifact_type，污染 8-key identity 空间。

`artifact_type` 是 `event_identity_key = sha256(source_system + source_repo + trace_id + artifact_type + artifact_path + playbook_ref + step_id + source_commit_sha)` 的 **8 个 locked 输入之一**（N-1）。因此「为每种写动作（CBU / keyword-bid / …）铸 per-kind artifact_type 值」会 fork identity 空间，且复活已被否决的「CBU 专属 enum」反模式。

## Decision

新增**一个通用 enum 值** `write_outcome`，作为「write/execution receipt → fact」类（与现有 eval/inference/replay 同级，非 CBU 专属，可被未来任意 receipt→fact 写路径复用）：

1. `fact_run_outcome_event_v1.artifact_type.enum` **+`write_outcome`**（canonical SSOT, N-1）。
2. 具体动作种类 → `raw_payload_summary.action_kind`（free-string，**复用 AGE execution 侧词表**如 `CAMPAIGN_BUDGET_UPDATE` / `SP_KEYWORD_BID_UPDATE`，**不在 fact schema 内铸第 4 份枚举副本**）。
3. `schema_version` **维持 const `"1.0.0"`** —— enum 拓宽是 JSON-Schema 加性、向后兼容（既有 4 值 fact 仍 valid，identity/content-hash 算术不变），无须真 bump；本微 ADR 即满足 producer 自施的「schema 改动需 ADR」policy。
4. `artifact_type.description` doctrine 从「Restricted to AGE evaluation/inference/replay artifacts」扩成「+ execution/write outcomes」。治理决策（PROMOTED/DEMOTED/lifecycle/trust_matrix）**仍走 `governance_event_v1`**（不混入 write_outcome）。

### 决策成立的关键机制（lossless 证明）

`event_content_hash` 排除集仅 `[emitted_at, raw_payload_summary.metric_formatting_hint]`（N-1）。`raw_payload_summary.action_kind` **不在排除集 → 进 content fingerprint**。故：
- **identity** 由通用 `write_outcome` + 其余 7 key 唯一化（不因 kind 细分而 fork）；
- **content** 由 `action_kind` 保真 → 不同写动作产不同 content hash → D-13 duplicate-vs-conflict 判定正确，**信息零丢失**。

二者正交：通用值收敛 identity，`action_kind` 在 content 层保真。这是「generic + summary-discriminator」相对「per-kind enum」的唯一无损形态。

## Cross-repo edit sequence（load-bearing；enum 在 3 份 hand-synced 副本，非 $ref）

副本清单（共 3 份：liye_os 全仓 grep `regression_replay_result` 实测 **2 处枚举副本（event+record）**，第 3 处为 AGE 跨仓 vendored copy；**无隐藏第 4 份 allowlist/TS-union/python-validator/count-assertion**——6-lens 红队 HIDDEN-COPY 实证）：
1. liye_os canonical event schema（N-1）—— 本 PR 改。
2. liye_os record schema（N-2，**最易漏**：漏改则 event 过、record-validate `:489` 拒 = split failure）—— 本 PR 改。
3. AGE vendored copy（`DO-NOT-EDIT` pin）—— **后续 AGE follow-up PR** verbatim re-vendor。

**序**（forward fail-closed）：先 liye_os (1)+(2) merge → AGE follow-up PR re-vendor (3) + bump freshness（`test_vendor_schema_freshness` 钉 canonical-body sha256 + source-commit 字符串在场；header `Upstream blob (SHA-1)` 行为文档性、非 CI 强制）+ 删 `emit_fact.py` 死常量 `_ARTIFACT_TYPES`（defined-never-referenced，留着会变假权威）。**先改 AGE 会破 freshness 测试**。`write_outcome` 值必须双仓 merge 在前，才 wire cbu_producer emit（否则 `fact_rejects/`）。

- contracts gate **守 21**（enum-only 编辑、不增 `schemaFiles[]` entry，N-5 → 无合法 gate 增长、无 carve-out）。
- 触发 CI：liye_os `contracts-gate.yml` + `learning-importer-tests.yml` + `adr-bghs-gate.yml`；AGE `test_vendor_schema_freshness`（hash 重算前红）。
- 零行为改动、门仍关、零 fact 发射、frozen anchor（`golden_sidecar.json` + hash 函数）零触碰。

## Non-negotiable DoD（operator-mandated）

liye_os PR **不得只改 enum**。必须含一个**正向 fixture/test**，经**真 importer 路径**（非重写 ajv）证明 `artifact_type: write_outcome` + `raw_payload_summary.action_kind` + **string-encoded budget fields** 同时通过 ① event schema（S1）② S1b numeric-not-string ③ record schema（S2）。实现：从真 `golden_sidecar.json` 派生自洽 write_outcome sidecar（`reseal` 重算 identity+content），`importFacts({mode:'live'})` 断言 `new_records=1 / rejects=0`。**若漏改 record enum，此测在 record-validate 直接 `rejects=1 / new_records=0` → 红 = split-failure 哨兵**。配负向控制：native-number budget → `rejects=1` `NUMERIC_NOT_STRING`（实证 S1b 仍生效 + string-encode 是 Phase-1b wiring 的硬前提）。

## Forks（已裁）

- **Q1 命名** = `write_outcome`（`governed_*` 会与 governance 双流混淆；`execution_*` 冗长）。
- **Q2 action_kind** = free-string 复用 execution 词表（不铸第 4 份枚举）。
- **Q3 evaluator 分支** = 不加；`write_outcome` 静默落 default `production_observed`（N-4 实证不抛、不丢 fact）。待真有 evidence 语义需求再开。
- **Q4 死常量** = AGE re-vendor PR 顺手删 `_ARTIFACT_TYPES`。

## Downstream（本 ADR 之外）

- **AGE follow-up PR**（步骤 2）：verbatim re-vendor event schema + bump freshness + 删死常量；**不接 live wiring**。
- **AGE Phase 1b SPEC**（步骤 3，两仓 merge 后起）：cbu_producer caller + `_receipt_summary`/`_RECEIPT_SUMMARY_FIELDS` 扩 `action_kind`（值取自 `_CBU_KIND`，**非**「复用现成 action_kind」—— 那个在 `_cbu_preflight_report`，不同物）。**消歧**：本 ADR 改的是 `fact.artifact_type`，**不碰**同模块已发货的 `cbu_producer.inputs_artifact_type`（`INPUTS_ARTIFACT_TYPE='marketplace_growth_cap_audit'`，execution input-provenance tag，同名不同物）。raw_payload_summary 数值须 string-encode 才过 S1b。

## Rejected alternatives

1. **per-kind artifact_type 值**（`campaign_budget_update_outcome` 等）—— fork 8-key identity 空间，复活 CBU 专属 enum 反模式。**否决**。
2. **新 schema_version bump 到 1.1.0** —— enum 拓宽是加性、无破坏；bump 制造无谓 migration。**否决**。
3. **新增独立 write_outcome schema 文件** —— 会令 contracts gate 21→22（需 carve-out）+ 复制 19 字段，违背「最小、最便宜」。**否决**。
4. **kind 放 top-level 新字段（非 raw_payload_summary）** —— 改 20-field top-level 形状 = 破坏性、动 required/identity。**否决**；summary 是无损落点。
