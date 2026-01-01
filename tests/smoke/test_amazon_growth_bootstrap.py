#!/usr/bin/env python3
"""
Amazon Growth Bootstrap Smoke Test
===================================

This smoke test verifies the minimal bootstrap functionality of the
amazon-growth domain without making external API calls.

Tests:
1. agent_loader can be imported
2. Agents directory is accessible
3. All 14 agents (12 native + 2 aliases) load correctly
4. Required fields are present

Usage:
    python tests/smoke/test_amazon_growth_bootstrap.py

    # Generate report
    python tests/smoke/test_amazon_growth_bootstrap.py --report

Exit codes:
    0: All tests passed
    1: One or more tests failed

Version: v6.1.1
"""

import os
import sys
from datetime import datetime
from pathlib import Path

# Add amazon-growth to path
REPO_ROOT = Path(__file__).parent.parent.parent
AMAZON_GROWTH_PATH = REPO_ROOT / "src" / "domain" / "amazon-growth"
sys.path.insert(0, str(AMAZON_GROWTH_PATH))

# Test configuration
EXPECTED_AGENT_COUNT = 14  # 12 native + 2 aliases
EXPECTED_NATIVE_COUNT = 12
REQUIRED_FIELDS = ["role", "goal", "backstory", "verbose"]


class SmokeTestResult:
    """Container for test results."""

    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures = []
        self.details = []

    def add_pass(self, test_name: str, detail: str = ""):
        self.tests_run += 1
        self.tests_passed += 1
        self.details.append(f"[PASS] {test_name}: {detail}")
        print(f"  ✅ {test_name}")

    def add_fail(self, test_name: str, error: str):
        self.tests_run += 1
        self.tests_failed += 1
        self.failures.append(f"{test_name}: {error}")
        self.details.append(f"[FAIL] {test_name}: {error}")
        print(f"  ❌ {test_name}: {error}")

    @property
    def passed(self) -> bool:
        return self.tests_failed == 0


def test_import_agent_loader(result: SmokeTestResult):
    """Test 1: Can import agent_loader module."""
    try:
        from agent_loader import load_agents_from_ssot, get_agents_dir
        result.add_pass("import_agent_loader", "Module imported successfully")
        return True
    except ImportError as e:
        result.add_fail("import_agent_loader", str(e))
        return False


def test_agents_directory(result: SmokeTestResult):
    """Test 2: Agents directory exists and contains YAML files."""
    try:
        from agent_loader import get_agents_dir

        agents_dir = get_agents_dir()
        if not agents_dir.exists():
            result.add_fail("agents_directory", f"Directory not found: {agents_dir}")
            return False

        yaml_files = list(agents_dir.glob("*.yaml"))
        if len(yaml_files) < EXPECTED_NATIVE_COUNT:
            result.add_fail(
                "agents_directory",
                f"Expected {EXPECTED_NATIVE_COUNT} YAML files, found {len(yaml_files)}"
            )
            return False

        result.add_pass("agents_directory", f"{len(yaml_files)} YAML files found")
        return True
    except Exception as e:
        result.add_fail("agents_directory", str(e))
        return False


def test_load_agents(result: SmokeTestResult):
    """Test 3: Can load all agents from SSOT."""
    try:
        from agent_loader import load_agents_from_ssot

        agents = load_agents_from_ssot()

        if len(agents) != EXPECTED_AGENT_COUNT:
            result.add_fail(
                "load_agents",
                f"Expected {EXPECTED_AGENT_COUNT} agents, got {len(agents)}"
            )
            return False

        result.add_pass("load_agents", f"Loaded {len(agents)} agents")
        return agents
    except Exception as e:
        result.add_fail("load_agents", str(e))
        return None


def test_agent_fields(result: SmokeTestResult, agents: dict):
    """Test 4: All agents have required fields."""
    if agents is None:
        result.add_fail("agent_fields", "No agents to test (previous test failed)")
        return False

    missing = []
    for agent_id, config in agents.items():
        for field in REQUIRED_FIELDS:
            if field not in config:
                missing.append(f"{agent_id}.{field}")

    if missing:
        result.add_fail("agent_fields", f"Missing fields: {missing[:5]}")
        return False

    result.add_pass("agent_fields", f"All {len(agents)} agents have required fields")
    return True


def test_unique_ids(result: SmokeTestResult, agents: dict):
    """Test 5: All agent IDs are unique."""
    if agents is None:
        result.add_fail("unique_ids", "No agents to test (previous test failed)")
        return False

    ids = list(agents.keys())
    unique_ids = set(ids)

    if len(ids) != len(unique_ids):
        duplicates = [x for x in ids if ids.count(x) > 1]
        result.add_fail("unique_ids", f"Duplicate IDs: {set(duplicates)}")
        return False

    result.add_pass("unique_ids", f"All {len(ids)} IDs are unique")
    return True


def generate_report(result: SmokeTestResult, agents: dict = None) -> str:
    """Generate a markdown report of the smoke test results."""
    timestamp = datetime.now().isoformat()

    lines = [
        "# Amazon Growth Bootstrap Smoke Test Report",
        "",
        f"**Generated**: {timestamp}",
        f"**Version**: v6.1.1",
        f"**Status**: {'PASS' if result.passed else 'FAIL'}",
        "",
        "## Summary",
        "",
        f"- Tests run: {result.tests_run}",
        f"- Passed: {result.tests_passed}",
        f"- Failed: {result.tests_failed}",
        "",
        "## Test Results",
        "",
    ]

    for detail in result.details:
        lines.append(f"- {detail}")

    if result.failures:
        lines.extend([
            "",
            "## Failures",
            "",
        ])
        for failure in result.failures:
            lines.append(f"- {failure}")

    if agents:
        lines.extend([
            "",
            "## Loaded Agents",
            "",
            "| ID | Role |",
            "|----|------|",
        ])
        for agent_id, config in sorted(agents.items()):
            role = config.get("role", "N/A")[:40]
            lines.append(f"| {agent_id} | {role} |")

    lines.extend([
        "",
        "---",
        "",
        f"*Report generated by `tests/smoke/test_amazon_growth_bootstrap.py`*",
    ])

    return "\n".join(lines)


def main():
    """Run all smoke tests."""
    import argparse

    parser = argparse.ArgumentParser(description="Amazon Growth Bootstrap Smoke Test")
    parser.add_argument("--report", action="store_true", help="Generate report to Artifacts_Vault")
    args = parser.parse_args()

    print("\n=== Amazon Growth Bootstrap Smoke Test ===\n")
    print(f"Repository: {REPO_ROOT}")
    print(f"Amazon Growth: {AMAZON_GROWTH_PATH}")
    print()

    result = SmokeTestResult()
    agents = None

    # Run tests
    print("Running tests...\n")

    if test_import_agent_loader(result):
        if test_agents_directory(result):
            agents = test_load_agents(result)
            if agents:
                test_agent_fields(result, agents)
                test_unique_ids(result, agents)

    # Print summary
    print(f"\n{'=' * 40}")
    print(f"Tests: {result.tests_run} | Passed: {result.tests_passed} | Failed: {result.tests_failed}")
    print(f"{'=' * 40}\n")

    # Generate report if requested
    if args.report:
        report_content = generate_report(result, agents)
        report_path = REPO_ROOT / "Artifacts_Vault" / "reports" / "SMOKE_v6.1.1.md"
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(report_content)
        print(f"Report written to: {report_path}")

    if result.passed:
        print("✅ ALL TESTS PASSED")
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(main())
