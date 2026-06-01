# GHL Runbook (Governed Heuristic Learning) — Operator Manual

> **Status: v1.0 GA** — Phase 1 字母链 (1a–1e) all landed (2026-05-31); operational procedures live.
> Phase 2+ (promotion / candidate write / execute_limited) remain gated downstream.
> This file is the operator manual: mental model + reproducible commands + the landed contracts.

**SSOT**: `_meta/docs/GHL-RUNBOOK.md`
**Phase**: 1e (Phase 1 字母链收官) per `.planning/phase-1e/SPEC.md`
**Normative**: ADR-Governed-Heuristic-Learning.md (accepted 2026-05-19, commit 67e6fea)

**Out-of-scope for v1.0** (gated downstream):
- Phase 2 (evaluating_metrics_only → trialing flip / 30-day D-11 gate / candidate write) — gated on Phase 1 exit-criteria review
- Phase 3 + 4 (promotion / execute_limited / loamwise SkillReviewQueue coordination) — gated downstream

---

## 1. System Overview & Mental Model

**GHL = 复活 + 串联 + 限名 + 守门** of the existing liye_os v0.1 learning pipeline.
GHL does **not** rebuild a new learning platform.

**Pilot 1 scope (time-bounded ≥ 90 days from baseline anchor 2026-05-09):**
- Clock anchor: baseline `497919d` commit date 2026-05-09 (NOT ADR Accept 2026-05-19)
- 90-day mark: 2026-08-07 (= 2026-05-09 + 90 days)
- Operational review target: 2026-08-09 (90-day mark + 2-day buffer)
- Negative learning only — system identifies unsafe reuse; operator validates
- No production_write
- No execute_limited tier

**8 Hard Gates (per ADR §Hard Gates):**
1. No new Trust system
2. No new Lifecycle FSM
3. No new Candidate type
4. Layer-2 (AGE) does not directly write Layer-0 (liye_os)
5. Any接入 source must pass manifest reality validator
6. fact ingest must double-hash idempotent (event_identity_key + event_content_hash)
7. heartbeat first start must be dry_run (trial_write_enabled=false)
8. No production_write, no execute_limited during Pilot 1

**Layered architecture:**
- Layer 0: liye_os (this repo) — fact records / governance events / policy persistence
- Layer 1: loamwise — CARGE pipeline / Task Ledger / governance gating
- Layer 2: AGE / chaming — domain engines (emit facts via D-14 form A)
- Layer 3: silkbay / storefronts / kits / themes / growth-hub — product lines

**Reference docs:**
- `_meta/portfolio/SYSTEMS.md` — system-level SSOT
- `_meta/adr/ADR-Governed-Heuristic-Learning.md` — accepted decision record
- `_meta/contracts/learning/GHL-glossary.md` — terminology SSOT
- `.planning/baseline/GHL-evolution-plan-v4.1.md` (N-1)
- `.planning/baseline/GHL-v4.1-errata.md` (N-2)
- `.planning/baseline/GHL-v4.1-errata-v2.md` (N-3)

**Smoke — verify the contract surface routes correctly** (confirms the mental model above is wired):
```bash
node _meta/contracts/scripts/validate-contracts.mjs --self-test
# Expected: Pass: 7, Fail: 0  +  "Self-test passed."
```

---

## 2. Daily Operations

**Heartbeat runner** (per N-1 §7.3):
- State file: `state/runtime/learning/heartbeat_learning_state.json` (v2 SSOT; the legacy `state/runtime/proactive/` v1 file is dormant since 2026-02-14 and MUST NOT be read)
- Schema: `_meta/contracts/learning/heartbeat_state_v2.schema.yaml` (v2, 16 required fields, 9-phase enum)
- Per Hard Gate 7: first start MUST be `dry_run` (trial_write_enabled=false)
- 9 phases: paused / paused_no_active_source / ingesting_only / evaluating_metrics_only / trialing / candidate_writing_sandbox / candidate_writing / promoting / executing_limited

**Current operational state (as of skeleton commit):**
- No heartbeat runner scheduled yet
- No fact ingest happening (AGE `emit_fact.py` is Phase 1a, gated on Sprint 9 readout)
- 9 contract schemas SSOT'd in `_meta/contracts/learning/` (Wave 1 Tranches 1-3)
- Registries SSOT'd at `.claude/config/{learning_sources,golden_packs}.yaml` (Wave 2a)
- Validator enforces dual-routing v1/v2 + 9-schema self-check (Wave 2b)

