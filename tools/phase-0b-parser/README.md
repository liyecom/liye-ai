# phase-0b-parser

**Status:** Phase 0B-1 SHIP (v1.0.0) — production-ready · 126/126 tests passing

Python implementation of **PHASE-0B-SPEC.md v3** — credential scan + classifier +
sealed-registry emitter. **Read-only** by SPEC §1 / §10 (zero mutation across the
entire surface).

SSOT: `~/github/liye_os/_meta/portfolio/PHASE-0B-SPEC.md` (L1 hard-constraint
protected; do not modify here — see SPEC §14 for the modification flow).

## What it does

Three-source credential scanner → three-way classifier → frozen artifact.

```
                          phase-0b-parser pipeline (read-only)

  ┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
  │  scan_disk        │      │  scan_db          │      │  scan_consumers   │
  │  ~/.claude/**     │      │  Medusa REST      │      │  active .env*     │
  │  <repo>/.claude/**│      │  /admin/api-keys  │      │  + .envrc walks   │
  │  **/.env*         │      │  (type=secret +   │      │  under portfolio  │
  │  **/.envrc        │      │   publishable)    │      │  root             │
  └─────────┬─────────┘      └─────────┬─────────┘      └─────────┬─────────┘
            │                          │                          │
            └──────────────┬───────────┴──────────────────────────┘
                           ▼
                ┌──────────────────────┐
                │  _merge_records()    │   union by fingerprint_sha256_12
                │  → FingerprintRecord │   source_origins ⊆ {disk, db, consumer}
                └──────────┬───────────┘
                           ▼
                ┌──────────────────────┐
                │ classify_credentials │   ghost / orphan / live
                │  + is_ghost / is_*   │   (mutually exhaustive)
                └──────────┬───────────┘
                           ▼
                ┌──────────────────────┐
                │ report_sealed_       │   atomic write via os.replace
                │   registry           │   path whitelisted (SPEC §6.4)
                └──────────┬───────────┘
                           ▼
                ┌──────────────────────┐
                │ sealed-registry.json │   schema_version: 1
                │                      │   summary + records (lex-sorted)
                └──────────────────────┘
```

Raw tokens never leave RAM. Stdout reports counts only. Records carry redacted
representations and 12-hex fingerprints (`sha256(token.utf-8).hex[:12]`).

## Quick start

```bash
cd ~/github/liye_os/tools/phase-0b-parser
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
phase-0b-parser --help
```

## CLI usage

```bash
# Default — scan ~/github/ portfolio, write var/sealed-registry.json
phase-0b-parser

# Override portfolio root + explicit output
phase-0b-parser \
    --portfolio-root /path/to/portfolio \
    --output build/sealed-registry.json

# Add Medusa DB scan (REST /admin/api-keys, read-only)
MEDUSA_ADMIN_URL=http://localhost:9000 \
MEDUSA_ADMIN_TOKEN=<bearer> \
phase-0b-parser --output build/sealed-registry.json

# Strict mode — CI gate
phase-0b-parser --strict --output build/sealed-registry.json
```

### Flags

| Flag | Default | Notes |
|---|---|---|
| `--portfolio-root` | `$LIYE_PORTFOLIO_ROOT` or `~/github` | Disk scan root |
| `--db-url` | `$MEDUSA_ADMIN_URL` or unset → skip | DB scan endpoint |
| `--output` | `var/sealed-registry.json` (cwd-relative) | See note below |
| `--strict` | off | Escalatable WARN → exit 2 |

**`--output` default note:** the default is `var/sealed-registry.json` resolved
against the current working directory. This is intentional for interactive
developer use (the `var/` directory is whitelisted under SPEC §6.4). **Phase 0C
integration callers should always pass `--output` explicitly** to avoid relying
on `cwd` semantics across automated pipelines.

### Environment variables

| Var | Purpose | Why env-only |
|---|---|---|
| `MEDUSA_ADMIN_URL` | Medusa admin endpoint | URL is safe as flag too |
| `MEDUSA_ADMIN_TOKEN` | Bearer for `/admin/api-keys` | Never a flag — would leak to shell history |
| `LIYE_PORTFOLIO_ROOT` | Disk scan root override | Lower precedence than `--portfolio-root` |

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Happy path — `sealed-registry.json` written |
| `2` | `--strict` violation (escalatable WARN: db_validity=unknown, fp_collision, or requires_human_confirmation) |
| `3` | Output path violation — path outside SPEC §6.4 whitelist; **no file created** |

## Output schema

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

All keys are snake_case lowercase. Records are lex-sorted by
`fingerprint_sha256_12` for deterministic output. The `collision_detected`
field is always `false` in Phase 0B-1 (Phase 0B-2 will activate real fp[:12]
collision detection via the additive `fingerprint_full` field).

