---
artifact_scope: meta
artifact_name: UGE-Fact-Taxonomy
artifact_role: contract
target_layer: 0
is_bghs_doctrine: no
---

# ADR — User Growth Engine (UGE) Fact Taxonomy：content/channel 复用 `write_outcome`，业务结果新增通用 `growth_outcome` + `source_system: user-growth-engine`

> 文件名采非数字前缀（`ADR-UGE-Fact-Taxonomy.md`）以进入 CI-wired BGHS frontmatter gate（`adr-bghs-gate.yml`）的有效扫描域，对齐 write_outcome 先例。

**Status**: Accepted
**Date**: 2026-07-01
**Decision Makers**: LiYe
**SSOT**: 本文件（UGE fact artifact_type / source_system 分类教条）；schema SSOT = `_meta/contracts/learning/fact_run_outcome_event_v1.schema.yaml`（canonical）；UGE 端为未来 byte-pinned vendored copy（UGE repo scaffold 时才建，见 §Cross-repo edit sequence）。
**先例**: `_meta/adr/ADR-Learning-Fact-Artifact-Type-Taxonomy.md`（Accepted 2026-06-14，durable anchor `73e4d00`）—— 本 ADR 完全复用其「generic value + `raw_payload_summary.action_kind` discriminator」无损范式、cross-repo 手同步序、DoD 骨架；仅在两点扩展（见 §Context 末「与先例的差异」）。

**References**:
- N-1（Normative）: `_meta/contracts/learning/fact_run_outcome_event_v1.schema.yaml`（canonical SSOT）——
  - `source_system.enum` **L49-54**（现 3 值 `amazon-growth-engine / chaming / loamwise`，closed enum；object-level `additionalProperties: false`）
  - `artifact_type.enum` **L95-102**（现 5 值，末值 `write_outcome`）
  - doctrine 描述 **L103-110**：「The concrete action kind lives in `raw_payload_summary.action_kind` — NOT a per-kind artifact_type value … minting per-kind values would fork identity space」+ L110 指回 taxonomy 先例 ADR
  - `event_identity_key` **L152-160**：`sha256(source_system + source_repo + trace_id + artifact_type + artifact_path + playbook_ref + step_id + source_commit_sha)`（8-key locked 原像，`source_system` 与 `artifact_type` 皆在原像内）
  - `event_content_hash` **L161-168**：排除集 **L166** = `[emitted_at, raw_payload_summary.metric_formatting_hint]` → **`raw_payload_summary.action_kind` 不在排除集 → 进 content fingerprint**
  - `schema_version` **L170-172** const `"1.0.0"`
- N-2（Normative）: `_meta/contracts/learning/fact_run_outcome_record_v1.schema.yaml` —— head **L15** 维护契约「本文件 19 个 event 字段必须与 event_v1 保持同步」；`source_system` **L69-72**、`artifact_type` **L104-113**（展开**副本，非 `$ref`**，L106-107 注明与 event_v1 同步 + write_outcome 来源）。→ enum 拓宽**必须双改（event + record）**，否则 event 过、record-validate 拒 = split failure。
- N-3（Normative，本 ADR 不改 importer；行号实测 worktree base `4865714`）: `.claude/scripts/learning/import_facts.mjs` —— `buildValidators()`（:141，ajv `strict:false / validateFormats:false`）双 schema compile；三关 S1 event-validate / S1b `NUMERIC_NOT_STRING`（~:409 `containsNativeNumber(summaryNode)`，判定逻辑在 `canonical_json.mjs:285`——**只对 `node.t==='num'` 即 native JSON number 返 true，native bool 不触发**）/ record-validate。**growth_outcome 与 user-growth-engine 是纯 enum 拓宽，不触碰 importer 逻辑。**
- N-4（Normative，继承自先例 N-4，accept 时复核）: `src/reasoning/policy_trial_evaluator.mjs` —— `deriveEvidenceOrigin`（:302）`regression_replay_result`→`golden_regression`，**else→default `production_observed`**；records-scan（:558）仅 `policy_suggestions_json` 驱动 artifact-deref。→ **新值 `growth_outcome` 落 else 分支静默取 `production_observed`，无 unknown-value throw、无 deref，零 evaluator 改动**（与 write_outcome 同待遇）。
- N-5（Normative，继承自先例 N-5）: `_meta/contracts/scripts/validate-contracts.mjs` —— schema-pass 计数 over 显式 `schemaFiles[]` 数组；全局 Summary pass 计数当前为 **21**。本决策**仅编辑既有数组成员 enum 值、不新增 `schemaFiles[]` entry** → schema-pass 与全局总数**零变化（守 21，无 carve-out）**。
- S-1（Supporting）: `scratchpad/uge-fact-taxonomy-spike.md`（本 ADR 的 time-boxed spike 决策交付物：决策表 A/B/C/D + 推荐 C + schema-diff 风险 R1-R4 + 本骨架）；write_outcome 先例 micro-discuss `wf_0b114a29`（`generic_is_lossless=true / would_break_importer=false`）。

