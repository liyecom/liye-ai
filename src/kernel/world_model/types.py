"""
World Model Result Contract - LiYe OS v6.2.0

Defines the WorldModelResult schema and validation logic.
This is the SSOT for what constitutes a valid world model output.
"""

from typing import Any, TypedDict, Literal
from datetime import datetime
import re

WORLD_MODEL_VERSION = "v1"

# Valid level values for T2 dimensions
VALID_LEVELS = {"low", "medium", "high"}

# Valid T3 dynamic types
VALID_DYNAMIC_TYPES = {"acceleration", "amplification", "phase_transition"}


class ValidationError(Exception):
    """Raised when WorldModelResult validation fails."""

    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__(f"World Model validation failed: {'; '.join(errors)}")


class WorldModelInvalidError(Exception):
    """
    Raised when World Model Gate produces an invalid result.

    This error indicates a serious structural problem that blocks execution.
    Unlike ValidationError which lists specific field issues, this is the
    canonical error to catch in domain entry points.
    """

    def __init__(self, message: str, errors: list[str] | None = None):
        self.errors = errors or []
        self.message = message
        super().__init__(message)

    @classmethod
    def from_validation(cls, errors: list[str]) -> "WorldModelInvalidError":
        """Create from validation error list."""
        return cls(
            f"World Model invalid: {len(errors)} validation error(s)",
            errors=errors
        )


class T2Dimension(TypedDict):
    """A single T2 dimension (liquidity, correlation, etc.)"""
    level: Literal["low", "medium", "high"]
    evidence: list[str]
    gaps: list[str]


class T3Dynamic(TypedDict):
    """A single T3 dynamic pattern"""
    type: Literal["acceleration", "amplification", "phase_transition"]
    conditions: list[str]
    early_signals: list[str]


class WorldModelResult(TypedDict):
    """
    The complete World Model output schema.

    Every domain execution must produce this before proceeding.
    Missing or invalid fields will block execution.
    """
    version: str
    domain: str
    task: str
    t1: dict  # failure_modes, key_assumptions, stop_signals, not_telling_you
    t2: dict  # liquidity, correlation, expectation, leverage, uncertainty
    t3: dict  # dynamics list
    allowed_actions: dict  # allowed, not_allowed
    audit: dict  # inputs_summary, data_sources, generated_at, trace_id


def _check_list_min(data: dict, path: str, key: str, min_count: int, errors: list[str]) -> None:
    """Check that a list field exists and has minimum items."""
    if key not in data:
        errors.append(f"{path}.{key}: missing required field")
        return

    val = data[key]
    if not isinstance(val, list):
        errors.append(f"{path}.{key}: must be a list, got {type(val).__name__}")
        return

    if len(val) < min_count:
        errors.append(f"{path}.{key}: requires >= {min_count} items, got {len(val)}")


def _check_str_required(data: dict, path: str, key: str, errors: list[str]) -> None:
    """Check that a string field exists and is non-empty."""
    if key not in data:
        errors.append(f"{path}.{key}: missing required field")
        return

    val = data[key]
    if not isinstance(val, str):
        errors.append(f"{path}.{key}: must be a string, got {type(val).__name__}")
        return

    if not val.strip():
        errors.append(f"{path}.{key}: cannot be empty")


def _validate_t1(t1: Any, errors: list[str]) -> None:
    """Validate T1 section (failure modes, assumptions, signals)."""
    if not isinstance(t1, dict):
        errors.append("t1: must be a dict")
        return

    _check_list_min(t1, "t1", "failure_modes", 3, errors)
    _check_list_min(t1, "t1", "key_assumptions", 2, errors)
    _check_list_min(t1, "t1", "stop_signals", 2, errors)
    _check_list_min(t1, "t1", "not_telling_you", 2, errors)


def _validate_t2_dimension(dim: Any, name: str, errors: list[str]) -> None:
    """Validate a single T2 dimension."""
    path = f"t2.{name}"

    if not isinstance(dim, dict):
        errors.append(f"{path}: must be a dict")
        return

    # Check level
    if "level" not in dim:
        errors.append(f"{path}.level: missing required field")
    elif dim["level"] not in VALID_LEVELS:
        errors.append(f"{path}.level: must be one of {VALID_LEVELS}, got '{dim['level']}'")

    _check_list_min(dim, path, "evidence", 1, errors)
    _check_list_min(dim, path, "gaps", 1, errors)


