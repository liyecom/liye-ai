"""Signature smoke tests — confirm all M1 stubs are importable and raise
NotImplementedError with SPEC line refs in the message.

Per PHASE-0B-SPEC.md §11.1 M1 acceptance line 454:
    'scan_*/report_* 函数签名定义；envelope 双阈值实现'.
"""

from __future__ import annotations

import pytest

from phase_0b_parser import __version__
from phase_0b_parser.classify_credentials import classify_credentials
from phase_0b_parser.models import (
    DbMetadata,
    DiskSource,
    FingerprintRecord,
    SealedRegistry,
)
from phase_0b_parser.report_sealed_registry import report_sealed_registry
from phase_0b_parser.scan_consumers import scan_consumers
from phase_0b_parser.scan_db import scan_db
from phase_0b_parser.scan_disk import scan_disk
from phase_0b_parser.verbs import is_ghost, is_live, is_orphan, is_sealed


def test_version_string():
    """SPEC §5.2 line 187 — parser_version semver-like."""
    assert __version__ == "0B-1.0.0"


def test_scan_disk_callable_returns_set(tmp_path):
    """M2 landed — scan_disk is real. Smoke: empty dir → empty set, no raise.

    M1's NotImplementedError assertion was removed when M2 landed; remaining
    M3-M6 stubs still raise NotImplementedError (see below).
    """
    result = scan_disk(tmp_path)
    assert isinstance(result, set)
    assert result == set()


def test_scan_db_stub_raises():
    with pytest.raises(NotImplementedError, match="M3"):
        scan_db()


def test_scan_consumers_stub_raises():
    with pytest.raises(NotImplementedError, match="M4"):
        scan_consumers("/tmp", set())


def test_classify_credentials_stub_raises():
    with pytest.raises(NotImplementedError, match="M5"):
        classify_credentials(set())


def test_report_sealed_registry_stub_raises():
    with pytest.raises(NotImplementedError, match="M6"):
        report_sealed_registry(set(), "/tmp/sealed-registry.json")


def test_is_sealed_stub_raises():
    with pytest.raises(NotImplementedError):
        is_sealed("/tmp/foo")


def test_is_ghost_stub_raises():
    rec = FingerprintRecord(fingerprint_sha256_12="0" * 12)
    with pytest.raises(NotImplementedError):
        is_ghost(rec)


def test_is_orphan_stub_raises():
    rec = FingerprintRecord(fingerprint_sha256_12="0" * 12)
    with pytest.raises(NotImplementedError):
        is_orphan(rec)


def test_is_live_stub_raises():
    rec = FingerprintRecord(fingerprint_sha256_12="0" * 12)
    with pytest.raises(NotImplementedError):
        is_live(rec)


def test_fingerprint_record_dataclass_shape():
    """FingerprintRecord skeleton per SPEC §5.2 line 141-170."""
    rec = FingerprintRecord(fingerprint_sha256_12="b648d0c84248")
    assert rec.fingerprint_sha256_12 == "b648d0c84248"
    assert rec.key_type == "unknown"
    assert rec.disk_sources == []
    assert rec.db_validity == "unknown"
    assert rec.db_metadata is None
    assert rec.consumer_paths == []
    assert rec.disk_duplicate_paths == []
    assert rec.classification is None
    assert rec.sub_classification is None
    assert rec.title_signal_score == 0
    assert rec.last_rotated_at is None
    assert rec.requires_human_confirmation is False
    assert rec.recommended_disposition is None


def test_sealed_registry_dataclass_shape():
    """SealedRegistry top-level per SPEC §5.1 line 118-137."""
    reg = SealedRegistry()
    assert reg.schema_version == 1
    assert reg.parser_version == "0B-1.0.0"
    assert reg.credentials == []
    assert reg.scope_covered == []
    assert reg.summary == {}


def test_disk_source_and_db_metadata_constructible():
    ds = DiskSource(path="storefronts/sf-foneyi/.env.local", line=11, env_var="MEDUSA_ADMIN_TOKEN")
    assert ds.line == 11
    md = DbMetadata(id="apk_01", title="admin token", created_at="2026-05-19T12:46:15Z")
    assert md.id == "apk_01"
