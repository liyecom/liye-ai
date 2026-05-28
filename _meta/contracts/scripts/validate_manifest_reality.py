#!/usr/bin/env python3
"""
validate_manifest_reality.py — Engine Manifest Reality Validator (Phase 0c.4)

SSOT: _meta/contracts/scripts/validate_manifest_reality.py
Schema: _meta/contracts/engine/engine_manifest.schema.v2.yaml (delegated)

Schema validation answers "is the manifest shape correct?" (validate-contracts.mjs).
Reality validation answers "does the manifest claim match the filesystem / git
state it depends on?" — this script.

Hard Gate 5 binding: any source接入 must pass manifest reality validator.

Reality checks (minimal set per Phase 0c.4 design):
  R1  playbooks[].entrypoint        — file exists at engine repo root
  R2  data_sources[].path           — if a path key is present, file/dir exists
  R3  capability runtime_gate_refs  — every ref resolves to a runtime_gates[].id
  R4  effective ≤ declared          — write_capability_effective not wider than declared
  R5  schema_version routing        — "2.0" routes to v2 schema $id
  R6  Pilot 1 invariant             — engine_id=amazon-growth-engine → effective=none

CLI:
  validate_manifest_reality.py --manifest-path <path> [--engine-repo <dir>] [--json]
  validate_manifest_reality.py --self-test

Exit codes:
  0  all reality checks PASS
  1  at least one reality check FAIL
  2  schema FAIL (delegated to 0c.2 schema check)
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft7Validator

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent
V2_SCHEMA_PATH = PROJECT_ROOT / "_meta/contracts/engine/engine_manifest.schema.v2.yaml"
V2_SCHEMA_ID = "https://liye.com/contracts/engine/engine_manifest.v2"
FIXTURES_DIR = SCRIPT_DIR / "validate_manifest_reality_fixtures"

# Total order on write_capability levels (per v2 schema enum semantics).
CAPABILITY_LEVELS = {"none": 0, "limited": 1, "full": 2}

PILOT1_ENGINE_ID = "amazon-growth-engine"


def load_yaml(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def schema_check(manifest: dict[str, Any]) -> list[str]:
    """Delegate-equivalent: run jsonschema Draft7Validator on manifest.

    Returns list of error messages. Empty list = schema valid.
    """
    schema = load_yaml(V2_SCHEMA_PATH)
    validator = Draft7Validator(schema)
    errors = sorted(validator.iter_errors(manifest), key=lambda e: list(e.absolute_path))
    return [
        f"{'/'.join(str(p) for p in e.absolute_path) or '<root>'}: {e.message}"
        for e in errors
    ]


def check_r1_playbook_entrypoints(manifest: dict[str, Any], engine_repo: Path) -> list[str]:
    failures = []
    for pb in manifest.get("playbooks", []):
        entry = pb.get("entrypoint")
        if not entry:
            continue
        resolved_path = engine_repo / entry
        if not resolved_path.exists():
            failures.append(
                f"R1 playbook '{pb.get('id', '?')}' entrypoint missing: {entry} "
                f"(resolved to {resolved_path})"
            )
    return failures


def check_r2_data_source_paths(manifest: dict[str, Any], engine_repo: Path) -> list[str]:
    failures = []
    for idx, ds in enumerate(manifest.get("data_sources", [])):
        path_value = ds.get("path")
        if path_value is None:
            continue
        resolved_path = engine_repo / path_value
        if not resolved_path.exists():
            failures.append(
                f"R2 data_sources[{idx}] path missing: {path_value} "
                f"(resolved to {resolved_path})"
            )
    return failures


def check_r3_capability_gate_refs(manifest: dict[str, Any]) -> list[str]:
    failures = []
    gate_ids = {g.get("id") for g in manifest.get("runtime_gates", []) if g.get("id")}
    for cap in manifest.get("capabilities", []):
        for ref in cap.get("runtime_gate_refs", []) or []:
            if ref not in gate_ids:
                failures.append(
                    f"R3 capability '{cap.get('id', '?')}' references undefined "
                    f"runtime_gate '{ref}' (known gates: {sorted(gate_ids) or 'none'})"
                )
    return failures


def check_r4_effective_within_declared(manifest: dict[str, Any]) -> list[str]:
    declared = manifest.get("write_capability_declared")
    effective = manifest.get("write_capability_effective")
    if declared is None or effective is None:
        return []  # schema check already enforces presence; nothing to assert here
    if declared not in CAPABILITY_LEVELS or effective not in CAPABILITY_LEVELS:
        return []  # schema check already enforces enum
    if CAPABILITY_LEVELS[effective] > CAPABILITY_LEVELS[declared]:
        return [
            f"R4 write_capability_effective='{effective}' exceeds "
            f"write_capability_declared='{declared}' (effective must be ≤ declared)"
        ]
    return []


def check_r5_schema_version_routing(manifest: dict[str, Any]) -> list[str]:
    sv = manifest.get("schema_version")
    schema = load_yaml(V2_SCHEMA_PATH)
    actual_id = schema.get("$id")
    if sv == "2.0":
        if actual_id != V2_SCHEMA_ID:
            return [
                f"R5 routing mismatch: schema_version='2.0' but v2 schema $id "
                f"is '{actual_id}', expected '{V2_SCHEMA_ID}'"
            ]
        return []
    return [
        f"R5 unsupported schema_version: {sv!r}. validate_manifest_reality.py "
        f"binds to v2 ('2.0') only; v1 manifests are out-of-scope here."
    ]


def check_r6_pilot1_invariant(manifest: dict[str, Any]) -> list[str]:
    if manifest.get("engine_id") != PILOT1_ENGINE_ID:
        return []
    effective = manifest.get("write_capability_effective")
    if effective != "none":
        return [
            f"R6 Pilot 1 invariant violated: engine_id='{PILOT1_ENGINE_ID}' but "
            f"write_capability_effective='{effective}' (Hard Gate 8 requires "
            f"effective='none' during Pilot 1)"
        ]
    return []


REALITY_CHECKS = [
    ("R1_playbook_entrypoints", check_r1_playbook_entrypoints, True),
    ("R2_data_source_paths", check_r2_data_source_paths, True),
    ("R3_capability_gate_refs", check_r3_capability_gate_refs, False),
    ("R4_effective_within_declared", check_r4_effective_within_declared, False),
    ("R5_schema_version_routing", check_r5_schema_version_routing, False),
    ("R6_pilot1_invariant", check_r6_pilot1_invariant, False),
]


def run_all_checks(manifest: dict[str, Any], engine_repo: Path) -> dict[str, Any]:
    """Run every reality check, return structured report."""
    results = []
    for name, fn, needs_repo in REALITY_CHECKS:
        failures = fn(manifest, engine_repo) if needs_repo else fn(manifest)
        results.append(
            {"check": name, "status": "PASS" if not failures else "FAIL", "messages": failures}
        )
    return {
        "manifest_engine_id": manifest.get("engine_id"),
        "schema_version": manifest.get("schema_version"),
        "engine_repo": str(engine_repo),
        "checks": results,
        "overall": "PASS" if all(r["status"] == "PASS" for r in results) else "FAIL",
    }


def print_report(report: dict[str, Any], json_mode: bool) -> None:
    if json_mode:
        print(json.dumps(report, indent=2))
        return
    print("═" * 60)
    print(f"  Manifest Reality Validator (Phase 0c.4)")
    print(f"  engine_id      = {report['manifest_engine_id']}")
    print(f"  schema_version = {report['schema_version']}")
    print(f"  engine_repo    = {report['engine_repo']}")
    print("═" * 60)
    for r in report["checks"]:
        mark = "✅" if r["status"] == "PASS" else "❌"
        print(f"  {mark} {r['check']}: {r['status']}")
        for msg in r["messages"]:
            print(f"       · {msg}")
    print("═" * 60)
    print(f"  Overall: {report['overall']}")
    print("═" * 60)


def validate_one(manifest_path: Path, engine_repo: Path, json_mode: bool) -> int:
    manifest = load_yaml(manifest_path)

    # Step 1: schema check (delegated-equivalent — use jsonschema since
    # validate-contracts.mjs has no --check-manifest <path> CLI surface).
    schema_errors = schema_check(manifest)
    if schema_errors:
        if json_mode:
            print(json.dumps({"overall": "SCHEMA_FAIL", "schema_errors": schema_errors}, indent=2))
        else:
            print("❌ Schema invalid (exit 2). Errors:")
            for e in schema_errors:
                print(f"   · {e}")
        return 2

    # Step 2: reality checks
    report = run_all_checks(manifest, engine_repo)
    print_report(report, json_mode)
    return 0 if report["overall"] == "PASS" else 1


def run_self_test() -> int:
    """Iterate bundled fixtures; must_pass expect 0, must_fail expect 1."""
    if not FIXTURES_DIR.is_dir():
        print(f"❌ fixtures dir not found: {FIXTURES_DIR}")
        return 1

    must_pass = sorted((FIXTURES_DIR / "must_pass").glob("*.yaml"))
    must_fail = sorted((FIXTURES_DIR / "must_fail").glob("*.yaml"))

    print("═" * 60)
    print(f"  Self-test: {len(must_pass)} must_pass + {len(must_fail)} must_fail")
    print("═" * 60)

    failures = []

    for manifest_path in must_pass:
        repo = manifest_path.parent / (manifest_path.stem + "_repo")
        manifest = load_yaml(manifest_path)
        schema_errors = schema_check(manifest)
        if schema_errors:
            failures.append(f"must_pass {manifest_path.name}: schema invalid: {schema_errors}")
            print(f"  ❌ {manifest_path.name}: expected PASS, got SCHEMA_FAIL")
            continue
        report = run_all_checks(manifest, repo)
        if report["overall"] == "PASS":
            print(f"  ✅ {manifest_path.name}: PASS (as expected)")
        else:
            fails = [c for c in report["checks"] if c["status"] == "FAIL"]
            failures.append(
                f"must_pass {manifest_path.name}: expected PASS but {len(fails)} check(s) failed: "
                f"{[c['check'] for c in fails]}"
            )
            print(f"  ❌ {manifest_path.name}: expected PASS, got FAIL ({[c['check'] for c in fails]})")

    for manifest_path in must_fail:
        repo = manifest_path.parent / (manifest_path.stem + "_repo")
        manifest = load_yaml(manifest_path)
        schema_errors = schema_check(manifest)
        if schema_errors:
            # A must_fail fixture failing schema would be ambiguous (would exit 2,
            # not 1). Self-test asserts each must_fail isolates one reality check.
            failures.append(
                f"must_fail {manifest_path.name}: leaked into schema-fail bucket "
                f"(should isolate a single reality-check failure, not a schema break): {schema_errors}"
            )
            print(f"  ❌ {manifest_path.name}: expected reality FAIL, got SCHEMA_FAIL")
            continue
        report = run_all_checks(manifest, repo)
        if report["overall"] == "FAIL":
            failed_checks = [c["check"] for c in report["checks"] if c["status"] == "FAIL"]
            if len(failed_checks) == 1:
                print(f"  ✅ {manifest_path.name}: FAIL (isolated to {failed_checks[0]})")
            else:
                failures.append(
                    f"must_fail {manifest_path.name}: expected single isolated failure but "
                    f"{len(failed_checks)} checks failed: {failed_checks}"
                )
                print(f"  ❌ {manifest_path.name}: multi-check failure {failed_checks} — fixture not isolated")
        else:
            failures.append(f"must_fail {manifest_path.name}: expected FAIL, got PASS")
            print(f"  ❌ {manifest_path.name}: expected FAIL, got PASS")

    print("═" * 60)
    if failures:
        print(f"  Self-test FAILED ({len(failures)} issue(s))")
        for f in failures:
            print(f"   · {f}")
        return 1
    print(f"  Self-test PASSED ({len(must_pass)} must_pass + {len(must_fail)} must_fail)")
    print("═" * 60)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Engine Manifest Reality Validator (Phase 0c.4, Hard Gate 5)"
    )
    parser.add_argument("--manifest-path", type=Path, help="Path to engine_manifest.yaml")
    parser.add_argument(
        "--engine-repo",
        type=Path,
        help="Engine repo root (entrypoint resolution base). Default: dirname(manifest-path).",
    )
    parser.add_argument("--json", action="store_true", help="Emit JSON report on stdout")
    parser.add_argument("--self-test", action="store_true", help="Run bundled fixture self-test")
    args = parser.parse_args()

    if args.self_test:
        return run_self_test()

    if not args.manifest_path:
        parser.error("--manifest-path is required unless --self-test is given")

    manifest_path = args.manifest_path.resolve()
    if not manifest_path.is_file():
        print(f"❌ manifest not found: {manifest_path}")
        return 1

    engine_repo = (args.engine_repo or manifest_path.parent).resolve()
    if not engine_repo.is_dir():
        print(f"❌ engine repo dir not found: {engine_repo}")
        return 1

    return validate_one(manifest_path, engine_repo, args.json)


if __name__ == "__main__":
    sys.exit(main())
