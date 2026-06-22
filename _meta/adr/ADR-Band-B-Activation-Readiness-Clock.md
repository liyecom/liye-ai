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
**Note**: §5 (S9 replacement readout) is a PROPOSAL pending operator approval; all other sections are Accepted per operator rulings 2026-06-22.
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
- Note: the inline comment in `learning_sources.yaml` (≈ lines 37–38) saying "validate_manifest_reality.py must set to actual hash" is inaccurate (the importer consumes it, not the validator); left unedited this PR to keep scope to `engine_repo` — flagged here for a later cleanup.

### 4. 30-day clock starts BEFORE the manifest flip
- `validate_manifest_reality.py` against the current placeholder manifest returns `overall: PASS` (R1–R6, exit 0). The clock is therefore startable today, with no flip.
- Runner: `_meta/contracts/scripts/manifest_reality_clock.py` (`--dry-run` / `--append`), append-only JSONL ledger at `_meta/contracts/ledger/manifest_reality_amazon-growth-engine.jsonl`.
- Continuity rule for gate-open: **30 consecutive UTC-day PASS**; any gap or any FAIL resets the count (fail-closed). Failures are appended, never silently overwritten.
- Day-0 entry: `2026-06-22`, `overall=PASS`, `clock_eligible_day=true`, `exit_code=0`, all R1–R6 PASS.
- **Earliest gate-open ≈ 2026-06-22 + 30d = 2026-07-22**, AND §5 resolved, AND downstream Phase-4 freshness floors. Every day the clock is paused pushes activation out one day.

### 5. Sprint 9 readout pointer is dead → replacement readout PROPOSED (pending operator approval)
- The memory-cited pointer `cb4d4b0` does **not resolve** (`git cat-file -t cb4d4b0 → NOT FOUND`).
- Evidence recovery: liye_os + loamwise contain only the **Sprint 7** readout (`1833315`, `5ea80ab`); no signed **Sprint 9** readout artifact exists. `ADR-Governed-Heuristic-Learning.md` and `.planning/baseline/GHL-v4.1-readiness-report.md` reference "Sprint 9 readout (≥ 2026-05-13Z)" only as a **future gate**.
- Reality: the work the readout was meant to gate (Phase 1a–1e, 2a, Phase-4) was all **built and merged** (git-verifiable). The gate's purpose was effectively met; the discrete sign-off document was never produced.
- **Ruling: do NOT declare S9 satisfied via the dead pointer.** Instead, the `S9_REPLACEMENT_READOUT` below is offered as a **proposal**; whether it satisfies the gate's "Sprint 9 readout 后续审批" clause is the operator's decision.

## S9_REPLACEMENT_READOUT (Proposal — pending operator approval)

A current, operator-signable readiness readout to substitute for the never-produced Sprint 9 readout, built from verifiable present-day evidence:

| Readiness dimension | Evidence (verifiable) | State |
|---|---|---|
| Band A safety substrate 5/5 | AGE PRs #455/#458/#461/#500/#502 merged + on main; 88 local tests green | ✅ |
| Manifest reality R1–R6 | `validate_manifest_reality.py` → overall PASS, exit 0 (ledger day-0 2026-06-22) | ✅ |
| Door2 wiring + inertness | write_engine Phase 5.5.2 hook → `cbu_receipt_emit.py` → emit_fact; `decide_effective_mode(placeholder,closed)→disabled_noop` | ✅ wired + inert |
| Tenant boundary fail-closed | AB-1 guard wired at `execute_request.py:3228`; live no-DB → `UNRESOLVED_DENY`; 16 tests incl. named fail-closed cases | ✅ |
| Idempotency (content-identity) | dead hand-rolled hash retired (#500); Door2 uses emit_fact SSOT (#458) | ✅ |
| Production write surface | manifest gate closed, `write_capability: none`, out/facts=0, DB byte-invariant held | ✅ zero |

**Proposed sign-off semantics**: approving this readout satisfies ONLY the "Sprint 9 readout 后续审批" clause of the gate's `evidence_required_for_open`. It does NOT by itself open the gate — the 30-day PASS clock (§4) must also complete, and the flip remains a separate B-step requiring explicit operator authorization.

**Operator action required**: approve / reject / amend this replacement readout. Until approved, the S9 clause remains UNSATISFIED and the gate stays closed regardless of clock progress.

## Consequences

- The 30-day clock is running (day-0 landed). Activation is paced by `max(clock+30d, Phase-4 floors)` AND S9 approval AND a future explicit flip authorization.
- No production surface changed: manifest closed, `enabled: false`, `expected_manifest_hash: null`, zero Ads/DB/out-facts writes.
- Next operator decisions: (a) approve/reject the S9 replacement readout; (b) choose the clock executor (manual / launchd — see runner docs); (c) at clock completion + S9 approval, authorize the B4/B6/B8 flip sequence separately.
