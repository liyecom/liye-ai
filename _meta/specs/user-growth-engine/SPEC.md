# UGE SPEC — User Growth Engine 接口与验收契约（5 合同面）

> UGE（User Growth Engine）是 LiYe Systems 第 3 个 Layer-2 域引擎（掌象AI 获客）。本 SPEC 是 **contract-first 边界**：只钉接口与验收，**不写实现**。Rung 0+ 的 scaffold / playbook / Hands 代码以本 SPEC 的验收为准。
> **本 SPEC 明确不做**：不写实现、不 scaffold repo、不碰运行代码、不定最终业务阈值（operator config）。schema carve-in 已由 PR2 #198 完成，非本 SPEC 范围。

**Status**: Accepted（interface + acceptance contract；实现 Rung 0+ 后置）
**Effective**: 2026-07-02
**Upstream**:
- `_meta/adr/ADR-User-Growth-Engine.md`（Accepted，anchor `e62e82e`）—— 双平面 / 门控 / Rung 阶梯
- `_meta/adr/ADR-UGE-Fact-Taxonomy.md`（Accepted，anchor `e62e82e`）—— fact 输出形状 + PII 红线 + impedance 解
- schema carve-in **PR2 #198**（commit `6434849`）—— `growth_outcome` + `source_system: user-growth-engine` 双 enum 已在 event+record 双活
**Downstream**: Rung 0 scaffold（§1 验收为准）· PR3/PR4 Attribution Blocker（§3/§5 输入）· 后续独立 Hands-execution ADR（§5 细则）

---

## 0. 依赖与 Rung 映射（哪个面在哪个 Rung 活）

| 合同面 | Rung | 硬依赖 | emit? |
|---|---|---|---|
| §1 Rung 0 scaffold | Rung 0 | PR2 schema merged ✓（`6434849`）；vendored pin 目标 | 无 |
| §2 lead_ingest | Rung 2（emit 路径） | **PR2 schema ✓** + §3 qualified rule | growth_outcome |
| §3 qualified_signup | 定义面（Rung 1 起可算，Rung 2 起可 emit） | Attribution Blocker（PR3/PR4 提供 click_id / lead event） | — |
| §4 metrics_aggregate + content_fanout draft | Rung 1 | 只读数据源 | **无（Rung 1 不 emit、不发布）** |
| §5 Hands boundary | Rung 3（safe write 前必须就位） | N-4 三模式 + WriteGate | write_outcome（Rung 2 shadow / Rung 3 real） |

**关键排序**: growth_outcome/write_outcome emit（§2/§5）的 **schema 前提已满足**——PR2 #198（`6434849`）已把 event+record 双 enum merge 进 liye_os canonical。UGE 侧仍须 vendored copy pin 到该 commit 且两门 open 才真 emit；在此之前任何 emit → `fact_rejects/`。Rung 1（§4）全程零 emit、零外部写。

---

## §1. Rung 0 — placeholder manifest v2 · learning source closed · vendored schema pin

### 接口
- **engine_manifest（v2，UGE repo 内）**必须声明（承 `engine_manifest.schema.v2.yaml`）：
  - `schema_version: "2.0"`
  - `write_capability_declared: none` + `write_capability_effective: none`（**不用** legacy `write_capability`）
  - `capabilities[]`: 每项 `status: placeholder`（含 boundary/content_guard/truth_write_guard/fact_emit 等声明位，全 placeholder）
  - `runtime_gates[]`: 每项 `default_state: closed` + `evidence_required_for_open`（审计可读的开门条件）
  - `playbooks[]`: `lead_ingest` / `metrics_aggregate` / `content_fanout`，均 `status: placeholder`
  - `data_sources[]`: 只读 metrics 源（Rung 1）+ `fact_events_log`（未来 emit，Rung 2 才活）
- **learning_sources.yaml**（**控制面 registry**：`liye_os/.claude/config/learning_sources.yaml`，**非** UGE repo 内文件）: `user-growth-engine` 条目存在且 `enabled: false` + `expected_manifest_hash: null`（learning 门 closed / fail-closed）。
- **vendored fact-schema copy**: UGE repo 内 `DO-NOT-EDIT` 副本，byte-pin 到 liye_os canonical event schema **@ commit `6434849`（PR2 后，含 growth_outcome）**，freshness 测试钉 canonical-body sha256 + `EXPECTED_LIYE_OS_SOURCE_COMMIT=6434849`。

