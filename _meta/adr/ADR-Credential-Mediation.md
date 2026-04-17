---
artifact_scope: meta
artifact_name: Credential-Mediation
artifact_role: contract
target_layer: cross
is_bghs_doctrine: no
---

# ADR — Credential Mediation（P1-f）

**Status**: Accepted
**Date**: 2026-04-16
**Accepted-Date**: 2026-04-17
**Decision Makers**: LiYe
**SSOT**: `_meta/adr/ADR-Credential-Mediation.md`
**References**:
- `_meta/adr/ADR-Architecture-Doctrine-BGHS-Separation.md`（Governance invariants；Component Declaration `credential_path` 单 URI 字段——本 ADR 不覆写它，另立 `credential_bindings` 承载多绑定）
- `_meta/adr/ADR-OpenClaw-Capability-Boundary.md`（§4 TrustBoundaryDecl.credential_path 指向 CredentialBroker seam）
- `_meta/adr/ADR-Hermes-Memory-Orchestration.md`（凭据绝不进入 MemoryTier）
- `_meta/adr/ADR-Loamwise-Guard-Content-Security.md`（TruthWriteGuard 捕获凭据泄漏）
- `_meta/adr/ADR-Session-and-Session-Adjacent-Taxonomy-Federated-Query.md`（凭据值绝不出现在 session / session-adjacent，仅审计事件记录访问）

---

## Context

LiYe Systems 的任何 component 都可能需要访问凭据（API key / OAuth token / HMAC secret / DB 密码 / LLM provider key / 上游 vendor 令牌）。当前状态：

- **liye_os**：`LIYE_HMAC_SECRET` / `NOTION_API_KEY` / `NOTION_DATABASE_ID` / `GEMINI_API_KEY` / `SLACK_BOT_TOKEN` 等散落在各子包的 `.env`（已 gitignore）
- **amazon-growth-engine**：Amazon Advertising API 凭据（Refresh Token + Client ID/Secret）由 AGE 自身管理
- **Loamwise（目标态）**：需要协调多个 engine 的凭据，本身不应持有任何 engine 的原始凭据

**问题**：
1. 没有统一的"凭据如何被获取"契约——每个 component 自行读 env 变量
2. 没有防止凭据流入 MemoryTier / session 的统一拦截点
3. 没有凭据访问的审计轨迹
4. 未来 Loamwise 调用 AGE 写操作时，不应该让 AGE 的凭据经过 Loamwise 上下文

**但也不应走另一个极端**：
- 不引入中心化 Vault 基础设施（违反 SYSTEMS.md "明确不做"清单）
- 不引入服务网格级密钥管理
- 不要求所有 component 立刻迁移到同一存储后端

**解决方案**：定义 **CredentialBroker seam**——一个最小的中介契约。`EnvCredentialBroker` 作为默认实现（沿用现有 env 变量模式）。未来可在 seam 之下接入 HashiCorp Vault / AWS Secrets Manager / 1Password 等，**但本 ADR 不立项 vault**。

本 ADR 是 **contract 类**，回答"凭据中介的最小接口 + 访问纪律"，不实施任何存储后端。

---

## 现状盘点

### S1. 现有凭据来源

| Component | 凭据获取方式 | 存储位置 |
|-----------|------------|---------|
| liye_os gateway (HMAC) | `process.env.LIYE_HMAC_SECRET` | 本地 `.env`（gitignore） |
| liye_os Notion sync | `process.env.NOTION_API_KEY` | `tools/notion-sync/.env` |
| liye_os Slack proxy | `process.env.SLACK_BOT_TOKEN` 等 3 项 | `Extensions/slack-proxy/.env` |
| liye_os Information Radar | `env.GEMINI_API_KEY` 等 | Cloudflare Worker `wrangler secret` |
| AGE | 自管 Amazon Advertising credentials | AGE 内部 config / env |
| Loamwise (目标) | 调用 AGE 时不应见到 AGE 凭据 | **尚无契约** |

### S2. 现有的"必须避免"教训

- **不得**让凭据值进入 `data/traces/` 或 session-adjacent audit log（P1-e 硬约束）
- **不得**让凭据值进入 MemoryTier 任一层（P1-c 硬约束）
- **不得**让凭据出现在 prompt 或 LLM 响应（P1-d TruthWriteGuard 捕获）
- **不得**把凭据 hardcode 进代码或 CLAUDE.md