**Daily health check command (Phase 0 baseline):**
```bash
node _meta/contracts/scripts/validate-contracts.mjs
# Expected: exit 0, 19 pass / 0 warn / 0 err
```

**Self-test of dual-routing logic:**
```bash
node _meta/contracts/scripts/validate-contracts.mjs --self-test
# Expected: 7/7 fixtures pass
```

**TBD (Phase 1d when heartbeat lands):**
- runner invocation command + schedule
- log inspection (date-sharded UTC paths per EV2-I-01)
- phase-transition guard checks

### 2.1 Daily Metrics Roll-Up (Phase 1e)

`metrics_daily_producer.mjs` is a standalone, manual, **read-only** downstream aggregator.
It reads the 6 frozen 1b/1c/1d on-disk outputs, buckets by **UTC calendar day**, and appends
one `metrics_daily_v1` row to `state/runtime/learning/metrics_daily.jsonl` (append-only,
gitignored at `.gitignore:330`). It does **not** compute the Phase-1 exit gate verdict, the
7-day PASS streak, or any promotion action — those are Phase 2a.

```bash
# Produce yesterday's roll-up (default --date = last complete UTC day). Dry-run first:
node .claude/scripts/learning/metrics_daily_producer.mjs --dry-run --json
# Expected during the Pilot-1 bind=0 window (AGE enabled:false): exit 0,
#   "action":"appended", counts all 0, inputs_present all false (graceful-empty).
```

- Default `--date` = yesterday; the current (un-elapsed) UTC day needs `--allow-incomplete`.
- Idempotent: a same-input rerun is `skipped_same_hash`; a changed input fail-closes
  `kind=divergence` unless `--regenerate` (append-only, latest-wins per date).
- `metric_record_hash` is a pure function of the 6 on-disk inputs (snapshot/wall-clock
  excluded), so re-running a closed day never spuriously diverges.
- Drop `--dry-run` to persist. Fail-closed kinds (exit 2):
  `incomplete_day → input_unreadable → divergence → output_schema`.

---

### 2.2 Phase 2a Activation Playbook (`dry_run → trialing` flip)

> **Phase 2a-α flip-readiness.** Merging the 2a-α code does **NOT** activate trialing
> (`ship ≠ activation`): after merge the live state still has `trial_write_enabled=false`
> (or is absent), so `policy_trial_evaluator --mode live` fails closed
> (`not_authorized_for_live`, exit 2, **0 trial written**). The ceiling relax only *permits*
> `trial_write=true`; it never *triggers* it. Activation is the **operator-driven** sequence
> below — never automatic, never performed by the runner or evaluator.

**Earliest activation date** (gate is data-driven; the date below is planning guidance only):

```
earliest_activation_date = max(2026-06-07, age_0d_flip_date + 7d) + 1d
  age_0d_flip_date  operator flips learning_sources.yaml AGE enabled:true
                    (.claude/config/learning_sources.yaml; an independent 0-day task,
                     OUTSIDE 2a-α code, an external BLOCKING dependency — with no AGE
                     emit the exit-gate stays INDETERMINATE forever). This is an
                     operator-supplied planning input, NOT a value any gate reads.
      → +7d         AGE emits + manifest PASS streak accrues (the streak clock starts
                    only once AGE actually emits)
      → +1d         phase_1_exit_gate_check verdict == PASS verification
```

`2026-06-07` is the floor (assumes AGE emits from today's Day-0; today 2026-05-31 is the
1e merge Day-0 and `metrics_daily.jsonl` does not yet exist). The **only** machine gate is
`phase_1_exit_gate_check --json` returning `verdict==PASS`, which intrinsically requires 7
real AGE-emit days. The operator records `age_0d_flip_date` in the activation PR / log.

**Activation steps** (all commands are dry-run-safe to rehearse; the flip is a manual
state edit, step 4):

