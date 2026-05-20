"""Path normalization per PHASE-0B-SPEC.md §7 F11 (line 331).

Expand `~` / `$HOME`, resolve relative paths, return absolute realpath.
This is the canonical helper for all disk-source path comparisons.
"""

from __future__ import annotations

import os
from pathlib import Path


def normalize(p: str | Path) -> Path:
    """Return a fully-resolved absolute Path.

    Per SPEC §7 F11 line 331: `~` / `$HOME` / relative → realpath absolute.
    Also per target-classes.yaml line 3: 'Parser MUST: expand ~/$HOME;
    realpath relative paths; POSIX separators only'.

    Steps:
        1. Expand `~` and `~user` via os.path.expanduser
        2. Expand `$VAR` / `${VAR}` via os.path.expandvars
        3. Resolve to absolute realpath (follows symlinks)

    Args:
        p: path string or Path-like

    Returns:
        Resolved absolute Path. Does not require the path to exist
        (Path.resolve(strict=False)).
    """
    s = str(p)
    s = os.path.expanduser(s)
    s = os.path.expandvars(s)
    return Path(s).resolve()
