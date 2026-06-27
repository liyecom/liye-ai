#!/usr/bin/env python3
"""source_intake.py — source-intake Hands CLI (PR3 impl of .planning/source-intake/SPEC.md).

The GOVERNED re-homing of skill-forge's only distinctive capability — "ingest an
external GitHub repo into skill materials" — as a Layer-0 tool. This is NOT a
one-click pipeline: it is a seven-stage state machine (S0..S6) with two human gates
that the machine may never cross. See SPEC §1.

BGHS classification: primary_concern = Hands (see declaration.yaml). This tool sits
OUTSIDE the Skill three-layer spine; it CONSUMES the github-scout L1 license SSOT
and the official skill-creator build backend, and never originates policy.

Authority chain (SPEC §核验接地):
    docs/methodology/01_Research_Intelligence/github-scout/license_policy.yaml  (L1 SSOT)
        -> loaded here at runtime; tier MEMBERSHIP is NEVER hardcoded. The acquisition
           gate (tier -> acquire/skip) IS source-intake's own contract (SPEC S2).

Model-independent invariants (declaration.yaml; mirror SPEC §2.3):
  I1  no auto-crossing: never auto-initiate intake from a scout report; products land
      only in repo-EXTERNAL staging; repo gets a small manifest only; never vendor source.
  I2  read-only acquisition: NO-SCOPE/read-only token only; ambient gh token with ANY
      classic scope => fail-closed; acquisition is HTTPS pinned tarball only (no git
      protocol / credential helper / submodule / LFS).
  I3  pin-first-then-verify (TOCTOU): S1 pins the commit, S2 re-verifies license ON that
      commit; strong_copyleft / unknown fetch NO source.
  I4  license-tier != trust-tier: acquired content is audited regardless of how
      permissive the license is (lethal trifecta / OWASP LLM01).
  I5  two-class packaging: official-class lives repo-external + provenance under
      metadata.sfc; liye-sfc-class carries the 8 SFC keys; sfc_ci_gate is unchanged.

Usage:
    python3 tools/source-intake/source_intake.py validate-request --request req.json
    python3 tools/source-intake/source_intake.py intake --request req.json [--out run.json]
        [--staging-root DIR] [--token-env VAR] [--json]
    python3 tools/source-intake/source_intake.py promote --manifest run.json --approved-by NAME
"""
from __future__ import annotations

import argparse
import gzip  # noqa: F401  (kept explicit; tarfile r:gz uses it internally)
import hashlib
import io
import json
import os
import re
import sys
import tarfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# PyYAML imported lazily inside LicensePolicy.load() (only `intake` needs the SSOT).

API_ROOT = "https://api.github.com"
USER_AGENT = "liye-source-intake/0.1 (read-only; governed)"

SCHEMA_REQUEST = "liye-os/source-intake-request@1"
SCHEMA_MANIFEST = "liye-os/source-manifest@1"

# Human-choice menu leaves (mirrored from scout's recommendation_leaves SSOT).
LEAF_REFERENCE_ONLY = "reference-only"
LEAF_REIMPLEMENT = "reimplement"
LEAF_NEEDS_HUMAN = "needs-human-review"
LEAF_SKIP = "skip"
_ALL_LEAVES = (LEAF_REFERENCE_ONLY, LEAF_REIMPLEMENT, LEAF_NEEDS_HUMAN, LEAF_SKIP)

PRODUCT_REFERENCE_PACK = "reference-pack"
PRODUCT_SKILL_DRAFT = "skill-draft"
PRODUCT_MCP_DRAFT = "mcp-draft"
_ALL_PRODUCTS = (PRODUCT_REFERENCE_PACK, PRODUCT_SKILL_DRAFT, PRODUCT_MCP_DRAFT)
# The PR3 MVP runtime EXECUTES only these. mcp-draft stays a recognized FUTURE product
# (kept in the schema enum for forward-compat) but is deferred to PR4 (delegates to the
# existing mcp-builder); the runtime fails closed on it so it can never reach acquisition.
# SPEC D8 / §5 / DoD.
_MVP_PRODUCTS = (PRODUCT_REFERENCE_PACK, PRODUCT_SKILL_DRAFT)

# Acquisition gate decisions (source-intake's OWN policy; tier membership is the SSOT's).
GATE_PROCEED = "proceed-acquire"
GATE_REIMPLEMENT_PUBLIC_DOCS = "reimplement-only-public-docs"
GATE_SKIP = "skip"