### S3. 上游参考启发（非 harvest）

| 来源 | 启发 |
|------|------|
| OpenClaw `CLAUDE.md` / docs | Plugin 不直接持有凭据，通过 core API 取用 |
| Hermes `secret management` | 使用 env 变量 + `.env` + fail-closed |
| AWS SDK 的 credential chain 模式 | Broker 可链式回退（先查本地 env，再查文件，再查其他） |

---

## 吸收 / 不吸收

| 编号 | 吸收 | 理由 |
|------|------|------|
| **A1** | **CredentialReference（seam URI）** — component 声明它需要的凭据"名字"，不持有值 | Governance 边界：component 不应知道凭据从哪里来 |
| **A2** | **EnvCredentialBroker 作为默认实现** — 沿用现有 env 变量模式 | 避免一次性重写所有 component；兼容现状 |
| **A3** | **Broker 可链式回退**（env → file → other） | 兼容从 `.env` 渐进迁移到更高级存储 |
| **A4** | **每次凭据访问写 session-adjacent audit 事件**（仅记录访问行为，不记录值） | Session 治理可见性；与 P1-e 一致 |
| **A5** | **凭据值永不进入 MemoryTier / session / prompt / trace payload** | 与 P1-c/d/e 一致 |
| **A6** | **Component 必须在 Component Declaration 中声明所需凭据**（**新字段** `credential_bindings: CredentialBinding[]`；本 ADR 不覆写 Doctrine 的 `credential_path: null \| string`——后者保留为单 URI 指针） | 与 P1-Doctrine Component Declaration + P1-a TrustBoundaryDecl 对接；不在本 ADR 内偷改 Doctrine schema |

| 编号 | 不吸收 | 理由 |
|------|--------|------|
| **R1** | **中心化 Vault 基础设施**（HashiCorp Vault / AWS Secrets Manager 作为必选） | SYSTEMS.md "明确不做"清单；vault 作为 seam 之下的可选 broker 可以，但不立项 |
| **R2** | **统一凭据存储迁移**（强迫所有 component 一次性迁移） | 违反"多源共存"纪律；broker seam 允许每个 component 独立迁移 |
| **R3** | **凭据租借 / 动态颁发**（如 STS AssumeRole） | 可作为未来 broker 实现之一，但本 ADR 不定义租借语义 |
| **R4** | **凭据 rotation 自动化**（自动轮换 / 自动失效重签） | rotation 归 broker 实现自由；seam 只要求 broker 能响应 "refresh/invalidate" 信号 |
| **R5** | **Broker 自己做 approval / policy decision** | broker 只做"取值 + 审计"；access policy 归 P1-a DecisionAuthority / policy ADR |
| **R6** | **Multi-tenant 凭据隔离** | 本 ADR 不处理 tenant；若需 tenant scope，由后续 capability ADR 扩展 CredentialReference |
| **R7** | **LLM-driven 凭据选择**（"模型决定用哪个 key"） | 凭据选择由 CredentialReference 静态声明；LLM 无权选择 |
| **R8** | **把 CredentialBroker 做成 Loamwise 唯一入口** | broker 是 seam，不是中心；每个 component 可有自己的 broker 实例 |

---

## 与 LiYe Systems 分层与 BGHS 的映射

> 不再定义 BGHS 规则——见 P1-Doctrine §1。

| 概念 | LiYe 视角 primary concern | 在 LiYe Systems 的对应位置 |
|------|--------------------------|--------------------------|
| CredentialReference（seam URI 格式） | **Governance** | Layer 0 — 本 ADR §1 |
| CredentialBroker interface | **Governance** (contract) | Layer 0 — 本 ADR §2 |
| EnvCredentialBroker 实现 | **Hands** | Layer 1 / Layer 2 / Layer 0（各自实例），default 库可放 liye_os |
| 访问 policy / 授权 | **Governance** | Layer 0 DecisionAuthority（P1-a）+ 后续 policy ADR |
| 凭据访问审计 | **Session** (access audit events) + **Governance** (审计规则) | 审计事件是 SESSION_ADJACENT.credential-audit（新子类，下见） |
| Redaction utility（脱敏凭据值） | **Hands** | Layer 1 共享 utility（P1-d GuardEvidence 脱敏的堂兄） |

