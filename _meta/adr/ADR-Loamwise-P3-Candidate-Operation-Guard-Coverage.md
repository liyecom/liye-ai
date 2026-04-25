---
artifact_scope: meta
artifact_name: Loamwise-P3-Candidate-Operation-Guard-Coverage
artifact_role: contract
target_layer: 1
is_bghs_doctrine: no
---

# ADR — Loamwise P3 Candidate Operation Guard Coverage

**Status**: Accepted
**Date**: 2026-04-25
**Accepted-Date**: 2026-04-25
**Decision Makers**: LiYe
**SSOT**: `_meta/adr/ADR-Loamwise-P3-Candidate-Operation-Guard-Coverage.md`
**References**:
- `_meta/adr/ADR-Architecture-Doctrine-BGHS-Separation.md` (P1-Doctrine, 必读前置)
- `_meta/adr/ADR-Hermes-Skill-Lifecycle.md` (P1-b — `LifecycleTransition` audit contract)
- `_meta/adr/ADR-Loamwise-Guard-Content-Security.md` (P1-d — `ProtectedPathKind` + `GuardEvidence` schema)
- `_meta/adr/ADR-Session-and-Session-Adjacent-Taxonomy-Federated-Query.md` (P1-e — `SessionAdjacentKind`)
- `loamwise/.planning/acceptance/sprint-7-shadow-readout.md` (commit `3a50424` on `feat/p3-governed-learning-loop`) — locus and direction corrected herein

---

## Context

### Discipline Preface

> **观察事实 ≠ 契约结论**：`5 writes / 0 truth_write scans` 是 Sprint 7 观察事实，不是契约结论。路径归属是本 ADR 的裁决命题，**不能从观察事实直接推出**。
>
> **粒度纪律**：相同 persistence primitive (`backend.save()`) 不等于相同 governance path。裁决必须精确到 operation，**禁止表级结论**。

### Core Question

本 ADR 裁定 P3 skill-candidate 相关写入**按 operation 逐项**归入 P1-d ContentScanGuard 路径、TruthWriteGuard 路径、P1-e session-adjacent 路径、或 "no additional P2 guard required (lifecycle-audit-only)"。

本 ADR **不**做 Route 1 vs Route 2 的二选一决策 — Sprint 7 readout 的 "P3 bypasses Boundary B" framing 在本 ADR 第 §Correction 节予以更正。

### Closing Thesis

> **P-B is not a Boundary-B TruthWriteGuard gap. It is a P3 submit-path ContentScanGuard implementation gap plus an operation-level guard coverage clarification.**

---

## Correction to Sprint 7 Readout Locus and Direction

This ADR records the authoritative correction for P-B interpretation while preserving the frozen readout artifact (`commit 3a50424`) unchanged.

**Scope limit**: 本节范围严格限于 P-B 的 locus / direction 修正；不重算或重审 Sprint 7 全局 readout（如 §1 双口径窗口、§2 9-field statistics、§4 6-gate verdict distribution 等均不在本节修正范围）。

### Errata（精确引用 + 纠偏）

