# ADR-007: Loamwise Guard Content Security — 从 Hermes 萃取内容安全 Guard

**Status**: Superseded
**Date**: 2026-04-14
**Superseded-Date**: 2026-04-17
**Superseded-By**: `_meta/adr/ADR-Loamwise-Guard-Content-Security.md`
**Decision Makers**: LiYe
**SSOT**: `_meta/adr/ADR-007-Loamwise-Guard-Content-Security.md`

> Historical draft. Superseded by `ADR-Loamwise-Guard-Content-Security.md` on 2026-04-17. Retained for audit/history only.

## Context

SYSTEMS.md 进化路线 P2 (B1 - Content Threat Detection) 要求 Loamwise GuardChain 实现最小内容安全 Guard 集合。Hermes Agent 作为只读参考仓（见 SYSTEMS.md "参考与卫星项目"），已在生产中运行了多层内容安全防御。本 ADR 从 Hermes 萃取可吸收的 runtime patterns，设计 3 个 Guard 的 contract sketch，并明确吸收/不吸收边界。

SYSTEMS.md 硬约束：**P2 Content Guard 必须先 shadow mode（只观测不拦截）**，逐步启用拦截。

## 上游核心做法

Hermes Agent 的内容安全分布在 4 个层次、5 个扫描入口，按威胁类型分类如下：

### 层次 1: Prompt/Context Injection Detection（上下文注入检测）

**入口**: `/Users/liye/github/hermes-agent/agent/prompt_builder.py`

- `_CONTEXT_THREAT_PATTERNS` (10 条规则) 扫描所有注入 system prompt 的外部上下文文件（AGENTS.md, .cursorrules, SOUL.md, .hermes.md 等）
- 检测模式：prompt injection (`ignore previous instructions`), deception (`do not tell the user`), system prompt override, restriction bypass, HTML comment injection, hidden div, translate-then-execute, credential exfiltration via curl/cat
- `_CONTEXT_INVISIBLE_CHARS` 检测零宽字符（U+200B/200C/200D/2060/FEFF/202A-202E）
- **动作**: 匹配时整个文件被替换为 `[BLOCKED: ... contained potential prompt injection]`，内容不注入 system prompt

### 层次 2: Dangerous Command Detection（危险命令检测）

**入口**: `/Users/liye/github/hermes-agent/tools/approval.py`

- `DANGEROUS_PATTERNS` (35+ 条规则) 对 agent 拟执行的 shell 命令做 regex 检测
- 覆盖：递归删除、权限修改、磁盘格式化、SQL 破坏、系统配置覆盖、fork bomb、pipe-to-shell、script-via-heredoc、git 破坏性操作、自终止保护等
- `_normalize_command_for_detection()` 先做 ANSI escape strip + null byte strip + Unicode NFKC normalize，防绕过
- **动作**: 匹配后进入 approval flow（once/session/always/deny），非 hard block
- 额外集成 tirith binary 做内容级扫描（homograph URL, terminal injection 等）

**入口**: `/Users/liye/github/hermes-agent/tools/tirith_security.py`

- 调用外部 tirith 二进制做命令级安全扫描
- exit code 决定 verdict: 0=allow, 1=block, 2=warn
- JSON stdout 提供 findings/summary 但不覆盖 exit code verdict
- fail_open/fail_closed 可配置（spawn 失败、超时时的行为）
- **动作**: block 时拒绝执行，warn 时允许但提示

### 层次 3: Memory/Truth Write Protection（记忆/真相写保护）

**入口**: `/Users/liye/github/hermes-agent/tools/memory_tool.py`

- `_MEMORY_THREAT_PATTERNS` (14 条规则) 扫描所有写入 MEMORY.md / USER.md 的内容
- 检测：prompt injection, role hijack (`you are now`), deception, system prompt override, restriction bypass, credential exfiltration (curl/wget/cat), SSH backdoor, SSH access, Hermes env access
- `_INVISIBLE_CHARS` 检测零宽字符
- **动作**: 匹配时 `_scan_memory_content()` 返回错误字符串，写入被拒绝
- 设计理由：memory 被注入 system prompt，投毒 memory = 持久化 prompt injection

### 层次 4: Skill Supply Chain Scanning（技能供应链扫描）

**入口**: `/Users/liye/github/hermes-agent/tools/skills_guard.py`

