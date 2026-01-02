"""
TRUTH_DELTA_GATE
================

Constitutional Gate for T2 → T1 Refinement Pipeline

Every candidate T1 knowledge unit MUST answer:
"这条内容新增了什么此前 T1 中不存在的机制/因果关系？"

Rules (HARDCODED - NO EXCEPTIONS):
- truth_delta field is REQUIRED
- Empty → REJECT
- Vague → REJECT
- Boilerplate → REJECT
- NO fallback
- NO auto-fill

Reference: docs/architecture/T1_CANONICAL_DEFINITION.md

# ============================================================================
# FROZEN CONTRACT: ANTI-NOISE CONSTITUTIONAL GATE
# ============================================================================
#
# This gate exists to REJECT content, not to approve it.
# T1 is meant to be scarce. Low pass rates are a FEATURE, not a bug.
#
# Design Philosophy:
#   - T1 = reasoning fuel, not a knowledge base
#   - Every T1 unit must earn its place through mechanism/causality
#   - Quantity is the enemy of quality in T1
#
# PROHIBITED MODIFICATIONS:
#   ❌ Lowering MIN_CHUNK_SIZE or character thresholds
#   ❌ Removing patterns from VAGUE_PATTERNS or BOILERPLATE_PATTERNS
#   ❌ Making MECHANISM_INDICATORS optional
#   ❌ Adding "exception" logic for specific sources
#   ❌ Implementing "best effort" or "partial pass" modes
#   ❌ Auto-generating truth_delta from content
#
# To modify this gate, you MUST follow the constitutional amendment process.
# See: refinement/README.md § TRUTH_DELTA_GATE – Frozen Contract
# ============================================================================
"""

from typing import Dict, Tuple, Optional
from dataclasses import dataclass
from enum import Enum
import re


class RejectionReason(Enum):
    MISSING_FIELD = "truth_delta field is missing"
    EMPTY_VALUE = "truth_delta is empty"
    TOO_SHORT = "truth_delta is too short (< 20 chars)"
    VAGUE_CONTENT = "truth_delta contains vague/generic language"
    BOILERPLATE = "truth_delta is boilerplate/template content"
    NO_MECHANISM = "truth_delta does not describe a mechanism or causality"


@dataclass
class GateResult:
    """Result of TRUTH_DELTA_GATE evaluation"""
    passed: bool
    reason: Optional[RejectionReason] = None
    details: Optional[str] = None


# Vague patterns that indicate non-specific content
VAGUE_PATTERNS = [
    r'^这是关于',
    r'^这篇文章讲述',
    r'^本文介绍',
    r'^概述',
    r'^总结',
    r'^一般来说',
    r'^通常情况下',
    r'^在某些情况下',
    r'^可能会',
    r'^也许',
    r'^或许',
    r'等等$',
    r'之类的$',
    r'^This article',
    r'^This discusses',
    r'^In general',
    r'^Sometimes',
    r'^Usually',
    r'^Perhaps',
    r'^Maybe',
    r'and so on$',
    r'etc\.$',
]

# Boilerplate patterns
BOILERPLATE_PATTERNS = [
    r'^新增了一些内容',
    r'^提供了一些信息',
    r'^包含了相关知识',
    r'^有一些有用的建议',
    r'^分享了经验',
    r'^讨论了相关话题',
    r'^Some new information',
    r'^Contains useful',
    r'^Provides insights',
    r'^Shares experience',
]

# Required mechanism/causality indicators
MECHANISM_INDICATORS = [
    r'因为', r'所以', r'导致', r'引起', r'造成',
    r'当.*时', r'如果.*则', r'若.*就',
    r'会使', r'能够', r'可以通过',
    r'机制', r'原理', r'规律', r'因果',
    r'because', r'therefore', r'causes', r'leads to',
    r'when.*then', r'if.*then', r'results in',
    r'mechanism', r'principle', r'causality',
    r'驱动', r'触发', r'影响', r'决定',
    r'drives', r'triggers', r'affects', r'determines',
]


