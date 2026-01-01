#!/usr/bin/env python3
"""
LiYe OS v6.2 Architecture Verification - World Model Gate
==========================================================

This script verifies that:
1. World Model Gate is properly integrated in amazon-growth entry
2. No bypass markers exist outside of tests/
3. Dry-run smoke test passes (generates trace + artifact)

Run:
    python tools/audit/verify_v6_2.py
"""

import os
import sys
import re
import subprocess
from pathlib import Path
from datetime import datetime

# Repository root
REPO_ROOT = Path(__file__).parent.parent.parent

# ANSI colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
BOLD = "\033[1m"
RESET = "\033[0m"


def print_header(title: str) -> None:
    print(f"\n{BOLD}{BLUE}{'=' * 60}{RESET}")
    print(f"{BOLD}{BLUE}{title}{RESET}")
    print(f"{BOLD}{BLUE}{'=' * 60}{RESET}")


def print_pass(msg: str) -> None:
    print(f"  {GREEN}[PASS]{RESET} {msg}")


def print_fail(msg: str) -> None:
    print(f"  {RED}[FAIL]{RESET} {msg}")


def print_info(msg: str) -> None:
    print(f"  {BLUE}[INFO]{RESET} {msg}")


def print_warn(msg: str) -> None:
    print(f"  {YELLOW}[WARN]{RESET} {msg}")


def print_skip(msg: str) -> None:
    print(f"  {YELLOW}[SKIP]{RESET} {msg}")


def load_current_version() -> tuple[str, str]:
    """Load current version from SSOT (config/version.txt) or env override."""
    env_version = os.environ.get("LIYE_OS_VERSION")
    if env_version:
        return env_version, "env:LIYE_OS_VERSION"

    version_file = REPO_ROOT / "config" / "version.txt"
    if not version_file.exists():
        print_fail(f"Version file not found: {version_file}")
        sys.exit(1)

    version = version_file.read_text().strip()
    return version, f"file:{version_file.relative_to(REPO_ROOT)}"


def get_current_branch() -> tuple[str, str]:
    """
    Get the current git branch name.

    Priority:
    1. CI environment variables (GITHUB_REF_NAME, GITHUB_REF)
    2. Local git command fallback

    Returns:
        Tuple of (branch_name, source)
    """
    # Check GitHub Actions environment variables first
    github_ref_name = os.environ.get("GITHUB_REF_NAME")
    if github_ref_name:
        return github_ref_name, "env:GITHUB_REF_NAME"

    github_ref = os.environ.get("GITHUB_REF")
    if github_ref:
        # GITHUB_REF format: refs/heads/branch-name or refs/pull/123/merge
        if github_ref.startswith("refs/heads/"):
            branch = github_ref.replace("refs/heads/", "")
            return branch, "env:GITHUB_REF"
        elif github_ref.startswith("refs/pull/"):
            # For PRs, extract PR number
            return github_ref, "env:GITHUB_REF (PR)"

    # Fallback to local git command
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
        )
        if result.returncode == 0:
            branch = result.stdout.strip()
            return branch, "git:local"
    except Exception:
        pass

    return "unknown", "fallback"


def check_world_model_integration() -> bool:
    """
    CHECK A: Verify World Model Gate is integrated in amazon-growth entry.

    Scans amazon-growth main.py for required patterns:
    - run_world_model import
    - run_world_model() call
    - WORLD_MODEL_REQUIRED exception handling
    """
    print_header("CHECK A: World Model Gate Integration (amazon-growth)")

    main_py = REPO_ROOT / "src" / "domain" / "amazon-growth" / "main.py"

    if not main_py.exists():
        print_fail(f"Entry file not found: {main_py}")
        return False

    content = main_py.read_text()
    passed = True

    # Check for import
    if "from src.kernel.world_model import" not in content:
        print_fail("Missing import: from src.kernel.world_model import ...")
        passed = False
    else:
        print_pass("World Model import found")

    # Check for run_world_model call
    if "run_world_model(" not in content:
        print_fail("Missing call: run_world_model()")
        passed = False
    else:
        print_pass("run_world_model() call found")

    # Check for WORLD_MODEL_REQUIRED
    if "WORLD_MODEL_REQUIRED" not in content:
        print_fail("Missing exception: WORLD_MODEL_REQUIRED")
        passed = False
    else:
        print_pass("WORLD_MODEL_REQUIRED exception handling found")

    # Check for dry-run flag
    if "--dry-run" not in content:
        print_fail("Missing argument: --dry-run")
        passed = False
    else:
        print_pass("--dry-run argument found")

    return passed


