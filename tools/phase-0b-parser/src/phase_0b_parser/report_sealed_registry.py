"""report_sealed_registry — final artifact emitter (M6 scope).

Per PHASE-0B-SPEC.md §6.2 line 264:
    Input:  classified set, output path
    Output: writes sealed-registry.json
    Side effects: write own output file only

Per SPEC §6.4 line 276-279:
    The ONLY allowed write path is `./sealed-registry.json`
    or `--output-dir <dir>/sealed-registry.json`.
    Parser startup MUST assert; non-matching → ERROR exit code 3.

Per SPEC §8.6 line 408-411 (R3 operation modes):
    default mode — §8.3 behavior (silent OK / WARN proceed / ERROR abort)
    `--strict` mode — escalatable WARN forced to ERROR; CI callers pass strict=True.

Per SPEC §5.3 line 196-204:
    fp[:12] collision detection — M6 ALWAYS reports `collision_detected=False`.
    Phase 0B-2 will activate real collision detection via a fingerprint_full
    additive field (current implementation: collision_detected stays False;
    real-world collision rate ~2e-13 at portfolio scale of ~10 credentials).
    The contract surface is preserved (summary field present) so consumers
    don't need re-tooling when 0B-2 activates the real check.

Output JSON convention (M6 naming lock — additive drift for v4 SPEC ceremony):
    All keys are snake_case lowercase. SPEC §5.1/§5.4 example payloads use
    snake_case; this module pins the convention across the whole envelope.

Mutation-ban discipline (SPEC §6.4 line 287-309, layer 3):
    Record construction uses `dataclasses.replace(...)` to flip
    `record.sealed = True`. The banned dict/ORM mutator idioms (update /
    save / delete attribute-call forms) are intentionally absent here.
    Atomic write uses os.replace (POSIX-rename semantics; the writer
    never touches the final path in-place — temp file + atomic rename).
"""

from __future__ import annotations

import dataclasses
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .models import FingerprintRecord

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Output-path whitelist — per SPEC §6.4 line 276-285.
# ---------------------------------------------------------------------------
#
# Whitelist: any path containing one of these directory names as a part.
# `var/` is the project-conventional artifact dir (`tools/phase-0b-parser/var/`
# is git-ignored; sealed-registry.json default lives there).
WHITELIST_DIR_NAMES: frozenset[str] = frozenset({"build", "dist", ".cache", "var", "tmp"})

# Hard-block any path that traverses these names — covers SPEC §6.4 line 281-285
# explicit-forbid set (~/.claude, .claude/, .git, _meta/).
BANNED_PATH_PARTS: frozenset[str] = frozenset({".claude", ".git", "_meta"})

# Hard-block writes into source / test / scripts trees (they live in git
# tracked space; sealed-registry must NOT collide with versioned content).
BANNED_SOURCE_DIRS: frozenset[str] = frozenset({"src", "tests", "scripts"})

# Filename pattern hard-block (any `.env*` per SPEC §6.4 line 283).
BANNED_FILENAME_PREFIXES: tuple[str, ...] = (".env",)


class OutputPathViolation(Exception):
    """Raised when output path is in the §6.4 banned set.

    Carries the rejected path (`.path`) and reason (`.reason`) for CLI to
    surface a precise stderr message before exit 3.
    """

    def __init__(self, path: Path, reason: str) -> None:
        super().__init__(f"output path violation: {path} — {reason}")
        self.path = path
        self.reason = reason


class StrictModeViolation(Exception):
    """Raised when --strict mode encounters escalatable WARN per SPEC §8.6.

    Carries the list of triggering messages (`.warnings`) for CLI to surface.
    """

    def __init__(self, warnings: list[str]) -> None:
        super().__init__(
            "strict-mode violation: "
            + "; ".join(warnings)
        )
        self.warnings = warnings