**Commit anchor**: **`e62e82e`**（liye_os PR #197 squash-merge，2026-07-02；`liyecom/liye-ai` origin/main）。对齐 ADR-GHL 教条「post-squash merge commit 为 durable anchor；无 pre-squash SHA 具规范性」。

---

## Context

UGE（User Growth Engine）作为 Layer-2 域引擎接入 LiYe Systems，其运营动作（内容发布、渠道排期、渠道活动改动）与业务结果（掌象AI SaaS 获客 / lead / trial 归因）需进 GHL learning fact 流。在动任何 UGE wiring / scaffold repo **之前**，必须先钉死这些 fact 的**输出形状**，否则后续每条 content/growth wiring 会各自发明 `artifact_type`，污染 `event_identity_key` 的 8-key identity 空间（N-1 L152-160）——与 write_outcome 先例撞同一条护栏。

UGE 的 fact 分**两类**，命运不同：

- **类 1 — content / channel 动作**（YouTube 发布、小红书发布、blog 发布、抖音/视频号渠道活动改动、排期）= **write/execution receipt**。语义与 AGE 的 CBU write receipt 同级 → **直接复用现有 `write_outcome`**，动作细分走 `raw_payload_summary.action_kind`。**零新 artifact_type，不进本 ADR 的 fork 决策。**
- **类 2 — growth / 业务结果**（`attributed_qualified_signup`、lead captured、trial started，归因到具体内容/渠道）= **非引擎写出、是观测到的业务结果**。既有 5 个 artifact_type 值（verification / policy_suggestions / step_eval / regression_replay / write_outcome）都不契合其语义 → **这才是本 ADR 的 fork 决策**。

**与 write_outcome 先例的差异（两点）**：
1. **多一处 enum**：write_outcome 只动 `artifact_type` 且复用现有 engine；UGE 是**新增 Layer-2 引擎**（继 AGE/chaming 后第 3 个 Layer-2 引擎），须在 `source_system.enum`（N-1 L49-54）**新增 `user-growth-engine`**（使其从 3 值增至 4 值——即 **UGE 是第 4 个 `source_system` enum value**，勿与 Layer-2 引擎序号混淆：现有 3 值中 `loamwise` 是 Layer-1）。`source_system` 是「每 source 一值」的**设计扩展点**，故新增一值是**合法登记，非 fork**——与 `artifact_type` per-kind 铸值是反模式恰好相反。
2. **UGE repo 尚不存在**：write_outcome 先例的第 3 份 vendored 副本在已存在的 AGE 仓；UGE 仓要到 Rung 0 scaffold 才建。故本 ADR accept 时**只有 2 份副本（liye_os event + record）**，UGE vendored 副本是**未来**（scaffold 时 byte-pin 到本 ADR 落地后的 schema）。

## Decision

