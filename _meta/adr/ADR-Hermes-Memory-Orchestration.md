---
artifact_scope: meta
artifact_name: Hermes-Memory-Orchestration
artifact_role: harvest
target_layer: 1
is_bghs_doctrine: no
---

# ADR — Hermes Memory Orchestration（P1-c）

**Status**: Accepted
**Date**: 2026-04-16
**Accepted-Date**: 2026-04-17
**Decision Makers**: LiYe
**SSOT**: `_meta/adr/ADR-Hermes-Memory-Orchestration.md`
**References**:
- `_meta/adr/ADR-Architecture-Doctrine-BGHS-Separation.md`（必读前置）
- `_meta/adr/ADR-OpenClaw-Capability-Boundary.md`（capability 边界）
- `_meta/adr/ADR-Hermes-Skill-Lifecycle.md`（lifecycle 治理参照）
- **Forward ref**: `_meta/adr/ADR-Session-and-Session-Adjacent-Taxonomy-Federated-Query.md`（P1-e，提供 session / adjacent 分类与 federated query）
**Source**: `/Users/liye/github/hermes-agent/`（fork 自 `NousResearch/hermes-agent`，只读参考）

---

## Context

LLM-driven 系统的"记忆"不是单一概念。它至少包含：
- 当前会话的事件流（session 本体）
- 上一轮决策留下的回执（session-adjacent）
- 跨会话沉淀的笔记 / 摘要（user/MEMORY 文件）
- 跨会话索引可检索的历史（FTS / 向量）
- 治理性常驻物（contracts / policies / ADRs / verdicts）

Hermes Agent 提供了一套相对成熟的 memory orchestration 实现：provider 抽象、lifecycle hooks、per-turn prefetch、frozen snapshot、tool-based 检索路由。它的"如何把记忆装配进上下文"这一面值得吸收。

但 Hermes 的产品形态把"记忆"几乎等同于"用户对话历史 + 用户画像"，这是 chat agent 的合理选择，**不适用于 LiYe Systems**——LiYe 的决策必须以**结构化真相**（contracts / policies / verdicts / authoritative events）为准，会话文本永远是辅助。

本 ADR 萃取 Hermes 的 orchestration discipline，回答**编排**问题：
- 记忆何时被装配进上下文
- 哪些记忆能参与决策、哪些只能做提示材料
- 检索 / 摘要 / 压缩的决策权归谁
- 编排的 lifecycle 谁负责

**本 ADR 不重新定义 session vs session-adjacent 的分类**——那是 P1-e 的领地。本 ADR 假定 P1-e 的 taxonomy 已存在，只描述编排接口。

---

## 上游核心做法（Hermes 的 orchestration 模型）

### H1. MemoryProvider 抽象 + lifecycle hooks

`/Users/liye/github/hermes-agent/agent/memory_provider.py` 定义 `MemoryProvider` ABC：

```
initialize() → prefetch() → sync_turn() → shutdown()
```

可选 hooks：`on_pre_compress` / `on_memory_write` / `on_delegation`。每个 provider 在不同生命周期点接收事件并贡献内容。

### H2. MemoryManager 中心编排

`/Users/liye/github/hermes-agent/agent/memory_manager.py` 实现 manager：
- 注册 provider
- 编排 lifecycle 调用顺序
- 路由 tool 调用到对应 provider
- 实施 context fencing（防止 provider A 的内容污染 provider B 的上下文）

### H3. Per-turn prefetch + frozen snapshot

`run_agent.py` 在每轮开始时调用 `prefetch()`，把"本轮要用的记忆内容"冻结为 snapshot 注入 system prompt。**snapshot 在该轮内不可变**——这是 prefix cache 稳定性的前提。

### H4. MemoryStore 文件后端 + 安全扫描

`/Users/liye/github/hermes-agent/tools/memory_tool.py`：
- bounded 文件后端（MEMORY.md / USER.md，带大小上限）
- 写入时做 injection / exfiltration 扫描
- 原子写（temp file → fsync → rename）

