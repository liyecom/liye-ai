---
artifact_scope: meta
artifact_name: User-Growth-Engine
artifact_role: contract
target_layer: 2
is_bghs_doctrine: no
---

# ADR — User Growth Engine (UGE)：Layer-2 域引擎登记 · 双平面边界 · 门控阶梯

> 文件名采非数字前缀以进入 CI-wired BGHS frontmatter gate（`adr-bghs-gate.yml`）有效扫描域。
> **本 ADR 只做「登记 / 边界 / 门控」，不塞任何实现**：无 engine_manifest 文件、无 schema enum 编辑、无 Hands 代码、无 content。实现全部后置（见 §Non-scope 与 §Downstream 的 PR 排序）。

**Status**: Accepted
**Accepted-Date**: 2026-07-02
**Date**: 2026-07-01
**Decision Makers**: LiYe
**SSOT**: 本文件（UGE 引擎定位 / 双平面边界 / 门控阶梯的架构决策）；生态分层/成熟度以 `_meta/portfolio/SYSTEMS.md` 为准（本 ADR 提议其新增登记行，见 §Decision-1）。
**References**:
- N-1（Normative）: `_meta/adr/ADR-001-control-plane-vs-domain-engine.md`（Accepted 2026-02-08）—— 控制平面（LiYe OS：调度/学习/治理/投递/计量）vs 域引擎（纯函数 playbooks，**禁自行调度/学习治理/投递/读写 OS 状态**，消费 learned bundle）的边界宪法。本 ADR **在其上新增一维**：UGE 的**执行物理发生在独立 Mac mini（Hands）**，而非控制面本机。
- N-2（Normative）: `_meta/adr/ADR-UGE-Fact-Taxonomy.md`（Accepted 2026-07-02，anchor `e62e82e`；PR1 同批 merged）—— UGE 的 fact 输出形状（content/channel→`write_outcome`；growth→`growth_outcome`；`source_system: user-growth-engine`）。本 ADR 引用其为 UGE→GHL learning 流的契约，解决 `source_system` 词表不 orphan 的 sequencing。
- N-3（Normative）: `_meta/contracts/engine/engine_manifest.schema.v2.yaml`（**当前活动版**，`schema_version: "2.0"`；未声明 schema_version 的旧 manifest 才 fallback 到 v1 `engine_manifest.schema.yaml`）—— D0→D1 登记的目标契约。UGE 的 placeholder manifest 须用 **v2 字段**：`write_capability_declared` + `write_capability_effective`（初始皆 `none`；v2.0 期 legacy `write_capability` 仅 deprecated_but_accepted）、`capabilities[]`（`status: placeholder`）、`runtime_gates[]`（`default_state: closed` + `evidence_required_for_open`）、`playbooks` + `data_sources`。**本 ADR 不创建 manifest 实例**（那是 Rung 0，PR2 之后）；仅声明 UGE 将来按 v2 协议注册。
- N-4（Normative，Hands 治理模式，引用不重述）: `_meta/adr/ADR-Credential-Mediation.md`（凭证中介：平台/provider 明文密钥**不跨线抵达 Hands**，控制面只派发 `cred://` 引用，Hands 本地解析）、`_meta/adr/ADR-AGE-Wake-Resume.md`（Wake/Resume：append-only event stream 保证跨睡眠/重启不丢不重）、`_meta/adr/ADR-Loamwise-Guard-Content-Security.md`（内容写前 GuardChain）。UGE-Hands **复用**这些模式；KillSwitch(position-0) / WriteGate(shadow-first, deny-by-default) / TrustBoundaryDecl 等 Hands 执行细则由**后续独立 Hands-execution ADR** 正式钉死，不在本 ADR 展开。
- N-5（Normative）: `_meta/portfolio/SYSTEMS.md` —— Codebase Registry（列 `Codebase|Layer|Role|Upstream|Downstream|Maturity|CLAUDE.md`）+ Domain 成熟度模型（D0 Standalone / D1 Registered / D2 Dispatchable / D3 Governed）+ 当前状态表（AGE/Chaming 现均 D0）。
- S-1（Supporting）: a16z「New Media, One Year In」框架（signal from people not brands / barbell content / one longform→fan-out / owned vs rented audience / measured impact）；掌象AI（FirstLightClaw，`zhangxiang.com`）作为 AGE 对外 SaaS 版本的获客案例。

