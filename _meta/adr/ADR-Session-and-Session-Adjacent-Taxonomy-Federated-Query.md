---
artifact_scope: meta
artifact_name: Session-and-Session-Adjacent-Taxonomy-Federated-Query
artifact_role: contract
target_layer: cross
is_bghs_doctrine: no
---

# ADR — Session / Session-Adjacent Taxonomy + Federated Query（P1-e）

**Status**: Accepted
**Date**: 2026-04-16
**Accepted-Date**: 2026-04-17
**Decision Makers**: LiYe
**SSOT**: `_meta/adr/ADR-Session-and-Session-Adjacent-Taxonomy-Federated-Query.md`
**References**:
- `_meta/adr/ADR-Architecture-Doctrine-BGHS-Separation.md`（必读前置；§5.5 Session 多源 + receipts session-adjacent）
- `_meta/adr/ADR-OpenClaw-Capability-Boundary.md`（DecisionAuthority + session.write 决策）
- `_meta/adr/ADR-Hermes-Skill-Lifecycle.md`（LifecycleTransition 是 session-adjacent）
- `_meta/adr/ADR-Hermes-Memory-Orchestration.md`（MemoryTier 消费侧约束 + query_mode 命名）
- `_meta/adr/ADR-Loamwise-Guard-Content-Security.md`（GuardEvidence 是 session-adjacent）

---

## Context

P1-Doctrine §5.5 已硬性区分了两个概念：
- **authoritative session event streams** 可多源
- **receipts 是 session-adjacent**，不是 session 本体

P1-c 把这条边界进一步落到了 MemoryTier 的消费侧，并在多处 forward ref 本 ADR。

但目前 LiYe 生态内"什么是 session、什么不是"还没有显式 taxonomy。实际现状：

| 路径 | 形态 | 当前归属 |
|------|------|---------|
| `liye_os/data/traces/orchestrator/*.json` | per-event JSON 文件 | 未分类 |
| `liye_os/state/traces/trace-<uuid>/` | per-trace 目录 | 未分类 |
| `liye_os/verdicts/` | 决策的人类可读解释 | 未分类 |
| `liye_os/evidence/` | 证据 bundle | 未分类 |
| `amazon-growth-engine/artifacts/onboarding/STR-*/state_transitions.jsonl` | append-only ndjson | 未分类 |

如果不立即给出 taxonomy + 联合检索接口：
1. 各 component 会自行造词，命名漂移
2. P1-c memory orchestration 没有可消费的 session 概念
3. P1-d guard evidence 不知道写到哪里
4. P1-b lifecycle transition 同样没有归属
5. 跨多源的检索（P1-c 的 federated query）只能各自实现

本 ADR 是 **contract 类**（artifact_role: contract），不是从单一上游萃取——它综合 P1-Doctrine 的边界 + LiYe / AGE 现有实现 + Hermes session_search 启发，输出 LiYe Systems 的 session taxonomy 与 federated query 接口。

---

## 现状盘点（LiYe / AGE 现有 + 上游启发）

### S1. LiYe 现有 session-like 数据

- `liye_os/data/traces/orchestrator/*.json` — per-event 单文件，时间戳排序，事实上是 append-only 但格式为 per-event JSON
- `liye_os/state/traces/trace-<uuid>/` — per-trace 目录，内部含 `events.ndjson` 等
- `liye_os/data/traces/{a3,d7,a3-batch1,...}/*.json` — 分批试验产生的 per-event 记录
- `liye_os/data/traces/revalidation/*.json` — 验证回放记录

### S2. AGE 现有 authoritative session pattern

- `amazon-growth-engine/artifacts/onboarding/STR-<id>/state_transitions.jsonl` — append-only ndjson
- 单 stream 描述一次 onboarding 流程的完整状态变迁

### S3. LiYe 现有 session-adjacent 数据

- `liye_os/verdicts/` — 决策结果的人类可读解释（geo, schema, README）
- `liye_os/evidence/` — 各类 evidence bundle（canary, e2e, contracts freeze 等）
- 未来：LifecycleTransition log（P1-b）、GuardEvidence（P1-d）、receipts、approval log

### S4. Hermes session_search_tool 启发

`/Users/liye/github/hermes-agent/tools/session_search_tool.py`：
- FTS5 全文索引跨 session 搜索
- LLM summarization 后输出
- 感知 delegation chain