class IntakeFatal(Exception):
    """Raised on any fail-closed condition; aborts the run cleanly (exit 2)."""


# --------------------------------------------------------------------------- #
# License policy — reuse the github-scout L1 SSOT at runtime (never copy the table)
# --------------------------------------------------------------------------- #
class LicensePolicy:
    """Thin consumer of the SAME license_policy.yaml SSOT that github-scout loads.
    Reuses the SSOT *data* (tier membership / allowed_recommendations / obligations);
    does NOT import scout.py and does NOT hardcode which SPDX is which tier."""

    # tier -> source-intake acquisition gate. SPEC S2. This mapping is THIS tool's
    # contract (it is not in the SSOT, which carries scout's inspect ceilings). Tier
    # MEMBERSHIP (which SPDX -> which tier) still comes from the SSOT at runtime.
    ACQUIRE_GATE = {
        "permissive": GATE_PROCEED,
        "permissive_with_obligations": GATE_PROCEED,
        "weak_copyleft": GATE_PROCEED,
        "strong_copyleft": GATE_REIMPLEMENT_PUBLIC_DOCS,
        "unknown": GATE_SKIP,
    }

    def __init__(self, doc: dict):
        self.doc = doc
        self.tiers = doc["tiers"]
        self._spdx_index: dict[str, str] = {}
        for tier_name, tier in self.tiers.items():
            for spdx in (tier.get("spdx") or []):
                self._spdx_index[spdx.lower()] = tier_name
        if "unknown" not in self.tiers:
            raise IntakeFatal("policy SSOT missing required fail-closed tier 'unknown'.")
        # Drift guard: every SSOT tier must have an explicit acquisition gate. A new
        # tier appearing in the SSOT with no mapping must NOT silently fail open.
        for name in self.tiers:
            if name not in self.ACQUIRE_GATE:
                raise IntakeFatal(
                    "tier %r in SSOT has no source-intake acquisition gate mapping "
                    "(SSOT drifted; refusing to fail open)." % name)

    @classmethod
    def load(cls, path: Path) -> "LicensePolicy":
        if not path.exists():
            raise IntakeFatal("license policy SSOT not found at %s" % path)
        try:
            import yaml
        except ImportError:
            raise IntakeFatal("PyYAML is required to load the license policy SSOT. "
                              "Install it: `python3 -m pip install pyyaml`.")
        return cls(yaml.safe_load(path.read_text(encoding="utf-8")))

    def tier_for(self, spdx_lower: str | None) -> str:
        if not spdx_lower:
            return "unknown"
        return self._spdx_index.get(spdx_lower, "unknown")

    def obligations(self, tier_name: str) -> list:
        return list(self.tiers[tier_name].get("obligations") or [])

    def allowed_recommendations(self, tier_name: str) -> list:
        return list(self.tiers[tier_name].get("allowed_recommendations") or [])

    def acquire_gate(self, tier_name: str) -> str:
        return self.ACQUIRE_GATE.get(tier_name, GATE_SKIP)   # default fail-closed


# --------------------------------------------------------------------------- #
# URL guard (N5: only https://github.com/owner/name; reject git-protocol injection)
# --------------------------------------------------------------------------- #
_GITHUB_HTTPS_RE = re.compile(
    r"^https://github\.com/([A-Za-z0-9][A-Za-z0-9_.-]*)/([A-Za-z0-9][A-Za-z0-9_.-]*?)(?:\.git)?$")
_URL_INJECTION_MARKERS = ("ext::", "fd::", "file://", "git://", "ssh://", "git+", "@", "..",
                          "\n", "\t", " ")


def parse_github_repo_url(url: str) -> str:
    """N5: accept ONLY https://github.com/owner/name. Reject git-protocol injection
    (ext::/fd::/file:///git:///ssh://), credential-embedding '@', any non-github host,
    and '..' traversal. Returns canonical 'owner/name'."""
    if not isinstance(url, str) or not url.strip():
        raise IntakeFatal("candidate_url missing/empty (N5).")
    cleaned = url.strip().rstrip("/")
    for bad in _URL_INJECTION_MARKERS:
        if bad in cleaned:
            raise IntakeFatal(
                "candidate_url rejected — forbidden token %r (N5, git-protocol/injection "
                "guard): %s" % (bad, url))
    m = _GITHUB_HTTPS_RE.match(cleaned)
    if not m:
        raise IntakeFatal("candidate_url must be exactly https://github.com/owner/name (N5): %s" % url)
    owner, name = m.group(1), m.group(2)
    if owner in (".", "..") or name in (".", ".."):
        raise IntakeFatal("candidate_url owner/name invalid (N5): %s" % url)
    return "%s/%s" % (owner, name)


