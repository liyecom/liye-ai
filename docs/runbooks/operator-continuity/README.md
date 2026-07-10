# Operator Continuity Dual-Certification Runbook v0.1

> **Status:** `DESIGN_ONLY`; C8 exercise **NOT RUN**; all continuity and no-AI certifications remain **NOT_CERTIFIED**.
> **SSOT:** `docs/runbooks/operator-continuity/README.md`
> **Last updated:** 2026-07-11 UTC
> **Authority:** `_meta/portfolio/TEAM_DEV_MODEL.md` and `docs/cowork/ICONEXPERT_ONBOARDING.md`
> **Scope:** one bounded, isolated exercise that combines operator no-AI legibility with no-owner hands-off continuity. This document is a procedure, not an execution authorization.

## 0. Consumer, SLA, and lifecycle

| Field | Contract |
|---|---|
| Named consumer | C8 operator-authorized dual-certification exercise; later incident/recovery and operator-envelope renewal reviews may consume its latest receipt |
| Consumption SLA | Read and bind this runbook to an immutable commit **before** the C8 exercise envelope is opened; after any review trigger below, re-review before the next exercise or continuity claim |
| First exercise target window | After C7 merges and only after a separate operator flip; target completion by **2026-08-09T23:59:59Z**. The date is a scheduling target, not authorization |
| Review triggers | load-bearing boundary changes; operator envelope actor/scope changes; recovery incident; gate/kill-switch bypass; credential-boundary change; missed target window; any proposed hands-off or no-AI claim |
| Retirement condition | none while write gate, credential boundary, kill switch, or disaster recovery remains load-bearing; a superseding runbook must preserve prior receipts and point here |
| Receipt owner | Exercise authority authors or explicitly assigns the separate C8 redacted receipt PR; failure and abort records are never deleted, only superseded |

Missing the target window does not create permission to run late. It leaves C8 overdue and every related certification `NOT_CERTIFIED` until a new operator-approved window is recorded.

## 1. What this runbook does—and does not do

This runbook defines one ceremony with two timed passes over the same sealed fixture packet:

1. **Pass A — owner no-AI:** the sovereignty-root operator locates, explains, operates, and recovers the four load-bearing boundaries without model assistance.
2. **Pass B — restricted-operator hands-off:** a second human operator repeats the bounded recovery path without owner guidance, delegation, or scope expansion. The no-AI rule remains active, so the same ceremony also tests whether the artifacts are independently legible.

The four load-bearing boundaries are deliberately small:

- write gate;
- credential boundary;
- kill switch;
- disaster-recovery path.

This runbook does **not**:

- authorize C8, open a mutation envelope, distribute a credential, change a GitHub role, or modify a control plane;
- run against a real customer cell, production database, live endpoint, launchd job, deployment, or external notification path;
- permit SP-API, Ads, listing, storefront, billing, DNS, package, or cross-account mutation;
- certify 30 days of continuity, the whole portfolio, memory recovery, or customer-cell isolation;
- certify the unexpected-incapacity dead-man/escrow wind-down path; C8 models a planned owner blackout only;
- promote a Human-Dn/D0-D3 label, expand an operator envelope, retire adversarial sampling, or prove a machine gate merely because code/config exists;
- treat a successful C7 document PR as exercise evidence. Only a later C8 receipt can record an exercise outcome.

## 2. Truth states and claim vocabulary

Use only these states:

| State | Meaning |
|---|---|
| `NOT_RUN` | the pass has not started |
| `BLOCKED` | an entry gate was missing; no timed pass began |
| `PASS` | every required criterion for that bounded pass was met within the pre-registered budget |
| `FAIL` | the pass ran but a criterion failed or owner/model help was used |
| `ABORTED` | a kill criterion fired; this is preserved as a failed certification attempt, not rewritten as `NOT_RUN` |
| `NOT_CERTIFIED` | no valid claim exists for that dimension |

Never use `partial pass`, `substantially covered`, or `works in principle`. A boundary may be individually observed, but the pass is `PASS` only when all required criteria are satisfied.

Three enforcement labels remain independent of the exercise verdict:

| Enforcement label | Required evidence |
|---|---|
| `machine_certified` | fail-closed behavior + tamper resistance/mandatory trace + real block or controlled injection firing record |
| `trust_detection` | written rule and review/receipt trail, but actor can technically bypass or the gate lacks one of the three proofs |
| `unknown` | current enforcement or evidence is not established |

