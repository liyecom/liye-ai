---
artifact_scope: meta
artifact_name: Hermes-Skill-Lifecycle
artifact_role: harvest
target_layer: cross
is_bghs_doctrine: no
---

# ADR — Hermes Skill Lifecycle（P1-b）

**Status**: Accepted
**Date**: 2026-04-16
**Accepted-Date**: 2026-04-17
**Decision Makers**: LiYe
**SSOT**: `_meta/adr/ADR-Hermes-Skill-Lifecycle.md`
**References**:
- `_meta/adr/ADR-Architecture-Doctrine-BGHS-Separation.md`（必读前置）
- `_meta/adr/ADR-OpenClaw-Capability-Boundary.md`（capability 边界，本 ADR 把 skill lifecycle 嫁接其上）
**Source**: `/Users/liye/github/hermes-agent/`（fork 自 `NousResearch/hermes-agent`，只读参考）

---

## Context

Skill 是 LiYe Systems 中"可被调度的能力单元"——它可能由开发者编写，也可能由 agent 在运行时生成（learning loop 的产物），还可能从外部 hub / marketplace 引入。这三个来源的"信任水位"不同，**但都不应该一进入系统就直接可执行**。

Hermes Agent 提供了一套相对完整的 skill 生命周期实现，特别是：
- **trust 分层**（builtin / trusted / community / agent-created）
- **scan + verdict 分级**（safe / caution / dangerous）
- **quarantine 隔离**（外部 skill 进入前的检疫区）
- **progressive disclosure**（按需加载）

但 Hermes 的"agent-created skill 扫描通过即激活"这条捷径**不能照搬**——LiYe Systems 必须 quarantine-first：**scan pass ≠ trust，是准入的必要条件，不是充分条件**。

本 ADR 萃取 Hermes 的 lifecycle discipline，落成 LiYe Systems 的 skill 生命周期治理契约。**本 ADR 不写 Hermes 功能介绍，只写状态转换、准入纪律、quarantine 边界**。Skill 生命周期的运行时属于 Loamwise（Layer 1，`/Users/liye/github/loamwise/construct/`），Layer 0 只定义契约。

---

## 上游核心做法（Hermes 的 lifecycle 实现）

### H1. 四级 trust 分层

Hermes 把所有 skill 按来源分四级（`/Users/liye/github/hermes-agent/tools/skills_guard.py`）：

| Trust Level | 来源 | 默认行为 |
|------------|------|---------|
| `builtin` | 仓库内自带 | 直接信任，skip 扫描 |
| `trusted` | 用户显式信任的源 | 安装时扫描，运行时跳过 |
| `community` | 公共 hub 拉取 | 强制扫描 + caution 默认隔离 |
| `agent-created` | agent 在运行时创建 | 创建后立即扫描 + 通过即激活 |

### H2. 扫描器三级 verdict

`skills_guard.py` 内置 ~80 条 regex 威胁模式，覆盖 7 类：
- shell command injection、网络外联、密钥读取、文件系统越界、prompt injection、auth/token bypass、import-time side effect

输出三级 verdict：
- `safe`：通过
- `caution`：可疑，需人工 review
- `dangerous`：拒绝

### H3. 外部 skill quarantine 流程

`/Users/liye/github/hermes-agent/tools/skills_hub.py` 实现：

```
download → quarantine 目录 → scan → 通过则 install → 写入 lock.json + audit.log
```

quarantine 目录与正式 skill 目录物理隔离，未通过的 skill 不会出现在 active path。Provenance（来源 / 哈希 / 时间戳）写入 `lock.json`，操作链写入 `audit.log`。

### H4. Agent-created skill 的"scan pass 即激活"捷径（**不吸收，见 R1**）

`/Users/liye/github/hermes-agent/tools/skill_manager_tool.py` 允许 agent 在运行时调用 `create_skill()`，写入文件后立即触发 `skills_guard` 扫描，**通过即激活**——无需人工 review。

这是 Hermes 在"agent-as-product"场景下的合理取舍，但 **LiYe Systems 拒绝这条路径**——它把"scan pass"误等于"trust"，绕过了 quarantine 纪律。

### H5. Progressive disclosure（按需加载）