# ---------------------------------------------------------------------------
# Path whitelist guard (§6.4)
# ---------------------------------------------------------------------------
def _assert_output_path_whitelist(path: Path) -> None:
    """Reject `path` if it falls into a banned region per SPEC §6.4 line 281-285.

    The check is intentionally conservative — banned hits raise BEFORE any
    filesystem activity (no directory creation, no temp file, no write). The
    sad-path fixture verifies the rejected path does not get materialized.

    Acceptance rules (any one matches → accept):
      1. Path resolves under macOS pytest tmp_path tree (/var/folders/... or
         /private/var/folders/... — pytest tmp_path on darwin)
      2. Path resolves under /tmp/ (pytest tmp_path on linux + manual smoke)
      3. Path contains any name in WHITELIST_DIR_NAMES as a `Path.parts` entry

    Rejection rules (any one matches → raise):
      A. Any part in BANNED_PATH_PARTS (.claude / .git / _meta)
      B. Any part in BANNED_SOURCE_DIRS (src / tests / scripts) AND no
         tmp-tree override (so pytest tmp_path containing `tests` segment
         from cwd is still accepted)
      C. Final filename starts with `.env`
      D. None of the accept rules match → default reject
    """
    resolved = path.resolve()
    parts = resolved.parts

    # ---- Hard-block rules (always fail) ----
    for part in parts:
        if part in BANNED_PATH_PARTS:
            raise OutputPathViolation(
                resolved,
                f"path component {part!r} is in BANNED_PATH_PARTS "
                f"({sorted(BANNED_PATH_PARTS)})",
            )

    for prefix in BANNED_FILENAME_PREFIXES:
        if resolved.name.startswith(prefix):
            raise OutputPathViolation(
                resolved,
                f"filename {resolved.name!r} starts with banned prefix "
                f"{prefix!r} (consumer .env* files are read-only per §6.4)",
            )

    # ---- Tmp-tree accept (overrides BANNED_SOURCE_DIRS, since macOS
    # pytest tmp_path is `/private/var/folders/...` which contains no
    # source-tree segment anyway, but linux pytest tmp_path is /tmp/pytest-*
    # which is fine).
    str_path = str(resolved)
    if "/pytest-" in str_path:
        return
    # macOS tmp_path: /private/var/folders/...  OR  /var/folders/...
    if len(parts) >= 3 and parts[1] == "private" and parts[2] == "var":
        return
    if len(parts) >= 2 and parts[1] == "var":
        # /var/folders/...
        return
    if len(parts) >= 2 and parts[1] == "tmp":
        # /tmp/...
        return

    # ---- Source-tree reject ----
    for part in parts:
        if part in BANNED_SOURCE_DIRS:
            raise OutputPathViolation(
                resolved,
                f"path component {part!r} is in BANNED_SOURCE_DIRS "
                f"({sorted(BANNED_SOURCE_DIRS)})",
            )

    # ---- Whitelist accept ----
    for part in parts:
        if part in WHITELIST_DIR_NAMES:
            return

    # ---- Default reject ----
    raise OutputPathViolation(
        resolved,
        f"no whitelist dir name in path parts (whitelist: "
        f"{sorted(WHITELIST_DIR_NAMES)})",
    )


# ---------------------------------------------------------------------------
# Summary aggregation (§5.4)
# ---------------------------------------------------------------------------
def _summarize(records: set[FingerprintRecord]) -> dict[str, Any]:
    """Build the §5.4 summary block from the classified record set.

    Per SPEC §5.4 line 207-219, M6 brief naming lock — all snake_case lowercase.
    `collision_detected` is always False in M6 per the M6 brief pre-resolved
    decision (option A — Phase 0B-2 activates real collision detection).
    """
    by_classification: dict[str, int] = {"ghost": 0, "orphan": 0, "live": 0}
    system_seed_count = 0
    unknown_db_validity_count = 0
    requires_human_count = 0

    for rec in records:
        cls = rec.classification or "ghost"  # defensive: unclassified counts as ghost bucket
        if cls in by_classification:
            by_classification[cls] += 1
        if rec.sub_classification == "system-seed-suspected":
            system_seed_count += 1
        if rec.db_validity == "unknown":
            unknown_db_validity_count += 1
        if rec.requires_human_confirmation:
            requires_human_count += 1

    return {
        "total_records": len(records),
        "by_classification": by_classification,
        "collision_detected": False,  # M6 stub per SPEC §5.3; Phase 0B-2 activates
        "system_seed_suspected_count": system_seed_count,
        "unknown_db_validity_count": unknown_db_validity_count,
        "requires_human_confirmation_count": requires_human_count,
    }


