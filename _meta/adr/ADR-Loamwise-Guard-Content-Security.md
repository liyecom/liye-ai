---
artifact_scope: meta
artifact_name: Loamwise-Guard-Content-Security
artifact_role: harvest
target_layer: 1
is_bghs_doctrine: no
---

# ADR — Loamwise Guard Content Security（P1-d）

**Status**: Accepted
**Date**: 2026-04-16
**Accepted-Date**: 2026-04-17
**Decision Makers**: LiYe
**SSOT**: `_meta/adr/ADR-Loamwise-Guard-Content-Security.md`
**References**:
- `_meta/adr/ADR-Architecture-Doctrine-BGHS-Separation.md`（必读前置）
- `_meta/adr/ADR-OpenClaw-Capability-Boundary.md`（capability 边界 + DecisionAuthority）
- `_meta/adr/ADR-Hermes-Skill-Lifecycle.md`（lifecycle 治理 + ContentScanGuard 引用）
- `_meta/adr/ADR-Hermes-Memory-Orchestration.md`（memory 编排 + ContentScanGuard + TruthWriteGuard 引用）
- **Forward ref**: `_meta/adr/ADR-Session-and-Session-Adjacent-Taxonomy-Federated-Query.md`（P1-e，提供 GuardEvidence 写入位置）
**Source**: `/Users/liye/github/hermes-agent/`（fork 自 `NousResearch/hermes-agent`，只读参考）

---

## Context

LLM-driven 系统在 4 个位置存在内容级威胁面：

1. **上下文注入**（ingest）：恶意内容混入 system prompt / context，劫持模型推理
2. **危险命令 / 工具 payload**（execution）：模型输出含危险 shell / API 调用
3. **记忆写入投毒**（memory write）：恶意内容写入持久记忆，跨会话长期影响
4. **技能供应链**（skill / capability registration）：恶意 skill / capability 进入注册表（已由 P1-b 处理）

Hermes Agent 在前 3 个位置都有 regex / heuristic 级实现，体量适中、模式可读、容易移植。但 Hermes 的 guard 普遍是**默认 hard block + 单点扫描**；LiYe Systems 必须**先 shadow mode**（与 SYSTEMS.md P2 硬约束一致），再按证据 escalate 到 active 拦截。

更关键的是：**Guards 是 Governance**——它们是跨模型代际不放松的不变量；它们的实现是 Hands。**Guards 不产生 truth，只分类威胁**——它们的 verdict 不能被任何路径提升为 authoritative（与 P1-c §1 derivation_rule 对齐）。

本 ADR 萃取 Hermes 的内容安全 patterns，落成 LiYe Systems 的 GuardChain contract——**回答"哪些路径必经 guard、guard verdict 如何进入治理链"，不写扫描器功能目录**。

Guard contract 由 Layer 0 定义；GuardChain 与各 Guard 实现由 Loamwise（Layer 1）落地，路径在 `loamwise/govern/guards/`。

---

## 上游核心做法（Hermes 的内容安全实现）

### H1. 上下文注入扫描（ingest 路径）

`/Users/liye/github/hermes-agent/agent/prompt_builder.py`：
- `_CONTEXT_THREAT_PATTERNS` 列出已知 prompt injection 标志（如"忽略上述指令"、"系统提示"伪装等）
- `_scan_context_content()` 在文件 / context 进入 system prompt **之前**扫描
- 命中 = 阻断该 fragment 进入 prompt（不静默）

### H2. 危险命令检测（execution 路径）

`/Users/liye/github/hermes-agent/tools/approval.py`：
- `DANGEROUS_PATTERNS`（35+ 条）覆盖 shell / API / 凭据外泄 / fs 越界
- **Unicode normalization** 在匹配前执行，防止字符变形绕过
- 命中 → 转 approval flow（用户确认）

### H3. 外部二进制扫描器（Tirith）

`/Users/liye/github/hermes-agent/tools/tirith_security.py`：
- 调用外部二进制 `tirith` 做扫描
- exit-code → verdict（allow / block / warn）
- **fail-open 配置**（二进制不存在时跳过）

### H4. 记忆写入保护（memory write 路径）