`/Users/liye/github/hermes-agent/tools/skills_tool.py` 把 skill 元数据分三层（list / detail / body），按 agent 需要逐层暴露，避免一次性加载全部 skill 内容污染上下文。

### H6. Frontmatter metadata + 原子写

每个 skill 文件头部用 YAML frontmatter 声明 `name / description / platform / version / requires` 等字段。`skill_manager_tool.py` 写入采用"临时文件 → fsync → atomic rename"原子模式。

---

## 吸收什么

| 编号 | 吸收项 | 理由 |
|------|-------|------|
| **A1** | **Trust 分层 + verdict 分级**（但口径更严，见 R3） | Layer 0 必须有可声明的 trust matrix；plugin / engine 不得自行声明 trust |
| **A2** | **Quarantine 物理隔离**（quarantine 目录与 active 目录分离） | Governance：未通过准入的 candidate 不得出现在执行路径上 |
| **A3** | **Provenance 追踪**（来源 / 哈希 / 创建者 / 时间戳 / source_trace_id） | Session：所有 skill candidate 的来源必须可追溯到原始事件 |
| **A4** | **Frontmatter metadata** + **原子写入** | Hands 执行边界的最小契约 |
| **A5** | **Progressive disclosure 三层（list / detail / body）** | Brain harness 的合理优化，不影响 Governance |
| **A6** | **审计日志 append-only**（audit.log 模式） | Session：lifecycle 转换必须留痕，且不可改写 |

---

## 不吸收什么

| 编号 | 不吸收项 | 理由 |
|------|---------|------|
| **R1** | **Agent-created skill scan-pass 即激活** | LiYe Systems 强制 quarantine-first：**scan pass ≠ trust**，扫描通过只是准入的**必要条件**，不是充分条件 |
| **R2** | **`builtin` 跳过扫描** | 即使 builtin 也要走 lifecycle（首次入库时扫描 + 标注），只是后续运行时可不重复扫描 |
| **R3** | **trust 分层口径**（4 级 + community 自动 caution） | LiYe 重新定义 trust 来源（见 §Lifecycle Rules L3）；不把 community 默认归为可执行 |
| **R4** | **Auto-repair / auto-rewrite skill** | 任何对 active skill 的修改 = 新 candidate，必须重走 lifecycle |
| **R5** | **强行覆盖（force install / force activate）** | Controlled transitions only：旁路状态机 = 拒绝（见 L1） |
| **R6** | **scan 通过 = 默认安全** | scan 是 deterministic pattern match，对未知威胁不构成保证；scan 失败 = 必拒，scan 通过 = 仅清除已知模式 |
| **R7** | **Skill 由 agent 直接调度执行**（无 promotion 决策） | 所有 active skill 的调度必须经 Loamwise dispatch，agent 不直接调用 candidate |
| **R8** | **"smart routing" / "auto skill repair" / Honcho 用户建模** | 与 SYSTEMS.md 已声明的"明确不做清单"一致 |

---

## 与 LiYe Systems 分层与 BGHS 的映射

> 不再定义 BGHS 规则——见 P1-Doctrine §1。本节给出 Hermes skill 系统组件在 LiYe 视角下的归类。

| Hermes 组件 | LiYe 视角 primary concern | 在 LiYe Systems 的对应位置 |
|------------|--------------------------|--------------------------|
| skill 文件本身（frontmatter + body） | **Hands** | Loamwise（Layer 1）/ Engine（Layer 2）的 skill 实现 |
| skill_manager_tool（创建 / 编辑） | **Brain** | Loamwise `construct/` 的 candidate generation harness |
| skills_guard（扫描器） | **Governance** (secondary: Hands) | Layer 0 capability — 由 P1-d Loamwise Guard 落地 |
| skills_hub（quarantine + install 流程） | **Governance** | Loamwise `construct/quarantine/`（执行）+ Layer 0 lifecycle contract（本 ADR） |
| skills_tool（progressive disclosure） | **Brain** | Loamwise harness 优化（不影响 Governance） |
| audit.log + lock.json | **Session** | session-adjacent（receipts，参见 P1-Doctrine §5.5 + P1-e） |
| trust matrix | **Governance** | Layer 0 — 本 ADR Contract Sketch §3 定义；Loamwise 消费 |

