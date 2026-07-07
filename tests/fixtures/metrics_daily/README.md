# metrics_daily fixture tree (Phase 1e)

Committed synthetic root for `metrics_daily_producer.mjs --fixtures tests/fixtures/metrics_daily`.
Mirrors the real `rootDir` layout so the producer reads it exactly like production state.
Used by `tests/test_metrics_daily_producer.mjs` AND by the GHL-RUNBOOK §3/§4/§5 reproducible
commands (always with `--dry-run`, so the producer never writes back into this tree).

**Canonical aggregation day: `2026-01-01`** (a complete past UTC day).

## Inputs

| Source | File | Day-1 (2026-01-01) content |
|---|---|---|
| 1b records | `state/memory/facts/fact_run_outcome_records.jsonl` | 2 records (A clean/PASS/no_sensitive, B dirty/WARN/redacted); record C is `2026-01-02` (cross-day, excluded) |
| 1b conflicts | `state/runtime/learning/fact_conflicts/amazon-growth-engine/<hex>/conflict_meta.yaml` | 1 (detected_at 2026-01-01) |
| 1b rejects | `state/runtime/learning/fact_rejects/{amazon-growth-engine,unknown}/<sha>/reject_meta.yaml` | 2 (PATH_UNSAFE under amazon-growth-engine/, SCHEMA_INVALID under the literal `unknown/` segment) |
| 1c trials | `state/runtime/learning/policy_trials.jsonl` | 2 (NEEDS_HUMAN+AGREE on-time, FAIL+DISAGREE/regression_failed on-time) |
| 1d transitions | `state/runtime/learning/heartbeat_phase_transitions.jsonl` | 1 day-1 (`-> evaluating_metrics_only`); 1 prior-day entry (cross-day) |
| 1d live state | `state/runtime/learning/heartbeat_learning_state.json` | v2, current_phase `evaluating_metrics_only`, production_write_enabled false (Pilot-1) |

## Expected day-1 aggregation (asserted by the test suite)

- counts: records 2 · conflicts 1 · rejects 2 · trials 2 · transitions 1
- by_source_system: amazon-growth-engine 2 / user-growth-engine 0 · by_manifest_validator_status: PASS 1 / WARN 1 / FAIL 0
- by_redaction_status: redacted 1 / no_sensitive_fields_detected 1 · source_dirty 1/1 · provenance_dirty 1/1
- reject by_reason: PATH_UNSAFE 1 / SCHEMA_INVALID 1 · c4_path_unsafe_reject_count 1 · c2_duplicate_conflict_count 1
- c1 per_source amazon-growth-engine: pass 1 / warn 1 / fail 0; user-growth-engine: pass 0 / warn 0 / fail 0 (WARN is NOT a pass — strict PASS-only)
- policy_trials: NEEDS_HUMAN 1 / FAIL 1 · evidence production_observed 1 / golden_regression 1
- d11: agree 1 · eligible 2 · rate 0.5 · critical_false_negative_count_today 1 · with_operator_feedback_count 2
- c2_dedupe_hit_rate: `unobservable_from_disk` (structurally half-blind — silent-skip 0 on disk)
- heartbeat_snapshot: current_phase evaluating_metrics_only · production_write_enabled false

## Golden

`golden/2026-01-01.hash` pins the stable `metric_record_hash` (a pure function of date_utc +
the 6 on-disk inputs; excludes all snapshot/wall-clock fields). Editing any input above must
update this golden in the same commit.