The no-AI and no-owner constraints are `trust_detection` unless C8 separately proves a stronger mechanism. Observer attestations do not become machine enforcement.

## 3. Roles and authority

| Role | May do | Must not do |
|---|---|---|
| Exercise authority | define/open/close the C8 test envelope; pre-register scope, UTC window, budgets, actors, and abort owner | execute outside the test envelope; expand scope after start; convert the run into production authority |
| Pass A actor | execute the sealed fixture procedure without AI; explain failure modes; perform fixture recovery | consult a model during the timed window; alter the packet or pass criteria |
| Pass B actor | operate only inside a valid restricted-operator + test envelope; execute/review/ack/recover the fixture | contact owner for guidance; define/expand an envelope; modify doctrine/control-plane; re-delegate to a person or agent |
| Observer / adversarial sampler | record UTC anchors; verify no-AI/no-owner rules; invoke safety abort; test the machine gates as pre-registered | coach either actor, supply a missing command, silently repair evidence, or turn an abort into a pass |

Pass A actor and Pass B actor must be different humans. A solo simulation cannot certify hands-off continuity. During Pass B, the owner may remain available only as the safety abort authority; any operational hint or command from the owner makes Pass B `FAIL`. A safety abort is still mandatory when risk appears and is recorded `ABORTED`, not treated as assistance.

This does not require a third human: the Pass B actor may observe Pass A, and the owner may observe Pass B under the blackout rule. The active observer must be named before each pass and may not switch roles mid-pass.

## 4. C8 entry gates

C8 must stop as `BLOCKED` before any timed pass unless every item is sealed in a reviewable packet:

### 4.1 Authorization packet

- [ ] Separate operator flip explicitly names C8; C7 merge is not that flip.
- [ ] Test-envelope ID, actor, scope, UTC `valid_from`/`valid_through`, abort owner, and revocation path are present.
- [ ] Pass B actor has an unexpired restricted-operator envelope; the test envelope does not widen it.
- [ ] `mutation_authority: fixture_only`; all real customer/production cells are explicitly excluded.
- [ ] No delegation or re-delegation is allowed.

### 4.2 Target binding packet

Pin one target and one immutable commit. For each boundary, record a real artifact reference and an exact fixture-safe command/procedure:

| Boundary | Required binding before start |
|---|---|
| Write gate | artifact path + denied fixture action + expected exit/result + readback source |
| Credential boundary | broker/credential seam + synthetic/absent credential probe + expected denial + proof no production value is present |
| Kill switch | artifact path + fixture-safe activate/check/deactivate procedure + denial readback |
| Disaster recovery | sealed fixture baseline + restore procedure + before/after SHA-256 equality check |

`UNKNOWN`, a placeholder, a prose-only claim, an unpinned default branch, or a command that can reach production blocks C8. The packet must also declare each boundary's current enforcement label; `machine_certified` requires all three Q6 proofs in the receipt.

Before the boundary table, classify the target's real continuity posture:

| Continuity class | Meaning |
|---|---|
| `auto_safe_freeze` | absence causes a safe stop; no continuity action is required |
| `rot_under_absence` | delay creates reversible degradation or obligation buildup |
| `irreversible_loss` | absence can cause unrecoverable state, customer, credential, or asset loss |

The primary C8 target must be `rot_under_absence` or `irreversible_loss`; `auto_safe_freeze` may be a negative control but cannot by itself justify a second-operator exercise. Any persistent automation in scope must also declare exactly one unattended behavior: `self_retire`, `safe_continue`, or `external_alert`. A non-persistent target records `not_applicable` with evidence. Missing classification or behavior is a C8 entry blocker; the exercise may not invent it after the clock starts.

### 4.3 Isolation packet

- [ ] Fixture root is a fresh isolated worktree or scratch directory with no symlink/hardlink to live state.
- [ ] Sealed baseline and expected SHA-256 values are recorded before either actor sees the task card.
- [ ] Environment contains no production credential; synthetic values cannot authenticate anywhere.
- [ ] Network mutation is disabled. Read-only network observation, if essential, is separately enumerated and cannot reach a write endpoint.
- [ ] No concurrent writer/session can mutate the fixture or evidence.
- [ ] All commands use fixture-relative paths; raw private absolute paths are excluded from the public receipt.
- [ ] Restore and cleanup act only inside the test root.

### 4.4 Time and evidence packet