**Layer 归属**（与 SYSTEMS.md 既有声明一致）：
- **Layer 0（liye_os）**：定义 `SkillLifecycleState` 枚举、`SkillCandidateRecord` schema、`PromotionDecision` 契约、trust matrix 结构
- **Layer 1（loamwise）**：实现 candidate 接收、quarantine 目录管理、扫描调度、promotion 执行、lifecycle log 写入

**容易错判的点**：

| 容易错判 | 正确判法 |
|---------|---------|
| 把 "scan pass" 判为 ACTIVE 状态 | scan pass 只是准入必要条件；ACTIVE 需 PromotionDecision（Governance）+ scan pass + quarantine 期满 |
| 把 "agent-created skill" 判为 Brain 范畴（"agent 创造的当然归 harness 管"） | 创造过程是 Brain；但 candidate 一旦写入文件系统 = Hands artifact；准入决策 = Governance |
| 把 "quarantine 目录" 判为 Session（"反正都是临时存放"） | quarantine 是 isolation 边界（Governance），不是事件日志 |

---

## Lifecycle Rules（裁判手册）

### L1. Controlled transitions + append-only history（无旁路）

- 状态转换必须沿 §1 的 ALLOWED_TRANSITIONS 白名单进行（**controlled transition graph**，非随意可达）
- 转换历史 **append-only**：不允许 update / delete 已写入的 LifecycleTransition
- **任何转换都必须有显式 driver**（PromotionDecision 或 QuarantineDecision），无 driver 的转换 = 拒绝写入
- 不允许"直接写入 active 目录" / "原地改写状态字段" 等旁路操作
- "撤销"通过追加新 transition 实现（如 ACTIVE → QUARANTINED → 新 PromotionDecision → CANDIDATE），不改写历史

### L2. Quarantine-first（不可绕过的硬约束）

- 任何 candidate（无论来源是开发者 / agent / 外部 hub），在进入 ACTIVE 之前**必须经过 CANDIDATE 状态**
- CANDIDATE 期间：物理路径属于 quarantine root（isolation），不出现在 dispatcher 可见的 active path
- **scan pass ≠ promotion**——scan 是准入的必要条件，不是充分条件
- 至少需要一个**显式 PromotionDecision**（有签名 / approver_id）才能转 ACTIVE

### L3. Trust 来源是声明，不是推断

- Trust 不是"扫描通过就给"——Trust 是 Layer 0 trust matrix 中明示的来源属性
- LiYe Systems 的 trust 来源（与 Hermes 4 级不同，重新口径）：

| Trust Source | 含义 | 默认 promotion 路径 |
|-------------|------|-------------------|
| `internal-vetted` | LiYe 仓库内已 review 过的 skill | 仍走 lifecycle，但 PromotionDecision 可由维护者审批 |
| `engine-published` | Domain Engine 通过 engine_manifest 发布 | 仍走 lifecycle，PromotionDecision 由 Engine + Loamwise 双签 |
| `agent-generated` | learning loop 产出 | **永远** 进 quarantine，需人工或 policy-defined approver |
| `external` | 来自 hub / marketplace / 用户上传 | **永远** 进 quarantine，需人工 + scan + grace-period |

**没有 `community-default-caution` 这种自动信任**（R3）。

### L4. Scan 是 fail-closed，不是 trust generator

- scan dangerous → **必拒**（不可 override）
- scan caution → **必入 QUARANTINED**，不进 CANDIDATE 主队列
- scan safe → **进 CANDIDATE**，等待 PromotionDecision（不自动 ACTIVE）

### L5. Active skill 不可原地修改

- 对 ACTIVE skill 的任何修改 = 新版本的 CANDIDATE
- 旧版本进入 DEPRECATED 后保留可读，但 dispatcher 拒绝调度
- 禁止 `force-edit` / `hot-patch` 类操作（R4 + R5）

### L6. Provenance 与 lifecycle 日志强制

- 每个 SkillCandidateRecord 必须有：`source_trace_id`、`source_kind`、`generated_by`、`created_at`、`content_hash`
- 每次 LifecycleTransition 必须 append-only 写入 lifecycle log（属 session-adjacent，由 P1-e 定义存储位置）
- 缺少 provenance = 拒绝接收（fail-closed）

### L7. Lifecycle 治理 contract 由 Layer 0 定义，运行时由 Loamwise 实现