### H5. session_search_tool（FTS5 + LLM 摘要）

`/Users/liye/github/hermes-agent/tools/session_search_tool.py`：
- FTS5 全文索引跨会话搜索
- 检索结果交 LLM 做 summarization
- 感知 delegation chain（subagent 调用 chain）

### H6. Honcho provider（用户建模 / dialectic Q&A）

`/Users/liye/github/hermes-agent/plugins/memory/honcho/__init__.py`：
- 维护 user 心智模型
- 提供 3 种 recall mode
- 暴露 peer cards（多用户）

**全部为 Hermes 产品形态服务，与 LiYe Systems 决策结构错配**——见 R1-R2。

### H7. 系统提示装配顺序（system prompt assembly）

`run_agent.py` 严格的装配顺序：
- 静态 system instructions
- provider prefetch 内容
- 当前任务上下文
- tool definitions

顺序固定，避免不同来源相互覆盖。

---

## 吸收什么

| 编号 | 吸收项 | 理由 |
|------|-------|------|
| **A1** | **Provider 抽象**（统一接口 + 可插拔后端） | Brain harness 解耦于具体 store；新来源只需实现 interface |
| **A2** | **Lifecycle hooks**（initialize / prefetch / sync / shutdown / on_pre_compress / on_memory_write） | 编排点显式化，便于 Governance 在 hook 上挂检查 |
| **A3** | **Per-turn prefetch + frozen snapshot** | prefix cache 稳定性 + 决策可 replay 的前提（同一轮看到同一份记忆） |
| **A4** | **Context fencing**（provider 之间不互相串） | 防止 context-only 记忆污染 decision-support 通道 |
| **A5** | **写入时 injection / exfiltration 扫描** | Governance 落点：所有记忆写入必须经 GuardChain（与 P1-d 对接） |
| **A6** | **Bounded 文件后端 + 原子写** | Hands 实现的最小契约；防止部分写入污染 |
| **A7** | **System prompt assembly 顺序固定** | Brain harness 的合理纪律，避免顺序不定带来的不确定性 |

---

## 不吸收什么

| 编号 | 不吸收项 | 理由 |
|------|---------|------|
| **R1** | **Honcho 重用户建模**（dialectic Q&A / peer cards） | LiYe Systems 的"用户"不是 chat 终端用户；产品形态错配，且与 SYSTEMS.md "明确不做"清单一致 |
| **R2** | **"Chat history first" 检索默认** | LiYe 决策检索默认 **truth-first**：结构化真相 → 事件流 → 摘要笔记 → 会话文本（最后） |
| **R3** | **LLM summarization 作为权威输出** | 摘要只能进入 `decision-support` 或 `context-only` 通道，不得提升为 `authoritative`（见 §Orchestration Rules O3） |
| **R4** | **Smart routing**（"模型自己决定查哪里"） | 检索路由由 MemoryAssemblyPlan 静态声明 + Governance 校验，不允许由 LLM 自由探索 |
| **R5** | **Auto-merge / auto-rewrite memory** | 任何对 authoritative 记忆的修改都必须走对应 contract / ADR；普通 provider 不得改写 authoritative |
| **R6** | **per-turn sync 直接落盘 user-modeling 状态** | sync 只能写入 session-adjacent receipts，不得在轮内改写跨会话的"用户画像" |
| **R7** | **Tool-driven 任意检索**（agent 用工具想搜哪就搜哪） | 检索必须在 MemoryAssemblyPlan 声明的范围内；越界 = GuardChain 拒绝 |
| **R8** | **Hermes "memory tool" 同时承担读 / 写 / 删** | 写入必须走专门的 MemoryWriteRequest（带 PromotionDecision 等同地位的 audit） |

---

## 与 LiYe Systems 分层与 BGHS 的映射

> 不再定义 BGHS 规则——见 P1-Doctrine §1。本节给出 Hermes memory 组件在 LiYe 视角下的归类。

