"""scan_disk — disk plaintext fingerprint scan (M2 scope).

Per PHASE-0B-SPEC.md §6.2 line 258:
    Input:  portfolio root path
    Output: Set[FingerprintRecord] (disk_sources only)
    Side effects: none

Scope per SPEC §2 line 29-32:
    - ~/.claude/**/*.json (user-level Claude config — independent of portfolio_root)
    - <any-repo>/.claude/**/*.json
    - **/.env*  (all variants: .env.local, .env.localkeys, .env.production, .env.production.example, ...)
    - **/.envrc (direnv)

PORTFOLIO_REPOS allowlist sourced from liye_os/CLAUDE.md "Repo 索引" + "索引外仓库"
sections — only the 10 layer-0/1/2/3 repos participate in governance scans; the
explicitly out-of-scope repos (hermes-agent / openclaw / openclaw-skillgate /
claw-price-intel / age-main-cron / financial-services) are skipped.

Fingerprint formula locked at SPEC §5.2 line 175:
    sha256(token.utf-8).hexdigest()[:12]  — no salt, lowercase.

Token regex coverage (M2 scope per SPEC §5.2 line 186 key_type enum):
    sk_ / pk_ / jwt.  Future M3+: oauth, db, other.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from pathlib import Path
from typing import Iterable

from .models import DiskSource, FingerprintRecord
from .path_normalize import normalize

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Portfolio allowlist — derived from liye_os/CLAUDE.md "Repo 索引" section.
# Only these repos are governance-scanned. Repos listed under "索引外仓库"
# (hermes-agent, openclaw, openclaw-skillgate, claw-price-intel, age-main-cron,
# financial-services) are explicitly excluded.
# ---------------------------------------------------------------------------
PORTFOLIO_REPOS: tuple[str, ...] = (
    "liye_os", "loamwise",
    "amazon-growth-engine", "chaming",
    "silkbay", "storefronts", "kits", "themes", "growth-hub",
    "sites",
)


# ---------------------------------------------------------------------------
# Token regexes — SPEC §5.2 line 186 key_type enum (M2 covers 3 of 7).
# `\b` word-boundary anchors prevent substring captures.
# Length >= 20 chars rejects trivially-short noise tokens.
# ---------------------------------------------------------------------------
TOKEN_PATTERNS: dict[str, re.Pattern[str]] = {
    "sk_": re.compile(r"\bsk_[A-Za-z0-9_-]{20,}\b"),
    "pk_": re.compile(r"\bpk_[A-Za-z0-9_-]{20,}\b"),
    "jwt": re.compile(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b"),
}


# ---------------------------------------------------------------------------
# .env / .envrc line parser.
# Tolerates: leading whitespace, optional `export`, quoted values, lowercase keys.
# Skips comments (^#) and blank lines at call site.
# ---------------------------------------------------------------------------
ENV_LINE = re.compile(
    r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$'
)


# Directories to skip recursively during traversal.
EXCLUDE_DIRS: frozenset[str] = frozenset({
    ".git", "node_modules", ".next", "__pycache__", ".venv",
    "dist", "build", ".pytest_cache", ".mypy_cache",
})

# Self-reference guard — never recurse into our own fixture tree when scanning
# the real portfolio root (~/github/), otherwise mock tokens would leak into
# the production fingerprint set.
EXCLUDE_FIXTURES_PATH_FRAGMENT = "tools/phase-0b-parser/tests/fixtures"


# ---------------------------------------------------------------------------
# Internal helpers — leading underscore is intentional. The verb-whitelist
# lint (`scripts/lint-verb-whitelist.sh`) only matches `^(async )?def [a-z]+_`,
# so `_fingerprint` / `_redact` / etc. are excluded by design. SPEC §6.1
# whitelist (classify|is|list|report|scan) constrains public verb-prefixed
# API only; private helpers are out of scope.
# ---------------------------------------------------------------------------
def _fingerprint(token: str) -> str:
    """sha256(token.utf-8).hexdigest()[:12] — SPEC §5.2 line 175, no salt, lowercase."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()[:12]


def _redact(token: str) -> str:
    """`sk_XXX***YYY` form — SPEC §5.2 line 145 example `sk_c48***51b`."""
    if len(token) <= 8:
        return "***"
    return f"{token[:6]}***{token[-3:]}"


def _is_fixture_path(p: Path) -> bool:
    """True when path lives inside our own tests/fixtures tree."""
    return "tests/fixtures" in str(p)