**Commit anchor**: **`e62e82e`**（liye_os PR #197 squash-merge，2026-07-02；`liyecom/liye-ai` origin/main）。

---

## Context

UGE（User Growth Engine）是拟接入 LiYe Systems 的**新增 Layer-2 域引擎**，与 AGE（亚马逊广告）、chaming（域名投资）平行——继二者之后**第 3 个 Layer-2 引擎**（勿与「第 4 个 `source_system` enum value」混淆：`source_system` 现有 3 值 `amazon-growth-engine / chaming / loamwise`，其中 loamwise 是 Layer-1；UGE 加入使其成第 4 值，见 N-2）。它把「用户增长 / 内容运营」自动化为一个受治理的域引擎，**北极星 = 掌象AI（`zhangxiang.com`，AGE 的对外 SaaS 版本）的获客**。

三点现实迫使「先登记、先钉边界」，而非直接建 repo：

1. **双平面物理分离**：UGE 在**控制面本机（LiYe main Mac）构建与治理**，但**执行在独立 Mac mini（Hands，跑 openclaw + codex + claude code）**。ADR-001（N-1）只区分了「控制面 vs 域引擎」两个逻辑角色，未处理「执行发生在另一台物理机」这一维度。不先钉死这条边界，后续 Hands 代码会与控制面职责混淆。
2. **自动化的「两个世界」**（以下平台能力与法规均为 **operating assumption，Rung 1 前须 live-probe / 官方来源 pin**，不作既成事实）：YouTube + 自托管 blog 有官方 API、假定可全自动；抖音（API 代发但假定撞反同质化红线）/ 视频号（假定无发布 API）/ 小红书（假定发布须真机扫码、多账号同 Wi-Fi 降权）+ 各平台**直播** = 人工门。AI 内容标注合规（含各地生效日期）由 compliance guard 与人工发布环节双重负责。不先钉死「哪些可安全自动、哪些必须人工」，引擎会越界。
3. **北极星当前不可度量**：目标是 `attributed_qualified_signup`（**归因合格注册**，非 raw signup）。但 `zhangxiang.com` 联系入口是纯 mailto、kuachu.com CTA 是硬编码 affiliate 直链——两处都不落 lead/attribution event（详见 §Decision-4 与 Downstream Attribution Blocker）。不先把北极星定义与度量前提钉死，引擎会优化一个测不准的目标。

## Decision

### D1. 登记 UGE 为 Layer-2 域引擎，成熟度 **D0（Proposed）**，write_capability = **none**

UGE 遵守 engine_manifest 协议（N-3）、通过 loamwise 调度（目标态）、在用户增长领域产出 **domain truth**（内容计划 / 渠道排期 / 增长 verdict）。**当前不创建 manifest**（D0=Standalone，未注册协议），故登记为 D0(Proposed)。SYSTEMS.md 提议新增两行（本决策包 PR1 落地，**无 schema 变更**）：

- Codebase Registry：
  `| user-growth-engine | 2 | 用户增长引擎（掌象AI 获客） | loamwise (目标态) | — | D0 (Proposed) | — |`
- 当前状态：
  `| UGE | D0 (Proposed) | none | 内容/渠道增长；执行在独立 Mac mini Hands；两门 closed；北极星=attributed_qualified_signup |`

### D2. 双平面边界（在 ADR-001 之上新增「Hands」物理维度）

| 角色 | 物理位置 | 拥有 | 禁止 |
|------|----------|------|------|
| **控制面** LiYe OS | main Mac | 调度 / 学习流水线 / 晋升·漂移·回滚治理 / 投递 / 计量 / **派发已批准的写意图给 Hands** | — |
| **UGE 域引擎** | （逻辑，随控制面 build/治理） | 纯函数 playbooks：inputs→verdict + 内容/渠道计划 + growth 判定；声明 write_capability | 自行调度 / 学习治理 / 读写 OS 状态（承 ADR-001） |
| **UGE-Hands** 执行面 | 独立 Mac mini | 在 GuardChain/WriteGate/KillSwitch 下**实际执行**已批准写（发布内容、改渠道活动）；本地解析 `cred://` | **不自行决策该不该写**（决策在引擎/控制面）；平台明文密钥**不跨线抵达**（承 N-4 凭证中介） |

