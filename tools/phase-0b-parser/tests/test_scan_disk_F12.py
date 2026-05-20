"""F12 — Empty .env.local. Per PHASE-0B-SPEC.md §7 line 332 + §11.1 M2.

Edge case: zero-byte file must not crash the parser.

Fixture is materialized at runtime via `tmp_path` rather than checked in as a
literal `.env.local` file: the liye_os pre-commit hook (.claude/.githooks/
pre-commit line 84) hard-blocks any `.env*` file in staging.
"""

from __future__ import annotations

from phase_0b_parser.scan_disk import scan_disk


def test_F12_empty_env_does_not_crash(tmp_path):
    root = tmp_path / "tests" / "fixtures" / "F12_empty"
    silkbay = root / "silkbay"
    silkbay.mkdir(parents=True)
    (silkbay / ".env.local").touch()

    records = scan_disk(root)
    assert records == set()