### 验收（DoD）
1. manifest 通过 `engine_manifest.schema.v2.yaml` 校验 + `validate_manifest_reality.py`（gates 声明 = reality）。
2. **两门可证 closed**：`write_capability_effective=none` ∧ 所有 `runtime_gates.default_state=closed` ∧ learning source `enabled:false` → **物理上无法 emit / 无法写**（deny-by-default）。
3. contracts gate **守 21**（manifest 是 instance，不进 `schemaFiles[]`；vendored copy 亦非新 sealed schema）。
4. vendored copy sha256 == liye_os canonical body @ `6434849`（freshness 绿）；canonical 漂移到新 commit 而 UGE 未 re-vendor → **freshness 红**（fail-closed 哨兵）。
5. 激活只能靠**物理编辑 manifest**（status placeholder→active + default_state closed→open + effective 提升），env var 单独翻不动门。

---

## §2. lead_ingest — 输入 · PII redaction · qualified 判断 · emit 前验证

### 接口
- **输入 envelope**（来自 zhangxiang form 旁 fire-and-forget event，**PR3 提供**（Attribution Blocker，非 §5）；**不改同事代码**）:
  - `lead_raw`: { contact_channel(email/phone/wechat), seller_category, monthly_gmv, is_amazon_seller, submitted_asin, utm_source, attribution_click_id, submitted_at }
  - `ingest_context`: { trace_id=**本次 ingest run id**, source=zhangxiang_contact, received_at }
- **run 身份**（承 taxonomy ADR impedance 解）: `playbook_ref=lead_ingest`、`step_id=ingest`、`artifact_path`=该 signup record 规范路径、`source_system=user-growth-engine`、`artifact_type=growth_outcome`、`action_kind=growth.signup.qualified`。
- **PII redaction 契约**（承 taxonomy ADR §Q7 红线）:
  - PII 字段 = 一切联系方式值（email/phone/wechat）。
  - 原始联系方式**只进 UGE 私有 lead store / broker**，**不进 fact repo artifact、不进 event sidecar、不进 audit 明文**。
  - fact 侧 `raw_payload_ref` 指向的是**已 redacted 的 artifact**（`redaction_status: redacted` 或 hash-ref）；解引用也拿不到明文联系值。
  - PII **不得进 `raw_payload_summary`**；summary 只放 `contactable`（`"true"`/`"false"` 字符串），**不放联系值**。
- **summary profile**（全 string-encoded per S1b）: `seller_category` / `monthly_gmv_band` / `is_amazon_seller` / `submitted_asin` / `contactable` / `attribution_click_id` / `utm_source`。
- **emit 前验证链**（三关，任一 fail → fact_rejects/，不 emit）:
  1. vendored **event schema**（S1）
  2. **S1b native-number**（`containsNativeNumber`）—— 只挡 native number
  3. **profile validator**（UGE 自有）—— 挡 S1b 挡不到的：`is_amazon_seller`/`contactable` **必须是 `"true"`/`"false"` 字符串而非 native bool**、必需 key 在场、PII 未泄漏进 summary、qualified 计算一致。

### 验收（DoD）
1. 正向: 合法 lead → 一条 valid growth_outcome fact（action_kind=growth.signup.qualified，summary 全 string，无 PII，qualified 已算）三关全过。
2. 负向-number: `monthly_gmv_band` 用 native number → S1b `NUMERIC_NOT_STRING` reject。
3. 负向-bool: `is_amazon_seller` 用 native `true` → **S1b 放过、profile validator reject**（证 bool 不寄望 S1b）。
4. 负向-PII: 联系值出现在 summary 位 → profile validator reject（红线哨兵）；`raw_payload_ref` 指向物解引用无明文联系值。
5. emit 在 §1 两门 closed 时**物理不可发生**（Rung 2 才通；schema 前提已由 PR2 满足）。

> 注：三关 + number/PII deref 的 real-importer 参照实现已存在于 `.claude/scripts/learning/tests/import_facts_growth_outcome.test.mjs`（PR2 落地）；UGE emitter 的 profile validator 复用同一验收形状（bool 归 UGE 层，非 S1b）。

---

## §3. qualified_signup — 字段 · 阈值 · 反作弊/噪声过滤

### 接口
- **字段**: 同 §2 summary profile（string-encoded）。北极星 = `attributed_qualified_signup`（**非** raw signup）。
- **qualified 规则**（纯函数、确定性、**config 驱动**，SPEC 定形状不定终值）:
  - 形状: `qualified = is_amazon_seller ∧ (monthly_gmv_band ≥ MIN_BAND) ∧ attribution_valid ∧ ¬filtered`
  - `MIN_BAND` / `monthly_gmv_band_order`（allowed bands + ordinal mapping）/ 权重 / 归因窗口 = operator config（版本化，config_hash 入 audit）。
  - unknown `monthly_gmv_band` 不得计 qualified；禁止字符串直接比较，必须经 config 的 ordinal mapping。