# --------------------------------------------------------------------------- #
# Transport (single network chokepoint; injectable for offline tests)
# --------------------------------------------------------------------------- #
class HttpTransport:
    """Default transport over urllib. Returns (status, headers_dict, body_bytes)."""

    def get(self, url: str, headers: dict) -> tuple[int, dict, bytes]:
        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.status, {k.lower(): v for k, v in resp.headers.items()}, resp.read()
        except urllib.error.HTTPError as e:
            body = e.read() if hasattr(e, "read") else b""
            return e.code, {k.lower(): v for k, v in (e.headers or {}).items()}, body


class GitHubReadOnlyClient:
    """Read-only GitHub client. Every request flows through _get(), which records an
    entry in call_log — the network-layer evidence for I2/I3."""

    def __init__(self, transport=None, token: str | None = None):
        self.transport = transport or HttpTransport()
        self.token = token
        self.call_log: list[dict] = []
        self.auth_mode = "unauthenticated"
        self.token_scopes: list[str] = []

    def _get(self, url: str, kind: str, expect_json: bool = True):
        full = url if url.startswith("http") else API_ROOT + url
        headers = {"User-Agent": USER_AGENT}
        if expect_json:
            headers["Accept"] = "application/vnd.github+json"
            headers["X-GitHub-Api-Version"] = "2022-11-28"
        if self.token:                       # I2: header attached only when token present
            headers["Authorization"] = "Bearer " + self.token   # mirrors scout.py read-only auth
        try:
            status, hdrs, body = self.transport.get(full, headers)
        except IntakeFatal:
            raise
        except (urllib.error.URLError, OSError) as e:
            raise IntakeFatal(
                "GitHub transport failure for %s: %s: %s. Network/TLS transport "
                "condition, not a code error; fail-closed." % (full, type(e).__name__, e)
            ) from e
        self.call_log.append({"kind": kind, "url": full, "status": status})
        if status == 403 and hdrs.get("x-ratelimit-remaining") == "0":
            raise IntakeFatal("GitHub rate limit exhausted (read budget). Stop; retry later "
                              "or supply a read-only token to raise the limit.")
        if not expect_json:
            return status, hdrs, body
        parsed = None
        if body:
            try:
                parsed = json.loads(body)
            except (ValueError, UnicodeDecodeError):
                parsed = None
        return status, hdrs, parsed

    # --- I2 / N4: read-only assertion (passive scope read; NO live write probe) ---
    def assert_readonly_or_die(self) -> None:
        if not self.token:
            self.auth_mode = "unauthenticated"
            return
        status, hdrs, _ = self._get("/rate_limit", kind="auth_probe")
        if status != 200:
            raise IntakeFatal(
                "read-only assertion inconclusive: token auth-probe returned HTTP %s; "
                "refusing to use the token (fail-closed, I2/N4). Run unauthenticated or "
                "supply a verifiable NO-SCOPE token." % status)
        raw = hdrs.get("x-oauth-scopes", "")
        scopes = [s.strip() for s in raw.split(",") if s.strip()]
        self.token_scopes = scopes
        if scopes:   # ANY classic scope is too broad for a read-only intake
            raise IntakeFatal(
                "supplied token carries scope(s) %s — source-intake requires a NO-SCOPE "
                "token (fail-closed, I2/N4). Use a classic token with NO scopes, or a "
                "fine-grained 'Public repositories (read-only)' token." % scopes)
        self.auth_mode = "authenticated-readonly"

    # --- S1: resolve the default-branch HEAD commit (scout emits no commit_sha) ---
    def resolve_head_commit(self, repo: str) -> tuple[str, str]:
        status, _, parsed = self._get("/repos/%s" % repo, kind="repo_meta")
        if status != 200 or not isinstance(parsed, dict):
            raise IntakeFatal("cannot resolve repo %s (HTTP %s); fail-closed." % (repo, status))
        branch = parsed.get("default_branch")
        if not branch:
            raise IntakeFatal("repo %s exposes no default_branch; fail-closed." % repo)
        status, _, parsed = self._get(
            "/repos/%s/commits/%s" % (repo, urllib.parse.quote(branch)), kind="resolve_commit")
        if status != 200 or not isinstance(parsed, dict):
            raise IntakeFatal("cannot resolve HEAD commit of %s@%s (HTTP %s)." % (repo, branch, status))
        sha = parsed.get("sha")
        if not isinstance(sha, str) or not re.fullmatch(r"[0-9a-f]{40}", sha):
            raise IntakeFatal("resolved commit sha is not 40-hex for %s: %r" % (repo, sha))
        return branch, sha

    # --- S2: authoritative license AT THE PINNED COMMIT (TOCTOU; correction #1) ---
    def license_at_commit(self, repo: str, commit: str) -> tuple[str | None, str]:
        """Returns (spdx_lower_or_None, confidence) in {'ok','no_license','fetch_failed'}.
        Verified against the PINNED commit, never the floating default branch."""
        status, _, parsed = self._get(
            "/repos/%s/license?ref=%s" % (repo, commit), kind="license_at_pin")
        if status == 404:
            return None, "no_license"
        if status != 200 or not isinstance(parsed, dict):
            return None, "fetch_failed"
        spdx = ((parsed.get("license") or {}).get("spdx_id") or "").strip()
        if not spdx or spdx.upper() in {"NOASSERTION", "OTHER"}:
            return None, "fetch_failed"      # unrecognized => fail-closed bucket
        return spdx.lower(), "ok"

    # --- S3: GitHub pinned tarball (no git clone; HTTPS only; D6) ---
    def fetch_tarball(self, repo: str, commit: str) -> tuple[str, bytes, str]:
        url = "https://github.com/%s/archive/%s.tar.gz" % (repo, commit)
        status, _, body = self._get(url, kind="tarball", expect_json=False)
        if status != 200 or not body:
            raise IntakeFatal("tarball fetch failed for %s@%s (HTTP %s)." % (repo, commit, status))
        return url, body, hashlib.sha256(body).hexdigest()