```bash
# 1) Bootstrap the live state if absent (1d existing mechanism; lands evaluating_metrics_only,
#    trial_write_enabled=false). Skip if state/runtime/learning/heartbeat_learning_state.json exists.
LIYE_HEARTBEAT_BOOTSTRAP_CONFIRM=1 node .claude/scripts/learning/heartbeat_runner.mjs
# Expected: current_phase=evaluating_metrics_only, trial_write_enabled=false.

# 2) Exit-gate check (read-only; default --asof=yesterday, --window=7, --source=amazon-growth-engine).
node .claude/scripts/learning/phase_1_exit_gate_check.mjs --json
# Expected PASS (exit 0) only once AGE has 7 consecutive clean manifest-PASS UTC days
#   (earliest 2026-06-07). BLOCKED (exit 2) = an explicit-failure day, needs a fix first.
#   INDETERMINATE (exit 2) = data insufficient / AGE not yet emitting — wait, do NOT flip.

# 3) Operator confirm: human review of the verdict evidence + golden replay reproduction +
#    negative-evidence hit-rate (the three plan-L150 observations). Proceed only if PASS.

# 4) FLIP (the single activation action; operator hand-edits the live state):
#    edit state/runtime/learning/heartbeat_learning_state.json -> "trial_write_enabled": true
#    (evaluator_enabled is already true), then re-run the heartbeat to derive trialing:
node .claude/scripts/learning/heartbeat_runner.mjs
# Expected: current_phase=trialing, a phase-transition appended with reason=operator.

# 5) Live evaluator (now authorized by the二次门):
node src/reasoning/policy_trial_evaluator.mjs --mode live
# Expected: live_authorized passes, writes policy_trials.jsonl (existing :489 path),
#   verdicts stay NEEDS_HUMAN. Before the flip this exits 2 (not_authorized_for_live, 0 write).

# 6) ROLLBACK (safety-symmetric inverse; operator hand-edits back):
#    edit heartbeat_learning_state.json -> "trial_write_enabled": false, then re-run:
node .claude/scripts/learning/heartbeat_runner.mjs
# Expected: current_phase=evaluating_metrics_only, transition reason=operator_rollback.
```

7. **Observation window 7–14 days** (plan L150): trial verdict distribution / golden replay
   reproduction / negative-evidence hit-rate. The `2a → 2b` transition predicate (whether the
   observation window passed) is **Phase 2a-β** — this playbook only marks "evaluate for 2b
   after the window elapses".

**Invariants preserved:** zero candidate / promotion / production write (Hard Gate 8);
verdict stays NEEDS_HUMAN; no scheduler; `production_write_enabled` Pilot-1-wide locked.
The `learning_sources.yaml` AGE-enable flip and §5 Promotion/Demotion stay independent /
GATED-until-2c respectively (unchanged here).

---

## 3. Fact Ingest & Source Hygiene

**Learning Sources Registry**: `.claude/config/learning_sources.yaml`
- Single declared source (Pilot 1): `amazon-growth-engine`
- `enabled: false` until Sprint 9 readout + Phase 1a
- Required fields per N-2 I-01: `allowed_branches` + `expected_manifest_hash`

**Per Hard Gate 5** — any接入 source must pass `validate_manifest_reality.py`:
- Phase 0c.4 (gated on Sprint 9 readout)
- Verifies actual deployed engine_manifest hash matches `expected_manifest_hash` in registry
- Mismatch → source flagged dirty; emit_fact pipeline rejects writes from that source

**Per D-14** — AGE → liye_os fact flow is form A (AGE explicitly emits via `emit_fact.py`):
- Script: `amazon-growth-engine/scripts/learning/emit_fact.py` (Phase 1a, gated)
- Date-sharded UTC log: `amazon-growth-engine/out/facts/<UTC_DATE>/fact_run_outcome_events.jsonl`
- Event sidecar: `amazon-growth-engine/out/facts/<UTC_DATE>/<event_identity_key>.json` (per EV2-I-01)
- liye_os imports facts → `state/memory/facts/fact_run_outcome_records.jsonl` (v4.1 canonical record)

**Duplicate conflict handling** (per D-13 + EV2-B-05):
- Importer-level duplicate (no policy_id) → `state/runtime/learning/fact_conflicts/<source>/<event_identity_key>/` only
- Policy-bound duplicate → fact_conflicts/ + emits policy_trial with verdict=NEEDS_HUMAN, reason_codes=[duplicate_conflict]

**TBD (Phase 0c.4 + Phase 1a when emit_fact lands):**
- `validate_manifest_reality.py` invocation
- Fact ingest troubleshooting flowchart
- `fact_conflicts/` inspection procedure