- **反作弊/噪声过滤**（filtered=true 则不计 qualified）:
  - **dedup**: `event_identity_key` 只防同一 fact replay；同一 lead 多次提交必须按 UGE 私有 lead store 的 `business_dedup_key`（如 normalized contact hash / submitted_asin / attribution_click_id / time window）在 qualified 计数前过滤。
  - **bot/spam**: rate-limit、honeypot、disposable-email 域黑名单。
  - **attribution 完整性**: `attribution_click_id` 须有效、未 replay、在归因窗口内。

### 验收（DoD）
1. qualified 规则给定 (inputs, config) → 确定性输出；规则版本 + config_hash（含 band ordinal mapping）记入 fact/audit（可复算）。
2. spam/dup lead 在计 qualified **之前**被 filtered（不污染北极星）。
3. attribution 缺失/失效 → `attributed_qualified_signup=false`（即便其余 qualified）。
4. 阈值改动只动 config，不改代码（无硬编码数值）。

---

## §4. metrics_aggregate + content_fanout draft（只读指标 + 草稿资产形状）

### 接口
- **metrics_aggregate（只读）**:
  - 输入: 各阵地/渠道原始指标（views/engagement/followers，per property × channel × time-window）。
  - 输出: 结构化只读 metrics artifact；含 **owned vs rented** 拆分（承 a16z）、per-property 归口（60/25/15）。
  - **禁止**: 任何外部写、任何 fact emit（Rung 1 纯只读）。
- **content_fanout draft**:
  - 输入: 1 篇 longform 源 ref。
  - 输出: per-channel **draft** 变体资产，每条含 `{ platform, format, body_draft, compliance_label_required:bool, human_gate:bool, publish:false }`。
  - **禁止**: 发布 / 排期上线 / 触外部 API。

### 验收（DoD）
1. metrics job 可证只读（无 write syscall/API、无 emit）；产出结构化 artifact。
2. 每条 draft `publish=false`；风险平台（抖音/小红书/视频号/直播）draft **必带 `human_gate=true`**。
3. 每条 draft 带 `compliance_label_required` 标记（AI 标注/平台规则，operating assumption，Rung 1 前 pin 官方源）。
4. Rung 1 全程零 emit、零外部写（与 §1 门态一致）。

---

## §5. Hands boundary — Mac mini 执行面只接批准意图，风险平台 human-gated

### 接口
- **approved write intent envelope**（控制面批准后派发给 Hands）:
  - `{ target_platform, action, payload_ref, approval_provenance(token+approver+ts), cred_ref: "cred://…", write_capability_scope }`
  - Hands **不自行决策该不该写**（承 engine ADR D2）；只在 WriteGate/GuardChain/KillSwitch 下执行。
- **credential mediation**（承 N-4）: 平台明文密钥**不经过控制面 intent/audit/repo**；派发的 intent 只带 `cred://` 引用，明文只存在于 **Mac mini 本地 broker + 短期进程内存**（Hands 本地解析后即用即弃，不回写、不外传）。
- **risk-platform human gate**: 抖音/小红书/视频号/直播 的 intent 必带 human-exec 标记；Hands **拒绝自动执行**，只产人工可操作包。
- **Wake/Resume**（承 ADR-AGE-Wake-Resume）: append-only event stream，跨睡眠/重启不丢不重。
- **KillSwitch(position-0)** + **WriteGate shadow-first**（deny-by-default）。

### 验收（DoD）
1. 缺 approval_provenance 的 intent → Hands 拒。
2. 风险平台 intent → Hands **不自动写**，转人工包（human-gate 哨兵）。
3. 派发的 intent 内**无任何明文平台 cred**（只 `cred://`）；grep 明文 = 红。
4. 任一新写路径**首次必 shadow**（WriteGate shadow-first）；KillSwitch 触发 → 全停。
5. Hands 崩溃/重启后由 event stream 恢复，无重复执行、无丢单。

---

## 本 SPEC 明确不做（防蔓延）
- ❌ 不写任何 playbook/Hands 实现代码
- ❌ 不 schema carve-in（`source_system`/`artifact_type` 双 enum **已由 PR2 #198 `6434849` 完成**，本 SPEC 不重复）
- ❌ 不 scaffold UGE repo（Rung 0 实现）
- ❌ 不碰 zhangxiang/FirstLightClaw/kuachu 运行代码
- ❌ 不定最终业务阈值（operator config）
- ❌ 不定 Hands 执行细则的完整规范（KillSwitch/TrustBoundary 具体协议 = 后续独立 Hands-execution ADR/SPEC）

## 后续（本 SPEC 之外）
Rung 0 scaffold（§1 验收为准）→ Rung 1（§4 只读+draft）→ PR3/PR4 attribution 使北极星可度量（§3/§5 输入）→ Rung 2 emit（§2）→ Rung 3 safe write（§5）。