**关键澄清**：UGE-the-engine 仍是 ADR-001 意义上的纯函数 domain-truth 生产者；「写」是一个**独立受治理的执行面（Hands）**行为，由控制面派发、Hands 执行，**不是引擎自己调度自己去写**。三者职责不可混。

### D3. 资产范围（四阵地）· 自动化两个世界 · 资源配比

- **四阵地**：(A) 掌象官方账号（抖音/视频号/小红书/YouTube/官方 blog）；(B) 杨过跨境个人 IP（同渠道 + 个人 blog）；(C) kuachu.com（跨境出海百科 wiki，LiYe autosite）；北极星落点 = 掌象AI SaaS（`zhangxiang.com`）。
- **自动化边界（两个世界）**：
  - **可全自动**（有官方 API）：YouTube、自托管 blog（官方/个人）、kuachu 内容与 CTA。
  - **人工门**（引擎只产计划/草稿，人工执行）：抖音（反同质化红线）、视频号（无发布 API）、小红书（真机扫码 + 多账号降权）、**所有平台直播**。
  - **AI 内容标注合规**：**可全自动渠道（safe-write）也须过 compliance guard**（自动标注 + 平台规则校验），而非仅依赖人工发布环节；人工门渠道由人工 + guard 双重负责。具体法规日期/规则为 operating assumption，Rung 1 前 pin 官方来源。
- **资源配比**：**60 / 25 / 15**（杨过跨境个人 IP / kuachu / 掌象官方 + Blog）。
- **内容范式**（承 a16z S-1）：barbell content；每周 1 篇 longform → 多平台 fan-out；signal 来自人（个人 IP）非品牌；owned（blog/站）优先于 rented（平台）。

### D4. 门控阶梯（两门 closed，deny-by-default，逐级开）

- **两门**（承 GHL 双门模型）初始 **全 closed**：manifest v2（`capabilities[].status=placeholder` + `runtime_gates[].default_state=closed`）与 learning_sources.yaml。**激活 = 物理编辑 manifest 文件**，**而非仅翻 env var**——gate 可为 `kind=env_var`，但 manifest 内的 `default_state`/`status` 才是 fact-emit boundary 的权威 fail-closed 开关（未配置时按 default_state=closed）。Rung 2 fact emit 激活只翻 status/default_state，不提升 `write_capability_effective`；`write_capability_effective` none→提升只属于 Rung 3 safe-write 激活。
- **write_capability_declared = write_capability_effective = none**（初始）；任何写先走 shadow（WriteGate shadow-first），人工/BusinessSuccess 验证后才逐级 `observe → recommend → execute_limited`（承 ADR-001 3-tier）。
- **Rung 阶梯**（登记本 ADR，实现后置）：
  - **Rung 0**：scaffold UGE repo + placeholder engine_manifest v2（`write_capability_declared/effective=none`，两门 closed）+ vendored fact-schema copy（byte-pin + freshness，承 N-2 §Cross-repo 未来第 3 份）。
  - **Rung 1**：read-only metrics（各阵地只读指标）+ content_fanout **draft**（只产计划，不发）。
  - **Rung 2**：fact emit（growth_outcome / write_outcome 进 GHL 流，仍不写外部平台）。
  - **Rung 3**：safe write（先可全自动世界：YouTube/blog/kuachu，shadow→execute_limited）。
- **北极星 = `attributed_qualified_signup`**（非 raw signup）。qualified 判定字段形状由 N-2 taxonomy ADR 的 summary profile 钉死；**判定规则**在 UGE SPEC 定义。**度量前提 = Attribution Blocker**（见 Downstream）：北极星在 lead/attribution event 落地前**不可度量**，故 Rung 2 的 growth fact 有真数据依赖 PR3。

### D5. 只读参考边界（同事产品 / 上游 fork）