1. **类 1 content/channel 动作 → 复用 `write_outcome`**（零新 artifact_type）。动作种类走 `raw_payload_summary.action_kind`，约定 `<domain>.<object>.<verb>`：
   - `content.*`：`content.youtube.publish` / `content.xhs.publish` / `content.blog.publish`
   - `channel.*`：`channel.douyin.campaign_update` / `channel.video_channel.schedule`
2. **类 2 业务结果 → 新增 exactly ONE 通用值 `growth_outcome`**（`fact_run_outcome_event_v1.artifact_type.enum` +1，N-1 L95-102）。与 write_outcome 同为「非 eval/inference/replay 的第二类通用 receipt」，可被未来任意 growth-outcome→fact 路径复用。业务动作走 `action_kind`：
   - `growth.*`：`growth.signup.qualified` / `growth.lead.captured` / `growth.trial.started`
3. **新增 `source_system: user-growth-engine`**（`fact_run_outcome_event_v1.source_system.enum` +1，N-1 L49-54）—— UGE 引擎登记。
4. `artifact_type.description` doctrine 从「eval/inference/replay + execution/write outcomes」扩成「+ **observed growth/business outcomes**」；明确 growth_outcome = 观测到的、归因到内容/渠道的业务结果（signup/lead/trial），**非引擎自身的写动作**（那是 write_outcome）。
5. **北极星契约（`attributed_qualified_signup`）落 `raw_payload_summary` profile**（`action_kind=growth.signup.qualified`），**不进 schema top-level、不铸独立 sealed 文件**（守 21）：
   - summary keys（非 PII、**全部 string-encoded** per S1b，N-3 :411）：`seller_category` / `monthly_gmv_band` / `is_amazon_seller`（`"true"`/`"false"` 字符串） / `submitted_asin` / `contactable`（`"true"`/`"false"`） / `attribution_click_id` / `utm_source`
   - **qualified 判定**（哪些字段组合算 qualified）由 UGE lead-ingest playbook 计算后落 summary，**判定规则本身**在 UGE SPEC / ADR-User-Growth-Engine 定义，本 ADR 只钉字段形状与编码约束。

### 决策成立的关键机制（lossless 证明，照先例 §关键机制）

`event_content_hash` 排除集仅 `[emitted_at, raw_payload_summary.metric_formatting_hint]`（N-1 L166）。`raw_payload_summary.action_kind` **不在排除集 → 进 content fingerprint**。故：
- **identity** 由通用 `growth_outcome`（或 `write_outcome`）+ 其余 7 key（含 `source_system=user-growth-engine`）唯一化，**不因 signup/lead/trial 细分而 fork**；
- **content** 由 `action_kind` + summary 各字段保真 → 不同业务结果产不同 content hash → D-13 duplicate-vs-conflict 判定正确，**信息零丢失**。

二者正交：通用值收敛 identity，`action_kind`/summary 在 content 层保真。这是「generic + summary-discriminator」相对「per-kind enum」的唯一无损形态（先例已证）。

### impedance 解决（growth 结果无天然「run」身份）

business signup 不是「engine run 产出 artifact」——它无 trace_id / playbook_ref / artifact_path 的天然来源。解法：**UGE lead-ingest job 就是那个 run**。
- `trace_id` = 该次 ingest run id；`playbook_ref` = `lead_ingest`；`step_id` = ingest step；`artifact_path` = 该 signup record 的规范路径；`source_commit_sha` = UGE 该次运行的 commit。
- 于是 growth 结果干净 fit 既有 `fact_run_outcome_event_v1`，**无需新独立 schema 家族**（否决 Option D，见 §Rejected）。

## Cross-repo edit sequence（load-bearing；enum 在手同步副本，非 `$ref`）

> **适用范围**：本节 + 下方 DoD 描述的是 **PR2（`uge-fact-schema-carve-in`）**——即真正改 event/record schema enum 的那个 PR。本 taxonomy ADR 落地于 **PR1 决策包**（2 ADR + SYSTEMS.md 两行、**不碰 schema**）；PR1 无需 fixture/importer 测试，那是 PR2 的 DoD。

