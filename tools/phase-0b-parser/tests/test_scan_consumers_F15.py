"""F15 — Union semantics: same fp across disk ∪ db ∪ consumer collapses to one record.

Per PHASE-0B-SPEC.md §7 line 335 + §5.2 line 196 + §11.1 M4 line 457:
    "Multiple keys same fp — 假设极小概率冲突 → parser 合并 disk_sources，
    不分裂 record."

F15 here exercises the full pipeline merge — disk_records ∪ db_records ∪
consumer_map → single FingerprintRecord per fp. We validate:
  - source_origins == {"disk", "db", "consumer"} (full union)
  - consumer_paths populated
  - disk_sources non-empty
  - db_metadata non-None
"""

from __future__ import annotations

import hashlib

import responses

from phase_0b_parser.scan_consumers import _merge_records, scan_consumers
from phase_0b_parser.scan_db import scan_db
from phase_0b_parser.scan_disk import scan_disk


F15_TOKEN = "sk_F15MOCKunionDISKdbCONSUMER1234abc"
F15_FP = hashlib.sha256(F15_TOKEN.encode("utf-8")).hexdigest()[:12]

MOCK_URL = "http://localhost:9999"
MOCK_ADMIN_TOKEN = "F15_MOCK_admin_token_not_real_xxxxxxxxxxxx"


@responses.activate
def test_F15_union_semantics_full_pipeline(tmp_path):
    """Disk ∪ DB ∪ Consumer all carry same fp → 1 unified record."""
    # --- Disk fixture: token in storefront .env.local ---
    root = tmp_path / "tests" / "fixtures" / "F15_union"
    sf = root / "storefronts" / "sf-mock"
    sf.mkdir(parents=True)
    (sf / ".env.local").write_text(f"MEDUSA_TOKEN={F15_TOKEN}\n")

    # --- DB fixture: mock /admin/api-keys returning same token ---
    responses.add(
        responses.GET,
        f"{MOCK_URL}/admin/api-keys",
        json={
            "api_keys": [
                {
                    "id": "ak_F15_mock",
                    "type": "secret",
                    "title": "F15 union semantics mock",
                    "token": F15_TOKEN,
                    "created_at": "2026-05-19T00:00:00Z",
                    "revoked_at": None,
                }
            ],
            "count": 1,
            "offset": 0,
            "limit": 100,
        },
        status=200,
    )
    # Satisfy publishable sweep with empty page.
    responses.add(
        responses.GET,
        f"{MOCK_URL}/admin/api-keys",
        json={"api_keys": [], "count": 0, "offset": 0, "limit": 100},
        status=200,
    )

    # --- Run full pipeline ---
    disk_records = scan_disk(root)
    db_records = scan_db(MOCK_URL, MOCK_ADMIN_TOKEN)

    known_fps = {r.fingerprint_sha256_12 for r in disk_records | db_records}
    consumer_map = scan_consumers(root, known_fps)

    unified = _merge_records(disk_records, db_records, consumer_map)

    # --- Assertions: single record, full source union ---
    assert len(disk_records) == 1
    assert len(db_records) == 1
    assert F15_FP in consumer_map
    assert len(unified) == 1, (
        f"union semantics violated — expected 1 merged record, got {len(unified)}"
    )

    rec = next(iter(unified))
    assert rec.fingerprint_sha256_12 == F15_FP
    assert rec.source_origins == {"disk", "db", "consumer"}, (
        f"source_origins union incomplete: {rec.source_origins}"
    )
    assert rec.consumer_paths, "consumer_paths must be populated by F15 pipeline"
    assert rec.disk_sources, "disk_sources must be populated"
    assert rec.db_metadata is not None, "db_metadata must be populated"
    assert rec.db_metadata.id == "ak_F15_mock"
    assert rec.db_validity == "present"


def test_F15_merge_records_disk_only(tmp_path):
    """Disk-only fp — merged record has source_origins={"disk"}, no db/consumer."""
    root = tmp_path / "tests" / "fixtures" / "F15_disk_only"
    sf = root / "storefronts" / "sf-only"
    sf.mkdir(parents=True)
    (sf / ".env.local").write_text(f"TOKEN={F15_TOKEN}\n")

    disk_records = scan_disk(root)
    # Empty db_records and empty consumer_map.
    unified = _merge_records(disk_records, set(), {})

    assert len(unified) == 1
    rec = next(iter(unified))
    assert rec.source_origins == {"disk"}
    assert rec.consumer_paths == []
    assert rec.db_metadata is None


@responses.activate
def test_F15_merge_records_db_only():
    """DB-only fp (token NOT on disk) — merged record has source_origins={"db"}."""
    responses.add(
        responses.GET,
        f"{MOCK_URL}/admin/api-keys",
        json={
            "api_keys": [
                {
                    "id": "ak_F15_db_only",
                    "type": "secret",
                    "title": "F15 db-only orphan",
                    "token": F15_TOKEN,
                    "created_at": "2026-05-19T00:00:00Z",
                    "revoked_at": None,
                }
            ],
            "count": 1,
            "offset": 0,
            "limit": 100,
        },
        status=200,
    )
    responses.add(
        responses.GET,
        f"{MOCK_URL}/admin/api-keys",
        json={"api_keys": [], "count": 0, "offset": 0, "limit": 100},
        status=200,
    )

    db_records = scan_db(MOCK_URL, MOCK_ADMIN_TOKEN)
    unified = _merge_records(set(), db_records, {})

    assert len(unified) == 1
    rec = next(iter(unified))
    assert rec.source_origins == {"db"}
    assert rec.db_metadata is not None
    assert rec.disk_sources == []
    assert rec.consumer_paths == []
