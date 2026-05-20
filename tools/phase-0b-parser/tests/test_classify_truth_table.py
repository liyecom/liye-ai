"""8 + 1 truth-table parametrize cases for classify_credentials (M5).

Source: M5 dispatch brief binding truth table.

| # | disk | db    | consumer | classification | sub_class              | requires_human | disposition              |
|---|------|-------|----------|----------------|------------------------|----------------|--------------------------|
| 0 | T    | F     | F        | ghost          | None                   | False          | archive                  |
| 1 | F    | T(kw0)| F        | orphan         | ad-hoc                 | False          | revoke                   |
| 2 | F    | T(kw1)| F        | orphan         | system-seed-suspected  | True           | human-review             |
| 3 | T    | T(kw0)| F        | orphan         | ad-hoc                 | False          | revoke                   |
| 4 | T    | T(kw1)| F        | orphan         | system-seed-suspected  | True           | human-review             |
| 5 | F    | F     | T        | live           | None                   | False          | keep+investigate-source  |
| 6 | T    | F     | T        | live           | None                   | False          | keep+rotate-when-ready   |
| 7 | F    | T(kw1)| T        | live           | None                   | False          | keep+rotate-when-ready   |
| 8 | T    | T(kw0)| T        | live           | None                   | False          | keep+rotate-when-ready   |

Row 7 is the F9 governance invariant smoke (seed-keyword title with active
consumer → live, NOT orphan). Mutex exhaustion (exactly one of
is_ghost/is_orphan/is_live True) is verified for every row.
"""

from __future__ import annotations

import hashlib

import pytest

from phase_0b_parser.classify_credentials import classify_credentials
from phase_0b_parser.models import DbMetadata, DiskSource, FingerprintRecord
from phase_0b_parser.verbs import is_ghost, is_live, is_orphan


def _make_record(
    *,
    has_disk: bool,
    has_db: bool,
    has_consumer: bool,
    title: str | None,
) -> FingerprintRecord:
    """Synthesise a FingerprintRecord with the requested source presence.

    Direct dataclass construction — no merge pipeline involved (truth table
    is a unit test of `classify_credentials` semantics, not the pipeline).
    """
    fp_seed = f"truth-{int(has_disk)}{int(has_db)}{int(has_consumer)}-{title}"
    fp = hashlib.sha256(fp_seed.encode("utf-8")).hexdigest()[:12]

    disk_sources: list[DiskSource] = []
    if has_disk:
        disk_sources = [DiskSource(path="storefronts/sf-x/.env.local", line=1)]

    db_metadata: DbMetadata | None = None
    db_validity = "absent"
    if has_db:
        db_metadata = DbMetadata(
            id="ak_truth_mock",
            title=title or "",
            created_at="2026-05-19T00:00:00Z",
        )
        db_validity = "present"

    consumer_paths: list[str] = []
    if has_consumer:
        consumer_paths = ["storefronts/sf-x/.env.local"]

    return FingerprintRecord(
        fingerprint_sha256_12=fp,
        key_type="sk_",
        redacted="sk_xxx***yyy",
        disk_sources=disk_sources,
        db_validity=db_validity,
        db_metadata=db_metadata,
        consumer_paths=consumer_paths,
    )