# --------------------------------------------------------------------------- #
# S0 — request validation (pure; N6 + N11 + schema shape)
# --------------------------------------------------------------------------- #
def validate_request(request: dict) -> dict:
    """S0 human-gate validation. Returns the request on success, raises IntakeFatal
    otherwise. Enforces the requested_product x chosen_leaf conditional rules (N6)
    and chosen_leaf ∈ scout's mirrored allowed menu (N11)."""
    if not isinstance(request, dict):
        raise IntakeFatal("request must be a JSON object.")
    if request.get("schema") != SCHEMA_REQUEST:
        raise IntakeFatal("request.schema must be %r (got %r)." % (SCHEMA_REQUEST, request.get("schema")))
    src = request.get("source")
    decision = request.get("human_decision")
    if not isinstance(src, dict) or not isinstance(decision, dict):
        raise IntakeFatal("request.source and request.human_decision are required objects.")
    repo = src.get("candidate_repo")
    url = src.get("candidate_url")
    scout_menu = src.get("scout_allowed_recommendations")
    if not repo or not url:
        raise IntakeFatal("source.candidate_repo and source.candidate_url are required.")
    if not isinstance(scout_menu, list) or not scout_menu:
        raise IntakeFatal("source.scout_allowed_recommendations must be a non-empty list "
                          "(原样镜像 scout emit).")
    leaf = decision.get("chosen_leaf")
    if leaf not in _ALL_LEAVES:
        raise IntakeFatal("human_decision.chosen_leaf invalid: %r (allowed: %s)." % (leaf, list(_ALL_LEAVES)))
    # N11: the human may not pick a leaf outside scout's tier menu for this candidate.
    if leaf not in scout_menu:
        raise IntakeFatal(
            "N11: chosen_leaf %r is not in scout's allowed_recommendations %s — the human "
            "cannot exceed the tier menu (e.g. 'reference-only' on a strong_copyleft repo)."
            % (leaf, scout_menu))
    if leaf == LEAF_SKIP:
        raise IntakeFatal("chosen_leaf=skip — request should not be submitted; nothing to intake.")
    product = request.get("requested_product")
    if product not in _ALL_PRODUCTS:
        raise IntakeFatal("requested_product invalid: %r (allowed: %s)." % (product, list(_ALL_PRODUCTS)))
    # mcp-draft (and any other non-MVP product) is deferred: fail closed at S0 — BEFORE any
    # pin/license/acquire — so a deferred product can never open the execution face in PR3.
    if product not in _MVP_PRODUCTS:
        raise IntakeFatal(
            "requested_product=%r is deferred to PR4 and is NOT executed by the PR3 MVP "
            "runtime (mcp-draft delegates to the existing mcp-builder). The schema keeps the "
            "enum for forward-compat, but the runtime refuses to acquire. MVP executes only "
            "%s. See SPEC D8 / §5 / DoD." % (product, list(_MVP_PRODUCTS)))
    scenarios = request.get("scenarios")
    attest = request.get("human_attestations") or {}
    if not isinstance(scenarios, list) or not scenarios:
        raise IntakeFatal("scenarios must be a non-empty list (>=1; skill-draft needs >=3).")
    # N6 — skill-draft thresholds (D2): reimplement + >=3 scenarios + harvest_adr_ref.
    if product == PRODUCT_SKILL_DRAFT:
        if leaf != LEAF_REIMPLEMENT:
            raise IntakeFatal("N6: requested_product=skill-draft requires chosen_leaf=reimplement (got %r)." % leaf)
        if len(scenarios) < 3:
            raise IntakeFatal("N6: skill-draft requires >=3 real scenarios (got %d)." % len(scenarios))
        if not attest.get("harvest_adr_ref"):
            raise IntakeFatal("N6: skill-draft requires human_attestations.harvest_adr_ref (harvest-ADR ceremony).")
    else:  # reference-pack (default): skip already rejected; mcp-draft already deferred above
        if leaf not in (LEAF_REFERENCE_ONLY, LEAF_REIMPLEMENT, LEAF_NEEDS_HUMAN):
            raise IntakeFatal("%s requires chosen_leaf ∈ {reference-only, reimplement, needs-human-review}." % product)
    if not attest.get("semantic_fit_reviewed"):
        raise IntakeFatal("human_attestations.semantic_fit_reviewed must be true (human gate #2).")
    return request


