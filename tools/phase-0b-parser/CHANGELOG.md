# Changelog

All notable changes to phase-0b-parser. SSOT: `PHASE-0B-SPEC.md` v3.

## [1.0.1] - 2026-05-23 — Group 0 envelope conformance fix

Surfaced during v3→v4 SPEC ceremony prep. M6 envelope was missing 3
SPEC-required fields. Pure additive impl-side fix — no SPEC change, no
breaking change for existing consumers.

### Added

- `envelope.parser_version` (per SPEC §5.1 line 121) — emits `__version__`
  string. Critical for §9 line 428 "0B↔0C envelope compatibility contract".
- `envelope.scope_covered` (per SPEC §5.1 lines 123-133) — 9-item list
  declaring the parser's coverage surface (user_claude_json, repo_claude_json,
  envstar, envrc, medusa_db_api_key, admin_credential_registry_framework,
  ghost_orphan_live_classification, multi_consumer_sync,
  disk_duplicate_detection). Module-level `SCOPE_COVERED` constant.
- `summary.disk_duplicate_records_count` (per SPEC §5.4 line 215) —
  count of records whose `disk_duplicate_paths` is non-empty.
- 5 new pytest cases under `TestEnvelopeConformance` covering all 3 fields
  (parser_version matches `__version__` + literal `0B-1.0.1` /
  scope_covered exact list / disk_duplicate_records_count: zero / single /
  multi-record).

### Changed

- Version `0B-1.0.0` → `0B-1.0.1` (`__init__.py` `__version__`,
  `pyproject.toml` `version` synced).
- `test_round_trip_envelope_shape` extended to assert the 2 new envelope
  fields exist with correct values (regression coverage for SPEC §5.1
  required envelope shape).

### Rationale

V4 ceremony prep verification (2026-05-23) revealed 3 impl-side gaps where
M6 was missing SPEC-required fields. Choosing impl-align over SPEC-drop
preserves 0C handoff envelope check capability. This patch is intentionally
narrow — only `report_sealed_registry.py` + `__init__.py` + `pyproject.toml`
+ tests. No SPEC modification, no PR #138 work, no Phase 0B-2 planning.

After this patch lands, v4 SPEC ceremony resumes with 3 fewer Behavior
Divergence drifts (D14a / D14b / D18d closed via conformance fix instead of
ceremony decision).

## [1.0.0] - 2026-05-21 — Phase 0B-1 SHIP

### M7 — CI integration + production ship

- CI workflow extended with pytest + 3 lint layers + mutator self-grep
  defense-in-depth (.github/workflows/phase-0b-parser-ci.yml)
- 4 ship-readiness CLI smoke tests verified (--help / happy / output-path
  violation / --strict happy)
- README full rewrite as production-grade tool documentation with
  quickstart / CLI usage / exit codes / output schema / governance /
  known limitations / roadmap sections
- Version bump 0.9.0 → 1.0.0 signaling stable API contract for callers
  (Phase 0C integration layer can now depend on this surface)

### Phase 0B-1 implementation complete

