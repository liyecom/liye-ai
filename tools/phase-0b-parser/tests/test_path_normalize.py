"""F11 — path normalization tests per PHASE-0B-SPEC.md §7 line 331."""

from __future__ import annotations

import os
from pathlib import Path

from phase_0b_parser.path_normalize import normalize


def test_F11_tilde_expansion(monkeypatch, tmp_path):
    """`~/foo` → absolute path under expanded HOME."""
    monkeypatch.setenv("HOME", str(tmp_path))
    result = normalize("~/foo")
    assert result.is_absolute()
    assert str(result).startswith(str(tmp_path.resolve()))
    assert result.name == "foo"


def test_F11_dollar_home_expansion(monkeypatch, tmp_path):
    """`$HOME/foo` → absolute path; expandvars must run."""
    monkeypatch.setenv("HOME", str(tmp_path))
    result = normalize("$HOME/foo")
    assert result.is_absolute()
    assert str(result).startswith(str(tmp_path.resolve()))
    assert result.name == "foo"


def test_F11_relative_to_cwd(monkeypatch, tmp_path):
    """`./foo` → cwd-anchored absolute path."""
    monkeypatch.chdir(tmp_path)
    result = normalize("./foo")
    assert result.is_absolute()
    # tmp_path itself may be a symlink (e.g. /var → /private/var on macOS);
    # compare against resolved tmp_path so the realpath assertion holds.
    assert result == tmp_path.resolve() / "foo"


def test_F11_parent_relative(monkeypatch, tmp_path):
    """`../foo` → resolved against cwd's parent."""
    subdir = tmp_path / "sub"
    subdir.mkdir()
    monkeypatch.chdir(subdir)
    result = normalize("../foo")
    assert result.is_absolute()
    assert result == tmp_path.resolve() / "foo"


def test_F11_returns_pathlib_path():
    """Contract: always returns pathlib.Path (not str)."""
    assert isinstance(normalize("/tmp"), Path)
