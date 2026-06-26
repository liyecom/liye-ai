# github-scout — Evolution Log

> **Stub (Phase 0).** No operating history yet. Append dated entries as the scout's
> heuristics (query derivation, relevance signals, recommendation defaults) change.
> Safety invariants (I1–I3, fail-closed) are **not** heuristics and change only via an
> ADR amendment, not a log entry.

| Date | Change | Driver |
|------|--------|--------|
| 2026-06-26 | Phase 0 created (report subcommand; license-gated state machine; 4-leaf taxonomy). | ADR-GitHub-Prior-Art-Scout |
| 2026-06-26 | Default derived-term cap set to 3 (GitHub search ANDs terms; >3 collapses recall). | first live runs |
| 2026-06-26 | I2 scope-gate **bug** fixed: a non-200 auth probe now fails closed. The impl was fail-OPEN (5xx / abuse-403 probes were accepted, so a write-scoped token could be falsely attested read-only and still attached). This corrects the impl to honor the already-stated I2 — it does **not** change the invariant, so no ADR amendment. Found by adversarial red-team (GHS-01). | adversarial review |

## Phase-1 candidates (field evaluation 2026-06-27, NOT enacted)

Six live ideas were run unauthenticated (canonical-json, license-detection, amazon-ads,
dead-code, ts-unused, py-unused). The safety machinery held (license gating correct
3/3; first live `strong_copyleft` skip on a GPL-3.0 repo; clean-room README/tree gate
fired). Three recall/robustness gaps surfaced — recorded as candidates, **deferred**:

1. **Query — protect domain keywords.** The 3-term lexical cap can drop the most
   important word: idea "detect the open source license of a github repository" derived
   `detect open source` and **dropped "license"**, so the top hits were PII/CV tools
   and the real prior art (licensee/askalono/scancode) was mostly missed. Candidate:
   protect a domain-keyword set / weight rarer terms over generic verbs, instead of a
   blind frequency cap.

2. **License — NOASSERTION / LICENSE-file fallback.** GitHub's `/license` returns
   `spdx_id: NOASSERTION` ("Other") for genuinely-licensed repos with non-standard
   layout (verified live: `aboutcode-org/scancode-toolkit` = Apache-2.0+CC-BY,
   `nucleuscloud/neosync`). Scout correctly fail-closes these to `unknown → skip` (I3),
   but the cost is real permissive tools silently skipped. Candidate: on
   NOASSERTION/404, fetch the LICENSE blob and run a local SPDX matcher **before**
   giving up — recall gain while staying fail-closed. (Touches license resolution →
   would need an ADR check, not just a heuristic tweak.)

3. **Robustness — network timeout must fail-closed, not crash.** A transient TLS/connect
   timeout during `inspect_candidate` raised an **uncaught** traceback and killed the
   whole run (seen twice on the duplicate-code idea). The fail-closed data path already
   exists (`fetch_failed → unknown → skip`); the transport exception just isn't wired
   into it. Candidate (highest priority of the three): wrap per-candidate network calls
   so a timeout degrades that candidate to `fetch_failed` and the report continues.
