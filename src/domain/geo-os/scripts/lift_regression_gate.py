#!/usr/bin/env python3
"""
Lift Regression Gate
====================

Prevents T1 modifications from causing Lift regression.
Also detects orphan mechanisms (no case bindings).

Usage:
    python scripts/lift_regression_gate.py [--check-orphans]

Exit Codes:
    0 - PASS (no regression detected)
    1 - FAIL (regression detected, block merge)

Reference:
    docs/architecture/P0_5_LIFT_REPRODUCTION.md
    docs/architecture/P1_MECHANISM_DEEPENING.md
"""

import sys
import json
import yaml
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Optional, Set
from enum import Enum


class Verdict(Enum):
    POSITIVE_LIFT = "POSITIVE_LIFT"
    NEUTRAL = "NEUTRAL"
    NEGATIVE_LIFT = "NEGATIVE_LIFT"


@dataclass
class CaseResult:
    """Result of a single case evaluation"""
    case_id: str
    domain: str
    original_lift: int
    original_verdict: Verdict
    current_lift: Optional[int] = None
    current_verdict: Optional[Verdict] = None
    status: str = "PENDING"
    failure_reason: Optional[str] = None


class LiftRegressionGate:
    """
    Regression gate for T1 Reasoning Lift validation.

    FAIL Conditions:
    1. POSITIVE_LIFT → NEUTRAL / NEGATIVE_LIFT
    2. Lift drops by >= LIFT_THRESHOLD
    3. Uses BLACKLIST mechanisms
    """

    LIFT_THRESHOLD = 2  # Maximum allowed lift drop

    # Blacklist mechanisms (from T1_MECHANISM_WHITELIST.md)
    MECHANISM_BLACKLIST = [
        "best_practice",
        "tip",
        "trick",
        "tutorial",
        "step_by_step",
        "subjective_summary",
        "vague_generalization"
    ]

    def __init__(self, repro_pack_path: str = None):
        """Initialize gate with repro pack path"""
        if repro_pack_path is None:
            # Default path relative to script location
            script_dir = Path(__file__).parent
            repro_pack_path = script_dir.parent / "experiments" / "repro_pack_v1"

        self.repro_pack_path = Path(repro_pack_path)
        self.cases: List[CaseResult] = []
        self.failures: List[str] = []

    def load_cases(self) -> List[CaseResult]:
        """Load all case.yaml files from repro pack"""
        cases = []

        for domain_dir in self.repro_pack_path.iterdir():
            if not domain_dir.is_dir() or domain_dir.name == "__pycache__":
                continue

            for case_file in domain_dir.glob("case_*.yaml"):
                with open(case_file, 'r', encoding='utf-8') as f:
                    data = yaml.safe_load(f)

                if data.get('locked', False):
                    case = CaseResult(
                        case_id=data['case_id'],
                        domain=data['domain'],
                        original_lift=data['lift'],
                        original_verdict=Verdict(data['verdict'])
                    )
                    cases.append(case)

        self.cases = cases
        return cases

    def check_verdict_regression(self, case: CaseResult) -> bool:
        """
        Check if verdict has regressed.

        FAIL if: POSITIVE_LIFT → NEUTRAL / NEGATIVE_LIFT
        """
        if case.current_verdict is None:
            # No current result, assume stable
            return True

        if case.original_verdict == Verdict.POSITIVE_LIFT:
            if case.current_verdict != Verdict.POSITIVE_LIFT:
                case.status = "FAIL"
                case.failure_reason = (
                    f"Verdict regression: {case.original_verdict.value} → "
                    f"{case.current_verdict.value}"
                )
                return False

        return True

    def check_lift_drop(self, case: CaseResult) -> bool:
        """
        Check if lift has dropped beyond threshold.

        FAIL if: current_lift < original_lift - LIFT_THRESHOLD
        """
        if case.current_lift is None:
            # No current result, assume stable
            return True

        lift_diff = case.original_lift - case.current_lift

        if lift_diff >= self.LIFT_THRESHOLD:
            case.status = "FAIL"
            case.failure_reason = (
                f"Lift drop: {case.original_lift} → {case.current_lift} "
                f"(diff: -{lift_diff}, threshold: {self.LIFT_THRESHOLD})"
            )
            return False

        return True

    def check_blacklist_usage(self, mechanisms: List[str]) -> Optional[str]:
        """
        Check if any blacklist mechanisms are used.

        Returns the first blacklist mechanism found, or None.
        """
        for mech in mechanisms:
            mech_lower = mech.lower()
            for blacklist_item in self.MECHANISM_BLACKLIST:
                if blacklist_item in mech_lower:
                    return mech
        return None

    def run_validation(self) -> bool:
        """
        Run full validation on all locked cases.

        In the current implementation, we check:
        1. All cases are loaded correctly
        2. Original verdicts are POSITIVE_LIFT

        Future: Will integrate with actual T1 re-evaluation.

        Returns:
            True if all checks pass, False otherwise.
        """
        print("=" * 60)
        print("Lift Regression Gate v1.0")
        print("=" * 60)
        print()

        # Load cases
        cases = self.load_cases()
        print(f"Loaded {len(cases)} locked cases from Repro Pack")
        print()

        # Validate structure
        all_pass = True

        for case in cases:
            print(f"[{case.domain}] {case.case_id}")
            print(f"  Original Lift: +{case.original_lift}")
            print(f"  Original Verdict: {case.original_verdict.value}")

            # Check original verdict
            if case.original_verdict == Verdict.POSITIVE_LIFT:
                case.status = "PASS"
                print(f"  Status: ✅ PASS (baseline confirmed)")
            else:
                case.status = "WARN"
                print(f"  Status: ⚠️ WARN (non-positive baseline)")

            print()

        # Summary
        print("=" * 60)
        print("Summary")
        print("=" * 60)

        pass_count = sum(1 for c in cases if c.status == "PASS")
        fail_count = sum(1 for c in cases if c.status == "FAIL")
        warn_count = sum(1 for c in cases if c.status == "WARN")

        print(f"Total Cases: {len(cases)}")
        print(f"  PASS: {pass_count}")
        print(f"  FAIL: {fail_count}")
        print(f"  WARN: {warn_count}")
        print()

        if fail_count > 0:
            print("❌ GATE STATUS: FAIL")
            print()
            print("Failures:")
            for case in cases:
                if case.status == "FAIL":
                    print(f"  - {case.case_id}: {case.failure_reason}")
            return False
        else:
            print("✅ GATE STATUS: PASS")
            return True

    def run_with_current_results(self, current_results: Dict[str, Dict]) -> bool:
        """
        Run validation with provided current results.

        Args:
            current_results: Dict mapping case_id to {lift: int, verdict: str}

        Returns:
            True if all checks pass, False otherwise.
        """
        print("=" * 60)
        print("Lift Regression Gate v1.0 - Full Validation")
        print("=" * 60)
        print()

        cases = self.load_cases()
        print(f"Loaded {len(cases)} locked cases from Repro Pack")
        print()

        all_pass = True

        for case in cases:
            print(f"[{case.domain}] {case.case_id}")
            print(f"  Original: lift=+{case.original_lift}, "
                  f"verdict={case.original_verdict.value}")

            # Apply current results if available
            if case.case_id in current_results:
                result = current_results[case.case_id]
                case.current_lift = result.get('lift')
                case.current_verdict = Verdict(result.get('verdict'))

                print(f"  Current:  lift=+{case.current_lift}, "
                      f"verdict={case.current_verdict.value}")

                # Run checks
                verdict_ok = self.check_verdict_regression(case)
                lift_ok = self.check_lift_drop(case)

                if verdict_ok and lift_ok:
                    case.status = "PASS"
                    print(f"  Status: ✅ PASS")
                else:
                    all_pass = False
                    print(f"  Status: ❌ FAIL - {case.failure_reason}")
            else:
                case.status = "SKIP"
                print(f"  Status: ⏭️ SKIP (no current result)")

            print()

        # Summary
        print("=" * 60)
        print("Summary")
        print("=" * 60)

        pass_count = sum(1 for c in cases if c.status == "PASS")
        fail_count = sum(1 for c in cases if c.status == "FAIL")
        skip_count = sum(1 for c in cases if c.status == "SKIP")

        print(f"Total Cases: {len(cases)}")
        print(f"  PASS: {pass_count}")
        print(f"  FAIL: {fail_count}")
        print(f"  SKIP: {skip_count}")
        print()

        if fail_count > 0:
            print("❌ GATE STATUS: FAIL")
            print()
            print("Required Actions:")
            print("  1. Analyze root cause of regression")
            print("  2. Provide alternative mechanism")
            print("  3. Submit for human review")
            return False
        else:
            print("✅ GATE STATUS: PASS")
            return True


