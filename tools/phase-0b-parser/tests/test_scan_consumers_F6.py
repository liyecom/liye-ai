"""F6 — Live multi-consumer (same fp across N storefronts).

Per PHASE-0B-SPEC.md §7 line 326 + §11.1 M4 line 457 + Scope #9 line 37:
    "admin token 跨 N storefronts → 单 record + consumer_paths=[N],
    不能 N records".

This is the **correctness prerequisite** for the registry — same fp shared
by multiple storefronts must collapse to one record with N consumer paths,
NOT N records. Single-record / multi-consumer is the SSOT invariant.
"""

from __future__ import annotations

import hashlib

from phase_0b_parser.scan_consumers import scan_consumers


F6_TOKEN = "sk_F6MOCKmultiABCDEF1234567890XYZ"
F6_FP = hashlib.sha256(F6_TOKEN.encode("utf-8")).hexdigest()[:12]


def test_F6_live_multi_consumer_single_record(tmp_path):
    """Same token in 3 storefronts → one fp key with 3 sorted paths."""
    root = tmp_path / "tests" / "fixtures" / "F6_live_multi"
    sf_root = root / "storefronts"
    for name in ("sf-mock-a", "sf-mock-b", "sf-mock-c"):
        sf = sf_root / name
        sf.mkdir(parents=True)
        (sf / ".env.local").write_text(f"MEDUSA_ADMIN_TOKEN={F6_TOKEN}\n")

    result = scan_consumers(root, {F6_FP})

    assert F6_FP in result
    paths = result[F6_FP]
    assert len(paths) == 3, f"expected exactly 3 consumer paths; got {paths}"
    # Sorted lex POSIX — alphabetic by storefront name.
    assert paths == sorted(paths), f"paths not sorted: {paths}"
    assert any("sf-mock-a/.env.local" in p for p in paths)
    assert any("sf-mock-b/.env.local" in p for p in paths)
    assert any("sf-mock-c/.env.local" in p for p in paths)


def test_F6_only_one_fp_key(tmp_path):
    """Multi-consumer must NOT split into multiple fp entries."""
    root = tmp_path / "tests" / "fixtures" / "F6_only_one"
    sf_root = root / "storefronts"
    for name in ("sf-x", "sf-y"):
        sf = sf_root / name
        sf.mkdir(parents=True)
        (sf / ".env.local").write_text(f"TOKEN={F6_TOKEN}\n")

    result = scan_consumers(root, {F6_FP})

    assert len(result) == 1, (
        f"correctness invariant violated — expected 1 fp key, got {len(result)}: "
        f"{list(result.keys())}"
    )