**Inspect fact-ingest aggregation (reproducible committed fixture; no live state touched):**
```bash
node .claude/scripts/learning/metrics_daily_producer.mjs \
  --fixtures tests/fixtures/metrics_daily --date 2026-01-01 --dry-run --json
# Expected: exit 0, "action":"appended", counts.fact_records_total=2
#   fact_conflicts_total=1 fact_rejects_total=2. Records bucket on emitted_at;
#   conflicts/rejects bucket on detected_at (import wall-clock, per-import-day).
```

---

## 4. Policy Lifecycle Review

**Policy storage** (per N-1 §7.6 — physical segregation by lifecycle status):
- `state/memory/learned/policies/sandbox/` — initial crystallized candidates
- `state/memory/learned/policies/candidate/` — promoted from sandbox after evaluator pass
- `state/memory/learned/policies/production/` — execute_limited tier (Pilot 1: empty)
- `state/memory/learned/policies/disabled/` — explicit operator disable
- `state/memory/learned/policies/quarantine/` — flagged unsafe; requires `quarantine_reason`

**Policy schemas:**
- Legacy v1: `_meta/contracts/learning/learned_policy.schema.yaml`
- GHL v1: `_meta/contracts/learning/learned_policy_ghl_v1.schema.yaml`
- Both validate the same physical files; dispatch by `$schema_id` field or path convention (see Phase 0c.2 routing notes in validator)

**GHL profile extension fields (per learned_policy_ghl_v1):**
- `confidence_basis` (required): operator_agreement_rate / business_score / regression_pass_rate
- `last_evaluated_at`, `trial_history`, `lifecycle_version`, `quarantine_reason`, `tier_decision_inputs` (optional)
- `confidence` (number 0-1) is formula OUTPUT; `confidence_basis.*` are formula INPUTS

**Confidence formula** (per `_meta/contracts/learning/confidence_formulas.yaml`):
- `ghl_confidence_v1`: linear combination of 4 inputs with weights summing to 1.0
- 3 inputs from `$.confidence_basis.*` (canonical)
- 1 input `exec_success_rate` from `$.success_signals.exec.success_rate` (legacy path retained)
- `legacy_aliases.operator_agreement_rate_legacy: $.success_signals.operator.approval_rate` — backward-compat read; evaluator emits WARN on >5% divergence (30-day window)
- `missing_input_policy: fail_closed`
- `boundary_output_policy: requires_review` at 0.0 / 1.0

**Operator feedback** (per `operator_feedback_v1.schema.yaml`):
- `verdict`: AGREE_WITH_SYSTEM | DISAGREE_WITH_SYSTEM | NEEDS_MORE_EVIDENCE
- `reason_codes` (independent vocabulary from system_verdict_reason_codes — per N-2 B-05): unsafe_reuse / weak_evidence / business_context_changed / regression_failed / acceptable
- `reviewer_id_hash`: sha256 of operator identity (no PII)

**TBD (Phase 1c when policy_trial_evaluator lands):**
- How to read `state/runtime/learning/policy_trials.jsonl`
- How to attach `operator_feedback` to a trial
- D-11 metrics dashboard: operator_agreement_rate ≥ 0.7 (soft) + critical_false_negative_count = 0 (hard)
- D-12 negative evidence gate workflow

**Inspect policy-trial + D-11 observability** (via the producer — the evaluator has no fixture
seam; persist the fixture day into a scratch root, then read the row atoms):
```bash
ROOT=$(mktemp -d) && cp -R tests/fixtures/metrics_daily/. "$ROOT/"
node .claude/scripts/learning/metrics_daily_producer.mjs --fixtures "$ROOT" --date 2026-01-01 >/dev/null
python3 -c "import json; r=json.loads(open('$ROOT/state/runtime/learning/metrics_daily.jsonl').read().strip()); print('d11:', r['d11_kpis']); print('verdicts:', r['policy_trials_breakdown']['by_system_verdict'])"
rm -rf "$ROOT"
# Expected: d11 agreement_agree_count=1 agreement_eligible_count=2
#   operator_agreement_rate_today=0.5 critical_false_negative_count_today=1;
#   verdicts {PASS:0,FAIL:1,DOWNGRADED:0,NEEDS_HUMAN:1}.
# The 30-day rolling D-11 gate (rate>=0.7 soft / critical_false_negative=0 hard) is
# computed downstream in Phase 2a from these per-day atoms, NOT by the producer.
```

---

## 5. Policy Promotion / Demotion

