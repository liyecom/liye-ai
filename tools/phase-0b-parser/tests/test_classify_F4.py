"""F4 — Orphan + system-seed-suspected (title keyword "Default" / "Admin").

Per PHASE-0B-SPEC.md §7 line 324 + brief M5 truth table row 3:
    "Orphan — system-seed naming | DB active + 0 consumer + title 含
     'Default' → classification=orphan, sub=system-seed-suspected,
     title_signal_score=1, requires_human=True."

M5 only TAGS the sub_classification — Phase 0B-2 will activate the
system-seed-gate behavior (SPEC §3.1 / §11.2 M8).
"""

from __future__ import annotations

import hashlib

import responses

from phase_0b_parser.classify_credentials import classify_credentials
from phase_0b_parser.scan_consumers import _merge_records, scan_consumers
from phase_0b_parser.scan_db import scan_db
from phase_0b_parser.scan_disk import scan_disk
from phase_0b_parser.verbs import is_orphan

F4_TOKEN = "pk_F4MOCKorphanDefaultAdminSeedToken12"
F4_FP = hashlib.sha256(F4_TOKEN.encode("utf-8")).hexdigest()[:12]

MOCK_URL = "http://localhost:9999"
MOCK_ADMIN_TOKEN = "F4_MOCK_admin_token_not_real_xxxxxxxxxxxx"


@responses.activate
def test_F4_orphan_system_seed_suspected(tmp_path):
    """DB active + no consumer + title 'Default Admin Token' → orphan/seed-suspected/human-review."""
    root = tmp_path / "tests" / "fixtures" / "F4_orphan_seed"
    root.mkdir(parents=True)

    # Publishable sweep returns the seed-suspected token.
    responses.add(
        responses.GET,
        f"{MOCK_URL}/admin/api-keys",
        json={"api_keys": [], "count": 0, "offset": 0, "limit": 100},
        status=200,
    )
    responses.add(
        responses.GET,
        f"{MOCK_URL}/admin/api-keys",
        json={
            "api_keys": [
                {
                    "id": "ak_F4_mock",
                    "type": "publishable",
                    "title": "Default Admin Token",
                    "token": F4_TOKEN,
                    "created_at": "2025-12-01T00:00:00Z",
                    "revoked_at": None,
                }
            ],
            "count": 1, "offset": 0, "limit": 100,
        },
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
    assert rec.fingerprint_sha256_12 == F4_FP
    assert rec.classification == "orphan"
    assert is_orphan(rec) is True
    assert rec.sub_classification == "system-seed-suspected"
    assert rec.title_signal_score == 1
    assert rec.requires_human_confirmation is True
    assert rec.recommended_disposition == "human-review"
    assert rec.consumer_paths == []
    assert rec.db_metadata is not None
    assert rec.db_metadata.title == "Default Admin Token"
