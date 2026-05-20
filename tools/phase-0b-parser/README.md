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
| M3 — `scan_db` + F14 | pending | §11.1 line 456 |
| M4 — `scan_consumers` + F5/F6/F7/F7b/F15 | pending | §11.1 line 457 |
| M5 — `classify_credentials` + F2/F3/F4 | pending | §11.1 line 458 |
| M6 — `report_sealed_registry` + `--strict` + write boundary | pending | §11.1 line 459 |
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
│   ├── cli.py                    # M2 — `phase-0b-parser` entry point
│   ├── scan_db.py                # M3 stub
│   ├── scan_consumers.py         # M4 stub
│   ├── classify_credentials.py   # M5 stub
│   ├── report_sealed_registry.py # M6 stub
│   └── verbs.py                  # is_sealed / is_ghost / is_orphan / is_live stubs
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

## CLI (M2)

```bash
# Default — scans ~/github/ portfolio (allowlist applied per CLAUDE.md).
phase-0b-parser

# Explicit root (overrides env var).
phase-0b-parser --portfolio-root /path/to/portfolio

# Or via env var (CLI flag still takes precedence when both are set).
LIYE_PORTFOLIO_ROOT=/path/to/portfolio phase-0b-parser
```

M2 output is count-only. Redacted fingerprints land in `sealed-registry.json`
when M6 ships; raw tokens never leave RAM.

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
