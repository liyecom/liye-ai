# phase-0b-parser

Python implementation of **PHASE-0B-SPEC.md v3** — credential scan + classifier +
sealed-registry emitter. **Read-only** by SPEC §1 / §10 (zero mutation).

SSOT: `~/github/liye_os/_meta/portfolio/PHASE-0B-SPEC.md` (L1 hard-constraint
protected; do not modify here — see SPEC §14 for the modification flow).

## Status

| Milestone | Status | SPEC ref |
|---|---|---|
| **M1 — skeleton + envelope + F10/F11** | **LANDED 2026-05-20** | §11.1 line 454 |
| **M2 — `scan_disk` + F1/F8/F12/F13 + CLI** | **LANDED 2026-05-20** | §11.1 line 455 |
| **M3 — `scan_db` + F14 + lint-mutation-ban 3-layer** | **LANDED 2026-05-20** | §11.1 line 456 |
| **M4 — `scan_consumers` + record merge + F5/F6/F7/F7b/F15** | **LANDED 2026-05-20** | §11.1 line 457 |
| **M5 — `classify_credentials` + Ghost/Orphan/Live + F2/F3/F4/F9** | **LANDED 2026-05-20** | §11.1 line 458 |
| **M6 — `report_sealed_registry` + `--strict` + write boundary + is_sealed** | **LANDED 2026-05-21** | §11.1 line 459 |
| M7 — CI lint + full 15-fixture green | pending | §11.1 line 460 |

## Quick start

```bash
cd ~/github/liye_os/tools/phase-0b-parser
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest -v
bash scripts/lint-verb-whitelist.sh
bash scripts/lint-mutation-ban.sh
```

## Layout

```
tools/phase-0b-parser/
├── pyproject.toml
├── scripts/
│   ├── lint-verb-whitelist.sh    # SPEC §6.1 line 243-252 enforcement
│   └── lint-mutation-ban.sh      # SPEC §6.4 line 287-309 enforcement (M3/M4 fill)
├── src/phase_0b_parser/          # package name uses underscores (Python convention)
│   ├── envelope.py               # M1 — schema double-threshold check (§8)
│   ├── models.py                 # M1 — FingerprintRecord / SealedRegistry dataclasses (§5)
│   ├── path_normalize.py         # M1 — ~/$HOME/realpath helper (§7 F11, target-classes line 3)
│   ├── scan_disk.py              # M2 — disk plaintext scan (sk_/pk_/jwt)
│   ├── cli.py                    # M2/M3 — `phase-0b-parser` entry point
│   ├── scan_db.py                # M3 — Medusa /admin/api-keys read-only
│   ├── scan_consumers.py         # M4 — active .env* cross-ref + _merge_records union
│   ├── classify_credentials.py   # M5 — Ghost/Orphan/Live three-way classifier
│   ├── report_sealed_registry.py # M6 — sealed-registry.json emitter + write boundary
│   └── verbs.py                  # is_sealed (M6) / is_ghost / is_orphan / is_live (M5)
└── tests/
    ├── fixtures/F10_target_classes_v3.yaml
    ├── fixtures/F1_ghost/        # mock sk_ in storefronts/sf-mock/.env.local
    ├── fixtures/F8_jwt/          # mock JWT in dotclaude/settings.local.json
    ├── fixtures/F12_empty/       # zero-byte .env.local edge case
    ├── fixtures/F13_malformed/   # broken JSON edge case
    ├── test_envelope.py          # F10 — 6 cases (incl. happy + sad path)
    ├── test_path_normalize.py    # F11 — 5 cases (tilde/$HOME/./../return-type)
    ├── test_scan_disk_F1.py      # F1 — Ghost (disk only)
    ├── test_scan_disk_F8.py      # F8 — JWT in user-level config
    ├── test_scan_disk_F12.py     # F12 — empty .env.local
    ├── test_scan_disk_F13.py     # F13 — malformed JSON WARN+skip
    ├── test_scan_disk_smoke.py   # helpers + CLI flag/env/default precedence
    └── test_signatures.py        # smoke — M3-M6 stubs still raise NotImplementedError
```

