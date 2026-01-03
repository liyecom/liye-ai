"""
World Model Gate - LiYe OS v6.2.0

This module enforces World Model generation before any domain execution.
Every domain task must generate T1/T2/T3 analysis before proceeding.

Note: Domain-specific implementations have been migrated to private repositories.
"""

from .types import (
    WorldModelResult,
    ValidationError,
    WorldModelInvalidError,
    validate_world_model_result,
    WORLD_MODEL_VERSION,
)
from .runner import run_world_model, WORLD_MODEL_REQUIRED

__all__ = [
    "WorldModelResult",
    "ValidationError",
    "WorldModelInvalidError",
    "validate_world_model_result",
    "run_world_model",
    "WORLD_MODEL_VERSION",
    "WORLD_MODEL_REQUIRED",
]
