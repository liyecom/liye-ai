# Governed Work Loop — contract package

A declarative **task contract / runtime SLA** for repeated agent loops
(read context → act → verify → repeat) toward a verifiable stop condition.
This is the **v2** contract language + validator (v2 replaced v1 wholesale —
no runner, no per_run instance, no consumer existed to migrate). **No autonomous
runner is behind it yet** (`contract_status: schema_validated_only`) — pilots are
driven attended. v2 is the language a future runner will be held to: bounded stop,
drilled kill switch, post-hoc evidence package — the leash ships before the dog.

## Three layers (do not conflate)

| Layer | File | Role |
|-------|------|------|
| **schema** | `governed_work_loop_v2.schema.yaml` | draft-07; defines what a valid loop contract IS |
| **template** | `templates/*.template.yaml` | reusable per-loop-type fixed process (Skill-like asset) |
| **instance** | `state/runtime/loop/*` (per run) | one filled execution: `loop_id`, evidence refs/hashes, captured_at |

`instance_scope` distinguishes template vs per_run; the schema validates both.

## What the schema enforces (C1–C13, machine-checked in two layers, not advisory)

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
- **C9** (v2) every loop declares a `stop_condition`: a deterministic `success_check`
  (bound via `check_ref` — same doctrine as hard invariants) **and** a `max_iterations`
  hard cap. An unbounded loop is unrepresentable; hitting the cap is NEVER success
  (`on_max_iterations: stop_inconclusive_then_wrap_up` — HOLD, not PASS). Distinct
  from `budget`: budget bounds resources, stop_condition bounds the loop.
- **C10** (v2) a mutation loop ⇒ declares a `kill_switch` — an external halt lever
  (`env_gate` / `file_sentinel` / `registry_flag`) whose `location` lives outside the
  loop's own `scope_roots`. Polarity is locked to `enable_required` (key absent ⇒
  halt, mirroring the UGE dual-key posture); a press-to-stop polarity is
  unrepresentable. Halting never skips wrap-up.
- **C11** (v2) `kill_switch.tested: true` is a CLAIM ⇒ it must bind drill evidence
  (`test_evidence_ref` + `test_evidence_hash`); and `unattended_autonomous` ⇒ the
  kill switch must be **tested** (an undrilled kill switch on an unattended loop is
  decoration, not containment). tested:false is honest and valid — for attended loops.
- **C12** (v2) every loop declares an `evidence_package` (closed const content
  manifest: contract_snapshot / iteration_log / evidence_items / final_verdict /
  wrap_up + `package_ref`); a `per_run` instance ⇒ the package is hash-anchored
  (`package_hash` + `packaged_at`) and the run records its terminal
  `next_action_card.final_card`. This is the post-hoc attestation input a future
  runner is audited by — perimeter + contract + post-hoc audit, not per-step approval.
- **C13** (v2) a read-only loop (`no_mutation:true`) ⇒ its declared card enum may not
  contain `escalate_live_authorization` — no write authorization exists to escalate
  to; the affordance itself is the hazard.

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
- (v2) `next_action_card.final_card` must be a member of the loop's **own declared
  enum**, not just the global six-word vocabulary (which Layer A pins). A run cannot
  end on a card its contract never declared. Only Layer B can compare two
  instance-level arrays.

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
rejected by their target constraint (C1–C13 at Layer A, or a Layer-B derivation —
control-plane, mutation, or final_card vocabulary). The validator prints the violated
keyword/layer so each rejection is for the right reason. Exit 0 = all met expectation,
1 = fail-closed.

## Not in scope (v2)

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
expectation — C1–C13 at Layer A, or a Layer-B derivation. A green Contracts-Gate run
DOES exercise C1–C13. Local enforcement is unchanged: run the script directly.