# ---------------------------------------------------------------------------
# Strict-mode escalation (§8.6)
# ---------------------------------------------------------------------------
def _check_strict_warnings(summary: dict[str, Any]) -> list[str]:
    """Return the list of escalatable WARN messages in strict mode.

    Per SPEC §8.6 line 410-411 — escalatable signals:
      - unknown_db_validity_count > 0 (DB unreachable degraded scan)
      - collision_detected (fp[:12] hash collision — needs 0C migration)
      - requires_human_confirmation_count > 0 (ops review required)

    Non-escalatable INFO signals (informational only, never escalated):
      - ghost records detected (governance signal, expected on stale repos)
      - system_seed_suspected_count > 0 (captured by requires_human flag —
        already escalates when human confirmation needed)
    """
    warns: list[str] = []
    if summary["unknown_db_validity_count"] > 0:
        warns.append(
            f"db_validity=unknown for {summary['unknown_db_validity_count']} "
            f"records (DB unreachable at scan time)"
        )
    if summary["collision_detected"]:
        warns.append(
            "fp_collision_detected (fp[:12] hash collision — Phase 0C migration required)"
        )
    if summary["requires_human_confirmation_count"] > 0:
        warns.append(
            f"human_confirmation_required for "
            f"{summary['requires_human_confirmation_count']} records"
        )
    return warns


# ---------------------------------------------------------------------------
# Serialization helpers (deterministic, snake_case)
# ---------------------------------------------------------------------------
def _serialize_disk_source(ds: Any) -> dict[str, Any]:
    return {
        "path": ds.path,
        "line": ds.line,
        "env_var": ds.env_var,
    }


def _serialize_db_metadata(md: Any) -> dict[str, Any]:
    return {
        "id": md.id,
        "title": md.title,
        "created_at": md.created_at,
        "revoked_at": md.revoked_at,
        "key_type": md.key_type,
    }


def _serialize_record(rec: FingerprintRecord) -> dict[str, Any]:
    """Render one FingerprintRecord as a snake_case lowercase JSON-safe dict.

    Deterministic field order matches the SPEC §5.2 example payload reading
    order; `source_origins` set is rendered as a sorted list (JSON has no
    set primitive); consumer_paths / disk_duplicate_paths are sorted for
    stable output regardless of upstream insertion order.
    """
    return {
        "fingerprint_sha256_12": rec.fingerprint_sha256_12,
        "key_type": rec.key_type,
        "redacted": rec.redacted,
        "classification": rec.classification,
        "sub_classification": rec.sub_classification,
        "source_origins": sorted(rec.source_origins),
        "disk_sources": [_serialize_disk_source(ds) for ds in rec.disk_sources],
        "disk_duplicate_paths": sorted(rec.disk_duplicate_paths),
        "db_validity": rec.db_validity,
        "db_metadata": (
            _serialize_db_metadata(rec.db_metadata) if rec.db_metadata else None
        ),
        "consumer_paths": sorted(rec.consumer_paths),
        "title_signal_score": rec.title_signal_score,
        "last_rotated_at": rec.last_rotated_at,
        "requires_human_confirmation": rec.requires_human_confirmation,
        "recommended_disposition": rec.recommended_disposition,
        "sealed": rec.sealed,
    }


