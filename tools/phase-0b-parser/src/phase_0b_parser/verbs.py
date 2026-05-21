"""Boolean predicates — per PHASE-0B-SPEC.md §6.1 line 237 + §6.2 line 262-263.

`is_*` is the bool-only verb prefix in the whitelist (Decision 4 v2).
Enum producers live under `classify_*`.

M5 landed real implementations for `is_ghost` / `is_orphan` / `is_live`.
M6 lands real `is_sealed` (last verb stub) — now accepts a
`FingerprintRecord` and reflects the `record.sealed` snapshot flag (set by
`report_sealed_registry` when the record is written into
`sealed-registry.json`).

`is_sealed` semantics (M6 decision, brief pre-resolved):
    True iff the record has been written into the current sealed_registry
    snapshot. INDEPENDENT of `requires_human_confirmation` — human review is
    an operations flag tracked separately and does NOT prevent freezing.
    Phase 0C will introduce a `status=tentative` window for the human-review
    period; in 0B-1 every classified record that reaches
    `report_sealed_registry` is sealed.

Mutual exhaustion invariant: for any record whose classification has been
assigned by `classify_credentials`, exactly ONE of {is_ghost, is_orphan,
is_live} returns True. Records with classification == None (pre-classify
state) return False from all three. `is_sealed` is orthogonal to the
ghost/orphan/live mutex (a record can be sealed regardless of which
classification bucket it lives in).
"""

from __future__ import annotations

from .models import FingerprintRecord


def is_sealed(record: FingerprintRecord) -> bool:
    """Per SPEC §6.2 line 262 — True iff record written into the current
    sealed_registry snapshot.

    M6 finalization: replaces the M1 stub (which accepted a path and was a
    placeholder for the Phase 0C PreToolUse hook). The 0B-1 `is_sealed`
    contract is record-scoped: `report_sealed_registry` flips `record.sealed`
    to True for every record it writes; this predicate exposes that flag.

    Future Phase 0C: status=tentative during human-review window will become
    an independent flag; `is_sealed` will continue to reflect "currently in
    the sealed_registry artifact".
    """
    return record.sealed


def is_ghost(record: FingerprintRecord) -> bool:
    """Per SPEC §6.2 line 263 — classification == ghost predicate."""
    return record.classification == "ghost"


def is_orphan(record: FingerprintRecord) -> bool:
    """Per SPEC §6.2 line 263 — classification == orphan predicate."""
    return record.classification == "orphan"


def is_live(record: FingerprintRecord) -> bool:
    """Per SPEC §6.2 line 263 — classification == live predicate."""
    return record.classification == "live"