| Hermes 组件 | LiYe 视角 primary concern | 在 LiYe Systems 的对应位置 |
|------------|--------------------------|--------------------------|
| MemoryProvider ABC（抽象接口） | **Brain** | Loamwise `align/` 的 harness 接口契约 |
| MemoryManager（编排器） | **Brain** (secondary: Governance) | Loamwise `align/orchestrator/` |
| Per-turn prefetch + frozen snapshot | **Brain** | Loamwise harness，但 frozen snapshot 字段约束属 Layer 0 contract |
| MemoryStore（文件后端） | **Hands** | Layer 1/2 各 component 自己的存储 adapter |
| 写入时安全扫描 | **Governance** | Layer 1 GuardChain（由 P1-d 落地） |
| session_search_tool（FTS5） | **Hands** | Loamwise `align/retrieval/` 的实现适配器 |
| LLM summarization 决策 | **Brain** | Loamwise harness |
| Honcho user modeling | — | **不吸收**（R1） |
| Memory tier classification（authoritative/decision-support/context-only） | **Governance** | Layer 0 — 本 ADR Contract Sketch §1 定义 |
| Memory use policy（哪种 tier 能驱动哪种决策） | **Governance** | Layer 0 — 本 ADR + 后续 policy ADR |

**Layer 归属（与 SYSTEMS.md 一致）**：
- **Layer 0（liye_os）**：定义 `MemoryTier` 枚举、`MemoryRecord` schema、`MemoryUsePolicy` 契约、检索 priority 接口
- **Layer 1（loamwise）**：实施 MemoryManager、provider 编排、retrieval 路由、frozen snapshot 装配

**容易错判的点**：

| 容易错判 | 正确判法 |
|---------|---------|
| 把"会话历史摘要"判为 `authoritative`（"摘要是事实"） | 摘要 = LLM 输出 = `decision-support` 上限；`authoritative` 仅给 contracts / verdicts / authoritative events |
| 把 MemoryProvider 接口本身判为 Governance（"它管所有 provider 怎么接"） | 接口形状是 harness（Brain）；"必须有 provider 抽象"这条规则 → Governance |
| 把 frozen snapshot 判为 Session（"它是历史快照啊"） | snapshot 是**装配产物**，是 Brain 的 prefix cache 工具；session 本体 + receipts 由 P1-e 定义 |

---

## Orchestration Rules（裁判手册）

### O1. 三层 MemoryTier，决策权按层分配

记忆按"能否驱动决策"分三层：

| Tier | 含义 | 能驱动决策？ |
|------|------|-------------|
| `authoritative` | 治理常驻物 + authoritative session events（由 P1-e 定义） | **能** — 但其本身的产生必须经 contract / ADR / event-stream 入库 |
| `decision-support` | 摘要 / 检索结果 / 跨会话索引 / 历史 outcomes | **不能直接驱动**，只能作为决策输入材料；最终决策必须由 authoritative 兜底 |
| `context-only` | 会话文本 / scratchpad 笔记 / 草稿 | **不能** — 仅供 harness 理解上下文 |

### O2. 检索优先级默认 truth-first（与 P1-Doctrine §5.5 一致）

"truth-first" 是检索原则；在 contract 字段上对应 `query_mode = 'strict_truth'`（见 §3）。

任何检索请求的默认顺序：
1. **authoritative** 层：contracts / policies / verdicts / authoritative session events
2. **decision-support** 层：traces / receipts / 索引摘要
3. **context-only** 层：会话文本

`context-only` 必须**最后**检索且**永远不能单独**回答决策性问题。检索引擎可以并行查所有层，但**结果聚合时按 priority 排序**，并标注每个 fragment 的 tier。

唯一允许偏离 `strict_truth` 的场景是 `query_mode = 'balanced_recency'`（诊断 / 排查），其白名单与触发条件由 **P1-e** 定义。

### O3. 摘要 / 派生内容不得提升 tier