- [ ] All timestamps use complete ISO 8601 UTC values ending in `Z`.
- [ ] Pass A and Pass B each have a positive pre-registered minute budget; their sum is at most the **240-minute** combined ceremony ceiling.
- [ ] Budgets are frozen before the first timed anchor and may not be extended after start.
- [ ] UTC clock capture, command transcript, exit status, SHA-256, and readback capture are available without AI.
- [ ] Receipt template in §10 is copied before start with status `NOT_RUN`.

Useful deterministic capture commands:

```bash
date -u '+%Y-%m-%dT%H:%M:%SZ'
git rev-parse HEAD
shasum -a 256 <fixture-artifact>
```

These commands collect evidence only. They do not choose a target, open an envelope, or authorize a mutation.

## 5. No-AI and hands-off protocol

The timed window begins when the observer records `started_at_utc` and ends at `ended_at_utc` or the first abort anchor.

During both passes:

- ChatGPT, Claude, Codex, local/remote LLMs, AI search summaries, model-generated commands, and agent delegation are prohibited.
- Only the sealed runbook packet, versioned target documentation, deterministic local tools, and predeclared fixture artifacts may be used.
- The actor must not open a prior solution transcript or ask another person for an operational answer.
- Model assistance may be used **after** the raw receipt is sealed to analyze remediation; it may not rewrite timings, commands, failures, or the original verdict.

During Pass B additionally:

- owner communication is blacked out except for an observer-issued safety abort;
- any owner hint, hidden command, credential reveal, scope change, or repair makes the pass `FAIL`;
- the restricted operator may choose `safe freeze` or invoke the declared abort path without owner help; stopping safely is preferable to guessing.

## 6. Shared preflight

The observer performs these steps once; both actors receive the same immutable task card and a freshly reset copy of the same fixture:

1. Record runbook commit, target commit, test-envelope hash, fixture baseline hashes, and all actor/enforcement labels.
2. Prove the test root is isolated and contains no production credential or live-state link.
3. Record the expected deny/readback for write gate, credential boundary, and kill switch without revealing the recovery solution.
4. Seal the recovery baseline and expected post-restore hash.
5. Record `PASS_A_STARTED_AT_UTC`; activate the no-AI protocol.
6. Pass B may begin only if Pass A is `PASS`. Otherwise seal the joint non-pass receipt and leave Pass B `NOT_RUN`.
7. After a Pass A `PASS`, preserve its raw evidence, reset from the original sealed baseline, and verify byte equality.
8. Record `PASS_B_STARTED_AT_UTC`; activate owner blackout and the same no-AI protocol.

If reset-to-baseline equality fails, Pass B must not begin. Record the ceremony `ABORTED` and preserve the mismatch.

## 7. Timed pass procedure

Each actor must complete the same four probes in order. Before running a probe, the actor states where the boundary lives, what failure it prevents, how it fails closed, and what evidence would disprove the claim.

### Probe 1 — Write gate

1. Locate the pinned write-gate artifact and kill/deny entrypoint from the packet.
2. Attempt only the predeclared forbidden **fixture** mutation.
3. Capture exit/result, denial reason, unchanged-state hash, and readback.
4. Any mutation, warning-only result, or missing readback is `FAIL`.

### Probe 2 — Credential boundary

1. Locate the credential seam and describe the consequence of missing, over-broad, or leaked scope.
2. Run the predeclared synthetic/absent-credential probe.
3. Capture denial, absence of a production value, and unchanged fixture state.
4. Discovery of a real credential, authenticated external call, or plaintext secret is an immediate `ABORTED` condition.

### Probe 3 — Kill switch

1. Locate the pinned kill switch and state its blast radius and failure mode.
2. Activate it only in the fixture/test envelope.
3. Re-run the predeclared fixture mutation and prove fail-closed denial.
4. Read back switch state and denial evidence; then restore the fixture switch to its sealed baseline state.
5. A switch that is warning-only, writable by the governed actor without mandatory trace, or unable to block is not `machine_certified`; a failed block makes the pass `FAIL`.

### Probe 4 — Disaster recovery

1. Locate the recovery path without AI or owner hints.
2. Apply only the predeclared corruption/deletion to the disposable fixture copy.
3. Restore from the sealed baseline using the versioned runbook artifacts.
4. Prove restored hash equals expected hash and run the declared functional readback.
5. Record elapsed time, manual ambiguity, missing prerequisite, and every undocumented step.

The pass ends only after the actor verifies all fixture state is back at baseline or invokes safe freeze. Cleanup occurs after evidence sealing, never before.

