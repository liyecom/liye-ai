"""scan_consumers — consumer/disk-duplicate path triangulation (M4 scope).

Per PHASE-0B-SPEC.md §6.2 line 260:
    Input:  portfolio root path, fingerprint set
    Output: Map[fp, List[consumer_path]] + Map[fp, List[disk_duplicate_path]]
    Side effects: none

Per SPEC §5.2 line 190-192:
    consumer_paths = active working-tree config
        (.env* excluding .example/.template/.bak; scripts/; .github/workflows/;
         package.json scripts; master keys file)
    disk_duplicate_paths = stale references
        (.example/.template/.bak/.planning/baseline/_sealed/ + same fp)
"""

from __future__ import annotations

from pathlib import Path

from .models import FingerprintRecord


def scan_consumers(
    portfolio_root: str | Path,
    fingerprints: set[FingerprintRecord],
) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    """Triangulate consumer_paths vs disk_duplicate_paths for each fingerprint.

    Per SPEC §11.1 — M4 milestone deliverable.

    Returns:
        (consumer_paths_by_fp, disk_duplicate_paths_by_fp)
    """
    raise NotImplementedError("scan_consumers is M4 scope per PHASE-0B-SPEC.md §11.1 line 457")
