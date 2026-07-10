# LiYe Systems Architecture v1.2

> 整个系统生态的单一真相源（SSOT）。
> 所有 codebase 的角色、层级、依赖关系以此为准。
> 只放低频、稳定、制度级内容。不放 sprint 计划或临时状态。
>
> **优先级规则：** 当 repo-local CLAUDE.md 与本文件冲突时，
> 系统角色、层级、依赖方向以本文件为准；
> 本地开发约束（编码规则、commit 纪律）以 repo CLAUDE.md 为准。
> commit 纪律 = portfolio 执行基线（指针）+ repo delta；repo delta 可收紧、不得放松。
> 执行基线定义见 `_meta/policies/DEFAULT_SKILL_POLICY.md` Policy 9 (Surgical Scope)。
> 待办准入治理见 `_meta/policies/BACKLOG_INTAKE_POLICY.md` (Backlog Intake Policy; PILOT VALIDATED / AGE)。

## 四层架构

### Layer 0: LiYe OS — 制度底座
LiYe OS 的长期身份是 governance / contract compiler + 窄控制面工具：定义 doctrine、schema、validator、eval、evidence/reality contract、引擎协议，以及有真实 consumer 的语义合约。
工具必须是“被调用 + 有界工作 + 退出”；不预建常驻、中介通信并持有状态的通用 agent runtime。世界模型 T1/T2/T3 等语义只有在真实引擎 consumer 被证实时才收割入合约，实现下沉到各引擎。

### Layer 1: Loamwise — 编排中间层
当前 L1 席位仍由 Loamwise 占据，但其执行范围已收窄：不是 AGE 默认执行路径，只接受自然出现的跨域/跨账户等 in-scope 案例。
2026-08-23 复评窗结束前不得提前撤销 L1；若届时仍零自然调用，则在同一变更中撤销 mandatory L1、改为“L1 可选、按需出现”，并完成 D2 定义改写和 Loamwise 收割/封存。未来 runner 不自动继承 L1 席位。

### Layer 2: Domain Engines — 专业执行器
在特定领域产出 domain truth。遵守 engine_manifest 与治理合约，各自实现执行面；当前 D2 正式定义仍引用 Loamwise，须等 execution contract 落地后的独立变更才能改写。

### Layer 3: Product Lines — 业务产品线
面向用户的产品系统。可复用共享治理语言与经过验证的代码，但不共享 privileged execution cell；客户凭证、状态、写信封、刹车和审计链默认隔离。

## Codebase Registry

| Codebase | Layer | Role | Upstream | Downstream | Maturity | CLAUDE.md |
|----------|-------|------|----------|------------|----------|-----------|
| liye_os | 0 | governance / contract compiler + 窄工具 | — | contract consumers | — | Y |
| loamwise | 1 | 收窄的条件式编排层；非 AGE 默认路径；2026-08-23 复评 | liye_os (contracts) | in-scope domain engines | — | Y |
| amazon-growth-engine | 2 | 亚马逊广告引擎 | liye_os (contracts) | — | D0 formal label；promotion pending | Y |
| chaming | 2 | 域名投资管理 | liye_os (contracts) | — | D0 | Y |
| user-growth-engine | 2 | 用户增长引擎 | liye_os (contracts) | — | D0 formal label；promotion pending | — |
| silkbay | 3 | Medusa v2 后端 Hub；处置定级 pending | — | storefront-kit, sf-*（declared） | grade pending | Y |
| storefronts | 3 | 品牌店铺前端集合；处置定级 pending | silkbay, storefront-kit（declared） | — | grade pending | Y |
| kits | 3 | 共享包；处置定级 pending | — | 已证消费者 + 声明边 | grade pending | — |
| themes | 3 | 主题资产包；处置定级 pending | liye_os builder（declared） | 已证站点消费者 + 声明边 | grade pending | — |
| growth-hub | 3 | 内容站资产；处置定级 pending | — | Link Router → sf-*（declared） | grade pending | — |
| sites | — | 独立站点项目；不得驻留 L0 checkout | — | — | per-site | — |

