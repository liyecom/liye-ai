---
artifact_scope: meta
artifact_name: AGE-Wake-Resume
artifact_role: contract
target_layer: 2
is_bghs_doctrine: no
supersedes: null
superseded_by: null
---

# ADR — AGE Wake/Resume 唤醒恢复契约（P1-g，Layer 2）

**Status**: Accepted
**Date**: 2026-04-17
**Accepted-Date**: 2026-04-17
**Decision Makers**: LiYe

## Meta Declaration

| 字段 | 值 |
|---|---|
| artifact_role | contract |
| target_layer | 2（AGE；同时给出 Layer 2 域引擎 wake/resume 的 reference pattern） |
| is_bghs_doctrine | no |
| 依赖 ADR | P1-Doctrine（`wake_resume_entrypoint` 字段）、P1-e（SessionEventStream / F1 / strict_truth）、P1-f（credential_bindings） |
| 被依赖 | 后续任何 Layer 2 域引擎的 wake/resume 实现（复用本 ADR 的 ResourceContext 最小接口与 Preflight/Replay 契约） |
| 写作重点 | **如何可靠恢复**（preflight、纯函数 replay、write-order、append-only、governance 保留、结果契约闭环）——不是如何优雅描述恢复 |

---

## 1. Context

AGE 已落地完整的 wake/resume 机制，活实例跑了 3 个月、覆盖 3 个 store（STR-358D075EFC / STR-8105E71CE4 / STR-E438213024）：

- **Event stream（权威）**: `artifacts/onboarding/{store_id}/state_transitions.jsonl`
  - append-only，NDJSON，每行一个 `StateTransitionEvent`
  - schema: `config/stores/_schema/state_event.schema.json`
- **Derived snapshot（派生快照）**: `config/stores/stores/{store_id}/state.yaml`
  - 文件开头 `_warning: "DERIVED..."`；**禁止手改**
- **Replay**:
  - CLI: `scripts/onboarding/replay_state.py`（默认 `--diff` 只读；`--apply` 原子写；`--from-scratch` 忽略 state.yaml 的 governance 字段）
  - Core: `scripts/onboarding/_lib/persistence.py:replay_state_from_jsonl`

**本 ADR 不发明新机制**，只把 AGE 现存机制硬化为 Layer 2 契约，并把它接入 P1-Doctrine 的 `wake_resume_entrypoint` 字段；同时补齐「恢复结果契约」（输入/输出/preflight 三端闭环）。

---

## 2. 吸收什么 / 不吸收什么

### 2.1 吸收（提升为 Layer 2 契约）

| # | 项 | 依据 |
|---|---|---|
| A1 | **jsonl 权威 / yaml 派生** 单向关系 | persistence.py 顶部注释 + state.yaml `_warning` 标记 |
| A2 | **写序**：先 append jsonl 并 fsync → 后原子重写 state.yaml（tmp + rename 同目录） | `_append_transition_event` + `_atomic_write_state_yaml` |
| A3 | **Replay 恒等律**：同一 jsonl + 同一 merge_base → 同一 state dict（纯函数） | `replay_state_from_jsonl` 无 IO 副作用，无网络，无时钟依赖 |
| A4 | **结构严格校验 + 失败闭合**：每个事件过 `_validate_event_structure` | persistence.py `_validate_event_structure` |
| A5 | **ReplayError vs PersistenceError 分离**：数据错误 vs IO 错误不混 | persistence.py 错误类型声明 |
| A6 | **Governance 字段非派生**：`ops_mode / discovery_done / smoke_passed / record_provenance / confidence` 从 merge_base 保留或 defaults fallback | `_MERGE_GOVERNANCE_FIELDS` |
| A7 | **稳定排序**：`(at asc, event_id asc)` 作为 replay 折叠顺序 | `events.sort(key=lambda e: (e["at"], e["event_id"]))` |
| A8 | **Hop validation 与 collapsed 的关系**：非 collapsed 事件必须通过 `validate_provider_transition` | `replay_state_from_jsonl` 折叠分支 |

### 2.2 不吸收

| # | 项 | 原因 |
|---|---|---|
| N1 | ProviderStatus / StoreStatus / OpsMode 枚举 | AGE 业务语义，不提升为 Layer 0 契约 |
| N2 | `validate_provider_transition` 具体转移图 | 业务决策图，不构成 doctrine |
| N3 | state.yaml 的 YAML 布局、字段顺序 | AGE 实现细节，其他域引擎可选任何格式 |
| N4 | `collapsed: true` + `[RECONSTRUCTED]` 补救机制 | 局部历史回填手段，非通用恢复契约 |
| N5 | 自动修复 / optimistic resume / auto-heal | SNAPSHOT_DIVERGED 必须人工 `--apply`，见 §4.R3 |
| N6 | AGE FailureCategory 枚举（`SESSION_ENV_ERROR` 等） | 是 AGE onboarding 的业务诊断，不与 ResumeFailureMode 混 |