`/Users/liye/github/hermes-agent/tools/memory_tool.py`：
- `_MEMORY_THREAT_PATTERNS` 针对持久化记忆的特殊威胁（如自我引用 prompt 注入、token 泄漏）
- `_scan_memory_content()` 在 MEMORY.md / USER.md 写入前扫描

### H5. Skill 供应链扫描（已在 P1-b 覆盖）

`/Users/liye/github/hermes-agent/tools/skills_guard.py`（80+ 条规则、4 级 trust、3 级 verdict）——本 ADR 不重复 P1-b 已覆盖的内容，仅在必要时复用其扫描结果作为 ContentScanGuard 的实现一部分。

---

## 吸收什么

| 编号 | 吸收项 | 理由 |
|------|-------|------|
| **A1** | **三类内容威胁分层（context-inject / dangerous-command / memory-write）** | 与 LiYe 4 个治理位点直接对齐，命名与 P1-b/c 一致 |
| **A2** | **Regex / heuristic pattern-based scanning** + **可解释的命中证据** | 模式可读、可审计；非 ML 黑盒，符合 Governance 可解释要求 |
| **A3** | **Unicode normalization 反绕过** | 任何输入扫描前必先 NFC 归一 + 非可见字符剔除 |
| **A4** | **Pre-write scanning**（写入前扫描，不是事后审计） | 与 P1-c MemoryUsePolicy 的 guard_chain_required 对接 |
| **A5** | **Per-fragment 命中证据 + 脱敏后留痕** | guard verdict 必带 evidence；evidence 可被 replay 验证 |

---

## 不吸收什么

| 编号 | 不吸收项 | 理由 |
|------|---------|------|
| **R1** | **默认 hard block**（无 shadow 阶段） | 违反 SYSTEMS.md P2 硬约束；新 guard 必须**先 shadow（只观测不拦截）**，按证据再 escalate |
| **R2** | **Tirith 外部二进制扫描器** | 增加不可见依赖 + fail-open 默认 = 信任假设错误；LiYe 内置 guard，外部扫描器作为可选 supplement，**不在 default chain** |
| **R3** | **Approval UX flow**（"用户确认"作为唯一兜底） | LiYe 的 approval 走 Loamwise approval-state-machine 与 P1-b PromotionDecision，不再拼装新 UX |
| **R4** | **YOLO mode / global bypass switch** | 任何 guard 都不允许全局 bypass；需要绕过必须 ADR + 审计签名 |
| **R5** | **Smart routing**（"模型自己决定要不要扫"） | guard 路径由 GuardChain 静态声明 + Governance 校验 |
| **R6** | **Heuristic verdict 提升为 authoritative truth** | guard verdict 永远是**威胁分类**，不是 truth；不得进入 P1-c authoritative tier |
| **R7** | **Fail-open 默认**（扫描器不可用 = 放行） | LiYe Systems 一律 **fail-closed**：guard 不可用 = 拒绝相应操作 |
| **R8** | **单点扫描**（一次过完事） | 关键路径需 GuardChain（多 guard 串/并联），并且不同 guard 可独立 shadow / active |
| **R9** | **把 Loamwise Guard 写成"万能内容安全平台"** | Guards 只覆盖 P1-d 显式声明的 4 个治理位点；不主动扩展到 anti-malware / DLP / SIEM 等领域 |

---

## 与 LiYe Systems 分层与 BGHS 的映射

> 不再定义 BGHS 规则——见 P1-Doctrine §1。

| Hermes 组件 | LiYe 视角 primary concern | 在 LiYe Systems 的对应位置 |
|------------|--------------------------|--------------------------|
| `prompt_builder._scan_context_content` | **Governance** (rule) + **Hands** (impl) | Layer 0 contract（ContextInjectGuard 定义）+ Layer 1 实现（`loamwise/govern/guards/context-inject/`） |
| `approval.DANGEROUS_PATTERNS` | **Governance** (规则集) | Layer 0 contract（ContentScanGuard 的 dangerous-command 规则集） |
| `memory_tool._scan_memory_content` | **Governance** + **Hands** | Layer 1 — TruthWriteGuard 的实现一部分 |
| `tirith_security`（外部二进制） | — | **不吸收**（R2） |
| `skills_guard`（80+ 规则） | **Governance** (规则) | 已由 P1-b 覆盖；本 ADR 不重复 |
| Unicode normalization 流程 | **Hands** | Layer 1 — 所有 Guard 共享 utility |
| Verdict 分级 (safe/caution/dangerous) | **Governance** | Layer 0 contract（GuardVerdict 枚举） |
| Pattern 命中 evidence 收集 | **Session** (脱敏后的命中记录) | session-adjacent，由 P1-e 定义存储位置 |

