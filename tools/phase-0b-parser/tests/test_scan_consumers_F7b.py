"""F7b — Reverse-coverage invariant: `.env.production` is active; the sibling
`.env.production.example` is excluded.

Per PHASE-0B-SPEC.md §7 line 328 + §5.2 line 191 + §7 line 337:
    "parser 实现 disk-duplicate regex 易用宽 glob `*.production*` 误排除
    active `.env.production`，F7b 是反向覆盖".

This is the **governance defense** invariant. If the implementation used a
naive substring check like `".example" in path`, the production file
would slip through the exclude rule (because `.production.example` also
contains the substring `.example` — but `.env.production` does NOT, so
that direction is safe). The danger direction is `.production.example`
being treated as active when it should be excluded.

We assert:
  - F7b consumer_map contains the production fp
  - Its consumer_paths list is **length 1** — only the active `.env.production`
  - The `.env.production.example` path is NOT in the list

Failing this test means the exclude rule was implemented with a substring
predicate and stale tokens would leak into the active-consumer ledger.
"""

from __future__ import annotations

import hashlib

from phase_0b_parser.scan_consumers import scan_consumers


F7B_TOKEN = "sk_F7bMOCKproductionACTIVE12345xyz"
F7B_FP = hashlib.sha256(F7B_TOKEN.encode("utf-8")).hexdigest()[:12]


def test_F7b_production_active_example_excluded(tmp_path):
    """`.env.production` active; `.env.production.example` excluded."""
    root = tmp_path / "tests" / "fixtures" / "F7b_production_active"
    silkbay = root / "silkbay"
    silkbay.mkdir(parents=True)
    (silkbay / ".env.production").write_text(
        f"MEDUSA_TOKEN={F7B_TOKEN}\n"
    )
    (silkbay / ".env.production.example").write_text(
        f"MEDUSA_TOKEN={F7B_TOKEN}\n"
    )

    result = scan_consumers(root, {F7B_FP})

    assert F7B_FP in result, "production file's fp must be recorded"
    paths = result[F7B_FP]
    assert len(paths) == 1, (
        f"governance invariant: .env.production.example must NOT count as "
        f"active consumer; got paths={paths}"
    )
    assert paths[0].endswith("silkbay/.env.production"), (
        f"expected active production path; got {paths[0]}"
    )
    # Hard reverse assertion — the example path MUST NOT be present.
    for p in paths:
        assert not p.endswith(".example"), (
            f"governance violation: .example suffix leaked into active "
            f"consumer_paths: {p}"
        )