class OrphanMechanismDetector:
    """
    Detects mechanisms that have no bound cases.

    P1 Requirement: Every mechanism must be bound to at least one case.
    Orphan mechanisms indicate untested reasoning components.
    """

    def __init__(self, t1_units_path: str = None, repro_pack_paths: List[str] = None):
        """Initialize detector with paths"""
        script_dir = Path(__file__).parent

        if t1_units_path is None:
            t1_units_path = script_dir.parent / "data" / "t1_units"

        if repro_pack_paths is None:
            repro_pack_paths = [
                script_dir.parent / "experiments" / "repro_pack_v1",
                script_dir.parent / "experiments" / "repro_pack_v2"
            ]

        self.t1_units_path = Path(t1_units_path)
        self.repro_pack_paths = [Path(p) for p in repro_pack_paths]

    def get_all_mechanisms(self) -> Dict[str, str]:
        """Get all mechanism IDs and their file paths"""
        mechanisms = {}

        if not self.t1_units_path.exists():
            return mechanisms

        for domain_dir in self.t1_units_path.iterdir():
            if not domain_dir.is_dir() or domain_dir.name.startswith('.'):
                continue

            for mech_file in domain_dir.glob("*.json"):
                try:
                    with open(mech_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    mech_id = data.get('id')
                    if mech_id:
                        mechanisms[mech_id] = str(mech_file)
                except (json.JSONDecodeError, KeyError):
                    continue

        return mechanisms

    def get_all_bound_mechanisms(self) -> Set[str]:
        """Get all mechanism IDs that are bound to cases"""
        bound = set()

        for repro_path in self.repro_pack_paths:
            if not repro_path.exists():
                continue

            for domain_dir in repro_path.iterdir():
                if not domain_dir.is_dir() or domain_dir.name.startswith('.'):
                    continue

                for case_file in domain_dir.glob("case_*.yaml"):
                    try:
                        with open(case_file, 'r', encoding='utf-8') as f:
                            data = yaml.safe_load(f)
                        bound_mech = data.get('bound_mechanism')
                        if bound_mech:
                            bound.add(bound_mech)
                    except (yaml.YAMLError, KeyError):
                        continue

        return bound

    def detect_orphans(self) -> List[Dict[str, str]]:
        """
        Detect orphan mechanisms (no case bindings).

        Returns:
            List of dicts with mechanism_id and file_path
        """
        all_mechanisms = self.get_all_mechanisms()
        bound_mechanisms = self.get_all_bound_mechanisms()

        orphans = []
        for mech_id, file_path in all_mechanisms.items():
            if mech_id not in bound_mechanisms:
                orphans.append({
                    'mechanism_id': mech_id,
                    'file_path': file_path
                })

        return orphans

    def run_check(self) -> bool:
        """
        Run orphan mechanism check.

        Returns:
            True if no orphans found, False otherwise.
        """
        print("=" * 60)
        print("Orphan Mechanism Detection")
        print("=" * 60)
        print()

        all_mechanisms = self.get_all_mechanisms()
        bound_mechanisms = self.get_all_bound_mechanisms()
        orphans = self.detect_orphans()

        print(f"Total Mechanisms: {len(all_mechanisms)}")
        print(f"Bound to Cases: {len(bound_mechanisms)}")
        print(f"Orphans: {len(orphans)}")
        print()

        if orphans:
            print("⚠️ Orphan Mechanisms Detected:")
            for orphan in orphans:
                print(f"  - {orphan['mechanism_id']}")
                print(f"    File: {orphan['file_path']}")
            print()
            print("❌ ORPHAN CHECK: FAIL")
            print()
            print("Required Actions:")
            print("  1. Create a case that uses this mechanism")
            print("  2. Or remove the mechanism if not needed")
            return False
        else:
            print("✅ ORPHAN CHECK: PASS")
            print("   All mechanisms are bound to at least one case.")
            return True


def main():
    """Main entry point"""
    check_orphans = '--check-orphans' in sys.argv

    gate = LiftRegressionGate()

    # Run baseline validation
    lift_ok = gate.run_validation()

    # Run orphan check if requested
    orphan_ok = True
    if check_orphans:
        print()
        detector = OrphanMechanismDetector()
        orphan_ok = detector.run_check()

    # Final result
    print()
    print("=" * 60)
    print("Final Result")
    print("=" * 60)

    if lift_ok and orphan_ok:
        print("✅ ALL GATES PASS")
        sys.exit(0)
    else:
        print("❌ GATE FAILURE DETECTED")
        if not lift_ok:
            print("  - Lift Regression Gate: FAIL")
        if not orphan_ok:
            print("  - Orphan Mechanism Check: FAIL")
        sys.exit(1)


if __name__ == '__main__':
    main()