主轴 B 资产的 standing strategic privilege 已撤销，但这不等于删除授权。逐仓部署、续费、包/consumer、外部用户与可恢复性仍须按 inventory 逐项定级；当前全部 disposition / grade 为 `PENDING`。证据与边界见 `_meta/portfolio/decommission/main-axis-b-inventory-2026-07-10.md`。

### Workspace navigator authority

本文件是 codebase 角色、层级、依赖方向以及参考/卫星关系的版本化 canonical source。工作区根的非版本化 `CLAUDE.md` 只能是纯 pointer：指向本文件、repo-local `CLAUDE.md` / `AGENTS.md` 与 operator-private 工件；不得复制 repo 表、角色、依赖、gap、计数或运行状态。

根 pointer 只能在对应 SSOT PR 合并后由 operator 作为 chosen-manual 动作应用。默认不建生成器；只有 operator 明确要求根文件继续承载会漂移内容时，才重新评估 derived artifact 方案。

本文件记录的是制度关系，不是本机目录清单。某 checkout 是否存在、当前 branch/remote、是否 dirty，以及 ignored/nested Git territory，均须在作出文件面结论时实时核验，不能由根 pointer 或单一 `git status` 推断。

## 依赖方向

### Governance（治理/合约）
```
liye_os → loamwise               OS 合约定义 → 中间层执行
liye_os → domain engines         engine_manifest 协议约束
```

### Runtime（运行时/调度）
```
loamwise → domain engines        当前 D2 目标态；不是 AGE 当前默认执行路径
growth-hub → Link Router → sf-*  DECLARED；live caller / route 未由 C1 证实
```

### Package / API
```
sf-* → storefront-kit            npm: @loudmirror/storefront-kit
storefront-kit → silkbay         DECLARED HTTP: Medusa v2 Store API；live call 未证实
attribution-kit → storefronts    CONFIRMED repo consumers
attribution-kit → growth-hub     DECLARED；growth-hub remote main 未见 package/runtime
```

依赖图使用证据词汇：`CONFIRMED` 是当前 Git/runtime 证据；`DECLARED` 只表示文档或 manifest 声明，不能替代 live 调用。C1 未建立的依赖边不得在 C2 中臆造修复。

### 禁止方向
```
禁止: Layer 2 ↔ Layer 3 直接依赖
禁止: Layer 3 → Layer 0/1 反向依赖
```

## 跨 Repo 变更影响规则

| 变更源 | 必须检查 |
|--------|---------|
| silkbay API | storefront-kit, 所有 sf-* |
| storefront-kit 发版 | 所有 sf-*, growth-hub CTA |
| attribution-kit 发版 | storefronts, growth-hub |
| engine_manifest schema | loamwise, 所有 domain engines |
| loamwise dispatch 协议 | 所有已接入 domain engines |
| liye_os governance 合约 | loamwise |

## Domain 成熟度模型

| 级别 | 名称 | 含义 |
|------|------|------|
| D0 | Standalone | 独立运行，未注册引擎协议 |
| D1 | Registered | 已声明 engine_manifest，可被系统识别 |
| D2 | Dispatchable | 可被 Loamwise 调度执行 |
| D3 | Governed | evidence / replay / policy / audit 全链路统一 |

### 当前状态

| Engine | 正式成熟度标签 | Manifest write（declared / effective） | 已观察执行边界 |
|--------|----------------|---------------------------------------|----------------|
| AGE | D0；D1 checklist 已有证据，promotion rule pending | `none / none`（v2） | 引擎内部已有受监督写入与 receipt/readback；不等于 OS manifest write，per-client cell readiness 尚未认证 |
| Chaming | D0 | manifest 未发现 | 只读分析 + 人工执行；持仓维护/续费/state backup 属 continuity `(c) irreversible-loss`，增长投资为 Tier 3 有界赌注、可归零 |
| UGE | D0；D1 checklist 已有证据，promotion rule pending | `none / none`（v2） | `fact_emit` capability 与学习源 registry 已启用，runtime env 仍是第二门；无外部平台写，真实站点 source wiring 尚未认证 |