**Layer 归属**：
- **Layer 0（liye_os）**：定义 CredentialReference / CredentialBinding / CredentialBroker interface / CredentialAuditRecord 规范；提供 EnvCredentialBroker 默认实现作为 reference library
- **Layer 1（loamwise）**：使用 broker 的 caller；**不持有 engine 凭据**；自身可有自己的 broker（用于 Loamwise 本身需要的 secrets）
- **Layer 2（engines）**：各 Engine 通过 broker 取自己需要的凭据；不向外暴露凭据值
- **Layer 3（products）**：不直接使用 broker（通过 Layer 2 Engine 或 Layer 1 调度）

**容易错判**：

| 容易错判 | 正确判法 |
|---------|---------|
| 把 EnvCredentialBroker 判为 Governance（"它管 env 变量") | 具体存储后端 → Hands；"必须有 broker seam" 这条规则 → Governance |
| 把凭据访问审计判为 Brain 输出（"它是推理产物") | 审计是事实 → Session (SESSION_ADJACENT.credential-audit) |
| 把 CredentialReference / credential_bindings 字段判为 Hands（"它指向实际位置") | reference URI 与绑定声明 = Governance 契约；broker 解析过程 → Hands |

---

## Mediation Rules（裁判手册）

### M1. 凭据流向三条硬底线

**不得出现凭据值**的位置（fail-closed，违反 = 架构违规）：

| 位置 | 约束来源 |
|------|---------|
| MemoryTier 任何一层 | P1-c §1 + §5 MemoryUsePolicy |
| SessionEventStream.payload | P1-e F1 + 本 ADR M4 redaction |
| SessionAdjacentArtifact 除 CREDENTIAL_AUDIT 外的任何子类 | 本 ADR M4 |
| Prompt 装配（frozen snapshot） | P1-c O5 + P1-d ContextInjectGuard |
| Code / CLAUDE.md / ADR / 任何版本化文件 | pre-commit hook（hands） + Guards |
| Error message / log output（除显式脱敏） | 本 ADR M4 |

**允许出现凭据值**的位置（仅此 3 处）：

1. CredentialBroker 内部（受 broker 自身信任边界保护）
2. 存储后端（env / file / vault / etc.）
3. Consumer 的 in-memory 使用期（**短期、不持久化**，使用完毕立刻释放）

### M2. Component 声明 credential_bindings，不直接读凭据

- 任何 component 不得直接 `process.env.XXX_KEY` 读取凭据（例外见 M7）
- Component 必须在 Component Declaration 的 **`credential_bindings` 字段**（本 ADR 新增；不覆写 Doctrine 既有的 `credential_path`）声明一个或多个 CredentialBinding
- 运行时通过 CredentialBroker 解析 CredentialReference 获取凭据值
- Doctrine 既有的 `credential_path: null | string` 字段保留为**单 URI 指针**语义；承载多绑定（带 purpose / broker_required）= 本 ADR 新增的 `credential_bindings`

### M3. Broker 是 seam，每个 component 可有自己的 broker

- LiYe Systems **不要求**所有 component 使用同一个 broker 实例
- 允许 Loamwise 有自己的 broker（取 Loamwise 自己的 secrets）
- 允许 AGE 有自己的 broker（取 Amazon Advertising 凭据）
- Loamwise 调用 AGE 时**绝不代管 AGE 凭据**——AGE 在自己进程内用自己的 broker

### M4. Redaction 是强制工具，不是可选优化

- 凭据值在任何离开 broker 的路径上必须经过 redaction（hash / 截断 / masked placeholder）
- Redaction 必须在**值离开 broker** 之前完成（而不是在下游 log sink 里补救）
- Redaction 后的结果（如 `cred://liye-os/notion-api-key:***:sha256=abc...`）可出现在 SESSION_ADJACENT.credential-audit；**原始值永不出现**

### M5. 每次凭据访问写 credential-audit 事件

- 每次 `broker.resolve(ref)` 成功或失败都必须写一条 SESSION_ADJACENT.credential-audit 事件
- 事件包含：`credential_path` / `requester_component_id` / `requested_at` / `outcome: 'resolved' | 'denied' | 'not-found' | 'broker-error'` / `redacted_value_hint`（永不包含值）
- Audit 事件属 session-adjacent，append-only

