---
artifact_scope: meta
artifact_name: OpenClaw-Capability-Boundary
artifact_role: harvest
target_layer: 0
is_bghs_doctrine: no
---

# ADR — OpenClaw Capability Boundary（P1-a）

**Status**: Accepted
**Date**: 2026-04-16
**Accepted-Date**: 2026-04-17
**Decision Makers**: LiYe
**SSOT**: `_meta/adr/ADR-OpenClaw-Capability-Boundary.md`
**References**: `_meta/adr/ADR-Architecture-Doctrine-BGHS-Separation.md`（必读前置）
**Source**: `/Users/liye/github/openclaw/`（fork 自 `openclaw/openclaw`，只读参考）

---

## Context

LiYe Systems 的 Layer 0（LiYe OS）是制度底座，负责定义"能力边界"——什么是平台核心 contract，什么是可替换的实现，什么是 plugin 不得越界的特权。

OpenClaw 是个人 AI 助手平台，把"plugin 主权 vs capability contract"做成了清晰的运行时模型。本 ADR 萃取它的 boundary discipline，用来加固 LiYe Layer 0 的能力注册边界——**不吸收**它的产品形态、不吸收它的 native-plugin 信任假设、不吸收"多 channel 个人助手"世界观。

本 ADR 严格遵守 P1-Doctrine 的 BGHS 分类规则与 Meta Declaration 模板。**本 ADR 不重新发明 Doctrine**，只引用并落实其在 Layer 0 能力边界场景下的约束。

---

## 上游核心做法（OpenClaw 的 boundary 模型）

### O1. Plugin 是 ownership boundary，Capability 是 core contract

OpenClaw 把"谁拥有代码"和"系统能做什么"这两件事**显式分开**：

- **Plugin**：所有权单位（一家供应商、一个功能整合）
- **Capability**：核心定义的公共接口契约（11 项，固定枚举）

文档原话见 `/Users/liye/github/openclaw/docs/plugins/architecture.md:25-44`、`:223-280`。一个 plugin 可注册多个 capabilities（如 `openai` plugin 同时提供 text/speech/image/media-understanding），但**capability 的契约本身只能由 core 定义，plugin 不得新增 capability 类别**。

### O2. 中心化注册 + 重复注册拒绝

- Plugin 通过 `api.registerProvider()`、`api.registerChannel()`、`api.registerHook()` 等向 core registry 注册
- 同名 provider/channel/hook 重复注册被显式拒绝，记录 `PluginDiagnostic`，加载继续但该注册被忽略
- 注册方法清单与防护点定位见 `/Users/liye/github/openclaw/src/plugins/types.ts:1869-1957` 与 `/Users/liye/github/openclaw/src/plugins/registry.ts:241,470,522`

意义：plugin 不能"覆盖"另一个 plugin，core 是唯一的仲裁者。

### O3. 核心保留的不可下沉职责

OpenClaw 把以下能力**保留在 core**，不开放给 plugin：

| 核心保留 | 位置 |
|---------|------|
| Session / message dispatch | `/Users/liye/github/openclaw/src/gateway/server-channels.ts` |
| Manifest 验证与 enablement 决策 | `/Users/liye/github/openclaw/src/plugins/loader.ts` |
| Capability registry 本身（plugin 不能新增 capability 类别） | `/Users/liye/github/openclaw/src/plugins/registry.ts` |
| Tool safety policy（allow/deny + owner-only） | `/Users/liye/github/openclaw/src/agents/tool-policy.ts:19-150` |
| Gateway operator scope（`operator.admin/write/read`） | `/Users/liye/github/openclaw/src/plugins/types.ts:1906-1910` |
| Plugin 文件系统访问边界（`api.resolvePath()` 限定 plugin root） | core API |

**Plugin 可观察、可贡献、不可改写**这些核心决策。

### O4. Hook 系统是观察+变异点，不是控制点

