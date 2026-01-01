#!/usr/bin/env python3
"""
LiYe OS v6.2 Architecture Verification - Governance Gates
==========================================================

This script verifies governance rules for v6.2:
- CHECK F: Mainline Version Policy (RC versions forbidden on main)
- Future: World Model Gate checks (A-E) when merged

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

# Error codes
MAINLINE_RC_VERSION_FORBIDDEN = "MAINLINE_RC_VERSION_FORBIDDEN"


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
    print(f"{BOLD}LiYe OS v6.2 Architecture Verification - Governance Gates{RESET}")

    version, source = load_current_version()
    branch, branch_source = get_current_branch()

    print(f"Repository: {REPO_ROOT}")
    print(f"Version: {version} (source: {source})")
    print(f"Branch: {branch} (source: {branch_source})")
    print(f"Time: {datetime.now().strftime('%c')}")

    results = {
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