### M6. Broker 可链式回退，但每一跳都独立审计

- Broker 可声明 fallback chain（如：env → file → parent-broker）
- 每一跳都独立写 audit 事件，标注 `chain_step` 与 `chain_result`
- 任何一跳返回值即终止；全链未命中 = fail-closed

### M7. 引导期特权仅限 Layer 0 bootstrap

- 仅有一类例外可直接读 env：**Layer 0 自身的 bootstrap**（创建第一个 broker 实例所需的 broker 自身配置，如 "broker 到哪里读 secrets"）
- 此例外范围窄：**只读 "broker 自身配置"**，**不读任何 component 的业务凭据**
- bootstrap 路径必须在 Layer 0 显式声明，并写入 audit
- **所有 bootstrap access 的 audit 事件必须带固定 purpose 常量**：`purpose = "broker-bootstrap"`
  - 便于后续查审计时把 bootstrap 类访问与普通 resolve 清晰分开
  - 任何 `purpose = "broker-bootstrap"` 但 `requester_layer ≠ 0` 的 audit 事件 = 架构违规信号，validator / audit 扫描器应报警

### M8. Broker policy 独立，不耦合进 broker 实现

- Broker **只做**"取值 + 审计"
- 是否允许某 component 访问某凭据 = **policy 决策**，归 P1-a DecisionAuthority
- Broker 在 resolve 前调用 policy 接口（若 policy 拒绝 = 返回 denied + 审计）
- 这样 broker 实现可独立演化，policy 也可独立演化

### M9. 凭据值的生存期最短

- Consumer 使用完凭据值应**立刻**从内存释放（置 null / overwrite buffer）
- 长期持有凭据（如 HTTP client 持有 auth header）应尽量用短期 token（由 broker 或存储后端颁发）
- Broker 可支持 `refresh` / `invalidate` 信号（R4 提到的不自动化 rotation，但 seam 允许接入）

---

## Contract Sketch

### §1. CredentialReference（seam URI）

```typescript
// 格式：cred://<owner>/<name>[?<qualifier>=<value>&...]
// 示例：
//   cred://liye-os/notion-api-key
//   cred://liye-os/hmac-secret
//   cred://amazon-growth-engine/ads-api-refresh-token?marketplace=US
//   cred://loamwise/internal-service-token

type CredentialReference = string  // 形如 "cred://owner/name[?qualifier=value]"

interface ParsedCredentialRef {
  scheme: 'cred'                    // 固定
  owner: string                     // 拥有此凭据的 component（注册时匹配 Component Declaration）
  name: string                      // 凭据逻辑名（不是值，也不是存储后端的 key 名）
  qualifiers: Record<string, string>
}

// 命名约束（validator 强制）：
//   - owner 必须是一个已注册的 Component Declaration component_name
//   - name 必须仅含 [a-z0-9-]，长度 3-64
//   - 不得包含存储后端信息（如 env 变量名）—— 那是 broker 内部映射的事
```

### §2. CredentialBroker interface

```typescript
interface CredentialBroker {
  broker_id: string                 // 本 broker 实例的唯一 id
  declared_scope: BrokerScope       // 本 broker 服务哪些 owner

  // 主入口
  resolve(
    ref: CredentialReference,
    ctx: ResolutionContext,
  ): Promise<ResolutionResult>

  // 可选：rotation / invalidation 信号（不强制实现）
  invalidate?(ref: CredentialReference): Promise<void>
  refresh?(ref: CredentialReference): Promise<void>

  // 审计注入点：broker 实现必须调用此接口写 SESSION_ADJACENT.credential-audit
  // 具体接口由 audit 子系统提供（与 P1-e 对接）
  readonly audit_sink: CredentialAuditSink
}

interface BrokerScope {
  owners_served: string[]           // 本 broker 可服务的 owner 列表
  layer: 0 | 1 | 2                  // broker 所在层（Layer 3 不应有 broker）
}

interface ResolutionContext {
  requester_component_id: string    // 调用方 component（用于审计 + policy）
  requester_layer: 0 | 1 | 2 | 3
  purpose: string                   // 为什么要这个凭据（用于审计，可读）
  authorization_ref: string | null  // 引用此次访问的授权证据（v1 允许 null）
                                    //
                                    // v1 可填入：
                                    //   - 引用某 policy ADR / 应急流程 ADR 的路径
                                    //   - 引用已有的 manual approval record id
                                    //   - null（仅当后续 policy 接口判定不需要显式授权时）
                                    //
                                    // 未来（P1-a 扩展后）：引用 DecisionKind.CREDENTIAL_ACCESS
                                    //   的 DecisionAuthority 记录——届时 null 不再可接受，
                                    //   由 policy ADR 显式收紧为必填
}

type ResolutionResult =
  | { outcome: 'resolved';    value: SecretValue;          audit_id: string }
  | { outcome: 'denied';      denial_reason: string;       audit_id: string }
  | { outcome: 'not-found';                                audit_id: string }
  | { outcome: 'broker-error'; error: string;              audit_id: string }

// SecretValue 是一个不可 stringify 的值包裹，强制 consumer 显式 reveal
// 防止意外序列化 / 日志输出
interface SecretValue {
  reveal(): string                  // 显式调用才拿到真值
  toJSON(): '***REDACTED***'        // JSON 序列化时自动脱敏
  toString(): '***REDACTED***'      // 字符串化时自动脱敏
}
```

