"""F9 — Governance invariant: Live + system-seed title signal → live (not orphan).

Per M5 dispatch brief governance invariant (truth table row 8):
    Title containing "Seed" / "System" MUST NOT promote a fp with active
    consumer references into orphan. Consumer-anchor wins over title-keyword
    trigger. The title_signal_score is still recorded (=1) for ops/audit
    reference, but sub_classification stays None because live records have
    no sub-class dimension.

This is the **defense invariant** that protects production credentials from
being misclassified by an overly-aggressive title-signal gate.
"""

from __future__ import annotations

import hashlib

import responses

from phase_0b_parser.classify_credentials import classify_credentials
from phase_0b_parser.scan_consumers import _merge_records, scan_consumers
from phase_0b_parser.scan_db import scan_db
from phase_0b_parser.scan_disk import scan_disk
from phase_0b_parser.verbs import is_live, is_orphan

F9_TOKEN = "pk_F9MOCKliveSystemSeedBootstrapKey123"
F9_FP = hashlib.sha256(F9_TOKEN.encode("utf-8")).hexdigest()[:12]

MOCK_URL = "http://localhost:9999"
MOCK_ADMIN_TOKEN = "F9_MOCK_admin_token_not_real_xxxxxxxxxxxx"


@responses.activate
def test_F9_live_overrides_seed_title_signal(tmp_path):
    """DB title 'System Seed - Storefront Bootstrap' + 1 active .env.local consumer
    → classification MUST be live, NOT orphan/system-seed-suspected.
    """
    # Active consumer fixture: token wired into a real .env.local.
    root = tmp_path / "tests" / "fixtures" / "F9_live_seed_title"
    sf = root / "storefronts" / "sf-bootstrap"
    sf.mkdir(parents=True)
    (sf / ".env.local").write_text(f"NEXT_PUBLIC_MEDUSA_PK={F9_TOKEN}\n")

    # DB returns the same token with a seed-keyword title.
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
                    "id": "ak_F9_mock",
                    "type": "publishable",
                    "title": "System Seed - Storefront Bootstrap",
                    "token": F9_TOKEN,
                    "created_at": "2025-11-15T00:00:00Z",
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
    assert rec.fingerprint_sha256_12 == F9_FP

    # === Governance invariant ============================================
    # Live MUST win over title-keyword orphan trigger.
    assert rec.classification == "live", (
        f"F9 governance violated: title 'System Seed ...' with active consumer "
        f"must classify as live, got {rec.classification!r}"
    )
    assert is_live(rec) is True
    assert is_orphan(rec) is False, (
        "F9 governance violated: live record must NOT also be orphan"
    )
    # Live has no sub-class dimension — sub_classification stays None even
    # though title_signal_score is recorded.
    assert rec.sub_classification is None
    # Title signal still recorded for ops/audit visibility.
    assert rec.title_signal_score == 1
    assert rec.requires_human_confirmation is False
    assert rec.recommended_disposition == "keep+rotate-when-ready"
    assert rec.consumer_paths, "consumer_paths must be populated"
    assert rec.db_metadata is not None