**吸收**：跨多源联合检索的接口形态；
**不吸收**：LLM summarization 作为权威输出（与 P1-c R3 一致）；不吸收"chat-history-first"。

### S5. 当前问题

- 没有统一的 stream 注册机制 → 哪些 stream 存在、谁是 owner、retention 如何，都没有 SSOT
- 没有联合检索接口 → 每个 caller 自己实现（必然漂移）
- 没有"什么算 session、什么算 session-adjacent"的 taxonomy → P1-Doctrine §5.5 的区分悬空

---

## 吸收 / 不吸收

| 编号 | 吸收 | 理由 |
|------|------|------|
| **A1** | **append-only + hash-chain** 作为 authoritative session 的硬属性 | 决策可 replay 的前提；与 P1-Doctrine §5.5 一致 |
| **A2** | **Federated query 接口**（不强求统一存储） | Hermes session_search 的接口形态；契合"不引入统一 session 存储"硬约束 |
| **A3** | **多种 stream format 共存**（jsonl / per-event JSON / 其他） | LiYe + AGE 现状要求；不强迫迁移现有数据 |
| **A4** | **Stream-level descriptor**（owner / retention / format / hash chain） | 联合检索的最小元数据 |
| **A5** | **delegation chain awareness**（Hermes 启发）—— 跨 stream 的因果关系可见 | 调用 chain 信息对 replay / 审计关键 |

| 编号 | 不吸收 | 理由 |
|------|--------|------|
| **R1** | **统一 session 存储**（中心 session store） | 违反 SYSTEMS.md "明确不做"清单；多源是有意设计 |
| **R2** | **LLM summarization 作为 federated query 的权威输出** | 摘要 = decision-support 上限（与 P1-c §1 一致） |
| **R3** | **chat-history-first 检索默认** | strict_truth 为默认（与 P1-c O2 一致） |
| **R4** | **任意 in-place rewrite** | session / session-adjacent 都 append-only；需修订必须新 record + 引用旧 record |
| **R5** | **把 receipts / verdicts / evidence 当 session 本体** | 与 P1-Doctrine §5.5 硬底线一致：它们都是 session-adjacent |
| **R6** | **让 LLM 自行决定 query_mode** | query_mode 由 orchestration 层（MemoryAssemblyPlan / FederatedQueryRequest）显式声明 |
| **R7** | **balanced_recency 作为日常默认** | balanced_recency 仅诊断 / 排查场景，必须显式授权 |
| **R8** | **session-adjacent 提升为 session** | 派生不可改 tier（与 P1-c O3 一致）：lifecycle log / guard evidence / receipts 不能升格为 authoritative session |

---

## 与 LiYe Systems 分层与 BGHS 的映射

> 不再定义 BGHS 规则——见 P1-Doctrine §1。

| 概念 | LiYe 视角 primary concern | 在 LiYe Systems 的对应位置 |
|------|--------------------------|--------------------------|
| Session taxonomy（什么是 session 本体） | **Governance** | Layer 0 — 本 ADR §Contract Sketch §1 |
| SessionEventStream schema | **Governance** (contract) + **Session** (实例) | Layer 0 contract；实例是各 component 写的事件流 |
| SessionAdjacentArtifact schema | **Governance** (contract) + **Session** (实例，session-adjacent 子类) | 同上 |
| StreamRegistry | **Governance** | Layer 0 — 本 ADR §Contract Sketch §3 |
| StreamAdapter（如何读各种 stream） | **Hands** | Layer 1 — Loamwise `align/streams/` |
| FederatedQueryRequest schema | **Governance** | Layer 0 — 本 ADR §Contract Sketch §4 |
| Federated query runtime（fan-out / 聚合） | **Brain** (调度策略) + **Hands** (执行) | Layer 1 — Loamwise `align/federated/` |
| query_mode 选择 | **Governance** | 本 ADR §F4 强制 |
| FederatedQueryResult ranking | **Brain** | Loamwise harness（受 priority order 约束） |

**Layer 归属**：
- **Layer 0（liye_os）**：定义 taxonomy（什么算 session vs adjacent）、SessionEventStream / SessionAdjacentArtifact schema、StreamRegistry contract、FederatedQueryRequest 接口、query_mode 枚举
- **Layer 1（loamwise）**：实施 StreamRegistry runtime、StreamAdapter、FederatedQuery 执行器、ranking
- **Layer 2（engines）**：作为 stream owner（写自己的 session event streams + adjacent artifacts），通过 StreamRegistry 注册

**容易错判**：