### §3. EnvCredentialBroker（default 实现示意）

```typescript
class EnvCredentialBroker implements CredentialBroker {
  broker_id: string
  declared_scope: BrokerScope
  readonly audit_sink: CredentialAuditSink

  // Broker 内部维护一个静态映射：CredentialReference → env 变量名
  // 这个映射由 broker 的构造参数提供，不暴露给 consumer
  private env_map: Record<string, string>    // e.g., { "cred://liye-os/notion-api-key": "NOTION_API_KEY" }

  async resolve(
    ref: CredentialReference,
    ctx: ResolutionContext,
  ): Promise<ResolutionResult> {
    // M8: 先查 policy
    const policy = await checkPolicy(ref, ctx)
    if (policy.denied) {
      const audit_id = await this.audit_sink.append({
        credential_path: ref,
        requester_component_id: ctx.requester_component_id,
        outcome: 'denied',
        chain_step: 0,
        chain_result: 'policy-denied',
      })
      return { outcome: 'denied', denial_reason: policy.reason, audit_id }
    }

    // 查 env 映射
    const envKey = this.env_map[ref]
    if (!envKey) {
      const audit_id = await this.audit_sink.append({
        credential_path: ref,
        requester_component_id: ctx.requester_component_id,
        outcome: 'not-found',
        chain_step: 0,
        chain_result: 'no-mapping',
      })
      return { outcome: 'not-found', audit_id }
    }

    const raw = process.env[envKey]
    if (!raw) {
      const audit_id = await this.audit_sink.append({
        credential_path: ref,
        requester_component_id: ctx.requester_component_id,
        outcome: 'not-found',
        chain_step: 0,
        chain_result: 'env-unset',
      })
      return { outcome: 'not-found', audit_id }
    }

    // M4: redaction hint 写 audit（不写值本身）
    const audit_id = await this.audit_sink.append({
      credential_path: ref,
      requester_component_id: ctx.requester_component_id,
      outcome: 'resolved',
      chain_step: 0,
      chain_result: 'env-hit',
      redacted_value_hint: `sha256:${sha256(raw).substring(0, 12)}...`,
    })
    return {
      outcome: 'resolved',
      value: wrapSecret(raw),
      audit_id,
    }
  }
}
```

### §4. CredentialAuditRecord（SESSION_ADJACENT 子类 CREDENTIAL_AUDIT）