## 8. Kill criteria and abort behavior

Any one of the following immediately stops the ceremony:

- real customer identifier, production credential, live endpoint, or live-state link appears;
- a command can mutate outside the sealed test root or the target path cannot be proven;
- any external mutation or unexpected network call occurs;
- owner guidance is used in Pass B or any actor uses AI during a timed window;
- an expired/revoked envelope, scope expansion, credential widening, or re-delegation would be required;
- a concurrent writer/session is discovered;
- write gate or kill switch permits the forbidden fixture mutation;
- pre-pass or post-recovery hashes do not match the sealed baseline;
- receipt clock/evidence capture fails, evidence is edited after sealing, or a required readback is unavailable;
- a pass-specific pre-registered budget or the 240-minute combined ceiling is reached.

Abort sequence:

1. stop issuing commands;
2. invoke the predeclared fixture-only abort/freeze path;
3. record the first abort UTC anchor and reason;
4. hash and preserve raw evidence before cleanup;
5. close/revoke the test envelope;
6. mark affected pass and joint verdict `ABORTED`;
7. open remediation separately; any retry uses a new exercise ID and new receipt.

Never repair the evidence, extend the clock, widen scope, or repeat a failed probe under the same receipt.

## 9. Pass criteria and bounded verdict

### 9.1 Pass A — Q10 no-AI legibility

`PASS` requires all of the following:

- owner locates all four boundaries from versioned artifacts without AI;
- owner explains each failure mode and blast radius before execution;
- all three denial probes fail closed and the recovery probe returns to byte-equal baseline;
- all commands, readbacks, timestamps, and ambiguities are captured within the pre-registered Pass A budget;
- no hidden AI/person assistance or scope expansion occurs.

### 9.2 Pass B — Q7 bounded hands-off continuity

`PASS` requires all of the following:

- restricted operator acts inside valid existing envelopes without redefining or expanding them;
- restricted operator completes the same locate/explain/deny/recover sequence without owner guidance or AI;
- review/ack/recovery evidence identifies the actor and preserves no-redelegation;
- the fixture ends at byte-equal baseline or the predeclared safe state;
- all commands, readbacks, timestamps, and ambiguities are captured within the pre-registered Pass B budget.

### 9.3 Joint verdict

The joint C8 verdict is `PASS` only if both passes are `PASS` and the combined ceiling is met. Otherwise it is `FAIL`, `ABORTED`, or `BLOCKED` according to the first non-pass state.

A joint `PASS` certifies only:

- Q10: the four declared load-bearing boundaries were legible and recoverable without AI in this pinned fixture/commit;
- Q7: this restricted operator completed this bounded hands-off fixture exercise without owner help.

It does **not** certify:

- 30 continuous days of operation;
- all portfolio systems, production recovery, customer-cell isolation, or memory disaster recovery;
- future commits or changed gates;
- Q6 machine equivalence for any boundary whose three proofs are incomplete;
- permission expansion, operator-envelope renewal, maturity promotion, or ceremony retirement.

## 10. C8 receipt format

C8 copies this block into a separate receipt, fills it from raw evidence, redacts it, and opens an independent PR. Fields may be extended only before the timed window; required fields may not be deleted.

