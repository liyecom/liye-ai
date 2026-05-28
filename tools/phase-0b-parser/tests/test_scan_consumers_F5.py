"""F5 — Live single consumer.

Per PHASE-0B-SPEC.md §7 line 325 + §11.1 M4 line 457:
    "Live — single consumer | 单 storefront pk_ → classification=Live,
    consumer_paths=[1]".

Validates: scan_consumers maps a known fingerprint to exactly one consumer
path when the token appears in one active `.env.local` file.

Fixture is runtime-materialized under `tmp_path` per liye_os/.claude/.githooks/
pre-commit constraint (`.env*` files cannot be staged).
"""

from __future__ import annotations

import hashlib

from phase_0b_parser.scan_consumers import scan_consumers


F5_TOKEN = "sk_F5MOCKlive1234567890abcdefXYZQ"
F5_FP = hashlib.sha256(F5_TOKEN.encode("utf-8")).hexdigest()[:12]


def test_F5_live_single_consumer(tmp_path):
    """One storefront, one .env.local, one known token → 1 fp, 1 path."""
    root = tmp_path / "tests" / "fixtures" / "F5_live_single"
    silkbay = root / "silkbay"
    silkbay.mkdir(parents=True)
    (silkbay / ".env.local").write_text(
        f"MEDUSA_TOKEN={F5_TOKEN}\n"
        "PORT=9000\n"
    )

    result = scan_consumers(root, {F5_FP})

    assert F5_FP in result, f"expected fp {F5_FP} in consumer_map; got keys={list(result.keys())}"
    paths = result[F5_FP]
    assert len(paths) == 1, f"expected exactly 1 consumer path; got {paths}"
    assert paths[0].endswith("silkbay/.env.local"), f"unexpected path: {paths[0]}"


def test_F5_unknown_fp_not_recorded(tmp_path):
    """Token present but its fp NOT in known_fingerprints → not in result."""
    root = tmp_path / "tests" / "fixtures" / "F5_unknown"
    silkbay = root / "silkbay"
    silkbay.mkdir(parents=True)
    (silkbay / ".env.local").write_text(f"MEDUSA_TOKEN={F5_TOKEN}\n")

    # known_fingerprints empty — token's fp not in set → must be ignored.
    result = scan_consumers(root, set())

    assert result == {}, f"unknown fp must not appear; got {result}"
