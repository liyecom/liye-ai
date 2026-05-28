"""scan_consumers exclude/include invariant tests.

Per PHASE-0B-SPEC.md §5.2 line 190-192 — `consumer_paths` is current
working-tree active config only:
    Excluded:
      - `.example` / `.template` / `.sample` / `.bak` / `.bak-*` suffixes
      - paths under `scripts/`
      - paths under `.github/workflows/`
    Included:
      - `.env.production` (active, NOT example)
      - `.env.local`
    Filtered: tokens whose fp is NOT in known_fingerprints.

These tests pin the implementation strategy: **strict suffix / path-segment
matching, never substring**. They are the governance safety net protecting
against future regressions that might subbring substring checks back in.
"""

from __future__ import annotations

import hashlib

from phase_0b_parser.scan_consumers import scan_consumers


def _fp(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()[:12]


TOK = "sk_INVARIANTtoken12345678901234567xyz"
FP = _fp(TOK)
KNOWN = {FP}


# ---------------------------------------------------------------------------
# Exclude — file suffixes.
# ---------------------------------------------------------------------------
def test_excludes_example_suffix(tmp_path):
    """`.env.example` must be excluded; sibling `.env.local` must be active."""
    root = tmp_path / "tests" / "fixtures" / "INV_example"
    sf = root / "storefronts" / "sf-mock"
    sf.mkdir(parents=True)
    (sf / ".env.local").write_text(f"TOKEN={TOK}\n")
    (sf / ".env.example").write_text(f"TOKEN={TOK}\n")

    result = scan_consumers(root, KNOWN)

    assert FP in result
    paths = result[FP]
    assert len(paths) == 1
    assert paths[0].endswith(".env.local")
    assert not any(p.endswith(".example") for p in paths)


def test_excludes_template_suffix(tmp_path):
    """`.env.template` must be excluded."""
    root = tmp_path / "tests" / "fixtures" / "INV_template"
    sf = root / "storefronts" / "sf-mock"
    sf.mkdir(parents=True)
    (sf / ".env.local").write_text(f"TOKEN={TOK}\n")
    (sf / ".env.template").write_text(f"TOKEN={TOK}\n")

    result = scan_consumers(root, KNOWN)
    assert len(result[FP]) == 1
    assert not any(p.endswith(".template") for p in result[FP])


def test_excludes_bak_suffix(tmp_path):
    """`.env.bak` and `.env.bak-2026-05-20` (rotation) both excluded."""
    root = tmp_path / "tests" / "fixtures" / "INV_bak"
    sf = root / "storefronts" / "sf-mock"
    sf.mkdir(parents=True)
    (sf / ".env.local").write_text(f"TOKEN={TOK}\n")
    (sf / ".env.bak").write_text(f"TOKEN={TOK}\n")
    (sf / ".env.bak-2026-05-20").write_text(f"TOKEN={TOK}\n")

    result = scan_consumers(root, KNOWN)
    assert len(result[FP]) == 1
    paths = result[FP]
    assert not any(p.endswith(".bak") for p in paths)
    assert not any(".bak-" in p.rsplit("/", 1)[-1] for p in paths)


def test_excludes_sample_suffix(tmp_path):
    """`.env.sample` must be excluded."""
    root = tmp_path / "tests" / "fixtures" / "INV_sample"
    sf = root / "storefronts" / "sf-mock"
    sf.mkdir(parents=True)
    (sf / ".env.local").write_text(f"TOKEN={TOK}\n")
    (sf / ".env.sample").write_text(f"TOKEN={TOK}\n")

    result = scan_consumers(root, KNOWN)
    assert len(result[FP]) == 1
    assert not any(p.endswith(".sample") for p in result[FP])


# ---------------------------------------------------------------------------
# Exclude — path segments.
# ---------------------------------------------------------------------------
def test_excludes_scripts_dir(tmp_path):
    """`.env` under a `scripts/` segment must be excluded even if active."""
    root = tmp_path / "tests" / "fixtures" / "INV_scripts"
    scripts_dir = root / "storefronts" / "sf-mock" / "scripts"
    scripts_dir.mkdir(parents=True)
    (scripts_dir / ".env").write_text(f"TOKEN={TOK}\n")

    result = scan_consumers(root, KNOWN)
    # No active consumer file remains — fp must not appear.
    assert FP not in result, (
        f"scripts/ path must be excluded; got result={result}"
    )


def test_excludes_github_workflows(tmp_path):
    """`.env` under `.github/workflows/` must be excluded."""
    root = tmp_path / "tests" / "fixtures" / "INV_gha"
    wf = root / "storefronts" / "sf-mock" / ".github" / "workflows"
    wf.mkdir(parents=True)
    (wf / ".env").write_text(f"TOKEN={TOK}\n")

    result = scan_consumers(root, KNOWN)
    assert FP not in result


# ---------------------------------------------------------------------------
# Include — active production / local.
# ---------------------------------------------------------------------------
def test_includes_production_suffix(tmp_path):
    """`.env.production` is active (companion to F7b — independent assertion)."""
    root = tmp_path / "tests" / "fixtures" / "INV_production"
    sf = root / "silkbay"
    sf.mkdir(parents=True)
    (sf / ".env.production").write_text(f"TOKEN={TOK}\n")

    result = scan_consumers(root, KNOWN)
    assert FP in result
    assert len(result[FP]) == 1
    assert result[FP][0].endswith(".env.production")


def test_includes_local_suffix(tmp_path):
    """`.env.local` is active."""
    root = tmp_path / "tests" / "fixtures" / "INV_local"
    sf = root / "silkbay"
    sf.mkdir(parents=True)
    (sf / ".env.local").write_text(f"TOKEN={TOK}\n")

    result = scan_consumers(root, KNOWN)
    assert FP in result
    assert len(result[FP]) == 1
    assert result[FP][0].endswith(".env.local")


# ---------------------------------------------------------------------------
# Fingerprint gate.
# ---------------------------------------------------------------------------
def test_excludes_unknown_fp(tmp_path):
    """Token's fp not in known_fingerprints → token ignored, not in result."""
    root = tmp_path / "tests" / "fixtures" / "INV_unknown_fp"
    sf = root / "silkbay"
    sf.mkdir(parents=True)
    (sf / ".env.local").write_text(f"TOKEN={TOK}\n")

    # Empty set — no known fingerprints.
    result = scan_consumers(root, set())
    assert result == {}, f"unknown fp must be filtered out; got {result}"
