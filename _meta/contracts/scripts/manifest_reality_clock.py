#!/usr/bin/env python3
"""Manifest-reality 30-day clock runner (GHL Band B, pre-flip).

Wraps the existing ``validate_manifest_reality.py`` and appends one
append-only JSONL ledger entry per run. The ledger accumulates the
"30 consecutive UTC-day PASS" evidence required by the AGE
``engine_manifest.yaml`` gate ``emit_fact_enabled``
(``evidence_required_for_open``) BEFORE any manifest flip.

Hard scope (Band B readiness, NOT activation):
  * READ-ONLY against the AGE checkout (reads engine_manifest.yaml + resolves
    R1/R2 paths). Writes ONLY this repo's ledger JSONL.
  * Does NOT write the AGE DuckDB, does NOT write out/facts, does NOT call
    the Ads API, does NOT flip the manifest, does NOT open the gate, does NOT
    pin expected_manifest_hash, does NOT flip learning_sources.enabled.
  * Failure is recorded (appended), never silently overwritten.

Modes:
  --dry-run   run the validator, print the would-be ledger entry, DO NOT append
  --append    run the validator, append the entry to the ledger

CI is billing-frozen, so this is designed to run locally (manual or launchd).
Requires a Python with PyYAML + jsonschema (e.g. the AGE .venv).
"""
from __future__ import annotations
import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]            # liye_os/
VALIDATOR = REPO_ROOT / "_meta/contracts/scripts/validate_manifest_reality.py"
DEFAULT_LEDGER = REPO_ROOT / "_meta/contracts/ledger/manifest_reality_amazon-growth-engine.jsonl"
LEARNING_SOURCES = REPO_ROOT / ".claude/config/learning_sources.yaml"

# Band B canonical engine repo (operator ruling 2026-06-22). Local checkout used
# for read-only R1/R2 path resolution; the remote URL is identity-only.
DEFAULT_ENGINE_REPO = Path("/Users/liye/github/amazon-growth-engine")
DEFAULT_MANIFEST = DEFAULT_ENGINE_REPO / "engine_manifest.yaml"


def _git_head(repo: Path) -> str:
    try:
        return subprocess.run(
            ["git", "-C", str(repo), "rev-parse", "HEAD"],
            capture_output=True, text=True, timeout=15,
        ).stdout.strip() or "unknown"
    except Exception:
        return "unknown"


def _expected_manifest_hash() -> object:
    """Read learning_sources.yaml expected_manifest_hash (null until B8/post-flip)."""
    try:
        import yaml
        data = yaml.safe_load(LEARNING_SOURCES.read_text(encoding="utf-8"))
        for src in (data or {}).get("sources", {}).values():
            if src.get("source_id") == "amazon-growth-engine":
                return src.get("expected_manifest_hash")
    except Exception:
        pass
    return None


def run_once(engine_repo: Path, manifest_path: Path) -> dict:
    raw = manifest_path.read_bytes()
    manifest_raw_sha256 = hashlib.sha256(raw).hexdigest()
    # emit_fact口径 (scripts/learning/emit_fact.py:382): sha256: + hexdigest of raw bytes
    manifest_hash_prefixed = "sha256:" + manifest_raw_sha256

    proc = subprocess.run(
        [sys.executable, str(VALIDATOR),
         "--manifest-path", str(manifest_path),
         "--engine-repo", str(engine_repo), "--json"],
        capture_output=True, text=True, timeout=120,
    )
    exit_code = proc.returncode
    report = None
    runner_error = None
    try:
        report = json.loads(proc.stdout) if proc.stdout.strip() else None
    except Exception as exc:  # validator produced non-JSON -> record it, do not crash
        runner_error = f"validator stdout not JSON: {exc}; stderr={proc.stderr[:300]}"

    checks = {}
    overall = "UNKNOWN"
    if report:
        overall = report.get("overall", "UNKNOWN")
        for c in report.get("checks", []):
            checks[c.get("check")] = c.get("status")

    expected = _expected_manifest_hash()
    # importer (import_facts.mjs:249) marks provenance dirty while expected hash
    # is null OR mismatched. Recorded for honesty; NOT a clock gate.
    provenance_dirty = (expected is None) or (manifest_hash_prefixed != expected)

    now = datetime.now(timezone.utc)
    return {
        "timestamp_utc": now.isoformat(),
        "utc_date": now.strftime("%Y-%m-%d"),
        "engine_repo_path": str(engine_repo),
        "engine_repo_canonical_owner": "loudmirror",  # owner org only (leak-guard: no owner/repo URL form)
        "manifest_path": str(manifest_path),
        "manifest_raw_sha256": manifest_raw_sha256,
        "manifest_hash_prefixed": manifest_hash_prefixed,
        "validator_repo_commit": _git_head(REPO_ROOT),
        "validator_path": str(VALIDATOR.relative_to(REPO_ROOT)),
        "exit_code": exit_code,
        "overall": overall,
        "checks": checks,                      # R1..R6 -> PASS/FAIL
        "clock_eligible_day": overall == "PASS" and exit_code == 0,
        "expected_manifest_hash": expected,    # null pre-flip by design (deferred to B8)
        "provenance_dirty": provenance_dirty,  # true while expected hash null (importer-side)
        "runner_error": runner_error,
    }


def append_entry(ledger: Path, entry: dict) -> None:
    ledger.parent.mkdir(parents=True, exist_ok=True)
    with ledger.open("a", encoding="utf-8") as fh:   # append-only, never truncate
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser(description="Manifest-reality 30-day clock runner (pre-flip).")
    ap.add_argument("--engine-repo", type=Path, default=DEFAULT_ENGINE_REPO)
    ap.add_argument("--manifest-path", type=Path, default=DEFAULT_MANIFEST)
    ap.add_argument("--ledger", type=Path, default=DEFAULT_LEDGER)
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="print entry, do NOT append (default)")
    mode.add_argument("--append", action="store_true", help="append entry to the ledger")
    args = ap.parse_args()

    entry = run_once(args.engine_repo.resolve(), args.manifest_path.resolve())
    print(json.dumps(entry, indent=2, ensure_ascii=False))

    if args.append:
        append_entry(args.ledger, entry)
        print(f"\n[appended] {args.ledger}", file=sys.stderr)
    else:
        print("\n[dry-run] not appended", file=sys.stderr)

    # exit nonzero if the validator itself failed, so a scheduler notices —
    # but the entry is ALWAYS recorded first when --append.
    return 0 if entry["clock_eligible_day"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