`Write Capability` 的 manifest 字段只描述 OS/engine contract 所声明的外部写能力，不能覆盖引擎内部执行事实；“checklist 已满足”也不自动改变正式 D0 标签。AGE/UGE 的 promotion gate 在成文前保持 pending，禁止静默升降级。

### Engine 接入清单

**D0 → D1 (Registered):**
- [ ] 创建 engine_manifest.yaml 实例（**新 engine 参照 `engine_manifest.schema.v2.yaml`**：`schema_version: "2.0"` + `write_capability_declared`/`write_capability_effective` + `capabilities[]` + `runtime_gates[]`；旧无 `schema_version` 的 manifest 才 fallback `engine_manifest.schema.yaml` v1）
- [ ] 声明 playbooks + required_permissions
- [ ] 声明 data_sources + `write_capability_declared`/`write_capability_effective` 级别
- [ ] 通过 schema 验证

**D1 → D2 (Dispatchable):**
- [ ] 实现 loamwise ActionDispatcher 协议
- [ ] 通过 GuardChain 验证
- [ ] Task Ledger 集成

**D2 → D3 (Governed):**
- [ ] Evidence Package 标准化输出
- [ ] Audit trail 接入统一审计链
- [ ] Replay 验证通过
- [ ] Policy compliance 全覆盖

## Portfolio 方向与投资准入

**三年主形态：A（深自动化精品）。** 代运营是主业；已验证付费需求与客户责任优先，其次是主业 flywheel、有界资产型赌注，最后才是通用平台完整性。AGE / DTC 交付引擎自动化属于 Tier 1 主业成长投资，不是平台美学。

LiYe OS 默认是 for-self infrastructure。投资只接受三种拉力：

1. `demand-pull`：活跃价值流中反复出现的真实风险或 incurred manual，并有具名 consumer + SLA；
2. `risk-pull`：具名 hazard + 可信损失剧本；
3. 有界研究：doctrine / ADR / SPEC / fixture / 一次性探针；偶发 S 级，禁止留下 resident code 或前向兼容承诺。

“新 domain 接入成本”只在真实 onboarding 发生时作为事件指标，不授权通用性预建。任何 resident runtime 必须重新通过 demand-pull 或 risk-pull 立项。

- **B（shared chassis）预注册触发器：** AGE 与 DTC 出现至少两个同形、反复发生的 incurred manual 或 hazard，且两侧各有真实 consumer。触发前只投资 contract spine。
- **Portfolio view 预注册触发器：** operator 跨 cell 手工对账反复发生，且可声明 consumer + SLA；触发前不建。
- **C（多 operator 服务网）不是目标形态：** 只吸收 continuity、dead-man、service playbook 与授权信封件。自动化是主扩容路径；第二 operator 先承担连续性、adversarial sampling 与峰值容量。

原主轴 B（silkbay / storefronts / growth-hub / kits / themes）已失去 standing strategic privilege；存量资产按 inventory 先枚举、后定级，禁止从“今天不会再建”推导“应删除”。UGE 的旧业务席位同时作废，须在 Pilot-1 证据窗口（不早于 2026-08-07 / 2026-08-17）按真实商业关系重新登记。

## Known Gaps

| Gap | 现状 | 收口策略 |
|-----|------|---------|
| AGE / UGE 成熟度标签 | v2 manifest 与 D1 checklist 证据存在，正式标签仍为 D0 | 单独成文 promotion gate；C2 不自动升 D1 |
| Loamwise L1 | 已收窄、非 AGE 默认路径，2026-08-23 复评未到期 | 不提前收窗；复评与 execution contract、D2 改写、收割/封存绑定 |
| 主轴 B 存量 | standing privilege 已撤销；逐仓 grade/disposition 仍 pending | 消费 C1 inventory，逐 root 证据包后由 operator 定级；禁自动删除 |
| L0 websites | Kuachu 已迁出；其余 business sites / example 仍待迁；UGE 指针有漂移 | 按 C1.5 逐站迁移；当前 Live Site Gate fail-open，不得称机器 enforcement |
| AGE client cells | 当前共享 runtime 不构成已认证隔离 | 写能力开启前完成 per-client credential + write partition gate 的机器 enforcement 与实弹认证 |
| 世界模型语义 consumer | AGE consumer 目前只是待证假设 | 以真实 import/call chain、runtime registration、调用记录或 receipt 审计，不作保留前提 |