| Readout 引用 | 原文要点 | 错误性质 | 本 ADR 更正 |
|---|---|---|---|
| L96 | "5 `ts_skill_candidates` rows were persisted to **the truth store** without triggering any `truth_write_guard_scan`" | 前提错误：ts_skill_candidates ≠ truth store；P3 `skill_review_queue.py:18, 284` 明示 `accept != truth`；`L361-362` 明示 `PROMOTED is a governance decision, not an activation` | ts_skill_candidates 是 P3 lifecycle store，不是 truth store；P3 当前 operations 不构成 truth-write boundary |
| L258 | "`SkillReviewQueue._materialize` writes 5 records" | Locus 事实错误：`SkillReviewQueue` 类无 `_materialize` 方法；`_materialize` 属于旧 `ReviewQueue` (`review_queue.py:126`)，与 P3 无关 | 实际写入路径是 `skill_review_queue.py:200, 237, 272, 308, 343, 419, 457, 517` 共 8 处 `backend.save()` 调用 |
| L258, L260, L262 | 反复指 `truth_write_guard_scan` / Boundary B / TruthWriteGuard | Guard 归因错误：P1-d §2 G2 第一条明文 "skill candidate 提交 → ContentScanGuard"；TruthWriteGuard 仅条件适用于 "Skill promotion (→ ACTIVE)" + authoritative capability | 真实 Gap 是 `submit()` 缺 ContentScanGuard 接入，非 "TruthWriteGuard 缺接入" |
| L259 | 引用 "skill-candidate-submit protected path" | 自相矛盾：路径名引用正确，但 L258/260/262 又错误指向 truth-write | L259 路径名是正确锚，应据此推 ContentScanGuard 而非 TruthWriteGuard |
| L260 Routes | "Route 1 / Route 2" | 方向错误：两条 route 都基于 "P3 needs truth_write coverage" 错误假设 | Route 选择不是本 ADR 的产物；本 ADR 的产物是 per-operation classification + 唯一 implementation gap (`submit() → ContentScanGuard`) |
| L262 Closure | "(a) `truth_write_guard_scan` emitted... OR (b) P1-d amendment" | Closure 错误：option (a) 应是 `content_guard_scan`；option (b) 不必要 | 见本 ADR §Closure Signal — 5 条独立 closure，无需 P1-d amendment |

### Standing Observation（修正后仍成立）

Sprint 7 期间观察到 5 `skill_candidate.submitted` events / 0 `content_guard_scan` events on those candidates.
**计数不变；归因更正**：absent guard 是 ContentScanGuard，不是 TruthWriteGuard。

---

## Decision

### D1 — Per-Operation Guard Coverage Contract

| # | Operation | Semantic Write Object | Existing Coverage | Required Path | Contract Status | Implementation Locus |
|---|-----------|---------------------|-------------------|---------------|----------------|-------------------|
| 1 | `submit` | New candidate body + content_hash | P1-d §2 G2 (skill-candidate-submit → ContentScanGuard) | **A: ContentScanGuard** (shadow mode initially) | **existing** — P1-d 既定，unimplemented gap | `skill_review_queue.py:200` 之前注入 `content_scan_guard.check(GuardContext(content=...))` |
| 2 | `scan` | Verdict record (passive, externally produced) | None at content level | **No additional P2 guard required** | **clarified-by-this-ADR** (negative invariant — see §D2 I1) | n/a |
| 3 | `claim_review` | Reviewer assignment (state transition) | P1-b LifecycleTransition¹ | **No additional P2 guard required** (lifecycle-audit-only) | existing¹ | n/a |
| 4 | `accept` | State + trust_level=REVIEWED (NOT truth-write) | P1-b LifecycleTransition¹ | **No additional P2 guard required** | existing¹ | n/a |
| 5 | `reject` | Rejection terminal state with reason | P1-b LifecycleTransition¹ | **No additional P2 guard required** | existing¹ | n/a |
| 6 | `promote` | PROMOTED governance decision (**not activation**) | P1-b LifecycleTransition¹ | **No additional P2 guard required** | **clarified-by-this-ADR** (boundary declaration — see §D2 I2/I3) | n/a |
| 7 | `revoke` | PROMOTED → REVOKED governance withdrawal | P1-b LifecycleTransition¹ | **No additional P2 guard required** | existing¹ | n/a |
| 8 | `check_expired` | Time-driven batch expire (system-initiated) | P1-b LifecycleTransition¹ | **No additional P2 guard required** | existing¹ | n/a |

**Footnote ¹**: P1-b lifecycle audit contract is honored at the audit-emission level via P3 `_emit_transition()`; formal P3 `ReviewStatus` ↔ P1-b `SkillLifecycleState` state-semantics mapping is deferred to Sprint 8 ADR (see §Appendix A).

#### Async Compatibility