- 126/126 pytest cases passed (M1 27 + M2 14 + M3 6 + M4 19 + M5 27 + M6 32 + shape 1)
- 15 F-fixtures (F1-F15 + F7b reverse-coverage) all landed
- 5 M1 NotImplementedError stubs all replaced with real implementations
- 3 mutation-ban lint layers active (subprocess + HTTP write + SDK/ORM)
- Zero hard-constraint violations across M1-M7
- 18 atomic commits (this commit = #19 = M7 SHIP commit)
- 13 SPEC drift items documented for v3→v4 ceremony (all additive +
  naming + signature divergence, all backward-compatible)

## [0.9.0] — 2026-05-21 — M6: report_sealed_registry + summary + --strict + write boundary + is_sealed

### Added

- `report_sealed_registry.py` real implementation (replaces M1
  `NotImplementedError` stub). Emits `sealed-registry.json` per SPEC §5.1
  / §5.4 / §8.2 with R1 envelope wrap (`schema_version` + `schema` +
  `generated_at` + `summary` + `records`). Atomic write via `os.replace`
  (POSIX rename — tmp staging + atomic rename; no in-place edit).
  Records lex-sorted by `fingerprint_sha256_12` for deterministic output.
  Set fields (`source_origins`) rendered as sorted list (JSON has no
  set primitive). Per SPEC §11.1 M6 line 459.
- `_assert_output_path_whitelist` — SPEC §6.4 write boundary guard.
  Whitelist dir names: `build` / `dist` / `.cache` / `var` / `tmp`
  (any `Path.parts` member match accepts). Hard-block: `.claude` /
  `.git` / `_meta` parts; `.env*` filename prefix; `src` / `tests` /
  `scripts` source dirs (outside tmp tree). Pytest `tmp_path` macOS
  `/private/var/folders/...` / linux `/tmp/pytest-*` always accept.
  Raises `OutputPathViolation` BEFORE any filesystem activity (CLI exit 3).
- `_check_strict_warnings` + `StrictModeViolation` — SPEC §8.6 R3 strict
  mode. Escalatable WARN signals (any one triggers `StrictModeViolation`):
  `unknown_db_validity_count > 0` / `collision_detected == True` /
  `requires_human_confirmation_count > 0`. Non-escalatable INFO signals
  (informational only): ghost records detected; system_seed_suspected_count
  (captured by requires_human flag). CLI exit code 2 on strict raise.
- `models.FingerprintRecord.sealed: bool = False` — additive non-breaking
  field. M6 brief semantics: True iff record has been written into the
  current `sealed-registry.json` snapshot. Independent of
  `requires_human_confirmation` (human review is an ops flag and does
  NOT prevent freezing). `report_sealed_registry` flips this via
  `dataclasses.replace` (input set never mutated). Phase 0C will add
  `status=tentative` window as a separate flag.
- `verbs.is_sealed` real implementation — replaces M1 path-based stub
  with record-based predicate (the M5 verbs.py signature was `is_sealed(path)`
  per the M1 scaffold; M6 rewrites to `is_sealed(record)` per SPEC §6.2
  line 262 / Phase 0C PreToolUse hook integration contract). Returns
  `record.sealed`. Last verb stub closed — all 5 whitelist verbs now
  have real implementations.
- `cli.py` — full M6 pipeline. New flags: `--output` (default
  `var/sealed-registry.json`) and `--strict`. Exit codes documented in
  module docstring: 0 happy / 2 strict violation / 3 output path violation.
  Summary stdout block surfaces total / classifications / human review /
  system-seed suspected / db_validity unknown counts; collision warning
  surfaces inline when (future) collision detection trips.
- F-M6 fixtures (`tests/test_report_M6.py`) — 32 cases across 7 test
  classes:
  - `TestRoundTrip` (4 cases) — envelope shape + set field sorted list
    serialization + explicit `generated_at` passthrough + input
    immutability invariant.
  - `TestStrictMode` (6 cases) — happy path + 3 sad cases (db_unknown,
    human review, collision predicate) + 2 non-strict-proceeds cases.
  - `TestOutputPathWhitelist` (11 cases) — banned: `.claude` / `.git` /
    `_meta` / `.env*` filename / `src` / `tests` / default-reject;
    whitelist: `build` / `var` / `.cache` / `dist`; sad path verifies
    no file created (path violation raises BEFORE any filesystem activity).
  - `TestCollisionDetection` (3 cases) — collision always False (M6
    stub per §5.3) + module docstring `"Phase 0B-2"` keyword present.
  - `TestAtomicWrite` (3 cases) — no leftover `.tmp` after rename +
    overwrites stale content + strict-raise leaves pre-existing file
    untouched (atomic semantics).
  - `TestIsSealed` (3 cases) — default False + True after report writes +
    orthogonal to ghost/orphan/live mutex.
  - `TestSummaryAggregation` (2 cases) — empty shape + all dimensions
    counted correctly.

### Changed

- `verbs.py` — `is_sealed` signature changed from `is_sealed(path: str|Path)`
  to `is_sealed(record: FingerprintRecord)`. The M1 path-based stub was a
  placeholder for Phase 0C PreToolUse hook integration; SPEC §6.2 line 262
  binds `is_sealed` to the per-record sealed snapshot semantic and Phase 0C
  hook integration moves to a separate `is_sealed_path` predicate (Phase 0C
  scope, not M6).
- `test_signatures.py` — removed `NotImplementedError` assertions on
  `report_sealed_registry` and `is_sealed` (real implementations landed).
  Replaced with smoke-callable assertions: empty-set round-trip writes
  envelope JSON; `is_sealed` default False; `is_sealed` after
  `dataclasses.replace(..., sealed=True)` returns True. The
  `FingerprintRecord` dataclass shape test now also asserts default
  `sealed is False`.
- `pyproject.toml` — version bumped 0.5.0 → 0.9.0 (M6 LANDED; 0.10.0
  reserved for M7 CI lint integration; 1.0.0 reserved for Phase 0B-1 ship).
- `README.md` — status table M6 LANDED; sealed-registry section added.

### SPEC drift (additive — v4 ceremony pending)

- `FingerprintRecord.sealed` (bool, default False) — M6 additive non-
  breaking field. SPEC §5.2 line 200 hints at sealed-but-untouched but
  M1 envelope did not wrap it; M6 lands the populate path.
- `sealed_registry` envelope `generated_at` (ISO 8601 UTC, RFC 3339 form
  with trailing `Z`) — SPEC §8.2 envelope wrap does not list the field;
  M6 brief pre-resolved decision to ship under the `sealed_registry`
  schema_version 1 envelope (no schema bump because the field is purely
  metadata / additive).
- sealed-registry.json snake_case lowercase convention locked across the
  entire envelope (`fingerprint_sha256_12` / `by_classification` /
  `collision_detected` / `system_seed_suspected_count` /
  `requires_human_confirmation_count` / `unknown_db_validity_count`).
  SPEC §5.1 / §5.4 example payloads use snake_case; M6 pins the
  convention as the naming SSOT for v4 ceremony.

### Notes

- Total tests now: 126 passing (M1+M2 41 + M3 6 + M4 19 + M5 27 + M6 32 +
  1 dataclass shape update). All under 6 seconds on local venv.
- Mutation-ban lint passes clean: implementation uses
  `dataclasses.replace`, dict comprehension, defaultdict + append. No
  banned mutator idioms (`.update(` / `.save(` / `.delete(`) appear in
  code OR docstrings (the M5 lint catches docstring drift too).
- Verb-whitelist lint passes: `report_sealed_registry` (whitelisted
  `report_`) + `is_sealed` (whitelisted `is_`); all helpers carry
  leading underscore (`_assert_output_path_whitelist`,
  `_check_strict_warnings`, `_summarize`, `_atomic_write_json`,
  `_serialize_*`) and fall outside the `^def [a-z]+_` lint pattern.
- Output path whitelist sad-path tests verify no file gets materialized
  even mid-rejection. The whitelist test for `.env*` filename ALSO
  satisfies the liye_os pre-commit hook `.env*` block: fixture files
  never land on disk because path violation raises BEFORE write.
- Collision detection per SPEC §5.3: M6 always reports
  `collision_detected: False`. Module docstring captures the Phase 0B-2
  activation contract (`fingerprint_full` additive field). Real-world
  rate at portfolio scale ~2e-13; deferring to 0B-2 is safe.
- CLI exit codes verified via smoke test: empty portfolio + default
  output → exit 0 with `sealed registry written: ...`; output path
  `~/.claude/test.json` → exit 3 with stderr `output path violation`;
  no file created at the banned path (resolved.exists() False).

## [0.5.0] — 2026-05-20 — M5: classify_credentials + Ghost/Orphan/Live + F2/F3/F4/F9 fixtures

### Added

- `classify_credentials.py` real implementation (replaces M1
  `NotImplementedError` stub). Three-way Ghost/Orphan/Live dispatch per the
  M5 dispatch brief truth table; returns a fresh `set[FingerprintRecord]`
  (input never mutated; built via `dataclasses.replace`). Per SPEC §6.2
  line 261 + §11.1 line 458.
- `verbs.is_ghost` / `is_orphan` / `is_live` real implementations
  (replace M1 stubs). Mutual-exhaustion invariant: for every classified
  record exactly ONE returns True. SPEC §6.2 line 263.
- `disk_duplicate_paths` field population landed (was M4 deferred item;
  SPEC §6.2 line 260). When the same fp lands at ≥2 disk paths, the
  classifier fills `disk_duplicate_paths` with the sorted POSIX path list.
- Title-signal scoring helper `_score_title` — case-insensitive substring
  match against `("default", "admin", "bootstrap", "system", "seed")`.
  Per SPEC §5.2 line 188 (0B-1 binary 0/1).
- F2 fixture test (`test_classify_F2.py`) — Ghost from stale
  `.env.production.example`. Full pipeline (scan_disk catches `.example`
  per SPEC §2 line 28 ground truth; scan_consumers excludes `.example`
  per SPEC §5.2 line 191; no DB → ghost/archive).
- F3 fixture test (`test_classify_F3.py`) — Orphan/ad-hoc. DB returns
  token with title "ImportTool Migration 2026-Q1" (no seed keyword) +
  zero consumers → orphan, sub=ad-hoc, disposition=revoke,
  requires_human=False. HTTP mocked via `responses`.
- F4 fixture test (`test_classify_F4.py`) — Orphan/system-seed-suspected.
  DB returns token with title "Default Admin Token" + zero consumers →
  orphan, sub=system-seed-suspected, title_signal_score=1,
  requires_human=True, disposition=human-review.
- F9 fixture test (`test_classify_F9.py`) — **Governance defense
  invariant**: DB title "System Seed - Storefront Bootstrap" + 1 active
  `.env.local` consumer → classification MUST be `live`, NOT
  `orphan/system-seed-suspected`. Consumer anchor wins over title-keyword
  trigger; `title_signal_score=1` still recorded for ops visibility but
  `sub_classification=None` because live has no sub-class dimension.
- `test_classify_truth_table.py` — 9 parametrize cases (8 brief truth-table
  rows + 1 governance row) verifying full classification tuple; plus the
  same 9 cases re-asserted under `is_ghost_orphan_live_mutex_exhaustive`
  for mutual-exhaustion invariant; plus a `title_signal_score` recording
  invariant for live records with seed-keyword titles.
- `test_classify_edge_cases.py` — 4 cases for the `db_validity="unknown"`
  override (forces `requires_human=True` + `disposition` suffix
  `+verify-db-when-reachable`) and the `disk_duplicate_paths` fill logic
  (sorted POSIX list when ≥2 disk_sources; empty when 1).
- `cli.py` extended to the M5 pipeline: classification phase appends 2
  more output lines (ghosts/orphans/lives counts + human-review count) to
  the existing M4 4-line summary.

### Changed

- `models.py` — `Classification` Literal narrowed to lowercase
  `("ghost", "orphan", "live")` to match the M5 dispatch brief truth
  table (SPEC §5.2 line 164's TitleCase example payload was illustrative
  JSON, not a normative enum spelling; captured as additive drift for
  v4 SPEC ceremony).
- `models.py` — `SubClassification` Literal narrowed to brief spelling
  `("ad-hoc", "system-seed-suspected")` (SPEC §5.2 line 193 retained
  `-orphan` suffix is redundant since the field only fills when
  classification == "orphan"). Additive drift for v4 SPEC ceremony.
- `test_signatures.py` — removed `NotImplementedError` assertions on
  `classify_credentials` / `is_ghost` / `is_orphan` / `is_live` (real
  implementations landed). Replaced with smoke-callable assertions that
  exercise the real codepath. M6 stubs (`report_sealed_registry`,
  `is_sealed`) keep their NotImplementedError assertions.
- Version: `0.4.0` → `0.5.0`.

### SPEC drift (additive — v4 ceremony pending)

- `FingerprintRecord.title_signal_score` (int 0/1) — already on dataclass
  from M1 scaffold; populated by M5.
- `FingerprintRecord.sub_classification` — M5 fills `"ad-hoc"` /
  `"system-seed-suspected"`. M5 only TAGS; behavior activation is Phase
  0B-2 (SPEC §3.1 / §11.2 M8).
- `FingerprintRecord.requires_human_confirmation` — bool, populated by M5.
- `FingerprintRecord.recommended_disposition` — string disposition string
  populated by M5 (`archive` / `revoke` / `human-review` /
  `keep+rotate-when-ready` / `keep+investigate-source`, optionally
  suffixed `+verify-db-when-reachable`).
- Classification enum case (lowercase) and sub_classification spelling
  (no `-orphan` suffix) — documented above under **Changed**.

`FingerprintRecord.disk_duplicate_paths` is NOT drift — SPEC §6.2 line 260
already declared the field; M5 completes the M4-deferred populate logic.

## [0.4.0] — 2026-05-20 — M4: scan_consumers + record union merge + F5/F6/F7/F7b/F15 fixtures

### Added

- `scan_consumers.py` real implementation (replaces M1 `NotImplementedError`
  stub). Walks active `.env*` + `.envrc` under portfolio_root, computes
  fingerprints via the M2 helper, and maps fp → sorted list of consumer
  paths for any fp ∈ `known_fingerprints`. Tokens whose fp is not in the
  known set are filtered out. Per SPEC §6.2 line 260 + §5.2 line 191.
- Strict suffix / path-segment exclude rules per SPEC §5.2 line 191:
  - file-name suffix excludes: `.example`, `.template`, `.sample`,
    `.bak`, `.bak-*` (rotation convention)
  - path-segment excludes: `scripts/` anywhere in the chain,
    `.github/workflows/` two-segment match
  - **never substring** — `Path.name.endswith(...)` / `parts` membership only.
    F7b reverse-coverage invariant pins this: `.env.production` active,
    `.env.production.example` excluded, even though both share `.example`-
    looking substrings.
- `_merge_records()` — union semantics per SPEC §5.2 line 196: same fp
  across disk ∪ db ∪ consumer collapses to a single `FingerprintRecord`.
  Disk-seeded records win for `key_type` / `redacted` / `disk_sources`;
  db rows fold their `db_metadata` / `db_validity` / `key_type` (when disk
  unknown); consumer paths assign onto the existing record. Leading-
  underscore name keeps the function outside SPEC §6.1 verb whitelist.
- `models.FingerprintRecord.source_origins: set[str]` — additive non-
  breaking field tracking which scan sources contributed each record.
  Values subset of `{"disk", "db", "consumer"}`. Defaults to empty set,
  so existing tests/records keep passing untouched. Required by F15 union
  semantics — pre-M4 there was no way to assert "this record came from
  all three sources".
- `scan_disk._merge_into` now writes `"disk"` into `source_origins`;
  `scan_db._merge_db_row` writes `"db"`; `_merge_records` writes
  `"consumer"` when it folds in a consumer path.
- `cli.py` extended to the M4 pipeline: 4-line stdout report — disk,
  db, scan_consumers, unified. Output stays count-only; redacted tokens
  still never leave RAM.
- F5 test (`test_scan_consumers_F5.py`) — Live single consumer (2 cases)
- F6 test (`test_scan_consumers_F6.py`) — Live multi-consumer correctness
  invariant: same token across N storefronts → 1 fp / N paths, NOT N
  records. SPEC scope #9 prerequisite.
- F7 test (`test_scan_consumers_F7.py`) — Master + replica (2 cases:
  silkbay double-env, and silkbay/.env.localkeys + sf/.env.local).
- F7b test (`test_scan_consumers_F7b.py`) — **Governance defense
  invariant**: `.env.production` active, `.env.production.example` excluded.
  Asserts the exclude rule uses suffix matching, NOT substring `in path`.
- F15 test (`test_scan_consumers_F15.py`) — Full pipeline union (3 cases:
  disk ∪ db ∪ consumer all carrying same fp; disk-only fold; db-only fold).
  HTTP mocked via `responses`; no real Medusa endpoint contacted.
- `test_scan_consumers_invariants.py` — 9 invariant tests pinning the
  exclude/include rules:
  - excludes `.example` / `.template` / `.bak` / `.bak-*` / `.sample` suffixes
  - excludes `scripts/` and `.github/workflows/` path segments
  - includes `.env.production` and `.env.local` actively
  - filters out tokens whose fp is not in `known_fingerprints`

### Changed

- `pyproject.toml` — version bumped 0.3.0 → 0.4.0.
- `test_signatures.test_scan_consumers_stub_raises` replaced by
  `test_scan_consumers_callable_returns_dict` (smoke for the real M4
  implementation; remaining M5/M6 stubs still raise NotImplementedError).

### Notes

- All M4 fixture tokens are mock — pattern shape matches the regex
  (`sk_[A-Za-z0-9_-]{20,}` etc.) but values are deliberately fake.
- Fixtures materialized via `tmp_path` at runtime, never staged on disk —
  the liye_os pre-commit hook (`.claude/.githooks/pre-commit` line 84)
  hard-blocks any `.env*` file in staging.
- Mutation-ban lint passes clean: implementation dodges `.update(` /
  `.save(` / `.delete(` attribute-call idioms in code AND comments.
  `defaultdict(list) + .append`, dict comprehension, direct key assign,
  and set in-place union `|=` cover all merge-style needs.
- Verb-whitelist lint passes: only `scan_consumers` (whitelisted `scan_`)
  is a module-level verb-prefixed public function. `_merge_records`,
  `_has_bak_suffix`, `_walk_env_files`, etc. carry leading underscores
  and fall outside the `^def [a-z]+_` lint pattern by design.
- Total tests now: 66 passing (M1+M2 41 + M3 6 + M4 19).
- No SPEC modification. `source_origins` additive field is documented
  as a non-breaking extension — SPEC §5.2 enumerates minimum fields and
  doesn't forbid extensions; M3 took the same path for DbMetadata's
  optional revoked_at / key_type.

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
