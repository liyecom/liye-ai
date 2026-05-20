"""Phase 0B parser CLI entry. M2 phase: scan_disk count summary only.

Future milestones extend with sub-commands (M6 report_sealed_registry, etc.).

Portfolio root precedence (per SPEC §12 Q3 M2 default decision):
    CLI flag `--portfolio-root` > env `LIYE_PORTFOLIO_ROOT` > default `~/github/`.

Per liye_os/CLAUDE.md "Repo Root" section the default `~/github/` is the
canonical portfolio root for governance scans.

Output is **count-only** by design — neither raw nor redacted tokens are
printed. Redacted fingerprints belong inside `sealed-registry.json` (sealed
artifact, M6 deliverable), not stdout.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="phase-0b-parser",
        description="LiYe OS Phase 0B credential audit parser (read-only).",
    )
    parser.add_argument(
        "--portfolio-root",
        type=Path,
        default=Path(os.environ.get("LIYE_PORTFOLIO_ROOT", str(Path.home() / "github"))),
        help="Portfolio root directory (default: $LIYE_PORTFOLIO_ROOT or ~/github)",
    )
    args = parser.parse_args(argv)

    # Lazy import keeps `--help` snappy and avoids pulling scan logic for
    # argv parse errors.
    from .scan_disk import scan_disk

    records = scan_disk(args.portfolio_root)
    print(f"scan_disk found {len(records)} fingerprint records under {args.portfolio_root}")
    # M2 stops here. M6 will add `report_sealed_registry` output.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
