"""classify_credentials — Ghost/Orphan/Live three-way classifier (M5 scope).

Per PHASE-0B-SPEC.md §6.2 line 261:
    Input:  triangulated set
    Output: each record + classification (enum: Ghost/Orphan/Live)
            + requires_human_confirmation
    Side effects: none

Per SPEC §6.1 line 241 (Decision 4 + v2 Gap A):
    classify_* is the verb for enum-producing read-only ops
    (is_* is bool-only; Ghost/Orphan/Live is enum).
"""

from __future__ import annotations

from .models import FingerprintRecord


def classify_credentials(records: set[FingerprintRecord]) -> set[FingerprintRecord]:
    """Apply Ghost/Orphan/Live classification + title_signal_score per record.

    Per SPEC §11.1 — M5 milestone deliverable.

    Per SPEC §5.2 line 188: title_signal_score in 0B-1 is binary 0/1
    (keyword match: "Default"/"Admin"/"Bootstrap"/"System"/"Seed").
    """
    raise NotImplementedError(
        "classify_credentials is M5 scope per PHASE-0B-SPEC.md §11.1 line 458"
    )