- `THREAT_PATTERNS` (80+ 条规则，按 category 分组) 是 Hermes 最完整的威胁模式库
- 7 大 category: exfiltration, injection, destructive, persistence, network, obfuscation, execution, traversal, mining, supply_chain, privilege_escalation, credential_exposure
- Trust-aware policy: `builtin` / `trusted` / `community` / `agent-created` 四级信任
- 结构检查: MAX_FILE_COUNT(50), MAX_TOTAL_SIZE_KB(1024), MAX_SINGLE_FILE_KB(256), 二进制文件检测, symlink 检测
- Verdict: safe / caution / dangerous，结合 trust level 查 INSTALL_POLICY 矩阵决定 allow/block/ask
- **动作**: community source + caution/dangerous → block；trusted + dangerous → block

### 附加: Cron Prompt Scanning

**入口**: `/Users/liye/github/hermes-agent/tools/cronjob_tools.py`

- `_CRON_THREAT_PATTERNS` (10 条 critical-only 规则) 扫描 cron job 的 prompt
- 只保留最严重的检测（injection, exfil, backdoor, destructive），因 cron 有完整工具权限且无人值守

### 附加: SSRF Prevention

**入口**: `/Users/liye/github/hermes-agent/tools/url_safety.py`

- 所有 URL 请求前做 DNS 解析 + IP 范围检查（private/loopback/link-local/reserved/multicast/CGNAT）
- 已知内部域名黑名单（cloud metadata endpoints）
- fail-closed: DNS 解析失败 → block

## 吸收项

从 Hermes 的多层防御中，为 Loamwise GuardChain 吸收以下 3 个 Guard 的 runtime pattern:

### Guard 1: ContentScanGuard（内容扫描 Guard）

吸收来源：`skills_guard.py` 的 THREAT_PATTERNS + `approval.py` 的 DANGEROUS_PATTERNS

- 吸收 regex-based 威胁模式检测架构（pattern → finding → verdict 三阶段）
- 吸收 category 分类体系: exfiltration, injection, destructive, persistence, network, obfuscation
- 吸收 severity 分级: critical / high / medium / low
- 吸收 Unicode normalization + invisible char detection 的反绕过手段
- 吸收 trust-aware policy 矩阵的设计思路（不照搬具体 trust level）

### Guard 2: TruthWriteGuard（真相写保护 Guard）

吸收来源：`memory_tool.py` 的 `_scan_memory_content()` + `_MEMORY_THREAT_PATTERNS`

- 吸收"写入系统 prompt 的内容必须经过扫描"的原则
- 吸收 injection + exfiltration + persistence 三类威胁检测对写操作的保护
- 吸收 invisible unicode 检测对写路径的覆盖
- 适配 Loamwise 场景：保护 T1/T2/T3 truth 写入、learned_policy 写入、memory_brief 写入

### Guard 3: ContextInjectGuard（上下文注入 Guard）

吸收来源：`prompt_builder.py` 的 `_scan_context_content()` + `_CONTEXT_THREAT_PATTERNS`

- 吸收"外部上下文注入前必须扫描"的原则
- 吸收 prompt injection / deception / hidden content 检测模式
- 吸收 HTML comment injection + hidden div 检测
- 适配 Loamwise 场景：保护 engine_manifest 加载、外部 context file 注入、plugin 输出注入

## 不吸收项

| Hermes 做法 | 不吸收原因 |
|-------------|-----------|
| Tirith 二进制集成 | 外部二进制依赖，Loamwise 不引入。ContentScanGuard 用纯 regex 覆盖 |
| Auto-install + cosign 验证 | 供应链安全机制，属于产品级运维，Loamwise 不需要 |
| Approval flow (once/session/always/deny) | Hermes 的交互式审批是产品 UX，Loamwise 用 shadow/active mode 替代 |
| YOLO mode (跳过所有审批) | 与 Loamwise 治理原则冲突，不引入 |
| Trust-aware skill install policy | Loamwise 不做 skill marketplace，不需要 builtin/trusted/community 信任层 |
| URL safety / SSRF prevention | 网络安全属于 runtime infra 层，不属于 content guard 范畴 |
| Website blocklist / policy | 产品级 URL 策略，不属于 content guard |
| Smart approval (auxiliary LLM auto-approve) | LLM 判定安全性不可靠，Loamwise 不引入 |

## 与 LiYe Systems 分层关系

```
Layer 0: LiYe OS                Guard contract 定义（本 ADR + schema）
         ├─ _meta/adr/           本文件
         └─ _meta/contracts/     guard contract schema (future)

Layer 1: Loamwise               Guard 实现位置
         └─ govern/
            ├─ guards/
            │  ├─ content_scan_guard.ts
            │  ├─ truth_write_guard.ts
            │  └─ context_inject_guard.ts
            └─ guard_chain.ts    串联入口

Layer 2: Domain Engines          Guard 消费者（被 GuardChain 保护）
         └─ engine 的 playbook 执行前/后经过 GuardChain

Layer 3: Product Lines           不直接接触 Guard
```