- LLM 对 `decision-support` 内容做摘要 → 仍是 `decision-support`
- LLM 对 `context-only` 内容做摘要 → 仍是 `context-only`
- **任何路径都不允许把派生内容标记为 `authoritative`**——`authoritative` 只能由 contract / ADR / authoritative event stream 入库时直接赋予

### O4. 写入受 GuardChain 强制（与 P1-d 对接）

- 任何 MemoryWriteRequest 必须经 GuardChain（P1-d）的 ContentScanGuard 与 TruthWriteGuard
- 写入 `authoritative` 通道：**禁止由普通 provider / agent 直接写入**——必须走对应 contract ADR 或 event-stream append-only
- 写入 `decision-support` / `context-only`：经 GuardChain shadow / active 检查

### O5. Per-turn frozen snapshot 是 Brain 决策的稳定性前提

- 一轮内（一次 LLM 调用 + 后续工具循环），prefetch 装配的 snapshot **不可变**
- 即使在该轮内有新事件写入 session，本轮仍使用 frozen snapshot——下一轮才看到新内容
- 这一规则是 **prefix cache 稳定性** 与 **决策可 replay** 的前提

### O6. Provider 之间 context fencing

- Provider A 注入的内容**不得被 Provider B 直接读取**
- 跨 provider 共享必须经 MemoryAssemblyPlan 显式声明
- 防止"chat history provider 偷偷把 user 笔记带给 truth provider"等串味

### O7. Retrieval routing 是静态声明，不是 LLM 自由决定

- MemoryAssemblyPlan 在编排开始前**确定要查哪些 provider / 哪些 tier / 用什么 query mode**
- LLM 可以在 plan 范围内**触发**检索（如选择查 ADR or 查 trace），但**不能扩展 plan 之外**的检索路径
- 越界检索由 GuardChain 拒绝

### O8. 编排接口（Layer 0 契约）vs 编排实现（Layer 1）

- **Layer 0**：定义 MemoryTier / MemoryRecord / MemoryRetrievalRequest / MemoryAssemblyPlan / MemoryUsePolicy 的 schema 与最小语义
- **Layer 1（Loamwise）**：实施 MemoryManager、provider lifecycle、frozen snapshot 装配、retrieval 路由
- **Layer 2（Engine）**：可作为 provider 注册（提供领域记忆），但不实施编排

---

## Contract Sketch

### §1. MemoryTier（决策权分层枚举）

```typescript
enum MemoryTier {
  AUTHORITATIVE    = 'authoritative',     // 可驱动决策；必须有原始 contract / ADR / authoritative event 来源
  DECISION_SUPPORT = 'decision-support',  // 决策输入材料；最终决策必须由 authoritative 兜底
  CONTEXT_ONLY     = 'context-only',      // harness 上下文；不进入决策路径
}

// Tier 升级（promotion）禁止：派生 / 摘要 / 跨 tier 复制都不能改 tier
// 只有"独立通过 contract / ADR / event-stream 入库"的内容才能获得 AUTHORITATIVE
```

### §2. MemoryRecord（记忆条目最小 schema）

```typescript
interface MemoryRecord {
  // 标识
  record_id: string                        // UUIDv7
  tier: MemoryTier                         // §1
  content_kind: string                     // e.g., "contract.adr", "trace.event", "summary.session", "note.scratchpad"
  content_hash: string                     // sha256(payload)

  // 来源（fail-closed：缺少 = 拒绝）
  // 角色约定（schema 注释，validator 强制）：
  //   - Layer 0：authoritative source publisher
  //              （contracts / policies / ADR-derived compiled records / authoritative event stream sink）
  //   - Layer 1：provider / retrieval backend / orchestration write
  //              （Loamwise 的 MemoryManager 与 provider 实现）
  //   - Layer 2：Domain Engine 作为 provider，可发起 sync_turn 写入（受 §5 policy 约束）
  //   - Layer 3：**不直接写入 memory records**（fail-closed）
  source: {
    provider_id: string                    // 写入时的 provider id
    layer: 0 | 1 | 2
    upstream_ref: string | null            // 若派生自其他 record / event
    trace_id: string                       // 指向产生此 record 的 session event
  }
  created_at: string                       // ISO 8601

  // 安全审计
  guard_evidence: GuardEvidenceRef[]       // P1-d GuardChain 的扫描结果
  redaction_applied: boolean

  // 内容（按 content_kind 决定结构；不在 Layer 0 写死）
  payload: unknown                         // 由各 content_kind 的 sub-schema 约束
}
```