- 掌象AI 代码 = **FirstLightClaw**（同事拥有、负责迭代）：**只读参考，本地改动永不推送、不改其业务逻辑**。北极星的 lead ingest **不改同事代码**——只在 `zhangxiang.com` form **旁**挂 fire-and-forget event，UGE lead-ingest job 是 emit 主体（承 N-2 impedance 解决）。
- 承 SYSTEMS.md Fork 纪律：上游 fork 只作模式基准，不搬模块。

## Non-scope（本 ADR 明确不做，防 scope 蔓延）

- ❌ 不创建 engine_manifest.yaml 实例（Rung 0 / PR2 之后）
- ❌ 不编辑 fact-schema enum（`source_system`/`artifact_type` 的实际 carve-in = PR2）
- ❌ 不写 Hands 执行代码、不定 KillSwitch/WriteGate/TrustBoundary 细则（后续 Hands-execution ADR）
- ❌ 不定具体内容日历 / KPI 数值 / playbook 实现（UGE SPEC）
- ❌ **PR1 不碰任何运行代码**（zhangxiang / FirstLightClaw / kuachu）。未来 PR3/PR4 是**受控的 instrumentation / router 改动**（zhangxiang form 旁挂 fire-and-forget event、kuachu CTA 迁 Link Router），**均不改 FirstLightClaw 业务逻辑、不改同事产品行为**（承 D5 只读边界）。

## Consequences

**优势**：UGE 边界与门控在写任何代码前钉死；double-plane 职责不混；北极星以可度量的 `attributed_qualified_signup` 定义，防优化虚荣指标；两门 closed + Rung 阶梯保证 deny-by-default、可回滚。
**代价**：多一层 Hands 物理边界 → 需凭证中介 + Wake/Resume + GuardChain 三套已有模式协同；北极星度量被 Attribution Blocker 阻塞，Rung 2 真数据需等 PR3。

## Downstream（决策包与 PR 排序；本 ADR 之外）

- **PR1 `uge-contracts-proposed`**（本决策包）：`ADR-UGE-Fact-Taxonomy.md` + 本 ADR + SYSTEMS.md 两行登记（Proposed/D0）。**无 schema enum 编辑。**
- **PR2 `uge-fact-schema-carve-in`**：`source_system +user-growth-engine`、`artifact_type +growth_outcome`（event+record 双改）+ fixtures + importer/validator 测试（承 N-2 §DoD，守 21）。**须在本 ADR + taxonomy ADR review 通过后。**
- **PR3 `uge-lead-ingest-attribution`**（Attribution Blocker）：zhangxiang form 旁挂 lead event + UGE-owned ingest + PII redaction + qualified summary validator。使北极星可度量。
- **PR4 `kuachu-router-attribution`**：kuachu CTA 从硬编码 affiliate 直链迁到 Link Router（mint click_id）。
- 之后：Rung 0 scaffold → Rung 1 read-only + fanout draft → Rung 2 fact emit → Rung 3 safe write。

## Rejected alternatives

1. **UGE 作为 Layer-3 产品线** —— UGE 产 domain truth（增长判定）并被 loamwise 调度，是引擎不是产品；掌象AI/kuachu 才是产品。**否决**。
2. **执行放控制面本机（不分 Hands）** —— 违背用户既定的双平面部署；且平台自动化/直播/真机操作需独立执行节点隔离 blast radius。**否决**。
3. **「能自动就全自动」（含抖音/小红书/直播）** —— 撞平台反同质化/降权红线与 AI 标注法；风险不对称。**否决**：可全自动世界（YouTube/blog/kuachu）先行，风险世界人工门。
4. **北极星 = raw signup** —— 可被刷量/低质注册污染，非商业价值。**否决**：定义为 `attributed_qualified_signup`。
5. **先 scaffold repo 再补契约** —— 会让每条 wiring 各自发明 artifact_type/边界，污染 identity 空间与职责边界。**否决**：contract-first，先登记后建。
6. **本 ADR 同时改 fact-schema enum** —— 把「决策包」与「contract mutation 包」混进一个 PR，回滚粒度差、review 焦点散。**否决**：schema carve-in 拆到 PR2，本 PR 保持纯决策。
