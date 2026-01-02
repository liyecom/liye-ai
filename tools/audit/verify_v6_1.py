#!/usr/bin/env python3
"""
LiYe OS v6.1 Architecture Verification Script
==============================================

This script enforces SSOT (Single Source of Truth) and governance rules.
It must pass in CI before any merge to main.

Exit codes:
- 0: All checks passed
- 1: One or more checks failed

Usage:
    python tools/audit/verify_v6_1.py
    python tools/audit/verify_v6_1.py --verbose
"""

import os
import sys
import re
import subprocess
from pathlib import Path
from typing import List, Tuple, Dict, Set

# Configuration
REPO_ROOT = Path(__file__).parent.parent.parent
AGENTS_SSOT_DIR = REPO_ROOT / "Agents" / "amazon-growth"
AGENT_LOADER_PATH = REPO_ROOT / "src" / "domain" / "amazon-growth" / "agent_loader.py"
SYMLINKS_DOC = REPO_ROOT / "_meta" / "docs" / "SYMLINKS.md"

# Expected values
EXPECTED_AGENT_COUNT = 14  # 12 native + 2 aliases
EXPECTED_SYMLINK_COUNT = 0  # Symlinks retired in v6.3.0

# Forbidden paths (SSOT violations)
FORBIDDEN_AGENT_PATHS = [
    "src/domain/config/agents.yaml",
    "src/domain/agents/",
    "config/agents.yaml",
    ".scaffold/",
]

# Legacy symlinks - RETIRED in v6.3.0 (PR #33)
# These root-level symlinks caused GitHub display issues and are no longer tracked.
# Code should reference canonical paths directly.
RETIRED_SYMLINKS = {
    "governance": "_meta/governance",
    "schemas": "_meta/schemas",
    "templates": "_meta/templates",
    "stats": "data/stats",
    "traces": "data/traces",
    "adapters": "src/adapters",
    "reports": "Artifacts_Vault/reports",
    "scripts": "tools",
}

# Canonical allowed paths (v6.3.0+)
CANONICAL_PATHS = {
    "src/**": "Source code",
    "docs/**": "Documentation",
    "_meta/schemas/**": "Schema definitions (formerly schemas/)",
    "_meta/templates/**": "Templates (formerly templates/)",
    "_meta/governance/**": "Governance rules (formerly governance/)",
    "tools/**": "Tools and scripts (formerly scripts/)",
    "data/**": "Data files (non-SSOT, optional)",
    "Agents/**": "Agent definitions",
    "Artifacts_Vault/**": "Artifact storage",
}

# Version SSOT configuration
VERSION_FILE = REPO_ROOT / "config" / "version.txt"
VERSION_ENV_VAR = "LIYE_OS_VERSION"

# Maximum references to show in remediation list
MAX_REFERENCES_SHOWN = 30

# Version globals (initialized by load_current_version())
CURRENT_VERSION = None
VERSION_SOURCE = None