```typescript
// 本 ADR 向 P1-e §1 SessionAdjacentKind 新增一个子类：CREDENTIAL_AUDIT

// SessionAdjacentKind.CREDENTIAL_AUDIT = 'credential-audit'

interface CredentialAuditRecord {
  // SessionAdjacentArtifact 必填字段（P1-e §3）
  artifact_id: string
  adjacent_kind: 'credential-audit'
  owner: { component_id: string; layer: 0 | 1 | 2 }
  derived_from: ArtifactRef[]        // 必须非空，引用触发本次访问的 session event
  audit_subject: null                // CREDENTIAL_AUDIT 不是 QUERY_AUDIT
  storage_location: string
  format_kind: 'ndjson' | 'json'
  is_append_only: true
  hash_self: string
  created_at: string
  registered_by_adr: 'ADR-Credential-Mediation'

  // CREDENTIAL_AUDIT 专用 payload
  credential_path: CredentialReference
  requester_component_id: string
  requester_layer: 0 | 1 | 2 | 3
  purpose: string                    // 人类可读，不含 secret
  outcome: 'resolved' | 'denied' | 'not-found' | 'broker-error'
  chain_step: number                 // M6 fallback chain 中的第几跳
  chain_result: string               // e.g., 'env-hit' / 'file-hit' / 'env-unset' / 'policy-denied'
  redacted_value_hint: string | null // 仅 resolved 时填，且必须脱敏（hash 前缀 / masked placeholder）
  authorization_ref: string | null   // 引用此次访问的授权证据（v1 允许 null，与 ResolutionContext.authorization_ref 一致）
                                     // 未来 DecisionKind.CREDENTIAL_ACCESS 落地后由 policy ADR 收紧为必填

  // 生命周期
  broker_id: string
  resolved_at: string
}

interface CredentialAuditSink {
  append(r: Omit<CredentialAuditRecord, 'artifact_id' | 'hash_self' | 'created_at' | 'adjacent_kind' | 'owner' | 'storage_location' | 'format_kind' | 'is_append_only' | 'derived_from' | 'audit_subject' | 'registered_by_adr'>): Promise<string>
  // 返回 audit_id
}
```

### §5. 与 Component Declaration 对接（P1-Doctrine §2 + P1-a §4）

**字段关系（不覆写 Doctrine）**：

| 字段 | 所属 | 类型 | 语义 |
|------|------|------|------|
| `credential_path` | **P1-Doctrine Component Declaration（既有）** | `null \| string` | 单 URI 指针；指向一条 CredentialReference 或 broker seam 入口。**本 ADR 不覆写其类型** |
| `credential_bindings` | **本 ADR 新增**（optional 字段） | `CredentialBinding[]` | 承载多绑定，每条带 `ref / purpose / broker_required` |

Component 可二选一或并用：简单场景用 `credential_path`（单一凭据指针）；复杂场景用 `credential_bindings`（多绑定 + purpose）。两个字段共存时，`credential_bindings` 是**规范表达**，`credential_path` 仅作简写指针。

**CredentialBinding schema**：

```typescript
interface CredentialBinding {
  ref: CredentialReference              // 形如 cred://owner/name[?q=v]
  purpose: string                       // 人类可读用途描述
  broker_required: 'any' | string       // 'any' 或指向某个具体 broker_id
}
```

```yaml
# Component Declaration 中 credential_bindings 字段用法（示例）
artifact_scope: component
component_name: amazon-growth-engine
layer: 2
primary_concern: Hands
# ...
credential_path: null                   # Doctrine 既有字段；本示例不使用
credential_bindings:                    # 本 ADR 新增字段
  - ref: cred://amazon-growth-engine/ads-api-refresh-token
    purpose: "Amazon Advertising API access"
    broker_required: any                # 任何满足 declared_scope 的 broker
  - ref: cred://amazon-growth-engine/ads-api-client-secret
    purpose: "Amazon Advertising OAuth client"
    broker_required: any
# ...
```

**validator 强制**：
- 若声明 `credential_bindings`，必须为 `CredentialBinding[]` 形式（数组）
- 每个 binding 的 `ref.owner` 必须等于当前 `component_name`（不允许声明别人的凭据）
- 对应的 broker 必须可 resolve（启动时 self-test，但不 reveal 值）
- Doctrine 既有的 `credential_path` 字段保持 `null | string` 类型约束——本 ADR **不**把它改成数组

### §6. SecretValue（防意外泄漏包装）

**Contract-level 要求（语言中立）**：

任何 broker 实现的 `ResolutionResult` 若返回 `outcome: 'resolved'`，其 `value` 必须满足：

1. **默认序列化必须 redacted**：对应语言的默认 stringify / JSON serialize / debug-print / inspect 路径，产出必须是 masked placeholder（例如 `***REDACTED***`），**不得**产出原值
2. **需显式 reveal 才能取值**：必须存在一个显式命名的方法（如 `reveal()` / `unwrap()` / `getSecret()`），consumer 调用该方法才能获得原值；没有该显式调用 = 拿不到原值
3. **原值生存期最短**：reveal 返回的原值由 consumer 负责尽快释放（与 M9 一致）

