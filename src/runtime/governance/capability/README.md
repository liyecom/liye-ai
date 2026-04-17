# BGHS Capability Registry — Boundary Notes

**Location**: `src/runtime/governance/capability/`
**ADR**: `_meta/adr/ADR-OpenClaw-Capability-Boundary.md` (P1-a)
**Sprint**: 4

## One-line boundary

> `src/control/registry.ts` = **AI-agent capability registry**
> `src/runtime/governance/capability/` = **BGHS capability registry**
> The two are **not** interchangeable and **must not** cross-import.

## Why the split exists

LiYe OS has two registries that happen to share the word "capability".
They describe different things at different layers:

| Aspect | `src/control/` | `src/runtime/governance/capability/` |
|---|---|---|
| What "capability" means | An AI agent's skill/tool binding; a 7-field `CapabilityContract` (id, kind, name, domain, tags, side_effect, source_path) used by the orchestrator to pick which agent to call | A BGHS-layer action an engine/skill/guard offers, identified by a `CapabilityKind` like `engine.write.amazon-ads-bid`; governs admission, trust boundary, decision authority |
| Primary interface | `CapabilityRegistry` in `src/control/registry.ts` (`scanAgents`, `findByCapability`, trust scoring) | `CapabilityKindRegistry` + `CapabilityRegistry` + `DecisionAuthorityRegistry` in this directory |
| Who owns the identifier | The agent implementer (skill author picks the tag vocabulary) | Layer 0 (the ADR author) — kinds are admitted only via contract ADR + schema |
| Data model | `AgentCard` / `CapabilityContract` / `AgentCapabilityCandidate` / `TrustProfile` | `CapabilityKindRegistration` / `CapabilityRegistration` / `TrustBoundaryDecl` / `DecisionAuthority` |
| Ranking / matching | Jaccard tag similarity | None — registration is binary (accept/reject) |
| Failure mode | Ranking lands a weaker match | Registration is rejected (`UNKNOWN_KIND`, `DUPLICATE_ACTIVE`, `MISSING_TRUST_BOUNDARY`, …) |
| Consumed by | Orchestrator, task decomposer, router | Future decision plane, gateway method registration, guard chains, session-event ownership checks |

## Hard rule — no cross-import

- BGHS capability code **MUST NOT** import from `src/control/`.
- AI-agent registry code **MUST NOT** import from
  `src/runtime/governance/capability/`.

The two packages may both be referenced from higher-level code, but
they never reference each other. If future work needs to bridge the
two, that bridge lives in a **third** module whose purpose is to
translate between the identifier spaces — not in either registry tree.

CI enforcement for this rule lives in the existing layer-dependency
gate (`.github/workflows/layer-dependency-gate.yml`); add a rule there
when violations appear, do not carve exceptions in either tree.

## What this sprint provides

- `CapabilityKindRegistry` — Layer-0-only admission of new kinds;
  requires a `contract_adr` + `contract_schema` reference.
- `CapabilityRegistry` — Layer 1/2/3 components submit `CapabilityRegistration`
  entries; B1/B2/B4 validators enforce kind-exists / no-duplicate-active /
  trust_boundary-present (+ non-empty `egress_allowlist` when the capability
  declares network side effects).
- `DecisionAuthorityRegistry` — a narrow hook for decision-plane
  admission; `override_allowed` is a schema-locked `false`.

## What this sprint does NOT do

- It does **not** implement the decision plane itself (§3 runtime
  enforcement) — the registry stores declarations.
- It does **not** wire gateway method routing (§5 reserved-namespace
  enforcement lives in the Gateway sprint).
- It does **not** write registrations into a session event stream;
  that wiring arrives with the `StreamRegistry` + write-path integration.
- It does **not** touch `src/control/registry.ts`. If you feel the urge
  to unify the two, stop and write a proposal in `_meta/adr/` first.