### §3. MemoryRetrievalRequest（检索请求）

```typescript
interface MemoryRetrievalRequest {
  request_id: string

  // 查询参数
  query: string | StructuredQuery          // string = LLM-style；structured = exact filters
  tiers_allowed: MemoryTier[]              // 必须显式列出；空 = 拒绝
  providers_allowed: string[]              // 必须显式列出；空 = 拒绝（O7 强制）
  query_mode: 'strict_truth' | 'balanced_recency'
                                           // 默认 'strict_truth'（与 P1-e Federated Query 命名口径一致）
                                           // 'balanced_recency' 仅诊断 / 排查场景；语义与白名单由 P1-e 定义
  max_fragments_per_tier: Record<MemoryTier, number>

  // 触发上下文
  triggered_by: {
    component: string                       // 谁触发的检索
    purpose: 'decision' | 'context' | 'audit'
    plan_id: string                        // 必须引用一个有效 MemoryAssemblyPlan（O7）
  }
}

interface RetrievalResult {
  request_id: string
  fragments: RetrievalFragment[]            // 按 tier priority 排序
  truncated: boolean
  retrieved_at: string
}

interface RetrievalFragment {
  record: MemoryRecord
  rank_in_tier: number
  match_evidence: string                    // 匹配理由（必须可解释）
}
```

### §4. MemoryAssemblyPlan（装配计划，编排开始前敲定）

```typescript
interface MemoryAssemblyPlan {
  plan_id: string
  intended_for: 'decision' | 'context' | 'audit'

  // 静态声明：要查哪些 provider / tier
  retrieval_specs: RetrievalSpec[]

  // 装配顺序（与 O5 frozen snapshot 配合）
  assembly_order: AssemblyStep[]

  // 写入计划（如果本轮会写入新 memory）
  write_specs: MemoryWriteSpec[]           // 每条引用一个 MemoryUsePolicy（§5）

  // 创建与 lifecycle
  created_at: string
  expires_at: string                       // plan 失效时间，过期 = 必须重新装配
  frozen: boolean                          // 一旦标 frozen，本轮内不可修改（O5）
}

interface RetrievalSpec {
  provider_id: string
  tiers: MemoryTier[]
  query_template: string                   // 模板化，避免任意 string
  max_results: number
}

interface AssemblyStep {
  step: 'system-prompt' | 'tool-context' | 'memory-fence'
  fragments: string[]                      // record_id 列表
  fence_boundary: string | null            // O6 fencing
}

interface MemoryWriteSpec {
  target_tier: MemoryTier
  content_kind: string
  use_policy_id: string                    // 必须引用一个 MemoryUsePolicy
}
```

### §5. MemoryUsePolicy（决策权 / 写入权的 Governance 契约）