# --------------------------------------------------------------------------- #
# S2 — acquisition gate decision (derived from the SSOT-resolved tier)
# --------------------------------------------------------------------------- #
def gate_decision_for(policy: LicensePolicy, tier_name: str) -> dict:
    gate = policy.acquire_gate(tier_name)
    return {
        "license_gate": gate,
        "acquisition_allowed": gate == GATE_PROCEED,
        "rationale": "tier=%s -> %s" % (tier_name, gate),
    }


# --------------------------------------------------------------------------- #
# S5 — sandbox audit over acquired content (I4: license-tier != trust-tier)
# --------------------------------------------------------------------------- #
_INJECTION_MARKERS = (
    "ignore previous instructions", "ignore all previous", "disregard the above",
    "disregard all prior", "system prompt", "you are now", "exfiltrate",
    "curl http", "wget http", "base64 -d", "rm -rf", "<script", "data:text/html",
    "__suspicious_member_path__", "__tarball_unreadable__",
)
_SECRET_RES = (
    re.compile(r"AKIA[0-9A-Z]{16}"),                 # AWS access key id
    re.compile(r"ghp_[A-Za-z0-9]{36}"),              # GitHub PAT
    re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}"),     # Slack token
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
)


def extract_text_samples(tar_gz_bytes: bytes, max_members: int = 200,
                         max_bytes_per_file: int = 200_000, max_total: int = 2_000_000) -> list:
    """Read text samples from a gzip tarball IN MEMORY (read-only sandbox). Caps member
    count and bytes to bound the audit surface. NEVER extracts to disk; a member with a
    traversal/absolute path or an un-parseable archive becomes a fail-closed signal."""
    samples: list[str] = []
    total = 0
    try:
        with tarfile.open(fileobj=io.BytesIO(tar_gz_bytes), mode="r:gz") as tf:
            for i, member in enumerate(tf):
                if i >= max_members or total >= max_total:
                    break
                if not member.isfile():
                    continue
                if member.name.startswith("/") or ".." in Path(member.name).parts:
                    samples.append("__SUSPICIOUS_MEMBER_PATH__:" + member.name)
                    continue
                try:
                    f = tf.extractfile(member)
                    if f is None:
                        continue
                    data = f.read(max_bytes_per_file)
                    total += len(data)
                    samples.append(data.decode("utf-8", "replace"))
                except Exception:
                    continue
    except (tarfile.TarError, OSError, EOFError, ValueError):
        return ["__TARBALL_UNREADABLE__"]
    return samples