### Package naming note

SPEC §6.1 line 247 references `src/0b/` as an *illustrative* path. This project
uses `src/phase_0b_parser/` because Python module names cannot start with a
digit. The verb-prefix lint (`scripts/lint-verb-whitelist.sh`) reads the actual
package path. No SPEC content was changed; this is a naming adapt only.

## CLI (M2 + M3)

```bash
# Disk-only scan — default ~/github/ portfolio (allowlist per CLAUDE.md).
phase-0b-parser

# Disk + DB scan — provide Medusa admin endpoint via env or flag.
MEDUSA_ADMIN_URL=http://localhost:9000 \
MEDUSA_ADMIN_TOKEN=<bearer> \
phase-0b-parser

# Explicit DB URL (CLI flag wins over env). Token always env-only.
MEDUSA_ADMIN_TOKEN=<bearer> phase-0b-parser \
  --portfolio-root /path/to/portfolio \
  --db-url http://localhost:9000
```

Token (`$MEDUSA_ADMIN_TOKEN`) is **never** accepted as a CLI flag — that would
land it in shell history. URL is safe either way.

Output is count-only on stdout. Redacted fingerprints land in
`sealed-registry.json` (written by M6 `report_sealed_registry`). Raw
tokens never leave RAM and never appear in stdout/stderr.

## CLI (M6 — sealed-registry emit)

```bash
# Default output path: var/sealed-registry.json (whitelisted under
# tools/phase-0b-parser/var/).
phase-0b-parser --portfolio-root ~/github

# Explicit output path (must satisfy SPEC §6.4 whitelist: build/dist/
# .cache/var/tmp dir name in any path part; banned: .claude/.git/
# _meta/source dirs/.env* filenames).
phase-0b-parser --output /tmp/sealed-registry.json

# Strict mode per SPEC §8.6 — escalatable WARN (db_validity=unknown /
# fp_collision / requires_human_confirmation) abort with exit code 2.
# CI callers should pass --strict.
phase-0b-parser --strict --output build/sealed-registry.json
```

Exit codes:
- `0` — happy path; sealed-registry.json written
- `2` — strict-mode violation (escalatable WARN with `--strict`)
- `3` — output path violation (path outside §6.4 whitelist)

## sealed-registry.json shape

```json
{
  "schema_version": 1,
  "schema": "sealed_registry",
  "generated_at": "2026-05-21T14:30:00Z",
  "summary": {
    "total_records": 42,
    "by_classification": {"ghost": 5, "orphan": 8, "live": 29},
    "collision_detected": false,
    "system_seed_suspected_count": 2,
    "unknown_db_validity_count": 0,
    "requires_human_confirmation_count": 2
  },
  "records": [ /* lex-sorted by fingerprint_sha256_12 — see SPEC §5.2 */ ]
}
```

All keys snake_case lowercase. Records are lex-sorted by
`fingerprint_sha256_12` for deterministic output. The `collision_detected`
field is always `false` in M6 (Phase 0B-2 will activate real fp[:12]
collision detection via a `fingerprint_full` additive field).

## Hard rules (don't touch from M2+)

- **Mutation ban** — SPEC §6.4. No `subprocess` (except `# noqa: read-only-exec`),
  no `requests.{post,put,delete,patch}`, no Medusa SDK write methods.
- **Output path whitelist** — only `./sealed-registry.json` or
  `--output-dir <dir>/sealed-registry.json`. SPEC §6.4 line 276-279.
- **Verb prefixes only** — `classify_` / `is_` / `list_` / `report_` / `scan_`.
  New verbs require SPEC PR. SPEC §6.1 line 235-252.
- **Fingerprint** — `sha256(token.utf8).hexdigest()[:12]`, no salt, lowercase
  hex. SPEC §5.2 line 173-182.

## CHANGELOG

See `CHANGELOG.md`.
