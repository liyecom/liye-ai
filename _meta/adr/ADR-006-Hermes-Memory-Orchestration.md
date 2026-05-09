# ADR-006: Hermes Memory Orchestration — truth-first 检索分层

**Status**: Superseded
**Date**: 2026-04-14
**Superseded-Date**: 2026-04-17
**Superseded-By**: `_meta/adr/ADR-Hermes-Memory-Orchestration.md`
**Decision Makers**: LiYe
**SSOT**: `_meta/adr/ADR-006-Hermes-Memory-Orchestration.md`

> Historical draft. Superseded by `ADR-Hermes-Memory-Orchestration.md` on 2026-04-17. Retained for audit/history only.

## Context

SYSTEMS.md 进化路线 P4 (C1 - Session Retrieval truth-first) 要求：
> 先检索结构化真相（receipts, verdicts, traces, ADRs），最后才搜会话文本。

Hermes Agent 作为参考仓（`hermes-agent (fork)` — 只读参考），其 memory 编排层是目前我们可参考的最成熟的 agent memory runtime。
本 ADR 对 Hermes 的 memory 编排做法进行结构化提取，明确吸收项与不吸收项，为 Loamwise (Layer 1) 的 session retrieval 实现提供 pattern benchmark。

**硬约束**：LiYe Systems 的检索优先级是 truth-first，不是 chat-history-first。Hermes 的做法是 session-text-centric（会话文本为中心），我们必须反转这个优先级。

## 上游核心做法

### MemoryManager 编排器

文件：`/Users/liye/github/hermes-agent/agent/memory_manager.py`

MemoryManager 是 Hermes 的 memory 编排入口，管理 builtin + 至多一个 external provider。核心职责：

1. **Provider 注册** — `add_provider()` 注册 MemoryProvider 实例，builtin 永远第一，external 最多一个
2. **System prompt 组装** — `build_system_prompt()` 收集所有 provider 的静态 prompt block
3. **Prefetch** — `prefetch_all(query)` 在每轮 API 调用前收集所有 provider 的召回上下文
4. **Sync** — `sync_all(user, assistant)` 每轮结束后将对话同步到所有 provider
5. **Tool routing** — `handle_tool_call()` 根据 tool name 路由到对应 provider
6. **Lifecycle hooks** — `on_turn_start()`, `on_session_end()`, `on_pre_compress()`, `on_memory_write()`, `on_delegation()`

关键设计：context fencing — 用 `<memory-context>` 标签隔离 prefetch 结果，防止模型将召回内容误认为用户输入。

### MemoryProvider 抽象基类

文件：`/Users/liye/github/hermes-agent/agent/memory_provider.py`

定义 provider 生命周期协议：

```
initialize() → system_prompt_block() → [per-turn: prefetch() → on_turn_start() → sync_turn() → queue_prefetch()] → on_session_end() → shutdown()
```

可选 hook：`on_pre_compress()`, `on_memory_write()`, `on_delegation()`

### Builtin Memory (MEMORY.md / USER.md)

文件：`/Users/liye/github/hermes-agent/tools/memory_tool.py`

MemoryStore 实现：
- 两个文件级存储：MEMORY.md（agent 笔记）和 USER.md（用户画像）
- **Frozen snapshot pattern**：session 开始时拍快照注入 system prompt，mid-session 写入只写磁盘不改 prompt（保护 prefix cache）
- 有界存储：memory 2200 chars, user 1375 chars
- 安全扫描：`_scan_memory_content()` 检测 prompt injection / exfiltration patterns
- 原子写：temp file + `os.replace()` 避免并发读写竞态

### Session Search (会话检索)

文件：`/Users/liye/github/hermes-agent/tools/session_search_tool.py`

- 基于 SQLite FTS5 的全文搜索
- 两种模式：recent sessions（零 LLM 成本）和 keyword search（LLM 摘要）
- 搜索结果经过 truncate + LLM 摘要压缩后注入上下文
- 排除当前 session 及其子 session（delegation chain 感知）

### External Provider (以 Honcho 为例)

文件：`/Users/liye/github/hermes-agent/plugins/memory/honcho/__init__.py`

三种 recall_mode：context（自动注入）、tools（工具调用）、hybrid（两者兼有）。
提供 4 个工具：honcho_profile, honcho_search, honcho_context, honcho_conclude。
包含 user modeling、dialectic Q&A、peer cards 等重用户建模能力。

### 集成点 (run_agent.py)

文件：`/Users/liye/github/hermes-agent/run_agent.py`

Agent 启动时：
1. 加载 builtin MemoryStore，从磁盘读取 MEMORY.md / USER.md
2. 按 config `memory.provider` 加载 external provider plugin
3. `initialize_all()` 初始化所有 provider
4. 将 provider tool schemas 注入 agent tool surface