| 容易错判 | 正确判法 |
|---------|---------|
| 把 receipts 判为 session（"它从 session 来") | 派生 / 衍生 → session-adjacent；**只有"事件本身"才是 session** |
| 把 verdicts 判为 authoritative truth（"决策结果是真理"） | verdict 是对决策的人类解释（Brain 输出） → session-adjacent；authoritative truth 在原始事件流 + contract |
| 把 federated query runtime 判为 Governance（"它管检索") | 调度策略与执行 → Brain + Hands；"必须有 federated 接口"这条规则 → Governance |
| 把 LifecycleTransition log 判为 session（"它就是状态变迁事件") | 它是 lifecycle 的 derived audit；属 session-adjacent |

---

## Federation Rules（裁判手册）

### F1. Session 本体的硬属性（authoritative session event stream）

一份数据要被认定为 **session 本体**，必须同时满足：

1. **Append-only**：写入后不可改写（任何修订 = 追加新事件 + 引用旧事件）
2. **Time-ordered**：事件按时间戳单调排序
3. **Hash-chained**：每个事件包含 `prev_event_hash`，可被 replay 重新校验
4. **Owner-declared**：在 StreamRegistry 中有显式 owner / retention / format
5. **Authoritative for some scope**：声明的 scope 内，本 stream 是 truth-of-record

不满足全部 5 条 = **不是** session 本体。

### F2. Session-adjacent 的定义（派生但非 session）

任何下列特征之一即归为 **session-adjacent**：

- 派生自一个或多个 SessionEventStream（含 derived_from refs）
- 是对 session 事件的人类可读解释 / 摘要 / 索引
- 是 lifecycle / approval / guard 等独立工件的 audit log（自身 append-only，但服务于 session 之外的治理流程）
- 是 receipts / evidence / verdicts

session-adjacent 也必须 **append-only**，但**不要求 hash chain 与 session 等强**——可以只 hash 自身。

### F3. 既非 session 也非 session-adjacent

- 静态 contracts（`_meta/contracts/`）
- ADRs 本身
- code / config / skills body / agent definitions

它们若驱动决策，归 P1-c MemoryTier.AUTHORITATIVE，但**不进入 session taxonomy**。

### F4. Query mode 默认 strict_truth；balanced_recency 受限

```
默认：query_mode = 'strict_truth'
  ranking 分层（authoritative bucket 优先，内部并列）：

    Bucket 1（authoritative，并列）：
      - session-event（authoritative session event streams）
      - static-truth  （F3 的 contracts / ADRs / authoritative compiled records；
                       仅当 include_static_truth = true 时进入结果集）

    Bucket 2：
      - session-adjacent（receipts / verdicts / lifecycle log / guard evidence / etc.）

    Bucket 3：
      - others（如可选的 decision-support 摘要）

  ranking 规则：
    Bucket 1 内部 = 并列（session-event 与 static-truth 同等优先；
                          内部按 scope 匹配度 + recency 排序）
    Bucket 1 整体 严格优先于 Bucket 2
    Bucket 2 严格优先于 Bucket 3
    任何情况下：static-truth 不得排在 session-adjacent 之后

  注：static-truth 不进入 session taxonomy（F3），但参与 strict_truth ranking
      作为 authoritative bucket 的并列成员；这与 P1-c §1 的"派生不得提升 tier"不冲突
      ——它仍是 P1-c MemoryTier.AUTHORITATIVE，只是在 federated query 结果集中
      与 session-event 并列展示。

唯一例外：query_mode = 'balanced_recency'
  仅允许场景：
    - 诊断 / 排查（debugging / forensics）
    - 紧急回放分析（incident replay analysis）
  必须显式：
    - FederatedQueryRequest.diagnostic_authorization 字段非空
    - 引用一份 policy ADR / 应急流程 ADR
    - 写入 audit trail（自身的访问 = session-adjacent 事件，子类 query-audit）
  禁用场景：
    - 任何决策路径
    - 任何 frozen snapshot 装配
    - 任何 authoritative tier 写入前的检索
```

LLM **不可自行选择** query_mode（R6）；query_mode 由 MemoryAssemblyPlan / FederatedQueryRequest 在编排层显式设置。

### F5. Federated query 不强求统一存储

- StreamRegistry 是**索引 + 元数据**（哪些 stream 存在、住在哪），不是 stream 本身
- StreamAdapter 负责"如何读取某种 format 的 stream"（jsonl / per-event JSON / 其他）
- 联合检索 = StreamRegistry 找 stream → StreamAdapter 各自读取 → 结果按 query_mode 聚合排序

