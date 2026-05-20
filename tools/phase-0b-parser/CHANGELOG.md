# Changelog

All notable changes to phase-0b-parser. SSOT: `PHASE-0B-SPEC.md` v3.

## [0.2.0] — 2026-05-20 — M2: scan_disk + F1/F8/F12/F13 fixtures + CLI

### Added

- `scan_disk.py` real implementation (replaces M1 `NotImplementedError`
  stub). Walks `~/.claude/**/*.json` + `<repo>/.claude/**/*.json` +
  `**/.env*` + `**/.envrc` per SPEC §2 line 29-32. Token regexes cover
  `sk_` / `pk_` / `jwt` (3 of 7 SPEC §5.2 line 186 key types). Fingerprint
  formula matches SPEC §5.2 line 175 verbatim (`sha256(t.utf-8).hex[:12]`).
- `PORTFOLIO_REPOS` allowlist (10 repos per liye_os/CLAUDE.md "Repo 索引");
  out-of-scope repos (hermes-agent / openclaw / openclaw-skillgate /
  claw-price-intel / age-main-cron / financial-services) silently skipped.
- Fixture-mode auto-detection: when `portfolio_root` doesn't have any
  PORTFOLIO_REPOS subdir OR sits inside `tests/fixtures/`, the scan
  switches to flat traversal and skips the real `~/.claude/` glob to
  prevent polluting fixture results with the host user's config.
- `cli.py` + `[project.scripts] phase-0b-parser` entry point. Portfolio
  root precedence: `--portfolio-root` flag > `LIYE_PORTFOLIO_ROOT` env
  var > default `~/github/` (per SPEC §12 Q3 M2 default decision).
- Fixtures: F1 (Ghost — mock `sk_` in `sf-mock/.env.local`), F8 (mock JWT
  in `dotclaude/settings.local.json`), F12 (empty `.env.local`), F13
  (malformed JSON triggering WARN + skip).
- Tests: `test_scan_disk_F1.py` / `F8.py` / `F12.py` / `F13.py` and
  `test_scan_disk_smoke.py` (helpers, CLI flag/env/default precedence).
- `FingerprintRecord.__hash__` / `__eq__` keyed on
  `fingerprint_sha256_12` so `Set[FingerprintRecord]` (SPEC §6.2 line 258)
  is constructible.
- `tools/phase-0b-parser/.gitignore` un-ignores `tests/fixtures/**` so
  mock-token fixture files can be committed (root `.gitignore` globs
  `**/.env` / `.env.local` which would otherwise hide them).

### Notes

- All fixture tokens are **mock** — pattern shape passes the regex but
  values are deliberately fake (`F1MOCKghost...`, `mock-f8-user-level`).
- CLI prints **counts only**; redacted/raw tokens never leak to stdout.
- Production sanity scan over `~/github/` succeeded with finite count.

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