- 23+ 个 lifecycle hooks（`before_model_resolve` / `inbound_claim` / `message_sending` / `gateway_start` 等），见 `/Users/liye/github/openclaw/src/plugins/hook-types.ts:55-84`
- Hook 执行顺序由 registry 控制，plugin **不能阻止其他 plugin 的 hook 运行**
- Hook 用于观察与最小变异（如 normalize model id、override prompt），不是控制流接管

### O5. 信任边界与沙箱缺口（OpenClaw 的取舍）

- **Native plugin 无沙箱**：与 core 同进程同信任边界（`/Users/liye/github/openclaw/docs/plugins/architecture.md:442-452`）
- **Workspace plugin 可 shadow bundled plugin**：开发/补丁场景的有意设计

这是 OpenClaw 在"个人助手 / 单用户 / 单进程"上下文下的合理取舍，**但不适用于 LiYe Systems**——见下文 §不吸收。

---

## 吸收什么

| 编号 | 吸收项 | 理由 |
|------|-------|------|
| **A1** | "Plugin = ownership boundary, Capability = core contract" 这条**根本分类原则** | 直接对应 P1-Doctrine 的 Governance（capability contract）vs Hands（plugin 实现）分离 |
| **A2** | **Capability 类别只能由 core 定义**（plugin 不得新增 capability kind） | Layer 0 制度底座的本职职责，不可下放 |
| **A3** | **重复注册显式拒绝 + 诊断记录**（不静默接受、不允许覆盖） | Governance invariant：注册边界单调（plugin 不能改写他人） |
| **A4** | **核心保留 dispatch / registry / policy / auth 决策**（plugin 只能 observe + 最小变异） | 防止"agent loop / approval / scope 检查被 plugin 拦截改写"的越界 |
| **A5** | **Plugin 文件系统访问受 root 限定**（不允许任意访问 host fs） | Hands 的执行边界，必须有 capability path scope |
| **A6** | **Gateway operator scope 三级**（admin / write / read） | Layer 0 暴露 gateway 时的最小权限模型 |

---

## 不吸收什么

| 编号 | 不吸收项 | 理由 |
|------|---------|------|
| **R1** | **Native plugin 无沙箱**（与 core 同信任边界） | LiYe Systems 的 Domain Engine 与 Loamwise plugin 必须有显式信任边界，不得共享 host 进程的所有特权 |
| **R2** | **Workspace plugin shadow bundled plugin** 机制 | 在开发期合理，但生产期会绕过 contract 验证。LiYe 用 quarantine + ADR 替代 shadow |
| **R3** | **23+ 个 lifecycle hook 的细粒度** | 这是 model-contingent harness 设计（Brain 范畴），会随模型/用例变化。LiYe 只在 Layer 0 暴露最小 hook 集合，hook 扩张归 Loamwise |
| **R4** | **"个人助手 + 多 channel 接入"产品形态** | OpenClaw 的 channel/provider 抽象服务于个人 AI 助手；LiYe 的 Layer 0 不接 channel，channel 概念归 Layer 3 产品线 |
| **R5** | **Hook 注入决策逻辑（如 `before_model_resolve`）** | LiYe Governance 不允许把决策走 prompt/hook 注入；决策必须在 contract / policy ADR 明文 |
| **R6** | **`api.registerSecurityAuditCollector(collector)` 的"plugin 自报审计"模式** | 审计写入路径必须由 core 控制（见 P1-e Session taxonomy）；plugin 不得自己声明"审计已生成" |
| **R7** | **Gateway 作为单一 control plane** | LiYe 是分层架构（Layer 0/1/2/3），不存在唯一 gateway 集中所有 control。OpenClaw 的 operator scope 模型可吸收，gateway 一元化不可吸收 |

---

## 与 LiYe Systems 分层与 BGHS 的映射

> 本节不再定义 BGHS 规则——参见 P1-Doctrine §1 裁决规则与 §2 Component Declaration。本节只把 OpenClaw 的具体组件映射为 LiYe 视角下的分类，作为"哪些类别需要 Layer 0 capability boundary 保护"的参照。

