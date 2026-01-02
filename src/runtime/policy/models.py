"""
Runtime Policy Data Models

Defines the core data structures for the Policy Engine:
- Action: Represents an operation to be evaluated
- Policy: Defines a rule for action adjudication
- Decision: The result of policy evaluation
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional
import uuid


class DecisionResult(str, Enum):
    """Policy evaluation result."""
    ALLOW = "ALLOW"
    DENY = "DENY"


class PolicySeverity(str, Enum):
    """Policy enforcement severity."""
    ALLOW = "allow"
    DENY = "deny"


@dataclass(frozen=True)
class Action:
    """
    Represents an action to be evaluated by the Policy Engine.

    Attributes:
        id: Unique identifier for this action instance
        type: Action type (e.g., "git.push", "file.write", "tool.execute")
        target: Target of the action (e.g., "refs/heads/main", "/path/to/file")
        metadata: Additional context for policy evaluation
    """
    id: str
    type: str
    target: str
    metadata: dict = field(default_factory=dict)

    @classmethod
    def create(cls, action_type: str, target: str, metadata: Optional[dict] = None) -> "Action":
        """Factory method to create an Action with auto-generated ID."""
        return cls(
            id=str(uuid.uuid4()),
            type=action_type,
            target=target,
            metadata=metadata or {}
        )


@dataclass(frozen=True)
class Policy:
    """
    Represents a policy rule for action adjudication.

    Attributes:
        id: Unique policy identifier (e.g., "POL_001")
        name: Human-readable policy name
        description: Policy purpose and rationale
        severity: "allow" or "deny" - what happens when conditions match
        conditions: Dictionary defining when this policy applies
    """
    id: str
    name: str
    description: str
    severity: PolicySeverity
    conditions: dict = field(default_factory=dict)

    def __post_init__(self):
        if not self.id.startswith("POL_"):
            raise ValueError(f"Policy ID must start with 'POL_': {self.id}")


@dataclass(frozen=True)
class Decision:
    """
    Represents the result of a policy evaluation.

    Attributes:
        decision_id: Unique identifier for this decision
        action_id: ID of the evaluated action
        policy_id: ID of the policy that produced this decision
        result: ALLOW or DENY
        reason: Human-readable explanation
        timestamp: When the decision was made
        suggestion: Optional replan hint for DENY decisions
        alternative: Optional structured hint (e.g., alternative target)
    """
    decision_id: str
    action_id: str
    policy_id: str
    result: DecisionResult
    reason: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    suggestion: Optional[str] = None
    alternative: Optional[Dict[str, Any]] = None

    @classmethod
    def allow(cls, action_id: str, policy_id: str, reason: str) -> "Decision":
        """Create an ALLOW decision."""
        return cls(
            decision_id=str(uuid.uuid4()),
            action_id=action_id,
            policy_id=policy_id,
            result=DecisionResult.ALLOW,
            reason=reason
        )

    @classmethod
    def deny(
        cls,
        action_id: str,
        policy_id: str,
        reason: str,
        suggestion: Optional[str] = None,
        alternative: Optional[Dict[str, Any]] = None,
    ) -> "Decision":
        """Create a DENY decision with optional replan hints."""
        return cls(
            decision_id=str(uuid.uuid4()),
            action_id=action_id,
            policy_id=policy_id,
            result=DecisionResult.DENY,
            reason=reason,
            suggestion=suggestion,
            alternative=alternative,
        )

    def is_denied(self) -> bool:
        """Check if this decision is a denial."""
        return self.result == DecisionResult.DENY

    def to_dict(self) -> dict:
        """Convert decision to dictionary for logging."""
        result = {
            "decision_id": self.decision_id,
            "action_id": self.action_id,
            "policy_id": self.policy_id,
            "result": self.result.value,
            "reason": self.reason,
            "timestamp": self.timestamp.isoformat(),
        }
        if self.suggestion is not None:
            result["suggestion"] = self.suggestion
        if self.alternative is not None:
            result["alternative"] = self.alternative
        return result