每轮循环：
1. `_build_system_prompt()` — builtin 快照 + external provider prompt block
2. `prefetch_all(query)` — 每轮前一次性 prefetch（缓存结果，不重复调用）
3. `build_memory_context_block()` — 将 prefetch 结果包裹在 `<memory-context>` fence 中注入
4. `sync_all()` + `queue_prefetch_all()` — 轮后同步 + 预加载下轮

Session 结束：`on_session_end()` → `shutdown_all()`

## 吸收项

从 Hermes memory 编排中吸收以下 **patterns**（不搬代码）：

| Pattern | Hermes 来源 | LiYe Systems 用途 |
|---------|-------------|-------------------|
| **Provider 抽象** | `MemoryProvider` ABC | Loamwise retrieval provider 接口 |
| **Lifecycle hooks** | `on_turn_start`, `on_session_end`, `on_pre_compress` | 任务阶段 hook（非 turn-level） |
| **Prefetch + cache** | `prefetch_all()` 每轮一次 | 任务启动时一次性 truth prefetch |
| **Context fencing** | `<memory-context>` 标签隔离 | 用 `<truth-context>` 隔离结构化真相注入 |
| **Frozen snapshot** | system prompt 快照不变 | 防止 mid-task prompt 突变 |
| **安全扫描** | `_scan_memory_content()` | Guard 层 prompt injection 检测（P2 范畴） |
| **Bounded storage** | char limit + atomic write | 资源约束 pattern |

## 不吸收项

| 不吸收 | 原因 |
|--------|------|
| **Honcho user modeling** | 重用户建模与 LiYe Systems 治理导向不符。我们的 "用户" 是 LiYe 本人，不需要 dialectic Q&A / peer cards / user representation |
| **Smart routing** | Hermes 的 model routing 是面向多模型成本优化，与 Loamwise 的 policy-driven dispatch 正交 |
| **Auto skill repair** | LiYe Systems 的 skill 走 quarantine-first 流程（P3），不做 auto repair |
| **"对话代理就是一切" 的世界观** | Hermes 以会话为中心组织记忆。LiYe Systems 以结构化真相为中心，会话文本是最低优先级的补充信息 |
| **Session search as primary recall** | Hermes 的 `session_search` 是主要检索手段（FTS5 → LLM 摘要）。我们反转：先结构化真相，最后才 fallback 到会话文本 |
| **Turn-level sync** | Hermes 每轮同步对话到 provider。LiYe Systems 不做 turn-level 会话同步，只在 governed path 产出 traces/verdicts |

## 与 LiYe Systems 分层关系

| 四层架构 | Hermes 对应 | LiYe Systems 吸收后落地 |
|---------|------------|----------------------|
| **Layer 0: LiYe OS** | — | 定义 retrieval priority 合约、truth source schema |
| **Layer 1: Loamwise** | MemoryManager + MemoryProvider | `loamwise/align/` 实现 truth-first retrieval orchestrator |
| **Layer 2: Domain Engines** | Builtin MemoryStore | Domain engines 产出 receipts/verdicts/traces（被检索方） |
| **Layer 3: Product Lines** | Honcho, session_search | 不涉及（产品线不参与检索编排） |

核心差异：Hermes 的 MemoryManager 编排的是 **session memory**（会话记忆）。
Loamwise 编排的是 **truth retrieval**（真相检索）。Session text 只是 truth 的最低优先级来源之一。

## Decision

**核心决策：truth-first retrieval — 结构化真相优先于自然语言会话文本。**

LiYe Systems 借鉴 Hermes MemoryManager 的 provider 抽象和 lifecycle hook 设计，但反转其检索优先级：

1. Hermes: session text (primary) → memory notes (frozen) → external provider context (supplementary)
2. LiYe Systems: structured truth (primary) → traces/evidence (secondary) → session text (tertiary, fallback only)

Loamwise 在 `loamwise/align/` 实现 truth-first retrieval orchestrator，遵循以下优先级分层。

## Contract Sketch

### 1. Truth-first 检索分层

```
Retrieval Priority (highest → lowest):

  Priority 1 — Structured Truth (结构化真相)
  ├── receipts     (execution receipts from domain engines)
  ├── verdicts     (decision semantics, human-readable judgments)
  ├── contracts    (governance constraints, machine-enforced)
  └── ADRs         (architectural decision records)

  Priority 2 — Traces & Evidence (过程证据)
  ├── traces/      (execution traces, session traces)
  ├── evidence/    (verification evidence, test results)
  └── memory_brief (governed path curated session memory)

  Priority 3 — Session Text (会话文本, fallback only)
  ├── session transcripts  (raw conversation history)
  └── compressed summaries (post-compression session digests)
```

**规则**：Priority 1 的检索结果已足够回答查询时，不继续检索 Priority 2/3。Priority 3 只在 Priority 1+2 均无匹配时才 fallback。