| Op | Current (sync) | Intended async (P3 future queue) | 评估 |
|----|----------------|----------------------------------|------|
| `submit` + ContentScanGuard | sync-sync | 若 P3 转 async queue，ContentScanGuard 需 async wrapper | sync-sync 现状下可立即实施，future async 不阻塞 |
| 其他 7 ops | sync | async 不依赖 guard | 无影响 |

### D2 — Invariants

**I1 — `scan_verdict` ≠ `ShadowVerdict` (Negative Substitution Invariant)**

P3 `ScanVerdict` (PENDING/SAFE/CAUTION/DANGEROUS) 不得被计作 P2 `ShadowVerdict` 或 `GuardEvidence`。两者目前无 mapping 字段（无 `trace_id` 关联、无 `evidence_ref` 关联、无 `risk_level` 枚举对齐）。除非未来有显式 mapping contract（独立 ADR），否则任何把 P3 `scan_verdict` 计入 P2 evidence 的做法均违反本 invariant。

**I2 — `TrustLevel.TRUSTED` ≠ Authoritative**

P3 candidate record 中的 `trust_level=TRUSTED`：
- 不等于 P1-c `MemoryTier.AUTHORITATIVE`
- 不等于 runtime capability registration
- 不等于 dispatcher-visible activation

**I3 — `PROMOTED` ≠ ACTIVE Activation**

P3 `ReviewStatus.PROMOTED` 是 governance decision，不触达 P1-b `SkillLifecycleState.ACTIVE`，不触发 TruthWriteGuard，不写入 runtime registry。任何让 skill 可执行 / 可调度 / 可注册 capability 的未来 operation 必须重新分类，按 P1-d `skill.promotion (→ ACTIVE)` + `capability.registration` path 处理（包含条件性 TruthWriteGuard 接入）。

**I4 — State Mapping Deferral**

P3 `ReviewStatus` ↔ P1-b `SkillLifecycleState` 正式 mapping deferred to Sprint 8 ADR。本 ADR 在 audit-emission level 引用 P1-b LifecycleTransition contract，但不断言 P3 ReviewStatus 是 P1-b 的子状态机或等价 mapping。

### D3 — Default Rule for Unlisted Operations

任何新增 P3 write operation，若改变以下 7 类之一：

- candidate content
- scan evidence
- lifecycle state
- trust level
- promotion status
- runtime visibility
- authoritative capability registration

必须经 ADR 分类后方可发布（pre-shipping classification mandatory）。普通 metadata / timestamp 维护不纳入 ADR 管辖。

---

## Consequences

### 不触发的 amendment

- ❌ P1-b amendment — 不需要（lifecycle audit contract 在 emission level 已被满足）
- ❌ P1-d amendment — 不需要（既有 §2 G2 已覆盖 submit path，本 ADR 是 first-time implementation）
- ❌ P1-e amendment — 不需要（GuardEvidence + LifecycleTransitionLog 归属 SessionAdjacentKind 不变）

### 本 ADR 自身产出的 contracts

**No new guard kind or upstream ADR amendment is introduced.** Sprint 8 implementation may add a Layer-1 invocation surface for the existing ContentScanGuard. **But ADR-level contracts ≠ 0**: this ADR creates the operation classification contract (D1 8-row matrix), four governance invariants (D2 I1-I4), the default classification rule (D3), and records authoritative correction for P-B interpretation (§Correction).

---

## Implementation Pointer (NON-NORMATIVE)

> 本 ADR 不强制实现路径；以下为 Sprint 8 实施会话的 starting hint。

**One likely approach** (team chooses at Sprint 8 implementation): Inject `ContentScanGuard` into `SkillReviewQueue` constructor; wire `submit()` to call `guard.check(GuardContext(content=...))` in shadow mode before `_backend.save()`.

**Alternative**: Add a candidate-submit-content-scan surface to `ShadowScanner`, then call from `submit()`.

**Discouraged anti-pattern**: Reusing `WriteEngine.scan_payload()` by disguising P3 candidate as a changeset — type/semantic mismatch.