def check_bypass_markers() -> bool:
    """
    CHECK B: Scan for forbidden bypass markers outside tests/.

    Forbidden patterns:
    - skip_world_model
    - bypass_gate
    - WORLD_MODEL_DISABLED
    """
    print_header("CHECK B: Bypass Marker Scan")

    forbidden_patterns = [
        r"skip_world_model",
        r"bypass_gate",
        r"WORLD_MODEL_DISABLED",
    ]

    # Directories to scan (production code only, excludes tools/ and tests/)
    # Rationale: tools/ may legitimately discuss bypass patterns in verification scripts
    scan_dirs = ["src/", "Systems/", "systems/"]
    exclude_dirs = {"tests", "node_modules", ".git", "__pycache__", ".pytest_cache"}

    violations = []

    for scan_dir in scan_dirs:
        scan_path = REPO_ROOT / scan_dir
        if not scan_path.exists():
            continue

        for root, dirs, files in os.walk(scan_path):
            # Skip excluded directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs]

            for file in files:
                if not file.endswith((".py", ".yaml", ".yml", ".json")):
                    continue

                file_path = Path(root) / file
                try:
                    content = file_path.read_text()
                except Exception:
                    continue

                for pattern in forbidden_patterns:
                    if re.search(pattern, content, re.IGNORECASE):
                        rel_path = file_path.relative_to(REPO_ROOT)
                        violations.append((rel_path, pattern))

    if violations:
        print_fail(f"Found {len(violations)} bypass marker violation(s):")
        for path, pattern in violations:
            print(f"      - {path}: '{pattern}'")
        return False

    print_pass("No bypass markers found outside tests/")
    print_info(f"Scanned directories: {', '.join(scan_dirs)}")
    print_info(f"Forbidden patterns: {', '.join(forbidden_patterns)}")
    return True


def check_world_model_module() -> bool:
    """
    CHECK C: Verify World Model module structure.
    """
    print_header("CHECK C: World Model Module Structure")

    required_files = [
        "src/kernel/world_model/__init__.py",
        "src/kernel/world_model/types.py",
        "src/kernel/world_model/runner.py",
        "src/kernel/world_model/units/__init__.py",
    ]

    required_units = [
        "src/kernel/world_model/units/amazon_growth/t1_budget_reflexivity.md",
        "src/kernel/world_model/units/amazon_growth/t1_attribution_not_causality.md",
        "src/kernel/world_model/units/amazon_growth/t1_seasonality_false_trend.md",
        "src/kernel/world_model/units/amazon_growth/t2_liquidity_inventory_cash.md",
        "src/kernel/world_model/units/amazon_growth/t2_expectation_auction_crowding.md",
        "src/kernel/world_model/units/amazon_growth/t3_amplification_cpc_spiral.md",
        "src/kernel/world_model/units/amazon_growth/t3_phase_transition_stockout.md",
    ]

    passed = True

    # Check required files
    for file_path in required_files:
        full_path = REPO_ROOT / file_path
        if full_path.exists():
            print_pass(f"Found: {file_path}")
        else:
            print_fail(f"Missing: {file_path}")
            passed = False

    # Check required units
    print_info("Checking T1/T2/T3 units:")
    unit_count = 0
    for unit_path in required_units:
        full_path = REPO_ROOT / unit_path
        if full_path.exists():
            unit_count += 1
        else:
            print_fail(f"Missing unit: {unit_path}")
            passed = False

    if unit_count == len(required_units):
        print_pass(f"All {unit_count} T1/T2/T3 units present")

    return passed


