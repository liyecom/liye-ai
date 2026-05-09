# BGHS Skill Lifecycle — Boundary Notes

**Location**: `src/runtime/governance/skill_lifecycle/`
**ADR**: `_meta/adr/ADR-Hermes-Skill-Lifecycle.md` (P1-b)
**Sprint**: 5

## One-line boundary

> `src/skill/`                                  = **skill execution face**
> `src/runtime/governance/skill_lifecycle/`      = **BGHS skill lifecycle state machine**
> The two are **not** interchangeable and **must not** cross-import.

## Why the split exists

"Skill" in LiYe Systems straddles two very different concerns, and
conflating them is exactly the Hermes shortcut ADR-Hermes-Skill-Lifecycle
§R1 rejects ("scan pass ≠ trust").

| Aspect | `src/skill/` | `src/runtime/governance/skill_lifecycle/` |
|---|---|---|
| What "skill" means | An executable artifact: loader, atomic / composite unit, registry entry the dispatcher can invoke | A governance record: state machine entry that tracks a candidate's journey through quarantine, promotion decisions, and revocation |
| Primary interface | loader + atomic/composite runtime (pre-existing) | `SkillLifecycleRegistry` + `TransitionLog` + guard-wired `guardedSubmitCandidate` |
| Who touches state | Dispatcher, skill runtime | PromotionDecision / QuarantineDecision drivers + lifecycle log writes |
| Data model | Skill manifest, loader outputs, execution inputs | `SkillCandidateRecord`, `LifecycleTransition`, `PromotionDecision`, `QuarantineDecision` |
| Failure mode | Runtime error on load / invoke | Admission rejected (`MISSING_PROVENANCE`, `UNKNOWN_CAPABILITY_KIND`, `ILLEGAL_TRANSITION`, `SCAN_EVIDENCE_NOT_SAFE`, …) |
| Consumed by | Dispatcher / agent runtime | Loamwise `construct/` promotion scheduler, Guard wiring, operator audit UIs |

## Hard rule — no cross-import

- `src/runtime/governance/skill_lifecycle/` **MUST NOT** import from `src/skill/`.
- `src/skill/` **MUST NOT** import from `src/runtime/governance/skill_lifecycle/`.

The lifecycle registry is the **governance state** for a skill's journey
— it does not load, validate, or execute skill code. The execution face
is the **runtime behavior** for an already-promoted skill — it does not
produce or consume lifecycle state.

If future work needs to bridge the two (e.g., "the dispatcher should
refuse to load anything not currently in `ACTIVE`"), that bridge lives
in a **third** module whose purpose is to translate between lifecycle
state and dispatcher admission — not in either tree.

CI enforcement for this rule lives alongside the Sprint-4 capability
boundary gate in `.github/workflows/layer-dependency-gate.yml`; extend
that file when violations appear rather than carving exceptions.

## Sprint 5 scope

### Wave 5.1 — Lifecycle governance surface

- `SkillLifecycleState` enum and `ALLOWED_TRANSITIONS` whitelist.
- `TransitionLog` with append-only hash chain (per-candidate chain of
  `entry_hash = sha256(prev_transition_id || canonical(payload))`).
- `SkillLifecycleRegistry` that enforces L1–L7 structural discipline:
  L1 controlled transitions + append-only, L2 initial state = CANDIDATE,
  L3 approver + signature required, L4 scan evidence must contain
  `'safe'` for promotion-class transitions, L6 provenance fields
  mandatory, L7 `capability_kind` must be in the BGHS
  `CapabilityKindRegistry`.
- `PromotionDecision` / `QuarantineDecision` treated as co-equal
  drivers (L1) — any `LifecycleTransition` must carry one.

### Wave 5.2 — Guard wired to skill candidate submit

- `guardedSubmitCandidate(record, opts)` runs the Sprint-3
  `ShadowRunner` against the candidate payload, writes `GuardEvidence`
  to the sink, appends the resulting reference to `record.scan_results`,
  and then calls `SkillLifecycleRegistry.submitCandidate`.
- SHADOW mode only. The runner records but never blocks; registry
  acceptance is authoritative.
- Only this single real path is wired: **skill candidate submit**. No
  hook on skill install / enable / promote / invoke.

## What this sprint does NOT do

- It does **not** enforce policy-specific thresholds (required approver
  counts per TrustSource, grace-period seconds). §3 of the ADR calls
  those NON-NORMATIVE; a later policy ADR will put them in schema.
- It does **not** persist the lifecycle log — the in-memory
  `TransitionLog` is authoritative for Sprint 5, and the persistent
  session-adjacent storage lands with Sprint 6 / P1-e integration.
- It does **not** implement the Loamwise quarantine scheduler, the
  review UI, or the dispatcher admission check. Those are Layer 1
  responsibilities.
- It does **not** wire Guard into memory write, assembly fragment
  ingest, promotion, or any other protected path beyond
  `skill.candidate-submit`. Those wirings land in Sprint 6.2 and later.
- It does **not** touch `src/skill/`. If you find yourself about to
  add an import across the boundary, stop and write a bridging module
  proposal in `_meta/adr/` first.
