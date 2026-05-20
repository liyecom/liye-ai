"""Boolean predicates — per PHASE-0B-SPEC.md §6.1 line 237 + §6.2 line 262-263.

`is_*` is the bool-only verb prefix in the whitelist (Decision 4 v2).
Enum producers live under `classify_*`.

M5 lands real implementations for `is_ghost` / `is_orphan` / `is_live`.
`is_sealed` stays M6 stub (sealed-asset check for Phase 0C hooks).

Mutual exhaustion invariant: for any record whose classification has been
assigned by `classify_credentials`, exactly ONE of {is_ghost, is_orphan,
is_live} returns True. Records with classification == None (pre-classify
state) return False from all three.
"""

from __future__ import annotations

from pathlib import Path

from .models import FingerprintRecord


def is_sealed(path: str | Path) -> bool:
    """Per SPEC §6.2 line 262 — sealed asset check for a disk path.

    Used by Phase 0C PreToolUse hook (SPEC §9 line 424).
    """
    raise NotImplementedError("is_sealed is M6 scope per PHASE-0B-SPEC.md §11.1 line 459")


def is_ghost(record: FingerprintRecord) -> bool:
    """Per SPEC §6.2 line 263 — classification == ghost predicate."""
    return record.classification == "ghost"


def is_orphan(record: FingerprintRecord) -> bool:
    """Per SPEC §6.2 line 263 — classification == orphan predicate."""
    return record.classification == "orphan"


def is_live(record: FingerprintRecord) -> bool:
    """Per SPEC §6.2 line 263 — classification == live predicate."""
    return record.classification == "live"