Guards 运行在 Loamwise (Layer 1)，由 GuardChain 串联调用。Domain Engines (Layer 2) 通过 Loamwise dispatch 协议间接受到保护。Layer 0 只定义合约，不实现 Guard 逻辑。

## Decision

1. **实现 3 个 Guard**: ContentScanGuard, TruthWriteGuard, ContextInjectGuard，各自覆盖不同威胁面
2. **Shadow mode first**: 所有 Guard 启动时 `mode: 'shadow'`，只记录审计日志不拦截。观测一段时间后手动升级为 `mode: 'active'`
3. **GuardChain 串联**: 3 个 Guard 由 GuardChain 按顺序执行，任一 Guard 在 active mode 下判定 `block` 则中止管线
4. **审计优先**: 每次 Guard 执行必须输出审计记录（含 trace_id, guard_id, timestamp, judgment, mode），无论 shadow 还是 active
5. **Pattern 独立维护**: 每个 Guard 维护自己的 pattern 集合，不共享。从 Hermes 提取的 pattern 是起点，后续按 Loamwise 场景演化

## Contract Sketch

### 共享类型

```typescript
/** Guard 判定级别 */
type JudgmentLevel = 'pass' | 'warn' | 'block';

/** Guard 运行模式 */
type GuardMode = 'shadow' | 'active';

/** 单条检测发现 */
interface Finding {
  pattern_id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  matched_text: string;
  description: string;
}

/** Guard 审计记录（所有 Guard 共享） */
interface GuardAuditRecord {
  trace_id: string;           // 关联到 Task Ledger 的 trace
  guard_id: string;           // e.g. 'content_scan' | 'truth_write' | 'context_inject'
  timestamp: string;          // ISO 8601
  mode: GuardMode;            // shadow 模式下 judgment 仅记录，不拦截
  judgment: JudgmentLevel;
  findings: Finding[];
  input_hash: string;         // SHA-256 of input content, for replay
  execution_ms: number;       // Guard 执行耗时
}
```

### ContentScanGuard

```typescript
/**
 * ContentScanGuard — 通用内容威胁扫描
 *
 * 威胁面: 命令 payload 中的危险操作、数据外泄、混淆绕过
 * 吸收来源: Hermes skills_guard.py THREAT_PATTERNS + approval.py DANGEROUS_PATTERNS
 * 执行时机: engine playbook 执行前，扫描待执行的命令/代码内容
 */
interface ContentScanGuardInput {
  content: string;            // 待扫描内容（命令、代码、payload）
  content_type: 'command' | 'code' | 'text' | 'structured';
  source_engine?: string;     // 来源 engine ID
  task_id?: string;           // 关联的 Task Ledger task ID
}

interface ContentScanGuardOutput {
  judgment: JudgmentLevel;    // pass: 无发现; warn: 有中低风险发现; block: 有 critical/high 发现
  findings: Finding[];
  audit: GuardAuditRecord;
}

/** ContentScanGuard 配置 */
interface ContentScanGuardConfig {
  mode: GuardMode;            // 默认 'shadow'
  /** block 阈值: 达到此 severity 级别时 judgment 为 block */
  block_threshold: 'critical' | 'high';
  /** warn 阈值: 达到此 severity 级别时 judgment 为 warn */
  warn_threshold: 'medium' | 'low';
  /** 启用的 category 集合，可逐步开启 */
  enabled_categories: Set<string>;
}
```

### TruthWriteGuard

```typescript
/**
 * TruthWriteGuard — 真相/记忆写入保护
 *
 * 威胁面: 通过写入 truth/memory/policy 实现持久化 prompt injection
 * 吸收来源: Hermes memory_tool.py _MEMORY_THREAT_PATTERNS + _scan_memory_content()
 * 执行时机: 任何对 T1/T2/T3 truth、learned_policy、memory_brief 的写操作前
 */
interface TruthWriteGuardInput {
  content: string;            // 拟写入的内容
  target: 'truth_t1' | 'truth_t2' | 'truth_t3' | 'learned_policy' | 'memory_brief';
  operation: 'add' | 'replace' | 'remove';
  author: 'human' | 'agent' | 'engine';  // 写入来源
  task_id?: string;
}

interface TruthWriteGuardOutput {
  judgment: JudgmentLevel;    // pass: 安全; warn: 可疑但允许; block: 检测到注入/外泄
  findings: Finding[];
  audit: GuardAuditRecord;
}

/** TruthWriteGuard 配置 */
interface TruthWriteGuardConfig {
  mode: GuardMode;            // 默认 'shadow'
  /** human 来源是否跳过扫描（信任人类写入） */
  trust_human_writes: boolean;
  /** 启用 invisible unicode 检测 */
  detect_invisible_unicode: boolean;
  /** 启用的检测 category */
  enabled_categories: Set<'injection' | 'exfiltration' | 'persistence'>;
}
```