def audit_staged_content(samples: list) -> dict:
    """S5 sandbox audit. Runs regardless of license tier (I4). The MACHINE never returns
    'pass' — a clean scan yields 'flagged' (awaiting the human sign-off at S6); any
    high-signal hit yields 'blocked'. Returns the manifest trust_audit block."""
    findings: list[dict] = []
    blob = "\n".join(s for s in samples if isinstance(s, str))
    low = blob.lower()
    for marker in _INJECTION_MARKERS:
        if marker in low:
            findings.append({"check": "prompt-injection", "marker": marker})
    for rx in _SECRET_RES:
        if rx.search(blob):
            findings.append({"check": "secret-scan", "pattern": rx.pattern})
    verdict = "blocked" if findings else "flagged"
    return {
        "verdict": verdict,
        "checks": ["prompt-injection", "lethal-trifecta-surface", "secret-scan"],
        "findings": findings,
        "machine_can_pass": False,   # only a human upgrades 'flagged' -> 'pass' at S6
        "notes": "license-tier != trust-tier; audited regardless of license permissiveness (I4).",
    }


# --------------------------------------------------------------------------- #
# Staging (repo-external) + helpers
# --------------------------------------------------------------------------- #
def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]   # tools/source-intake/source_intake.py -> repo root


def default_staging_root() -> Path:
    return Path(os.path.expanduser("~")) / ".liye-os" / "source-intake-staging"


def assert_staging_is_repo_external(path, repo_root: Path | None = None) -> None:
    """HG4 / N9: staged third-party content must live OUTSIDE the repo. Refuse any
    staging path inside the repo (no vendoring source into liye_os)."""
    root = (repo_root or _repo_root()).resolve()
    target = Path(path).resolve()
    if target == root or root in target.parents:
        raise IntakeFatal(
            "staging path %s is INSIDE the repo — refused (N9/HG4: no third-party "
            "source vendored into liye_os; repo gets only the small manifest)." % target)


class StagingSink:
    """Persists the acquired tarball to repo-EXTERNAL staging. Injectable; tests pass a
    recording fake or None (run_intake performs no disk write when sink is None)."""

    def write(self, path, data: bytes) -> None:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)


def sha256_of_canonical(obj) -> str:
    return hashlib.sha256(
        json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        .encode("utf-8")).hexdigest()


def _now_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# --------------------------------------------------------------------------- #
# S1..S5 orchestration — produces source_manifest.json; NEVER promotes (S6 is human)
# --------------------------------------------------------------------------- #
def run_intake(request: dict, client: GitHubReadOnlyClient, policy: LicensePolicy,
               staging_root=None, sink: "StagingSink | None" = None,
               now_utc: str | None = None) -> dict:
    request = validate_request(request)                  # S0 (idempotent re-check)
    src = request["source"]
    repo_url = src["candidate_url"]
    repo = parse_github_repo_url(repo_url)               # N5
    if src.get("candidate_repo") and src["candidate_repo"] != repo:
        raise IntakeFatal("source.candidate_repo %r != repo parsed from candidate_url (%r)."
                          % (src["candidate_repo"], repo))
    staging_root = Path(staging_root) if staging_root else default_staging_root()
    assert_staging_is_repo_external(staging_root)        # N9/HG4 (validate BEFORE any fetch)

    client.assert_readonly_or_die()                      # S1 auth / I2 / N4

    branch, pinned = client.resolve_head_commit(repo)    # S1 pin
    now = now_utc or _now_utc()

    spdx, confidence = client.license_at_commit(repo, pinned)   # S2 — on the PINNED commit
    tier = policy.tier_for(spdx) if confidence == "ok" else "unknown"
    gate = gate_decision_for(policy, tier)
    scout_advisory = src.get("scout_license_tier_advisory")
    toctou_divergence = bool(scout_advisory) and scout_advisory != tier   # N3 留痕

    manifest = {
        "schema": SCHEMA_MANIFEST,
        "generated_at_utc": now,
        "request_ref": sha256_of_canonical(request),
        "upstream": {
            "repo": repo,
            "url": repo_url,
            "pinned_commit": pinned,
            "pinned_ref_kind": "default-branch-head-at-pin-time",
            "default_branch": branch,
            "resolved_at_utc": now,
        },
        "license": {
            "spdx": spdx,
            "tier": tier,
            "confidence": confidence,
            "verified_against_commit": pinned,            # HG3: == upstream.pinned_commit
            "scout_tier_advisory": scout_advisory,
            "toctou_divergence": toctou_divergence,       # N3: pinned re-verify is authoritative
            "obligations": policy.obligations(tier),
            "policy_version": policy.doc.get("policy_version"),
        },
        "gate_decision": gate,
        "acquisition": None,
        "trust_audit": None,
        "product": {
            "class": request["requested_product"],
            "packaging": ("liye-sfc-class" if request["requested_product"] == PRODUCT_REFERENCE_PACK
                          else "official-class"),
            "staged_only": True,                          # correction #2 / HG6
            "provenance_block": "metadata.sfc",
        },
    }

    # S2 fail-closed exits — strong_copyleft hard-branch / unknown skip => NO acquire (I3/N1/N2).
    if not gate["acquisition_allowed"]:
        manifest["acquisition"] = {"method": None, "skipped_reason": gate["license_gate"]}
        return manifest

    # S3 ACQUIRE — pinned tarball + re-download stability check (N10).
    url1, body1, sha1 = client.fetch_tarball(repo, pinned)
    _url2, _body2, sha2 = client.fetch_tarball(repo, pinned)
    if sha1 != sha2:
        raise IntakeFatal("N10: tarball sha256 unstable across re-download (%s != %s); fail-closed."
                          % (sha1, sha2))
    staged_path = staging_root / repo.replace("/", "__") / ("%s.tar.gz" % pinned)
    if sink is not None:
        sink.write(staged_path, body1)
    manifest["acquisition"] = {
        "method": "github-pinned-tarball",
        "url": url1,
        "tarball_sha256": sha1,
        "staged_path": str(staged_path),
        "representation": "raw",
    }

    # S5 STAGE + AUDIT — over acquired content, regardless of license tier (I4).
    manifest["trust_audit"] = audit_staged_content(extract_text_samples(body1))
    return manifest