Websites 当前拓扑、grounding 与逐站 disposition 见 `_meta/portfolio/decommission/websites-disposition-inventory-2026-07-10.md`。该 inventory 只授权事实同步，不授权迁移、部署或 gate 修复。

## 架构原则（BGHS Separation）

LiYe Systems 所有组件归属四种 concern 之一（正交于 Layer 0/1/2/3）：

- **Brain** — 当前模型能力下的 harness 逻辑（model-contingent，可随模型代际替换）
- **Governance** — 跨模型代际的治理不变量（不得因模型升级而删除或放松）
- **Hands** — 执行动作的 tools / executors / adapters
- **Session** — 外部化、持久化的事件日志 + replay 契约

规则（详见 `_meta/adr/ADR-Architecture-Doctrine-BGHS-Separation.md`，待写入）：
- BGHS 是分类视角，不是 runtime 层级或目录结构
- 每个 component 声明 primary_concern + 可选 secondary_concern
- 混合组件允许，但必须声明未来拆分方向
- Meta artifacts（Doctrine / ADR）不参与 BGHS 归类，用 Meta Declaration 模板
- 不得据 BGHS 创建新目录或新 runtime 层级

灵感来源：Anthropic Managed Agents（三分法），LiYe Systems 升级为四分法以保护显式治理。

### 声明模板（三种，按 artifact 种类选用）

**Component Declaration** — 用于 Codebase Registry 条目 / Skill / Agent / Crew / 可运行组件
```
artifact_scope: component
component_name, layer (0|1|2|3)
primary_concern (Brain|Governance|Hands|Session), secondary_concern
model_contingent_items, model_independent_invariants
session_source_of_truth, credential_path, wake_resume_entrypoint
explicit_non_goals, future_split_direction
```

**Meta Declaration** — 用于 Doctrine / Contract ADR / Harvest ADR / Decision ADR
```
artifact_scope: meta
artifact_name, artifact_role (doctrine|contract|harvest)
target_layer (0|1|2|3|cross|none)
bghs_constrains (yes|no)  # 仅 doctrine = yes
```

**Reference Declaration** — 用于外部架构概念 / fork 的参考仓 / 论文 / 供应商文档
```
artifact_scope: reference
artifact_name, source_kind (concept|fork|paper|vendor_doc), source_uri
```

## 参考与卫星项目（Codebases）

| Codebase | 性质 | 作用 | 上游 |
|----------|------|------|------|
| openclaw (fork) | 只读参考 | 个人 AI 网关架构参考（通信层、插件 hook、安全审计） | openclaw/openclaw |
| hermes-agent (fork) | 只读参考 | 自进化 agent 架构参考（学习循环、纵深防御、会话检索） | NousResearch/hermes-agent |
| openclaw-skillgate | Layer 0 扩展 | Skill 供应链治理插件（扫描、评分、隔离） | — |
| claw-price-intel | Layer 2 数据源 | Amazon 价格情报 MCP server（Keepa 集成） | — |
| financial-services | 只读供应商参考 | 金融工作流 agents / plugins / managed-agent patterns；不作为 runtime 依赖 | anthropics/financial-services |
| FirstLightClaw | 外部协作参考 | 独立产品代码库；LiYe Systems 只读参考，不取得其业务逻辑控制权 | external owner |

此表是原 workspace root“索引外仓库”关系的 canonical 归宿，不是“本机所有 Git roots”枚举。未进入 Codebase Registry 的条目不因出现在本表而获得 Portfolio 席位、投资优先级或执行权限。

`age-main-cron` 不另列为 codebase：它是 `amazon-growth-engine` 的 main worktree。凡涉 AGE 文件面的结论必须同时核该 main worktree；凡声称某文件/机制“不存在”，必须列出检索过的全部 AGE checkouts。

