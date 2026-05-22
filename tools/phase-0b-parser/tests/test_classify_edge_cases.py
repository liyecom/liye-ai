"""M5 edge cases — db_validity='unknown' override + disk_duplicate_paths fill.

Per M5 dispatch brief:
  - db_validity == 'unknown' → requires_human_confirmation=True (overrides
    truth table False states) + disposition suffixed
    '+verify-db-when-reachable'.
  - disk_duplicate_paths populated when >=2 disk_sources for same fp.
    SPEC §6.2 line 260 lists this as M4 deliverable; deferred to M5.
"""

from __future__ import annotations

from phase_0b_parser.classify_credentials import classify_credentials
from phase_0b_parser.models import DbMetadata, DiskSource, FingerprintRecord


def test_db_validity_unknown_forces_human_review_for_live():
    """Live record with db_validity='unknown' → requires_human=True + suffix.

    Scenario: scan_db degraded (network failure), but scan_disk + scan_consumers
    found the token live in tree. Classification stays live (consumer anchor)
    but we need DB re-verification before any rotation action.
    """
    rec = FingerprintRecord(
        fingerprint_sha256_12="abcdef012345",
        key_type="sk_",
        redacted="sk_aaa***bbb",
        disk_sources=[DiskSource(path="storefronts/sf-x/.env.local", line=3)],
        db_validity="unknown",  # scan_db unreachable.
        db_metadata=None,
        consumer_paths=["storefronts/sf-x/.env.local"],
    )

    classified = classify_credentials({rec})
    out = next(iter(classified))
    assert out.classification == "live"
    # Live row 6 would default to requires_human=False; unknown forces True.
    assert out.requires_human_confirmation is True
    assert out.recommended_disposition.endswith("+verify-db-when-reachable"), (
        f"disposition must carry verification suffix when db_validity=unknown, "
        f"got {out.recommended_disposition!r}"
    )
    # Base disposition is preserved before suffix.
    assert "keep+rotate-when-ready" in out.recommended_disposition


def test_db_validity_unknown_with_db_metadata_present_still_human_review():
    """db_metadata present but db_validity='unknown' — defensive path.

    Rare scenario (e.g. cached metadata with current scan degraded). Should
    still force human review.
    """
    rec = FingerprintRecord(
        fingerprint_sha256_12="111222333444",
        key_type="sk_",
        redacted="sk_ccc***ddd",
        disk_sources=[],
        db_validity="unknown",
        db_metadata=DbMetadata(
            id="ak_unknown_validity",
            title="ImportTool",
            created_at="2026-05-01T00:00:00Z",
        ),
        consumer_paths=[],
    )
    classified = classify_credentials({rec})
    out = next(iter(classified))
    # has_db is True (db_metadata not None) → orphan/ad-hoc base.
    assert out.classification == "orphan"
    assert out.sub_classification == "ad-hoc"
    # unknown forces human-review regardless of base requires_human.
    assert out.requires_human_confirmation is True
    assert out.recommended_disposition.endswith("+verify-db-when-reachable")
    assert "revoke" in out.recommended_disposition


def test_disk_duplicate_paths_populated_when_multiple_disk_sources():
    """>=2 disk_sources for same fp → disk_duplicate_paths sorted POSIX list.

    SPEC §6.2 line 260 — disk_duplicate_paths fill (M4-deferred → M5).
    """
    rec = FingerprintRecord(
        fingerprint_sha256_12="dup0000abcde",
        key_type="sk_",
        redacted="sk_dup***xyz",
        disk_sources=[
            DiskSource(path="storefronts/sf-b/.env.production.example", line=1),
            DiskSource(path="silkbay/.planning/baseline/old.env", line=2),
            DiskSource(path="storefronts/sf-a/.env.local.bak", line=4),
        ],
        db_validity="absent",
        db_metadata=None,
        consumer_paths=[],
    )

    classified = classify_credentials({rec})
    out = next(iter(classified))
    # No consumer + no db + disk → ghost.
    assert out.classification == "ghost"
    # Sorted lex; deduplicated.
    assert out.disk_duplicate_paths == sorted([
        "storefronts/sf-b/.env.production.example",
        "silkbay/.planning/baseline/old.env",
        "storefronts/sf-a/.env.local.bak",
    ])


def test_disk_duplicate_paths_empty_for_single_source():
    """Exactly 1 disk_source → disk_duplicate_paths stays empty."""
    rec = FingerprintRecord(
        fingerprint_sha256_12="single000abc",
        key_type="sk_",
        redacted="sk_one***zzz",
        disk_sources=[DiskSource(path="storefronts/sf-x/.env.local", line=1)],
        db_validity="absent",
        db_metadata=None,
        consumer_paths=[],
    )
    classified = classify_credentials({rec})
    out = next(iter(classified))
    assert out.disk_duplicate_paths == []
