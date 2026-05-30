# import_facts.mjs — Phase 1b GHL fact importer

liye_os actively **pulls** AGE fact event sidecars and writes canonical
`fact_run_outcome_record_v1` records, with dual-hash verification + dedupe.

- Normative: `.planning/phase-1b/SPEC.md` v1.0 (blob `4a606e18`)
- CODE-SSOT for hashes: AGE `scripts/learning/emit_fact.py` (main `7b28956`)
- Deliverable: `.claude/scripts/learning/import_facts.mjs` (+ `canonical_json.mjs`)

## Run (dry-run-first)

```bash
# Default = dry_run: full validate + dual-hash recompute + would-write, ZERO disk writes.
node .claude/scripts/learning/import_facts.mjs --json

# Against a specific local AGE clone:
node .claude/scripts/learning/import_facts.mjs --source amazon-growth-engine \
     --engine-repo ../amazon-growth-engine --json

# Live (writes records). Phase 1b: AGE is enabled:false in the registry, so a real
# live run imports 0 facts until go-live (a separate, user-signed change).
node .claude/scripts/learning/import_facts.mjs --mode live
```

Exit codes: `0` success (NEW/SKIP/CONFLICT) · `2` ≥1 reject · `1` unexpected.
`DUPLICATE_CONFLICT` is non-fatal (does not raise the exit code).

## Tests

```bash
# Node 23 note: pass the glob, not the bare directory (ERR_UNSUPPORTED_DIR_IMPORT).
node --test .claude/scripts/learning/tests/*.test.mjs

# Re-prove the cross-language byte-equality linkage against live emit_fact:
python3 .claude/scripts/learning/tests/golden_harness.py --check
```

## Outputs

| Path | When |
|------|------|
| `state/memory/facts/fact_run_outcome_records.jsonl` | NEW record (live) |
| `state/runtime/learning/fact_conflicts/<source>/<id_hex>/` | dual-hash divergence only |
| `state/runtime/learning/fact_rejects/<source\|unknown>/<sha256-of-bytes>/` | schema / path / integrity / filename / numeric reject |

## Design notes

- **Token-preserving canonicalization** (`canonical_json.mjs`): byte-reproduces
  Python `json.dumps(sort_keys, separators=(",",":"), ensure_ascii=False)` by
  preserving each scalar's source token — no RFC8785/JCS lib, robust across the
  number/escaping divergence domain.
- **Gate B preimage**: the importer drops `event_content_hash` **and** `emitted_at`
  + `raw_payload_summary.metric_formatting_hint`, while keeping `event_identity_key`.
- **`importer_version`** is the frozen token `discover_new_runs@2.0.0` (record schema
  regex), even though this file is `import_facts.mjs`.
- **seen_index** is rebuilt from `records.jsonl` on every run (sole SSOT) → full
  re-runs are idempotent.

## Phase 1b boundaries (do NOT)

flip registry `enabled:true` · pin `expected_manifest_hash` · run a scheduler ·
touch AGE / loamwise / `heartbeat_runner.mjs` / `discover_new_runs.mjs` / frozen
schemas / legacy `fact_run_outcomes.jsonl` · generate policy trials.