**Promotion SSOT**: `.claude/config/execution_tiers.yaml`
- `execution_tiers.yaml` is the single owner of promotion eligibility decisions
- `learned_policy_ghl_v1` does NOT self-declare promotion eligibility
- `tier_decision_inputs` field on GHL policy is **audit trail only**, not a gate

**Pilot 1 ceiling** (per Hard Gate 8):
- No promotion to production_write
- No promotion to execute_limited tier
- Maximum tier reachable during Pilot 1: candidate_writing (after Phase 2c lands)

**Policy Lifecycle Events** (per `policy_lifecycle_event_v1.schema.yaml`, append-only):
- Storage: `state/runtime/learning/policy_lifecycle_events.jsonl`
- Transaction model: `transaction_id` groups events; `TXN_STARTED → [POLICY_FILE_UPDATED | FILE_MOVED | INDEX_UPDATED]* → (TXN_COMMITTED | TXN_ABORTED)`
- 8 action enum (per N-1 §7.7 + D-09)
- `intent` field required when `action=TXN_STARTED`: CREATE / PROMOTE / DEMOTE / QUARANTINE / RESTORE / EXPIRE / DISABLE
- `COMPENSATING_RESTORE` / `COMPENSATING_REVERT_MOVE` for aborted partial transactions

**TBD (Phase 2c+ — gated on Sprint 9 readout):**
- Step-by-step promotion procedure (sandbox → candidate)
- Step-by-step demotion procedure (candidate → disabled / quarantine)
- Reading `policy_lifecycle_events.jsonl` for transaction history
- Manual transaction approval gates

**Observability-only metrics rehearsal** (NOT a promotion/demotion action):
```bash
node .claude/scripts/learning/metrics_daily_producer.mjs --dry-run --json
# Expected: exit 0, a rehearsed daily roll-up report (write_mode "rehearse", 0 disk writes).
# WARNING: promotion/demotion remains GATED until Phase 2c. This command is
# observability-only — it shows the metrics that WOULD feed a future promotion review;
# it performs NO promotion, demotion, candidate, or production write (Hard Gate 8).
```

---

## 6. Quarantine & Incident Response

**Quarantine entry conditions** (per learned_policy_ghl_v1 + D-12):
- `validation_status: quarantine` AND `quarantine_reason` (required, ≤500 chars, no PII)
- Triggers: critical_false_negative observed / regression_failed verdict from operator / data safety unknown
- Physical move: `policies/{prior_status}/` → `policies/quarantine/`
- Audit chain via `policy_lifecycle_events.jsonl` with `intent: QUARANTINE`

**Kill switch (per Hard Gate 7 + heartbeat v2):**
- `kill_switch_required: true` in heartbeat state → runner refuses to start without kill-switch artifact
- Manual halt: set `enabled: false` in `heartbeat_learning_state.json`; runner derives `current_phase: paused`
- Per N-1 §7.3, 6 invalid feature flag combinations fail-closed at runner load (Phase 1d)

**Rollback discipline:**
- Legacy v0.1 schema instances remain valid (legacy `learned_policy.schema.yaml` not removed)
- GHL profile is an extension, not a replacement
- Mis-routed instances fail-closed in both directions via `additionalProperties: false` seal

**Aborting a partial transaction** (per D-09):
- `TXN_ABORTED` event MUST include `reason_code` + `compensating_actions` (list of event_ids being compensated)
- `COMPENSATING_RESTORE` writes pre-mutation hash back to file
- `COMPENSATING_REVERT_MOVE` reverses physical file movement
- Interrupted transactions (no TXN_COMMITTED, no TXN_ABORTED) → runner startup scans + emits `operator_alert` (does NOT auto-decide)

**TBD (Phase 1d+ — gated on Sprint 9 readout):**
- Incident response decision tree
- Quarantine review workflow
- Forensic procedure: replay events from `policy_lifecycle_events.jsonl`
- Coordination with loamwise SkillReviewQueue (Phase 3)

**Static contract reference** (incident/quarantine triage; no runtime state, no side effects):
```bash
head -40 _meta/contracts/learning/metrics_daily_v1.schema.yaml
# Expected: the sealed metrics_daily_v1 contract header + envelope field definitions.
# observability-only — reading a schema has no side effects.
```

---

## 7. Reference — Files, Commands, Schemas