| OpenClaw 组件 | LiYe 视角的 primary concern | 在 LiYe Systems 的对应位置 |
|--------------|---------------------------|--------------------------|
| Capability registry（11 项 capability 契约） | **Governance** | Layer 0 — `_meta/contracts/` 与本 ADR 的 Contract Sketch |
| Plugin loader（manifest-first 验证） | **Governance** (secondary: Hands) | Layer 0 — capability registration gate（待建） |
| Plugin runtime（jiti 加载） | **Hands** | Layer 1 / Layer 2 — Loamwise 与各 Engine 的实现 |
| Lifecycle hook 集合 | **Brain** | Layer 1 — Loamwise 的 harness（不在 Layer 0） |
| Tool policy（allow/deny / owner-only） | **Governance** | Layer 0 — 现有 `src/control/a3-write-policy.ts` 的扩展 |
| Gateway operator scope | **Governance** | Layer 0 — `src/gateway/openclaw/hmac.ts` 已有，待扩展 scope 三级 |
| Session/thread bookkeeping | **Session** | Layer 0 — `data/traces/`（authoritative session event streams，参见 P1-Doctrine §5.5） |
| Native plugin（无沙箱） | — | **不吸收**（见 R1） |

**容易错判的点**（按 P1-Doctrine §1 反例速查的格式补充）：

| 容易错判 | 正确判法 |
|---------|---------|
| 把 "capability contract" 判为 Hands（"反正最后是要被调用的"） | Contract 跨模型代际不变 → Governance；调用实现 → Hands |
| 把 "lifecycle hook 列表" 判为 Governance（"它管 plugin 怎么挂钩"） | hook 列表随 harness 演化 → Brain；"必须有 hook 边界"这条规则 → Governance |
| 把 "plugin 注册接口" 判为 Brain（"是 API 设计"） | 注册边界是制度（不可被 plugin 改写）→ Governance；接口的具体形状 → Hands 实现细节 |

---

## Boundary Rules（裁判手册）

以下规则适用于 LiYe Systems 任何"能力 / 注册 / 插件 / 扩展"相关决策。**违反 = 架构违规**。

### B1. Capability 类别由 Layer 0 独占定义

- **新 capability 类别**（如"价格情报"、"广告写操作"、"会话检索"）的契约必须在 Layer 0 `_meta/contracts/` 中定义
- **任何 Layer 1/2/3 组件不得自行声明新的 capability kind**——只能实现 Layer 0 已定义的 kind
- 新 capability kind 的引入必须经独立 contract ADR

> 对应 OpenClaw 的 A1/A2

### B2. 注册边界单调，禁止覆盖

- 任何 capability / engine / skill 的注册一旦成立，**其他注册者不得覆盖**
- 同名重复注册必须**显式失败 + 诊断写入 session log**（不是静默接受、不是 last-write-wins）
- 替换注册必须经"撤销旧注册 → 验证一致性 → 新注册"三步，不允许原地改写

> 对应 OpenClaw 的 A3。**禁止**继承 OpenClaw 的 workspace shadow（R2）

### B3. 决策面与执行面分离

以下决策**不得下沉到 plugin / tool wrapper / hook**：

| 决策类型 | 必须由 |
|---------|--------|
| **Capability 准入** | Layer 0 capability registration gate |
| **Approval 判定** | Loamwise approval-state-machine 或 Layer 0 policy ADR |
| **Tool safety policy 判定** | Layer 0 tool-policy（如 `src/control/a3-write-policy.ts`） |
| **Operator scope 判定** | Layer 0 gateway 层 |
| **Session 写入路径** | Layer 0 session contract（参见 P1-e）；**plugin 不得自行声明"审计完成"** |

Plugin / Engine 可**观察**这些决策（通过最小 hook 集合），可**贡献输入**（如 candidate 元数据），但**不得拦截改写**。

> 对应 OpenClaw 的 A4，并修补 R6（plugin 不得自报审计）

### B4. 信任边界显式，禁止"原地特权扩散"