---

## 3. BGHS 映射

| Concern | 是否涉及 | 依据 |
|---|---|---|
| **B**rain | ✗ | resume 不做推理，只 replay + validate |
| **G**overnance | ✓ | jsonl append-only + schema 校验 + replay 恒等 + write-order 是 governance 不变量 |
| **H**ands | ✓ | `replay_state_from_jsonl` 与 `_atomic_write_state_yaml` 是 hand（执行动作） |
| **S**ession | ✓ | `state_transitions.jsonl` **志在成为** SESSION_EVENT_STREAM（见 §7 + P1-e C4） |

**primary_concern**: **Session**（这是 AGE 的权威状态事件流）；**secondary**: Governance。

---

## 4. Resume Rules（契约硬核：如何可靠恢复）

**本节是契约不可分割部分**。任何 Layer 2 wake/resume 实现必须通过本节 5 条。违反 = 拒绝注册。

### R1. Preflight Must Succeed Before Resume

resume 必须在任何实际动作（包括写派生快照、触发后续流程）之前完成 8 项 preflight；任一失败 → `outcome = 'aborted'` 并填具体失败码：

| 检查 | 失败码 | 是否允许 `from-scratch` 豁免 |
|---|---|---|
| jsonl 文件存在 | `MISSING_STREAM` | ✗ |
| jsonl 非空 | `EMPTY_STREAM` | ✗ |
| 所有事件通过结构校验（`_validate_event_structure` 等价） | `STRUCTURAL_INVALID` | ✗ |
| 所有 provider-scope 非 collapsed 事件通过 hop validator | `ILLEGAL_TRANSITION` | ✗ |
| snapshot 文件存在 | `MISSING_SNAPSHOT` | ✓（显式 `from-scratch` 可豁免） |
| snapshot 文件可读且结构合法（含 `DERIVED` 标记） | `SNAPSHOT_UNREADABLE` | ✓（显式 `from-scratch` 可豁免） |
| replay 输出与当前 snapshot 一致（`--diff` 为空）**或** 显式 `from-scratch` | `SNAPSHOT_DIVERGED` | ✓（显式 `from-scratch` 可豁免） |
| `wake_resume_entrypoint.module_path:callable` 可 import | `ENTRYPOINT_UNRESOLVED` | ✗ |

**豁免语义**：只有当 `WakeResumeRequest.mode == 'from-scratch'` 时，`MISSING_SNAPSHOT` / `SNAPSHOT_UNREADABLE` / `SNAPSHOT_DIVERGED` 允许被豁免——但**必须**伴随显式 governance defaults fallback（见 R4）。未声明 `from-scratch` → 三者任一失败即 abort。

**禁止**：任何 preflight warning → 降级 → 继续的隐式路径。要么全过，要么 abort；`from-scratch` 是唯一显式豁免通道。

### R2. Idempotent Replay（Replay 恒等律）

- `replay(jsonl, merge_base)` 是**纯函数**：无网络、无文件系统写、无时钟读取（除记录事件生成时的 `at`；但 replay **不新生事件**）
- 两次 replay 同一 jsonl + 同一 merge_base → 字段级完全一致的 state dict
- `--diff` 模式下**禁止任何写**，包括 tmp 文件

违反 → registration validator 拒收（`IMPURE_REPLAY_REJECTED`）。

### R3. Write Order Invariant

任何会推进状态的路径（不仅 resume，也包括正常 `advance_provider_status`）必须：

1. `_append_transition_event` 成功（含 fsync）
2. **再**原子重写 state.yaml（tmp + rename 同目录）

失败模式：

| 失败点 | 后果 | 恢复路径 |
|---|---|---|
| 步骤 1 失败 | yaml 未动，jsonl 未改 | 直接重试，safe |
| 步骤 2 失败 | jsonl 已记，yaml 未改 → 下次 resume preflight 命中 `SNAPSHOT_DIVERGED` | 必须人工 `--apply` 修复；禁止自动 patch |

### R4. Governance Field Preservation

`ops_mode / discovery_done / smoke_passed / record_provenance / confidence` **不从事件派生**。resume 必须：

- **默认路径**：读 state.yaml → 作为 `merge_base` 传入 → 保留这 5 字段
- **`from-scratch` 路径**：显式声明 → fallback 到 defaults（`NOT_SET / False / False / absent / absent`）
- **禁止**：在未声明 `from-scratch` 的情况下静默丢失任一 governance 字段

