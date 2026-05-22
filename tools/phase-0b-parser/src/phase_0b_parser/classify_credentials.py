"""classify_credentials — Ghost/Orphan/Live three-way classifier (M5 scope).

Per PHASE-0B-SPEC.md §6.2 line 261:
    Input:  triangulated set
    Output: each record + classification (enum: Ghost/Orphan/Live)
            + requires_human_confirmation
    Side effects: none

Per SPEC §6.1 line 241 (Decision 4 + v2 Gap A):
    classify_* is the verb for enum-producing read-only ops
    (is_* is bool-only; Ghost/Orphan/Live is enum).

M5 SSOT — dispatch brief truth table (binding):

| disk | db | consumer | classification | sub_class              | requires_human | disposition              |
|------|----|----------|----------------|------------------------|----------------|--------------------------|
|  T   | F  |   F      | ghost          | None                   | False          | archive                  |
|  F   | T  |   F      | orphan         | ad-hoc / system-seed.. | F / T          | revoke / human-review    |
|  T   | T  |   F      | orphan         | ad-hoc / system-seed.. | F / T          | revoke / human-review    |
|  F   | F  |   T      | live           | None                   | False          | keep+investigate-source  |
|  T   | F  |   T      | live           | None                   | False          | keep+rotate-when-ready   |
|  F   | T  |   T      | live           | None                   | False          | keep+rotate-when-ready   |
|  T   | T  |   T      | live           | None                   | False          | keep+rotate-when-ready   |

Key invariants:
  - consumer non-empty → ALWAYS live (live anchor beats title keyword)
  - title_signal_score still recorded for live records (ops signal), but
    sub_classification stays None — live has no sub-class dimension
  - db_metadata.db_validity == "unknown" forces requires_human=True and
    appends "+verify-db-when-reachable" to disposition (edge case)

M5 only TAGS sub_classification = "system-seed-suspected"; the actual
system-seed-gate behavior activation is Phase 0B-2 scope (SPEC §3.1 / §11.2).

Mutation-ban discipline (SPEC §6.4 line 287-294, layer 3): record fields are
populated by direct attribute assignment on a freshly-constructed
`FingerprintRecord` (via `dataclasses.replace`). No banned mutator idioms
(update / save / delete attribute-call forms) appear anywhere in this module.
"""

from __future__ import annotations

from dataclasses import replace

from .models import FingerprintRecord

# SPEC §5.2 line 188 — 0B-1 binary 0/1 title signal; keyword list (case
# insensitive substring). Phase 0B-2 may upgrade to float threshold.
TITLE_SEED_KEYWORDS: tuple[str, ...] = (
    "default", "admin", "bootstrap", "system", "seed",
)


def _score_title(title: str | None) -> int:
    """Per SPEC §5.2 line 188 — return 1 when title contains any seed keyword.

    Case-insensitive substring match. Empty / None → 0.
    """
    if not title:
        return 0
    lower = title.lower()
    for kw in TITLE_SEED_KEYWORDS:
        if kw in lower:
            return 1
    return 0


def _resolve_disposition_orphan(sub: str | None) -> str:
    """Orphan disposition: revoke for ad-hoc, human-review for system-seed."""
    if sub == "system-seed-suspected":
        return "human-review"
    return "revoke"


def _resolve_disposition_live(has_disk: bool, has_db: bool) -> str:
    """Live disposition per brief truth table.

    No disk + no db + consumer present → consumer-only anchor → caller
    must investigate where the token came from (rogue manual injection).
    Anything else with consumer → routine keep+rotate.
    """
    if not has_disk and not has_db:
        return "keep+investigate-source"
    return "keep+rotate-when-ready"