```typescript
interface MemoryUsePolicy {
  policy_id: string
  tier: MemoryTier

  // 谁能读（在哪些 plan_purpose 下）
  read_allowed_for: ('decision' | 'context' | 'audit')[]

  // 谁能写（critical：authoritative 写入受最严格约束）
  write_allowed_by: WriteActorRule[]

  // 哪些决策能消费此 tier 作为兜底
  // 强约束（schema + registration validator 双重强制）：
  //   - tier === AUTHORITATIVE     → decision_consumers 必须非空
  //   - tier !== AUTHORITATIVE     → decision_consumers 必须为空 ([])
  // DecisionKind 见 P1-a §3
  decision_consumers: DecisionKind[]

  // 派生规则（防止 tier 提升）
  derivation_rule: {
    can_summarize_to: MemoryTier[]         // 只能 ≤ 当前 tier
    can_index_into: MemoryTier[]           // 同上
  }

  // 撤销 / 失效
  revocation_path: string                  // 指向撤销 ADR / kill switch 入口
}

// Validator 伪代码（注册时强制）
function validateUsePolicy(p: MemoryUsePolicy): ValidationResult {
  if (p.tier === MemoryTier.AUTHORITATIVE && p.decision_consumers.length === 0) {
    return fail('authoritative_must_declare_decision_consumers')
  }
  if (p.tier !== MemoryTier.AUTHORITATIVE && p.decision_consumers.length > 0) {
    return fail('non_authoritative_must_have_empty_decision_consumers')
  }
  // 其他校验……
  return ok()
}

interface WriteActorRule {
  actor_kind: 'contract-adr' | 'event-stream' | 'engine-cosign' | 'policy-engine' | 'human-maintainer'
  guard_chain_required: ('content-scan' | 'truth-write')[]   // 必经 P1-d guards
}
```

**默认 MemoryUsePolicy（NON-NORMATIVE 示意）**：

| Tier | read_allowed_for | write_allowed_by | decision_consumers |
|------|-----------------|-----------------|-------------------|
| `authoritative` | decision, audit | contract-adr / event-stream / engine-cosign + truth-write guard | 全部 DecisionKind |
| `decision-support` | decision, context, audit | engine-cosign / policy-engine / human + content-scan | （空）— 仅作输入 |
| `context-only` | context, audit | 任何 in-process provider + content-scan | （空）— 永不入决策 |

> 上表仅展示**严格度的相对关系**，具体生效规则由后续 policy ADR 给出。

### §6. Orchestration Lifecycle（与 Hermes 对齐但口径收紧）

```typescript
interface MemoryProvider {
  provider_id: string

  // 当前字段语义优先约束**写入**：此 provider 通过 sync_turn / on_memory_write
  // 只能写入 declared_tiers 之内的 tier。
  // **读权限**由 MemoryAssemblyPlan.providers_allowed + tiers_allowed 进一步限定，
  // 不直接从 declared_tiers 推导。后续 contract ADR 可拆分为
  // declared_read_tiers / declared_write_tiers。
  declared_tiers: MemoryTier[]

  // Lifecycle hooks（Loamwise 调用）
  initialize(ctx: ProviderContext): Promise<void>
  prefetch(req: MemoryRetrievalRequest): Promise<MemoryRecord[]>
  sync_turn(events: TurnEvent[]): Promise<MemoryWriteResult[]>   // 受 §5 policy 约束
  shutdown(): Promise<void>

  // 可选 hooks
  on_pre_compress?(snapshot: FrozenSnapshot): Promise<void>     // 不得写入 authoritative
  on_memory_write?(write: MemoryWriteRequest): Promise<void>    // 仅观察，不得改写
  on_delegation?(chain: DelegationChain): Promise<void>
}

interface FrozenSnapshot {
  snapshot_id: string
  plan_id: string
  fragments: ReadonlyArray<RetrievalFragment>
  frozen_at: string
  // 一旦创建：immutable（O5）
}
```

---

## Non-goals

- **不实施 §1-§6 的代码**——本 ADR 仅定义 contract 草图与编排规则，运行时实现归 Loamwise
- **不重新定义 BGHS 分类规则**——见 P1-Doctrine
- **不定义 session vs session-adjacent 的具体 taxonomy**——交给 P1-e
- **不定义 federated query 的具体路由策略**——交给 P1-e
- **不定义 GuardChain 内部实现**——交给 P1-d；本 ADR 只声明"必经 GuardChain"
- **不引入 user modeling / dialectic Q&A / peer cards**——R1
- **不引入 LLM-driven smart routing**——R4
- **不实施 prefix cache 优化策略**——只声明 frozen snapshot 不可变，缓存策略由 Loamwise 自定
- **不修改 Hermes 上游代码**——上游 fork 仅作只读参考