### R5. Append-Only Immutability

- `state_transitions.jsonl` 禁止 rewrite / truncate / 中间插入 / 旧事件字段修改
- 历史数据错误必须通过**新事件**纠正（带 `[RECONSTRUCTED]` note + `collapsed: true`），不允许改旧行
- 文件被删等价于丢失权威事实 → 视为 `STREAM_CORRUPTED`，**必须人工介入**，禁止从 state.yaml 反向重建（因为 yaml 是派生，不是 source of truth）

---

## 5. Contract Sketch

### §5.0 顶层调用签名

```typescript
wake(entrypoint: WakeResumeEntrypoint, request: WakeResumeRequest): ResumeResult
```

- **输入**：`WakeResumeEntrypoint`（§5.1，注册期就绪）+ `WakeResumeRequest`（§5.2，每次调用构造）
- **输出**：`ResumeResult`（§5.3）。**唯一**可被下游消费的恢复结果通道
- **无副作用路径**：当 `request.mode == 'diff'` 时，`wake` 必须是只读纯函数（含禁止 tmp 写；见 §4 R2）

### §5.1 `WakeResumeEntrypoint`

Layer 0 contract（所有 Layer 2 wake_resume 实现必须实例化此结构）：

```typescript
interface WakeResumeEntrypoint {
  // 身份
  entrypoint_id: string                    // e.g. "age.onboarding.replay_state"
  component_id: string                     // 声明方 component
  declared_by_adr: string                  // 指向本 ADR 或扩展 ADR

  // 模块解析（P1-Doctrine wake_resume_entrypoint 字段的具体形态）
  module_path: string                      // e.g. "scripts.onboarding.replay_state"
  callable: string                         // e.g. "main"

  // 恢复源
  stream_refs: StreamRef[]                 // 引用 P1-e SessionEventStream（或 provisional candidate）
  snapshot_refs: SnapshotRef[]             // 引用 StateSnapshot，derived_from 必须 ⊆ stream_refs.stream_id

  // 契约
  preflight: PreflightContract             // 本 ADR §5.6
  replay: ReplayContract                   // 本 ADR §5.7
}

interface StreamRef {
  stream_id: string
  ref_kind: 'session-event' | 'session-adjacent'
  f1_compliant: boolean                    // false = provisional candidate（见 §7）
}

interface SnapshotRef {
  snapshot_id: string
  derived_from: string[]                   // stream_ids
}
```

### §5.2 `WakeResumeRequest`（输入）

每次 `wake()` 调用由调用方构造的请求包：

```typescript
interface WakeResumeRequest {
  // 触发来源
  invoked_by: string                       // "user:liye" | "system" | "orchestrator:<id>"
  invoked_at: string                       // ISO 8601

  // 恢复目标
  resource_context: ResourceContext        // 见 §5.4（最小公共接口）

  // 模式
  mode: 'diff' | 'apply' | 'from-scratch'
  diff_required_before_apply: boolean      // 必须 true（见 §4 R1 最后一列）
}
```

**模式语义**：

| mode | 作用 | snapshot 缺失/不可读/偏离 是否可豁免 | 允许写 |
|---|---|---|---|
| `diff` | 只读，对比 replay 输出 vs 当前 snapshot | ✗ | ✗（含 tmp） |
| `apply` | 原子写 snapshot 以消除 DIVERGED | ✗ | ✓（仅 snapshot 原子重写） |
| `from-scratch` | 显式声明忽略 snapshot；只靠 jsonl + defaults 构建 | ✓（豁免 `MISSING_SNAPSHOT` / `SNAPSHOT_UNREADABLE` / `SNAPSHOT_DIVERGED`） | 不默认允许；AGE 用 `--from-scratch --apply` 组合显式开写路径 |

### §5.3 `ResumeResult` + `ResumeContext`（输出）

**恢复结果契约**——下游消费者**只能**通过此结构获取恢复状态。

