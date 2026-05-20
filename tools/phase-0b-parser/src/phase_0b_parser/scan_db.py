"""scan_db — Medusa DB read-only cross-check (M3 scope).

Per PHASE-0B-SPEC.md §6.2 line 259:
    Input:  Medusa db connection
    Output: Set[FingerprintRecord] (db_metadata only)
    Side effects: DB read (listApiKeys only)

Per SPEC §4 line 110: 'DB query 仅 listApiKeys；禁止 apiKeyService.revoke/create/link'.
Per SPEC §6.4 line 287-292: mutation ban — no SQL/HTTP/SDK write paths.
"""

from __future__ import annotations

from .models import FingerprintRecord


def scan_db(db_url: str | None = None) -> set[FingerprintRecord]:
    """Read-only listApiKeys against the Medusa DB.

    Per SPEC §11.1 — M3 milestone deliverable.

    Args:
        db_url: connection string; M3 will define resolution order
            (CLI flag → env var → trust.local.yaml binding).
    """
    raise NotImplementedError("scan_db is M3 scope per PHASE-0B-SPEC.md §11.1 line 456")
