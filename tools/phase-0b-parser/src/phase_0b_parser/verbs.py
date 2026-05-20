"""Boolean predicates — per PHASE-0B-SPEC.md §6.1 line 237 + §6.2 line 262-263.

`is_*` is the bool-only verb prefix in the whitelist (Decision 4 v2).
Enum producers live under `classify_*`.
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
    """Per SPEC §6.2 line 263 — classification == Ghost predicate."""
    raise NotImplementedError("is_ghost is M5 scope per PHASE-0B-SPEC.md §11.1 line 458")


def is_orphan(record: FingerprintRecord) -> bool:
    """Per SPEC §6.2 line 263 — classification == Orphan predicate."""
    raise NotImplementedError("is_orphan is M5 scope per PHASE-0B-SPEC.md §11.1 line 458")


def is_live(record: FingerprintRecord) -> bool:
    """Per SPEC §6.2 line 263 — classification == Live predicate."""
    raise NotImplementedError("is_live is M5 scope per PHASE-0B-SPEC.md §11.1 line 458")
