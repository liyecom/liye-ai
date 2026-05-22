"""F3 — Orphan: ad-hoc title (no seed keyword).

Per PHASE-0B-SPEC.md §7 line 323 + brief M5 truth table row 2:
    "Orphan — ad-hoc title | DB active + 0 consumer + 普通命名 →
     classification=Orphan, sub=ad-hoc."

DB returns a token with title "ImportTool Migration 2026-Q1" — no seed
keyword match → title_signal_score=0 → sub_classification=ad-hoc.
"""

from __future__ import annotations

import hashlib

import responses

from phase_0b_parser.classify_credentials import classify_credentials
from phase_0b_parser.scan_consumers import _merge_records, scan_consumers
from phase_0b_parser.scan_db import scan_db
from phase_0b_parser.scan_disk import scan_disk
from phase_0b_parser.verbs import is_orphan

F3_TOKEN = "sk_F3MOCKorphanAdhocMigrationTool1234"
F3_FP = hashlib.sha256(F3_TOKEN.encode("utf-8")).hexdigest()[:12]

MOCK_URL = "http://localhost:9999"
MOCK_ADMIN_TOKEN = "F3_MOCK_admin_token_not_real_xxxxxxxxxxxx"


@responses.activate
def test_F3_orphan_ad_hoc(tmp_path):
    """DB active + no consumer + ordinary title → orphan/ad-hoc/revoke."""
    # Empty disk fixture (no token in tree).
    root = tmp_path / "tests" / "fixtures" / "F3_orphan_adhoc"
    root.mkdir(parents=True)

    # DB returns the token with ordinary (non-seed) title.
    responses.add(
        responses.GET,
        f"{MOCK_URL}/admin/api-keys",
        json={
            "api_keys": [
                {
                    "id": "ak_F3_mock",
                    "type": "secret",
                    "title": "ImportTool Migration 2026-Q1",
                    "token": F3_TOKEN,
                    "created_at": "2026-04-01T00:00:00Z",
                    "revoked_at": None,
                }
            ],
            "count": 1, "offset": 0, "limit": 100,
        },
        status=200,
    )
    # Publishable sweep empty.
    responses.add(
        responses.GET,
        f"{MOCK_URL}/admin/api-keys",
        json={"api_keys": [], "count": 0, "offset": 0, "limit": 100},
        status=200,
    )

    disk_records = scan_disk(root)
    db_records = scan_db(MOCK_URL, MOCK_ADMIN_TOKEN)
    known_fps = {r.fingerprint_sha256_12 for r in disk_records | db_records}
    consumer_map = scan_consumers(root, known_fps)

    unified = _merge_records(disk_records, db_records, consumer_map)
    classified = classify_credentials(unified)

    assert len(classified) == 1
    rec = next(iter(classified))
    assert rec.fingerprint_sha256_12 == F3_FP
    assert rec.classification == "orphan"
    assert is_orphan(rec) is True
    assert rec.sub_classification == "ad-hoc"
    assert rec.title_signal_score == 0
    assert rec.requires_human_confirmation is False
    assert rec.recommended_disposition == "revoke"
    assert rec.consumer_paths == []
    assert rec.disk_sources == []
    assert rec.db_metadata is not None
    assert rec.db_metadata.title == "ImportTool Migration 2026-Q1"