### 2. Memory/Session Orchestration 最小接口

```typescript
/**
 * TruthProvider — 从某个 truth source 检索结构化信息。
 * 对标 Hermes MemoryProvider，但以 truth retrieval 为核心而非 session memory。
 */
interface TruthProvider {
  /** Provider identifier, e.g. "receipts", "verdicts", "traces", "session" */
  readonly name: string;

  /** 该 provider 负责的优先级层 */
  readonly priority: RetrievalPriority;

  /** 初始化（任务启动时调用一次） */
  initialize(taskId: string, context: TaskContext): Promise<void>;

  /** 根据查询返回匹配的 truth fragments */
  retrieve(query: RetrievalQuery): Promise<TruthFragment[]>;

  /** 任务结束后清理（flush, close） */
  shutdown(): Promise<void>;
}

/**
 * TruthOrchestrator — 编排多个 TruthProvider，执行 truth-first 检索。
 * 对标 Hermes MemoryManager，但强制 priority ordering。
 */
interface TruthOrchestrator {
  /** 注册 provider（按 priority 排序） */
  addProvider(provider: TruthProvider): void;

  /**
   * Truth-first retrieval — 从高优先级到低优先级逐层检索。
   * 若高优先级已返回足够结果，跳过低优先级层。
   */
  retrieve(query: RetrievalQuery): Promise<RetrievalResult>;

  /** 初始化所有 provider */
  initializeAll(taskId: string, context: TaskContext): Promise<void>;

  /** 关闭所有 provider */
  shutdownAll(): Promise<void>;
}
```

### 3. Retrieval Priority 类型定义

```typescript
/** 检索优先级枚举 — 数字越小优先级越高 */
enum RetrievalPriority {
  /** receipts, verdicts, contracts, ADRs */
  STRUCTURED_TRUTH = 1,
  /** traces, evidence, memory_brief */
  TRACES_EVIDENCE = 2,
  /** session transcripts, compressed summaries */
  SESSION_TEXT = 3,
}

interface RetrievalQuery {
  /** 自然语言查询或关键词 */
  text: string;
  /** 限定检索的 priority 层（默认全部，从高到低） */
  maxPriority?: RetrievalPriority;
  /** 最大返回条目数 */
  limit?: number;
  /** 是否启用 early-stop（高优先级足够时跳过低优先级） */
  earlyStop?: boolean;
}

interface TruthFragment {
  /** 来源 provider */
  source: string;
  /** 优先级层 */
  priority: RetrievalPriority;
  /** 内容 */
  content: string;
  /** 来源文件路径或 ID */
  ref: string;
  /** 相关性分数（0-1） */
  relevance: number;
}

interface RetrievalResult {
  /** 按 priority 排序的检索结果 */
  fragments: TruthFragment[];
  /** 实际检索了哪些层 */
  layersSearched: RetrievalPriority[];
  /** 是否触发了 early-stop */
  earlyStopTriggered: boolean;
}

interface TaskContext {
  /** 当前 track ID（如有） */
  trackId?: string;
  /** 执行模式 */
  mode: "fast" | "governed";
  /** 相关 domain engine */
  engine?: string;
}
```

## 非目标

本 ADR **不**决定以下事项：

- **不引入 Honcho** — 不做 dialectic Q&A、peer cards、user representation。LiYe 是系统唯一用户，不需要用户建模。
- **不引入 smart routing** — 模型选择不在 retrieval 层解决。
- **不实现 turn-level sync** — LiYe Systems 不是聊天应用，不需要每轮同步会话到外部 provider。
- **不做 auto skill repair** — 走 P3 quarantine-first 流程。
- **不扩展 P2/P3/P5 范畴** — 本 ADR 只覆盖 P4 (Session Retrieval truth-first)。
- **不做会话文本的 FTS5 索引** — session text 是 Priority 3 fallback，初期可以不实现。

## 后续实现入口

实现位置：`loamwise/align/`（Layer 1 编排中间层）。

对应 SYSTEMS.md 进化路线：
> P4 | C1 | Session Retrieval（truth-first） | loamwise/align/ | **先检索结构化真相，后检索会话文本**

实现时参照本 ADR 的 Contract Sketch，按以下顺序：
1. 定义 `TruthProvider` 接口 + `RetrievalPriority` 类型
2. 实现 `ReceiptsProvider` (Priority 1) — 检索 verdicts/, contracts/, _meta/adr/
3. 实现 `TracesProvider` (Priority 2) — 检索 traces/, evidence/
4. 实现 `TruthOrchestrator` — priority-ordered retrieval with early-stop
5. （远期）实现 `SessionTextProvider` (Priority 3) — 仅在 1+2 无结果时 fallback

**本 ADR 只做决策，不做实现。**