### F6. Stream owner 唯一，registration validator 强制

- 每个 stream 必须有**唯一 owner**（component_id）
- owner 是该 stream 的 truth-of-record 责任方
- 同一 stream 不允许多 owner（避免"谁的 truth 是 truth"歧义）
- registration 时 validator 检查 owner 唯一性

### F7. Append-only + revision-as-append 强制

- 任何 session / session-adjacent 数据修订 = **追加新 record + 引用旧 record**（`supersedes_event_id` 字段）
- 旧 record **不删除、不改写**——保留可读
- 联合查询时，按 `supersedes_event_id` 链推断"当前状态"，但所有事件都返回（caller 决定如何使用）

### F8. Federated query 必须可 replay

- 同一 FederatedQueryRequest 在同一时间点（含 stream 状态快照）必须返回相同结果
- ranking / 摘要 / 折叠 等不确定性步骤必须用 deterministic algorithm 或带 random seed 记录
- 这是"决策可 replay"的前提

---

## Contract Sketch

### §1. SessionTaxonomy（核心枚举）

```typescript
enum ArtifactClass {
  SESSION_EVENT_STREAM       = 'session.event-stream',         // F1 全部 5 条满足
  SESSION_ADJACENT           = 'session.adjacent',              // F2 至少一条满足
  NEITHER                    = 'neither',                       // F3
}

// SessionAdjacent 子分类（非穷举；新增需后续 contract ADR）
enum SessionAdjacentKind {
  RECEIPT                    = 'receipt',                       // 决策回执 / 输出快照
  VERDICT                    = 'verdict',                       // 人类可读决策解释（liye_os/verdicts/）
  EVIDENCE_BUNDLE            = 'evidence-bundle',               // P1-d GuardEvidence + 现有 evidence/
  LIFECYCLE_TRANSITION_LOG   = 'lifecycle-transition-log',     // P1-b LifecycleTransition
  APPROVAL_LOG               = 'approval-log',                  // approval state machine 的 audit log
  GUARD_EVIDENCE             = 'guard-evidence',                // P1-d GuardEvidence（通常打包进 evidence-bundle，单独子类供细粒度引用）
  DERIVED_INDEX              = 'derived-index',                 // 全文索引 / 摘要索引等
  QUERY_AUDIT                = 'query-audit',                   // FederatedQuery 自身访问行为的审计事件（特别是 balanced_recency）
                                                                // provenance 规则与其他 adjacent 不同：可允许 derived_from = []
                                                                // （元事件，不派生于具体 stream/artifact），
                                                                // 由 §3 SessionAdjacentArtifact 的"QUERY_AUDIT 例外条款"规定
  CREDENTIAL_AUDIT           = 'credential-audit',              // 由 P1-f ADR-Credential-Mediation 驱动的 companion 扩展
                                                                // broker.resolve() 成功/失败写一条；
                                                                // derived_from 必须非空（引用触发本次访问的 session event）；
                                                                // audit_subject 必为 null（audit_subject 是 QUERY_AUDIT 专用）；
                                                                // payload 详见 P1-f §4 CredentialAuditRecord
}
```

### §2. SessionEventStream（authoritative session 的 stream descriptor）

```typescript
interface SessionEventStream {
  stream_id: string                             // 形如 "engine.amazon-growth.onboarding.STR-E438213024"
  owner: {
    component_id: string                        // F6 唯一 owner
    layer: 1 | 2                                // Layer 0 / 3 不写 session（参 P1-c source.layer 矩阵）
  }
  scope: StreamScope                            // 此 stream 在哪个 scope 内是 authoritative

  // Stream 物理性
  format: StreamFormat
  storage_location: string                      // 绝对路径或 URI（多源允许）
  retention: RetentionPolicy

  // F1 硬属性自证
  is_append_only: true                          // 必须 true（F1.1）
  is_hash_chained: true                         // 必须 true（F1.3）
  hash_alg: 'sha256' | 'blake3'

  // 注册元数据
  registered_at: string
  registered_by_adr: string                     // 必须引用一份 ADR（contract / harvest / decision）
}

interface StreamScope {
  scope_kind: 'engine-execution' | 'orchestrator-trace' | 'guard-runtime' | string
  scope_keys: Record<string, string>            // 如 { tenant_id, marketplace, trace_id }
}

enum StreamFormat {
  NDJSON_APPEND        = 'ndjson.append',       // AGE state_transitions.jsonl 模式
  PER_EVENT_JSON_DIR   = 'per-event-json-dir',  // LiYe data/traces/orchestrator/*.json 模式
  PER_TRACE_DIR        = 'per-trace-dir',       // LiYe state/traces/trace-<uuid>/ 模式
}

interface RetentionPolicy {
  min_retention_days: number
  immutable_after_days: number | null           // 一段时间后转入 cold storage（仍可读，但不可追加）
  delete_after_days: number | null              // null = 永久保留
}

interface SessionEvent {
  event_id: string                              // UUIDv7
  stream_id: string
  seq: number                                   // 单调递增
  timestamp: string                             // ISO 8601
  prev_event_hash: string | null                // F1.3 hash chain；首事件为 null
  payload: unknown                              // 由 stream owner 定义（不在本 ADR 写死）
  payload_hash: string                          // sha256(payload)

  // F7 revision-as-append
  supersedes_event_id: string | null            // 若此事件修订旧事件
}
```

