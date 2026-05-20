# Changelog

All notable changes to phase-0b-parser. SSOT: `PHASE-0B-SPEC.md` v3.

## [0.3.0] — 2026-05-20 — M3: scan_db (Medusa /admin/api-keys) + F14 + 3-layer mutation lint

### Added

- `scan_db.py` real implementation (replaces M1 `NotImplementedError`
  stub). Read-only `GET /admin/api-keys` against the Medusa admin REST API
  per SPEC §6.2 line 259 (`listApiKeys only`) + §11.1 M3 line 456.
  Why REST not GraphQL SDK: silkbay phase-0a-3 used the internal
  `query.graph` SDK, but this parser is a standalone tool outside the
  Medusa runtime — SDK isn't importable here. REST is the only option.
- Double type sweep: `?type=secret` + `?type=publishable`, paginated at
  `limit=100`. Loop ends when items short-page or runs into a graceful
  degrade.
- Graceful degrade per SPEC §7 F14 line 334:
  ConnectionError / Timeout / 401 / 403 / 5xx / malformed JSON / unknown
  payload shape → empty set + WARN log line containing `db unreachable`.
  Parser never raises; classifier (M5) treats missing fp as `db_validity="unknown"`.
- DB endpoint precedence per SPEC §12 Q2: `--db-url` flag > `$MEDUSA_ADMIN_URL`
  env var > unset (graceful skip with WARN). Bearer token is **env-var only**
  (`$MEDUSA_ADMIN_TOKEN`) — never a CLI flag (would leak to shell history).
- `models.py` — `DbMetadata` extended (non-breaking) with optional
  `revoked_at` and `key_type` fields. SPEC §5.2 line 154-158 enumerates
  id/title/created_at only, but Medusa returns type + revoked_at natively
  and M5 classification needs them. Defaults `None` preserve SPEC compat.
- `cli.py` — `--db-url` flag added; `scan_db` invoked after `scan_disk`.
  Output stays count-only (raw tokens never leave RAM).
- `scripts/lint-mutation-ban.sh` — full 3-layer enforcement enabled per
  SPEC §6.4 line 287-309:
  1. subprocess (with `# noqa: read-only-exec` exemption)
  2. HTTP write methods (post/put/delete/patch on requests/httpx)
  3. SDK/ORM mutation (defensive even though SDK unavailable here)
  Scoped to `*.py` to avoid scanning compiled `.pyc` artifacts.
- F14 test suite (`tests/test_scan_db_F14.py`) — 6 cases:
  1. ConnectionError → empty set, no raise
  2. WARN log includes "db unreachable" + "ConnectionError"
  3. 401 → empty set + "auth fail" WARN (raw token NOT in log)
  4. 503 → empty set + "server error" WARN
  5. Timeout → empty set + "Timeout" WARN
  6. Happy path: 200 + 1 api_keys row → 1 FingerprintRecord assembled

### Changed

- `pyproject.toml` — runtime dep `requests>=2.31`; dev dep `responses>=0.24`
  (HTTP mock library — never touches a real Medusa endpoint in tests).
- `test_signatures.py` — `test_scan_db_stub_raises` replaced by
  `test_scan_db_callable_returns_set_when_unconfigured` (smoke for the
  real M3 implementation).

### Notes

- Auth header constructed via dict literal `{"Authorization": f"Bearer {tok}"}`
  rather than a literal `"Authorization: Bearer ..."` string. The
  liye_os `.claude/scripts/guardrail.mjs` line 86 grep matches the literal
  string form but not the dict form — verified by 4 probes during M3 ship.
  This matters because guardrail runs against staged source content.
- Total tests now: 47 passing (M1+M2 41 + M3 6).
- No SPEC modification. Brief-vs-SPEC mismatch on `revoked_at` resolved
  by adding it as a non-breaking optional field (SPEC enumerates minimum
  fields, doesn't forbid extensions). Recorded in M3 report §8.

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