---

## Adoption Checkpoints

| Checkpoint | 触发时机 | 验证项 |
|-----------|---------|-------|
| **C1. 本 ADR + P1-Doctrine + P1-a/b 一致就位** | 本 ADR 通过后 | 四份 ADR 互引一致；SYSTEMS.md 引用本 ADR 为 memory orchestration SSOT |
| **C2. MemoryTier 三层落入 contract schema** | P1-e 入库前 | `_meta/contracts/memory/tier.schema.yaml` 建立；schema 强制三种 tier；禁止派生提升 |
| **C3. MemoryAssemblyPlan 静态声明强制** | Loamwise `align/` 实施时 | 任何检索必须引用有效 plan_id；越界检索被 validator 拒绝 |
| **C4. Frozen snapshot 不可变性** | Loamwise harness 实施时 | snapshot 写入后 immutable；replay 验证可读出原 snapshot |
| **C5. 写入路径 GuardChain 强制** | P1-d Guards 落地后 | 任何 MemoryWriteRequest 必经 ContentScanGuard + TruthWriteGuard |
| **C6. 现有 ADR-006 supersede** | 本 ADR 通过后立即 | `ADR-006-Hermes-Memory-Orchestration.md` 标注 `Superseded by: ADR-Hermes-Memory-Orchestration.md`。**主题级 supersede，不要求物理删除** |

**本 ADR 不实施任何代码**。Adoption checkpoints 是后续阶段的入库门，不在本轮执行。

---

## Appendix A: 与 P1-e 的边界（明示）

本 ADR 与 P1-e 的分工必须清晰，否则会出现两种错位：
1. P1-c 越界自定义 session vs session-adjacent → P1-e 失去存在理由
2. P1-c 把 federated query 路由策略写死 → P1-e 修订时被本 ADR 阻塞

**分工**：

| 维度 | 本 ADR (P1-c) | P1-e |
|------|--------------|------|
| 关注 | **如何编排记忆**（assembly / retrieval order / lifecycle hooks） | **什么是 session 本体 / 什么是 session-adjacent** + **federated query 接口** |
| 输出 | MemoryTier / MemoryRecord / MemoryAssemblyPlan / MemoryUsePolicy | SessionEventStream / SessionAdjacentArtifact taxonomy / FederatedQueryInterface |
| 引用 | 假定 P1-e 的 taxonomy 已存在（forward ref） | 引用本 ADR 的 MemoryTier 作为消费侧约束 |

**当本 ADR 与 P1-e 冲突时**：
- session / session-adjacent 分类的最终定义以 **P1-e 为准**
- memory 编排（assembly / retrieval / lifecycle）的最终定义以 **本 ADR 为准**

**不得双重定义（硬约束）**：

> 同一概念不得在 P1-c 与 P1-e 中被双重定义。如必须交叉引用，**P1-c 只引用 taxonomy label，不重述 taxonomy semantics**；P1-e 只引用 MemoryTier label，不重述 tier 决策权语义。

> 评审时若发现重复定义，以**所属 ADR 的定义为准**（taxonomy 归 P1-e；tier 决策权归 P1-c），另一份必须改为 label-only 引用并 commit。

---

## Appendix B: 与 ADR-006（旧版）的关系

旧 `ADR-006-Hermes-Memory-Orchestration.md` 写于 2026-04-14（P1-Doctrine 之前），结构正确但缺少：
1. Meta Declaration 头部
2. BGHS 分类映射
3. 三层 MemoryTier 与 MemoryUsePolicy 的显式 schema
4. 与 P1-a CapabilityKind / P1-b Skill Lifecycle / P1-d GuardChain / P1-e Session taxonomy 的对接

**ADR-006 处置**：保留为历史记录（同 ADR-004 / 005），主题以本 ADR 为准。

---

**Version**: 1.0.0
**Last Updated**: 2026-04-16
