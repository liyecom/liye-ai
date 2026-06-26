#!/usr/bin/env python3
"""test_scout.py — offline tests for github-scout (no network; FakeTransport).

Covers the plan's safety invariants:
  H-2  scout's effective inspect ceiling per tier == the L1 license_policy.yaml SSOT
       (loaded live, so the test fails if scout.py and the SSOT ever drift).
  H-3  network-layer state machine: a RED (strong_copyleft) / unknown / fetch_failed
       repo yields ZERO readme/tree GETs; a permissive repo yields exactly one each.
  fail-closed  license 404 / 500 / NOASSERTION => tier=unknown => metadata_only.
  I2   write-scoped token => fail-closed; read-only token => ok; no token => unauthenticated.

Run:  python3 tools/github-scout/test_scout.py       (exit 0 = all green; Python 3.9+)
"""
from __future__ import annotations    # PEP 604 'str | None' annotations on Python 3.9

import base64
import json
import unittest
from pathlib import Path

import scout
from scout import (GitHubClient, LicensePolicy, ScoutFatal, build_report,
                   inspect_candidate, _default_policy_path, _safe_trace_path, _traces_root)

POLICY = LicensePolicy.load(_default_policy_path())


def _resp(status, body=None, headers=None):
    raw = json.dumps(body).encode() if body is not None else b""
    return status, {k.lower(): v for k, v in (headers or {}).items()}, raw


class FakeTransport:
    """Records nothing itself; GitHubClient.call_log is the network-layer evidence.
    Serves canned responses keyed by URL substring."""

    def __init__(self, repos: dict, scopes: str | None = None, license_status=None,
                 probe_status: int = 200):
        self.repos = repos                 # full_name -> {spdx, readme, tree}
        self.scopes = scopes               # X-OAuth-Scopes value for /rate_limit probe
        self.license_status = license_status or {}   # full_name -> forced HTTP status
        self.probe_status = probe_status   # forced status for the auth /rate_limit probe
        self.requests: list = []           # wire log: (url, auth_header_or_None)

    def get(self, url: str, headers: dict):
        self.requests.append((url, headers.get("Authorization")))
        if "/rate_limit" in url:
            if self.probe_status != 200:   # error responses carry no X-OAuth-Scopes header
                return _resp(self.probe_status, {"message": "err"})
            return _resp(200, {"ok": True}, {"X-OAuth-Scopes": self.scopes or ""})
        if "/search/repositories" in url:
            items = [{"full_name": fn, "name": fn.split("/")[-1],
                      "stargazers_count": r.get("stars", 100),
                      "description": r.get("description", ""),
                      "pushed_at": "2026-01-01T00:00:00Z",
                      "topics": r.get("topics", []),
                      "html_url": "https://github.com/" + fn}
                     for fn, r in self.repos.items()]
            return _resp(200, {"items": items})
        for fn, r in self.repos.items():
            if ("/repos/%s/license" % fn) in url:
                forced = self.license_status.get(fn)
                if forced and forced != 200:
                    return _resp(forced, {} if forced != 404 else {"message": "Not Found"})
                spdx = r.get("spdx")
                if spdx is None:
                    return _resp(404, {"message": "Not Found"})
                return _resp(200, {"license": {"spdx_id": spdx}})
            if ("/repos/%s/readme" % fn) in url:
                content = base64.b64encode((r.get("readme", "readme")).encode()).decode()
                return _resp(200, {"content": content})
            if ("/repos/%s/contents" % fn) in url:
                return _resp(200, [{"name": n, "type": "file"} for n in r.get("tree", ["src"])])
        return _resp(404, {"message": "Not Found"})


def _kinds(client, repo):
    return [c["kind"] for c in client.call_log if c["repo"] == repo]


class PolicyShape(unittest.TestCase):
    def test_unknown_tier_is_fail_closed(self):
        self.assertEqual(POLICY.tier_for(None), "unknown")
        self.assertEqual(POLICY.tier_for("totally-made-up-9.9"), "unknown")
        self.assertEqual(POLICY.ceiling_stages("unknown"), ["metadata"])
        self.assertEqual(POLICY.tier("unknown")["allowed_recommendations"], ["skip"])

    def test_every_default_is_within_allowed(self):
        for name, t in POLICY.tiers.items():
            self.assertIn(t["default_recommendation"], t["allowed_recommendations"], name)