```typescript
interface ResumeResult {
  outcome: 'ready' | 'aborted'
  context: ResumeContext | null            // outcome='ready' 时必填；'aborted' 时必须 null
  failure_code: ResumeFailureMode | null   // outcome='aborted' 时必填；'ready' 时必须 null
  failure_reason: string | null            // 诊断文本（可含栈信息但禁敏感数据）
  preflight_report: PreflightReport        // 无论 outcome 都必填，可追溯哪些 check 跑过、结果如何
}

interface ResumeContext {
  // 身份
  resource_context: ResourceContext        // §5.4

  // 权威派生快照
  latest_snapshot: StateSnapshot           // §5.5

  // 事件流游标
  event_cursor: EventCursor

  // 恢复提示（下游决策辅助，非权威事实）
  resume_hints: ResumeHint[]

  // 联动工件（session-adjacent / receipt 等）
  linked_artifacts: LinkedArtifact[]
}

interface EventCursor {
  stream_id: string
  last_event_id: string                    // jsonl 末事件 event_id
  last_event_at: string                    // ISO 8601
  total_events: number
  replay_strategy: 'merge-base' | 'from-scratch'
}

interface ResumeHint {
  kind: string                             // e.g. "next-action" | "stale-warning" | "governance-fallback"
  severity: 'info' | 'warn'                // 硬性 abort 条件必须走 failure_code，不进 hints
  safe_summary: string                     // 必须脱敏
}

interface LinkedArtifact {
  artifact_class: string                   // P1-e ArtifactClass 值
  artifact_id: string
  role: string                             // e.g. "derived-index" | "query-audit"
}

interface PreflightReport {
  checks_run: ResumeFailureMode[]          // 实际跑过的 check（按 PreflightContract.required_checks 顺序）
  first_failure: ResumeFailureMode | null  // 首个失败的 check
  bypassed: ResumeFailureMode[]            // 被 from-scratch 显式豁免的 check
}
```

**硬约束**：

| # | 规则 | 失败码 |
|---|---|---|
| O1 | `outcome='ready'` → `context != null` 且 `failure_code == null` | `RESULT_SHAPE_VIOLATION` |
| O2 | `outcome='aborted'` → `context == null` 且 `failure_code != null` | `RESULT_SHAPE_VIOLATION` |
| O3 | `PreflightReport` 必须与实际执行路径一致（不得伪造 checks_run） | `PREFLIGHT_REPORT_FALSIFIED` |
| O4 | `ResumeHint.safe_summary` 必须满足 §5.4 C2 脱敏约束 | `RESUME_HINT_UNSAFE_SUMMARY` |
| O5 | 下游消费者**不得**绕过 `ResumeResult` 直接读 jsonl / yaml / 内部状态 | `RESUME_RESULT_BYPASSED`（见 §10） |

### §5.4 `ResourceContext`（最小公共接口，**禁止 Any**）

所有 Layer 2 wake_resume_entrypoint 的**最小公共参数合约**。Layer 2 实现可以追加字段，但不能少，也不能以「可扩展字段」规避。

```typescript
interface ResourceContext {
  resource_type: string                    // e.g. "store"（AGE onboarding 场景）
  id: string                               // e.g. "STR-E438213024"
  scope: string                            // e.g. "ads" | "spapi" | "store"
  safe_summary: string                     // 人类可读、已脱敏摘要
}
```

**Python 等价形态**：

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class ResourceContext:
    resource_type: str
    id: str
    scope: str
    safe_summary: str
```

**硬约束（validator 强制）**：

| # | 禁止 | 拒收码 |
|---|---|---|
| C1 | 使用 `Any` / `object` / `dict[str, Any]` / `Record<string, unknown>` / `Map<string, object>` 或等价类型 | `RESOURCE_CONTEXT_ANY_TYPE` |
| C2 | 在 `safe_summary` 里放 credential material / raw token / 完整 PII | `RESOURCE_CONTEXT_UNSAFE_SUMMARY` |
| C3 | 省略 4 个必填字段任一 | `RESOURCE_CONTEXT_MISSING_FIELD` |
| C4 | 使用可变字段集（`extra: Dict[str, Any]`、`metadata: object` 等）规避最小接口 | `RESOURCE_CONTEXT_ESCAPE_HATCH` |

**C2 判定（非规范性指南）**：`safe_summary` 应通过 Loamwise Guard 的 content-scan（P1-d）；出现 token 形态（`^ya29\.`、`^Atza\|`、`Bearer `、bcrypt/argon 特征等）或完整 email / phone → 不安全。

### §5.5 `StateSnapshot`

```typescript
interface StateSnapshot {
  snapshot_id: string                      // 通常 = 文件路径或稳定标识
  derived_from: string[]                   // stream_ids，必须非空
  warning_marker: 'DERIVED'                // 文件必须含，validator 必须校验
  last_replay_at: string                   // ISO 8601
  total_events: number                     // 来自 replay 结果
  governance_fields: GovernanceFields      // 不派生自事件
}

interface GovernanceFields {
  ops_mode: string                         // 必须是明确 enum 值（不是 Any）
  discovery_done: boolean
  smoke_passed: boolean
  record_provenance: string | null
  confidence: string | null
}
```

**硬约束**：snapshot 文件必须含 `DERIVED` 标记（AGE 当前用 `_warning: "DERIVED..."` 满足）。校验器检测不到 → 拒绝作为 snapshot 使用（失败码 `SNAPSHOT_MISSING_DERIVED_MARKER`）。

### §5.6 `PreflightContract`

静态声明型契约——注册期就固定哪些 check、哪些允许豁免、以什么顺序跑。`wake()` 执行期**不得**增减 required_checks。

```typescript
interface PreflightContract {
  // 必跑的检查（按声明顺序执行）
  required_checks: ResumeFailureMode[]