```yaml
receipt_version: operator_continuity_dual_cert.v0.1
exercise_id: "C8-<UTC_DATE>-<opaque_suffix>"
status: NOT_RUN  # NOT_RUN | BLOCKED | PASS | FAIL | ABORTED

authority:
  operator_flip_ref: "<redacted decision reference>"
  test_envelope_id: "<opaque id>"
  envelope_sha256: "<sha256>"
  valid_from_utc: "<YYYY-MM-DDTHH:MM:SSZ>"
  valid_through_utc: "<YYYY-MM-DDTHH:MM:SSZ>"
  mutation_authority: fixture_only

binding:
  runbook_commit: "<full git sha>"
  target_commit: "<full git sha>"
  isolated_scope: "<redacted logical fixture id>"
  continuity_class: null  # auto_safe_freeze | rot_under_absence | irreversible_loss
  continuity_class_evidence_ref: null
  unattended_behavior: null  # self_retire | safe_continue | external_alert | not_applicable
  unattended_behavior_evidence_ref: null
  baseline_sha256: "<sha256>"
  no_live_state_links: false
  no_production_credentials: false
  network_mutation_disabled: false

actors:
  exercise_authority: "<role; public receipt may pseudonymize>"
  pass_a_actor: "<role>"
  pass_b_actor: "<role>"
  pass_a_observer: "<role>"
  pass_b_observer: "<role>"
  pass_a_no_ai_attested: false
  pass_b_no_ai_attested: false
  pass_b_no_owner_assistance_attested: false
  no_redelegation_attested: false

timing:
  pass_a_started_at_utc: null
  pass_a_ended_at_utc: null
  pass_a_elapsed_minutes: null
  pass_b_started_at_utc: null
  pass_b_ended_at_utc: null
  pass_b_elapsed_minutes: null
  combined_elapsed_minutes: null
  pass_a_budget_minutes: null
  pass_b_budget_minutes: null
  combined_budget_minutes: 240

boundaries:
  write_gate:
    artifact_ref: "<safe logical ref or public repo-relative ref>"
    enforcement: unknown  # machine_certified | trust_detection | unknown
    fail_closed_evidence_ref: null
    tamper_trace_evidence_ref: null
    firing_evidence_ref: null
    readback_ref: null
  credential_boundary:
    artifact_ref: "<safe logical ref or public repo-relative ref>"
    enforcement: unknown
    fail_closed_evidence_ref: null
    tamper_trace_evidence_ref: null
    firing_evidence_ref: null
    readback_ref: null
  kill_switch:
    artifact_ref: "<safe logical ref or public repo-relative ref>"
    enforcement: unknown
    fail_closed_evidence_ref: null
    tamper_trace_evidence_ref: null
    firing_evidence_ref: null
    readback_ref: null
  disaster_recovery:
    artifact_ref: "<safe logical ref or public repo-relative ref>"
    enforcement: unknown
    baseline_sha256: null
    restored_sha256: null
    functional_readback_ref: null

passes:
  owner_no_ai:
    status: NOT_RUN
    failure_mode_explanations_ref: null
    transcript_sha256: null
    failures: []
  restricted_operator_hands_off:
    status: NOT_RUN
    failure_mode_explanations_ref: null
    transcript_sha256: null
    failures: []

abort:
  fired: false
  fired_at_utc: null
  criterion: null
  safe_state_readback_ref: null

readback:
  final_fixture_sha256: null
  baseline_restored: false
  test_envelope_closed: false
  raw_evidence_sha256: null

coverage:
  q10_no_ai_legibility: NOT_CERTIFIED
  q7_bounded_hands_off: NOT_CERTIFIED
  q6_machine_equivalence: NOT_CERTIFIED
  thirty_day_continuity: NOT_CERTIFIED
  production_recovery: NOT_CERTIFIED
  memory_recovery: NOT_CERTIFIED
  customer_cell_isolation: NOT_CERTIFIED

uncovered_items: []
remediation_refs: []
supersedes_receipt: null
```

The template uses unsafe defaults (`false`, `null`, `NOT_RUN`, `NOT_CERTIFIED`). C8 must derive the final verdict from evidence; it must not pre-fill passing values.

## 11. Evidence and privacy rules

Raw evidence may remain operator-private. The public C8 receipt must contain only structural facts and opaque references:

- no credential value or reversible fingerprint;
- no client/customer/store/product identifier;
- no private repository owner/URL;
- no private absolute path, private filename pointer, host identity, account ID, endpoint, or production topology;
- no raw command output containing any of the above;
- SHA-256 references are allowed only when the hashed artifact's existence is safe to disclose.

The public receipt must still preserve provenance: immutable commits, logical fixture ID, UTC anchors, outcome, enforcement labels, evidence hashes, readbacks, failures, uncovered items, and remediation references.

## 12. Closeout and re-certification

After the joint ceremony ends or aborts:

1. seal raw evidence before cleanup;
2. restore or freeze the fixture and verify final hash;
3. close/revoke the test envelope and record readback;
4. preserve every failure/abort and create remediation separately;
5. publish the redacted C8 receipt in an independent PR;
6. leave all broader certifications `NOT_CERTIFIED` unless their exact evidence was collected;
7. do not alter operator authority, production gates, or ceremony count as a side effect.

If elapsed time or ambiguity causes failure, remediation defaults to shrinking/merging the load-bearing boundary and improving the same artifact set. “Train the operator harder” or adding another control-plane type is not the default fix.

Re-certification is event-triggered, not a standing monitor. Re-run before making a new claim when any review trigger in §0 fires. A changed implementation behind the same filename is still a change; pin commits and evidence, not paths alone.