### ContextInjectGuard

```typescript
/**
 * ContextInjectGuard — 上下文注入前扫描
 *
 * 威胁面: 外部文件/plugin 输出注入 prompt 时携带 prompt injection payload
 * 吸收来源: Hermes prompt_builder.py _CONTEXT_THREAT_PATTERNS + _scan_context_content()
 * 执行时机: engine_manifest 加载、外部 context file 注入、plugin 输出注入 prompt 前
 */
interface ContextInjectGuardInput {
  content: string;            // 拟注入的上下文内容
  source_file?: string;       // 来源文件路径
  source_type: 'engine_manifest' | 'context_file' | 'plugin_output' | 'external';
  task_id?: string;
}

interface ContextInjectGuardOutput {
  judgment: JudgmentLevel;    // pass: 安全; warn: 可疑; block: 检测到注入
  sanitized_content?: string; // 当 judgment 为 block 时提供替代内容（类似 Hermes 的 [BLOCKED: ...] 消息）
  findings: Finding[];
  audit: GuardAuditRecord;
}

/** ContextInjectGuard 配置 */
interface ContextInjectGuardConfig {
  mode: GuardMode;            // 默认 'shadow'
  /** block 时是否提供 sanitized 替代内容（vs 直接拒绝） */
  provide_sanitized_fallback: boolean;
  /** 启用 HTML/hidden content 检测 */
  detect_hidden_content: boolean;
  /** 启用 invisible unicode 检测 */
  detect_invisible_unicode: boolean;
}
```

### GuardChain 编排

```typescript
/**
 * GuardChain — Guard 串联执行器
 *
 * 按注册顺序执行 Guard。在 active mode 下，任一 Guard 返回 block 则中止管线。
 * 在 shadow mode 下，所有 Guard 均执行完毕，结果仅记录不拦截。
 */
interface GuardChainConfig {
  guards: Array<{
    guard_id: string;
    enabled: boolean;
    config: ContentScanGuardConfig | TruthWriteGuardConfig | ContextInjectGuardConfig;
  }>;
  /** 全局 shadow override: true 时忽略各 guard 的 mode 设置，全部 shadow */
  global_shadow: boolean;
}

interface GuardChainResult {
  overall_judgment: JudgmentLevel;
  guard_results: Array<{
    guard_id: string;
    judgment: JudgmentLevel;
    mode: GuardMode;
    findings_count: number;
  }>;
  audits: GuardAuditRecord[];
  blocked_by?: string;        // 当 overall_judgment 为 block 时，记录是哪个 guard 触发的
}
```

## 非目标

本 ADR 不决定以下内容：

1. **不决定具体 pattern 清单** — pattern 从 Hermes 提取后需要按 Loamwise 场景裁剪，属于实现阶段工作
2. **不决定 shadow → active 的升级条件** — 需要观测期数据（false positive rate, coverage）后再定
3. **不决定 Guard 与 KillSwitch 的联动方式** — KillSwitch 是独立 P1 能力，后续 ADR 定义联动
4. **不决定网络安全 Guard** — SSRF prevention, URL safety 不在 P2 范围内
5. **不决定 audit 存储方案** — GuardAuditRecord 输出格式已定义，存储后端（文件/DB/trace 系统）后续决定
6. **不实现任何代码** — 本 ADR 仅产出 contract sketch

## 后续实现入口

P2 (B1 - Content Threat Detection) 的实现位置：`loamwise/govern/`

```
loamwise/govern/
├── guards/
│   ├── content_scan_guard.ts    ← ContentScanGuard 实现
│   ├── truth_write_guard.ts     ← TruthWriteGuard 实现
│   ├── context_inject_guard.ts  ← ContextInjectGuard 实现
│   └── patterns/                ← 各 guard 的 pattern 定义（从 Hermes 提取后裁剪）
│       ├── content_scan.ts
│       ├── truth_write.ts
│       └── context_inject.ts
├── guard_chain.ts               ← GuardChain 串联编排
└── types.ts                     ← 共享类型（JudgmentLevel, GuardMode, Finding, etc.）
```

**不要现在实现。** 等本 ADR 状态变更为 Accepted 后再开始 P2 编码。