- 状态机定义、字段 schema、transition 准入规则 → **Layer 0**（本 ADR 与未来 contract ADR）
- candidate 接收、quarantine 目录管理、scan 调度、promotion 执行、lifecycle log 写入 → **Layer 1（Loamwise）**
- Engine（Layer 2）只能**提交 candidate** 与**消费 active skill**，不参与 promotion 决策

---

## Contract Sketch

### §1. SkillLifecycleState（状态枚举）

```typescript
enum SkillLifecycleState {
  // DRAFT 是可选前置工作态：在首次 candidate 提交之前，skill 草稿可在 git
  // 工作目录或 IDE 中存在，未必进入 lifecycle 注册存储。一旦 submit，必须
  // 直接进 CANDIDATE。实现方可以选择不持久化 DRAFT 状态。
  DRAFT        = 'draft',
  CANDIDATE    = 'candidate',     // 已通过最小接收检查，允许等待 promotion 的候选态
  QUARANTINED  = 'quarantined',   // 被显式阻断、不得进入 promotion 队列的隔离态
  ACTIVE       = 'active',        // 已 promote，dispatcher 可调度
  DEPRECATED   = 'deprecated',    // 计划下线，dispatcher 拒绝新调度，保留可读
  REVOKED      = 'revoked',       // 硬删除（仅元数据残留）
}

// 允许的转换（白名单）
const ALLOWED_TRANSITIONS: Record<SkillLifecycleState, SkillLifecycleState[]> = {
  draft:        ['candidate'],
  candidate:    ['active', 'quarantined', 'revoked'],
  quarantined:  ['candidate', 'revoked'],          // 修复后可重提
  active:       ['deprecated', 'quarantined'],     // 紧急隔离也合法
  deprecated:   ['revoked'],
  revoked:      [],                                // 终态
}
```

**CANDIDATE vs QUARANTINED 的行为语义（必须区分）**：

| 维度 | CANDIDATE | QUARANTINED |
|------|-----------|-------------|
| 在 promotion 队列中？ | **是** — 可被 PromotionDecision 调度 promote | **否** — 不进 promotion 队列 |
| 接收新决策？ | 接受 PromotionDecision（→ ACTIVE）或 QuarantineDecision（→ QUARANTINED） | 仅接受 PromotionDecision（→ CANDIDATE，视为重新准入）或 QuarantineDecision（→ REVOKED） |
| `release_blocked_until` 是否生效？ | 不适用 | 生效；到期前任何 → CANDIDATE 的尝试拒绝 |
| 谁可写入这里？ | Loamwise 接收 channel | 仅 Loamwise quarantine controller（接收人工或 policy 触发） |

**物理隔离要求**（行为语义层，目录命名归 Loamwise 实现，不在本 ADR 写死）：

- 二者**可共享同一个 quarantine root**（与 active 目录物理分离）
- 但必须位于**不同子域 / 不同行为队列**，例如：
  - CANDIDATE 子域 → 进 promotion scheduler 的 watch list
  - QUARANTINED 子域 → 不进任何 scheduler，仅供 review / inspection

dispatcher 与 promotion scheduler **均不可访问 QUARANTINED 子域**。

### §2. SkillCandidateRecord（candidate 元数据，Loamwise 接收时写入）

```typescript
interface SkillCandidateRecord {
  // 标识
  candidate_id: string                    // UUIDv7 推荐
  skill_id: string                        // 形如 "amazon-growth-engine:bid_recommend"
  version: string                         // SemVer
  content_hash: string                    // sha256(skill body + frontmatter)

  // 来源（L6 强制）
  source_trace_id: string                 // 指向产生此 candidate 的 session event
  source_kind: TrustSource                // 见 §3
  generated_by: {
    component: string                     // e.g., "loamwise:construct.learning-loop"
    layer: 1 | 2                          // Layer 0 不产 candidate
  }
  created_at: string                      // ISO 8601
  expires_at: string | null               // CANDIDATE 状态的 grace period 截止

  // 风险与扫描
  risk_class: 'low' | 'medium' | 'high' | 'unknown'   // 由 scan + heuristic 标注
  scan_results: ScanResultRef[]           // 指向扫描记录（多次扫描可累积）

  // 当前状态
  state: SkillLifecycleState
  state_changed_at: string

  // Capability 绑定（与 P1-a 的 CapabilityRegistration 关联）
  capability_kind: string                 // 必须是 P1-a CapabilityKindRegistry 已注册的 kind
  capability_registration_id: string | null  // ACTIVE 后填入
}

interface ScanResultRef {
  scanner_id: string                      // e.g., "loamwise:guard.content-scan.v1"
  scanned_at: string
  verdict: 'safe' | 'caution' | 'dangerous'
  evidence_path: string                   // 指向扫描详情（脱敏后的 hits）
}
```