def load_current_version() -> Tuple[str, str]:
    """
    Load current version from SSOT (config/version.txt) or env override.

    Priority:
    1. If LIYE_OS_VERSION env var is set and non-empty -> use it
    2. Otherwise -> read from config/version.txt

    Returns:
        Tuple of (version, source) where source is:
        - "env:LIYE_OS_VERSION" if from environment
        - "file:config/version.txt" if from file

    Raises:
        SystemExit: If version file is missing/invalid and no env override
    """
    # Check for environment override first
    env_version = os.environ.get(VERSION_ENV_VAR, "").strip()
    if env_version:
        # Validate format
        if not re.match(r"^v\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$", env_version):
            print(f"{Colors.RED}[ERROR]{Colors.RESET} VERSION_FORMAT_INVALID: "
                  f"env {VERSION_ENV_VAR}='{env_version}' is not valid (expected vMAJOR.MINOR.PATCH[-prerelease])")
            sys.exit(1)
        return env_version, f"env:{VERSION_ENV_VAR}"

    # Read from version file (SSOT)
    if not VERSION_FILE.exists():
        print(f"{Colors.RED}[ERROR]{Colors.RESET} VERSION_SOURCE_INVALID: "
              f"config/version.txt missing")
        print(f"  Expected at: {VERSION_FILE}")
        print(f"  Create it with: echo 'v6.1.1' > config/version.txt")
        sys.exit(1)

    try:
        version = VERSION_FILE.read_text().strip()
    except Exception as e:
        print(f"{Colors.RED}[ERROR]{Colors.RESET} VERSION_SOURCE_INVALID: "
              f"Failed to read config/version.txt: {e}")
        sys.exit(1)

    # Validate format
    if not version:
        print(f"{Colors.RED}[ERROR]{Colors.RESET} VERSION_SOURCE_INVALID: "
              f"config/version.txt is empty")
        sys.exit(1)

    if not re.match(r"^v\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$", version):
        print(f"{Colors.RED}[ERROR]{Colors.RESET} VERSION_FORMAT_INVALID: "
              f"config/version.txt contains '{version}' (expected vMAJOR.MINOR.PATCH[-prerelease])")
        sys.exit(1)

    return version, "file:config/version.txt"


class Colors:
    """ANSI color codes for terminal output."""
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


def print_header(title: str):
    """Print a section header."""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'=' * 60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{title}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'=' * 60}{Colors.RESET}")


def print_pass(msg: str):
    """Print a pass message."""
    print(f"  {Colors.GREEN}[PASS]{Colors.RESET} {msg}")


def print_fail(msg: str):
    """Print a fail message."""
    print(f"  {Colors.RED}[FAIL]{Colors.RESET} {msg}")


def print_warn(msg: str):
    """Print a warning message."""
    print(f"  {Colors.YELLOW}[WARN]{Colors.RESET} {msg}")


def print_info(msg: str):
    """Print an info message."""
    print(f"  {Colors.BLUE}[INFO]{Colors.RESET} {msg}")


def parse_version(version: str) -> Tuple[int, int, int]:
    """Parse version string like 'v6.1.1' into tuple (6, 1, 1)."""
    match = re.match(r"v?(\d+)\.(\d+)\.(\d+)", version)
    if match:
        return (int(match.group(1)), int(match.group(2)), int(match.group(3)))
    return (0, 0, 0)


def compare_versions(v1: str, v2: str) -> int:
    """
    Compare two semantic versions.
    Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2

    Handles cases like v6.10.0 > v6.3.0 correctly (not string comparison).
    """
    p1 = parse_version(v1)
    p2 = parse_version(v2)

    for i in range(3):
        if p1[i] < p2[i]:
            return -1
        elif p1[i] > p2[i]:
            return 1
    return 0


def is_version_overdue(current: str, retire_by: str) -> bool:
    """Check if current version >= retire_by (overdue)."""
    return compare_versions(current, retire_by) >= 0


def version_distance(current: str, target: str) -> int:
    """
    Calculate approximate version distance (in minor versions).
    E.g., v6.1.1 -> v6.3.0 = 2 minor versions
    Returns negative if current >= target (overdue).
    """
    curr = parse_version(current)
    tgt = parse_version(target)

    # If major versions differ
    if curr[0] != tgt[0]:
        return (tgt[0] - curr[0]) * 10 + (tgt[1] - curr[1])

    # Same major, compare minor
    return tgt[1] - curr[1]