def check_dry_run_smoke() -> bool:
    """
    CHECK D: Dry-run smoke test.

    Runs amazon-growth with --dry-run and verifies:
    - Exit code 0
    - Trace JSON file generated
    - Report MD file generated
    """
    print_header("CHECK D: Dry-Run Smoke Test")

    # Check if we can import the world model module
    try:
        sys.path.insert(0, str(REPO_ROOT))
        from src.kernel.world_model import run_world_model, validate_world_model_result
        print_pass("World Model module imports successfully")
    except ImportError as e:
        print_fail(f"Cannot import World Model module: {e}")
        return False

    # Run the world model directly (avoid full main.py which needs ANTHROPIC_API_KEY)
    try:
        result, trace_path, artifact_path = run_world_model(
            domain="amazon-growth",
            task="Smoke test: verify dry-run functionality",
            context={"user_input": "smoke test", "data_sources": ["smoke_test"]},
        )
        print_pass("run_world_model() executed successfully")
    except Exception as e:
        print_fail(f"run_world_model() failed: {e}")
        return False

    # Verify trace file
    if trace_path.exists():
        print_pass(f"Trace file generated: {trace_path.name}")
    else:
        print_fail(f"Trace file not found: {trace_path}")
        return False

    # Verify artifact file
    if artifact_path.exists():
        print_pass(f"Artifact file generated: {artifact_path.name}")
    else:
        print_fail(f"Artifact file not found: {artifact_path}")
        return False

    # Validate result
    errors = validate_world_model_result(result)
    if errors:
        print_fail(f"Validation errors: {errors}")
        return False

    print_pass("WorldModelResult validation passed")

    # Check required counts
    fm_count = len(result["t1"]["failure_modes"])
    nty_count = len(result["t1"]["not_telling_you"])
    allowed_count = len(result["allowed_actions"]["allowed"])
    not_allowed_count = len(result["allowed_actions"]["not_allowed"])

    print_info(f"failure_modes: {fm_count} (>= 3 required)")
    print_info(f"not_telling_you: {nty_count} (>= 2 required)")
    print_info(f"allowed: {allowed_count} (>= 3 required)")
    print_info(f"not_allowed: {not_allowed_count} (>= 3 required)")

    if fm_count < 3 or nty_count < 2 or allowed_count < 3 or not_allowed_count < 3:
        print_fail("Required counts not met")
        return False

    print_pass("All required counts satisfied")
    print_info(f"Trace ID: {result['audit']['trace_id']}")

    return True


# Error codes
MAINLINE_RC_VERSION_FORBIDDEN = "MAINLINE_RC_VERSION_FORBIDDEN"


def check_mainline_version_policy() -> bool:
    """
    CHECK F: Mainline Version Policy.

    Rules:
    - On main branch: RC versions (-rc) are FORBIDDEN
    - Allowed: -dev, release versions (vX.Y.Z), or other dev suffixes
    - Non-main branches: No restrictions (SKIP)

    Returns:
        True if check passes, False if fails
    """
    print_header("CHECK F: Mainline Version Policy")

    branch, branch_source = get_current_branch()
    version, version_source = load_current_version()

    print_info(f"Branch: {branch} (source: {branch_source})")
    print_info(f"Version: {version} (source: {version_source})")

    # Only enforce on main branch
    if branch != "main":
        print_skip(f"Not on main branch (current: {branch})")
        print_info("RC version restriction only applies to main branch")
        return True

    # Check for RC version pattern
    if "-rc" in version.lower():
        print_fail(f"RC version detected on main branch: {version}")
        print(f"\n  {RED}{BOLD}ERROR: {MAINLINE_RC_VERSION_FORBIDDEN}{RESET}")
        print(f"\n  {YELLOW}Main branch must not be in RC state.{RESET}")
        print(f"  {YELLOW}RC versions should be frozen via tags or release branches.{RESET}")
        print(f"\n  {BLUE}Suggested fix:{RESET}")

        # Extract version components to suggest fix
        match = re.match(r"v(\d+)\.(\d+)\.(\d+)", version)
        if match:
            major, minor, patch = match.groups()
            suggested = f"v{major}.{minor}.{int(patch) + 1}-dev"
            print(f"    Change config/version.txt to: {suggested}")
        else:
            print(f"    Change config/version.txt to a dev version (e.g., vX.Y.Z-dev)")

        return False

    # Version is valid for main
    print_pass(f"Version '{version}' is valid for main branch")

    # Additional info about allowed patterns
    if "-dev" in version.lower():
        print_info("Development version detected (rolling mainline)")
    elif re.match(r"^v\d+\.\d+\.\d+$", version):
        print_info("Release version detected (stable)")
    else:
        print_warn(f"Non-standard version suffix: {version}")

    return True


def main():
    print(f"{BOLD}LiYe OS v6.2 Architecture Verification - World Model Gate{RESET}")

    version, version_source = load_current_version()
    branch, branch_source = get_current_branch()
    print(f"Repository: {REPO_ROOT}")
    print(f"Version: {version} (source: {version_source})")
    print(f"Branch: {branch} (source: {branch_source})")
    print(f"Time: {datetime.now().strftime('%c')}")

    results = {
        "world_model_integration": check_world_model_integration(),
        "bypass_markers": check_bypass_markers(),
        "module_structure": check_world_model_module(),
        "dry_run_smoke": check_dry_run_smoke(),
        "mainline_version_policy": check_mainline_version_policy(),
    }

    # Summary
    print_header("SUMMARY")
    all_passed = True
    for check_name, passed in results.items():
        status = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"
        print(f"  {check_name}: {status}")
        if not passed:
            all_passed = False

    if all_passed:
        print(f"\n{GREEN}{BOLD}ALL CHECKS PASSED{RESET}")
        return 0
    else:
        print(f"\n{RED}{BOLD}SOME CHECKS FAILED{RESET}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