### §3. TrustSource（trust matrix，L3 落地）

```typescript
enum TrustSource {
  INTERNAL_VETTED   = 'internal-vetted',   // 仓库内已 review
  ENGINE_PUBLISHED  = 'engine-published',  // Domain Engine 发布
  AGENT_GENERATED   = 'agent-generated',   // learning loop 产出
  EXTERNAL          = 'external',          // hub / marketplace / 上传
}

interface PromotionPolicy {
  source: TrustSource
  required_approvers: ApproverRule[]       // 至少满足其一
  required_grace_period_seconds: number    // CANDIDATE 最短停留时间
  allowed_target_states: SkillLifecycleState[]  // 通常 ['active']，紧急情况可有限制
}

interface ApproverRule {
  approver_kind: 'human-maintainer' | 'engine-cosign' | 'policy-rule'
  policy_path?: string                     // 若 kind = policy-rule，指向 policy ADR
}
```

**Illustrative baseline PromotionPolicy（NON-NORMATIVE，仅作语义示意）**：

下表展示了 4 种 TrustSource 应有的相对严格程度差异（external > agent > engine > internal），**具体数值与规则不构成规范**。生效值由后续 policy ADR 给出。

| Source | required_approvers (示意) | grace_period (示意) | 允许目标 |
|--------|-------------------|--------------|---------|
| `internal-vetted` | 1× human-maintainer | `policy-defined`（baseline: 0） | active |
| `engine-published` | 1× human-maintainer + 1× engine-cosign | `policy-defined`（baseline: ~minutes） | active |
| `agent-generated` | 1× human-maintainer | `policy-defined`（baseline: ≥ minutes） | active |
| `external` | 1× human-maintainer + scan-result.verdict=safe | `policy-defined`（baseline: ≥ longer） | active |

> 本表只展示**严格度的相对关系**，不约束具体秒数。grace_period / approver 数量等具体生效规则由后续 policy ADR 给出（与 P1-Doctrine D5 一致：具体不变量改 contract/policy ADR，不修 Doctrine）。

### §4. PromotionDecision（promote 类转换的授权工件）

```typescript
interface PromotionDecision {
  decision_id: string
  candidate_id: string
  from_state: SkillLifecycleState
  to_state: SkillLifecycleState
  decided_at: string

  // 决策证据（缺一不入库 = fail-closed）
  approvers: ApproverEvidence[]            // 满足 PromotionPolicy.required_approvers
  scan_evidence: ScanResultRef[]
  policy_evaluations: PolicyEvalResult[]   // 引用了哪些 policy ADR

  // 可逆性
  rollback_policy: RollbackPolicy

  // 决策者签名（防止匿名 promotion）
  decided_by: {
    actor_id: string                       // human user id 或 service id
    actor_kind: 'human' | 'service' | 'policy-engine'
    signature: string                      // 至少 HMAC，更高级别可数字签名
  }
}

interface ApproverEvidence {
  approver_kind: 'human-maintainer' | 'engine-cosign' | 'policy-rule'
  approver_id: string
  approved_at: string
  evidence_ref: string                     // 指向批准证据（PR / message / policy result）
}

interface RollbackPolicy {
  on_drift_detected: 'auto-quarantine' | 'alert-only'
  on_kill_switch: 'auto-revoke' | 'auto-quarantine'
}
```

### §5. QuarantineReason + QuarantineDecision（隔离/撤销的授权工件）

