#!/usr/bin/env python3
"""scout.py — github-scout Hands CLI. Phase 0: `report` only. READ-ONLY, advisory.

BGHS classification: primary_concern = Hands (see declaration.yaml). This tool sits
OUTSIDE the Skill three-layer spine (it is BGHS-Hands infrastructure, not an L2
Executable Skill); it CONSUMES the L1 methodology SSOT and never originates policy.

Authority chain (plan §1 / SKILL_CONSTITUTION §3):
    docs/methodology/01_Research_Intelligence/github-scout/license_policy.yaml  (L1 SSOT)
        -> scout.py loads it at runtime; tiers/ceilings are NEVER hardcoded here.

Model-independent invariants (pinned by ADR-GitHub-Prior-Art-Scout):
  I1  Zero external mutating side-effect. No fork/clone/vendor/PR/network write.
      Only local, gitignored traces/ may be written.
  I2  Read-only by construction. Default sends NO Authorization header
      (unauthenticated public read). A token is attached ONLY when explicitly
      provided AND asserted via the X-OAuth-Scopes response header on a successful
      (HTTP 200) probe; Phase 0 requires a NO-SCOPE token, so any classic scope
      (incl. read:org) OR an inconclusive (non-200) probe => fail-closed. No live
      write probe is ever issued.
  I3  Sequential inspect state machine. Per candidate: fetch authoritative
      license FIRST -> resolve tier -> fetch README/tree ONLY IF the tier ceiling
      permits. A missing LICENSE (404) => confidence='no_license'; any other fetch
      failure (5xx/timeout/NOASSERTION/'other') => confidence='fetch_failed'; both
      => tier=unknown, ceiling=metadata_only.

Usage:
    python3 tools/github-scout/scout.py report --idea "an idea in a sentence" [--out traces/run.json]
        [--limit N] [--json] [--policy PATH] [--token-env VAR]
Other subcommands (derive/search/inspect/emit-reference) are reserved for Phase 1.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# NOTE: PyYAML is imported lazily inside LicensePolicy.load() so that --help and the
# reserved subcommands work with zero third-party deps; only `report` needs it.

API_ROOT = "https://api.github.com"
USER_AGENT = "liye-github-scout/0.1 (read-only; advisory)"
# Phase 0 requires a NO-SCOPE token. A public prior-art scout needs zero scopes for
# public reads, so ANY non-empty classic scope (including read:org) => fail-closed
# (I2). Fine-grained tokens report an EMPTY X-OAuth-Scopes header, so a fine-grained
# "Public repositories (read-only)" token also passes; note that fine-grained perms
# are NOT exposed via this header and rely on the operator provisioning it read-only.


class ScoutFatal(Exception):
    """Raised on any fail-closed condition; aborts the run cleanly."""


# --------------------------------------------------------------------------- #
# Transport (single network chokepoint; injectable for H-3 network-layer tests)
# --------------------------------------------------------------------------- #
class HttpTransport:
    """Default transport over urllib. Returns (status, headers_dict, body_bytes)."""

    def get(self, url: str, headers: dict) -> tuple[int, dict, bytes]:
        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                return resp.status, {k.lower(): v for k, v in resp.headers.items()}, resp.read()
        except urllib.error.HTTPError as e:
            body = e.read() if hasattr(e, "read") else b""
            return e.code, {k.lower(): v for k, v in (e.headers or {}).items()}, body


class GitHubClient:
    """Read-only GitHub REST client. Every request flows through _get(), which
    records an entry into call_log — that log is the network-layer evidence for I3."""

    def __init__(self, transport=None, token: str | None = None):
        self.transport = transport or HttpTransport()
        self.token = token
        self.call_log: list[dict] = []      # [{kind, repo, path, status}]
        self.auth_mode = "unauthenticated"
        self.token_scopes: list[str] = []

    def _get(self, path: str, kind: str, repo: str | None = None) -> tuple[int, dict, object]:
        url = path if path.startswith("http") else API_ROOT + path
        headers = {"Accept": "application/vnd.github+json",
                   "User-Agent": USER_AGENT,
                   "X-GitHub-Api-Version": "2022-11-28"}
        if self.token:                       # I2: header attached only when token present
            headers["Authorization"] = "Bearer " + self.token
        status, hdrs, body = self.transport.get(url, headers)
        self.call_log.append({"kind": kind, "repo": repo, "path": path, "status": status})
        if status == 403 and hdrs.get("x-ratelimit-remaining") == "0":
            raise ScoutFatal("GitHub rate limit exhausted (read budget). Stop; retry later "
                             "or supply a read-only token to raise the limit.")
        parsed: object = None
        if body:
            try:
                parsed = json.loads(body)
            except (ValueError, UnicodeDecodeError):
                parsed = None
        return status, hdrs, parsed

    # --- I2: read-only assertion (passive header read; NO live write probe) ---
    def assert_readonly_or_die(self) -> None:
        if not self.token:
            self.auth_mode = "unauthenticated"     # read-only by construction
            return
        status, hdrs, _ = self._get("/rate_limit", kind="auth_probe")  # benign read
        if status != 200:
            # GHS-01 fail-closed: without an authoritative 200 we cannot trust the
            # ABSENCE of scopes (error responses carry no X-OAuth-Scopes header), so we
            # must NOT proceed with — or attach — the token (I2). 401 = invalid/expired;
            # 5xx / abuse-403 = inconclusive. Either way, refuse rather than fail open.
            raise ScoutFatal(
                "read-only assertion inconclusive: token auth-probe returned HTTP %s; "
                "refusing to use the token (fail-closed, I2). Run unauthenticated, or "
                "supply a verifiable NO-SCOPE token." % status)
        raw = hdrs.get("x-oauth-scopes", "")
        scopes = [s.strip() for s in raw.split(",") if s.strip()]
        self.token_scopes = scopes
        if scopes:   # ANY classic scope (incl. read:org) is too broad for a public scout
            raise ScoutFatal(
                "supplied token carries scope(s) %s — Phase 0 requires a NO-SCOPE token "
                "(fail-closed, I2). Use a classic token with NO scopes, or a fine-grained "
                "'Public repositories (read-only)' token." % scopes)
        self.auth_mode = "authenticated-readonly"

    # --- metadata (one search call covers all candidates) ---
    def search_repos(self, query: str, limit: int) -> list[dict]:
        q = urllib.parse.urlencode(
            {"q": query, "sort": "stars", "order": "desc", "per_page": str(limit)})
        status, _, parsed = self._get("/search/repositories?" + q, kind="search")
        if status == 422:
            raise ScoutFatal("search query rejected by GitHub (422): %r" % query)
        if status != 200 or not isinstance(parsed, dict):
            raise ScoutFatal("search failed (HTTP %s)." % status)
        return parsed.get("items", []) or []

    # --- authoritative license: the GATE fetch (I3 step 1) ---
    def authoritative_license(self, repo: str) -> tuple[str | None, str]:
        """Returns (spdx_lower_or_None, confidence) where confidence in
        {'ok', 'no_license', 'fetch_failed'}."""
        try:
            status, _, parsed = self._get("/repos/%s/license" % repo, kind="license", repo=repo)
        except ScoutFatal:
            raise
        except Exception:
            return None, "fetch_failed"
        if status == 404:
            return None, "no_license"
        if status != 200 or not isinstance(parsed, dict):
            return None, "fetch_failed"
        spdx = ((parsed.get("license") or {}).get("spdx_id") or "").strip()
        if not spdx or spdx.upper() in {"NOASSERTION", "OTHER"}:
            return None, "fetch_failed"   # unrecognized => fail-closed bucket
        return spdx.lower(), "ok"

    # --- gated fetches (I3 step 3; only called when ceiling permits) ---
    def readme_excerpt(self, repo: str, limit_chars: int = 240) -> str | None:
        status, _, parsed = self._get("/repos/%s/readme" % repo, kind="readme", repo=repo)
        if status != 200 or not isinstance(parsed, dict):
            return None
        try:
            text = base64.b64decode(parsed.get("content", "")).decode("utf-8", "replace")
        except Exception:
            return None
        return re.sub(r"\s+", " ", text).strip()[:limit_chars] or None

    def tree_shape(self, repo: str, limit: int = 25) -> list[str] | None:
        status, _, parsed = self._get("/repos/%s/contents" % repo, kind="tree", repo=repo)
        if status != 200 or not isinstance(parsed, list):
            return None
        return [e.get("name", "") for e in parsed[:limit] if isinstance(e, dict)]


# --------------------------------------------------------------------------- #
# License policy (loaded from the L1 SSOT; never hardcoded here)
# --------------------------------------------------------------------------- #
class LicensePolicy:
    def __init__(self, doc: dict):
        self.doc = doc
        self.tiers = doc["tiers"]
        self.ceilings = doc["inspect_ceilings"]
        self.leaves = set(doc["recommendation_leaves"])
        self._spdx_index = {}
        for tier_name, tier in self.tiers.items():
            for spdx in (tier.get("spdx") or []):
                self._spdx_index[spdx.lower()] = tier_name
        self._validate()

    def _validate(self) -> None:
        if "unknown" not in self.tiers:
            raise ScoutFatal("policy missing required fail-closed tier 'unknown'.")
        for name, tier in self.tiers.items():
            if tier["inspect_ceiling"] not in self.ceilings:
                raise ScoutFatal("tier %s references unknown ceiling %s" % (name, tier["inspect_ceiling"]))
            allowed = set(tier["allowed_recommendations"])
            if not allowed <= self.leaves:
                raise ScoutFatal("tier %s allows non-leaf recommendation(s)" % name)
            if tier["default_recommendation"] not in allowed:
                raise ScoutFatal("tier %s default_recommendation not in its allowed set" % name)

    @classmethod
    def load(cls, path: Path) -> "LicensePolicy":
        if not path.exists():
            raise ScoutFatal("license policy SSOT not found at %s" % path)
        try:
            import yaml
        except ImportError:
            raise ScoutFatal("PyYAML is required to load the license policy SSOT. "
                             "Install it: `python3 -m pip install pyyaml` (or `uv add pyyaml`).")
        return cls(yaml.safe_load(path.read_text(encoding="utf-8")))

    def tier_for(self, spdx_lower: str | None) -> str:
        if not spdx_lower:
            return "unknown"
        return self._spdx_index.get(spdx_lower, "unknown")

    def ceiling_stages(self, tier_name: str) -> list[str]:
        return list(self.ceilings[self.tiers[tier_name]["inspect_ceiling"]])

    def tier(self, tier_name: str) -> dict:
        return self.tiers[tier_name]


# --------------------------------------------------------------------------- #
# Lexical helpers (relevance/query are metadata-only signals; M-4)
# --------------------------------------------------------------------------- #
_STOP = set(("a an the of for to and or with in on into via using build make create "
             "system that this your our new idea app tool service platform engine "
             "based simple framework library project").split())


def derive_query(idea: str) -> str:
    """Lexical term extraction. Returns '' when no meaningful term survives the
    stopword filter — callers must treat that as a loud derivation failure (M-4),
    not silently fall back to the raw idea as a strong query."""
    words = [w for w in re.findall(r"[a-z0-9+#]+", idea.lower())
             if w not in _STOP and len(w) > 2]
    # GitHub search ANDs terms; >3 terms collapses recall to near-zero. Keep the 3
    # strongest (input order) — a recall/precision default, tunable in Phase 1.
    return " ".join(words[:3])


def lexical_relevance(query: str, item: dict) -> dict:
    terms = set(query.lower().split())
    name = (item.get("name") or "").lower()
    desc = (item.get("description") or "").lower()
    topics = " ".join(item.get("topics") or []).lower()
    in_name = {t for t in terms if t in name or t in topics}
    in_desc = {t for t in terms if t in desc}
    matched = in_name | in_desc
    # M-4: a candidate whose ONLY signal is a description-substring match is weak.
    desc_only = bool(matched) and not in_name
    return {
        "matched_terms": sorted(matched),
        "signal": "name_or_topic" if in_name else ("description_only" if in_desc else "none"),
        "low_confidence": (not matched) or desc_only,
    }


# --------------------------------------------------------------------------- #
# Report (the only Phase 0 deliverable)
# --------------------------------------------------------------------------- #
RECALL_NOTICE = (
    "ADVISORY ONLY — heuristic prior-art recon, NOT a decision. Per SYSTEMS.md Fork "
    "纪律: any reuse outcome enters the harvest-ADR / Reference Declaration ceremony; "
    "a 'reference-only' result = a read-only reference satellite, never a runtime "
    "dependency. RED/unknown licenses are fail-closed. Transitive licenses and "
    "supply-chain trust are NOT scanned here (Phase 1)."
)
HARD_NON_GOALS = [
    "no-fork", "no-clone", "no-vendor", "no-PR", "no-network-write",
    "no-Codebase-Registry-write", "no-production-contract", "not-a-runtime-dependency",
    "stars-are-not-sole-ranking", "no-automatic-behavior-fit-conclusion",
]


def recommend(policy: LicensePolicy, tier_name: str, relevance: dict) -> dict:
    tier = policy.tier(tier_name)
    leaf = tier["default_recommendation"]
    sub = tier.get("default_sub_reason")
    caveats = ["transitive-unscanned"]      # Phase 0 never scans transitive deps
    if relevance["low_confidence"] and leaf == "needs-human-review":
        caveats.append("relevance-low-confidence")
    return {
        "recommendation": leaf,
        "sub_reason": sub if leaf == "needs-human-review" else None,
        "allowed_recommendations": tier["allowed_recommendations"],
        "caveats": caveats,
        "obligations": tier.get("obligations") or [],
        "policy_note": tier.get("notes", "").strip(),
    }


def inspect_candidate(client: GitHubClient, policy: LicensePolicy, item: dict, query: str) -> dict:
    repo = item.get("full_name", "")
    metadata = {
        "repo": repo,
        "stars": item.get("stargazers_count", 0),
        "pushed_at": (item.get("pushed_at") or "")[:10],
        "description": item.get("description") or "",
        "url": item.get("html_url") or ("https://github.com/" + repo),
    }
    # I3 step 1 — authoritative license FIRST (the gate)
    spdx, confidence = client.authoritative_license(repo)
    tier_name = policy.tier_for(spdx) if confidence == "ok" else "unknown"
    stages = policy.ceiling_stages(tier_name)
    license_block = {
        "spdx": spdx, "tier": tier_name, "confidence": confidence,
        "inspect_ceiling": policy.tier(tier_name)["inspect_ceiling"],
    }
    # I3 step 3 — gated fetches, ONLY if the ceiling permits
    readme = client.readme_excerpt(repo) if "readme" in stages else None
    tree = client.tree_shape(repo) if "tree" in stages else None
    relevance = lexical_relevance(query, item)
    return {
        "metadata": metadata,
        "license": license_block,
        "inspected": {"readme_excerpt": readme, "tree_shape": tree,
                      "stages_permitted": stages},
        "relevance": relevance,
        **recommend(policy, tier_name, relevance),
        "low_confidence": relevance["low_confidence"],
    }


def build_report(idea: str, limit: int, policy: LicensePolicy,
                 client: GitHubClient) -> dict:
    client.assert_readonly_or_die()            # I2
    terms = derive_query(idea)
    query = terms or idea.strip()              # fall back to raw idea for the search...
    query_weak = len(terms.split()) < 2        # ...but weakness is judged on derived terms
    candidates = client.search_repos(query, limit)
    inspected = [inspect_candidate(client, policy, it, query) for it in candidates]
    notices = []
    if query_weak:
        notices.append("derived query is weak (<2 terms) — broaden the idea or add "
                       "topic:/language: qualifiers manually (model-contingent risk).")
    if not candidates:
        notices.append("no candidates for query %r — broaden terms." % query)
    return {
        "schema": "github-scout/report",
        "phase": 0,
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "recall_notice": RECALL_NOTICE,
        "hard_non_goals": HARD_NON_GOALS,
        "auth_mode": client.auth_mode,
        "token_scopes": client.token_scopes,
        "policy_version": policy.doc.get("policy_version"),
        "idea": idea,
        "derived_query": query,
        "notices": notices,
        "candidate_count": len(inspected),
        "candidates": inspected,
        "network_call_summary": _call_summary(client.call_log),
    }


def _call_summary(call_log: list[dict]) -> dict:
    out: dict[str, int] = {}
    for c in call_log:
        out[c["kind"]] = out.get(c["kind"], 0) + 1
    return out


def _hash_idea(idea: str) -> str:
    return hashlib.sha256(idea.encode("utf-8")).hexdigest()[:12]


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def _default_policy_path() -> Path:
    root = Path(__file__).resolve().parents[2]   # tools/github-scout/scout.py -> repo root
    return root / "docs/methodology/01_Research_Intelligence/github-scout/license_policy.yaml"


def _traces_root() -> Path:
    return (Path(__file__).resolve().parent / "traces").resolve()


def _safe_trace_path(out_arg: str) -> Path:
    """Confine --out STRICTLY to tools/github-scout/traces/ (invariant I1). Reject
    absolute paths and any '..' escape; the only writable surface is traces/."""
    traces_root = _traces_root()
    p = Path(out_arg)
    if p.is_absolute():
        raise ScoutFatal("--out must be relative to traces/; absolute path rejected (I1): %s" % out_arg)
    parts = [x for x in p.parts if x not in ("", ".")]
    if parts and parts[0] == "traces":           # tolerate 'traces/run.json' or bare 'run.json'
        parts = parts[1:]
    if not parts:
        raise ScoutFatal("--out must name a file under traces/ (got empty/dir): %s" % out_arg)
    resolved_path = (traces_root / Path(*parts)).resolve()
    if resolved_path == traces_root or traces_root not in resolved_path.parents:
        raise ScoutFatal("--out escapes traces/ ('..'/absolute rejected, I1): %s" % out_arg)
    return resolved_path


def _print_human(report: dict) -> None:
    print("== github-scout report (Phase 0, advisory) ==")
    print("idea   :", report["idea"])
    print("query  :", report["derived_query"], "  | auth:", report["auth_mode"])
    for n in report["notices"]:
        print("notice :", n)
    print("-" * 78)
    for i, c in enumerate(report["candidates"], 1):
        m, lic = c["metadata"], c["license"]
        flag = " [low-confidence]" if c["low_confidence"] else ""
        print("%2d %-38s %6s★  %-12s %-16s %s%s" % (
            i, m["repo"][:38], m["stars"], lic["spdx"] or "none",
            lic["tier"], c["recommendation"], flag))
        if c["sub_reason"]:
            print("     sub_reason:", c["sub_reason"], "| caveats:", ",".join(c["caveats"]))
    print("-" * 78)
    print("calls  :", report["network_call_summary"])
    print(report["recall_notice"])


def cmd_report(args: argparse.Namespace) -> int:
    if not args.idea or not args.idea.strip():
        sys.stderr.write("ERROR: --idea is required and must be non-empty\n")
        return 2
    out = _safe_trace_path(args.out) if args.out else None   # I1: validate BEFORE any network
    policy = LicensePolicy.load(Path(args.policy) if args.policy else _default_policy_path())
    token = os.environ.get(args.token_env) if args.token_env else None
    client = GitHubClient(token=token)
    report = build_report(args.idea, args.limit, policy, client)
    if out:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        sys.stderr.write("trace written: %s\n" % out)
    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        _print_human(report)
    return 0


def _reserved(args: argparse.Namespace) -> int:
    sys.stderr.write("'%s' is reserved for Phase 1 and not implemented.\n" % args.cmd)
    return 3


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="scout.py", description="github-scout (Phase 0: report only)")
    sub = p.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("report", help="idea -> ranked, license-gated prior-art report")
    r.add_argument("--idea", required=True, help="the idea, in a sentence")
    r.add_argument("--out", default=None,
                   help="trace filename, confined to traces/ (I1; absolute/'..' rejected)")
    r.add_argument("--limit", type=int, default=8, help="max search candidates (default 8)")
    r.add_argument("--json", action="store_true", help="print full JSON to stdout")
    r.add_argument("--policy", default=None, help="override license_policy.yaml path")
    r.add_argument("--token-env", default="GITHUB_SCOUT_READONLY_TOKEN",
                   help="env var holding a READ-ONLY token (asserted; default unauthenticated)")
    r.set_defaults(func=cmd_report)

    for name in ("derive", "search", "inspect", "emit-reference"):
        sp = sub.add_parser(name, help="(Phase 1, reserved)")
        sp.set_defaults(func=_reserved)

    args = p.parse_args(argv)
    try:
        return args.func(args)
    except ScoutFatal as e:
        sys.stderr.write("FAIL-CLOSED: %s\n" % e)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
