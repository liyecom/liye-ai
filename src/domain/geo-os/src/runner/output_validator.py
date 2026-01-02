"""
Output Validator
================

Validates LLM outputs for determinism and schema compliance.

Validation Rules:
1. JSON Schema validation
2. Missing field → FAIL
3. Extra field → FAIL
4. Non-schema content → FAIL
5. Hash mismatch → FAIL

Reference: docs/architecture/P2_DETERMINISTIC_LLM_RUNNER.md
"""

import json
import hashlib
from dataclasses import dataclass
from typing import Dict, Any, Optional, List, Tuple
from enum import Enum

from .execution_contract import OutputContract, ContractViolation


class ValidationResult(Enum):
    """Validation result status"""
    PASS = "PASS"
    FAIL = "FAIL"


@dataclass
class ValidationReport:
    """Detailed validation report"""
    result: ValidationResult
    output_hash: Optional[str]
    errors: List[str]
    warnings: List[str]
    validated_output: Optional[OutputContract]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "result": self.result.value,
            "output_hash": self.output_hash,
            "errors": self.errors,
            "warnings": self.warnings,
            "validated_output": self.validated_output.to_dict() if self.validated_output else None
        }


class OutputValidator:
    """
    Validates LLM outputs for determinism and correctness.

    This is the ONLY validator for LLM outputs.
    All validation logic must go through this class.
    """

    # Free text patterns that indicate non-deterministic output
    FREE_TEXT_PATTERNS = [
        "I think",
        "I believe",
        "In my opinion",
        "Based on my analysis",
        "Let me explain",
        "Here's what I suggest",
        "You should consider",
        "It seems",
        "Perhaps",
        "Maybe",
        "Probably",
        "综上所述",
        "根据我的分析",
        "我认为",
        "建议你",
    ]

    def __init__(self, strict_mode: bool = True):
        """
        Initialize validator.

        Args:
            strict_mode: If True, extra fields cause FAIL
        """
        self.strict_mode = strict_mode

    def compute_hash(self, output: Dict[str, Any]) -> str:
        """
        Compute deterministic hash of output.

        Uses canonical JSON serialization for reproducibility.
        """
        # Canonical serialization: sorted keys, no whitespace variance
        canonical = json.dumps(output, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
        return hashlib.sha256(canonical.encode('utf-8')).hexdigest()

    def check_free_text(self, raw_output: str) -> List[str]:
        """
        Check for free text patterns in raw output.

        Returns list of found patterns (should be empty for valid output).
        """
        found = []
        raw_lower = raw_output.lower()

        for pattern in self.FREE_TEXT_PATTERNS:
            if pattern.lower() in raw_lower:
                found.append(pattern)

        return found

    def parse_json(self, raw_output: str) -> Tuple[Optional[Dict], Optional[str]]:
        """
        Parse JSON from raw LLM output.

        Returns:
            Tuple of (parsed_dict, error_message)
        """
        # Strip any markdown code blocks
        cleaned = raw_output.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            parsed = json.loads(cleaned)
            return parsed, None
        except json.JSONDecodeError as e:
            return None, f"JSON parse error: {str(e)}"

    def validate(self, raw_output: str) -> ValidationReport:
        """
        Validate LLM output.

        Performs:
        1. Free text detection
        2. JSON parsing
        3. Schema validation
        4. Hash computation

        Returns:
            ValidationReport with result and details
        """
        errors = []
        warnings = []
        output_hash = None
        validated_output = None

        # Step 1: Check for free text
        free_text_found = self.check_free_text(raw_output)
        if free_text_found:
            errors.append(f"Free text patterns detected: {free_text_found}")

        # Step 2: Parse JSON
        parsed, parse_error = self.parse_json(raw_output)
        if parse_error:
            errors.append(parse_error)
            return ValidationReport(
                result=ValidationResult.FAIL,
                output_hash=None,
                errors=errors,
                warnings=warnings,
                validated_output=None
            )

        # Step 3: Compute hash
        output_hash = self.compute_hash(parsed)

        # Step 4: Schema validation via contract
        try:
            validated_output = OutputContract.from_dict(parsed)
        except ContractViolation as e:
            errors.append(str(e))

        # Determine result
        result = ValidationResult.PASS if not errors else ValidationResult.FAIL

        return ValidationReport(
            result=result,
            output_hash=output_hash,
            errors=errors,
            warnings=warnings,
            validated_output=validated_output
        )

    def verify_hash(self, output: Dict[str, Any], expected_hash: str) -> bool:
        """
        Verify output hash matches expected.

        Used for reproducibility verification.
        """
        actual_hash = self.compute_hash(output)
        return actual_hash == expected_hash

    def compare_outputs(
        self,
        output1: Dict[str, Any],
        output2: Dict[str, Any]
    ) -> Tuple[bool, List[str]]:
        """
        Compare two outputs for equality.

        Returns:
            Tuple of (are_equal, list of differences)
        """
        hash1 = self.compute_hash(output1)
        hash2 = self.compute_hash(output2)

        if hash1 == hash2:
            return True, []

        # Find differences
        differences = []
        all_keys = set(output1.keys()) | set(output2.keys())

        for key in all_keys:
            val1 = output1.get(key)
            val2 = output2.get(key)
            if val1 != val2:
                differences.append(f"{key}: {val1} != {val2}")

        return False, differences


def validate_runner_output(raw_output: str, strict: bool = True) -> ValidationReport:
    """
    Convenience function for validating runner output.

    This is the main entry point for output validation.
    """
    validator = OutputValidator(strict_mode=strict)
    return validator.validate(raw_output)