```typescript
enum QuarantineReason {
  SCAN_DANGEROUS         = 'scan.dangerous',
  SCAN_CAUTION           = 'scan.caution',
  PROMOTION_REJECTED     = 'promotion.rejected',
  DRIFT_DETECTED         = 'drift.detected',         // active 期间发现行为漂移
  POLICY_VIOLATION       = 'policy.violation',       // 触发 policy ADR 中的红线
  KILL_SWITCH            = 'kill-switch',            // 紧急全局隔离
  EXTERNAL_REPORT        = 'external.report',        // 用户 / 上游报告问题
  GRACE_PERIOD_EXPIRED   = 'grace-period.expired',   // 长期未 promote 自动隔离
}

// QuarantineDecision 是状态转换的授权工件（与 PromotionDecision 同等地位），
// 不是事后日志记录。任何 → QUARANTINED 或 → REVOKED 的转换都必须有 QuarantineDecision。
interface QuarantineDecision {
  decision_id: string
  candidate_id: string
  from_state: SkillLifecycleState
  to_state: SkillLifecycleState              // 通常 'quarantined' 或 'revoked'
  reason: QuarantineReason
  reason_detail: string                      // 具体描述
  reason_evidence: string[]                  // 证据指针
  decided_at: string
  release_blocked_until: string | null       // 何时之前不允许重新提交（NULL = 永久封禁，需新 decision 解锁）

  // 决策者签名（与 PromotionDecision 对称，防止匿名隔离）
  decided_by: {
    actor_id: string
    actor_kind: 'human' | 'service' | 'policy-engine' | 'kill-switch'
    signature: string
  }
}
```

### §6. LifecycleTransition（append-only 日志条目）

```typescript
interface LifecycleTransition {
  transition_id: string
  candidate_id: string
  from_state: SkillLifecycleState
  to_state: SkillLifecycleState
  transitioned_at: string
  // 所有状态转换都必须有显式决策工件（无匿名 / 无隐式转换）
  // - promote 类（→ ACTIVE / → DEPRECATED）：PromotionDecision
  // - quarantine / revoke 类（→ QUARANTINED / → REVOKED）：QuarantineDecision
  // - candidate 重提（QUARANTINED → CANDIDATE）：PromotionDecision（视为重新准入）
  driver: PromotionDecision | QuarantineDecision
  prev_transition_id: string | null               // 形成 hash chain（参见 P1-e）
}
```

**写入规则**：
- append-only（不允许 update / delete）
- 每个 candidate 形成 append-only hash chain（每条 transition 包含 `sha256(prev_transition_id || transition_payload)`）
- 物理位置由 P1-e Session-adjacent taxonomy 定义（lifecycle log 属 session-adjacent，不是 session 本体）

**驱动工件统一原则**：
- 任何 LifecycleTransition 必须由 `PromotionDecision` 或 `QuarantineDecision` 之一驱动
- **无 driver 的 transition = 拒绝写入**（fail-closed，防止旁路）
- 两类决策工件地位对称：都需 approver / evidence / signature；都不允许"事后补登记"

### §7. 状态机图

```
              [submit]
   DRAFT  ────────────────►  CANDIDATE
                                  │
                ┌─────────────────┼─────────────────┐
                │                 │                 │
        [PromotionDecision]    [scan caution    [scan dangerous
         valid + grace pass]    or rejected]      or policy violation]
                │                 │                 │
                ▼                 ▼                 ▼
              ACTIVE         QUARANTINED         QUARANTINED
                │                 │                 │
        [drift / kill]            │           [release_blocked_until 到期 + 修复]
                │                 │                 │
                ▼                 ▼                 ▼
            QUARANTINED     CANDIDATE          CANDIDATE
                │              (重新走流程)
        [planned EOL]
                │
                ▼
          DEPRECATED
                │
        [cleanup]
                │
                ▼
            REVOKED
```

### §8. 准入纪律（注册时的 fail-closed 检查）