**Layer 归属**：
- **Layer 0（liye_os）**：定义 GuardKind / GuardVerdict / GuardEvidence / GuardEnforcementMode / GuardChain spec、各 Guard 的 input/output 接口、threat catalog 模式
- **Layer 1（loamwise）**：实施各 Guard 的扫描器、Guard 串/并联编排（GuardChain runtime）、shadow → active escalation runtime、Unicode normalization utility

**容易错判**：

| 容易错判 | 正确判法 |
|---------|---------|
| 把 Guard 实现判为 Governance（"它管安全"） | 实现随模式集 / 引擎演化 → Hands；"必须有 guard 拦截"这条规则 → Governance |
| 把 GuardVerdict 判为 truth（"它说危险就是危险"） | Verdict 是**威胁分类**，不是 truth；不得进入 P1-c authoritative tier（R6） |
| 把 shadow mode 判为 Brain（"它是观察模式"） | shadow / active 是 enforcement mode（Governance 视角下的部署阶段），不是 harness 选择 |

---

## Guard Rules（裁判手册）

### G1. 三类内容 Guard（与 P1-b/c 命名严格对齐）

**仅以下三种 Guard 进入 default GuardChain**（不允许平行命名 / 隐式新增）：

| GuardKind | 主关注位点 | 触发路径 |
|-----------|----------|---------|
| `ContentScanGuard` | 通用内容扫描（dangerous command / 凭据 / 已知 prompt injection 标志） | skill candidate 提交 / memory write / context ingest（共享 scanner pool） |
| `TruthWriteGuard` | 写入 authoritative tier 的额外保护 | 任何 → MemoryTier.AUTHORITATIVE 的写入 / authoritative session event 写入 |
| `ContextInjectGuard` | system prompt / frozen snapshot 装配前的注入扫描 | MemoryAssemblyPlan 装配 frozen snapshot 之前 |

新增 GuardKind 必须经 Layer 0 后续 contract ADR（与 P1-Doctrine D5 一致：具体决策/不变量改 contract ADR，不修 Doctrine）。

### G2. 必经 Guard 的路径清单（白名单）

以下路径**必经** GuardChain（不可绕过）：

| 路径 | 必经 Guard 集 | 来源 |
|------|--------------|------|
| Skill candidate 提交（任意 source） | `ContentScanGuard` | P1-b §8 acceptCandidate |
| Skill promotion（→ ACTIVE） | `ContentScanGuard`（重新扫描）+ `TruthWriteGuard`（如声明 authoritative capability） | P1-b §4 PromotionDecision |
| Memory write to `decision-support` / `context-only` | `ContentScanGuard` | P1-c §5 MemoryUsePolicy.write_allowed_by |
| Memory write to `authoritative` | `ContentScanGuard` + `TruthWriteGuard` | P1-c §5 |
| MemoryAssemblyPlan 装配 frozen snapshot | `ContextInjectGuard`（对每个 fragment） | P1-c §4 |
| 任何 Engine / Skill 的 capability registration | `ContentScanGuard`（针对 declaration / metadata） | P1-a §2 register() |

**未在白名单内的路径不强制经 Guard**——但任何想引入新路径都必须扩展本表（Layer 0 contract ADR）。

### G3. Shadow mode FIRST，按证据再 escalate（SYSTEMS.md P2 硬约束）

任何 Guard 上线必须按以下阶段：

