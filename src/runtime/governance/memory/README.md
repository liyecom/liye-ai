# BGHS Memory — Boundary Notes

**Location**: `src/runtime/governance/memory/`
**ADR**: `_meta/adr/ADR-Hermes-Memory-Orchestration.md` (P1-c)
**Sprint**: 6

## One-line boundary

> `src/runtime/memory/`                     = **memory execution-face** (context, observation gateway)
> `src/runtime/governance/memory/`          = **BGHS memory governance surface**
> Loamwise `align/` (separate repo)         = **retrieval engine / orchestrator**
> The three are **not** interchangeable and the first two **must not** cross-import.

## Why the split exists

ADR-Hermes-Memory-Orchestration §O8 is explicit: Layer 0 defines the
contracts (tiers, records, plans, use policies, snapshot shape); Layer 1
(Loamwise) implements the manager, the retrieval router, the prefetch
orchestration, and the summarization pipeline. If governance types and
execution behaviors share a file, "strict_truth" becomes a knob the
retrieval engine can quietly flip — exactly the slip the ADR forbids.

| Aspect | `src/runtime/memory/` | `src/runtime/governance/memory/` |
|---|---|---|
| What "memory" means | Runtime context plumbing and observation ingress | Structural contracts: tiers, records, plans, use policies, frozen snapshots |
| Primary interface | `context.ts`, `observation-gateway.ts` | `MemoryUsePolicyRegistry` + `MemoryRecordRegistry` + `MemoryPlanRegistry` + `buildFrozenSnapshot` + `validateRetrievalRequest` + guard-wired write / ingest seams |
| Who touches state | Runtime context pipeline (Layer 1 execution) | Registry registrations (accept/reject), plan freeze, snapshot builder |
| Data model | Execution context objects | `MemoryRecord`, `MemoryAssemblyPlan`, `MemoryUsePolicy`, `FrozenSnapshot` |
| Failure mode | Runtime plumbing error | Registration rejected (`DERIVATION_ELEVATES_TIER`, `AUTHORITATIVE_MUST_DECLARE_DECISION_CONSUMERS`, `PLAN_FROZEN_IS_IMMUTABLE`, …) |
| Consumed by | Loamwise `align/` execution, AGE runtime | Loamwise planner (plan register + freeze), Guard wiring (observation), audit / replay |

## Hard rule — no cross-import

- `src/runtime/governance/memory/` **MUST NOT** import from `src/runtime/memory/`.
- `src/runtime/memory/` **MUST NOT** import from `src/runtime/governance/memory/`.

If a future caller needs both faces (e.g., "the observation gateway
should write records that the governance registry accepts"), that
adapter is a **third** module. Neither tree should be aware of the
other's internals.

CI layer-dependency enforcement tracks this alongside the Sprint-4
capability boundary and Sprint-5 skill-lifecycle boundary; add an entry
to `.github/workflows/layer-dependency-gate.yml` if violations appear
rather than carving exceptions.

## Sprint 6 scope

### Wave 6.1 — Memory frozen + strict_truth default

- `MemoryTier` enum (AUTHORITATIVE / DECISION_SUPPORT / CONTEXT_ONLY)
  with `tierRank()` and `canDeriveTo()` helpers.
- `MemoryRecord` schema with source/layer/trace/guard-evidence rules.
- `MemoryRecordRegistry` enforcing O3 derivation rule (no tier
  elevation), mandatory guard evidence, Layer-3 write rejection.
- `MemoryUsePolicyRegistry` enforcing §5 twin invariants:
  AUTHORITATIVE ⇒ decision_consumers non-empty; non-AUTH ⇒ empty;
  derivation_rule may not elevate tier.
- `MemoryAssemblyPlan` + `MemoryPlanRegistry` with explicit freeze()
  step. Once frozen, the plan object is deep-`Object.freeze`d — any
  later `register()` / `freeze()` call on the same id is rejected.
- `buildFrozenSnapshot()` produces a strict-truth-sorted immutable
  snapshot from assembled fragments.
- `validateRetrievalRequest()` rejects empty `tiers_allowed`,
  `providers_allowed`; rejects `balanced_recency` unless
  `purpose === 'audit'` (structural gate — full whitelist deferred to
  P1-e).
- `DEFAULT_QUERY_MODE = 'strict_truth'`.

### Wave 6.2 — Guard wired to memory write + assembly fragment ingest

- `guardedMemoryWrite()` runs the ShadowRunner (TRUTH_WRITE guard for
  AUTHORITATIVE records, CONTENT_SCAN otherwise), writes GuardEvidence,
  attaches the evidence ref to the record, and submits to
  MemoryRecordRegistry.
- `guardedAssemblyFragmentIngest()` runs the ShadowRunner
  (CONTEXT_INJECT guard), writes evidence, and only admits the
  fragment when the referenced plan is frozen + unexpired and the
  record ref is known.
- SHADOW mode only — the runner records but never blocks. Registry /
  plan admission is authoritative.

## What this sprint does NOT do

- It does **not** implement retrieval execution, provider registration,
  LLM summarization, federated query routing, smart routing, or any
  auto-merge / auto-rewrite. All execution lives in Layer 1.
- It does **not** persist records, plans, policies, or snapshots —
  in-memory registries are the Sprint-6 storage, and the persistent
  backing lands with the P1-e Session-adjacent integration.
- It does **not** wire Guard onto retrieval, query orchestration,
  provider `sync_turn`, or any path beyond the two listed above.
- It does **not** define the `balanced_recency` whitelist / trigger
  values — those are deferred to P1-e (only the structural gate lives
  here).
- It does **not** touch `src/runtime/memory/`. If bridging is ever
  required, write a new adapter module and a proposal ADR first.