```typescript
function acceptCandidate(rec: SkillCandidateRecord): AcceptResult {
  // L6: provenance 强制
  if (!rec.source_trace_id || !rec.generated_by || !rec.content_hash) {
    return fail('missing_provenance')
  }
  // L2: 必须从 CANDIDATE 起步（不允许直接 ACTIVE）
  if (rec.state !== 'candidate') {
    return fail('initial_state_must_be_candidate')
  }
  // L7 + P1-a B1: capability_kind 必须由 Layer 0 已注册
  if (!capabilityKindRegistry.has(rec.capability_kind)) {
    return fail('unknown_capability_kind')
  }
  // L7: layer 限制（Layer 0 不产 candidate）
  if (rec.generated_by.layer === 0) {
    return fail('layer_0_cannot_produce_candidate')
  }
  // L4: 等待 scan 结果
  return ok({ candidate_id: rec.candidate_id })
}

function promoteCandidate(decision: PromotionDecision): PromoteResult {
  const policy = lookupPromotionPolicy(decision.candidate.source_kind)
  // L1: transition 必须在白名单
  if (!ALLOWED_TRANSITIONS[decision.from_state].includes(decision.to_state)) {
    return fail('illegal_transition')
  }
  // L3: approver 必须满足 policy
  if (!satisfies(decision.approvers, policy.required_approvers)) {
    return fail('insufficient_approvers')
  }
  // L2: grace period
  if (now() < decision.candidate.created_at + policy.required_grace_period_seconds) {
    return fail('grace_period_not_elapsed')
  }
  // L4: scan 证据必须 safe
  if (!hasSafeVerdict(decision.scan_evidence)) {
    return fail('scan_not_safe')
  }
  // L6: 写 LifecycleTransition + 关联 P1-a CapabilityRegistration
  return ok({ transition_id: ... })
}
```

---

## Non-goals

- **不实施 §1-§8 的代码**——本 ADR 仅定义状态机与 contract 草图，运行时实现归 Loamwise
- **不重新定义 BGHS 分类规则**——见 P1-Doctrine
- **不规定 scan 引擎的具体实现**——交给 P1-d Loamwise Guard Content Security
- **不规定 lifecycle log 的物理存储格式**——交给 P1-e Session-adjacent taxonomy
- **不规定 PromotionDecision 的 UI / 工具流**——人审界面归 Loamwise / Operator console
- **不实现 Hermes skill 体系的 1:1 移植**——只吸收 lifecycle discipline，不吸收 repo 组织 / progressive disclosure 实现 / agent-created auto-activate 路径
- **不修改 Hermes 上游代码**——上游 fork 仅作只读参考

---

## Adoption Checkpoints

| Checkpoint | 触发时机 | 验证项 |
|-----------|---------|-------|
| **C1. 本 ADR + P1-Doctrine + P1-a 三件就位** | 本 ADR 通过后 | 三份 ADR 互引一致；SYSTEMS.md 引用本 ADR 为 skill lifecycle SSOT |
| **C2. SkillLifecycleState 状态机落入 contract schema** | 第一个 contract ADR 引用 lifecycle 时 | `_meta/contracts/skill/lifecycle-state.schema.yaml` 建立；ALLOWED_TRANSITIONS 由 schema 强制 |
| **C3. Quarantine 目录隔离生效** | Loamwise `construct/` 实施时 | quarantine 目录与 active 目录物理分离；dispatcher 仅扫描 active |
| **C4. PromotionPolicy 默认集落地** | 任何 candidate 准备 promote 时 | 4 种 TrustSource 各有默认 PromotionPolicy；缺失 = 拒绝 promote |
| **C5. Lifecycle log hash chain 强制** | P1-e Session taxonomy 落地时 | 每条 LifecycleTransition append-only + hash chain；篡改可被 replay 检出 |
| **C6. 现有 ADR-005 supersede** | 本 ADR 通过后立即 | `ADR-005-Hermes-Skill-Lifecycle.md` 标注 `Superseded by: ADR-Hermes-Skill-Lifecycle.md`。**主题级 supersede，不要求物理删除旧文件** |

**本 ADR 不实施任何代码**。Adoption checkpoints 是后续阶段的入库门，不在本轮执行。

---

## Appendix A: 与 ADR-005（旧版）的关系

旧 `ADR-005-Hermes-Skill-Lifecycle.md` 写于 2026-04-14（P1-Doctrine 之前），结构正确但缺少：
1. Meta Declaration 头部
2. BGHS 分类映射
3. 显式状态机（旧版用文字描述）
4. PromotionDecision / QuarantineDecision / LifecycleTransition 的 schema
5. 与 P1-a CapabilityKind 的对接

**ADR-005 处置**：保留为历史记录（同 ADR-004），主题以本 ADR 为准。

---

**Version**: 1.0.0
**Last Updated**: 2026-04-16