语言特定实现自行选择具体机制（可能是 class + override、proxy、struct + method 等）。**Contract 层不规定具体语言构造**。

---

**Implementation example (Node.js / TypeScript)**：

```typescript
function wrapSecret(raw: string): SecretValue {
  return {
    reveal: () => raw,
    toJSON: () => '***REDACTED***' as const,
    toString: () => '***REDACTED***' as const,
    // 语言特定：Node.js util.inspect 自定义钩子
    [Symbol.for('nodejs.util.inspect.custom')]: () => '***REDACTED***',
  }
}

// Consumer 必须显式 reveal 才能拿到值（防止意外日志 / JSON 序列化泄漏）
const result = await broker.resolve(ref, ctx)
if (result.outcome === 'resolved') {
  const secret = result.value.reveal()    // 显式取值
  try {
    await useSecret(secret)               // 短期使用（M9）
  } finally {
    // Consumer 有责任在使用后尽快丢弃引用
  }
}
```

Python / Rust / Go 等语言有各自的 default-repr 机制（如 Python `__repr__` / `__str__`，Rust `Debug` / `Display` trait），实现必须在本语言内覆盖这些默认路径，达到上述 Contract-level 要求。

### §7. Validator

```typescript
function validateCredentialRef(ref: string): ParsedCredentialRef {
  const m = ref.match(/^cred:\/\/([a-z0-9-]+)\/([a-z0-9-]{3,64})(\?.*)?$/)
  if (!m) throw new Error('invalid_cred_ref_format')
  // 进一步：owner 必须是已注册的 component_name
  if (!componentRegistry.hasComponent(m[1])) throw new Error('unknown_owner')
  return { scheme: 'cred', owner: m[1], name: m[2], qualifiers: parseQualifiers(m[3]) }
}

function validateComponentDeclaration(decl: ComponentDeclaration): void {
  // Doctrine 既有字段 credential_path: null | string —— 仅校验格式，不展开数组
  if (decl.credential_path) {
    const parsed = validateCredentialRef(decl.credential_path)
    if (parsed.owner !== decl.component_name) {
      throw new Error('credential_path_owner_must_match_component_name')
    }
  }
  // 本 ADR 新增字段 credential_bindings: CredentialBinding[]
  if (decl.credential_bindings) {
    for (const cb of decl.credential_bindings) {
      const parsed = validateCredentialRef(cb.ref)
      if (parsed.owner !== decl.component_name) {
        throw new Error('credential_binding_owner_must_match_component_name')
      }
      if (!cb.purpose || cb.purpose.length === 0) {
        throw new Error('credential_binding_purpose_required')
      }
    }
  }
}
```

---

## Non-goals

- **不实施 §1-§7 的代码**——本 ADR 仅定义 seam contract
- **不立项 Vault 基础设施**（R1 + SYSTEMS.md "明确不做"）
- **不定义 STS / AssumeRole / 短期 token 颁发语义**（R3）
- **不定义 rotation 自动化**（R4）
- **不处理 multi-tenant 凭据隔离**（R6）
- **不定义具体存储后端**（除 EnvCredentialBroker 默认实现外，file / vault / OAuth 等都不立项）
- **不修改任何 component 的现有 env 读取代码**——迁移由各 component 在 `credential_bindings` 声明入库时自行推进
- **不定义 CredentialBroker 之间的"代理 / 联邦"**——broker seam 明示允许每个 component 独立 broker

---

## Adoption Checkpoints