- Plugin / Engine 必须有显式 trust boundary 声明（最低权限默认）
- **不得继承 host 进程的所有特权**（这是 R1 的反命题）
- 文件系统访问受 capability path scope 限定（对应 A5）；网络访问受 capability 声明限定
- 没有显式声明的能力 = 没有该能力（fail-closed，不是 fail-open）

### B5. Hook 集合最小化，并归属 Brain

- Layer 0 仅暴露**结构性 hook**（capability lifecycle: register / activate / deactivate / unregister）
- **决策 hook（如 `before_model_resolve` 类）不在 Layer 0**——归 Loamwise harness（Brain）
- Hook 的扩张必须经 Loamwise 的 harness contract，不得偷偷扩到 Layer 0

> 对应 R3、R5

### B6. Gateway 不是唯一 control plane

- Layer 0 gateway（如 `src/gateway/openclaw/`）只暴露**与 Layer 0 capability 相关**的 RPC
- 其他控制权限属于其他层（Loamwise 调度、Engine 内部 control）
- **不得把所有控制集中到一个 gateway**——这是 R7

> Operator scope 三级（admin / write / read）可吸收（A6），gateway 一元化不可吸收

---

## Contract Sketch

### §1. CapabilityKind Registry（Layer 0 独占定义）

```typescript
// 位置：_meta/contracts/capability/capability-kind.schema.yaml （待建）
// 由 Layer 0 维护；Layer 1/2/3 只能引用，不能新增

type CapabilityKind = string  // 形如 "engine.write.amazon-ads-bid"
                              //      "session.event-stream.v1"
                              //      "guard.content-scan.v1"
                              //
                              // 注：本 ADR 仅给出命名示例。具体的命名模式
                              // （如三段式 grammar / regex 校验）留给后续
                              // contract schema 定义；不在本 ADR 内写死。

interface CapabilityKindRegistration {
  kind: CapabilityKind
  layer_introduced: 0           // 永远是 0；非 Layer 0 不能新增
  contract_adr: string          // 必填，指向定义此 kind 的 ADR
  contract_schema: string       // 必填，指向 schema 文件
  introduced_at: string         // ISO 8601
  superseded_by: string | null  // 若被替代，指向新 kind
  status: 'proposed' | 'active' | 'frozen' | 'superseded'
}
```

**入库规则**：

- 新增 `CapabilityKind` 必须经独立 contract ADR
- `layer_introduced` 字段固定为 `0`（registration validator 强制 + schema 默认值约束）
- `contract_adr` 与 `contract_schema` 缺一不入库

### §2. CapabilityRegistration（注册条目，由 Layer 1/2/3 提交）

```typescript
// 任何 Engine / Skill / Guard / Adapter 注册"我能做什么"时使用

interface CapabilityRegistration {
  capability_id: string         // 形如 "amazon-growth-engine:bid_write"
  kind: CapabilityKind          // 必须引用已注册的 kind（B1）
  owner: {
    layer: 1 | 2 | 3            // Layer 0 不作为 owner（Layer 0 只定义 kind）
    component: string           // e.g., "amazon-growth-engine"
    declaration_path: string    // 指向 owner 的 Component Declaration
  }
  trust_boundary: TrustBoundaryDecl     // 见 §4，B4 强制
  side_effects: SideEffectDecl[]        // 写操作 / 网络 / 文件 / etc
  observed_by: string[] | null          // 允许 observe 此 capability 的其他 component（最小集合）
  registered_at: string
  status: 'pending' | 'active' | 'quarantined' | 'revoked'
}
```

**注册边界规则（B2 落地）**：

```typescript
function register(reg: CapabilityRegistration): RegisterResult {
  // B1: kind 必须由 Layer 0 已定义
  if (!capabilityKindRegistry.has(reg.kind)) {
    return { ok: false, reason: 'unknown_kind', diagnostic: ... }
  }
  // B2: 重复注册显式拒绝
  const existing = registry.findByCapabilityId(reg.capability_id)
  if (existing && existing.status === 'active') {
    return { ok: false, reason: 'duplicate_active', diagnostic: ... }
  }
  // B4: trust_boundary 缺失 = fail-closed
  if (!reg.trust_boundary || !reg.trust_boundary.fs_scope) {
    return { ok: false, reason: 'missing_trust_boundary' }
  }
  // 写入注册 + 写入 session event stream（B3 + P1-e）
  return { ok: true, registration_id: ... }
}
```

