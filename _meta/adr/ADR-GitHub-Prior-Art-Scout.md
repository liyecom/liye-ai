---
artifact_scope: meta
artifact_name: GitHub-Prior-Art-Scout
artifact_role: contract
target_layer: 0
is_bghs_doctrine: no
---

# ADR — GitHub Prior-Art Scout（github-scout, Phase 0）

**Status**: Accepted
**Date**: 2026-06-26
**Accepted-Date**: 2026-06-26
**Phase**: 0
**Decision Makers**: LiYe
**SSOT**: `_meta/adr/ADR-GitHub-Prior-Art-Scout.md`

> Meta Declaration per ADR-Architecture-Doctrine-BGHS-Separation.md §3 is the YAML
> frontmatter above (`artifact_role: contract` pins machine-enforceable invariants;
> `is_bghs_doctrine: no` — this authorizes a tool, it is not itself BGHS doctrine).

---

## 1. Context

When a new capability idea appears in LiYe Systems, we want to check **prior art on
GitHub** before building — to decide whether to reference-only, clean-room
reimplement, route to human review, or skip — *without* tripping any of the
governance rails (Fork 纪律, clean-room, license isolation, harvest-ADR ceremony).

There was no governed connector for this. `gh` exists locally and the ambient
keyring token carries the `repo` (write) scope, so any naïve "just call the API"
approach risks (a) leaking write capability and (b) reading copyleft source before a
license decision. This ADR authorizes a **read-only, advisory** scout and pins the
invariants that keep it safe.

This is the **blocking-first authorizing credential** for Phase 0: it is merged
before the implementation is considered governed.

## 2. Decision

Build **github-scout** as a three-layer capability:

| Layer | Location | Role |
|-------|----------|------|
| **L1 Methodology** | `docs/methodology/01_Research_Intelligence/github-scout/` | knowledge + the `license_policy.yaml` machine-readable SSOT |
| **Hands tool** | `tools/github-scout/scout.py` (+ `declaration.yaml`) | read-only CLI that *consumes* L1 and calls the GitHub API |
| **L3 Instruction** | `.claude/skills/github-scout.md` | flat advisory doc constraining how Claude invokes it |

The L1 and L3 placements live **inside** the frozen Skill three-layer constitution
(`docs/architecture/SKILL_CONSTITUTION.md` §1). The Hands tool sits **outside** that
spine (see §4). Phase 0 ships the `report` subcommand only.

## 3. Model-independent invariants (enforced by scout.py + test_scout.py)

1. **I1 — zero external mutating side-effect.** No fork / clone / vendor / PR /
   network write. Only local, gitignored `traces/` are written.
2. **I2 — read-only by construction.** Default sends **no** `Authorization` header
   (unauthenticated public read). A token is attached only when explicitly supplied
   **and** asserted via the `X-OAuth-Scopes` response header. Phase 0 requires a
   **NO-SCOPE** token: any classic scope at all (including read-only `read:org`) ⇒
   fail-closed; a fine-grained "Public repositories (read-only)" token reports empty
   scopes and passes (its fine-grained permissions are not exposed via this header and
   rely on the operator provisioning it read-only). **No live write probe is ever
   issued** (an expected-403 write probe would itself be a write request).
3. **I3 — sequential inspect state machine.** Per candidate: fetch the authoritative
   license **first** → resolve tier → fetch README/tree **only if** the tier's
   inspect ceiling permits. A missing LICENSE file (HTTP 404) ⇒ `confidence=no_license`;
   any other fetch failure (5xx / timeout / NOASSERTION / "other") ⇒
   `confidence=fetch_failed`. **Both** resolve to `tier=unknown` ⇒ metadata only.
4. **License policy is an L1 SSOT, not code.** The mapping *license tier → inspect
   ceiling → allowed recommendation* is defined once in
   `docs/methodology/01_Research_Intelligence/github-scout/license_policy.yaml` and
   loaded at runtime. scout.py **must not** hardcode tiers or ceilings
   (SKILL_CONSTITUTION §3, no reverse dependency). `test_scout.py` loads the live
   SSOT and fails on any drift.
