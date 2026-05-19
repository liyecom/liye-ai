# GHL Runbook (Governed Heuristic Learning) — Operator Manual

> **Status: Phase 0e Skeleton** — Sections present; content gated.
> Substantive operational procedures land per phase: Phase 1a–1e gated on Sprint 9 readout.
> Until then, this file documents the **structure** plus the **already-landed contracts** so operators have a map.

**SSOT**: `_meta/docs/GHL-RUNBOOK.md`
**Phase**: 0e (Checkpoint B1) per ADR §0e
**Normative**: ADR-Governed-Heuristic-Learning.md (accepted 2026-05-19, commit 67e6fea)

**Out-of-scope for this skeleton** (filled in later phases):
- 0c.3 AGE manifest v2 migration — gated on Sprint 9 readout
- 0c.4 `validate_manifest_reality.py` — gated on Sprint 9 readout
- 1a `emit_fact.py` runbook — gated on Sprint 9 readout (D-14)
- 1b–1e crystallizer / evaluator / heartbeat v2 procedures — gated on Sprint 9 readout
- Phase 2 + 3 + 4 (promotion / candidate write / execute_limited) — gated downstream

---

## 1. System Overview & Mental Model

**GHL = 复活 + 串联 + 限名 + 守门** of the existing liye_os v0.1 learning pipeline.
GHL does **not** rebuild a new learning platform.

**Pilot 1 scope (time-bounded ≥ 90 days from ADR Accept):**
- Negative learning only — system identifies unsafe reuse; operator validates
- No production_write
- No execute_limited tier
- Operational review target: 2026-08-09 (precise 90-day = 2026-08-07 + 2-day buffer)

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

---

## 2. Daily Operations

**Heartbeat runner** (per N-1 §7.3):
- State file: `state/runtime/proactive/heartbeat_learning_state.json`
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
# Expected: exit 0, 17 pass / 0 warn / 0 err
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
| Heartbeat state (runtime) | `state/runtime/proactive/heartbeat_learning_state.json` |
| Policy trials log | `state/runtime/learning/policy_trials.jsonl` |
| Lifecycle events log | `state/runtime/learning/policy_lifecycle_events.jsonl` |
| Fact conflicts | `state/runtime/learning/fact_conflicts/<source>/<event_identity_key>/` |
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
