# Governed Work Loop — contract package

A declarative **task contract / runtime SLA** for repeated agent loops
(read context → act → verify → repeat) toward a verifiable stop condition.
This is the v1 contract language + validator. **No autonomous runner is behind it
yet** (`contract_status: schema_validated_only`) — pilots are driven attended.

## Three layers (do not conflate)

| Layer | File | Role |
|-------|------|------|
| **schema** | `governed_work_loop_v1.schema.yaml` | draft-07; defines what a valid loop contract IS |
| **template** | `templates/*.template.yaml` | reusable per-loop-type fixed process (Skill-like asset) |
| **instance** | `state/runtime/loop/*` (per run) | one filled execution: `loop_id`, evidence refs/hashes, captured_at |

`instance_scope` distinguishes template vs per_run; the schema validates both.

## What the schema enforces (C1–C8, machine-checked in two layers, not advisory)

**Layer A** — ajv structural / cross-field `if`-`then`:

- **C1** any BLOCKING hard invariant ⇒ checker grades **deterministically** (BGHS: a
  Governance invariant is never model-judged). Each hard invariant must also bind a
  concrete `check_ref` — otherwise `check_method` is a label with nothing behind it.
- **C2** a mutation loop (`no_mutation:false`) ⇒ `on_checker_error: fail_closed`
  (a checker error is never read as PASS; read-only loops may `emit_hold_inconclusive`
  = `VerdictDecision.HOLD/INSUFFICIENT_EVIDENCE`).
- **C3** a mutation loop ⇒ declares `idempotency.replay_safe: true`.
- **C4** touching the control plane (`control_plane_touch:true`) ⇒
  `control_plane_mutation: proposes_only` (propose candidate changes, never self-apply).
- **C5** a `none`/`mock_proven` runner ⇒ `attended` only.
- **C6** `unattended_autonomous` ⇒ an `internal_beta`+ runner that BINDS the full
  attestation bundle: `attestation_ref` + `attested_hash` + `dedupe_key` + `lock_ref`.
- **C7** `runner_enforced` ⇒ a hash-anchored attestation (`attestation_ref` +
  `attested_hash`) **and** a runner that exists (`runner_readiness.level` ∈
  `internal_beta` / `production_ready`) — you cannot "enforce" with a `level:none` runner.
- **C8** a `per_run` instance ⇒ every authoritative evidence item carries the trust
  anchor `artifact_ref` + `sha256_hash` + `captured_at`. Templates may omit these — no
  run has happened yet, so a placeholder hash would be a fake (and a fake is a smell).

**Layer B** — semantic guard ajv cannot express (validator script):

- `control_plane_touch` is **derived** from `scope_roots` (any `*.schema.yaml`, or a path
  segment under `_meta` / `contracts` / `policies` / `rubrics`) and cross-checked against
  the declared flag. A self-reported `false` over a control-plane scope is **rejected** —
  the flag that gates C4 cannot be quietly under-reported. Over-reporting (`true` while
  derived `false`) is allowed: that is the fail-closed direction.
- `no_mutation` is checked against `allowed_actions` by a **deny-by-default read-only
  allowlist** (`read_file` / `grep` / `run_tests` / `emit_candidate_diff` /
  `emit_review_card`). A `no_mutation:true` loop may draw ONLY from this governed
  vocabulary; **any** other action counts as a mutation and the self-reported
  `no_mutation:true` is **rejected** — otherwise a mutation loop disguises itself as
  read-only and dodges C2/C3. (A mutating-verb *blacklist* was tried first and leaks
  forever — `edit_file` / `modify_bid` / `set_budget` / `execute_request` are writes no
  finite stem list catches.) Over-restricting is the safe direction: a genuine read-only
  action not yet listed is either added to the allowlist (a deliberate, reviewed schema
  change) or the loop declares `no_mutation:false`. A richer structured-action model
  (`{id, mutation_class}`) that lets the class itself drive C2/C3 is a deferred follow-up.

## Design invariants baked in

- Authoritative evidence is **artifact_ref + sha256** (mirrors
  `learning/fact_run_outcome_event_v1`), **enforced on every per_run evidence item (C8)** —
  not just documented. The transcript `<EVIDENCE>` envelope is **display-only**, never the
  stop-gate fact source. `captured_at` is metadata, not a trust anchor.
- `next_action_card` is a **view** over existing loamwise `TaskStatus` / `NextStep` /
  `VerdictDecision`, locked via a `const` map — no 4th lifecycle FSM.
- maker ≠ checker is declared as `checker.independence_level`
  (`deterministic > different_model > fresh_context_same_model > human_review`);
  the checker may not read the maker's reasoning trace.

## Validate (TDD red/green)

```
node _meta/contracts/scripts/validate-governed-work-loop.mjs
```

Templates and `valid_*` fixtures MUST pass **both layers**; `invalid_*` fixtures MUST be
rejected by their target constraint (C1–C8 at Layer A, or a Layer-B derivation —
control-plane or mutation). The validator prints the violated keyword/layer so each
rejection is for the right reason. Exit 0 = all met expectation, 1 = fail-closed.

## Not in scope (v1)

- Not unifying with `governance/co_exploration_loop.schema.yaml` (different enforcement
  class: that one is advisory human-AI exploration; this one is enforcing task work).
- Not declaring loamwise Layer 1 a unified autonomous loop runner — WriteEngine is a
  single-TaskRun orchestrator ("Not a scheduler. Not a worker. Not an autonomous loop.")
  with mock dispatchers (beta-readiness). Runner is a later, attested build.
- Not registering the loop schema in `validate-contracts.mjs` `schemaFiles[]` — the loop
  contract stays one of the dedicated-validator contracts in the 21-schema gate count
  (enum-only carve-out), because its expect-table semantics (`invalid_*` fixtures MUST be
  rejected) don't fit the generic validator's pass-only model.

## CI wiring (since contracts-gate step "Run Governed Work Loop Validator")

This validator runs as a dedicated fail-closed step in
`.github/workflows/contracts-gate.yml`: any PR touching `_meta/contracts/**` (or the
workflow itself) fails the Contracts Gate if a template/fixture stops meeting its
expectation — C1–C8 at Layer A, or a Layer-B derivation. A green Contracts-Gate run
now DOES exercise C1–C8. Local enforcement is unchanged: run the script directly.