TRUTH_TABLE = [
    # (id, has_disk, has_db, has_consumer, title, cls, sub, requires_human, disposition)
    ("row0_ghost_disk_only",
        True,  False, False, None,
        "ghost",  None,                    False, "archive"),
    ("row1_orphan_db_kw0",
        False, True,  False, "ImportTool Migration",
        "orphan", "ad-hoc",                False, "revoke"),
    ("row2_orphan_db_kw1_default",
        False, True,  False, "Default Admin",
        "orphan", "system-seed-suspected", True,  "human-review"),
    ("row3_orphan_disk_db_kw0",
        True,  True,  False, "Migration Tool",
        "orphan", "ad-hoc",                False, "revoke"),
    ("row4_orphan_disk_db_kw1_system",
        True,  True,  False, "System Bootstrap",
        "orphan", "system-seed-suspected", True,  "human-review"),
    ("row5_live_consumer_only",
        False, False, True,  None,
        "live",   None,                    False, "keep+investigate-source"),
    ("row6_live_disk_consumer",
        True,  False, True,  None,
        "live",   None,                    False, "keep+rotate-when-ready"),
    ("row7_live_db_seed_kw_with_consumer",  # F9 governance row.
        False, True,  True,  "Seed Bootstrap",
        "live",   None,                    False, "keep+rotate-when-ready"),
    ("row8_live_all_three_kw0",
        True,  True,  True,  "Migration Tool",
        "live",   None,                    False, "keep+rotate-when-ready"),
]


@pytest.mark.parametrize(
    "row_id,has_disk,has_db,has_consumer,title,exp_cls,exp_sub,exp_rh,exp_disp",
    TRUTH_TABLE,
    ids=[row[0] for row in TRUTH_TABLE],
)
def test_truth_table(row_id, has_disk, has_db, has_consumer, title, exp_cls, exp_sub, exp_rh, exp_disp):
    """One row of the M5 truth table → classify yields the expected tuple."""
    rec = _make_record(has_disk=has_disk, has_db=has_db, has_consumer=has_consumer, title=title)
    classified = classify_credentials({rec})

    assert len(classified) == 1
    out = next(iter(classified))
    assert out.classification == exp_cls, (
        f"{row_id}: classification expected {exp_cls!r}, got {out.classification!r}"
    )
    assert out.sub_classification == exp_sub, (
        f"{row_id}: sub_classification expected {exp_sub!r}, got {out.sub_classification!r}"
    )
    assert out.requires_human_confirmation is exp_rh, (
        f"{row_id}: requires_human expected {exp_rh}, got {out.requires_human_confirmation}"
    )
    assert out.recommended_disposition == exp_disp, (
        f"{row_id}: disposition expected {exp_disp!r}, got {out.recommended_disposition!r}"
    )


@pytest.mark.parametrize(
    "row_id,has_disk,has_db,has_consumer,title,exp_cls,exp_sub,exp_rh,exp_disp",
    TRUTH_TABLE,
    ids=[row[0] for row in TRUTH_TABLE],
)
def test_is_ghost_orphan_live_mutex_exhaustive(
    row_id, has_disk, has_db, has_consumer, title, exp_cls, exp_sub, exp_rh, exp_disp,
):
    """For every truth-table row, exactly ONE of is_ghost/is_orphan/is_live is True."""
    rec = _make_record(has_disk=has_disk, has_db=has_db, has_consumer=has_consumer, title=title)
    classified = classify_credentials({rec})
    out = next(iter(classified))

    truths = [is_ghost(out), is_orphan(out), is_live(out)]
    true_count = sum(1 for t in truths if t)
    assert true_count == 1, (
        f"{row_id}: mutex invariant violated — "
        f"is_ghost={truths[0]}, is_orphan={truths[1]}, is_live={truths[2]} "
        f"(classification={out.classification!r})"
    )
    # And the True one matches expected classification.
    classifier_map = {"ghost": is_ghost, "orphan": is_orphan, "live": is_live}
    assert classifier_map[exp_cls](out) is True


def test_title_signal_score_recorded_for_live_with_seed_keyword():
    """Live records with seed-keyword title still report title_signal_score=1.

    Brief invariant: sub_classification stays None (live has no sub-class
    dimension), but title_signal_score is the raw ops signal — record it.
    """
    rec = _make_record(has_disk=False, has_db=True, has_consumer=True, title="Seed Bootstrap")
    classified = classify_credentials({rec})
    out = next(iter(classified))
    assert out.classification == "live"
    assert out.sub_classification is None
    assert out.title_signal_score == 1
