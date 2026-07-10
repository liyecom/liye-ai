# Governed Execution Contract v0

This package is the long-lived contract language for governed execution. It harvests
five semantics already exercised by Loamwise: approval, checkpoint-authoritative
resume, immutable receipt/readback, receipt-bound verdict, and rollback references
for reversible actions.

`contract_status: schema_validated_only` is an honesty boundary. The schema, template,
fixtures, validator, and CI gate exist; no runner is bound by this package yet. A valid
document does **not** imply that any execution engine, queue, scheduler, state broker,
or cross-domain runtime exists.

## Package layers

| Layer | Location | Meaning |
|---|---|---|
| schema | `governed_execution_v0.schema.yaml` | draft-07 shape and cross-field constraints |
| template | `templates/governed_execution.template.yaml` | fixed semantic profile, with no invented run evidence |
| per-run | an engine-owned evidence location | one execution identity, authority, resume source, receipt, and verdict |

The contract lives here; implementations remain inside each domain engine. A future
engine binding must cite this schema and provide per-run evidence. It does not inherit
authority merely by conforming.

## Machine-enforced invariants

The dedicated validator runs two layers:

- **Layer A (AJV):** closed objects; template/per-run separation; live execution must
  cite an existing envelope and either a pre-authorization artifact or an explicit
  approved decision; live execution must declare a called-party, enable-required brake
  and required readback; checkpoint resume must carry a complete hash-anchored snapshot;
  available rollback capability must carry `rollback_ref`; `HOLD` must carry a reason.
- **Layer B (semantic recomputation):** execution, receipt, and verdict identities must
  match; explicit approval request/decision IDs must match; receipt summary and aggregate
  readback are recomputed from entries; dry-run/live status vocabularies cannot mix; the
  verdict is derived conservatively from the receipt. A live `PASS` requires at least one
  success, no failure/partial/halt/simulation, and verified readback.

Negative fixtures carry an explicit expectation table in the validator. Each must fail
in its intended layer and with its intended marker; rejection for an unrelated defect is
not counted as a green test.

## Validate

```bash
node _meta/contracts/scripts/validate-governed-execution.mjs
```

The same command is a fail-closed step in `.github/workflows/contracts-gate.yml`.

## Deliberately absent from v0

- runner, worker, queue, scheduler, state broker, or mission broker;
- action payloads or a universal action taxonomy;
- a rollback executor (the contract records a reference, not an implementation);
- cell routing or cross-client mutation authority;
- D0-D3 promotion logic or a D2 rewrite;
- `EXPAND` verdict semantics (declared in older code, but not emitted by the verified
  Loamwise verdict builder).

Schema evolution is demand-pulled by a real engine binding or execution case. The
contract is not a warrant for speculative runtime or compatibility work.
