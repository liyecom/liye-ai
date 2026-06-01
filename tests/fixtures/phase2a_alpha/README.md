# Phase 2a-α test fixtures

Committed fixtures for `tests/test_phase2a_alpha.mjs` (SPEC `.planning/phase-2a/SPEC.md`
v1.0, blob `e74f205f`, §4). Most matrix cases build synthetic inputs inline in a tmp
root; these committed files are the deterministic golden anchors + the CI path-trigger
surface (`tests/fixtures/phase2a_alpha/**`).

| File | Purpose |
|------|---------|
| `metrics_pass_7day.jsonl` | 7 consecutive clean STREAK-contrib UTC days (2026-06-02..2026-06-08). With `--asof 2026-06-08 --window 7 --source amazon-growth-engine` the exit-gate verdict is **PASS** (exit 0). Each row carries only the fields the checker reads (`date_utc` + `phase_1_exit_signals`), a strict subset of the sealed `metrics_daily_v1` row the 1e producer emits. |
| `live_state_trialing.json` | Operator-flipped trialing heartbeat live state (3-key partial: `version=2 ∧ current_phase=trialing ∧ trial_write_enabled=true`). Passes the evaluator `--mode live` authorization二次门. |
| `live_state_evaluating.json` | Default idle posture (`trial_write_enabled=false`, `current_phase=evaluating_metrics_only`). Denied by the二次门 → `not_authorized_for_live` (ship≠activation). |

The metrics rows are intentionally minimal (checker contract = read `date_utc` +
`phase_1_exit_signals` only; it never validates the full 1e schema). Do NOT add a
schema-mutating field here — Phase 2a-α is 0-schema-crack.
