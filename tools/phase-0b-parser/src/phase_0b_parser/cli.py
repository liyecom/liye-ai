"""Phase 0B parser CLI entry. M3 phase: scan_disk + scan_db count summaries.

Future milestones extend with sub-commands (M6 report_sealed_registry, etc.).

Portfolio root precedence (per SPEC §12 Q3 M2 default decision):
    CLI flag `--portfolio-root` > env `LIYE_PORTFOLIO_ROOT` > default `~/github/`.

DB endpoint precedence (per SPEC §12 Q2 M3 decision):
    CLI flag `--db-url` > env `MEDUSA_ADMIN_URL` > unset → graceful skip.
    Token is **env-var only** (`$MEDUSA_ADMIN_TOKEN`) to avoid shell history leak.

Per liye_os/CLAUDE.md "Repo Root" section the default `~/github/` is the
canonical portfolio root for governance scans.

Output is **count-only** by design — neither raw nor redacted tokens are
printed. Redacted fingerprints belong inside `sealed-registry.json` (sealed
artifact, M6 deliverable), not stdout.
"""

from __future__ import annotations

import argparse
import logging
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
    parser.add_argument(
        "--db-url",
        type=str,
        default=os.environ.get("MEDUSA_ADMIN_URL"),
        help=(
            "Medusa admin endpoint URL (default: $MEDUSA_ADMIN_URL or unset → "
            "graceful skip). Token is read from $MEDUSA_ADMIN_TOKEN env var "
            "only; never accept it as a CLI flag (avoids shell history leak)."
        ),
    )
    args = parser.parse_args(argv)

    # WARN level so graceful-degrade messages from scan_db reach stderr.
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")

    # Lazy import keeps `--help` snappy and avoids pulling scan logic for
    # argv parse errors.
    from .classify_credentials import classify_credentials
    from .scan_consumers import _merge_records, scan_consumers
    from .scan_db import scan_db
    from .scan_disk import scan_disk
    from .verbs import is_ghost, is_live, is_orphan

    disk_records = scan_disk(args.portfolio_root)
    print(f"scan_disk found {len(disk_records)} fingerprint records under {args.portfolio_root}")

    # Token from env var only — never a CLI flag.
    admin_token = os.environ.get("MEDUSA_ADMIN_TOKEN")
    db_records = scan_db(args.db_url, admin_token)
    print(f"scan_db found {len(db_records)} DB records (db_url={args.db_url or 'unset'})")

    # M4 — disk ∪ db known fingerprint set drives consumer scan.
    known_fps = {r.fingerprint_sha256_12 for r in disk_records | db_records}
    consumer_map = scan_consumers(args.portfolio_root, known_fps)
    total_paths = sum(len(v) for v in consumer_map.values())
    print(
        f"scan_consumers found {len(consumer_map)} fp with consumers, "
        f"total {total_paths} consumer paths"
    )

    unified = _merge_records(disk_records, db_records, consumer_map)
    print(f"unified: {len(unified)} merged FingerprintRecord")

    # M5 — Ghost/Orphan/Live three-way classification.
    classified = classify_credentials(unified)
    ghosts = [r for r in classified if is_ghost(r)]
    orphans = [r for r in classified if is_orphan(r)]
    lives = [r for r in classified if is_live(r)]
    human_review = sum(1 for r in classified if r.requires_human_confirmation)
    print(
        f"classification: {len(ghosts)} ghosts / "
        f"{len(orphans)} orphans / {len(lives)} lives"
    )
    print(f"human review needed: {human_review}")
    # M5 stops here. M6 adds report_sealed_registry.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
