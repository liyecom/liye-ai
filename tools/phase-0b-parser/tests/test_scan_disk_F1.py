"""F1 — Ghost (disk only). Per PHASE-0B-SPEC.md §7 line 321 + §11.1 M2 line 455.

Mock `sk_` token plaintext on disk; no DB cross-check yet (that's M3/M5).
Validates: scan_disk picks up the token, fingerprint formula correct,
disk_sources path/env_var/line populated.

Mock token, not a real portfolio credential.

Fixture is materialized at runtime via `tmp_path` rather than checked in as a
literal `.env.local` file: the liye_os pre-commit hook (.claude/.githooks/
pre-commit line 84) hard-blocks any `.env*` file in staging by design.
The tmp_path is constructed to include `tests/fixtures` so that scan_disk's
fixture-mode detection (suppresses `~/.claude/` scan) still fires.
"""

from __future__ import annotations

import hashlib

from phase_0b_parser.scan_disk import scan_disk


F1_TOKEN = "sk_F1MOCKghost1234567890abcdefXYZ"
F1_FP = hashlib.sha256(F1_TOKEN.encode("utf-8")).hexdigest()[:12]


def test_F1_scan_disk_captures_ghost_plaintext(tmp_path):
    """Single sk_ token in storefronts/sf-mock/.env.local → 1 record."""
    root = tmp_path / "tests" / "fixtures" / "F1_ghost"
    sf_mock = root / "storefronts" / "sf-mock"
    sf_mock.mkdir(parents=True)
    (sf_mock / ".env.local").write_text(
        "DB_URL=postgres://user:pass@localhost/db\n"
        f"MEDUSA_ADMIN_TOKEN={F1_TOKEN}\n"
        "PORT=9000\n"
    )

    records = scan_disk(root)

    assert len(records) == 1, f"expected exactly 1 record, got {len(records)}"
    rec = next(iter(records))

    assert rec.key_type == "sk_"
    assert rec.fingerprint_sha256_12 == F1_FP
    assert rec.redacted.startswith("sk_F1M")
    assert rec.redacted.endswith("XYZ")
    assert "***" in rec.redacted

    assert len(rec.disk_sources) == 1
    src = rec.disk_sources[0]
    assert "sf-mock/.env.local" in src.path
    assert src.env_var == "MEDUSA_ADMIN_TOKEN"
    assert src.line == 2

    assert rec.classification is None
    assert rec.consumer_paths == []
    assert rec.disk_duplicate_paths == []
    assert rec.db_metadata is None