| 阶段 | mode | 行为 | escalation 条件 |
|------|------|------|----------------|
| 1. **Shadow** | `shadow` | 只观测、写 GuardEvidence；**不拦截、不影响调用方** | 累计 N 次（policy-defined）以上 caution+ verdict + 无误报 → 进 advisory |
| 2. **Advisory** | `advisory` | 写 evidence + 在调用方 response 内附 warning；**仍不拦截** | M 次以上无规避 / 无破坏性 false-positive → 进 active |
| 3. **Active** | `active` | dangerous → block（fail-closed）；caution → escalate to approval；safe → pass | — |

**降级方向**（active → advisory / shadow）：仅在出现高频 false-positive 或线上事故时由 Guard owner + Loamwise maintainer 双签 ADR 触发。

### G4. Verdict 是威胁分类，不是 truth

- GuardVerdict 永远不进入 P1-c authoritative tier
- GuardVerdict 永远不直接驱动 P1-a DecisionKind 决策（除非显式 policy ADR 引用 verdict 作为决策输入）
- Verdict 只能作为**否决信号**（active mode block）或**证据信号**（写入 GuardEvidence）

### G5. Fail-closed 默认（与 R7 对齐）

- Guard 实现不可用 / 超时 / 异常 → 该路径**拒绝放行**（fail-closed）
- 例外：shadow mode 下 fail-open 是允许的（不拦截，仅写"扫描失败"evidence），但 advisory / active 必须 fail-closed
- 全局 fail-open 开关 = **禁止存在**（R4）

### G6. Pattern 集合是 Governance；扫描器实现是 Hands

- **威胁 pattern catalog**（regex / heuristic 模式集）是 Governance：增删需经 contract ADR 或 policy ADR
- **扫描器实现**（如何高效执行匹配 / 是否引入 ML 模型）是 Hands：可在 Loamwise 自由演化
- 实现升级**不允许放松**已声明的 pattern（R-不放松准则）

### G7. Evidence 必须脱敏 + append-only

- GuardEvidence 写入 session-adjacent 存储（位置由 P1-e 定义）
- 命中片段 **必须脱敏**（如凭据 hash / 长片段截断）后写入；原文不进 evidence
- Evidence append-only，不可改写
- Evidence 包含：`guard_id` / `guard_kind` / `mode` / `verdict` / `redacted_snippet` / `pattern_id` / `scanned_at` / `trace_id`

### G8. GuardChain 是静态声明，不是动态拼接

- 每条受保护路径在 Layer 0 contract 里**显式声明** GuardChain 组成（哪些 Guard、串/并联、各自 mode）
- Loamwise runtime **不允许在运行时插入 / 删除 / 重排** GuardChain 顺序
- 修改 GuardChain 必须经 contract ADR

---

## Contract Sketch

### §1. GuardKind（三种内容 Guard，固定枚举）

```typescript
enum GuardKind {
  CONTENT_SCAN     = 'content-scan',     // 通用内容扫描（dangerous command / credentials / prompt injection markers）
  TRUTH_WRITE      = 'truth-write',      // authoritative tier 写入保护
  CONTEXT_INJECT   = 'context-inject',   // system prompt / frozen snapshot 装配前注入扫描
}

// 扩展通道：新增 GuardKind 必须经 Layer 0 后续 contract ADR
// 当前不预留占位
```

### §2. GuardVerdict（威胁分级，固定枚举）

```typescript
enum GuardVerdict {
  SAFE       = 'safe',         // 未命中已知威胁模式
  CAUTION    = 'caution',      // 命中可疑模式，证据不充分
  DANGEROUS  = 'dangerous',    // 命中已知危险模式
}

// Verdict 只能由 Guard 实现产生；不得由其他 component 自行声明
// Verdict 不进入 P1-c authoritative tier（G4）
// Verdict 不可被外部修改（append-only）
```

### §3. GuardEnforcementMode（部署阶段，shadow → active 演进）

```typescript
enum GuardEnforcementMode {
  SHADOW     = 'shadow',       // 观测 + 写 evidence，不拦截
  ADVISORY   = 'advisory',     // 观测 + 写 evidence + 调用方 response 附 warning，不拦截
  ACTIVE     = 'active',       // dangerous = block；caution = escalate；safe = pass
}

// 任何 Guard 必须从 SHADOW 起步（G3 + SYSTEMS.md P2 硬约束）
// SHADOW 阶段允许 fail-open；ADVISORY / ACTIVE 必须 fail-closed（G5）
```