  // 是否要求 snapshot（false = 该 entrypoint 可无 snapshot 运行）
  snapshot_required: boolean

  // 允许被 `from-scratch` 显式豁免的检查
  // 必须 ⊆ required_checks；必须 ⊆ {MISSING_SNAPSHOT, SNAPSHOT_UNREADABLE, SNAPSHOT_DIVERGED}
  allow_from_scratch_bypass: ResumeFailureMode[]

  // 固定不变量（schema 层只允许 true）
  diff_required_before_apply: true
  abort_on_first_failure: true
}
```

**硬约束（validator 强制，见 §5.8）**：

| # | 规则 | 拒收码 |
|---|---|---|
| P1 | `required_checks` 必须 ⊆ 已知 `ResumeFailureMode` 枚举 | `PREFLIGHT_UNKNOWN_CHECK` |
| P2 | `allow_from_scratch_bypass` 必须 ⊆ `required_checks` | `PREFLIGHT_BYPASS_NOT_REQUIRED` |
| P3 | `allow_from_scratch_bypass` 必须 ⊆ `{MISSING_SNAPSHOT, SNAPSHOT_UNREADABLE, SNAPSHOT_DIVERGED}` | `PREFLIGHT_BYPASS_OUT_OF_SCOPE` |
| P4 | `diff_required_before_apply` 必须 `true`（schema-level enum = [true]） | `PREFLIGHT_WEAK_DIFF_GUARD` |
| P5 | `abort_on_first_failure` 必须 `true` | `PREFLIGHT_CONTINUE_ON_FAILURE` |
| P6 | 若 `snapshot_required == true` 且 `MISSING_SNAPSHOT ∉ required_checks` → 拒收 | `PREFLIGHT_SNAPSHOT_CHECK_MISSING` |

### §5.7 `ReplayContract`

```typescript
interface ReplayContract {
  is_pure: true                            // schema-level 自证；validator 不接受 false（§5.8 C3）
  stable_ordering_keys: string[]           // e.g. ['at', 'event_id']
  declared_failure_modes: ResumeFailureMode[]   // 必须是枚举已知集合
}

type ResumeFailureMode =
  // Stream 层
  | 'MISSING_STREAM'
  | 'EMPTY_STREAM'
  | 'STRUCTURAL_INVALID'
  | 'ILLEGAL_TRANSITION'
  | 'STREAM_CORRUPTED'
  | 'STREAM_NOT_REGISTERED'
  // Snapshot 层
  | 'MISSING_SNAPSHOT'
  | 'SNAPSHOT_UNREADABLE'
  | 'SNAPSHOT_DIVERGED'
  | 'SNAPSHOT_MISSING_DERIVED_FROM'
  | 'SNAPSHOT_DANGLING_DERIVED_FROM'
  | 'SNAPSHOT_MISSING_DERIVED_MARKER'
  // Entrypoint / Replay 层
  | 'ENTRYPOINT_UNRESOLVED'
  | 'IMPURE_REPLAY_REJECTED'
  // ResourceContext 层
  | 'RESOURCE_CONTEXT_ANY_TYPE'
  | 'RESOURCE_CONTEXT_UNSAFE_SUMMARY'
  | 'RESOURCE_CONTEXT_MISSING_FIELD'
  | 'RESOURCE_CONTEXT_ESCAPE_HATCH'
  // Preflight 层
  | 'PREFLIGHT_UNKNOWN_CHECK'
  | 'PREFLIGHT_BYPASS_NOT_REQUIRED'
  | 'PREFLIGHT_BYPASS_OUT_OF_SCOPE'
  | 'PREFLIGHT_WEAK_DIFF_GUARD'
  | 'PREFLIGHT_CONTINUE_ON_FAILURE'
  | 'PREFLIGHT_SNAPSHOT_CHECK_MISSING'
  // Result shape 层
  | 'RESULT_SHAPE_VIOLATION'
  | 'PREFLIGHT_REPORT_FALSIFIED'
  | 'RESUME_HINT_UNSAFE_SUMMARY'
  | 'RESUME_RESULT_BYPASSED'
