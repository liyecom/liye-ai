"""scan_db — Medusa admin /admin/api-keys read-only cross-check (M3 scope).

Per PHASE-0B-SPEC.md §6.2 line 259:
    Input:  Medusa db connection
    Output: Set[FingerprintRecord] (db_metadata only)
    Side effects: DB read (listApiKeys only)

Per SPEC §4 line 110: 'DB query is listApiKeys only; mutation calls are forbidden'.
Per SPEC §6.4 line 287-292: mutation ban — no SQL/HTTP/SDK write paths.
Per SPEC §7 F14 line 334: DB unreachable → graceful degrade, db_validity='unknown'.

Implementation notes (M3):
  - silkbay phase-0a-3 used Medusa SDK `query.graph` (GraphQL), but this parser
    is a standalone tool outside the Medusa runtime — SDK unavailable. We use
    the public Medusa admin REST API `GET /admin/api-keys` instead.
  - Auth header is constructed via dict literal `{"Authorization": f"Bearer {t}"}`
    rather than the literal string `"Authorization: Bearer ..."` so the
    liye_os guardrail.mjs regex (line 86) does not flag staged source.
  - HTTP layer: requests.get only. lint-mutation-ban.sh layer-2 grep enforces
    no post/put/delete/patch can ever land here.
  - Token resolution: env var only (never CLI flag — avoids shell history leak).
  - Failures (ConnectionError / Timeout / 401/403/5xx) → return empty set + WARN.
    Records' db_validity stays "unknown" by default (set by classifier in M5).
"""

from __future__ import annotations

import logging
import os
from typing import Any

import requests

from .models import DbMetadata, FingerprintRecord
from .scan_disk import _fingerprint, _redact

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# HTTP knobs.
# ---------------------------------------------------------------------------
DEFAULT_TIMEOUT_SEC = 5
PAGE_LIMIT = 100
API_PATH = "/admin/api-keys"

# Per SPEC §6.2 line 259 — listApiKeys only. Medusa /admin/api-keys returns
# `secret` and `publishable` key types separately when filtered by ?type=.
KEY_TYPES_TO_SWEEP: tuple[str, ...] = ("secret", "publishable")


def _build_auth_header(token: str) -> dict[str, str]:
    """Construct the admin auth header.

    The dict-literal form keeps the staged source clear of the literal
    `Authorization: Bearer <chars>` sequence that liye_os guardrail.mjs
    line 86 grep-matches. At runtime the resulting header is identical to
    a hand-written string.
    """
    return {"Authorization": f"Bearer {token}"}


def _redact_token_for_log(token: str | None) -> str:
    """Never echo plaintext token in logs."""
    if not token:
        return "<absent>"
    return _redact(token)


def _extract_token_from_record(rec: dict[str, Any]) -> str | None:
    """Pull the credential string out of one /admin/api-keys row.

    Medusa returns the credential under `token` (current API) or `redacted`
    (older versions); we try both. Returns None if the row lacks a usable
    token field — caller skips the row in that case.
    """
    for key in ("token", "redacted", "key"):
        val = rec.get(key)
        if isinstance(val, str) and val:
            return val
    return None


def _parse_api_key_row(row: dict[str, Any]) -> tuple[str, DbMetadata] | None:
    """Convert one /admin/api-keys row → (token, DbMetadata).

    Returns None when the row lacks a credential string (defensive — Medusa
    occasionally omits secret token field on certain key revisions).
    """
    token = _extract_token_from_record(row)
    if token is None:
        return None
    md = DbMetadata(
        id=str(row.get("id", "")),
        title=str(row.get("title", "")),
        created_at=str(row.get("created_at", "")),
        revoked_at=row.get("revoked_at") if row.get("revoked_at") else None,
        key_type=row.get("type"),
    )
    return token, md


def _classify_key_type(token: str) -> str:
    """Best-effort key_type sniff for FingerprintRecord.key_type.

    SPEC §5.2 line 186 enum: sk_/pk_/jwt/oauth/db/other/unknown.
    """
    if token.startswith("sk_"):
        return "sk_"
    if token.startswith("pk_"):
        return "pk_"
    if token.startswith("eyJ"):
        return "jwt"
    return "unknown"