### Fork 纪律
- 上游参考仓只提供 pattern benchmark，不作为实现主干，不直接作为 runtime 依赖
- Fork 仓库只做只读参考，不进入长期 fork 维护
- 需要的能力通过 ADR 决议后独立实现，不直接搬模块
- 定期 fetch upstream 保持可查阅，不 merge 到本地分支

## Architecture References（概念/文档）

| Reference | 类型 | 来源 |
|-----------|------|------|
| Managed Agents | 架构原则 / 元视角（Brain-Hands-Session 三分法启发，LiYe 升级为 BGHS 四分法） | anthropic.com/engineering/managed-agents |

此区块只收架构概念，不收可运行代码。与"参考与卫星项目"区分：Codebases 可 clone/fetch，Architecture References 仅为决策参考。

## 进化路线（能力吸收）

从 OpenClaw / Hermes Agent / Managed Agents 吸收 patterns 的路线图。
**状态说明（2026-07-10）：以下为历史候选队列，不是 standing implementation authorization。** Doctrine / ADR / SPEC 可作为有界研究；任何常驻代码、注册表、部分 runtime 或前向兼容承诺，必须重新满足 demand-pull / risk-pull。Loamwise 相关实现还受 2026-08-23 复评窗约束。

**原则：先防火再繁殖，先 ADR 再代码；语义入宪、实现下沉、中央常驻体退场。**

### P1 — 8 份 ADR（Doctrine-first 顺序）

| 代号 | ADR | artifact_role | target_layer |
|------|-----|---------------|--------------|
| P1-Doctrine | ADR-Architecture-Doctrine-BGHS-Separation | doctrine | cross |
| P1-a | ADR-OpenClaw-Capability-Boundary | harvest | 0 |
| P1-b | ADR-Hermes-Skill-Lifecycle | harvest | cross |
| P1-c | ADR-Hermes-Memory-Orchestration | harvest | 1 |
| P1-d | ADR-Loamwise-Guard-Content-Security | harvest | 1 |
| P1-e | ADR-Session-and-Session-Adjacent-Taxonomy-Federated-Query | contract | cross |
| P1-f | ADR-Credential-Mediation | contract | cross |
| P1-g | ADR-AGE-Wake-Resume | contract | 2 |

**写作顺序：** P1-Doctrine 必须第一个写（其他 7 份需引用）。

### P2-P5 — 行为吸收（顺序不变）

| 顺序 | 代号 | 内容 | 执行位置 | 硬约束 |
|------|------|------|---------|--------|
| P2 | B1 | Content Threat Detection 最小集（3 个 Guard） | loamwise/govern/ | **必须先 shadow mode**（只观测不拦截） |
| P3 | A1 | Governed Learning Loop candidate-only | loamwise/construct/ | **quarantine-first**，candidate 不是 skill |
| P4 | C1 | Session Retrieval（truth-first） | loamwise/align/ | **先检索结构化真相，后检索会话文本**；基于 P1-e taxonomy |
| P5 | C2 | Context Compression | loamwise/reason/ | 仅限长任务场景 |
| 不做 | — | Smart model routing / auto skill repair / Honcho 用户建模 / vault 基础设施 / 统一 session 存储 / monorepo | — | 不进路线图 |

### Loamwise 吸收边界
如真实 in-scope 案例触发 Loamwise 继续演进，它只吸收经立项的 runtime pattern，不吸收产品人格：
- 不引入重用户建模（Honcho）
- 不引入 auto skill repair
- 不引入 smart routing
- 不引入"对话代理就是一切"的世界观

## 运维纪律

- 改系统分层、角色、依赖方向 → **只改本文件**
- 改 repo 本地开发约束 → 只改 repo CLAUDE.md
- 新增 domain 或产品线 → 先在本文件 Codebase Registry 注册，再创建 CLAUDE.md
- 新 Component 必须附 Component Declaration；新 ADR 必须附 Meta Declaration
- 架构原则（BGHS）改动 → 必须经 Doctrine ADR 修订，不得直接改本文件