def _looks_like_portfolio_root(root: Path) -> bool:
    """True when `root` directly contains at least one PORTFOLIO_REPOS entry.

    Distinguishes "real portfolio scan" (apply allowlist) vs "fixture scan"
    (flat traversal — fixtures don't reproduce the full repo layout).
    """
    if _is_fixture_path(root):
        return False
    for repo in PORTFOLIO_REPOS:
        if (root / repo).is_dir():
            return True
    return False


def _iter_scan_dirs(portfolio_root: Path) -> Iterable[Path]:
    """Yield the directories whose subtree we should glob.

    - Real portfolio root (`~/github/`-like): yield each PORTFOLIO_REPOS entry
      that exists. Out-of-scope repos are silently skipped.
    - Otherwise (fixture path / single-repo path): yield the root itself.
    """
    if _looks_like_portfolio_root(portfolio_root):
        for repo in PORTFOLIO_REPOS:
            sub = portfolio_root / repo
            if sub.is_dir():
                yield sub
    else:
        yield portfolio_root


def _walk_files(base: Path, *, fixture_mode: bool) -> Iterable[Path]:
    """Walk `base`, skipping EXCLUDE_DIRS and (when scanning a real portfolio
    root) our own fixtures tree to prevent mock tokens leaking into the
    production fingerprint set."""
    if not base.exists():
        return
    for p in base.rglob("*"):
        if not p.is_file():
            continue
        # Skip if any path component is in EXCLUDE_DIRS.
        if any(part in EXCLUDE_DIRS for part in p.parts):
            continue
        # Skip self-fixtures only when scanning the real portfolio root.
        # In fixture mode the caller is asking us to scan that very tree.
        if not fixture_mode and EXCLUDE_FIXTURES_PATH_FRAGMENT in str(p):
            continue
        yield p


def _classify_path_role(p: Path, *, fixture_mode: bool) -> str | None:
    """Identify scan role of `p`: 'claude_json' / 'env' / 'envrc' / None.

    SPEC §2 line 30 restricts JSON scans to `<repo>/.claude/**/*.json`. In
    fixture mode that restriction is relaxed — fixtures (e.g. F8 under
    `dotclaude/`) deliberately avoid the literal `.claude` segment so the
    real `~/.claude/` glob can't accidentally absorb fixture data; for
    the test harness we scan every JSON below the fixture root.

    Note: leading-underscore helper to stay outside verb whitelist (SPEC §6.1).
    """
    name = p.name
    parts = p.parts
    if name.endswith(".json"):
        if fixture_mode or ".claude" in parts:
            return "claude_json"
    if name == ".envrc":
        return "envrc"
    if name.startswith(".env"):
        return "env"
    return None


def _extract_from_env_lines(text: str) -> list[tuple[str, str, int]]:
    """Parse env-style file content.

    Returns: list of (token, env_var_name, line_number).
    """
    results: list[tuple[str, str, int]] = []
    for idx, raw in enumerate(text.splitlines(), start=1):
        stripped = raw.lstrip()
        if not stripped or stripped.startswith("#"):
            continue
        m = ENV_LINE.match(raw)
        if not m:
            continue
        key, value = m.group(1), m.group(2)
        for key_type, pat in TOKEN_PATTERNS.items():
            for tok in pat.findall(value):
                results.append((tok, key, idx))
    return results


def _walk_json(node: object, path: list[str]) -> Iterable[tuple[str, str]]:
    """Recursively walk a JSON-decoded structure.

    Yields (string_value, dotted_json_path) for every string leaf.
    """
    if isinstance(node, dict):
        for k, v in node.items():
            yield from _walk_json(v, path + [str(k)])
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from _walk_json(v, path + [f"[{i}]"])
    elif isinstance(node, str):
        # Render JSON path: `permissions.allow[3]` style.
        dotted = ""
        for seg in path:
            if seg.startswith("["):
                dotted += seg
            else:
                dotted = seg if not dotted else f"{dotted}.{seg}"
        yield node, dotted


def _line_of_first_occurrence(haystack_lines: list[str], needle: str) -> int:
    """Return 1-indexed line of needle's first occurrence; 0 if not found."""
    for idx, line in enumerate(haystack_lines, start=1):
        if needle in line:
            return idx
    return 0


