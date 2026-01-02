"""
Runtime Policy Exceptions

Defines exceptions for policy evaluation and enforcement.
All exceptions result in action denial (Fail-Close principle).
"""

from typing import Optional


class PolicyError(Exception):
    """Base exception for all policy-related errors."""

    def __init__(self, message: str, policy_id: Optional[str] = None):
        self.message = message
        self.policy_id = policy_id
        super().__init__(self.message)


class PolicyDenied(PolicyError):
    """
    Raised when an action is denied by a policy.

    This is an expected outcome when policy conditions are met.
    """

    def __init__(self, message: str, policy_id: str, action_id: str):
        self.action_id = action_id
        super().__init__(message, policy_id)

    def __str__(self) -> str:
        return f"PolicyDenied[{self.policy_id}]: {self.message} (action={self.action_id})"


class PolicyEvaluationError(PolicyError):
    """
    Raised when policy evaluation encounters an unexpected error.

    Per Fail-Close principle, this results in action denial.
    """

    def __init__(self, message: str, policy_id: Optional[str] = None, cause: Optional[Exception] = None):
        self.cause = cause
        super().__init__(message, policy_id)

    def __str__(self) -> str:
        base = f"PolicyEvaluationError"
        if self.policy_id:
            base += f"[{self.policy_id}]"
        base += f": {self.message}"
        if self.cause:
            base += f" (caused by: {self.cause})"
        return base


class PolicyRegistryError(PolicyError):
    """
    Raised when there's an error loading or accessing the policy registry.

    Per Fail-Close principle, this prevents all actions.
    """

    def __init__(self, message: str):
        super().__init__(message, policy_id=None)


class PolicyValidationError(PolicyError):
    """
    Raised when a policy definition is invalid.

    Invalid policies cannot be loaded into the registry.
    """

    def __init__(self, message: str, policy_id: Optional[str] = None):
        super().__init__(message, policy_id)


class FailCloseError(PolicyError):
    """
    Raised when fail-close is triggered due to system error.

    Any unexpected exception during evaluation triggers this.
    """

    def __init__(self, message: str, original_error: Exception):
        self.original_error = original_error
        super().__init__(message, policy_id="POL_006_fail_close")

    def __str__(self) -> str:
        return f"FailCloseError: {self.message} (original: {type(self.original_error).__name__})"
