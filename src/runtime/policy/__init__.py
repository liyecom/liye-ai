"""
LiYe OS Runtime Policy Layer

This module provides a priori action adjudication for the AI Operating System.
All actions must pass through the Policy Engine before execution.

Architecture:
    Action -> PolicyEngine.evaluate() -> Decision (ALLOW/DENY)

Non-bypassable. Fail-Close. Auditable.
"""

from .models import Action, Policy, Decision
from .engine import PolicyEngine
from .registry import PolicyRegistry
from .evaluator import PolicyEvaluator
from .exceptions import PolicyDenied, PolicyEvaluationError
from .decision_logger import DecisionLogger

__all__ = [
    "Action",
    "Policy",
    "Decision",
    "PolicyEngine",
    "PolicyRegistry",
    "PolicyEvaluator",
    "PolicyDenied",
    "PolicyEvaluationError",
    "DecisionLogger",
]

__version__ = "0.1.0"
