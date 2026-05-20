# Changelog

All notable changes to phase-0b-parser. SSOT: `PHASE-0B-SPEC.md` v3.

## [0.1.0] — 2026-05-20 — M1: project skeleton landed

### Added

- `pyproject.toml` (PEP 621; Python ≥ 3.10; PyYAML runtime; pytest dev).
- Package `src/phase_0b_parser/`:
  - `envelope.py` — `classify_envelope_compat()` double-threshold per SPEC §8.1-§8.6
    (verb-prefixed `classify_*` per §6.1 line 241 since it returns an enum).
    `ENVELOPES` registers all 5 schemas (`target_classes` v3-4,
    `automation_governance` v4, `automation_trust` v3, `sealed_registry` v1,
    `audit_event` v1). Exceptions: `SchemaMissingError`, `SchemaTooOldError`,
    `UnknownSchemaError`.
  - `models.py` — `FingerprintRecord`, `DiskSource`, `DbMetadata`,
    `SealedRegistry` dataclass skeletons per SPEC §5.1-§5.2.
  - `path_normalize.py` — `normalize()` resolves `~`/`$HOME`/relative to
    absolute realpath per SPEC §7 F11 + target-classes.yaml line 3.
  - `scan_disk.py` / `scan_db.py` / `scan_consumers.py` /
    `classify_credentials.py` / `report_sealed_registry.py` / `verbs.py` —
    M2-M6 stubs raising `NotImplementedError` with SPEC line refs.
- Tests: F10 envelope (6 cases incl. happy + sad path), F11 path
  normalization (5 cases), signatures smoke (12 cases).
- `scripts/lint-verb-whitelist.sh` — enforces SPEC §6.1 whitelist
  (classify/is/list/report/scan).
- `scripts/lint-mutation-ban.sh` — skeleton; full grep wiring deferred to
  M3/M4 once DB/HTTP code arrives.

### Notes

- Package path is `src/phase_0b_parser/`, not SPEC §6.1 line 247's
  illustrative `src/0b/` — Python modules cannot lead with a digit.
- Repo-level `.github/workflows/0b-parser-lint.yml` intentionally **not**
  created; mono-repo CI integration deferred to main session decision.
- No commit made; staging left for main session.
