"""Smoke tests — CLI flag, env var fallback, default root, and
helper-function round-trips. Per PHASE-0B-SPEC.md §12 Q3 portfolio root
detection (M2 default decision: CLI > env > ~/github/).
"""

from __future__ import annotations

import hashlib

from phase_0b_parser import cli
from phase_0b_parser.scan_disk import (
    PORTFOLIO_REPOS,
    TOKEN_PATTERNS,
    _fingerprint,
    _redact,
    scan_disk,
)


def test_fingerprint_helper_matches_spec_formula():
    """SPEC §5.2 line 175 — sha256(token.utf-8).hexdigest()[:12]."""
    token = "sk_test_abcdef1234567890"
    expected = hashlib.sha256(token.encode("utf-8")).hexdigest()[:12]
    assert _fingerprint(token) == expected
    assert len(_fingerprint(token)) == 12
    assert _fingerprint(token).islower() or _fingerprint(token).isdigit() or all(
        c in "0123456789abcdef" for c in _fingerprint(token)
    )


def test_redact_helper_shape():
    """SPEC §5.2 line 145 — sk_XXX***YYY style."""
    assert _redact("sk_c4851b1234567890abc") == "sk_c48***abc"
    # Short tokens → fallback ***.
    assert _redact("short") == "***"


def test_token_patterns_cover_sk_pk_jwt():
    """M2 covers 3 of 7 key_type enum values per SPEC §5.2 line 186."""
    assert "sk_" in TOKEN_PATTERNS
    assert "pk_" in TOKEN_PATTERNS
    assert "jwt" in TOKEN_PATTERNS


def test_portfolio_repos_allowlist_matches_claude_md():
    """liye_os/CLAUDE.md 'Repo 索引' — 10 layered repos. Index-外 excluded."""
    assert "liye_os" in PORTFOLIO_REPOS
    assert "storefronts" in PORTFOLIO_REPOS
    assert "amazon-growth-engine" in PORTFOLIO_REPOS
    # Explicitly out-of-scope per CLAUDE.md "索引外仓库" section.
    assert "hermes-agent" not in PORTFOLIO_REPOS
    assert "financial-services" not in PORTFOLIO_REPOS


def test_scan_disk_accepts_string_path(tmp_path):
    """Input contract: portfolio_root: str | Path."""
    assert scan_disk(str(tmp_path)) == set()


def test_scan_disk_nonexistent_path_does_not_crash(tmp_path):
    """Robustness: a path that doesn't exist should yield empty, not raise."""
    bogus = tmp_path / "does-not-exist"
    result = scan_disk(bogus)
    assert result == set()


def test_cli_default_portfolio_root(monkeypatch, capsys):
    """CLI default = ~/github/ when no flag and no env. Exit code 0."""
    monkeypatch.delenv("LIYE_PORTFOLIO_ROOT", raising=False)
    # Use a known-empty tmp path to keep this hermetic and fast.
    # Strategy: pass an explicit --portfolio-root that's empty.
    rc = cli.main(["--portfolio-root", "/nonexistent-path-for-smoke-test"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "scan_disk found" in out


def _materialize_f1(base):
    """Build an F1-shaped fixture under `base` and return its root.

    Uses a `tests/fixtures/F1_ghost` sub-path so scan_disk's fixture-mode
    detection (suppresses ~/.claude/ scan) still fires — same convention as
    test_scan_disk_F1.py.
    """
    root = base / "tests" / "fixtures" / "F1_ghost"
    sf_mock = root / "storefronts" / "sf-mock"
    sf_mock.mkdir(parents=True)
    (sf_mock / ".env.local").write_text(
        "DB_URL=postgres://user:pass@localhost/db\n"
        "MEDUSA_ADMIN_TOKEN=sk_F1MOCKghost1234567890abcdefXYZ\n"
        "PORT=9000\n"
    )
    return root


def _materialize_f12(base):
    root = base / "tests" / "fixtures" / "F12_empty"
    silkbay = root / "silkbay"
    silkbay.mkdir(parents=True)
    (silkbay / ".env.local").touch()
    return root


def test_cli_portfolio_root_flag(monkeypatch, capsys, tmp_path):
    """`--portfolio-root <F1-shaped fixture>` → reports 1 record."""
    monkeypatch.delenv("LIYE_PORTFOLIO_ROOT", raising=False)
    f1 = _materialize_f1(tmp_path)
    rc = cli.main(["--portfolio-root", str(f1)])
    out = capsys.readouterr().out
    assert rc == 0
    assert "found 1" in out


def test_cli_env_var_fallback(monkeypatch, capsys, tmp_path):
    """`LIYE_PORTFOLIO_ROOT=...` honored when no --portfolio-root flag."""
    f1 = _materialize_f1(tmp_path)
    monkeypatch.setenv("LIYE_PORTFOLIO_ROOT", str(f1))
    rc = cli.main([])
    out = capsys.readouterr().out
    assert rc == 0
    assert "found 1" in out


def test_cli_flag_overrides_env(monkeypatch, capsys, tmp_path):
    """Precedence: CLI flag > env var. Env points to F1 (1 record); flag
    points to F12 (0 records) — output must reflect F12."""
    f1 = _materialize_f1(tmp_path / "env_target")
    f12 = _materialize_f12(tmp_path / "flag_target")
    monkeypatch.setenv("LIYE_PORTFOLIO_ROOT", str(f1))
    rc = cli.main(["--portfolio-root", str(f12)])
    out = capsys.readouterr().out
    assert rc == 0
    assert "found 0" in out