def validate_truth_delta(truth_delta: Optional[str]) -> GateResult:
    """
    Validate a truth_delta field value.

    This is the core validation logic of TRUTH_DELTA_GATE.

    Args:
        truth_delta: The truth_delta field value to validate

    Returns:
        GateResult indicating pass/fail and reason
    """
    # Rule 1: Field must exist
    if truth_delta is None:
        return GateResult(
            passed=False,
            reason=RejectionReason.MISSING_FIELD,
            details="truth_delta field was not provided"
        )

    # Rule 2: Must not be empty
    cleaned = truth_delta.strip()
    if not cleaned:
        return GateResult(
            passed=False,
            reason=RejectionReason.EMPTY_VALUE,
            details="truth_delta is empty or whitespace only"
        )

    # Rule 3: Must have minimum length (mechanism description needs substance)
    if len(cleaned) < 20:
        return GateResult(
            passed=False,
            reason=RejectionReason.TOO_SHORT,
            details=f"truth_delta has only {len(cleaned)} chars, minimum is 20"
        )

    # Rule 4: Must not be vague
    for pattern in VAGUE_PATTERNS:
        if re.search(pattern, cleaned, re.IGNORECASE):
            return GateResult(
                passed=False,
                reason=RejectionReason.VAGUE_CONTENT,
                details=f"Matched vague pattern: {pattern}"
            )

    # Rule 5: Must not be boilerplate
    for pattern in BOILERPLATE_PATTERNS:
        if re.search(pattern, cleaned, re.IGNORECASE):
            return GateResult(
                passed=False,
                reason=RejectionReason.BOILERPLATE,
                details=f"Matched boilerplate pattern: {pattern}"
            )

    # Rule 6: Must describe a mechanism or causality
    has_mechanism = any(
        re.search(pattern, cleaned, re.IGNORECASE)
        for pattern in MECHANISM_INDICATORS
    )

    if not has_mechanism:
        return GateResult(
            passed=False,
            reason=RejectionReason.NO_MECHANISM,
            details="No mechanism/causality indicators found"
        )

    # All checks passed
    return GateResult(passed=True)


class TruthDeltaGate:
    """
    TRUTH_DELTA_GATE Implementation

    Constitutional gate that enforces T1 quality standards.

    Usage:
        gate = TruthDeltaGate()
        result = gate.evaluate(candidate_unit)
        if not result.passed:
            # Unit stays in T2
            log_rejection(candidate_unit, result.reason)
    """

    # Gate identity
    GATE_NAME = "TRUTH_DELTA_GATE"
    GATE_VERSION = "1.0.0"

    # Constitutional reference
    CONSTITUTIONAL_REF = "docs/architecture/T1_CANONICAL_DEFINITION.md"

    # Configuration (HARDCODED - not configurable)
    FALLBACK_ENABLED = False  # NO FALLBACK
    AUTO_FILL_ENABLED = False  # NO AUTO-FILL

    def __init__(self):
        """Initialize the gate. No configuration allowed."""
        pass

    def evaluate(self, candidate: Dict) -> GateResult:
        """
        Evaluate a candidate knowledge unit for T1 promotion.

        Args:
            candidate: Dict containing at minimum:
                - content: The knowledge unit content
                - truth_delta: The delta statement (REQUIRED)

        Returns:
            GateResult indicating pass/fail
        """
        # Extract truth_delta field
        truth_delta = candidate.get('truth_delta')

        # Run validation
        return validate_truth_delta(truth_delta)

    def process_batch(self, candidates: list) -> Tuple[list, list]:
        """
        Process a batch of candidates.

        Args:
            candidates: List of candidate units

        Returns:
            Tuple of (passed_units, rejected_units_with_reasons)
        """
        passed = []
        rejected = []

        for candidate in candidates:
            result = self.evaluate(candidate)

            if result.passed:
                passed.append(candidate)
            else:
                rejected.append({
                    'unit': candidate,
                    'reason': result.reason.value if result.reason else 'Unknown',
                    'details': result.details
                })

        return passed, rejected

    @classmethod
    def get_schema(cls) -> Dict:
        """
        Return the schema for truth_delta field.

        This schema MUST be applied to T2→T1 refinement output.
        """
        return {
            'truth_delta': {
                'type': 'string',
                'required': True,
                'minLength': 20,
                'description': (
                    'Must answer: "这条内容新增了什么此前 T1 中不存在的机制/因果关系？" '
                    'Must describe a specific mechanism or causal relationship. '
                    'Cannot be empty, vague, or boilerplate.'
                ),
                'validation': 'TRUTH_DELTA_GATE'
            }
        }


# Example usage and testing
if __name__ == '__main__':
    gate = TruthDeltaGate()

    # Test cases
    test_cases = [
        # Should PASS
        {
            'content': 'Amazon广告优化',
            'truth_delta': '当ACoS超过35%时，降低bid 10-15%可以减少无效点击，因为高bid吸引的点击往往转化率较低'
        },
        # Should FAIL - empty
        {
            'content': 'Some content',
            'truth_delta': ''
        },
        # Should FAIL - vague
        {
            'content': 'Some content',
            'truth_delta': '这篇文章讲述了一些Amazon相关的内容'
        },
        # Should FAIL - no mechanism
        {
            'content': 'Some content',
            'truth_delta': 'Amazon是一个电商平台，有很多卖家在上面销售产品'
        },
        # Should PASS
        {
            'content': 'Listing优化',
            'truth_delta': 'Listing主图CTR低于2%会导致A9算法降低排名权重，因为Amazon将低CTR视为用户不感兴趣的信号'
        },
    ]

    print("TRUTH_DELTA_GATE Test Results")
    print("=" * 50)

    for i, case in enumerate(test_cases, 1):
        result = gate.evaluate(case)
        status = "PASS" if result.passed else "FAIL"
        print(f"\nTest {i}: {status}")
        print(f"  truth_delta: {case.get('truth_delta', 'None')[:50]}...")
        if not result.passed:
            print(f"  Reason: {result.reason.value}")
            print(f"  Details: {result.details}")
