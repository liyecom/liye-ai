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
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]            # liye_os/
VALIDATOR = REPO_ROOT / "_meta/contracts/scripts/validate_manifest_reality.py"
DEFAULT_LEDGER = REPO_ROOT / "_meta/contracts/ledger/manifest_reality_amazon-growth-engine.jsonl"
LEARNING_SOURCES = REPO_ROOT / ".claude/config/learning_sources.yaml"

# Ledger schema version. v1 = day-0 (2026-06-22), pre-git-evidence. v2 adds
# engine/validator repo commit + tracked-dirty + untracked-count + manifest
# tracked-dirty as EVIDENCE fields. These NEVER gate the clock: clock_eligible_day
# stays a pure function of (validator overall==PASS AND exit_code==0).
LEDGER_SCHEMA_VERSION = 2

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


def _git_status(repo: Path) -> dict:
    """Repo-level git evidence: HEAD commit, tracked-dirty flag, untracked count.

    tracked_dirty = any staged/unstaged change to a tracked file (porcelain line
    not starting with '??'). untracked_count = number of '??' lines. None on error
    (e.g. not a git repo) — recorded honestly, never silently coerced.
    """
    commit = _git_head(repo)
    try:
        proc = subprocess.run(
            ["git", "-C", str(repo), "status", "--porcelain"],
            capture_output=True, text=True, timeout=15,
        )
        if proc.returncode != 0:
            return {"commit": commit, "tracked_dirty": None, "untracked_count": None}
        lines = [ln for ln in proc.stdout.splitlines() if ln.strip()]
        untracked = [ln for ln in lines if ln.startswith("??")]
        tracked = [ln for ln in lines if not ln.startswith("??")]
        return {
            "commit": commit,
            "tracked_dirty": len(tracked) > 0,
            "untracked_count": len(untracked),
        }
    except Exception:
        return {"commit": commit, "tracked_dirty": None, "untracked_count": None}


def _git_path_dirty(repo: Path, path: Path) -> object:
    """Whether a single tracked file has uncommitted changes (manifest reality).

    Scoped to the manifest only — this is the field that matters for 'was the
    manifest itself touched', independent of unrelated repo-level dirt. None on error.
    """
    try:
        proc = subprocess.run(
            ["git", "-C", str(repo), "status", "--porcelain", "--", str(path.resolve())],
            capture_output=True, text=True, timeout=15,
        )
        if proc.returncode != 0:
            return None
        return bool([ln for ln in proc.stdout.splitlines() if ln.strip()])
    except Exception:
        return None


def _day_eligibility(entries: list) -> dict:
    """Collapse ledger entries to {utc_date(str): day_is_eligible(bool)}, fail-closed:
    a day is eligible iff it has >=1 entry AND every entry that day has
    clock_eligible_day is True. Tolerates entries missing the field (-> not eligible).
    """
    by_day: dict = {}
    for e in entries:
        d = e.get("utc_date")
        if not isinstance(d, str):
            continue
        ok = e.get("clock_eligible_day") is True
        by_day[d] = ok if d not in by_day else (by_day[d] and ok)
    return by_day