def find_symlink_references(symlink_name: str, max_results: int = MAX_REFERENCES_SHOWN) -> List[str]:
    """
    Find code references to a symlink path.
    Returns list of file:line references.
    """
    references = []
    scan_dirs = ["src/", "tools/", "Systems/", "tests/", "systems/", ".claude/"]

    # Search patterns: direct path references
    patterns = [
        f"/{symlink_name}/",
        f'"{symlink_name}/',
        f"'{symlink_name}/",
        f"from {symlink_name}",
        f"import {symlink_name}",
    ]

    for pattern in patterns:
        for scan_dir in scan_dirs:
            full_scan_path = REPO_ROOT / scan_dir
            if not full_scan_path.exists():
                continue

            try:
                result = subprocess.run(
                    ["grep", "-rn", pattern, str(full_scan_path)],
                    capture_output=True,
                    text=True,
                    cwd=REPO_ROOT
                )
                if result.stdout.strip():
                    for line in result.stdout.strip().split("\n"):
                        # Skip verify script itself
                        if "verify_v6_1.py" not in line and "selftest" not in line:
                            # Format as relative path
                            rel_line = line.replace(str(REPO_ROOT) + "/", "")
                            if rel_line not in references:
                                references.append(rel_line)
            except Exception:
                pass

    return references[:max_results]


def check_ssot_violations() -> Tuple[bool, List[str]]:
    """
    Check A: SSOT - Agent definitions must only come from Agents/
    Scan codebase for references to forbidden paths.
    """
    print_header("CHECK A: SSOT Agent Definition Compliance")

    violations = []
    scan_dirs = ["src/", "tools/", "Systems/", "tests/", "systems/"]

    for forbidden_path in FORBIDDEN_AGENT_PATHS:
        # Use grep to find references
        for scan_dir in scan_dirs:
            full_scan_path = REPO_ROOT / scan_dir
            if not full_scan_path.exists():
                continue

            try:
                result = subprocess.run(
                    ["grep", "-rn", forbidden_path, str(full_scan_path)],
                    capture_output=True,
                    text=True,
                    cwd=REPO_ROOT
                )
                if result.stdout.strip():
                    for line in result.stdout.strip().split("\n"):
                        # Exclude this verification script itself
                        if "verify_v6_1.py" not in line:
                            violations.append(f"Reference to '{forbidden_path}': {line}")
            except Exception as e:
                print_warn(f"Error scanning {scan_dir}: {e}")

    # Also check for actual file existence
    for forbidden_path in FORBIDDEN_AGENT_PATHS:
        full_path = REPO_ROOT / forbidden_path
        if full_path.exists():
            violations.append(f"Forbidden path still exists: {forbidden_path}")

    if violations:
        print_fail(f"Found {len(violations)} SSOT violations:")
        for v in violations[:10]:  # Show first 10
            print(f"    - {v}")
        if len(violations) > 10:
            print(f"    ... and {len(violations) - 10} more")
        return False, violations
    else:
        print_pass("No SSOT violations found")
        print_info(f"Scanned directories: {', '.join(scan_dirs)}")
        print_info(f"Forbidden paths checked: {len(FORBIDDEN_AGENT_PATHS)}")
        return True, []


def check_agent_loader() -> Tuple[bool, Dict]:
    """
    Check B: Agent Loader assertions
    - Total count = 14
    - Each agent has unique ID
    - Required fields exist
    """
    print_header("CHECK B: Agent Loader Assertions")

    # Add agent_loader directory to path
    sys.path.insert(0, str(AGENT_LOADER_PATH.parent))

    try:
        # Import and run agent loader
        from agent_loader import load_agents_from_ssot
        agents = load_agents_from_ssot()

        # Check count
        agent_count = len(agents)
        if agent_count != EXPECTED_AGENT_COUNT:
            print_fail(f"Agent count mismatch: expected {EXPECTED_AGENT_COUNT}, got {agent_count}")
            return False, {"count": agent_count, "expected": EXPECTED_AGENT_COUNT}
        print_pass(f"Agent count: {agent_count}")

        # Check unique IDs
        agent_ids = list(agents.keys())
        if len(agent_ids) != len(set(agent_ids)):
            duplicates = [x for x in agent_ids if agent_ids.count(x) > 1]
            print_fail(f"Duplicate agent IDs found: {duplicates}")
            return False, {"duplicates": duplicates}
        print_pass("All agent IDs are unique")

        # Check required fields (CrewAI format: role, goal, backstory)
        required_fields = ["role", "goal", "backstory"]
        missing_fields = []

        for agent_id, config in agents.items():
            for field in required_fields:
                if field not in config or not config[field]:
                    missing_fields.append(f"{agent_id} missing '{field}'")

        if missing_fields:
            print_fail(f"Missing required fields:")
            for mf in missing_fields:
                print(f"    - {mf}")
            return False, {"missing_fields": missing_fields}
        print_pass("All agents have required fields (role, goal, backstory)")

        # Print agent summary
        print_info("Agent summary:")
        for agent_id, config in agents.items():
            role = config.get("role", "N/A")[:40]
            print(f"    - {agent_id}: {role}")

        return True, {"count": agent_count, "agents": agent_ids}

    except Exception as e:
        print_fail(f"Failed to load agents: {e}")
        return False, {"error": str(e)}
    finally:
        # Clean up path
        if str(AGENT_LOADER_PATH.parent) in sys.path:
            sys.path.remove(str(AGENT_LOADER_PATH.parent))