## Test suite

```bash
pytest -v                              # 126 cases (target: all PASS)
bash scripts/lint-verb-whitelist.sh    # SPEC §6.1 verb prefix whitelist
bash scripts/lint-mutation-ban.sh      # SPEC §6.4 three-layer mutation ban
```

### Fixtures (F1–F15 + F7b)

| ID | Coverage |
|---|---|
| F1 | Ghost — disk-only `sk_` token in `sf-mock/.env.local` |
| F2 | Ghost — stale `.env.production.example` (suffix-excluded from consumers) |
| F3 | Orphan/ad-hoc — DB-only token, non-seed title, zero consumers |
| F4 | Orphan/system-seed-suspected — DB title contains seed keyword, zero consumers |
| F5 | Live — DB + one active consumer |
| F6 | Live multi-consumer — same fp across N storefronts collapses to 1 record / N paths |
| F7 | Live master + replica — silkbay double-env + replica chain |
| F7b | Reverse-coverage governance — `.env.production` active vs `.env.production.example` excluded (suffix not substring) |
| F8 | JWT in user-level `~/.claude/settings.local.json` |
| F9 | Governance defense — DB seed title + active consumer → MUST classify as live, not orphan |
| F10 | Envelope double-threshold compatibility check (R1 wrap) |
| F11 | Path normalization — `~` / `$HOME` / relative → absolute realpath |
| F12 | Empty `.env.local` edge case |
| F13 | Malformed JSON → WARN + skip (no raise) |
| F14 | DB graceful degrade — ConnectionError / 401 / 5xx / Timeout / malformed → empty set + WARN |
| F15 | Full pipeline union — disk ∪ db ∪ consumer all carrying same fp collapses correctly |

### Lint

- **Verb prefix whitelist** (SPEC §6.1) — module-level `def` must start with
  `classify_` / `is_` / `list_` / `report_` / `scan_`. Helpers carry leading
  underscores and fall outside the pattern by design.
- **Mutation ban** (SPEC §6.4) — three layers:
  1. `subprocess` calls (with `# noqa: read-only-exec` exemption)
  2. HTTP write methods (post / put / delete / patch on requests / httpx)
  3. SDK / ORM mutation idioms (`.update(` / `.save(` / `.delete(` in code AND
     docstrings)
- **CI defense-in-depth** — the GitHub Actions workflow runs an additional
  `grep -rnE '\.update\(|\.save\(|\.delete\('` over `src/` + `tests/` so a
  tampered lint script still cannot let mutators slip through.

## Governance

- SPEC SSOT: [`_meta/portfolio/PHASE-0B-SPEC.md`](../../_meta/portfolio/PHASE-0B-SPEC.md) (L1 protected)
- Portfolio governance: [`_meta/portfolio/AUTOMATION_GOVERNANCE.md`](../../_meta/portfolio/AUTOMATION_GOVERNANCE.md)
- CI workflow: [`.github/workflows/phase-0b-parser-ci.yml`](../../.github/workflows/phase-0b-parser-ci.yml)

Package path is `src/phase_0b_parser/` (Python module names cannot start with a
digit). SPEC §6.1 line 247 references `src/0b/` illustratively; the verb-prefix
lint reads the actual package path. No SPEC content was changed.

## Known limitations

- **Collision detection is a stub** in Phase 0B-1. `collision_detected` always
  reports `false`. Phase 0B-2 activates real fp[:12] collision detection via
  the additive `fingerprint_full` field.
- **System-seed gate is not enforced here.** The `sub_classification` field
  tags `"system-seed-suspected"` and `"ad-hoc"`, but the gating workflow (block
  rotation, require human confirmation) is Phase 0B-2 / SPEC §3.1.
- **Audit-event helper CLI is not in scope.** Phase 0B-1 emits the artifact
  only; Phase 0C will add the `audit-event` integration layer.
- **DB scan is REST-only.** The Medusa internal `query.graph` SDK is not
  importable from this standalone tool, so `scan_db` uses
  `GET /admin/api-keys?type={secret,publishable}` paginated at `limit=100`.

## Roadmap

- **Phase 0B-2** — system-seed-gate workflow; real collision detection;
  `fingerprint_full` additive field.
- **Phase 0C** — audit-event helper CLI; portfolio automation pipeline
  integration; PreToolUse hook `is_sealed_path` predicate.
- **SPEC v3 → v4 ceremony** — reconcile 13 inherited additive drift items
  (M3 `revoked_at`/`key_type` extensions; M4 `source_origins`; M5 enum case
  + sub-classification spelling + 4 disposition fields; M6 envelope
  `generated_at` + snake_case lock + `sealed` field). All drift is additive
  and backward-compatible.

## CHANGELOG

See [`CHANGELOG.md`](./CHANGELOG.md).