### §3. SessionAdjacentArtifact（派生工件 descriptor）

```typescript
interface SessionAdjacentArtifact {
  artifact_id: string
  adjacent_kind: SessionAdjacentKind            // §1
  owner: {
    component_id: string
    layer: 0 | 1 | 2                            // Layer 0 也可写 adjacent（如 contract-derived verdicts）
  }

  // 来源（默认硬约束：必须引用一个或多个 SessionEvent / 上游 adjacent）
  // QUERY_AUDIT 例外条款（见下）：允许 derived_from = []，但必须填 audit_subject
  derived_from: ArtifactRef[]                   // 默认至少一条；QUERY_AUDIT 可为空

  // QUERY_AUDIT 专用字段（其他 kind 必为 null）
  // 当 adjacent_kind = QUERY_AUDIT 时：
  //   - derived_from 可为 []
  //   - audit_subject 必填，描述本次查询审计的元数据（请求 id / mode / 授权 / 命中 fragment refs）
  // 当 adjacent_kind ≠ QUERY_AUDIT 时：
  //   - derived_from 必须非空
  //   - audit_subject 必须为 null
  audit_subject: QueryAuditSubject | null

  // 物理性
  storage_location: string
  format_kind: 'json' | 'ndjson' | 'markdown' | 'binary' | 'directory'
  is_append_only: true                          // F2 强制
  hash_self: string                             // 可不 chain，但自身必须 hash

  created_at: string
  registered_by_adr: string | null              // adjacent 不强制 ADR 引用，但建议
}

interface QueryAuditSubject {
  request_id: string
  query_mode: 'strict_truth' | 'balanced_recency'
  diagnostic_authorization: DiagnosticAuth | null   // balanced_recency 必填
  hit_fragment_refs: ArtifactRef[]              // 此次命中的 fragment（可为空，但字段必须存在）
}

interface ArtifactRef {
  ref_kind: 'session-event' | 'session-adjacent'
  stream_id?: string                            // ref_kind = session-event 时必填
  event_id?: string
  artifact_id?: string                          // ref_kind = session-adjacent 时必填
  relationship: 'derived-from' | 'summarizes' | 'indexes' | 'verdicts-on' | 'evidences'
}
```

### §4. StreamRegistry（统一索引）

```typescript
interface StreamRegistry {
  // F5: Registry 是元数据层；不存储 stream 本身

  registerStream(s: SessionEventStream): RegisterResult
  registerAdjacent(a: SessionAdjacentArtifact): RegisterResult

  lookupStream(stream_id: string): SessionEventStream | null
  lookupAdjacent(artifact_id: string): SessionAdjacentArtifact | null

  listStreams(filter: StreamFilter): SessionEventStream[]
  listAdjacent(filter: AdjacentFilter): SessionAdjacentArtifact[]
}

interface StreamFilter {
  owner_component_id?: string
  scope_kind?: string
  scope_keys?: Record<string, string>
  format?: StreamFormat
  active_at?: string                            // 时间窗口（按 retention 计算）
}

interface AdjacentFilter {
  adjacent_kind?: SessionAdjacentKind
  owner_component_id?: string
  derived_from_event_id?: string                // 反查派生关系
}
```

### §5. FederatedQueryRequest / Result