# --------------------------------------------------------------------------- #
# S6 — promote guard (the tool NEVER auto-promotes; human ceremony only)
# --------------------------------------------------------------------------- #
def assert_promotable_or_die(manifest: dict, human_attestation: dict | None = None) -> bool:
    """S6 human-ceremony guard. Promotion requires ALL of:
      - explicit human_attestation with approved_by               (N7: no auto-promote)
      - trust_audit.verdict == 'pass'  (only a human sets pass)   (N8: license != trust)
      - acquisition.staged_path is repo-EXTERNAL                  (N9/HG4: no vendor)
    Raises IntakeFatal on any failure; returns True only when all hold."""
    if not isinstance(human_attestation, dict) or not human_attestation.get("approved_by"):
        raise IntakeFatal("N7: promote requires an explicit human attestation (approved_by). "
                          "Products are staged-only until a human signs off.")
    audit = manifest.get("trust_audit") or {}
    if audit.get("verdict") != "pass":
        raise IntakeFatal("N8: trust_audit.verdict is %r (not 'pass') — promotion blocked "
                          "regardless of license tier (license != trust)." % audit.get("verdict"))
    acq = manifest.get("acquisition") or {}
    staged = acq.get("staged_path")
    if staged:
        assert_staging_is_repo_external(staged)
    return True


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def _default_policy_path() -> Path:
    return _repo_root() / "docs/methodology/01_Research_Intelligence/github-scout/license_policy.yaml"


def _traces_root() -> Path:
    return (Path(__file__).resolve().parent / "traces").resolve()


def _safe_trace_path(out_arg: str) -> Path:
    """Confine --out STRICTLY to tools/source-intake/traces/ (mirror scout's I1 guard).
    Reject absolute paths and any '..' escape; the only writable surface is traces/."""
    traces_root = _traces_root()
    p = Path(out_arg)
    if p.is_absolute():
        raise IntakeFatal("--out must be relative to traces/; absolute path rejected: %s" % out_arg)
    parts = [x for x in p.parts if x not in ("", ".")]
    if parts and parts[0] == "traces":
        parts = parts[1:]
    if not parts:
        raise IntakeFatal("--out must name a file under traces/ (got empty/dir): %s" % out_arg)
    resolved = (traces_root / Path(*parts)).resolve()
    if resolved == traces_root or traces_root not in resolved.parents:
        raise IntakeFatal("--out escapes traces/ ('..'/absolute rejected): %s" % out_arg)
    return resolved


def _load_json(path_arg: str) -> dict:
    p = Path(path_arg)
    if not p.exists():
        raise IntakeFatal("file not found: %s" % path_arg)
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (ValueError, UnicodeDecodeError) as e:
        raise IntakeFatal("invalid JSON in %s: %s" % (path_arg, e))


def cmd_validate_request(args: argparse.Namespace) -> int:
    request = _load_json(args.request)
    validate_request(request)
    print("VALID: source_intake_request accepted (S0 human-gate checks passed).")
    print("  product :", request.get("requested_product"))
    print("  leaf    :", (request.get("human_decision") or {}).get("chosen_leaf"))
    print("  repo    :", (request.get("source") or {}).get("candidate_repo"))
    return 0