```

**禁止新增未枚举的失败码**；新失败模式必须走 ADR 修订。

### §5.8 Registration Validator

```python
def register_wake_resume_entrypoint(wre: WakeResumeEntrypoint) -> RegisterResult:
    # C1. 模块可 import
    if not _can_import(wre.module_path, wre.callable):
        return fail('ENTRYPOINT_UNRESOLVED')

    # C2. stream_refs 每个都注册（或 provisional candidate 已登记）
    for sr in wre.stream_refs:
        if not _stream_registered_or_provisional(sr.stream_id):
            return fail('STREAM_NOT_REGISTERED', sr.stream_id)

    # C3. ReplayContract 必须纯
    if not wre.replay.is_pure:
        return fail('IMPURE_REPLAY_REJECTED')

    # C4. Replay 失败码必须是已知枚举
    unknown = set(wre.replay.declared_failure_modes) - KNOWN_FAILURE_MODES
    if unknown:
        return fail('UNKNOWN_FAILURE_MODES', sorted(unknown))

    # C5. snapshot_refs derived_from ⊆ stream_refs
    stream_ids = {s.stream_id for s in wre.stream_refs}
    for sn in wre.snapshot_refs:
        if not sn.derived_from:
            return fail('SNAPSHOT_MISSING_DERIVED_FROM', sn.snapshot_id)
        if set(sn.derived_from) - stream_ids:
            return fail('SNAPSHOT_DANGLING_DERIVED_FROM', sn.snapshot_id)

    # C6. PreflightContract 合规（本 ADR §5.6 P1-P6）
    pf = wre.preflight
    if set(pf.required_checks) - KNOWN_FAILURE_MODES:
        return fail('PREFLIGHT_UNKNOWN_CHECK')
    if set(pf.allow_from_scratch_bypass) - set(pf.required_checks):
        return fail('PREFLIGHT_BYPASS_NOT_REQUIRED')
    if set(pf.allow_from_scratch_bypass) - {
        'MISSING_SNAPSHOT', 'SNAPSHOT_UNREADABLE', 'SNAPSHOT_DIVERGED'
    }:
        return fail('PREFLIGHT_BYPASS_OUT_OF_SCOPE')
    if not pf.diff_required_before_apply:
        return fail('PREFLIGHT_WEAK_DIFF_GUARD')
    if not pf.abort_on_first_failure:
        return fail('PREFLIGHT_CONTINUE_ON_FAILURE')
    if pf.snapshot_required and 'MISSING_SNAPSHOT' not in pf.required_checks:
        return fail('PREFLIGHT_SNAPSHOT_CHECK_MISSING')

    # C7. ResourceContext schema 合规（本 ADR §5.4 C1-C4）
    rc_check = _validate_resource_context_schema(wre.module_path, wre.callable)
    if not rc_check.ok:
        return fail(rc_check.code)

    return ok()
```

---

## 6. AGE 实例化（reference binding）

### Component Declaration（AGE onboarding）

```yaml
component_id: age.onboarding.store_state
layer: 2
artifact_role: component
primary_concern: Session
credential_bindings: []                    # 本 component 不直接取用 credentials；OAuth/SP-API 凭据在上游 authz 组件里，按 P1-f 走
wake_resume_entrypoint: age.onboarding.replay_state:main
explicit_non_goals:
  - '不自动修复 SNAPSHOT_DIVERGED，必须人工 --apply'
  - '不跨 store 共享 state'
  - '不替代 Layer 0 F1 合规判定'
```

### WakeResumeEntrypoint 实例

```yaml
entrypoint_id: age.onboarding.replay_state
component_id: age.onboarding.store_state
declared_by_adr: ADR-AGE-Wake-Resume
module_path: scripts.onboarding.replay_state
callable: main

stream_refs:
  - stream_id: age.stream.state_transitions
    ref_kind: session-event
    f1_compliant: false                    # 缺 prev_event_hash（见 §7）

snapshot_refs:
  - snapshot_id: age.snapshot.state_yaml
    derived_from: [age.stream.state_transitions]

preflight:
  required_checks:
    - MISSING_STREAM
    - EMPTY_STREAM
    - STRUCTURAL_INVALID
    - ILLEGAL_TRANSITION
    - MISSING_SNAPSHOT
    - SNAPSHOT_UNREADABLE
    - SNAPSHOT_DIVERGED
    - ENTRYPOINT_UNRESOLVED
  snapshot_required: true
  allow_from_scratch_bypass:
    - MISSING_SNAPSHOT
    - SNAPSHOT_UNREADABLE
    - SNAPSHOT_DIVERGED
  diff_required_before_apply: true
  abort_on_first_failure: true

replay:
  is_pure: true
  stable_ordering_keys: [at, event_id]
  declared_failure_modes:
    - MISSING_STREAM
    - EMPTY_STREAM
    - STRUCTURAL_INVALID
    - ILLEGAL_TRANSITION
    - MISSING_SNAPSHOT
    - SNAPSHOT_UNREADABLE
    - SNAPSHOT_DIVERGED
    - ENTRYPOINT_UNRESOLVED