def _validate_t2(t2: Any, errors: list[str]) -> None:
    """Validate T2 section (state dimensions)."""
    if not isinstance(t2, dict):
        errors.append("t2: must be a dict")
        return

    required_dimensions = ["liquidity", "correlation", "expectation", "leverage", "uncertainty"]
    for dim_name in required_dimensions:
        if dim_name not in t2:
            errors.append(f"t2.{dim_name}: missing required dimension")
        else:
            _validate_t2_dimension(t2[dim_name], dim_name, errors)


def _validate_t3_dynamic(dynamic: Any, index: int, errors: list[str]) -> None:
    """Validate a single T3 dynamic pattern."""
    path = f"t3.dynamics[{index}]"

    if not isinstance(dynamic, dict):
        errors.append(f"{path}: must be a dict")
        return

    # Check type
    if "type" not in dynamic:
        errors.append(f"{path}.type: missing required field")
    elif dynamic["type"] not in VALID_DYNAMIC_TYPES:
        errors.append(f"{path}.type: must be one of {VALID_DYNAMIC_TYPES}, got '{dynamic['type']}'")

    _check_list_min(dynamic, path, "conditions", 1, errors)
    _check_list_min(dynamic, path, "early_signals", 2, errors)


def _validate_t3(t3: Any, errors: list[str]) -> None:
    """Validate T3 section (dynamics/patterns)."""
    if not isinstance(t3, dict):
        errors.append("t3: must be a dict")
        return

    if "dynamics" not in t3:
        errors.append("t3.dynamics: missing required field")
        return

    dynamics = t3["dynamics"]
    if not isinstance(dynamics, list):
        errors.append("t3.dynamics: must be a list")
        return

    if len(dynamics) < 1:
        errors.append("t3.dynamics: requires >= 1 items")
        return

    for i, dynamic in enumerate(dynamics):
        _validate_t3_dynamic(dynamic, i, errors)


def _validate_allowed_actions(actions: Any, errors: list[str]) -> None:
    """Validate allowed_actions section."""
    if not isinstance(actions, dict):
        errors.append("allowed_actions: must be a dict")
        return

    _check_list_min(actions, "allowed_actions", "allowed", 3, errors)
    _check_list_min(actions, "allowed_actions", "not_allowed", 3, errors)


def _validate_audit(audit: Any, errors: list[str]) -> None:
    """Validate audit section."""
    if not isinstance(audit, dict):
        errors.append("audit: must be a dict")
        return

    _check_str_required(audit, "audit", "inputs_summary", errors)
    _check_list_min(audit, "audit", "data_sources", 1, errors)
    _check_str_required(audit, "audit", "generated_at", errors)
    _check_str_required(audit, "audit", "trace_id", errors)

    # Validate ISO datetime format
    if "generated_at" in audit and isinstance(audit["generated_at"], str):
        try:
            # Accept ISO format with or without timezone
            datetime.fromisoformat(audit["generated_at"].replace("Z", "+00:00"))
        except ValueError:
            errors.append("audit.generated_at: must be ISO datetime format")


def validate_world_model_result(result: Any) -> list[str]:
    """
    Validate a WorldModelResult dict.

    Returns a list of validation errors (empty if valid).
    Raises ValidationError if called with raise_on_error=True.

    Args:
        result: The WorldModelResult dict to validate

    Returns:
        List of error messages (empty if valid)
    """
    errors: list[str] = []

    if not isinstance(result, dict):
        return ["result: must be a dict"]

    # Top-level required fields
    if result.get("version") != WORLD_MODEL_VERSION:
        errors.append(f"version: must be '{WORLD_MODEL_VERSION}', got '{result.get('version')}'")

    _check_str_required(result, "", "domain", errors)
    _check_str_required(result, "", "task", errors)

    # Nested sections
    if "t1" not in result:
        errors.append("t1: missing required section")
    else:
        _validate_t1(result["t1"], errors)

    if "t2" not in result:
        errors.append("t2: missing required section")
    else:
        _validate_t2(result["t2"], errors)

    if "t3" not in result:
        errors.append("t3: missing required section")
    else:
        _validate_t3(result["t3"], errors)

    if "allowed_actions" not in result:
        errors.append("allowed_actions: missing required section")
    else:
        _validate_allowed_actions(result["allowed_actions"], errors)

    if "audit" not in result:
        errors.append("audit: missing required section")
    else:
        _validate_audit(result["audit"], errors)

    return errors


def validate_or_raise(result: Any) -> WorldModelResult:
    """
    Validate a WorldModelResult and raise ValidationError if invalid.

    Args:
        result: The WorldModelResult dict to validate

    Returns:
        The validated result (typed)

    Raises:
        ValidationError: If validation fails
    """
    errors = validate_world_model_result(result)
    if errors:
        raise ValidationError(errors)
    return result