```typescript
enum QueryMode {
  STRICT_TRUTH       = 'strict_truth',          // 默认（F4）
  BALANCED_RECENCY   = 'balanced_recency',      // 仅诊断 / 排查（F4 受限）
}

interface FederatedQueryRequest {
  request_id: string

  // 检索目标（Federated 范围）
  target_classes: ArtifactClass[]               // 至少包含 SESSION_EVENT_STREAM 之一
  stream_filter: StreamFilter | null
  adjacent_filter: AdjacentFilter | null

  // 查询条件
  query: string | StructuredQuery
  time_range: { from: string; to: string } | null
  scope_keys: Record<string, string> | null     // 限定 scope（如 trace_id / tenant_id）

  // Mode
  query_mode: QueryMode
  diagnostic_authorization: DiagnosticAuth | null   // BALANCED_RECENCY 必填（F4）

  // 结果约束
  max_events_per_stream: number
  max_adjacent: number
  include_static_truth: boolean                 // 是否一并返回 F3 静态 authoritative truth（默认 false）

  // 触发上下文
  triggered_by: {
    component: string
    purpose: 'decision' | 'context' | 'audit' | 'diagnostic'
    plan_id: string | null                      // P1-c MemoryAssemblyPlan id（若来自 memory orchestration）
  }
}

interface DiagnosticAuth {
  authorization_adr: string                     // 引用授权此 diagnostic 访问的 ADR
  approver_id: string
  expires_at: string                            // 授权有效期（短期）
  reason: string                                // 必须可读
}

interface FederatedQueryResult {
  request_id: string
  fragments: FederatedFragment[]                // 按 priority + scope + recency 排序（依 query_mode）
  truncated_streams: string[]                   // 哪些 stream 因 max_events 截断
  retrieved_at: string
  query_replay_seed: string                     // F8 replay 所需的 deterministic seed
}

interface FederatedFragment {
  fragment_kind: 'session-event' | 'session-adjacent' | 'static-truth'
  source_stream_id: string | null               // session-event 必填
  source_artifact_id: string | null             // session-adjacent 必填
  source_static_ref: string | null              // static-truth 必填（如 contract path）
  payload: unknown
  match_evidence: string                        // 可解释的命中理由
  rank: number                                  // 全局 rank（已按 query_mode 排序）
}
```

### §6. StreamAdapter（Layer 1 / Loamwise 实现）

```typescript
// StreamAdapter 是 Hands：每种 StreamFormat 一个实现
interface StreamAdapter {
  format: StreamFormat
  canRead(s: SessionEventStream): boolean
  iterate(s: SessionEventStream, range: TimeRange | null): AsyncIterable<SessionEvent>
  countEvents(s: SessionEventStream, range: TimeRange | null): Promise<number>
  verifyHashChain(s: SessionEventStream): Promise<HashChainResult>   // F1.3 验证
}

interface HashChainResult {
  ok: boolean
  broken_at_event_id: string | null
  expected_prev_hash: string | null
  actual_prev_hash: string | null
}
```

### §7. Validator（注册时强制）