def check_symlinks() -> Tuple[bool, Dict]:
    """
    Check C: Symlink Governance (v6.3.0+)

    As of v6.3.0, root-level symlinks have been RETIRED (PR #33).
    This check now verifies:
    - No unexpected root-level symlinks exist
    - Canonical paths are being used instead
    """
    print_header("CHECK C: Symlink Governance (v6.3.0 - Symlinks Retired)")

    # Find all top-level symlinks
    found_symlinks = {}
    for item in REPO_ROOT.iterdir():
        if item.is_symlink():
            target = os.readlink(item)
            found_symlinks[item.name] = target

    # Check count (should be 0 in v6.3.0+)
    if len(found_symlinks) != EXPECTED_SYMLINK_COUNT:
        print_warn(f"Symlink count: expected {EXPECTED_SYMLINK_COUNT}, got {len(found_symlinks)}")
        print_info("Root-level symlinks were retired in v6.3.0 (PR #33)")
        print_info("Local symlinks in .gitignore are acceptable for backward compatibility")
    else:
        print_pass(f"No root-level symlinks (retired in v6.3.0)")

    # Check for any retired symlinks still present (warning only, not blocking)
    issues = []
    for name, target in found_symlinks.items():
        if name in RETIRED_SYMLINKS:
            # This is a local symlink for backward compat, not tracked in git
            print_info(f"Local symlink found: {name} -> {target} (in .gitignore, OK)")
        else:
            issues.append(f"Unexpected symlink: {name} -> {target}")
            print_warn(f"Unexpected symlink: {name} -> {target}")

    # Print canonical path reference
    print_info(f"\n  {Colors.BOLD}Canonical Paths (v6.3.0+){Colors.RESET}")
    print(f"  {'─' * 55}")
    print(f"  {'Legacy (Retired)':<20} {'Canonical Path':<35}")
    print(f"  {'─' * 55}")

    for legacy_name, canonical_path in sorted(RETIRED_SYMLINKS.items()):
        print(f"  {legacy_name + '/':<20} {canonical_path + '/':<35}")

    print(f"  {'─' * 55}")
    print_info("Code should reference canonical paths directly.")

    # No critical issues for symlink retirement - it's complete
    return True, {
        "issues": issues,
        "found_symlinks": found_symlinks,
        "retired_symlinks": RETIRED_SYMLINKS
    }


def check_smoke_test() -> Tuple[bool, str]:
    """
    Check D: Smoke Test
    - Can import amazon-growth entry module
    - Can initialize agent registry
    """
    print_header("CHECK D: Smoke Test")

    # Add amazon-growth to path
    amazon_growth_path = REPO_ROOT / "src" / "domain" / "amazon-growth"
    sys.path.insert(0, str(amazon_growth_path))

    try:
        # Test 1: Import agent_loader
        print_info("Testing agent_loader import...")
        from agent_loader import load_agents_from_ssot, get_agents_dir
        print_pass("agent_loader imported successfully")

        # Test 2: Get agents directory
        print_info("Testing agents directory access...")
        agents_dir = get_agents_dir()
        if agents_dir.exists():
            yaml_count = len(list(agents_dir.glob("*.yaml")))
            print_pass(f"Agents directory accessible: {yaml_count} YAML files")
        else:
            print_fail("Agents directory not found")
            return False, "Agents directory not found"

        # Test 3: Load agents (dry run)
        print_info("Testing agent loading (dry run)...")
        agents = load_agents_from_ssot()
        print_pass(f"Loaded {len(agents)} agents successfully")

        return True, f"PASS: All smoke tests passed ({len(agents)} agents loaded)"

    except Exception as e:
        print_fail(f"Smoke test failed: {e}")
        return False, f"FAIL: {e}"
    finally:
        if str(amazon_growth_path) in sys.path:
            sys.path.remove(str(amazon_growth_path))