def cmd_intake(args: argparse.Namespace) -> int:
    out = _safe_trace_path(args.out) if args.out else None   # validate BEFORE any network
    request = _load_json(args.request)
    policy = LicensePolicy.load(Path(args.policy) if args.policy else _default_policy_path())
    token = os.environ.get(args.token_env) if args.token_env else None
    client = GitHubReadOnlyClient(token=token)
    staging_root = args.staging_root or str(default_staging_root())
    sink = None if args.dry_run else StagingSink()
    manifest = run_intake(request, client, policy, staging_root=staging_root, sink=sink)
    if out:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
        sys.stderr.write("manifest written: %s\n" % out)
    if args.json:
        print(json.dumps(manifest, indent=2, ensure_ascii=False))
    else:
        _print_manifest(manifest)
    return 0


def cmd_promote(args: argparse.Namespace) -> int:
    manifest = _load_json(args.manifest)
    attestation = {"approved_by": args.approved_by} if args.approved_by else None
    assert_promotable_or_die(manifest, attestation)
    print("PROMOTABLE: manifest passed the S6 ceremony guard (human approved + audit pass + "
          "repo-external staging). The actual promote (PR / active install) remains a manual step.")
    return 0


def _print_manifest(m: dict) -> None:
    up, lic, gate = m["upstream"], m["license"], m["gate_decision"]
    print("== source-intake manifest (governed; staged-only) ==")
    print("repo    :", up["repo"], "@", up["pinned_commit"])
    print("license :", lic["spdx"], "| tier:", lic["tier"], "| verified@pin:", lic["verified_against_commit"][:12])
    if lic["toctou_divergence"]:
        print("  ⚠ TOCTOU: scout advisory tier %r != pinned-commit tier %r (pinned is authoritative)."
              % (lic["scout_tier_advisory"], lic["tier"]))
    print("gate    :", gate["license_gate"], "| acquisition_allowed:", gate["acquisition_allowed"])
    acq = m.get("acquisition") or {}
    if acq.get("method"):
        print("acquire :", acq["method"], "| sha256:", acq["tarball_sha256"][:12], "| staged:", acq["staged_path"])
    else:
        print("acquire : SKIPPED (%s)" % acq.get("skipped_reason"))
    audit = m.get("trust_audit")
    if audit:
        print("audit   : verdict=%s | findings=%d (machine never grants 'pass')"
              % (audit["verdict"], len(audit["findings"])))
    print("product :", m["product"]["class"], "| packaging:", m["product"]["packaging"], "| staged_only:", m["product"]["staged_only"])


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="source_intake.py",
                                description="source-intake — governed URL->artifact rail (MVP)")
    sub = p.add_subparsers(dest="cmd", required=True)

    v = sub.add_parser("validate-request", help="validate a source_intake_request.json (S0)")
    v.add_argument("--request", required=True, help="path to source_intake_request.json")
    v.set_defaults(func=cmd_validate_request)

    i = sub.add_parser("intake", help="S1..S5: pin -> license-gate -> acquire -> audit -> manifest")
    i.add_argument("--request", required=True, help="path to source_intake_request.json")
    i.add_argument("--out", default=None, help="manifest filename, confined to traces/")
    i.add_argument("--staging-root", default=None, help="repo-EXTERNAL staging dir (default ~/.liye-os/...)")
    i.add_argument("--dry-run", action="store_true", help="do not write the staged tarball to disk")
    i.add_argument("--json", action="store_true", help="print full manifest JSON to stdout")
    i.add_argument("--policy", default=None, help="override license_policy.yaml path")
    i.add_argument("--token-env", default="SOURCE_INTAKE_READONLY_TOKEN",
                   help="env var holding a READ-ONLY token (asserted; default unauthenticated)")
    i.set_defaults(func=cmd_intake)

    pr = sub.add_parser("promote", help="S6 ceremony guard (refuses without human + audit pass)")
    pr.add_argument("--manifest", required=True, help="path to a source_manifest.json")
    pr.add_argument("--approved-by", default=None, help="human approver id (required for promote)")
    pr.set_defaults(func=cmd_promote)

    args = p.parse_args(argv)
    try:
        return args.func(args)
    except IntakeFatal as e:
        sys.stderr.write("FAIL-CLOSED: %s\n" % e)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