| Checkpoint | 触发时机 | 验证项 |
|-----------|---------|-------|
| **C1. 本 ADR + P1-a/b/c/d/e 六件就位** | 本 ADR 通过后 | 六份 ADR 互引一致；SYSTEMS.md 引用本 ADR 为 Credential Mediation SSOT |
| **C2. CredentialReference 格式冻结** | 第一个 component 声明 `credential_bindings` 时 | `cred://<owner>/<name>[?<qualifier>=<value>]` 格式由 schema 强制；validator 就绪 |
| **C3. EnvCredentialBroker default 库就位** | Loamwise / AGE 任一 component 迁移前 | liye_os 提供 reference impl；`env_map` 由 broker 配置注入，不出现在 component 代码 |
| **C4. SessionAdjacentKind.CREDENTIAL_AUDIT 入 P1-e 枚举** | **本 ADR 通过同时（同批 commit）执行 P1-e companion patch** | P1-e §1 SessionAdjacentKind 扩展一项 `CREDENTIAL_AUDIT`；由本 P1-f（contract ADR）驱动 P1-e 的小修订（**不修 Doctrine**；两份 ADR 不得对同一枚举表述不一致） |
| **C5. SecretValue 包装强制** | 任何 broker 实现 resolve 时 | 返回值必须经 wrapSecret；默认 stringify / serialize 必须 redacted（具体语言机制见 §6 implementation example） |
| **C6. Component Declaration `credential_bindings` 格式收紧** | 任何 component 首次声明 credential_bindings 时 | validator 强制 owner 匹配 + ref 格式正确 + purpose 非空 + broker 可 resolve（self-test）；Doctrine 既有 `credential_path: null \| string` 仅做格式校验，不展开数组 |
| **C7. 现有硬编码 env 读取渐进迁移** | 各 component 自行推进 | 不强制 deadline；但新增 component 必须走 broker；老 component 在重大改动时迁移 |

**本 ADR 不实施任何代码**。

---

## Appendix A: 与 P1-a / P1-c / P1-e 的对接（明示）

### 与 P1-a 对接

| P1-a 字段 | 本 ADR 对应 |
|----------|------------|
| `TrustBoundaryDecl.credential_path: string \| null` | 本 ADR §1 CredentialReference；格式 `cred://...` |
| `DecisionAuthority` kind 中**未列出** credential access | 访问授权归 P1-a DecisionAuthority 的后续扩展（新增 DecisionKind.CREDENTIAL_ACCESS 属 contract ADR 范围，不改 Doctrine） |

### 与 P1-c 对接

- 凭据值**永不进入** MemoryTier 任一层（P1-c §1 + 本 ADR M1）
- `redacted_value_hint` 可出现在 audit 但**不是** memory

### 与 P1-e 对接

- 本 ADR 向 P1-e §1 SessionAdjacentKind 新增 `CREDENTIAL_AUDIT = 'credential-audit'` 子类
- CREDENTIAL_AUDIT 的 `derived_from` 必须非空（与 QUERY_AUDIT 不同，后者可为空）
- CREDENTIAL_AUDIT 的 `audit_subject` 必为 null（QUERY_AUDIT 专用）

### 与 P1-d 对接

- TruthWriteGuard 在扫描 authoritative 写入时**必须检测凭据泄漏模式**（sk-... / secret_... / Bearer ... 等）
- Guard 命中凭据泄漏 = dangerous verdict（硬 block）
- Guard 不得把捕获的凭据写入 GuardEvidence payload——必须 redact

---

## Appendix B: 现有资产迁移路径（NON-NORMATIVE）

| Component | 当前凭据 | 未来 CredentialReference | 迁移优先级 |
|-----------|---------|-------------------------|-----------|
| liye_os gateway | `LIYE_HMAC_SECRET` | `cred://liye-os/hmac-secret` | 中（已隔离在 .env） |
| liye_os Notion sync | `NOTION_API_KEY`, `NOTION_DATABASE_ID` | `cred://liye-os/notion-api-key`, `cred://liye-os/notion-database-id` | 低 |
| liye_os Slack proxy | `SLACK_BOT_TOKEN` 等 3 项 | `cred://liye-os/slack-bot-token` 等 | 低 |
| liye_os Information Radar | `GEMINI_API_KEY` 等 | `cred://liye-os/gemini-api-key` 等 | 低（已在 Cloudflare secret） |
| AGE | Ads API Refresh Token + Client ID/Secret | `cred://amazon-growth-engine/ads-api-refresh-token`, `cred://amazon-growth-engine/ads-api-client-secret`, `cred://amazon-growth-engine/ads-api-client-id` | 高（D0→D1 时应完成） |
| Loamwise（目标） | 未定 | `cred://loamwise/internal-service-token`（自己的 secrets） | 新建即按此 |

**迁移不要求一次完成**。任何 component 的下次重大改动是合适的迁移窗口。

---

**Version**: 1.0.0
**Last Updated**: 2026-04-16