### §3. Decision Plane Separation（B3 落地）

```typescript
// 决策类型白名单（初始集合见下方枚举）
enum DecisionKind {
  CAPABILITY_ADMISSION   = 'capability.admission',     // Layer 0 only
  APPROVAL               = 'approval',                  // Loamwise or Layer 0 policy ADR
  TOOL_SAFETY            = 'tool.safety',               // Layer 0 tool-policy
  OPERATOR_SCOPE         = 'operator.scope',            // Layer 0 gateway
  SESSION_WRITE          = 'session.write',             // Layer 0 session contract (P1-e)
}

interface DecisionAuthority {
  kind: DecisionKind
  authoritative_layer: 0 | 1
  authoritative_path: string    // 指向决策实现 / contract
  observers_allowed: string[]   // 允许 observe 此决策的 component 集合
  override_allowed: false       // 永远 false；override 必须走 ADR
}
```

**`DecisionKind` 的扩展通道（分层规则，与 P1-Doctrine D5 一致）**：

| 扩展类型 | 修订通道 |
|---------|---------|
| 新增一种**具体决策类型**（如新增一种写操作分类、新增一种 quota 决策） | **Layer 0 后续 contract ADR**（不修 Doctrine、不修本 ADR 的 Boundary Rules） |
| 决策类型涉及**新的 BGHS 元规则 / artifact taxonomy / declaration 字段**（如引入新的 concern、改 declaration 模板） | 修 P1-Doctrine（再 supersede 本 ADR 的相关条款） |

**Plugin / Engine / Hook 不得出现在任何 `DecisionKind` 的 authoritative_path 中**——由 **registration validator 强制**（schema 给出字段约束，validator 在注册时检查；非纯 schema 即可达成）。

### §4. TrustBoundaryDecl（B4 落地）

```typescript
interface TrustBoundaryDecl {
  // 文件系统：必须显式声明可访问的根（fail-closed）
  fs_scope: {
    read_roots: string[]    // 绝对路径或 "{component_root}/..."
    write_roots: string[]
  }
  // 网络：必须显式声明可访问的 domain / 协议
  network_scope: {
    egress_allowlist: string[]   // hostname patterns
    ingress: 'none' | 'gateway-only'
  }
  // 进程：是否允许在 host 进程内运行
  in_process: boolean            // false = 独立进程 / 容器
  // 凭据：指向 CredentialBroker seam（P1-f）
  credential_path: string | null
}
```

**默认值**：`fs_scope` 与 `network_scope` 缺省 = 空（什么都不允许）。**没有显式声明 = 没有该能力**。

### §5. Operator Scope（B6 落地，Gateway 暴露层使用）

```typescript
type OperatorScope = 'operator.admin' | 'operator.write' | 'operator.read'

interface GatewayMethodRegistration {
  method: string                 // RPC method name
  scope_required: OperatorScope
  capability_id: string | null   // 如果方法暴露某 capability，指向其 registration
  audit_required: boolean        // true = 调用必须写入 session event stream
}
```

**保留命名空间**：`config.*` / `exec.approvals.*` / `wizard.*` 等强制 `operator.admin`，由 Layer 0 gateway 拒绝任何 plugin 注册到这些命名空间。

### §6. End-to-End 注册时序

```
[Layer 1/2/3 component]                  [Layer 0 registry]
        |                                          |
        |--- (1) submit CapabilityRegistration --->|
        |                                          |--- check B1 (kind exists)
        |                                          |--- check B2 (no duplicate)
        |                                          |--- check B4 (trust_boundary)
        |                                          |
        |<-- (2) RegisterResult{ok:true, id:..} ---|
        |                                          |--- (3) write session event
        |                                          |    (P1-e session.write)
        |                                          |
        |--- (4) operate via capability ---------->|
        |                                          |--- (5) DecisionAuthority check
        |                                          |    (B3, no plugin override)
        |                                          |
        |<-- (6) result + receipt ----------------|--- (7) write session-adjacent
                                                       receipt (P1-e)
```