def _extract_from_json_file(path: Path) -> list[tuple[str, str, int]]:
    """Parse a JSON file. Returns (token, json_path, line) tuples.

    Malformed JSON logs a warning and returns []. Per SPEC §7 F13.
    """
    try:
        raw_text = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        logger.warning("scan_disk: unreadable file %s — %s", path, exc)
        return []
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        logger.warning("scan_disk: malformed JSON %s — %s", path, exc)
        return []

    raw_lines = raw_text.splitlines()
    out: list[tuple[str, str, int]] = []
    for value, json_path in _walk_json(data, []):
        for key_type, pat in TOKEN_PATTERNS.items():
            for tok in pat.findall(value):
                line_no = _line_of_first_occurrence(raw_lines, tok)
                out.append((tok, json_path, line_no))
    return out


def _key_type_for(token: str) -> str:
    for kt, pat in TOKEN_PATTERNS.items():
        if pat.fullmatch(token):
            return kt
    # Fallback prefix sniff.
    if token.startswith("sk_"):
        return "sk_"
    if token.startswith("pk_"):
        return "pk_"
    if token.startswith("eyJ"):
        return "jwt"
    return "unknown"


def _merge_into(records: dict[str, FingerprintRecord], token: str, source: DiskSource) -> None:
    """Merge a hit into the fingerprint-keyed record dict.

    SPEC §7 F15: same fp from multiple sources collapses into one record,
    additional sources append to `disk_sources`.
    """
    fp = _fingerprint(token)
    rec = records.get(fp)
    if rec is None:
        rec = FingerprintRecord(
            fingerprint_sha256_12=fp,
            key_type=_key_type_for(token),
            redacted=_redact(token),
        )
        records[fp] = rec
    rec.disk_sources.append(source)


def _scan_user_claude(records: dict[str, FingerprintRecord]) -> None:
    """Scan `~/.claude/**/*.json` — independent of portfolio_root.

    Hard-coded to `Path.home() / '.claude'` so a fixture root cannot redirect
    or alias this scan branch. Skipped when called from a fixture-mode entry.
    """
    user_claude = Path.home() / ".claude"
    if not user_claude.is_dir():
        return
    for p in user_claude.rglob("*.json"):
        if any(part in EXCLUDE_DIRS for part in p.parts):
            continue
        for token, json_path, line_no in _extract_from_json_file(p):
            _merge_into(records, token, DiskSource(
                path=str(p),
                line=line_no,
                env_var=json_path or None,
            ))


def scan_disk(portfolio_root: str | Path) -> set[FingerprintRecord]:
    """Discover credentials on disk under `portfolio_root`.

    Per SPEC §11.1 M2 + §7 F1/F8/F12/F13 scope, §2 lines 29-32 scope definition.

    Modes:
      - **Real portfolio scan** (portfolio_root contains PORTFOLIO_REPOS subdirs):
        Apply allowlist — only the 10 layered repos are walked. Out-of-scope
        repos (per CLAUDE.md "索引外仓库") are silently skipped. `~/.claude/`
        is also scanned (user-level config is a separate ground-truth source).
      - **Fixture / single-tree scan** (portfolio_root has no PORTFOLIO_REPOS
        children, OR sits inside `tests/fixtures/`): Flat traversal of the
        given tree. `~/.claude/` is **not** scanned (would pollute fixture
        tests with the real user's config).

    Returns: Set[FingerprintRecord] with `disk_sources` populated. Other fields
    (db_metadata / consumer_paths / disk_duplicate_paths / classification) stay
    at dataclass defaults — later milestones fill them.
    """
    root = normalize(portfolio_root)
    fixture_mode = _is_fixture_path(root)

    records: dict[str, FingerprintRecord] = {}

    # User-level scan only outside fixture mode (real portfolio scans).
    if not fixture_mode:
        _scan_user_claude(records)

    # Per-scope-dir walks.
    for base in _iter_scan_dirs(root):
        for p in _walk_files(base, fixture_mode=fixture_mode):
            role = _classify_path_role(p, fixture_mode=fixture_mode)
            if role is None:
                continue
            if role == "claude_json":
                for token, json_path, line_no in _extract_from_json_file(p):
                    _merge_into(records, token, DiskSource(
                        path=str(p),
                        line=line_no,
                        env_var=json_path or None,
                    ))
            elif role in ("env", "envrc"):
                try:
                    text = p.read_text(encoding="utf-8", errors="replace")
                except OSError as exc:
                    logger.warning("scan_disk: unreadable file %s — %s", p, exc)
                    continue
                if not text:
                    continue
                for token, env_var, line_no in _extract_from_env_lines(text):
                    _merge_into(records, token, DiskSource(
                        path=str(p),
                        line=line_no,
                        env_var=env_var,
                    ))

    return set(records.values())