### Contracts (SSOT)
| Artifact | Path |
|---|---|
| Glossary | `_meta/contracts/learning/GHL-glossary.md` |
| Learned policy (legacy v1) | `_meta/contracts/learning/learned_policy.schema.yaml` |
| Learned policy (GHL v1) | `_meta/contracts/learning/learned_policy_ghl_v1.schema.yaml` |
| Fact run outcome event v1 | `_meta/contracts/learning/fact_run_outcome_event_v1.schema.yaml` |
| Fact run outcome record v1 | `_meta/contracts/learning/fact_run_outcome_record_v1.schema.yaml` |
| Governance event v1 | `_meta/contracts/learning/governance_event_v1.schema.yaml` |
| Policy trial v1 | `_meta/contracts/learning/policy_trial_v1.schema.yaml` |
| Operator feedback v1 | `_meta/contracts/learning/operator_feedback_v1.schema.yaml` |
| Policy lifecycle event v1 | `_meta/contracts/learning/policy_lifecycle_event_v1.schema.yaml` |
| Heartbeat state v2 | `_meta/contracts/learning/heartbeat_state_v2.schema.yaml` |
| Heartbeat phase-transition v1 | `_meta/contracts/learning/heartbeat_phase_transition_v1.schema.yaml` |
| Metrics daily roll-up v1 | `_meta/contracts/learning/metrics_daily_v1.schema.yaml` |
| Confidence formulas | `_meta/contracts/learning/confidence_formulas.yaml` |
| Engine manifest v1 | `_meta/contracts/engine/engine_manifest.schema.yaml` |
| Engine manifest v2 | `_meta/contracts/engine/engine_manifest.schema.v2.yaml` |
| Execution tiers (promotion SSOT) | `.claude/config/execution_tiers.yaml` |

### Configuration
| Artifact | Path |
|---|---|
| Learning sources registry | `.claude/config/learning_sources.yaml` |
| Golden packs registry | `.claude/config/golden_packs.yaml` |

### Tools
| Tool | Command |
|---|---|
| Validate contracts (default) | `node _meta/contracts/scripts/validate-contracts.mjs` |
| Self-test routing logic | `node _meta/contracts/scripts/validate-contracts.mjs --self-test` |
| Validate learned-bundle.tgz | `node _meta/contracts/scripts/validate-contracts.mjs --bundle <path>` |

### Runtime paths
| Purpose | Path |
|---|---|
| Heartbeat state (runtime) | `state/runtime/learning/heartbeat_learning_state.json` |
| Phase-transition log | `state/runtime/learning/heartbeat_phase_transitions.jsonl` |
| Policy trials log | `state/runtime/learning/policy_trials.jsonl` |
| Lifecycle events log | `state/runtime/learning/policy_lifecycle_events.jsonl` |
| Fact conflicts | `state/runtime/learning/fact_conflicts/<source>/<event_identity_key>/` |
| Fact rejects | `state/runtime/learning/fact_rejects/<source_segment>/<raw_sha256>/` |
| Daily metrics roll-up | `state/runtime/learning/metrics_daily.jsonl` |
| Metrics late-arrivals | `state/runtime/learning/metrics_daily_late_arrivals.jsonl` |
| Policy storage (5 dirs) | `state/memory/learned/policies/{sandbox,candidate,production,disabled,quarantine}/` |
| Fact records (v4.1 canonical) | `state/memory/facts/fact_run_outcome_records.jsonl` |
| Fact records (legacy v0.1) | `state/memory/facts/fact_run_outcomes.jsonl` (frozen on Phase 1b) |
| Governance event records | `state/memory/governance/governance_event_records.jsonl` |

### Decision Records & Planning
| Document | Path |
|---|---|
| ADR (accepted 2026-05-19) | `_meta/adr/ADR-Governed-Heuristic-Learning.md` |
| Baseline v4.1 | `.planning/baseline/GHL-evolution-plan-v4.1.md` (N-1) |
| Errata v1 | `.planning/baseline/GHL-v4.1-errata.md` (N-2) |
| Errata v2 | `.planning/baseline/GHL-v4.1-errata-v2.md` (N-3) |

### Normative-Input Precedence
When N-1 / N-2 / N-3 conflict: **N-3 > N-2 > N-1** (per EV2-N-01).
14 Decision Logs (D-01 ~ D-14) + 15 Required Corrections + 8 Hard Gates are sealed; not reopened in skeleton or later runbook revisions.