> Concrete implementation route is selected by the Sprint 8 implementation session, not this ADR.

---

## Closure Signal

P-B is closed when **all five** of the following hold:

1. 本 ADR Accepted（status=Accepted），含 `Correction to Sprint 7 Readout Locus and Direction` 节
2. `submit()` path calls ContentScanGuard in shadow mode, produces `content_guard_scan` audit event verifiable via test/audit query
3. P3 tests add guard-chain integration assertions — must verify guard event emission, not only `scan_verdict` field assertion
4. ADR / docs explicitly state "P3 `scan_verdict` ≠ P2 `ShadowVerdict` absent future mapping contract"
5. ADR / docs explicitly state "P3 `promote()` ≠ ACTIVE activation; does not trigger TruthWriteGuard"

---

## Non-goals

- ❌ 不定义 P3 `ReviewStatus` ↔ P1-b `SkillLifecycleState` 正式 mapping（Sprint 8 ADR）
- ❌ 不引入 P3 `scan_verdict` ↔ P2 `ShadowVerdict` mapping contract（独立 ADR if/when needed）
- ❌ 不修订 P1-b / P1-d / P1-e
- ❌ 不规定 ContentScanGuard 接入的具体代码实现路径（NON-NORMATIVE pointer 以外）
- ❌ 不处理 P-A (provenance) / P-C (schema completeness)（独立 Preconditions）
- ❌ 不开启 Sprint 8 window（开启需 P-A AND P-B AND P-C closed + traffic enablement）

---

## Appendix A — Gap 3: P3 ReviewStatus ↔ P1-b SkillLifecycleState Mapping Deferral

P3 当前 `ReviewStatus` 8 状态: `{QUARANTINED, SCANNED, UNDER_REVIEW, ACCEPTED, REJECTED, PROMOTED, EXPIRED, REVOKED}`

P1-b `SkillLifecycleState` 6 状态: `{DRAFT, CANDIDATE, QUARANTINED, ACTIVE, DEPRECATED, REVOKED}`

**关键不对称**:

- **同名反义**: P1-b `QUARANTINED` 是 pre-terminal 隔离态（被阻断、不进 promotion 队列）；P3 `QUARANTINED` 是入口态（quarantine-first 默认起点）— 不得作等价处理
- **缺位**: P3 当前实现没有 → ACTIVE transition；promote 止于 PROMOTED
- **粒度差**: P3 ReviewStatus 可能（但本 ADR 不断言）是 P1-b CANDIDATE 大态内部的子流程

**处置**: 正式 state-semantics 映射 + transition 表对齐由 Sprint 8 独立 ADR 定义。本 ADR 仅在 audit-emission level 引用 P1-b LifecycleTransition contract（D1 footnote ¹）。

---

## Adoption Checkpoints

| Checkpoint | 触发时机 | 验证项 |
|-----------|---------|-------|
| C1. ADR Accepted | 本 ADR review 通过 | Status: Accepted; Correction section landed; 5 Closure Signals 落入条款 |
| C2. ContentScanGuard Injection (shadow) | Sprint 8 实施会话 | `submit()` 调用 `ContentScanGuard.check()` in shadow mode; `content_guard_scan` event in audit log |
| C3. P3 Test Integration | 与 C2 同 sprint | tests 增加 guard-chain integration 断言；至少 1 测试验证 guard event 发射 |
| C4. Invariant Documentation | 与 C2 同 sprint | I1 / I2 / I3 在 P3 README 或 module docstring 显式声明 |
| C5. Sprint 7 Readout Cross-Reference | C1 完成时 | Sprint 7 readout (commit 3a50424) 不修改；本 ADR Correction 节作为下游 readout 的权威修正记录 |

> 本 ADR 不实施任何代码。Adoption checkpoints C2/C3 是 Sprint 8 实施会话的入库门，不在本轮执行。

---

**Version**: 1.0.0
**Last Updated**: 2026-04-25
