"""F2 — Ghost: stale .env.production.example with mock token.

Per PHASE-0B-SPEC.md §7 line 322 + brief M5 truth table row 1:
    "Ghost — stale .env.production.example | active fp 在 .example →
     classification 取决于 DB; disk_duplicate_paths 非空."

M5 interpretation: when the token only exists in `.env.production.example`
(scan_disk catches it as plaintext ground truth per SPEC §2 line 28) AND no
consumer references it (scan_consumers excludes `.example` per SPEC §5.2
line 191) AND no DB row → classification == "ghost".

Token lives in `.env.production.example` runtime-materialized into tmp_path
to dodge the .githooks pre-commit `.env*` staged-file block.
"""

from __future__ import annotations

import hashlib

from phase_0b_parser.classify_credentials import classify_credentials
from phase_0b_parser.scan_consumers import _merge_records, scan_consumers
from phase_0b_parser.scan_disk import scan_disk
from phase_0b_parser.verbs import is_ghost


F2_TOKEN = "sk_F2MOCKghostStaleExampleToken1234abc"
F2_FP = hashlib.sha256(F2_TOKEN.encode("utf-8")).hexdigest()[:12]


def test_F2_ghost_stale_example(tmp_path):
    """Token in `.env.production.example` only → ghost classification.

    Pipeline: scan_disk picks it up (disk plaintext is ground truth).
    scan_consumers does NOT (`.example` suffix excluded). No DB rows.
    Therefore classification == "ghost", disposition == "archive".
    """
    root = tmp_path / "tests" / "fixtures" / "F2_ghost_example"
    sb = root / "silkbay"
    sb.mkdir(parents=True)
    (sb / ".env.production.example").write_text(f"MOCK_TOKEN={F2_TOKEN}\n")

    disk_records = scan_disk(root)
    assert len(disk_records) == 1, f"scan_disk should catch the .example token"

    known_fps = {r.fingerprint_sha256_12 for r in disk_records}
    consumer_map = scan_consumers(root, known_fps)
    # `.example` is excluded from active consumer scan per SPEC §5.2 line 191.
    assert F2_FP not in consumer_map, "scan_consumers must exclude .example files"

    unified = _merge_records(disk_records, set(), consumer_map)
    classified = classify_credentials(unified)

    assert len(classified) == 1
    rec = next(iter(classified))
    assert rec.fingerprint_sha256_12 == F2_FP
    assert rec.classification == "ghost"
    assert is_ghost(rec) is True
    assert rec.sub_classification is None
    assert rec.consumer_paths == []
    assert rec.db_metadata is None
    assert rec.requires_human_confirmation is False
    assert rec.recommended_disposition == "archive"
    # Only one disk source — duplicate_paths stays empty.
    assert rec.disk_duplicate_paths == []
    # disk_sources still records the .example path (it IS the disk trace).
    assert len(rec.disk_sources) == 1
    assert rec.disk_sources[0].path.endswith(".env.production.example")
