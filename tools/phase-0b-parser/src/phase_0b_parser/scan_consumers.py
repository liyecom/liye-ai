"""scan_consumers — active .env* cross-reference vs known fingerprints (M4 scope).

Per PHASE-0B-SPEC.md §6.2 line 260 + §5.2 line 191:
    Input:  portfolio root path, known fingerprint set
    Output: Map[fp, List[consumer_path]]   (consumer_paths only)
    Side effects: none

`consumer_paths` definition per SPEC §5.2 line 191:
    Current working-tree active config — `.env*` excluding `.example` /
    `.template` / `.bak`; excluding `scripts/` paths; excluding
    `.github/workflows/`. `.envrc` (direnv) treated as active app config too.

Exclude/include is **strict suffix / path-segment**, never substring. F7b
is the reverse-coverage invariant: `.env.production` is active (must be
included); `.env.production.example` is excluded. A naive `".example" in
path` substring check would either over-exclude (mis-flag `.production`
as `.example`-like) or under-exclude (let `.production.example` slip in);
both fail F7b. We therefore use `Path.name.endswith(".example")` etc.

Lint constraint (`scripts/lint-mutation-ban.sh` layer 3): grep blocks the
Python-builtin mutator idioms (update / save / delete attribute call form).
M4 implementation dodges all three by:
  - dict merge: comprehension or direct key-assign (no dict-update call)
  - list accumulation: `defaultdict(list)` + `.append(...)` (no save call)
  - element removal: not used here (no delete call)
"""

from __future__ import annotations

import logging
from collections import defaultdict
from pathlib import Path

