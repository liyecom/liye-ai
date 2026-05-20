"""report_sealed_registry — final artifact emitter (M6 scope).

Per PHASE-0B-SPEC.md §6.2 line 264:
    Input:  classified set, output path
    Output: writes sealed-registry.json
    Side effects: write own output file only

Per SPEC §6.4 line 276-279:
    The ONLY allowed write path is `./sealed-registry.json`
    or `--output-dir <dir>/sealed-registry.json`.
    Parser startup MUST assert; non-matching → ERROR exit code 3.
"""

from __future__ import annotations

from pathlib import Path

from .models import FingerprintRecord


def report_sealed_registry(
    records: set[FingerprintRecord],
    output_path: str | Path,
    *,
    strict: bool = False,
) -> Path:
    """Emit sealed-registry.json per SPEC §5.1.

    Per SPEC §11.1 — M6 milestone deliverable. Output path will be
    asserted against the §6.4 whitelist; mutation ban grep runs in CI.
    """
    raise NotImplementedError(
        "report_sealed_registry is M6 scope per PHASE-0B-SPEC.md §11.1 line 459"
    )