def analyze_continuity(prior_entries: list, today_entry: dict) -> dict:
    """PURE continuity analysis. Given the entries already in the ledger plus the
    entry about to be appended, compute streak/gap metadata. NEVER fabricates days.

    Returns a dict (the value for today_entry['continuity']):
      prev_entry_utc_date : str|None  last distinct ledger date strictly before today
      gap_days            : [str]     calendar dates strictly between prev and today
      continuity_break    : bool      len(gap_days) > 0
      streak_reset        : bool      prior history exists AND yesterday was not a clean eligible day
      current_streak_len  : int       consecutive eligible UTC days ending today (0 if today ineligible)
      streak_start_utc_date : str|None first day of that streak
    """
    today_s = today_entry.get("utc_date")
    today_d = date.fromisoformat(today_s)
    today_ok = today_entry.get("clock_eligible_day") is True

    day_ok = _day_eligibility(list(prior_entries) + [today_entry])

    prior_dates = sorted({e.get("utc_date") for e in prior_entries
                          if isinstance(e.get("utc_date"), str)
                          and date.fromisoformat(e["utc_date"]) < today_d})
    prev = prior_dates[-1] if prior_dates else None

    gap_days = []
    if prev is not None:
        d = date.fromisoformat(prev) + timedelta(days=1)
        while d < today_d:
            gap_days.append(d.isoformat())
            d += timedelta(days=1)

    # streak: walk back day-by-day from today while each day is a clean eligible day
    streak = 0
    if today_ok:
        d = today_d
        while day_ok.get(d.isoformat()) is True:
            streak += 1
            d -= timedelta(days=1)
    streak_start = (today_d - timedelta(days=streak - 1)).isoformat() if streak > 0 else None

    yesterday = (today_d - timedelta(days=1)).isoformat()
    streak_reset = (prev is not None) and (day_ok.get(yesterday) is not True)

    return {
        "prev_entry_utc_date": prev,
        "gap_days": gap_days,
        "continuity_break": len(gap_days) > 0,
        "streak_reset": streak_reset,
        "current_streak_len": streak,
        "streak_start_utc_date": streak_start,
    }


def read_ledger(ledger: Path) -> list:
    """Read existing JSONL ledger entries (tolerant: skip blank/malformed lines).
    Returns [] if the file does not exist.
    """
    if not ledger.exists():
        return []
    out = []
    for ln in ledger.read_text(encoding="utf-8").splitlines():
        ln = ln.strip()
        if not ln:
            continue
        try:
            out.append(json.loads(ln))
        except Exception:
            continue
    return out


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

    # Git-state evidence (schema-v2). Snapshot BEFORE any ledger append. All of
    # these are evidence-only — none feeds clock_eligible_day.
    engine_status = _git_status(engine_repo)
    validator_status = _git_status(REPO_ROOT)
    manifest_tracked_dirty = _git_path_dirty(engine_repo, manifest_path)

    now = datetime.now(timezone.utc)
    return {
        "ledger_schema_version": LEDGER_SCHEMA_VERSION,
        "timestamp_utc": now.isoformat(),
        "utc_date": now.strftime("%Y-%m-%d"),
        "engine_repo_path": str(engine_repo),
        "engine_repo_canonical_owner": "loudmirror",  # owner org only (leak-guard: no owner/repo URL form)
        "engine_repo_commit": engine_status["commit"],
        "engine_repo_tracked_dirty": engine_status["tracked_dirty"],      # repo-level; may be true for UNRELATED files
        "engine_repo_untracked_count": engine_status["untracked_count"],
        "manifest_path": str(manifest_path),
        "manifest_raw_sha256": manifest_raw_sha256,
        "manifest_hash_prefixed": manifest_hash_prefixed,
        "manifest_tracked_dirty": manifest_tracked_dirty,  # the load-bearing one: was the MANIFEST itself touched
        "validator_repo_commit": validator_status["commit"],
        "validator_repo_tracked_dirty": validator_status["tracked_dirty"],
        "validator_repo_untracked_count": validator_status["untracked_count"],
        "validator_path": str(VALIDATOR.relative_to(REPO_ROOT)),
        "exit_code": exit_code,
        "overall": overall,
        "checks": checks,                      # R1..R6 -> PASS/FAIL
        "clock_eligible_day": overall == "PASS" and exit_code == 0,   # PURE f(validator PASS, exit 0) — dirty fields excluded
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
    prior = read_ledger(args.ledger)
    entry["continuity"] = analyze_continuity(prior, entry)
    print(json.dumps(entry, indent=2, ensure_ascii=False))

    cont = entry["continuity"]
    if cont["continuity_break"] or cont["streak_reset"]:
        print(
            "ALARM: clock continuity break — prev=%s missing=%s streak_reset=%s "
            "current_streak_len=%s streak_start=%s. NO backfill (fail-closed); "
            "consecutive-day count restarts." % (
                cont["prev_entry_utc_date"], cont["gap_days"], cont["streak_reset"],
                cont["current_streak_len"], cont["streak_start_utc_date"]),
            file=sys.stderr,
        )

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