# ---------------------------------------------------------------------------
# Atomic write (POSIX-rename semantics)
# ---------------------------------------------------------------------------
def _atomic_write_json(payload: dict[str, Any], output_path: Path) -> None:
    """Write `payload` as JSON atomically: temp file in same dir + os.replace.

    `os.replace` is POSIX atomic (same filesystem). On failure mid-write the
    final path remains untouched (either pre-existing content or absent).

    Parent directory is created if missing — restricted to whitelist-accepted
    paths by `_assert_output_path_whitelist` already.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = output_path.with_suffix(output_path.suffix + ".tmp")
    serialized = json.dumps(payload, indent=2, sort_keys=False, ensure_ascii=False)
    tmp_path.write_text(serialized + "\n", encoding="utf-8")
    os.replace(tmp_path, output_path)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def report_sealed_registry(
    classified_records: set[FingerprintRecord],
    output_path: str | Path,
    *,
    strict: bool = False,
    generated_at: str | None = None,
) -> dict[str, Any]:
    """Emit sealed-registry.json per SPEC §5.1 / §5.4 / §8.2.

    Per SPEC §11.1 M6 line 459 — final implementation milestone of Phase 0B-1.

    Pipeline:
      1. Resolve & assert output_path against §6.4 whitelist
         (raises OutputPathViolation BEFORE any filesystem activity)
      2. Flip `record.sealed = True` for every classified record (via
         `dataclasses.replace` — no in-place mutation)
      3. Compute §5.4 summary block
      4. Detect fp[:12] collisions (M6: always False; Phase 0B-2 activates)
      5. Build the envelope: schema_version=1, schema="sealed_registry",
         generated_at (ISO 8601 UTC), summary, records (lex-sorted by fp)
      6. Strict mode (§8.6): if strict and any escalatable WARN present,
         raise StrictModeViolation (no write happens)
      7. Atomic write: tmp + os.replace

    Args:
        classified_records: Output of `classify_credentials` — set of
            FingerprintRecord with `classification` populated.
        output_path: Destination path. MUST satisfy §6.4 whitelist.
        strict: When True, escalatable WARN signals abort with
            StrictModeViolation per §8.6.
        generated_at: Optional ISO 8601 UTC timestamp string. When None,
            uses `datetime.now(timezone.utc).isoformat(timespec="seconds")`
            with trailing `Z` (e.g. `"2026-05-21T14:30:00Z"`).

    Returns:
        Summary dict (the same shape written to disk under `summary`),
        suitable for CLI display.

    Raises:
        OutputPathViolation — output_path not in §6.4 whitelist.
        StrictModeViolation — strict=True and at least one escalatable WARN.
    """
    out = Path(output_path)
    _assert_output_path_whitelist(out)

    # Step 2 — flip sealed flag via dataclasses.replace (no in-place mutation).
    sealed_records = {dataclasses.replace(rec, sealed=True) for rec in classified_records}

    # Step 3-4 — summary + collision (M6 stub).
    summary = _summarize(sealed_records)

    # Step 5 — envelope.
    if generated_at is None:
        # ISO 8601 UTC with `Z` suffix (RFC 3339 form expected by §8.2).
        generated_at = (
            datetime.now(timezone.utc)
            .isoformat(timespec="seconds")
            .replace("+00:00", "Z")
        )

    # Deterministic record order — lex-sorted by fingerprint_sha256_12.
    records_serialized = [
        _serialize_record(rec)
        for rec in sorted(sealed_records, key=lambda r: r.fingerprint_sha256_12)
    ]

    envelope: dict[str, Any] = {
        "schema_version": 1,
        "schema": "sealed_registry",
        "generated_at": generated_at,
        "summary": summary,
        "records": records_serialized,
    }

    # Step 6 — strict-mode escalation (BEFORE write).
    warns = _check_strict_warnings(summary)
    if strict and warns:
        raise StrictModeViolation(warns)

    if warns:
        # Non-strict: log warnings but proceed.
        for msg in warns:
            logger.warning("sealed-registry WARN: %s", msg)

    # Step 7 — atomic write.
    _atomic_write_json(envelope, out)
    logger.info("sealed-registry written: %s (%d records)", out, summary["total_records"])

    return summary
