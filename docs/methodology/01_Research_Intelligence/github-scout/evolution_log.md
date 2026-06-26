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
