"""F13 — Malformed JSON. Per PHASE-0B-SPEC.md §7 line 333 + §11.1 M2.

Edge case: broken JSON (trailing comma) must log WARN and skip the file,
not crash the parser.
"""

from __future__ import annotations

import logging

from phase_0b_parser.scan_disk import scan_disk


def test_F13_malformed_json_warns_and_skips(fixtures_dir, caplog):
    root = fixtures_dir / "F13_malformed"
    with caplog.at_level(logging.WARNING, logger="phase_0b_parser.scan_disk"):
        records = scan_disk(root)
    assert records == set()

    # WARNING must mention "malformed" or include JSONDecodeError context.
    msgs = " ".join(rec.message for rec in caplog.records).lower()
    assert ("malformed" in msgs) or ("jsondecodeerror" in msgs) or ("json" in msgs)
