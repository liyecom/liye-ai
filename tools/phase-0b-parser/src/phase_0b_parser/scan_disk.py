"""scan_disk — disk plaintext fingerprint scan (M2 scope).

Per PHASE-0B-SPEC.md §6.2 line 258:
    Input:  portfolio root path
    Output: Set[FingerprintRecord] (disk_sources only)
    Side effects: none

Scope per SPEC §2 line 29-32:
    - ~/.claude/**/*.json
    - <any-repo>/.claude/**/*.json
    - **/.env*  (all variants: .env.local, .env.localkeys, .env.production, .env.production.example, ...)
    - **/.envrc (direnv)
"""

from __future__ import annotations

from pathlib import Path

from .models import FingerprintRecord


def scan_disk(portfolio_root: str | Path) -> set[FingerprintRecord]:
    """Discover credentials on disk under `portfolio_root`.

    Per SPEC §11.1 — M2 milestone deliverable.
    """
    raise NotImplementedError("scan_disk is M2 scope per PHASE-0B-SPEC.md §11.1 line 455")