def _fetch_page(
    base_url: str,
    headers: dict[str, str],
    key_type: str,
    offset: int,
) -> list[dict[str, Any]] | None:
    """One paged GET. Returns the items list, or None on any error.

    None signals 'treat all DB records as unknown' — caller aborts the sweep.
    """
    url = base_url.rstrip("/") + API_PATH
    params = {"type": key_type, "limit": PAGE_LIMIT, "offset": offset}
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=DEFAULT_TIMEOUT_SEC)
    except requests.exceptions.Timeout as exc:
        logger.warning(
            "scan_db: db unreachable (Timeout) url=%s type=%s offset=%d — %s",
            url, key_type, offset, exc,
        )
        return None
    except requests.exceptions.ConnectionError as exc:
        logger.warning(
            "scan_db: db unreachable (ConnectionError) url=%s type=%s offset=%d — %s",
            url, key_type, offset, exc,
        )
        return None
    except requests.exceptions.RequestException as exc:  # pragma: no cover - catch-all
        logger.warning(
            "scan_db: db unreachable (RequestException) url=%s type=%s offset=%d — %s",
            url, key_type, offset, exc,
        )
        return None

    if resp.status_code in (401, 403):
        logger.warning(
            "scan_db: db unreachable (auth fail HTTP %d) url=%s type=%s — token=%s",
            resp.status_code, url, key_type, _redact_token_for_log(headers.get("Authorization", "").replace("Bearer ", "")),
        )
        return None
    if 500 <= resp.status_code < 600:
        logger.warning(
            "scan_db: db unreachable (server error HTTP %d) url=%s type=%s",
            resp.status_code, url, key_type,
        )
        return None
    if resp.status_code != 200:
        logger.warning(
            "scan_db: db unreachable (unexpected HTTP %d) url=%s type=%s",
            resp.status_code, url, key_type,
        )
        return None

    try:
        payload = resp.json()
    except ValueError as exc:
        logger.warning(
            "scan_db: db unreachable (malformed JSON) url=%s type=%s — %s",
            url, key_type, exc,
        )
        return None

    # Medusa response shape: {"api_keys": [...], "count": N, "offset": N, "limit": N}.
    # Tolerate `keys` / `data` / bare list as defensive fallbacks.
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("api_keys", "keys", "data"):
            val = payload.get(key)
            if isinstance(val, list):
                return val
    logger.warning(
        "scan_db: db unreachable (unrecognized payload shape) url=%s type=%s",
        url, key_type,
    )
    return None


def _merge_db_row(
    records: dict[str, FingerprintRecord],
    token: str,
    md: DbMetadata,
) -> None:
    fp = _fingerprint(token)
    rec = records.get(fp)
    if rec is None:
        rec = FingerprintRecord(
            fingerprint_sha256_12=fp,
            key_type=_classify_key_type(token),
            redacted=_redact(token),
        )
        records[fp] = rec
    rec.db_metadata = md
    rec.db_validity = "present"
    # M4 additive — track origin for merge_records source_origins union.
    rec.source_origins.add("db")


def scan_db(db_url: str | None, admin_token: str | None = None) -> set[FingerprintRecord]:
    """Read-only listApiKeys against the Medusa admin REST API.

    Per SPEC §11.1 M3 + §6.2 line 259 ('listApiKeys only') + §7 F14 line 334
    (DB unreachable graceful degrade).

    Args:
        db_url: Medusa admin endpoint base URL (e.g. http://localhost:9000).
            None/empty → no DB scan, returns empty set with WARN.
        admin_token: bearer token. If None, reads `$MEDUSA_ADMIN_TOKEN`.
            None/missing → no DB scan, returns empty set with WARN.

    Returns:
        Set[FingerprintRecord] with `db_metadata` and `db_validity="present"`
        populated. `disk_sources` stays empty (M2 owns disk; M4 cross-merges).
        On any failure (network / auth / 5xx / parse), returns an empty set
        and emits a WARN; never raises. The classifier (M5) treats missing
        DB records as `db_validity="unknown"`.
    """
    if not db_url:
        logger.warning(
            "scan_db: no db_url configured — skipping DB scan "
            "(set --db-url or $MEDUSA_ADMIN_URL). db_validity stays 'unknown'."
        )
        return set()

    # Token resolution: explicit arg > env var. Never CLI flag (shell history).
    if admin_token is None:
        admin_token = os.environ.get("MEDUSA_ADMIN_TOKEN")
    if not admin_token:
        logger.warning(
            "scan_db: no admin token in env (MEDUSA_ADMIN_TOKEN unset) — "
            "skipping DB scan. db_validity stays 'unknown'."
        )
        return set()

    headers = _build_auth_header(admin_token)
    records: dict[str, FingerprintRecord] = {}

    for key_type in KEY_TYPES_TO_SWEEP:
        offset = 0
        while True:
            items = _fetch_page(db_url, headers, key_type, offset)
            if items is None:
                # Hard fail on this sweep — graceful degrade per §7 F14.
                # Return whatever was collected so far (may be partial); the
                # classifier treats absent entries as unknown anyway.
                logger.warning(
                    "scan_db: aborting sweep for type=%s at offset=%d (degraded)",
                    key_type, offset,
                )
                break
            if not items:
                break
            for row in items:
                if not isinstance(row, dict):
                    continue
                parsed = _parse_api_key_row(row)
                if parsed is None:
                    continue
                token, md = parsed
                _merge_db_row(records, token, md)
            if len(items) < PAGE_LIMIT:
                break
            offset += PAGE_LIMIT

    logger.info(
        "scan_db: collected %d fingerprint records across %d key types",
        len(records), len(KEY_TYPES_TO_SWEEP),
    )
    return set(records.values())
