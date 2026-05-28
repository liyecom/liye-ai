"""Phase 0B parser CLI entry. M6 phase: full pipeline + sealed-registry emit.

Portfolio root precedence (per SPEC §12 Q3 M2 default decision):
    CLI flag `--portfolio-root` > env `LIYE_PORTFOLIO_ROOT` > default `~/github/`.

DB endpoint precedence (per SPEC §12 Q2 M3 decision):
    CLI flag `--db-url` > env `MEDUSA_ADMIN_URL` > unset → graceful skip.
    Token is **env-var only** (`$MEDUSA_ADMIN_TOKEN`) to avoid shell history leak.

Per liye_os/CLAUDE.md "Repo Root" section the default `~/github/` is the
canonical portfolio root for governance scans.

Output is **count-only** by design — neither raw nor redacted tokens are
printed on stdout. Redacted fingerprints land in `sealed-registry.json`
when --output writes succeed; raw tokens never leave RAM.

Exit codes (M6):
    0 — happy path; sealed-registry.json written
    2 — strict-mode violation (§8.6 escalatable WARN with --strict)
    3 — output path violation (§6.4 whitelist rejection)
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
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
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("var/sealed-registry.json"),
        help=(
            "Sealed registry JSON output path (default: var/sealed-registry.json). "
            "Path is asserted against the SPEC §6.4 whitelist; banned paths "
            "(~/.claude/**, .git/, _meta/, .env*, source dirs) raise OutputPathViolation "
            "BEFORE any filesystem activity (exit code 3)."
        ),
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help=(
            "Strict mode per SPEC §8.6 — escalatable WARN signals "
            "(db_validity=unknown / fp_collision / requires_human_confirmation) "
            "abort with StrictModeViolation (exit code 2). CI callers should "
            "pass --strict."
        ),
    )
    args = parser.parse_args(argv)

    # WARN level so graceful-degrade messages from scan_db reach stderr.
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")

    # Lazy import keeps `--help` snappy and avoids pulling scan logic for
    # argv parse errors.
    from .classify_credentials import classify_credentials
    from .report_sealed_registry import (
        OutputPathViolation,
        StrictModeViolation,
        report_sealed_registry,
    )
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

    # M6 — emit sealed-registry.json via report_sealed_registry.
    try:
        summary = report_sealed_registry(
            classified,
            args.output,
            strict=args.strict,
        )
    except OutputPathViolation as exc:
        print(f"ERROR: output path violation — {exc.reason}", file=sys.stderr)
        return 3
    except StrictModeViolation as exc:
        print(
            "ERROR: strict-mode violation — " + "; ".join(exc.warnings),
            file=sys.stderr,
        )
        return 2

    print(f"sealed registry written: {args.output}")
    print(f"  total: {summary['total_records']}")
    print(f"  classifications: {summary['by_classification']}")
    print(f"  human review: {summary['requires_human_confirmation_count']}")
    print(f"  system-seed suspected: {summary['system_seed_suspected_count']}")
    print(f"  db_validity unknown: {summary['unknown_db_validity_count']}")
    if summary.get("collision_detected"):
        print("  WARNING: FP collision detected — investigate!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