5. **Fail-closed default.** Unresolved / unrecognized / fetch-failed license ⇒
   `unknown` ⇒ metadata only ⇒ recommendation `skip`. Source is never inspected
   under an unresolved license.

## 4. Why the Hands tool is OUTSIDE the Skill three-layer spine

`SKILL_CONSTITUTION.md` §2 freezes the authority chain
`docs/methodology (L1) → src/skill (L2) → .claude/skills (L3)`. scout.py is **not**
an L2 Executable Skill (nothing dispatches it at runtime; it is a "runs-and-exits"
CLI). It is **BGHS-Hands infrastructure**, justified by the **Project** constitution
`docs/CONSTITUTION.md §2.1` ("Reusable infra tooling") and the existing `tools/`
house style (e.g. `notion-sync`, `trace_guard.sh`, none of which live in `src/skill/`).

> **Honest correction (recorded for the audit trail):** an earlier draft mis-cited
> "SKILL_CONSTITUTION §2.1" as authorizing `tools/` and inserted scout.py into the
> frozen §2 chain. That phrase is in the *Project* constitution, not the Skill
> constitution, which has no §2.1/tools/Hands clause. scout.py is therefore framed
> as a downstream **consumer** of the L1 SSOT, **not** a node in the frozen chain.

Adding leaf entries under existing `docs/methodology/.../`, `tools/`, and
`.claude/skills/` directories does **not** violate
`ADR-Architecture-Doctrine-BGHS-Separation.md §5` (which forbids creating
concern-named directories `brain/governance/hands/session` and a BGHS runtime layer).

## 5. Credentials (ADR-Credential-Mediation P1-f)

- `declaration.yaml` declares both the Doctrine single-URI `credential_path:
  cred://liye-os/github-scout-readonly` (retained) and the P1-f `credential_bindings[]`
  (purpose / broker_required / optional).
- Phase 0 runs **unauthenticated**. The read-only token is **optional**, supplied via
  env, used only for rate-limit headroom, and asserted read-only (I2). scout.py never
  reads the token value into code or logs beyond the passive scope assertion. Full
  `EnvCredentialBroker` wiring is deferred to Phase 1 (`future_split_direction`).

## 6. Scope

**In (Phase 0):** this ADR; the L1 `skill_definition.md` + `license_policy.yaml` +
`README` (with `methods.md`/`evolution_log.md` stubbed); `scout.py` (`report` only) +
`declaration.yaml` + tests; the flat L3 `github-scout.md`; manual validation on real
ideas producing traces.

**Out (Phase 1+):** `ghbudget` bucketed budget; **transitive** license scan;
`emit-reference` + tracked draft (manual promote); richer eval; `derive`/`search`/
`inspect` subcommands; a typed JSON schema (no `validate-contracts.mjs` validator is
added in Phase 0 — the gate stays byte-unchanged at **Passed: 21**); promotion to an
L2 `src/skill/` only if a runtime needs to dispatch scouting; an
`Extensions/mcp-servers/` server only if a non-Claude consumer requires it.

## 7. Notes on related decisions (recorded, not load-bearing)

- **L3 discoverability is honest.** `.claude/skills/github-scout.md` is a flat,
  manually-loaded advisory doc (like `liye-agent.md`). The skill registry
  (`.claude/skills/index.yaml`) sweeps `Skills/` (capital, `sfc_sweep`) only, so this
  file is a deliberate registry-orphan, **not** auto-discovered. Making it
  discoverable (the official `skill-creator` → `Skills/` SFC package) is intentionally
  **not** done here — that is a separate, heavier packaging decision.
- The recommendation taxonomy has 4 leaves (`reference-only` / `reimplement` /
  `needs-human-review` / `skip`); `vendor`/`fork-as-dependency` survive only as a
  `needs-human-review` sub-reason, satisfying Fork 纪律.

## 8. Consequences

Prior-art recon becomes a one-command, fail-closed, advisory step that respects every
governance rail. The cost is that github-scout is conservative by design (it routes
permissive matches to human review rather than auto-recommending reuse) and, in Phase
0, is rate-limited (unauthenticated) and does not scan transitive licenses.
