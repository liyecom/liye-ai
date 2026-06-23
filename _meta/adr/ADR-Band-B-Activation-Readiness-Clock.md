---
artifact_scope: ghl-band-b
artifact_name: Band-B-Activation-Readiness-Clock
artifact_role: contract
target_layer: cross
is_bghs_doctrine: no
---

# ADR — GHL Band B Activation Readiness Clock

**Status**: Accepted
**Date**: 2026-06-22
**Accepted-Date**: 2026-06-22
**Note**: §5 (S9 replacement readout) was **APPROVED by the operator on 2026-06-23** with narrow semantics (see §5/§6); all other sections Accepted per operator rulings 2026-06-22. Executor=launchd installed 2026-06-23 (§6).
**Scope**: Start the manifest-reality 30-day clock that paces the AGE `engine_manifest.yaml` gate `emit_fact_enabled`, WITHOUT any production action. This ADR authorizes **no** manifest flip, gate open, Ads write, `learning_sources.enabled` flip, or `expected_manifest_hash` arming.
**Related**: `ADR-Governed-Heuristic-Learning.md` (D-14, Sprint 9 readout gate), `.claude/config/learning_sources.yaml`, AGE `engine_manifest.yaml` gate `emit_fact_enabled`.

## Context

AGE Band A (門關零真錢的代码层安全债) is sealed: ① execution_mode, ② Door2 wiring, ③ idempotency, ④ artifact_type, ⑤ tenant-boundary — all 5 merged on AGE `main` and verified (88 local tests green). The AGE manifest gate `emit_fact_enabled` remains `default_state: closed`, capability `status: placeholder` → zero production fact emission (Hard Gate 8 holds).

The gate's `evidence_required_for_open` is:
> "Phase 1a emit_fact.py 落盘 + 30 天连续 manifest_validator=PASS + Sprint 9 readout 后续审批"

- Phase 1a emit_fact.py: **landed** ✅.
- 30-day continuous `manifest_validator=PASS`: **clock had never started** — `validate_manifest_reality.py` had no runner and no ledger.
- Sprint 9 readout: **no signed artifact exists** (see §5).

This ADR starts the 30-day clock (the long pole) and records the operator rulings that unblock the path up to — but not including — the flip.

## Decisions

### 1. Canonical engine repo owner = `loudmirror`
- Evidence: the AGE `origin` remote points at the `loudmirror` org; the `liyecom` org's copy of the engine repo returns **HTTP 404** (absent/inaccessible).
- `liyecom` is NOT the Band B canonical owner. `learning_sources.yaml engine_repo` is updated `liyecom → loudmirror` in the same PR. (The full URL lives only in `.claude/config/`, which is outside the public-doc leak-guard scope.)

### 2. `learning_sources` repo-pointer mismatch — impact assessment
- `engine_repo` is **identity-only**. It is **not a fetch target**:
  - `validate_manifest_reality.py` resolves R1/R2 against a **local** `--engine-repo <dir>` path (`args.engine_repo or manifest_path.parent`), never the URL.
  - `import_facts.mjs` references `engine_repo` only in a docstring.
- Therefore the prior 404 URL did **not** break Hard Gate 5 mechanically; it was stale provenance. Fixing it to `loudmirror` is pure config-identity hygiene; it does **not** flip `enabled` and does **not** arm the hash.

### 3. `expected_manifest_hash` deferred until B8 / post-flip
- The hash is consumed by the **importer** (`import_facts.mjs:249`: `eventObj.manifest_hash !== expected → provenance_dirty`), NOT by the validator. While `null`, every imported fact is `provenance_dirty` by design (Phase-1b invariant).
- The manifest hash口径 is `sha256:` + sha256(manifest **raw bytes**) (`emit_fact.py:382`) — NOT the git blob SHA.
- The flip (status→active, gate→open) **changes the manifest bytes**, so the activated manifest's hash ≠ the current pre-flip value `sha256:b25557edf6abd1df1fcef60c2869e0c90b7d81708bd3dcac827add650c688b2d`. **Arming the hash now would pin the wrong (pre-flip) object** and guarantee a mismatch on every real fact.
- Ruling: arm `expected_manifest_hash` only at **B8, post-flip**, to the activated manifest's bytes. The 30-day clock records validator R1–R6 PASS and involves **no hash**, so the clock cannot "pin the wrong object."
- Note: the inline comment in `learning_sources.yaml` previously said "validate_manifest_reality.py must set to actual hash" — inaccurate (the importer consumes it, not the validator). **Corrected in this PR (review fold 2026-06-23)** to "consumed by the importer; populated post-flip at B8"; the value stays `null` (NOT armed).

