"""F7 — Live master + replica (same fp in two active env files).

Per PHASE-0B-SPEC.md §7 line 327 + §11.1 M4 line 457:
    "pk_ 在 silkbay/.env.localkeys + sf-*/.env.local → 单 record +
    consumer_paths=[2]".

The master + replica pattern: the same publishable key lives in the
storefront's local config AND in silkbay's localkeys file. Both are
active consumers — should count as 2 consumer paths under one fp.
"""

from __future__ import annotations

import hashlib

from phase_0b_parser.scan_consumers import scan_consumers


F7_TOKEN = "pk_F7MOCKmasterReplica1234567890ABC"
F7_FP = hashlib.sha256(F7_TOKEN.encode("utf-8")).hexdigest()[:12]


def test_F7_live_master_replica(tmp_path):
    """Same pk_ in silkbay/.env.local and silkbay/.env.production → 2 paths."""
    root = tmp_path / "tests" / "fixtures" / "F7_master_replica"
    silkbay = root / "silkbay"
    silkbay.mkdir(parents=True)
    (silkbay / ".env.local").write_text(
        f"NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY={F7_TOKEN}\n"
    )
    (silkbay / ".env.production").write_text(
        f"NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY={F7_TOKEN}\n"
    )

    result = scan_consumers(root, {F7_FP})

    assert F7_FP in result
    paths = result[F7_FP]
    assert len(paths) == 2, f"expected 2 consumer paths; got {paths}"
    assert paths == sorted(paths)
    assert any(p.endswith("silkbay/.env.local") for p in paths)
    assert any(p.endswith("silkbay/.env.production") for p in paths)


def test_F7_localkeys_master_plus_local_replica(tmp_path):
    """SPEC line 327: silkbay/.env.localkeys (master) + sf-*/.env.local (replica)."""
    root = tmp_path / "tests" / "fixtures" / "F7_localkeys"
    silkbay = root / "silkbay"
    silkbay.mkdir(parents=True)
    (silkbay / ".env.localkeys").write_text(f"PUBLISHABLE={F7_TOKEN}\n")
    sf = root / "storefronts" / "sf-mock"
    sf.mkdir(parents=True)
    (sf / ".env.local").write_text(f"PUBLISHABLE={F7_TOKEN}\n")

    result = scan_consumers(root, {F7_FP})

    assert F7_FP in result
    paths = result[F7_FP]
    assert len(paths) == 2, f"expected 2 consumer paths; got {paths}"