**PR2 merge 时副本清单 = 2 份（均在 liye_os；UGE 仓尚不存在）**：
1. liye_os canonical **event** schema（N-1）—— `source_system.enum` +`user-growth-engine`、`artifact_type.enum` +`growth_outcome`。
2. liye_os **record** schema（N-2，**最易漏**：漏改则 event 过、record-validate `:489` 拒 = split failure）—— 同两处 enum 拓宽。

→ **PR2** 净 enum-array 编辑 = **2 值 × 2 文件 = 4 处**（`source_system` 与 `artifact_type` 各在 event+record 双改）。

**未来第 3 份（不在本 PR）**：UGE repo Rung 0 scaffold 时建 **vendored copy**（`DO-NOT-EDIT` pin + freshness 测试钉 canonical-body sha256 + source-commit），byte-pin 到本 ADR 落地后的 event schema。**UGE 不得在 vendor 前 emit**（否则 `fact_rejects/`）。

**序（forward fail-closed）**：liye_os (1)+(2) 双改于 **PR2** 同 PR merge → （未来）UGE scaffold 时 re-vendor。**`schema_version` 维持 const `"1.0.0"`**（两处 enum 拓宽皆 JSON-Schema 加性、向后兼容、identity/content-hash 算术不变，无 bump）。

- contracts gate **守 21**（enum-only、不增 `schemaFiles[]` entry，N-5 → 无合法 gate 增长、无 carve-out）。
- 触发 CI：liye_os `contracts-gate.yml` + `learning-importer-tests.yml` + `adr-bghs-gate.yml`。
- 零行为改动、两门（engine_manifest + learning_sources）仍关、零 fact 发射、frozen anchor 零触碰。

**关键 sequencing 约束**：`source_system: user-growth-engine` 是**已登记引擎的词表项**；**PR2（schema carve-in）应在 PR1（`ADR-User-Growth-Engine` 把 UGE 登记进 SYSTEMS.md 为 Layer-2 引擎）之后 merge**，避免 orphan 词表项。在 UGE 有 emitter 前，该值**inert**（无引擎发射 → 无 fact → 无效果），与 write_outcome 先加值后接 caller 的 fail-closed 序一致。

## Non-negotiable DoD（operator-mandated，照先例；**属 PR2，非 PR1**）

**PR2（schema carve-in）不得只改 enum**。必须含**正向 fixture**，经**真 importer 路径**（N-3，非重写 ajv）证明一条 `artifact_type: growth_outcome` + `source_system: user-growth-engine` + `raw_payload_summary.action_kind=growth.signup.qualified` + **string-encoded summary 字段**同时通过 ① event schema（S1 :402）② S1b `NUMERIC_NOT_STRING`（:411）③ record schema（S2 :489）。实现：从真 `golden_sidecar.json` 派生自洽 growth_outcome sidecar（reseal 重算 identity+content），`importFacts({mode:'live'})` 断言 `new_records=1 / rejects=0`。
- **split-failure 哨兵**：若漏改 record enum（`source_system` 或 `artifact_type` 任一），此测在 record-validate 直接 `rejects=1 / new_records=0` → 红。
- **负向控制（仅 native number）**：`monthly_gmv_band` 用 native number（非字符串）→ 断言 `rejects=1` `NUMERIC_NOT_STRING`。**⚠ 实测边界**：importer 的 S1b（`containsNativeNumber`，`import_facts.mjs` ~:409 + `canonical_json.mjs:285`）**只查 native JSON number，不查 native bool**（bool 落 `default:false`）。故 `is_amazon_seller`/`contactable` 的 string-encoding（`"true"`/`"false"`）**不由 importer 强制** → 由 **UGE emitter + profile validator** 保证（PR2/Rung wiring 层测 bool/string，不寄望 S1b）。本 DoD 只对 number 负向。
- **PII 负向控制（本 ADR 新增）**：fixture 断言联系方式值**不出现在 summary**（只留 `contactable` 布尔字符串），且 `raw_payload_ref` 指向的 artifact 已 redacted（`redaction_status: redacted`，解引用无明文联系值）；防止 signup 联系值意外进 fact 明文。原始联系方式只在 UGE 私有 lead store/broker。

