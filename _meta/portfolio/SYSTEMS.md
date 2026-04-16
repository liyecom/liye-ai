# LiYe Systems Architecture v1.0

> 整个系统生态的单一真相源（SSOT）。
> 所有 codebase 的角色、层级、依赖关系以此为准。
> 只放低频、稳定、制度级内容。不放 sprint 计划或临时状态。
>
> **优先级规则：** 当 repo-local CLAUDE.md 与本文件冲突时，
> 系统角色、层级、依赖方向以本文件为准；
> 本地开发约束（编码规则、commit 纪律）以 repo CLAUDE.md 为准。

## 四层架构

### Layer 0: LiYe OS — 制度底座
定义治理原语、引擎协议、世界模型(T1/T2/T3)、审计合约、MCP 工具协议。
不做具体业务逻辑。

### Layer 1: Loamwise — 编排中间层
将 OS 抽象治理落成可执行管控。
核心：CARGE 管线、Task Ledger、PolicyEngine、GuardChain、KillSwitch。

### Layer 2: Domain Engines — 专业执行器
在特定领域产出 domain truth。遵守 engine_manifest 协议，通过 loamwise 调度（目标态）。

### Layer 3: Product Lines — 业务产品线
面向用户的产品系统。独立于 Layer 0-2 演进。

## Codebase Registry

| Codebase | Layer | Role | Upstream | Downstream | Maturity | CLAUDE.md |
|----------|-------|------|----------|------------|----------|-----------|
| liye_os | 0 | 制度底座 | — | loamwise | — | Y |
| loamwise | 1 | 编排中间层 | liye_os (contracts) | domain engines | — | Y |
| amazon-growth-engine | 2 | 亚马逊广告引擎 | loamwise (目标态) | — | D0 | Y |
| chaming | 2 | 域名投资管理 | loamwise (目标态) | — | D0 | — |
| silkbay | 3 | Medusa v2 后端 Hub | — | storefront-kit, sf-* | — | Y |
| storefronts | 3 | 品牌店铺前端集合 | silkbay, storefront-kit | — | — | Y |
| kits | 3 | 共享包 (attribution-kit) | — | storefronts, growth-hub | — | — |
| themes | 3 | 主题资产包 | liye_os builder | storefronts | — | — |
| growth-hub | 3 | Astro 内容站 | — | Link Router → sf-* | — | — |
| sites | — | 独立项目 | — | — | — | — |

## 依赖方向

### Governance（治理/合约）
```
liye_os → loamwise               OS 合约定义 → 中间层执行
liye_os → domain engines         engine_manifest 协议约束
```

### Runtime（运行时/调度）
```
loamwise → domain engines        dispatch / policy / evidence（目标态）
growth-hub → Link Router → sf-*  内容 → 路由 → 成交
```

### Package / API
```
sf-* → storefront-kit            npm: @loudmirror/storefront-kit
storefront-kit → silkbay         HTTP: Medusa v2 Store API
attribution-kit → storefronts    npm: @loudmirror/attribution-kit
attribution-kit → growth-hub     npm: @loudmirror/attribution-kit
```

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

| Engine | 成熟度 | Write Capability | 备注 |
|--------|--------|-----------------|------|
| AGE | D0 | limited (internal) | 有独立治理框架，可写 bids/keywords/budget |
| Chaming | D0 | none | 只读分析 + 人工执行 |

### Engine 接入清单

**D0 → D1 (Registered):**
- [ ] 创建 engine_manifest.yaml 实例（参照 `liye_os/_meta/contracts/engine_manifest.schema.yaml`）
- [ ] 声明 playbooks + required_permissions
- [ ] 声明 data_sources + write_capability 级别
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

## 两条主轴

**主轴 A — LiYe OS 生态（能力平台）**
liye_os → loamwise → domain engines
North Star: 新增 domain 的接入成本持续下降

**主轴 B — Commerce & Growth（业务产品线）**
silkbay + storefronts + growth-hub + kits + themes
North Star: 站点复制效率 + attribution 完整性

两条主轴独立演进。LiYe OS 是方法论底座，Commerce 是业务场景之一。
不要把产品线硬塞进 OS 体系当 domain，也不要让 OS 层长出业务逻辑。

## Known Gaps

| Gap | 现状 | 收口策略 |
|-----|------|---------|
| AGE 自治 | D0, 独立治理 | Contract-first: 先注册 manifest 到 D1，不强迁移 |
| Chaming 孤岛 | D0 | 先跑通业务，后注册 |
| OS→Loamwise 链路 | 概念对齐，无代码连接 | 协议先行，合约驱动 |
| SilkBay 整合 | W0-W4 计划已定 | 按 W0→W4 顺序执行 |

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
artifact_name, artifact_role (doctrine|contract|harvest|decision)
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
**原则：先防火再繁殖，先 ADR 再代码，Loamwise 只吸收 patterns 不吸收产品人格。**

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
Loamwise 只吸收 Hermes 的 runtime pattern，不吸收它的产品人格：
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