class CeilingMatchesSSOT(unittest.TestCase):
    """H-2 + H-3: drive a real candidate through inspect and assert the fetches
    performed match exactly the SSOT-declared ceiling for its resolved tier."""

    SAMPLES = {
        "permissive": "mit",
        "permissive_with_obligations": "apache-2.0",
        "weak_copyleft": "mpl-2.0",
        "strong_copyleft": "gpl-3.0",
    }

    def _run(self, repo, spdx=None, license_status=None):
        repos = {repo: {"spdx": spdx, "readme": "hi", "tree": ["a", "b"]}}
        client = GitHubClient(transport=FakeTransport(
            repos, license_status={repo: license_status} if license_status else None))
        item = {"full_name": repo, "name": repo.split("/")[-1], "description": "x",
                "stargazers_count": 9, "topics": []}
        return inspect_candidate(client, POLICY, item, "x"), client

    def test_each_tier_fetches_exactly_its_ceiling(self):
        for tier, spdx in self.SAMPLES.items():
            res, client = self._run("o/%s" % tier, spdx=spdx)
            self.assertEqual(res["license"]["tier"], tier)
            ssot_stages = POLICY.ceiling_stages(tier)
            kinds = _kinds(client, "o/%s" % tier)
            self.assertIn("license", kinds, tier)            # gate always fetched
            self.assertEqual("readme" in kinds, "readme" in ssot_stages, tier)
            self.assertEqual("tree" in kinds, "tree" in ssot_stages, tier)
            # effective ceiling label == SSOT declaration
            self.assertEqual(res["license"]["inspect_ceiling"],
                             POLICY.tier(tier)["inspect_ceiling"], tier)

    def test_strong_copyleft_never_touches_source(self):
        res, client = self._run("o/gpl", spdx="agpl-3.0")
        self.assertEqual(res["license"]["tier"], "strong_copyleft")
        self.assertNotIn("readme", _kinds(client, "o/gpl"))
        self.assertNotIn("tree", _kinds(client, "o/gpl"))
        self.assertEqual(res["recommendation"], "skip")

    def test_no_license_is_metadata_only(self):
        res, client = self._run("o/nolic", spdx=None)         # 404
        self.assertEqual(res["license"]["tier"], "unknown")
        self.assertEqual(res["license"]["confidence"], "no_license")
        self.assertEqual(_kinds(client, "o/nolic"), ["license"])

    def test_license_fetch_failure_is_fail_closed(self):
        res, client = self._run("o/boom", spdx="mit", license_status=500)
        self.assertEqual(res["license"]["tier"], "unknown")   # MIT ignored on fetch fail
        self.assertEqual(res["license"]["confidence"], "fetch_failed")
        self.assertNotIn("readme", _kinds(client, "o/boom"))

    def test_noassertion_is_fail_closed(self):
        res, client = self._run("o/noa", spdx="NOASSERTION")
        self.assertEqual(res["license"]["tier"], "unknown")
        self.assertEqual(res["license"]["confidence"], "fetch_failed")


