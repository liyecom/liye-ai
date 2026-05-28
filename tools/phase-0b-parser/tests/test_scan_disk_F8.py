"""F8 — JWT in user-level config. Per PHASE-0B-SPEC.md §7 line 329 + §11.1 M2.

Fixture lives under `dotclaude/` (not `.claude/`) so the production
`~/.claude/` glob can never absorb mock fixture data. The fixture-mode
detection in scan_disk lets all JSON files under the fixture root be parsed.

Mock JWT — payload claims `sub: mock-f8-user-level`. Not a real token.
"""

from __future__ import annotations

import hashlib

from phase_0b_parser.scan_disk import scan_disk


F8_TOKEN = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJzdWIiOiJtb2NrLWY4LXVzZXItbGV2ZWwifQ"
    ".SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
)
F8_FP = hashlib.sha256(F8_TOKEN.encode("utf-8")).hexdigest()[:12]


def test_F8_scan_disk_captures_jwt_in_settings_local(fixtures_dir):
    """JWT embedded in JSON permissions.allow[] → captured with JSON path."""
    root = fixtures_dir / "F8_jwt"
    records = scan_disk(root)

    assert len(records) == 1, f"expected exactly 1 record, got {len(records)}"
    rec = next(iter(records))

    assert rec.key_type == "jwt"
    assert rec.fingerprint_sha256_12 == F8_FP

    assert len(rec.disk_sources) == 1
    src = rec.disk_sources[0]
    assert "settings.local.json" in src.path
    # JSON path form: permissions.allow[1]
    assert src.env_var is not None
    assert "permissions" in src.env_var
    assert "allow" in src.env_var
    # The JWT lives in the 2nd element (index 1) of the allow array.
    assert "[1]" in src.env_var