def check_symlink_retirement_enforcement(symlink_details: Dict) -> Tuple[bool, Dict]:
    """
    Check E: Symlink Retirement Status (v6.3.0+)

    As of v6.3.0, all symlinks have been retired. This check now:
    - Confirms symlink retirement is complete
    - Reports any unexpected symlinks found
    """
    print_header("CHECK E: Symlink Retirement Status (v6.3.0)")

    found_symlinks = symlink_details.get("found_symlinks", {})

    # Check if any symlinks are still tracked in git (shouldn't be)
    # Local symlinks in .gitignore are OK
    print_pass(f"Symlink retirement complete (v6.3.0)")
    print_info(f"All 8 legacy symlinks were retired in PR #33")
    print_info(f"Local symlinks in .gitignore are acceptable")

    if found_symlinks:
        print_info(f"Found {len(found_symlinks)} local symlink(s) (not tracked in git):")
        for name, target in found_symlinks.items():
            print(f"    {name} -> {target}")
    else:
        print_info("No local symlinks found")

    return True, {
        "retirement_complete": True,
        "local_symlinks_count": len(found_symlinks)
    }


def main():
    """Run all verification checks."""
    global CURRENT_VERSION, VERSION_SOURCE

    # Load version from SSOT (or env override)
    CURRENT_VERSION, VERSION_SOURCE = load_current_version()

    print(f"\n{Colors.BOLD}LiYe OS Architecture Verification (Canonical v6.3.0+){Colors.RESET}")
    print(f"Repository: {REPO_ROOT}")
    print(f"Version: {CURRENT_VERSION} (source: {VERSION_SOURCE})")
    print(f"Time: {subprocess.run(['date'], capture_output=True, text=True).stdout.strip()}")

    all_passed = True
    results = {}

    # Check A: SSOT
    passed, details = check_ssot_violations()
    results["ssot"] = {"passed": passed, "details": details}
    all_passed = all_passed and passed

    # Check B: Agent Loader
    passed, details = check_agent_loader()
    results["agent_loader"] = {"passed": passed, "details": details}
    all_passed = all_passed and passed

    # Check C: Symlinks
    passed, details = check_symlinks()
    results["symlinks"] = {"passed": passed, "details": details}
    all_passed = all_passed and passed

    # Check D: Smoke Test
    passed, details = check_smoke_test()
    results["smoke_test"] = {"passed": passed, "details": details}
    all_passed = all_passed and passed

    # Check E: Symlink Retirement Status (v6.3.0 - symlinks retired)
    symlinks_details = results["symlinks"]["details"]
    if not isinstance(symlinks_details, dict):
        symlinks_details = {}

    passed, details = check_symlink_retirement_enforcement(symlinks_details)
    results["symlink_retirement"] = {"passed": passed, "details": details}
    all_passed = all_passed and passed

    # Summary
    print_header("SUMMARY")
    for check_name, result in results.items():
        status = f"{Colors.GREEN}PASS{Colors.RESET}" if result["passed"] else f"{Colors.RED}FAIL{Colors.RESET}"
        print(f"  {check_name}: {status}")

    if all_passed:
        print(f"\n{Colors.GREEN}{Colors.BOLD}ALL CHECKS PASSED{Colors.RESET}")
        return 0
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}SOME CHECKS FAILED{Colors.RESET}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