class ReadOnlyAssertion(unittest.TestCase):
    def test_no_token_is_unauthenticated(self):
        c = GitHubClient(transport=FakeTransport({}))
        c.assert_readonly_or_die()
        self.assertEqual(c.auth_mode, "unauthenticated")

    def test_write_scope_token_fails_closed(self):
        c = GitHubClient(transport=FakeTransport({}, scopes="gist, read:org, repo"), token="x")
        with self.assertRaises(ScoutFatal):
            c.assert_readonly_or_die()

    def test_read_org_scope_fails_closed(self):
        # tightened (Phase 0.1): ANY classic scope, incl. read-only read:org, fails closed
        c = GitHubClient(transport=FakeTransport({}, scopes="read:org"), token="x")
        with self.assertRaises(ScoutFatal):
            c.assert_readonly_or_die()

    def test_empty_scope_finegrained_token_passes(self):
        c = GitHubClient(transport=FakeTransport({}, scopes=""), token="x")
        c.assert_readonly_or_die()
        self.assertEqual(c.auth_mode, "authenticated-readonly")

    def test_probe_5xx_fails_closed_and_does_not_attest_readonly(self):
        # GHS-01: an inconclusive (non-200) probe must NOT fail open. A write-scoped
        # token whose probe errors out must be refused, never falsely attested.
        tx = FakeTransport({}, scopes="repo", probe_status=500)
        c = GitHubClient(transport=tx, token="ghp_writescoped")
        with self.assertRaises(ScoutFatal):
            c.assert_readonly_or_die()
        self.assertNotEqual(c.auth_mode, "authenticated-readonly")

    def test_probe_401_fails_closed(self):       # GHS-02 coverage
        c = GitHubClient(transport=FakeTransport({}, probe_status=401), token="x")
        with self.assertRaises(ScoutFatal):
            c.assert_readonly_or_die()

    def test_probe_abuse_403_fails_closed(self):  # GHS-02 coverage (remaining != 0)
        c = GitHubClient(transport=FakeTransport({}, probe_status=403), token="x")
        with self.assertRaises(ScoutFatal):
            c.assert_readonly_or_die()

    def test_inconclusive_probe_does_not_attach_token_to_reads(self):
        # GHS-01: after a fail-closed probe, no candidate read is ever issued with the token.
        tx = FakeTransport({"o/x": {"spdx": "mit"}}, scopes="repo", probe_status=500)
        c = GitHubClient(transport=tx, token="ghp_writescoped")
        with self.assertRaises(ScoutFatal):
            build_report("a cache idea here", 4, POLICY, c)
        # only the probe was attempted; no /repos read carried the token
        self.assertTrue(all("/repos/" not in url for url, _ in tx.requests))


class ReportShape(unittest.TestCase):
    def test_report_has_mandatory_governance_fields(self):
        repos = {"o/good": {"spdx": "mit", "readme": "r", "tree": ["s"], "description": "good cache"},
                 "o/bad": {"spdx": "gpl-3.0", "description": "thing"}}
        client = GitHubClient(transport=FakeTransport(repos))
        rep = build_report("a good cache idea", 8, POLICY, client)
        self.assertIn("recall_notice", rep)
        self.assertTrue(rep["recall_notice"])
        self.assertIn("hard_non_goals", rep)
        self.assertEqual(rep["auth_mode"], "unauthenticated")
        self.assertEqual(rep["candidate_count"], 2)
        # low_confidence present per candidate (M-4)
        for c in rep["candidates"]:
            self.assertIn("low_confidence", c)

    def test_zero_term_query_flagged(self):
        client = GitHubClient(transport=FakeTransport({}))
        rep = build_report("the a of", 8, POLICY, client)   # all stopwords
        self.assertTrue(any("weak" in n for n in rep["notices"]))


class TracePathConfinement(unittest.TestCase):
    """I1: --out may only write under tools/github-scout/traces/ (Blocker 1)."""

    def test_bare_filename_lands_in_traces(self):
        p = _safe_trace_path("run.json")
        self.assertEqual(p.parent, _traces_root())
        self.assertEqual(p.name, "run.json")

    def test_traces_prefixed_filename_ok(self):
        self.assertEqual(_safe_trace_path("traces/run.json").parent, _traces_root())

    def test_subdir_under_traces_ok(self):
        p = _safe_trace_path("sub/run.json")
        self.assertIn(_traces_root(), p.parents)

    def test_absolute_path_rejected(self):
        with self.assertRaises(ScoutFatal):
            _safe_trace_path("/tmp/evil.json")

    def test_parent_escape_rejected(self):
        for evil in ("../README.md", "../../etc/passwd", "traces/../../README.md", "a/../../b"):
            with self.assertRaises(ScoutFatal, msg=evil):
                _safe_trace_path(evil)

    def test_empty_or_dir_rejected(self):
        for bad in ("", ".", "traces/", "traces"):
            with self.assertRaises(ScoutFatal, msg=repr(bad)):
                _safe_trace_path(bad)


if __name__ == "__main__":
    unittest.main(verbosity=2)