```

### `wake()` 调用示例（AGE）

```python
# 构造 Request
request = WakeResumeRequest(
    invoked_by="user:liye",
    invoked_at="2026-04-17T10:30:00Z",
    resource_context=ResourceContext(
        resource_type="store",
        id="STR-E438213024",
        scope="ads",                                    # "ads" | "spapi" | "store"
        safe_summary="XMEDEN (US/MX/BR), ads VERIFIED, spapi VERIFIED, OPERATIONAL",
    ),
    mode="diff",
    diff_required_before_apply=True,
)

# 调用
result: ResumeResult = wake(age_entrypoint, request)

# 消费（只允许通过 ResumeResult）
if result.outcome == "ready":
    assert result.context is not None
    snapshot = result.context.latest_snapshot
    cursor = result.context.event_cursor
    # ... 下游决策
else:
    assert result.failure_code is not None
    # 根据 failure_code 做 abort 路径
```

---

## 7. 与 P1-e（Session Event Stream）的关系

AGE `state_transitions.jsonl` 在 P1-e 分类法下是 **provisional authoritative candidate, not yet F1-compliant**：

| F1 条件 | 现状 | 缺口 |
|---|---|---|
| F1.1 append-only | ✓ | — |
| F1.2 持久结构化 | ✓（NDJSON + JSON schema） | — |
| **F1.3 hash-chained** | ✗ | **事件 schema 无 `prev_event_hash` 字段** |
| F1.4 权威 | ✓（yaml 派生自 jsonl，`_warning: "DERIVED..."`） | — |
| F1.5 stream descriptor | 部分（schema 已在，但未登记到 P1-e §4 StreamRegistry） | 待登记 |

**含义**：

- **在 AGE 补齐 F1.3 之前**：
  - `stream_refs[].ref_kind = 'session-event'`、`f1_compliant = false`
  - **不得**进入 P1-e 的 strict_truth bucket 1（保持 bucket 3 或不入榜）
  - resume 本身**仍然合法**——preflight + replay 足以自证；但其他组件不得把此流当 authoritative session fact 联合检索
- **在 AGE 补齐 F1.3 之后**：
  - 登记到 StreamRegistry 获 stream_id
  - `f1_compliant = true`
  - 可进入 strict_truth bucket 1

**本 ADR 不强制 AGE 在 P1 期间补齐 hash chain**——这是 AGE 后续独立演进任务（见 §11 C6）。

---

## 8. 与其他 P1 ADR 的关系

| ADR | 关系 |
|---|---|
| **P1-Doctrine** | 本 ADR 给出 Component Declaration `wake_resume_entrypoint: null \| string` 的具体形态 |
| **P1-e** | `state_transitions.jsonl` 是 provisional SESSION_EVENT_STREAM 候选；snapshot 的 `derived_from` 与 P1-e `SessionAdjacentArtifact.derived_from` 同源语义 |
| **P1-f** | resume 若需真实 API 调用（如 smoke 复核），凭据走 `credential_bindings`，产出 `CredentialAuditRecord`（P1-e SessionAdjacentKind.CREDENTIAL_AUDIT）；本 ADR **不重定义** |
| **P1-b** | `LifecycleTransition` 也是 append-only + 显式 driver，与本 ADR 同源 discipline（事件流 + 纯函数 replay） |
| **P1-c** | `MemoryAssemblyPlan` 冻结计划 + `declared_tiers` 写约束，与本 ADR R4 governance 字段保留同源纪律 |
| **P1-d** | `safe_summary` 非规范性指南引用 G1 content-scan；但本 ADR 不硬绑 Guard 启用状态 |

---

## 9. Non-Goals

- **不重写** AGE 任何现有代码；本 ADR 把现存机制硬化为契约
- **不引入** 跨 store / 跨 domain 的聚合 resume；每次 resume 作用域 = 单 resource
- **不引入** optimistic resume / auto-heal / 自动 patch；`SNAPSHOT_DIVERGED` 必须人工 `--apply`
- **不替代** Layer 0 F1 合规判定（P1-e 职责）
- **不处理** secrets（P1-f 职责）
- **不开放** ResourceContext 的可扩展字段；未来新字段走本 ADR 修订
- **不让** 下游直接读 jsonl / yaml / 内部状态；只能通过 `ResumeResult`

---

## 10. 禁止事项

1. **禁止** 在 ResourceContext 使用 `Any` / `object` / 等价 escape hatch
2. **禁止** 在 `safe_summary` 或 `ResumeHint.safe_summary` 写 credential material / raw token / 完整 PII
3. **禁止** 把 state.yaml 当权威恢复源（派生快照，**不**是 source of truth）
4. **禁止** 在 `diff` 模式写任何文件（含 tmp 文件）
5. **禁止** 用 `collapsed: true` 规避 hop validation，除非 note 含 `[RECONSTRUCTED]` 且有独立 ADR / 人工审批背书
6. **禁止** 跳过 preflight 进入 replay
7. **禁止** 从 state.yaml 反向重建 state_transitions.jsonl（派生不能反推权威）
8. **禁止** 在未显式 `from-scratch` 时静默丢失 governance 字段
9. **禁止** 下游绕过 `ResumeResult` 直接读 jsonl / yaml / 内部状态（监测到 → `RESUME_RESULT_BYPASSED`）
10. **禁止** 在 `outcome='aborted'` 时返回非空 `context`，或在 `outcome='ready'` 时返回非空 `failure_code`
11. **禁止** 在 `wake()` 执行期偏离 `PreflightContract.required_checks` 声明

---

## 11. Adoption Checkpoints

| # | 检查点 | 时机 | 通过条件 |
|---|---|---|---|
| C1 | 本 ADR 合版 | P1 批次 | P1 批次其余 7 份 ADR 全合版 |
| C2 | AGE Component Declaration 补 `wake_resume_entrypoint` | P1 合版后 1 周 | `age.onboarding.replay_state:main` 可 import |
| C3 | ResourceContext dataclass 在 AGE 落地 | P1 合版后 2 周 | AGE 导出 frozen dataclass；4 字段覆盖；禁用 Any 的静态检查过关 |
| C4 | registration validator 可用 | P1 合版后 2 周 | Layer 0 `register_wake_resume_entrypoint` 实现；拒绝 `is_pure=false`、未知失败码、dangling derived_from、Any 类型、不合规 PreflightContract |
| C5 | `ResumeResult` 结果契约落地 | P1 合版后 3 周 | AGE 侧 `wake()` 返回完整 `ResumeResult`；O1-O5 规则有单元测试覆盖 |
| C6 | AGE D0→D1 升级门禁 | D1 发起 | 对全部 3 个活 store，`replay_state.py --diff` 输出 IN SYNC；任一 DIVERGED 必须 `--apply` 消除，不得绕过 |
| C7 | F1.3 补齐（独立演进，本 ADR 不强制） | AGE 后续 ADR | `state_transitions.jsonl` 加 `prev_event_hash`；StreamRegistry 登记；`f1_compliant = true` |

---

## Appendix A — Doctrine 对齐

- **P1-Doctrine Component Declaration** 中 `wake_resume_entrypoint: null | string`
  - `null` 含义：**该 component 不支持恢复**；调用方必须 fail-closed 处理（**不得**退化为「尽力而为」）
  - `string` 含义：`module_path:callable` 字符串；具体结构由本 ADR §5.1 定义
- 本 ADR 的 ResourceContext（§5.4）是**所有 Layer 2 wake_resume_entrypoint 的最小公共参数合约**
- 本 ADR 的 ResumeResult（§5.3）是**所有 Layer 2 wake_resume_entrypoint 的最小公共结果合约**；下游**只能**通过此结构消费恢复状态

## Appendix B — 与 AGE 现存代码对应表（non-normative）

| 本 ADR 概念 | AGE 代码位置 |
|---|---|
| Event stream | `artifacts/onboarding/{store_id}/state_transitions.jsonl` |
| Event schema | `config/stores/_schema/state_event.schema.json` |
| `StateTransitionEvent` | `scripts/onboarding/_lib/models.py:StateTransitionEvent` |
| Snapshot | `config/stores/stores/{store_id}/state.yaml` |
| Structural validator | `scripts/onboarding/_lib/persistence.py:_validate_event_structure` |
| Hop validator | `scripts/onboarding/_lib/state_machine.py:validate_provider_transition` |
| Replay function | `scripts/onboarding/_lib/persistence.py:replay_state_from_jsonl` |
| CLI entrypoint | `scripts/onboarding/replay_state.py:main` |
| Governance 字段清单 | `scripts/onboarding/_lib/persistence.py:_MERGE_GOVERNANCE_FIELDS` |
| Write-order 不变量 | `scripts/onboarding/_lib/persistence.py:advance_provider_status` 步骤 4→6 |
| `--diff` / `--apply` / `--from-scratch` 三模式 | `scripts/onboarding/replay_state.py:main` argparse |

---

**本 ADR 硬化的是 AGE 既有机制，不替 AGE 做任何业务决定**。任何偏离本契约的现存 AGE 代码必须在 C6 之前修正或显式豁免（豁免需独立 ADR）。