```typescript
function registerStream(s: SessionEventStream): RegisterResult {
  // F1.1 + F1.3 强制
  if (!s.is_append_only || !s.is_hash_chained) {
    return fail('not_append_only_or_not_hash_chained')
  }
  // F6 唯一 owner（registry 已存在 stream_id 即拒绝）
  if (registry.has(s.stream_id)) return fail('duplicate_stream_id')
  // owner.layer 限制
  if (![1, 2].includes(s.owner.layer)) return fail('owner_layer_must_be_1_or_2')
  // ADR reference 强制
  if (!s.registered_by_adr) return fail('missing_registered_by_adr')
  return ok({ stream_id: s.stream_id })
}

function executeFederatedQuery(req: FederatedQueryRequest): QueryResult {
  // F4: BALANCED_RECENCY 必须有 diagnostic_authorization
  if (req.query_mode === QueryMode.BALANCED_RECENCY) {
    if (!req.diagnostic_authorization) return fail('balanced_recency_requires_diagnostic_auth')
    if (req.triggered_by.purpose !== 'diagnostic') return fail('balanced_recency_only_for_diagnostic')
    if (!req.diagnostic_authorization.authorization_adr) return fail('missing_authorization_adr')
    // 执行查询并收集 hit_fragment_refs（先查后审计，便于把命中 refs 写入 audit）
    const result = executeQueryFanOut(req)
    // 自我审计：访问行为写 SessionAdjacentArtifact，子类 = QUERY_AUDIT
    // QUERY_AUDIT 例外条款（§3）：derived_from 可为 []，但 audit_subject 必填
    appendAdjacent({
      adjacent_kind: SessionAdjacentKind.QUERY_AUDIT,
      owner: { component_id: 'loamwise:federated-query', layer: 1 },
      derived_from: [],                      // 元事件，例外允许
      audit_subject: {
        request_id: req.request_id,
        query_mode: 'balanced_recency',
        diagnostic_authorization: req.diagnostic_authorization,
        hit_fragment_refs: result.fragments.map(toArtifactRef),
      },
      // 其他必填字段（storage / hash_self / created_at / ...）省略
    })
    return ok(result)
  }
  // STRICT_TRUTH 默认 ranking（F4 修订版）：
  //   Bucket 1 (并列)：session-event ∥ static-truth (仅当 include_static_truth=true)
  //   Bucket 2       ：session-adjacent
  //   Bucket 3       ：others
  //   Bucket 1 整体严格优先于 Bucket 2；static-truth 不得排在 session-adjacent 之后
  // ...
  return ok({ ... })
}

// SessionAdjacentArtifact validator（与 §3 例外条款配合）
function validateAdjacent(a: SessionAdjacentArtifact): ValidationResult {
  if (a.adjacent_kind === SessionAdjacentKind.QUERY_AUDIT) {
    if (a.audit_subject === null) {
      return fail('query_audit_must_have_audit_subject')
    }
    // QUERY_AUDIT 允许 derived_from = []
  } else {
    if (a.derived_from.length === 0) {
      return fail('non_query_audit_must_have_at_least_one_derived_from')
    }
    if (a.audit_subject !== null) {
      return fail('non_query_audit_must_have_null_audit_subject')
    }
  }
  return ok()
}
```

---

## Non-goals

- **不实施 §1-§7 的代码**——本 ADR 仅定义 contract 与 Federation Rules
- **不重新定义 BGHS 分类规则**——见 P1-Doctrine
- **不强迫现有 stream 迁移格式**（A3）——LiYe 现有 per-event JSON / per-trace dir / AGE jsonl 都通过 StreamFormat 适配
- **不规定具体存储后端**——本地文件系统 / 对象存储 / DB 都可作为 storage_location，由 StreamAdapter 处理
- **不引入统一 session 存储**（R1 + SYSTEMS.md 明确不做）
- **不引入 LLM-driven 检索路由**（R6）
- **不定义 StreamFormat 的具体编码规范**（如 ndjson 的具体字段顺序）——由后续 contract ADR / 各 stream owner 自行规定
- **不处理 cross-tenant / 多 user 的 session 隔离**——这是后续 capability ADR 的范围
- **不修改任何上游 fork 代码**

---

## Adoption Checkpoints

| Checkpoint | 触发时机 | 验证项 |
|-----------|---------|-------|
| **C1. P1-Doctrine + P1-a/b/c/d + 本 ADR 五件就位** | 本 ADR 通过后 | 五份 ADR 互引一致；SYSTEMS.md 引用本 ADR 为 session/adjacent + federated query SSOT |
| **C2. SessionTaxonomy 三分落入 contract schema** | StreamRegistry 实施前 | `_meta/contracts/session/taxonomy.schema.yaml` 建立；ArtifactClass / SessionAdjacentKind 枚举强制 |
| **C3. 现有 traces / verdicts / evidence 治理与分类** | StreamRegistry 上线前 | **先补齐 F1 缺失项再注册**：（1）`liye_os/data/traces/*` 与 `state/traces/*` 现无 hash chain → 必须先在每条 stream 引入 `prev_event_hash` 字段或等价 chain 后，才能注册为 SESSION_EVENT_STREAM；未补齐前在 registry 中标 `provisional` 状态；（2）`liye_os/verdicts/` → SESSION_ADJACENT.verdict（adjacent 不强制 chain，可直接注册）；（3）`liye_os/evidence/` → SESSION_ADJACENT.evidence-bundle（同上） |
| **C4. AGE state_transitions.jsonl 注册** | **AGE 补齐 F1 hash chain 后** + AGE D0→D1 时 | AGE 当前 `persistence.py` 写入的事件行只含 `event_id / store_id / at / by / scope / from_state / to_state ...`，**无 `prev_event_hash`**，**当前不满足 F1**；必须先补齐 hash chain（或等价机制）再注册为 SessionEventStream（format = NDJSON_APPEND, owner = AGE）；补齐前可记为 **provisional authoritative candidate**，但不计入 strict_truth bucket 1 |
| **C5. F4 query_mode 默认 strict_truth 强制** | 第一个 FederatedQuery 请求时 | runtime 拒绝 query_mode 缺失；balanced_recency 必带 diagnostic_authorization |
| **C6. F1 hash chain 验证可用** | **C3/C4 之前必须先就绪** | 每个 StreamAdapter 实现 verifyHashChain；replay 用此验证；**hash chain 验证工具就绪是 C3/C4 注册的前置条件，不是后置** |
| **C7. 自我审计**（balanced_recency 访问写 session-adjacent） | 第一次 balanced_recency 请求 | 写入 SESSION_ADJACENT.query-audit 事件，含授权 ADR ref + audit_subject 必填 |