---

## Non-goals

- **不实施 §1-§6 的代码**——本 ADR 仅定义 contract 草图与 boundary 规则
- **不重新定义 BGHS 分类规则**——见 P1-Doctrine §1
- **不引入 channel / provider 抽象**——这是 OpenClaw 产品形态，不归 Layer 0
- **不实现 plugin 沙箱机制**——本 ADR 只声明"必须有 trust boundary"，沙箱实现由各 component 自行选择（容器 / VM / WASM / 进程隔离）
- **不规定 CredentialBroker 的具体实现**——交给 P1-f
- **不规定 Session event stream 的具体格式**——交给 P1-e
- **不修改 OpenClaw 上游代码**——上游 fork 仅作只读参考

---

## Adoption Checkpoints

按以下顺序采纳本 ADR 的 Boundary Rules：

| Checkpoint | 触发时机 | 验证项 |
|-----------|---------|-------|
| **C1. Doctrine + Boundary 双就位** | 本 ADR 通过后 | P1-Doctrine + 本 ADR 入库；SYSTEMS.md 引用本 ADR 为 Layer 0 能力边界 SSOT |
| **C2. CapabilityKind registry 落地** | 第一个新 contract ADR（如 P1-e）入库时 | `_meta/contracts/capability/capability-kind.schema.yaml` 建立；Layer 0 强制 schema |
| **C3. Trust boundary 强制** | 任何新 Engine / Skill 注册到 Layer 0 时 | Component Declaration 必含 `TrustBoundaryDecl`；fail-closed 默认 |
| **C4. 决策面分离审计** | 每季度一次 | 扫描 `Layer 1/2/3` 代码，确认无 plugin / hook 出现在 `DecisionAuthority.authoritative_path` 中 |
| **C5. Gateway scope 三级生效** | 现有 `src/gateway/openclaw/` 改造时 | `OperatorScope` 三级落到 HMAC 验证后；保留命名空间由 gateway 注册 validator 强制（plugin 不得注册到 `config.*` / `exec.approvals.*` / `wizard.*` 等命名空间） |
| **C6. 现有 ADR-004 supersede** | 本 ADR 通过后立即 | `ADR-004-OpenClaw-Capability-Boundary.md` 标注 `Superseded by: ADR-OpenClaw-Capability-Boundary.md`。**这是主题级 supersede（同一主题以新版为准），不要求物理删除旧文件**——旧 ADR 作为历史记录保留 |

**本 ADR 不实施任何代码**。Adoption checkpoints 是后续阶段的入库门，不在本轮执行。

---

## Appendix A: 与 ADR-004（旧版）的关系

旧 `ADR-004-OpenClaw-Capability-Boundary.md` 写于 2026-04-14，基于 `openclaw-skillgate` 仓（Layer 0 扩展插件，非 OpenClaw 本体）。

**本 ADR supersede ADR-004 的关键差异**：

1. 直接基于 OpenClaw 上游本体（`/Users/liye/github/openclaw/`）萃取，源材料更准确
2. 引入 P1-Doctrine 的 BGHS 分类，旧 ADR 写作时尚无此 doctrine
3. 添加 Meta Declaration 头部
4. 把"Registration Scan Gate"等 skillgate 特有的扫描细节剥离——那些应在 P3（Skill candidate quarantine）中讨论
5. 把"决策面分离"做成显式 schema（B3 + DecisionAuthority），而非旧版的散文描述

**ADR-004 处置**：保留为历史记录，状态改为 `Superseded by: ADR-OpenClaw-Capability-Boundary.md`（实际改字段动作不在本 ADR 范围，留待入库流程执行）。

---

**Version**: 1.0.0
**Last Updated**: 2026-04-16
