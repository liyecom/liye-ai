"""F14 — DB unreachable graceful degrade.

Per PHASE-0B-SPEC.md §7 line 334 + §11.1 M3 line 456.

Validates: scan_db never raises on network/auth/server errors; returns empty
set and emits a WARN log message that includes 'db unreachable'.

All HTTP is mocked via `responses` so no real Medusa endpoint is ever
contacted; the admin token used in tests is a mock string.
"""

from __future__ import annotations

import logging

import pytest
import requests
import responses

from phase_0b_parser.scan_db import scan_db

MOCK_URL = "http://localhost:9999"
MOCK_TOKEN = "F14_MOCK_TOKEN_not_real_xxxxxxxxxxxxxxxxxxxxx"


@responses.activate
def test_F14_db_unreachable_returns_empty_set(caplog):
    """ConnectionError → empty set, no exception propagates."""
    # Register a body that raises ConnectionError when the request fires.
    responses.add(
        responses.GET,
        f"{MOCK_URL}/admin/api-keys",
        body=requests.exceptions.ConnectionError("name resolution failed"),
    )

    with caplog.at_level(logging.WARNING):
        result = scan_db(MOCK_URL, MOCK_TOKEN)

    assert result == set(), "graceful degrade must yield empty set"
    assert isinstance(result, set)


@responses.activate
def test_F14_db_unreachable_logs_warn(caplog):
    """Verify WARN payload mentions 'db unreachable' + 'ConnectionError'."""
    responses.add(
        responses.GET,
        f"{MOCK_URL}/admin/api-keys",
        body=requests.exceptions.ConnectionError("connection refused"),
    )

    with caplog.at_level(logging.WARNING, logger="phase_0b_parser.scan_db"):
        scan_db(MOCK_URL, MOCK_TOKEN)

    messages = [rec.getMessage() for rec in caplog.records]
    joined = "\n".join(messages)
    assert "db unreachable" in joined, f"expected 'db unreachable' in logs; got: {joined!r}"
    assert "ConnectionError" in joined, f"expected 'ConnectionError' in logs; got: {joined!r}"


@responses.activate
def test_F14_db_auth_fail_treated_as_unknown(caplog):
    """401 from admin → empty set + WARN containing 'auth fail'."""
    responses.add(
        responses.GET,
        f"{MOCK_URL}/admin/api-keys",
        json={"message": "Unauthorized"},
        status=401,
    )

    with caplog.at_level(logging.WARNING, logger="phase_0b_parser.scan_db"):
        result = scan_db(MOCK_URL, MOCK_TOKEN)

    assert result == set()
    messages = "\n".join(rec.getMessage() for rec in caplog.records)
    assert "db unreachable" in messages
    assert "auth fail" in messages
    assert "401" in messages
    # Token must never appear in plaintext in logs.
    assert MOCK_TOKEN not in messages, "raw token leaked into WARN log"


@responses.activate
def test_F14_db_5xx_treated_as_unknown(caplog):
    """503 from admin → empty set + WARN containing 'server error'."""
    responses.add(
        responses.GET,
        f"{MOCK_URL}/admin/api-keys",
        json={"message": "Service Unavailable"},
        status=503,
    )

    with caplog.at_level(logging.WARNING, logger="phase_0b_parser.scan_db"):
        result = scan_db(MOCK_URL, MOCK_TOKEN)

    assert result == set()
    messages = "\n".join(rec.getMessage() for rec in caplog.records)
    assert "db unreachable" in messages
    assert "server error" in messages
    assert "503" in messages


@responses.activate
def test_F14_db_timeout_treated_as_unknown(caplog):
    """requests.exceptions.Timeout → empty set + WARN containing 'Timeout'."""
    responses.add(
        responses.GET,
        f"{MOCK_URL}/admin/api-keys",
        body=requests.exceptions.Timeout("read timed out"),
    )

    with caplog.at_level(logging.WARNING, logger="phase_0b_parser.scan_db"):
        result = scan_db(MOCK_URL, MOCK_TOKEN)

    assert result == set()
    messages = "\n".join(rec.getMessage() for rec in caplog.records)
    assert "db unreachable" in messages
    assert "Timeout" in messages


# ---------------------------------------------------------------------------
# Bonus: happy-path sanity check — verifies the parser correctly assembles
# a FingerprintRecord when Medusa returns real-looking rows. Not required by
# F14 but exercises the success path so M4/M5 can rely on this layer.
# ---------------------------------------------------------------------------
@responses.activate
def test_F14_happy_path_assembles_record():
    """Mock /admin/api-keys returning one secret key → 1 FingerprintRecord."""
    tok = "sk_F14HAPPYpath1234567890abcXYZdef"
    responses.add(
        responses.GET,
        f"{MOCK_URL}/admin/api-keys",
        json={
            "api_keys": [
                {
                    "id": "apk_01F14MOCK",
                    "type": "secret",
                    "title": "M3 happy path mock",
                    "token": tok,
                    "created_at": "2026-05-19T00:00:00Z",
                    "revoked_at": None,
                }
            ],
            "count": 1,
            "offset": 0,
            "limit": 100,
        },
        status=200,
    )
    # Also satisfy the publishable sweep with an empty page.
    responses.add(
        responses.GET,
        f"{MOCK_URL}/admin/api-keys",
        json={"api_keys": [], "count": 0, "offset": 0, "limit": 100},
        status=200,
    )

    result = scan_db(MOCK_URL, MOCK_TOKEN)
    assert len(result) == 1
    rec = next(iter(result))
    assert rec.key_type == "sk_"
    assert rec.db_validity == "present"
    assert rec.db_metadata is not None
    assert rec.db_metadata.id == "apk_01F14MOCK"
    assert rec.db_metadata.title == "M3 happy path mock"
    assert rec.db_metadata.revoked_at is None
    assert rec.db_metadata.key_type == "secret"
