# AGE Wake/Resume — C6 Acceptance Runbook

**Sprint**: 1 (AGE recovery closure)
**Wave**: 1.3 (3-store `--diff` gate)
**ADR**: `_meta/adr/ADR-AGE-Wake-Resume.md` §11 C6
**Run date**: 2026-04-17
**Runner**: Claude (liye_os session) + AGE `scripts/onboarding/replay_state.py`
**Git refs at run time**
- liye_os: `b8013c0` (feat(wake): add WakeResumeRegistry…)
- amazon-growth-engine: `5dc8e8c` on `feat/parent-attributed-advisory`
  (main tip: `8215a5e`)

---

## Command invoked (per store)

```bash
cd /Users/liye/github/amazon-growth-engine
python3 -m scripts.onboarding.replay_state <STORE_ID>
```

No `--apply`, no `--from-scratch`. Dry-run only. Follows Sprint 1 hard
discipline #3: **do not auto-heal `SNAPSHOT_DIVERGED`**.

---

## Results

| # | Store | Verdict | Total events | Notes |
|---|---|---|---|---|
| 1 | `STR-E438213024` | ✅ **IN SYNC** | 12 | xmeden — ops_mode=READ_ONLY; last_transition 2026-04-09T14:00:00Z |
| 2 | `STR-8105E71CE4` | ✅ **IN SYNC** | 10 | ops_mode=READ_ONLY; last_transition 2026-04-10T00:00:00Z |
| 3 | `STR-358D075EFC` | ⚠️ **DIVERGED** | 6 | `last_verified_at` mismatch — see below |

### STR-358D075EFC divergence detail

```
- last_verified_at: '2026-04-09T00:00:00Z'     (state.yaml — current)
+ last_verified_at: '2026-03-11T00:00:00Z'     (replay from jsonl)
```

All other fields match. State otherwise identical:
- `store_status`: OPERATIONAL
- `provider_status.ads`: VERIFIED
- `provider_status.spapi`: VERIFIED
- `ops_mode`: WRITE_ENABLED
- `discovery_done`: true
- `smoke_passed`: true
- `last_transition_at`: 2026-03-11T00:00:00Z
- `total_events`: 6
- `record_provenance`: reconstructed
- `confidence`: low

### Root cause analysis

The jsonl's latest VERIFIED event is `evt_005` at `2026-03-11T00:00:00Z`
(scope=spapi, to_state=VERIFIED, `[RECONSTRUCTED]` note). Replay sets
`last_verified_at` to that event's `at` value per
`persistence.py:replay_state_from_jsonl`.

The state.yaml value `2026-04-09T00:00:00Z` does **not** correspond to
any VERIFIED event in the jsonl. This is yaml-side drift — either a
manual touch-up or a prior partial write. Per ADR invariants
(A1 jsonl authoritative / A2 write-order / R3 rewrite rule), jsonl wins.

### Handling (operator action required)

Per Sprint 1 hard discipline #3 and ADR R3, this runbook **does not**
auto-apply. Operator must run:

```bash
cd /Users/liye/github/amazon-growth-engine
python3 -m scripts.onboarding.replay_state STR-358D075EFC --apply
```

After `--apply`, re-run without flag and confirm `IN SYNC`. Record
both outputs in the `acceptance-run-log.md` appendix below (to be
added when the operator closes the divergence).

---

## C6 Exit status

| Criterion | Status |
|---|---|
| All 3 stores executed | ✅ |
| 2/3 IN SYNC (first pass) | ✅ |
| Last 1 `SNAPSHOT_DIVERGED` surfaced, not auto-healed | ✅ (per discipline) |
| Operator `--apply` on STR-358D075EFC | ✅ 2026-04-17 |
| Re-run confirms IN SYNC post-apply | ✅ 2026-04-17 |

**C6 closed 2026-04-17**. 3/3 stores IN SYNC. Sprint 1 Wave 1.3 done.

### Resolution record (STR-358D075EFC)