### 4. 30-day clock starts BEFORE the manifest flip
- `validate_manifest_reality.py` against the current placeholder manifest returns `overall: PASS` (R1–R6, exit 0). The clock is therefore startable today, with no flip.
- Runner: `_meta/contracts/scripts/manifest_reality_clock.py` (`--dry-run` / `--append`), append-only JSONL ledger at `_meta/contracts/ledger/manifest_reality_amazon-growth-engine.jsonl`.
- Continuity rule for gate-open: **30 consecutive UTC-day PASS**; any gap or any FAIL resets the count (fail-closed). Failures are appended, never silently overwritten.
- Day-0 entry: `2026-06-22`, `overall=PASS`, `clock_eligible_day=true`, `exit_code=0`, all R1–R6 PASS.
- **Earliest gate-open ≈ 2026-06-22 + 30d = 2026-07-22**, AND §5 resolved, AND downstream Phase-4 freshness floors. Every day the clock is paused pushes activation out one day.

#### 4a. Ledger schema versions + day-0 acceptance (review fold, 2026-06-23)
- **schema-v1** = the day-0 entry (`2026-06-22`) only: manifest reality + validator R1–R6 + exit_code, with NO inline git-state evidence fields. **Not fabricated retroactively** — it is left exactly as written.
- **schema-v2** = day-1 (`2026-06-23`) onward: adds `ledger_schema_version`, `engine_repo_commit` / `engine_repo_tracked_dirty` / `engine_repo_untracked_count`, `manifest_tracked_dirty`, and `validator_repo_tracked_dirty` / `validator_repo_untracked_count`. These are **evidence-only** — `clock_eligible_day` stays a pure function of `validator overall==PASS AND exit_code==0`; a dirty repo NEVER fails the clock. The load-bearing field is `manifest_tracked_dirty` (was the manifest *itself* touched), which is independent of unrelated repo-level dirt.
- **Ruling (explicit, per reviewer's two options): day-0 ACCEPTED with external no-touch proof; day-1 onward is schema-v2.** Day-0's zero-touch was proven externally at the time (closing-proof: AGE DuckDB byte-size invariant `2873110528`, `out/facts`=0, manifest blob `bba56c9` unchanged), which is exactly the evidence schema-v2 now records inline. The 30-day window therefore counts `2026-06-22 … 2026-07-21` (30 consecutive UTC-day PASS), earliest gate-open `2026-07-22`.
- **Operator override available**: if you prefer strict self-contained ledger provenance (every clock day carrying its own inline git-state evidence), declare **formal strict clock starts 2026-06-23**; this discards day-0 from the count and pushes earliest gate-open to `2026-07-23` (cost: 1 day). Default above stands unless you choose strict.

### 5. Sprint 9 readout pointer is dead → replacement readout APPROVED 2026-06-23 (narrow semantics)
- The memory-cited pointer `cb4d4b0` does **not resolve** (`git cat-file -t cb4d4b0 → NOT FOUND`).
- Evidence recovery: liye_os + loamwise contain only the **Sprint 7** readout (`1833315`, `5ea80ab`); no signed **Sprint 9** readout artifact exists. `ADR-Governed-Heuristic-Learning.md` and `.planning/baseline/GHL-v4.1-readiness-report.md` reference "Sprint 9 readout (≥ 2026-05-13Z)" only as a **future gate**.
- Reality: the work the readout was meant to gate (Phase 1a–1e, 2a, Phase-4) was all **built and merged** (git-verifiable). The gate's purpose was effectively met; the discrete sign-off document was never produced.
- **Ruling (original): do NOT declare S9 satisfied via the dead pointer.** Instead the `S9_REPLACEMENT_READOUT` below was offered as a **proposal** for the operator to decide.
- **Operator decision 2026-06-23: APPROVED.** The replacement readout satisfies the gate's "Sprint 9 readout 后续审批" clause, **with narrow semantics ONLY**: approval does **NOT** authorize manifest flip, gate open, Ads live write, or `learning_sources.enabled` flip. Those remain separate, individually-authorized B-steps. The S9 clause is now SATISFIED; the gate still stays closed pending the 30-day clock (§4) and the future explicit flip authorization.

## S9_REPLACEMENT_READOUT (APPROVED by operator 2026-06-23 — narrow semantics)

A current, operator-signable readiness readout substituting for the never-produced Sprint 9 readout, built from verifiable present-day evidence. **Approved 2026-06-23**:

| Readiness dimension | Evidence (verifiable) | State |
|---|---|---|
| Band A safety substrate 5/5 | AGE PRs #455/#458/#461/#500/#502 merged + on main; 88 local tests green | ✅ |
| Manifest reality R1–R6 | `validate_manifest_reality.py` → overall PASS, exit 0 (ledger day-0 2026-06-22) | ✅ |
| Door2 wiring + inertness | write_engine Phase 5.5.2 hook → `cbu_receipt_emit.py` → emit_fact; `decide_effective_mode(placeholder,closed)→disabled_noop` | ✅ wired + inert |
| Tenant boundary fail-closed | AB-1 guard wired at `execute_request.py:3228`; live no-DB → `UNRESOLVED_DENY`; 16 tests incl. named fail-closed cases | ✅ |
| Idempotency (content-identity) | dead hand-rolled hash retired (#500); Door2 uses emit_fact SSOT (#458) | ✅ |
| Production write surface | manifest gate closed, `write_capability: none`, out/facts=0, DB byte-invariant held | ✅ zero |

**Sign-off semantics (as approved)**: this approval satisfies ONLY the "Sprint 9 readout 后续审批" clause of the gate's `evidence_required_for_open`. It does NOT by itself open the gate — the 30-day PASS clock (§4) must also complete, and the flip remains a separate B-step requiring explicit operator authorization.

**Operator decision**: **APPROVED 2026-06-23** (narrow semantics, per above). The S9 clause is SATISFIED; remaining gate-open conditions are the 30-day clock (§4) and a future explicit flip authorization.

## 6. Executor = launchd, installed 2026-06-23

- **Executor ruling: launchd** (operator decision 2026-06-23), per the runner docs' recommended default.
- Installed: `~/Library/LaunchAgents/com.liye.manifest-reality-clock.plist` (label `com.liye.manifest-reality-clock`), daily 09:05 local (CST), runs the runner with `--append`. Logs to `~/Library/Logs/liye/` (outside the repo ledger tree). One hardening over the bare README template: an `EnvironmentVariables.PATH` including `/opt/homebrew/bin` so the runner's schema-v2 git-evidence fields resolve under launchd's minimal default PATH (clock eligibility is unaffected — the validator runs via absolute `sys.executable`).
- Verified at install: `plutil -lint` OK; `launchctl bootstrap` rc=0; `launchctl list` shows the agent loaded; a `--dry-run` smoke exited 0 (PASS, schema-v2) and **did not append**.
- **Duplicate-day safety**: the runner has no duplicate-day guard, and 2026-06-23 already had a day-1 entry. Install was at 21:2x CST (after 09:05), so launchd's **first real `--append` fires 2026-06-24 09:05 CST → utc_date 2026-06-24 = day-2**; no same-UTC-day duplicate. Install day used `--dry-run` only.
- **Day-0 / day-1 schema** (restated, per §4a): day-0 `2026-06-22` is schema-v1 and is **accepted** via external no-touch proof; day-1 `2026-06-23` onward is schema-v2 (git-state evidence fields, evidence-only). Formal window `2026-06-22 … 2026-07-21`, earliest gate-open `2026-07-22`.
- Uninstall (operator action only): `launchctl bootout gui/<uid>/com.liye.manifest-reality-clock` then remove the plist.

## Consequences

- The 30-day clock is running and **self-feeds via launchd** (day-0 + day-1 landed). Activation is paced by `max(clock+30d, Phase-4 floors)` AND the (now-satisfied) S9 clause AND a future explicit flip authorization.
- No production surface changed: manifest closed, `enabled: false`, `expected_manifest_hash: null`, zero Ads/DB/out-facts writes. This amendment is **docs-only** and changes none of those.
- Resolved operator decisions (2026-06-23): (a) S9 replacement readout **APPROVED** (narrow semantics); (b) clock executor = **launchd, installed**; (c) day-0 schema-v1 **accepted**.
- Remaining (each separately authorized): complete the 30-day PASS clock (earliest `2026-07-22`), then the B3→B8 sequence (candidate approval → manifest flip → dry-run rehearsal → first live APPLIED CBU write → Door2 fact verify → liye ingestion flip + `expected_manifest_hash` arming).