## Forks（已裁）

- **Q1 类 1 归属** = 复用 `write_outcome`（content/channel 是写动作，非业务结果观测；不为其铸新值）。
- **Q2 类 2 命名** = `growth_outcome`（`signup_*` 太窄、`conversion_*` 与 AGE measurement 混淆；`growth_outcome` 平行于 write_outcome，范畴级）。
- **Q3 source_system** = 新增 `user-growth-engine`（引擎登记，非 fork；source_system 本就每引擎一值）。
- **Q4 action_kind** = free-string `<domain>.<object>.<verb>`（不铸第 2 份 growth-kind 枚举，复用先例 free-string 范式）。
- **Q5 evaluator 分支** = 不加；`growth_outcome` 静默落 default `production_observed`（N-4 实证 else 不抛、不丢 fact）。待真有 growth-evidence 语义需求再开。
- **Q6 qualified profile 形态** = 留 `raw_payload_summary` doc/convention 层（**不加 sealed schema 文件** → 守 21）；要 machine-validate qualified 判定时另起 carve-out（21→22）。
- **Q7 PII** = 原始联系方式**只存在 UGE 私有 lead store / broker**，**不进 fact repo artifact、不进 event sidecar、不进 audit 明文**。fact 的 `raw_payload_ref` **只能指向已 redacted 的 artifact**（`redaction_status: redacted` / hash-ref），解引用也拿不到联系方式明文；summary 只保留 `contactable`（布尔字符串），**不放联系值**。
- **Q8 cross-product provenance** = signup 起源 zhangxiang.com（同事产品，**只读、本地改动永不推送**）→ **不改同事代码**，只在 form 旁挂 fire-and-forget event；UGE lead-ingest job 是 emit 主体（见 impedance 解决）。

## Downstream（本 ADR 之外）

- **`ADR-User-Growth-Engine`**（并行/紧接）：把 UGE 登记为 Layer-2 引擎（SYSTEMS.md）、placeholder engine_manifest v2（`write_capability_declared/effective=none`）、两门 closed。本 taxonomy ADR 被其引用为 fact-output 契约。
- **UGE SPEC**（contract-first，scaffold 前）：定义 lead-ingest playbook、qualified 判定规则、content_fanout draft、read-only metrics。
- **UGE Rung 0 scaffold**：建 repo + vendored schema copy + freshness pin（本 ADR §Cross-repo 的未来第 3 份）。
- **Attribution Blocker**（独立前置）：zhangxiang form 旁挂 fire-and-forget lead event（不改同事代码）+ `attributed_qualified_signup` 定义落地，使北极星可度量——是 growth_outcome fact 有真数据的前提。

## Rejected alternatives

1. **类 2 复用 `write_outcome`** —— 信号是「观测到的业务结果」非「引擎写出」，会污染刚定义的 write receipt 语义边界。**否决**（决策表 Option A）。
2. **类 2 复用 `verification_json`（measurement/verdict 家族）** —— verification = run 自证正确性 ≠ 业务转化；轻度语义重载。**否决**（Option B，次选但语义不正）。
3. **新增独立 schema 文件 `growth_outcome_event_v1`** —— contracts gate 21→22（需 carve-out）+ 复制 19 字段；且 impedance 已由「lead-ingest job = run」解决，无需独立家族。write_outcome 先例已明否同型方案（其 Rejected #3）。**否决**（Option D）。
4. **per-kind artifact_type 值**（`qualified_signup_outcome` / `lead_captured_outcome` 等）—— fork 8-key identity 空间，复活 per-kind 反模式（N-1 L107-109 doctrine 明禁）。**否决**。
5. **qualified profile 做成 top-level 新字段或 sealed schema** —— 改 20-field top-level 形状 = 破坏性、动 required/identity；或 21→22 需 carve-out。summary 是无损、守 21 的落点。**否决**。