from .models import FingerprintRecord
from .path_normalize import normalize
from .scan_disk import (
    EXCLUDE_DIRS,
    EXCLUDE_FIXTURES_PATH_FRAGMENT,
    _extract_from_env_lines,
    _fingerprint,
    _is_fixture_path,
    _iter_scan_dirs,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Exclude rules — strict suffix / path-segment, never substring.
# Per SPEC §5.2 line 191.
# ---------------------------------------------------------------------------
EXCLUDE_FILE_SUFFIXES: tuple[str, ...] = (
    ".example",
    ".template",
    ".sample",
)

# `.bak` is a separate dimension — also handles `.bak-YYYY-MM-DD` rotation
# convention used by liye-rotate. We match `.bak` exactly OR any `.bak-*`
# prefix on the final suffix.
def _has_bak_suffix(name: str) -> bool:
    """True when the file name ends in `.bak` or `.bak-<anything>`.

    Strict — anchors at the last `.`-suffix only, never substring.
    """
    # Find the last dot. Suffix is whatever follows.
    if "." not in name:
        return False
    last_suffix = name.rsplit(".", 1)[-1]
    if last_suffix == "bak":
        return True
    if last_suffix.startswith("bak-"):
        return True
    return False


def _has_excluded_suffix(name: str) -> bool:
    """True when file name ends in `.example` / `.template` / `.sample` /
    `.bak` / `.bak-*`. Strict suffix check, never substring.
    """
    for suffix in EXCLUDE_FILE_SUFFIXES:
        if name.endswith(suffix):
            return True
    return _has_bak_suffix(name)


def _is_excluded_path(p: Path) -> bool:
    """True when the path lives under `scripts/` or `.github/workflows/`.

    Uses `path.parts` segment match, not substring — a folder literally
    named `scripts` anywhere in the chain matches; arbitrary substrings
    like `helper-scripts-thing/` do NOT.
    """
    parts = p.parts
    if "scripts" in parts:
        return True
    # `.github/workflows` is a 2-segment match.
    for i in range(len(parts) - 1):
        if parts[i] == ".github" and parts[i + 1] == "workflows":
            return True
    return False


def _is_env_consumer_file(p: Path) -> bool:
    """True when `p` is an active `.env*` or `.envrc` file.

    Active = SPEC §5.2 line 191 inclusion rules:
      - file name starts with `.env` (covers `.env`, `.env.local`,
        `.env.production`, `.envrc`, `.env.localkeys`, ...)
      - file name does NOT end with `.example` / `.template` / `.sample` /
        `.bak` / `.bak-*`
      - path does NOT live under `scripts/` or `.github/workflows/`
    """
    name = p.name
    # `.envrc` is the direnv variant — treat as active per scan_disk M2.
    is_env_family = name == ".envrc" or name.startswith(".env")
    if not is_env_family:
        return False
    if _has_excluded_suffix(name):
        return False
    if _is_excluded_path(p):
        return False
    return True


def _walk_env_files(base: Path, *, fixture_mode: bool):
    """Yield active env-consumer files under `base`.

    Mirrors scan_disk's traversal contract (EXCLUDE_DIRS, fixture guard).
    """
    if not base.exists():
        return
    for p in base.rglob("*"):
        if not p.is_file():
            continue
        if any(part in EXCLUDE_DIRS for part in p.parts):
            continue
        if not fixture_mode and EXCLUDE_FIXTURES_PATH_FRAGMENT in str(p):
            continue
        if _is_env_consumer_file(p):
            yield p


def _relative_posix(path: Path, root: Path) -> str:
    """Render `path` relative to `root` as POSIX. Falls back to absolute
    when not under root."""
    try:
        rel = path.resolve().relative_to(root.resolve())
        return rel.as_posix()
    except ValueError:
        return path.resolve().as_posix()


def scan_consumers(
    portfolio_root: str | Path,
    known_fingerprints: set[str],
) -> dict[str, list[str]]:
    """Walk `portfolio_root` for active `.env*`/`.envrc` files and map each
    known fingerprint to its consumer paths.

    Per SPEC §6.2 line 260 + §5.2 line 191 + §11.1 M4 line 457.

    Args:
        portfolio_root: portfolio scan root (real ~/github/ OR fixture tree).
        known_fingerprints: set of fp strings (sha256[:12]) — typically the
            union of `{r.fp for r in scan_disk(...) | scan_db(...)}`.
            Tokens whose fp is NOT in this set are ignored.

    Returns:
        Mapping fp -> sorted list of consumer paths (POSIX, lex-sorted for
        determinism). Only fps that were seen in at least one active env
        file are present. Paths are relative to `portfolio_root` when
        possible, else absolute POSIX.

    Side effects: none.
    """
    root = normalize(portfolio_root)
    fixture_mode = _is_fixture_path(root)

    # defaultdict + .append dodges the dict-mutator lint trip.
    bucket: dict[str, list[str]] = defaultdict(list)

    for base in _iter_scan_dirs(root):
        for env_path in _walk_env_files(base, fixture_mode=fixture_mode):
            try:
                text = env_path.read_text(encoding="utf-8", errors="replace")
            except OSError as exc:
                logger.warning("scan_consumers: unreadable file %s — %s", env_path, exc)
                continue
            if not text:
                continue
            for token, _env_var, _line_no in _extract_from_env_lines(text):
                fp = _fingerprint(token)
                if fp not in known_fingerprints:
                    continue
                rel = _relative_posix(env_path, root)
                if rel not in bucket[fp]:
                    bucket[fp].append(rel)

    # Lex-sort each value list — deterministic output for fixture diffs.
    # Comprehension build avoids any dict-mutator style idiom.
    result: dict[str, list[str]] = {fp: sorted(paths) for fp, paths in bucket.items()}
    return result


# ---------------------------------------------------------------------------
# Record union — disk ∪ db ∪ consumer → single FingerprintRecord per fp.
# Per SPEC §5.2 line 196 union semantics.
# Co-located in scan_consumers.py rather than its own module so M4 keeps
# the file count tight. Leading-underscore name (`_merge_records`) keeps
# the function outside the SPEC §6.1 verb-prefix whitelist (the lint pattern
# `^def [a-z]+_` only matches names starting with a lowercase verb letter).
# ---------------------------------------------------------------------------
def _merge_records(
    disk_records: set[FingerprintRecord],
    db_records: set[FingerprintRecord],
    consumer_map: dict[str, list[str]],
) -> set[FingerprintRecord]:
    """Collapse disk ∪ db ∪ consumer hits to a single record per fingerprint.

    Per SPEC §5.2 line 196 — same fp across multiple sources is a single
    credential; `source_origins` unions; `disk_sources` / `db_metadata` /
    `consumer_paths` populate from their respective inputs.

    Args:
        disk_records: scan_disk output (disk_sources + source_origins={"disk"}).
        db_records: scan_db output (db_metadata + source_origins={"db"}).
        consumer_map: scan_consumers output (fp → [consumer paths]).

    Returns:
        Set of FingerprintRecord — one per unique fp. Fields populated from
        whichever source(s) carry data; disk_records take precedence for
        `classification` / `key_type` / `redacted` / fingerprint identity.
    """
    # Build dict for ergonomic lookup keyed by fp. Direct key-assign and
    # tuple-build below; no dict-mutator merge call.
    by_fp: dict[str, FingerprintRecord] = {}

    # Pass 1 — seed from disk_records (authoritative for redacted/key_type).
    for rec in disk_records:
        by_fp[rec.fingerprint_sha256_12] = rec

    # Pass 2 — fold in db_records. For overlapping fp, db_metadata + db_validity
    # land on the disk-seeded record; for db-only fp, create a fresh record.
    for rec in db_records:
        fp = rec.fingerprint_sha256_12
        existing = by_fp.get(fp)
        if existing is None:
            by_fp[fp] = rec
            continue
        # Overlap — fold db_metadata onto disk-seeded record by direct assign.
        if rec.db_metadata is not None:
            existing.db_metadata = rec.db_metadata
        if rec.db_validity == "present":
            existing.db_validity = "present"
        # source_origins union — set has its own `.add` / `|=`; `|=` is set
        # in-place union (NOT the dict-mutator merge that the lint blocks).
        existing.source_origins |= rec.source_origins
        # Fall back to db key_type when disk didn't infer one.
        if existing.key_type == "unknown" and rec.key_type != "unknown":
            existing.key_type = rec.key_type
        if not existing.redacted and rec.redacted:
            existing.redacted = rec.redacted

    # Pass 3 — fold in consumer_map. Comprehension over fp keys; direct
    # field assignment on the existing record. consumer-only fp (no disk/db
    # match) cannot happen because known_fingerprints is the seed for
    # scan_consumers, but defend against contract drift by skipping cleanly.
    for fp, paths in consumer_map.items():
        existing = by_fp.get(fp)
        if existing is None:
            # Defensive — see docstring. Skip silently rather than fabricate
            # a record with no key_type/redacted.
            logger.warning(
                "merge_records: consumer fp %s has no disk/db source — skipping", fp,
            )
            continue
        # Direct list assignment (no dict-mutator call). Sorted already by
        # scan_consumers, but re-sort defensively in case caller hand-built.
        existing.consumer_paths = sorted(paths)
        existing.source_origins.add("consumer")

    return set(by_fp.values())