**本 ADR 不实施任何代码**。

---

## Appendix A: 与 P1-c 命名 / 字段对齐（明示）

P1-c 多次 forward ref 本 ADR。对齐声明：

| P1-c 提及 | 本 ADR 对应 |
|----------|------------|
| "session 本体 / authoritative session events" | §1 ArtifactClass.SESSION_EVENT_STREAM + §2 SessionEventStream |
| "session-adjacent" | §1 ArtifactClass.SESSION_ADJACENT + §3 SessionAdjacentArtifact |
| "receipts" | §1 SessionAdjacentKind.RECEIPT |
| "GuardEvidence 写 session-adjacent" | §1 SessionAdjacentKind.GUARD_EVIDENCE / EVIDENCE_BUNDLE |
| "LifecycleTransition log 属 session-adjacent" | §1 SessionAdjacentKind.LIFECYCLE_TRANSITION_LOG |
| "query_mode = 'strict_truth' / 'balanced_recency'" | §5 QueryMode 完全一致 |
| "MemoryAssemblyPlan.plan_id" | §5 FederatedQueryRequest.triggered_by.plan_id |
| "MemoryTier.AUTHORITATIVE 静态真相" | §5 include_static_truth flag（§F3 解释静态真相不进 session taxonomy） |

**冲突时**（与 P1-c §Appendix A "不得双重定义"约束一致）：
- session / session-adjacent 分类语义以 **本 ADR 为准**
- MemoryTier 决策权语义以 **P1-c 为准**

---

## Appendix B: 现有 LiYe / AGE 资产入 taxonomy 的初始映射（NON-NORMATIVE）

| 路径 | 目标分类 | F1 现状 | 备注 |
|------|---------|---------|------|
| `liye_os/data/traces/orchestrator/*.json` | SESSION_EVENT_STREAM, format = PER_EVENT_JSON_DIR | **不满足 F1**（无 hash chain）| **provisional authoritative candidate, not yet F1-compliant**；必须先补 hash chain（或等价 chain 机制）才能注册为 SESSION_EVENT_STREAM；治理前不计入 strict_truth bucket 1 |
| `liye_os/state/traces/trace-<uuid>/` | SESSION_EVENT_STREAM, format = PER_TRACE_DIR | **不满足 F1**（无 hash chain）| 同上 |
| `liye_os/data/traces/{a3,d7,a3-batch1,...}/` | SESSION_EVENT_STREAM | **不满足 F1**（无 hash chain）| 同上；试验产生，retention 可短 |
| `liye_os/verdicts/` | SESSION_ADJACENT, kind = VERDICT | adjacent 不需 chain | derived_from 字段需回填指向决策事件；可直接注册 |
| `liye_os/evidence/` | SESSION_ADJACENT, kind = EVIDENCE_BUNDLE | adjacent 不需 chain | 同上 |
| `amazon-growth-engine/artifacts/onboarding/STR-*/state_transitions.jsonl` | SESSION_EVENT_STREAM, format = NDJSON_APPEND | **不满足 F1**（AGE `persistence.py` 当前事件行无 `prev_event_hash` 字段）| **provisional authoritative candidate, not yet F1-compliant**；必须先在 AGE 侧补 hash chain（或等价 chain）才能注册；补齐前不计入 strict_truth bucket 1 |

**这是入库参考，不是冻结映射**。具体注册由 C3-C4 落地。**所有标"不满足 F1"的 stream 必须先完成治理才能注册为 SESSION_EVENT_STREAM**——这是 F1 5 条同时满足的硬约束的直接推论。

---

**Version**: 1.0.0
**Last Updated**: 2026-04-16
