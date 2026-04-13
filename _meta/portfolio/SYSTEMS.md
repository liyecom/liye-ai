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

## 运维纪律

- 改系统分层、角色、依赖方向 → **只改本文件**
- 改 repo 本地开发约束 → 只改 repo CLAUDE.md
- 新增 domain 或产品线 → 先在本文件 Codebase Registry 注册，再创建 CLAUDE.md