- **Cause**: yaml-side drift on `last_verified_at` (yaml had
  `2026-04-09T00:00:00Z`; jsonl had no VERIFIED event at that date,
  only `evt_005` at `2026-03-11T00:00:00Z`).
- **Handling**: chose option A (align yaml to jsonl) per the contract's
  single source of truth rule. `--apply` executed; yaml
  `last_verified_at` reconciled to `2026-03-11T00:00:00Z`.
- **Rejected option B** (append a reconstructed VERIFIED event dated
  2026-04-09 to jsonl): no independent evidence of a VERIFIED moment on
  that date. Store is already flagged `record_provenance: reconstructed`
  / `confidence: low`; reverse-engineering a jsonl event from a drifted
  yaml without external proof would violate the append-only authoritative
  semantics.

---

## Appendix — Replay raw output (2026-04-17)

### STR-E438213024

```
state.yaml is IN SYNC with jsonl (no changes).
  = store_id: 'STR-E438213024'
  = store_status: 'OPERATIONAL'
  = provider_status.ads: 'VERIFIED'
  = provider_status.spapi: 'VERIFIED'
  = ops_mode: 'READ_ONLY'
  = discovery_done: True
  = smoke_passed: True
  = last_verified_at: '2026-04-09T13:58:00Z'
  = last_transition_at: '2026-04-09T14:00:00Z'
  = total_events: 12
```

### STR-8105E71CE4

```
state.yaml is IN SYNC with jsonl (no changes).
  = store_id: 'STR-8105E71CE4'
  = store_status: 'OPERATIONAL'
  = provider_status.ads: 'VERIFIED'
  = provider_status.spapi: 'VERIFIED'
  = ops_mode: 'READ_ONLY'
  = discovery_done: True
  = smoke_passed: True
  = last_verified_at: '2026-04-10T00:00:00Z'
  = last_transition_at: '2026-04-10T00:00:00Z'
  = total_events: 10
```

### STR-358D075EFC

```
state.yaml DIFFERS from jsonl replay. Use --apply to write:
  = store_id: 'STR-358D075EFC'
  = store_status: 'OPERATIONAL'
  = provider_status.ads: 'VERIFIED'
  = provider_status.spapi: 'VERIFIED'
  = ops_mode: 'WRITE_ENABLED'
  = discovery_done: True
  = smoke_passed: True
  - last_verified_at: '2026-04-09T00:00:00Z'
  + last_verified_at: '2026-03-11T00:00:00Z'
  = last_transition_at: '2026-03-11T00:00:00Z'
  = total_events: 6
  = record_provenance: 'reconstructed'
  = confidence: 'low'
```

---

## Operator apply run (2026-04-17, STR-358D075EFC)

### `--apply`

```
state.yaml DIFFERS from jsonl replay. Use --apply to write:
  = store_id: 'STR-358D075EFC'
  = store_status: 'OPERATIONAL'
  = provider_status.ads: 'VERIFIED'
  = provider_status.spapi: 'VERIFIED'
  = ops_mode: 'WRITE_ENABLED'
  = discovery_done: True
  = smoke_passed: True
  - last_verified_at: '2026-04-09T00:00:00Z'
  + last_verified_at: '2026-03-11T00:00:00Z'
  = last_transition_at: '2026-03-11T00:00:00Z'
  = total_events: 6
  = record_provenance: 'reconstructed'
  = confidence: 'low'

Wrote state.yaml for STR-358D075EFC.
```

### Re-run without flag — confirmation

```
state.yaml is IN SYNC with jsonl (no changes).
  = store_id: 'STR-358D075EFC'
  = store_status: 'OPERATIONAL'
  = provider_status.ads: 'VERIFIED'
  = provider_status.spapi: 'VERIFIED'
  = ops_mode: 'WRITE_ENABLED'
  = discovery_done: True
  = smoke_passed: True
  = last_verified_at: '2026-03-11T00:00:00Z'
  = last_transition_at: '2026-03-11T00:00:00Z'
  = total_events: 6
  = record_provenance: 'reconstructed'
  = confidence: 'low'
```

All three stores IN SYNC. **Sprint 1 Wave 1.3 complete.**