def _classify_one(record: FingerprintRecord) -> FingerprintRecord:
    """Compute the 6 M5 fields for one record. Returns a NEW record (no in-place mutation).

    Field set:
      - classification (ghost / orphan / live)
      - sub_classification (None for ghost+live; ad-hoc / system-seed-suspected for orphan)
      - title_signal_score (0/1)
      - requires_human_confirmation (bool)
      - recommended_disposition (str)
      - disk_duplicate_paths (sorted POSIX list when >= 2 disk_sources, else [])
    """
    has_disk = bool(record.disk_sources)
    has_db = record.db_metadata is not None
    has_consumer = bool(record.consumer_paths)

    title = record.db_metadata.title if record.db_metadata is not None else None
    title_signal = _score_title(title) if has_db else 0

    # disk_duplicate_paths: filled when >=2 disk_sources (same fp at multiple
    # disk paths). Sorted POSIX list of the disk source paths.
    # SPEC §6.2 line 260 names this as M4 deliverable; M4 deferred to M5.
    duplicate_paths: list[str] = []
    if len(record.disk_sources) >= 2:
        duplicate_paths = sorted({src.path for src in record.disk_sources})

    # --- Three-way dispatch ----------------------------------------------------
    if has_consumer:
        # Consumer anchor — ALWAYS live (truth table rows 6-9). Title keyword
        # signal still recorded for ops, but sub_classification stays None.
        classification = "live"
        sub: str | None = None
        requires_human = False
        disposition = _resolve_disposition_live(has_disk, has_db)
    elif has_disk and not has_db:
        # Disk-only ghost — truth table row 1.
        classification = "ghost"
        sub = None
        requires_human = False
        disposition = "archive"
    elif has_db:
        # DB present, no consumer → orphan (truth table rows 2-5).
        classification = "orphan"
        if title_signal == 1:
            sub = "system-seed-suspected"
            requires_human = True
        else:
            sub = "ad-hoc"
            requires_human = False
        disposition = _resolve_disposition_orphan(sub)
    else:
        # No disk, no db, no consumer — defensive; cannot happen because the
        # record came from merge_records which seeds from at least one source.
        # Treat as ghost (least dangerous default — caller should investigate).
        classification = "ghost"
        sub = None
        requires_human = False
        disposition = "archive"

    # --- db_validity="unknown" override (edge case from M5 brief) -----------
    # Force human review and tag disposition for re-verification when DB was
    # unreachable at scan time. Applies regardless of which row above hit.
    if record.db_validity == "unknown" and has_db:
        # If DB metadata exists but validity unknown (rare; degraded scan),
        # caller wants verification.
        requires_human = True
        disposition = f"{disposition}+verify-db-when-reachable"
    elif record.db_validity == "unknown" and not has_db:
        # No DB row was returned (scan_db unreachable). Live records that
        # rely on consumer anchor still need DB re-verify before rotation.
        if classification == "live":
            requires_human = True
            disposition = f"{disposition}+verify-db-when-reachable"

    # Build the new record via dataclasses.replace to avoid any direct
    # mutator idiom on the input. `replace` returns a fresh instance with
    # the listed fields overridden; identity (fingerprint_sha256_12) is
    # preserved so set membership is stable.
    return replace(
        record,
        classification=classification,
        sub_classification=sub,
        title_signal_score=title_signal,
        requires_human_confirmation=requires_human,
        recommended_disposition=disposition,
        disk_duplicate_paths=duplicate_paths,
    )


def classify_credentials(records: set[FingerprintRecord]) -> set[FingerprintRecord]:
    """Apply Ghost/Orphan/Live classification + title_signal_score per record.

    Per SPEC §11.1 line 458 — M5 milestone deliverable.

    Per SPEC §5.2 line 188: title_signal_score in 0B-1 is binary 0/1
    (keyword match: "Default"/"Admin"/"Bootstrap"/"System"/"Seed").

    Args:
        records: triangulated set output by `_merge_records` (disk ∪ db ∪
            consumer collapsed to one record per fp).

    Returns:
        A NEW set containing fresh `FingerprintRecord` instances. Input
        records are not mutated (dataclasses.replace returns copies).

    Side effects: none.
    """
    # Set comprehension — no banned mutator idioms (update/save/delete forms).
    return {_classify_one(rec) for rec in records}
