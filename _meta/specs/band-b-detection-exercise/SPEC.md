# C12 Band B Detection Exercise SPEC v0.1

> **Status:** `FIXTURE_ONLY` · `PARTIAL_R2_UNREACHABLE` · `LIVE_NOT_AUTHORIZED` · `LIVE_STREAK_UNTOUCHED`
>
> **Snapshot:** `origin/main@663a565272a456cadaba0d3586fda8c4e195b55b`
>
> **Authority:** C12 fixture-only operator flip, 2026-07-13
>
> **Scope:** controlled detection exercise for manifest-reality checks R1-R6. This SPEC does not authorize a live-equivalent exercise, ledger append, clock reset, manifest edit, launchd change, or Band B activation.

## 0. Consumer, SLA, and lifecycle

| Field | Contract |
|---|---|
| Named consumer | `Manifest Reality Clock Tests` CI and operator adversarial sampling of the R1-R6 detector |
| Consumption SLA | Run the clean control and all six injections on every change to the validator, v2 schema, bundled reality fixtures, C12 harness, clock runner/tests, or this SPEC; consume a passing run before any detection claim |
| Review triggers | validator/schema/fixture change; new manifest version; false positive/negative; live clock incident; proposal to touch the live path; any claim that detection is certified |
| Retirement condition | A superseding exercise covers every active reality check, preserves isolated-failure and exit-code assertions, and carries the same no-live boundary |
| Evidence owner | PR author records local evidence; CI supplies independent rerun; operator merge remains chosen manual |

## 1. Decision and current claim

The 2026-06-28 streak reset already proves that the clock's **discipline path**
is alive: a missed day was surfaced, no backfill was accepted, and the gate-open
date moved. It does not prove that R1-R6 detect their intended real drift.

C12 therefore tests only the detector semantics. Before C12, bundled reality
self-tests covered R1, R3, R4, and R6 but had no direct R2 injection. C12 finds
that R2 is currently unreachable through the production v2 schema: the validator
looks for optional `data_sources[].path`, while the schema does not declare that
property and sets `additionalProperties: false`. A real R2-shaped manifest exits
`2` at schema validation before R2 can fire. An isolated temporary schema copy is
used only to prove that the R2 check implementation itself turns red; that is not
an R2 production-route certification.

R5 is not exercised by changing `schema_version` because the v2 schema rejects
non-`2.0` values before the reality layer; R5 instead receives an isolated schema
`$id` routing drift, which is the production check's actual input.

A fixture PASS supports this bounded claim only:

> Against the pinned synthetic control, R1 and R3-R6 independently turn the
> validator red with exit code 1. R2's code path also turns red under an isolated
> schema extension, but the current production schema makes R2 unreachable and
> therefore leaves R2 uncertified.

It does **not** prove live launchd firing, live manifest coverage, production
tamper resistance, or real-world detection rate.

## 2. Isolation boundary

The exercise is valid only when all of these remain true:

- test source is the bundled `manifest_pilot1_proper` fixture and its paired
  synthetic repo;
- mutated manifests and the R2/R5 schema copies exist only under
  `TemporaryDirectory`;
- the production validator is invoked through `validate_one()` with JSON output;
- `manifest_reality_clock.py` is not imported or invoked;
- `--append` is never present;
- no AGE checkout, real engine manifest, live ledger, launchd job, log, or
  learning-source registry is read or written;
- the PR changes only this SPEC, the fixture harness, and its CI wiring;
- no test performs repair, backfill, auto-fix, capability promotion, or
  activation.

Any breach makes the exercise `ABORTED`; a red result obtained through a schema
failure (`exit 2`) or multiple simultaneous reality failures is not a valid
detector hit.

## 3. Injection matrix

| Check | Controlled drift | Expected result |
|---|---|---|
| R1 | one playbook entrypoint points to an absent synthetic file | exit `1`; only `R1_playbook_entrypoints=FAIL` |
| R2a | one data source gains an absent synthetic path under the current v2 schema | exit `2`; `SCHEMA_FAIL`, proving R2 is unreachable |
| R2b | the same path plus a temporary schema copy that permits `path` | exit `1`; only `R2_data_source_paths=FAIL`; implementation proof only |
| R3 | one capability references an undefined synthetic runtime gate | exit `1`; only `R3_capability_gate_refs=FAIL` |
| R4 | a non-Pilot fixture declares `limited` but makes effective capability `full` | exit `1`; only `R4_effective_within_declared=FAIL` |
| R5 | a temporary copy of the v2 schema receives a drifted `$id` | exit `1`; only `R5_schema_version_routing=FAIL` |
| R6 | the Pilot-1 fixture makes declared/effective capability `limited` | exit `1`; only `R6_pilot1_invariant=FAIL` |

The clean control must exit `0`, report `overall=PASS`, and show all six checks
PASS before any injected result is accepted.

## 4. Deterministic pass criteria

C12 fixture semantics are `PARTIAL` unless R2 becomes reachable through the
production schema. The bounded exercise is internally valid only if:

1. clean control is schema-valid and passes R1-R6;
2. R1 and R3-R6 drifted inputs remain schema-valid;
3. the production-schema R2 injection returns exit `2` and identifies `path` as
   an unexpected property;
4. the temporary-schema R2 implementation probe returns exit `1` and fails only
   `R2_data_source_paths`;
5. each R1 and R3-R6 injection returns exit `1` and fails exactly its intended
   check;
6. stdout is valid structured JSON and stderr is empty;
7. test files write only under temporary directories;
8. the repository diff contains no ledger, clock runner, validator, schema,
   launchd, AGE path, or production-manifest change;
9. local and CI runs both pass.

If any item fails, the verdict is `FAIL` and remediation stays in a separate PR.
C12 must not relax a check or widen the production schema to make the exercise
green. A later R2 contract repair requires its own consumer-backed decision.

## 5. CI binding

`.github/workflows/manifest-reality-clock-tests.yml` remains the named consumer
and is expanded to:

- trigger on validator, v2 schema, bundled fixture, C12 harness, clock, and SPEC
  changes;
- install only the validator's existing Python dependencies;
- run the existing bundled self-test;
- run the C12 R1-R6 controlled-injection harness;
- run the existing clock continuity suite.

This is active CI detection. It is not called a required merge gate or Q6
machine-certified enforcement unless branch rules, tamper evidence, and an
end-to-end firing record separately prove those properties.

## 6. Time gate for any later live-equivalent exercise

No live-equivalent experiment may occur before Band B gate-open on or after
`2026-07-28`, and none is implied by merging C12. A later attempt requires a new
operator packet naming the exact manifest copy strategy, blast radius, UTC
window, abort owner, live-clock protection, and receipt. The default remains:

- no real manifest mutation;
- no live ledger append;
- no clock reset;
- no early-window exception.

## 7. Rollback

Revert the SPEC, harness, and CI wiring together. The live clock requires no
rollback because C12 never touches it. Preserve failed CI/exercise evidence; do
not rewrite a failed injection as `NOT_RUN`.