### §4. GuardEvidence（命中证据，脱敏 append-only）

```typescript
interface GuardEvidence {
  evidence_id: string                     // UUIDv7
  guard_id: string                        // 具体 guard 实例 id
  guard_kind: GuardKind
  mode: GuardEnforcementMode              // 当时的 mode
  verdict: GuardVerdict
  scanned_at: string                      // ISO 8601

  // 关联
  trace_id: string                        // 指向触发扫描的 session event
  scanned_path: ScannedPath               // 被扫描的对象（见下）

  // 命中详情（必须脱敏）
  hits: HitDetail[]
  scanner_version: string
  pattern_catalog_version: string

  // fail-closed 状态（如果扫描失败）
  scanner_failed: boolean                 // 仅 SHADOW 模式可为 true
  failure_reason: string | null
}

interface ScannedPath {
  path_kind: 'skill-candidate' | 'memory-write' | 'frozen-snapshot-fragment' | 'capability-registration'
  target_ref: string                      // 被扫描对象的 reference（candidate_id / record_id / etc.）
}

interface HitDetail {
  pattern_id: string                      // pattern catalog 内的稳定 id
  category: string                        // 'dangerous-command' / 'credential-leak' / 'prompt-injection' / etc.
  redacted_snippet: string                // 必须脱敏：凭据 hash / 长片段截断 / 二进制摘要
  position_hint: string | null            // line / offset 等定位（不含原文）
  severity_score: number                  // 0..1
}
```

### §5. GuardChain（静态声明的 guard 编排）

```typescript
interface GuardChain {
  chain_id: string
  protected_path: ProtectedPath           // 此 chain 保护哪条路径（必须在 G2 白名单内）

  // 静态声明：哪些 guard、什么顺序、各自什么 mode
  steps: GuardChainStep[]

  // 全局 enforcement override（仅诊断用，需双签 ADR）
  global_shadow: false                    // 默认禁止；启用必须 ADR 显式注明

  declared_at: string
  declared_by_adr: string                 // 必须引用具体 ADR
}

interface GuardChainStep {
  step_id: string
  guard_kind: GuardKind
  mode: GuardEnforcementMode
  parallel_with: string[] | null          // 与哪些 step_id 并联（默认串联）
  on_verdict: VerdictRouting              // 不同 verdict 触发的下游行为

  // 非 SHADOW 起步必须显式指向一条 escalation / policy ADR（不是仅靠 chain.declared_by_adr）
  // SHADOW step：必须为 null
  // ADVISORY / ACTIVE step：必须非空，且指向一份明确解释为何此 step 已离开 shadow 阶段的 ADR
  non_shadow_allowed_by: string | null
}

interface VerdictRouting {
  on_safe: 'pass'
  on_caution: 'pass-with-warning' | 'escalate-approval' | 'block'
  on_dangerous: 'block' | 'escalate-approval'    // 'pass' 永远禁止
}

enum ProtectedPathKind {
  SKILL_CANDIDATE_SUBMIT      = 'skill.candidate-submit',
  SKILL_PROMOTION             = 'skill.promotion',
  MEMORY_WRITE_NON_AUTH       = 'memory.write.non-authoritative',
  MEMORY_WRITE_AUTH           = 'memory.write.authoritative',
  ASSEMBLY_FRAGMENT_INGEST    = 'assembly.fragment-ingest',
  CAPABILITY_REGISTRATION     = 'capability.registration',
}

interface ProtectedPath {
  kind: ProtectedPathKind
  required_guard_kinds: GuardKind[]       // G2 白名单约束（validator 强制）
}
```

### §6. Default GuardChain（NON-NORMATIVE 示意）

下表展示 G2 白名单 6 条路径的默认 chain 组成，**具体 mode 应按 G3 阶段推进**（新部署起点为 SHADOW）。

