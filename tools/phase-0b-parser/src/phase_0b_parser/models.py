"""Data models per PHASE-0B-SPEC.md §5.

`FingerprintRecord` mirrors the per-credential record shape from §5.2
(line 141-170). M1 only lands the dataclass skeleton; field population
is split across M2-M5 milestones.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

# Per SPEC §5.2 line 186 — key_type enum locked in Decision 2.
KeyType = Literal["sk_", "pk_", "jwt", "oauth", "db", "other", "unknown"]

# Per SPEC §5.2 line 164 — classification enum (Ghost/Orphan/Live + None pre-classify).
# M5 SSOT (dispatch brief truth table) uses lowercase "ghost"/"orphan"/"live"
# rather than SPEC §5.2's TitleCase example payload. The SPEC examples are
# illustrative JSON, not a normative enum spelling; brief truth table is the
# binding M5 contract for `classify_credentials`. Captured as additive drift
# (v4 ceremony will fold spelling back into SPEC §5.2 line 164).
Classification = Literal["ghost", "orphan", "live"]

# Per SPEC §5.2 line 193 — sub_classification enum (M5 expansion).
# Brief truth table uses bare values "ad-hoc" / "system-seed-suspected" (no
# `-orphan` suffix) — the suffix is implicit since the field only fills when
# classification == "orphan". SPEC §5.2 line 193 retains the suffixed names
# (`ad-hoc-orphan` / `system-seed-suspected-orphan`); M5 ships the brief
# spelling. Captured as additive drift (v4 ceremony).
SubClassification = Literal["ad-hoc", "system-seed-suspected"]

# Per SPEC §5.2 line 154 — db_validity enum (Decision 2; F14 line 334 adds "unknown").
DbValidity = Literal["present", "absent", "unknown"]


@dataclass
class DiskSource:
    """Per SPEC §5.2 line 146-152 — one disk hit for a fingerprint."""
    path: str          # SPEC §5.2 line 148: portfolio-relative path string
    line: int          # SPEC §5.2 line 149: 1-indexed line number
    env_var: str | None = None  # SPEC §5.2 line 150: env var name when scanned from .env*


@dataclass
class DbMetadata:
    """Per SPEC §5.2 line 154-158 — Medusa DB row metadata (read-only).

    Non-breaking extension (M3): `revoked_at` and `key_type` carried as
    optional fields. SPEC §5.2 line 154-158 enumerates id/title/created_at
    only, but the Medusa /admin/api-keys payload includes type + revoked_at
    natively and downstream classification (M5) needs them to distinguish
    active vs revoked rows. Default None preserves SPEC backward compatibility.
    """
    id: str            # SPEC §5.2 line 155: api_key.id (apk_*)
    title: str         # SPEC §5.2 line 156: api_key.title
    created_at: str    # SPEC §5.2 line 157: ISO-8601 UTC
    revoked_at: str | None = None   # Medusa /admin/api-keys returns this; None = active.
    key_type: str | None = None     # "secret" | "publishable" from Medusa API.


@dataclass(eq=False)
class FingerprintRecord:
    """Per-credential record per PHASE-0B-SPEC.md §5.2 (line 141-170).

    Field-by-field SPEC line refs are noted below. M1 lands skeleton only;
    each downstream milestone (M2-M5) fills the corresponding fields.

    Identity is the 12-char fingerprint (`fingerprint_sha256_12`). SPEC §6.2
    line 258 requires `Set[FingerprintRecord]` return shape from `scan_disk`,
    so equality & hash are keyed on the fingerprint string. Two records with
    the same fingerprint are by definition the same credential (collision
    handling is §5.3's upgrade path, not duplicate records).
    """

    def __hash__(self) -> int:  # noqa: D401
        return hash(self.fingerprint_sha256_12)

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, FingerprintRecord):
            return NotImplemented
        return self.fingerprint_sha256_12 == other.fingerprint_sha256_12

    # SPEC §5.2 line 143 — sha256[:12] lowercase hex; spec locked §5.2 line 173-182.
    fingerprint_sha256_12: str

    # SPEC §5.2 line 144 + line 186 — key_type enum.
    key_type: KeyType | str = "unknown"

    # SPEC §5.2 line 145 — "sk_c48***51b" style.
    redacted: str = ""

    # SPEC §5.2 line 146-152 — disk_sources list (M2 fill).
    disk_sources: list[DiskSource] = field(default_factory=list)

    # SPEC §5.2 line 153 — db_validity enum {present|absent|unknown} (M3 fill).
    db_validity: DbValidity = "unknown"

    # SPEC §5.2 line 154-158 — db_metadata when db_validity=="present" (M3 fill).
    db_metadata: DbMetadata | None = None

    # SPEC §5.2 line 159-162 — current working-tree active consumer paths (M4 fill).
    consumer_paths: list[str] = field(default_factory=list)

    # SPEC §5.2 line 163 + §5.2 line 190-192 — stale references (.example/.template/.bak/etc) (M4 fill).
    disk_duplicate_paths: list[str] = field(default_factory=list)

    # M4 additive (non-breaking) — tracks which scan sources produced this record.
    # Values: subset of {"disk", "db", "consumer"}. SPEC §5.2 enumerates minimum
    # field set; this extension is required for §5.2 line 196 union semantics
    # (merge_records collapses same-fp records across disk/db/consumer sources
    # into one FingerprintRecord with source_origins union). Default empty set
    # preserves backward compatibility — existing tests treating untouched
    # records keep passing.
    source_origins: set[str] = field(default_factory=set)

    # SPEC §5.2 line 164 — Ghost/Orphan/Live (M5 fill).
    classification: Classification | None = None

    # SPEC §5.2 line 165 + line 193 — 0B-1 always null; 0B-2 only.
    sub_classification: SubClassification | None = None

    # SPEC §5.2 line 166 + line 188 — binary 0/1 in 0B-1; float in 0B-2.
    title_signal_score: int = 0

    # SPEC §5.2 line 167 + line 189 — from audit-init.jsonl rotation; Live only.
    last_rotated_at: str | None = None

    # SPEC §5.2 line 168 — set by classifier (M5 fill).
    requires_human_confirmation: bool = False

    # SPEC §5.2 line 169 — "monitor" | "rotate" | "revoke" | "investigate" etc. (M5 fill).
    recommended_disposition: str | None = None

    # M6 additive (non-breaking) — True iff record has been written into the
    # current `sealed-registry.json` snapshot. Captures the "frozen into
    # registry" semantic, independent of `requires_human_confirmation` (human
    # review is an ops flag and does NOT prevent freezing). SPEC §5.2 enumerates
    # the minimum field set; this extension is required by SPEC §6.2 line 262
    # `is_sealed` predicate. Default False preserves backward compatibility —
    # existing M1-M5 records constructed without this field stay unaffected.
    # Drift captured for v4 SPEC ceremony.
    sealed: bool = False


@dataclass
class SealedRegistry:
    """Top-level sealed-registry.json per SPEC §5.1 (line 118-137)."""

    schema_version: int = 1                  # SPEC §5.1 line 120 + §8.2 line 374.
    parser_version: str = "0B-1.0.0"         # SPEC §5.1 line 121 + §5.2 line 187.
    scanned_at: str = ""                     # SPEC §5.1 line 122: ISO-8601 UTC.
    scope_covered: list[str] = field(default_factory=list)  # SPEC §5.1 line 123-133.
    credentials: list[FingerprintRecord] = field(default_factory=list)  # §5.1 line 134.
    summary: dict[str, Any] = field(default_factory=dict)   # SPEC §5.4 line 207-219.