| Protected Path | Default Chain |
|---------------|---------------|
| `skill.candidate-submit` | `ContentScanGuard(shadow)` |
| `skill.promotion` | `ContentScanGuard(active)` → `TruthWriteGuard(shadow)` if authoritative capability |
| `memory.write.non-authoritative` | `ContentScanGuard(shadow → advisory → active)` |
| `memory.write.authoritative` | `ContentScanGuard(active)` ∥ `TruthWriteGuard(shadow → active)`（并联）|
| `assembly.fragment-ingest` | `ContextInjectGuard(shadow)` per fragment |
| `capability.registration` | `ContentScanGuard(shadow)` against declaration metadata |

> 每条 chain 的 mode 推进按 G3 阶段制：SHADOW → ADVISORY → ACTIVE，由 policy ADR 给出 escalation 条件与触发证据阈值。

### §7. Validator（注册 / 调用时强制）

```typescript
function registerGuardChain(chain: GuardChain): RegisterResult {
  // G2: protected_path 必须在白名单内
  if (!PROTECTED_PATHS_WHITELIST.has(chain.protected_path.kind)) {
    return fail('path_not_in_whitelist')
  }
  // G2: required_guard_kinds 必须被 chain.steps 完全覆盖
  const stepKinds = new Set(chain.steps.map(s => s.guard_kind))
  for (const required of chain.protected_path.required_guard_kinds) {
    if (!stepKinds.has(required)) return fail(`missing_required_guard_${required}`)
  }
  // G3: 每个 step 起步必须 SHADOW；非 SHADOW step 必须 step 级 escalation ADR 显式授权
  // （仅 chain.declared_by_adr 不够 —— 整条 chain 的 ADR 不能为单个 step 的 mode 升级背书）
  for (const step of chain.steps) {
    if (step.mode === GuardEnforcementMode.SHADOW) {
      if (step.non_shadow_allowed_by !== null) {
        return fail('shadow_step_must_have_null_non_shadow_allowed_by')
      }
    } else {
      // ADVISORY / ACTIVE 必须有 step 级 escalation 引用
      if (!step.non_shadow_allowed_by) {
        return fail('non_shadow_step_requires_escalation_adr_per_step')
      }
      // 进一步可校验：non_shadow_allowed_by 指向的 ADR 必须存在 + role = contract|harvest（不是任意笔记）
    }
  }
  // VerdictRouting: on_dangerous 不允许 pass
  for (const step of chain.steps) {
    if ((step.on_verdict.on_dangerous as string) === 'pass') {
      return fail('dangerous_pass_forbidden')
    }
  }
  return ok({ chain_id: chain.chain_id })
}

function executeGuardStep(step: GuardChainStep, input: ScanInput): StepResult {
  let evidence: GuardEvidence
  try {
    evidence = runScanner(step.guard_kind, input)
  } catch (e) {
    if (step.mode === GuardEnforcementMode.SHADOW) {
      // G5: SHADOW 允许 fail-open + 写"扫描失败"evidence
      return { verdict: GuardVerdict.SAFE, evidence: failEvidence(e), passed: true }
    }
    // ADVISORY / ACTIVE: fail-closed
    return { verdict: GuardVerdict.DANGEROUS, evidence: failEvidence(e), passed: false }
  }
  appendEvidence(evidence)        // G7 append-only
  return routeVerdict(step, evidence)
}
```

---

## Non-goals

- **不实施 §1-§7 的代码**——本 ADR 仅定义 contract 草图与 Guard Rules
- **不重新定义 BGHS 分类规则**——见 P1-Doctrine
- **不重述 P1-b skill scan 规则集**——P1-b 已覆盖；本 ADR 仅复用其扫描结果作为 ContentScanGuard 实现来源之一
- **不定义 session 与 session-adjacent 分类**——交给 P1-e；本 ADR 只声明"GuardEvidence 写 session-adjacent"
- **不规定具体 pattern 内容**（不在 ADR 里粘 regex）——pattern catalog 由后续 contract ADR / policy ADR 维护，单独冻结版本
- **不引入外部二进制扫描器（Tirith 等）作为 default chain**（R2）——可作为可选 supplementary scanner，不替代内置 guard
- **不引入 Approval UX flow**——approval 走 Loamwise approval-state-machine + P1-b PromotionDecision
- **不引入 ML / 模型驱动的内容判定**——Layer 0 不接受 ML 黑盒作为 Governance verdict 来源；如要引入需 Doctrine 修订
- **不修改 Hermes 上游代码**——上游 fork 仅作只读参考

---

## Adoption Checkpoints

| Checkpoint | 触发时机 | 验证项 |
|-----------|---------|-------|
| **C1. 本 ADR + P1-Doctrine + P1-a/b/c 一致就位** | 本 ADR 通过后 | 五份 ADR 互引一致；SYSTEMS.md 引用本 ADR 为 GuardChain SSOT |
| **C2. GuardKind 枚举固定到 contract schema** | 第一个 contract ADR 引用 Guard 时 | `_meta/contracts/guard/guard-kind.schema.yaml` 建立；新增 kind 必须经 Layer 0 ADR |
| **C3. Shadow mode 起点强制** | Loamwise `govern/guards/` 实施时 | 任何 Guard 默认 `mode: SHADOW`；非 SHADOW 起步必须引用 escalation ADR |
| **C4. G2 白名单完整覆盖** | P1-b/c 任何 contract 字段引用 Guard 时 | 所有 guard_chain_required / 必经 guard 的字段都对应 G2 白名单条目；validator 强制 |
| **C5. Evidence append-only + 脱敏** | P1-e 落地后 | GuardEvidence 写入 session-adjacent；hits 通过自动脱敏 utility |
| **C6. Fail-closed 默认强制** | ADVISORY / ACTIVE 第一次启用时 | runtime 异常 / 超时 = block；全局 fail-open 开关不存在 |
| **C7. 现有 ADR-007 supersede** | 本 ADR 通过后立即 | `ADR-007-Loamwise-Guard-Content-Security.md` 标注 `Superseded by: ADR-Loamwise-Guard-Content-Security.md`。**主题级 supersede，不要求物理删除** |

**本 ADR 不实施任何代码**。Adoption checkpoints 是后续阶段的入库门，不在本轮执行。

---

## Appendix A: 与 P1-b / P1-c 的命名对齐（明示）

本 ADR 严格使用 P1-b / P1-c 已点名的 Guard 命名，**不发明平行命名**：

| 来源 | 引用的 Guard | 在本 ADR 的对应 |
|------|-------------|----------------|
| P1-b §8 acceptCandidate | "scan_evidence" / 扫描结果 | `ContentScanGuard` 输出的 GuardEvidence |
| P1-b §4 PromotionDecision | "scan_evidence: ScanResultRef[]" | 同上；promotion 时若涉及 authoritative capability，加 `TruthWriteGuard` |
| P1-c §4 MemoryWriteSpec | "guard_chain_required: ('content-scan' \| 'truth-write')[]" | `ContentScanGuard` / `TruthWriteGuard`（命名对齐） |
| P1-c §4 MemoryAssemblyPlan | snapshot 装配前扫描 | `ContextInjectGuard` per fragment |
| P1-c §6 MemoryProvider | `on_memory_write` hook | guard 在 hook 之前执行（write 必经 guard） |

**冲突解决**：
- 命名以本 ADR 为准（GuardKind 枚举值）
- 协议字段（如 P1-c 的 `guard_chain_required`）必须使用本 ADR 的字符串值（`'content-scan'` / `'truth-write'` / `'context-inject'`）

---

## Appendix B: 与 ADR-007（旧版）的关系

旧 `ADR-007-Loamwise-Guard-Content-Security.md` 写于 2026-04-14（P1-Doctrine 之前），结构正确（已含 3 guard 接口 + shadow mode 字段），但缺少：
1. Meta Declaration 头部
2. BGHS 分类映射
3. Shadow → Advisory → Active 三阶段 escalation rule（旧版只有 shadow / active 二分）
4. G2 白名单（哪些路径必经哪些 guard）作为 schema 强制
5. 与 P1-b / P1-c / P1-a 的命名 / 字段对齐声明
6. Validator 伪代码
7. Pattern catalog 与 scanner 实现的 Governance vs Hands 分离

**ADR-007 处置**：保留为历史记录（同 ADR-004/005/006），主题以本 ADR 为准。

---

**Version**: 1.0.0
**Last Updated**: 2026-04-16
