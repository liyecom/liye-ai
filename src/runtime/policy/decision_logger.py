"""
Decision Logger

Provides structured logging for policy decisions.
All decisions are logged in JSON format for auditability.
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Optional

from .models import Action, Decision


# Configure logger
logger = logging.getLogger("liye_os.policy.decisions")


class DecisionLogger:
    """
    Structured decision logger for policy audit trail.

    All decisions are logged in JSON format with full context:
    - decision_id: Unique identifier
    - action_id: ID of the evaluated action
    - action_type: Type of action
    - policy_id: Policy that produced the decision
    - result: ALLOW or DENY
    - reason: Human-readable explanation
    - timestamp: ISO 8601 timestamp
    """

    def __init__(self, log_level: int = logging.INFO):
        """
        Initialize the decision logger.

        Args:
            log_level: Logging level for decisions
        """
        self._log_level = log_level

    def log(self, decision: Decision, action: Action) -> None:
        """
        Log a decision with full context.

        Args:
            decision: The decision to log
            action: The action that was evaluated
        """
        log_entry = self._create_log_entry(decision, action)
        log_json = json.dumps(log_entry, default=str)

        logger.log(self._log_level, log_json)

    def _create_log_entry(self, decision: Decision, action: Action) -> dict:
        """
        Create a structured log entry (contract-compliant).

        Args:
            decision: The decision
            action: The action

        Returns:
            Dictionary suitable for JSON serialization.
            Fields align 1:1 with DecisionContract schema.
        """
        return {
            "log_type": "policy_decision",
            "decision_id": decision.decision_id,
            "action_id": action.id,
            "action_type": action.type,
            "action_target": action.target,
            "action_metadata": action.metadata,
            "policy_id": decision.policy_id,
            # DecisionContract fields (1:1 alignment)
            "result": decision.result.value,
            "reason": decision.reason,
            "suggestion": decision.suggestion,
            "alternative": decision.alternative,
            "severity": decision.severity.value,
            "timestamp": decision.timestamp.isoformat(),
        }

    @staticmethod
    def format_for_humans(decision: Decision, action: Action) -> str:
        """
        Format a decision for human-readable output.

        Args:
            decision: The decision
            action: The action

        Returns:
            Formatted string
        """
        icon = "ALLOWED" if decision.result.value == "ALLOW" else "DENIED"
        lines = [
            f"[POLICY] {icon} (severity={decision.severity.value})",
            f"  Action: {action.type} -> {action.target}",
            f"  Policy: {decision.policy_id}",
            f"  Reason: {decision.reason}",
        ]
        if decision.suggestion:
            lines.append(f"  Suggestion: {decision.suggestion}")
        lines.append(f"  Time: {decision.timestamp.isoformat()}")
        return "\n".join(lines)


class AuditTrail:
    """
    In-memory audit trail for testing and debugging.

    In production, decisions are logged to the standard logger.
    This class provides an in-memory buffer for testing.
    """

    def __init__(self, max_entries: int = 1000):
        """
        Initialize the audit trail.

        Args:
            max_entries: Maximum number of entries to retain
        """
        self._entries: list = []
        self._max_entries = max_entries

    def record(self, decision: Decision, action: Action) -> None:
        """Record a decision (contract-compliant)."""
        entry = {
            "decision_id": decision.decision_id,
            "action_id": action.id,
            "action_type": action.type,
            "action_target": action.target,
            "policy_id": decision.policy_id,
            # DecisionContract fields (1:1 alignment)
            "result": decision.result.value,
            "reason": decision.reason,
            "suggestion": decision.suggestion,
            "alternative": decision.alternative,
            "severity": decision.severity.value,
            "timestamp": decision.timestamp,
        }
        self._entries.append(entry)

        # Trim if over limit
        if len(self._entries) > self._max_entries:
            self._entries = self._entries[-self._max_entries:]

    def get_all(self) -> list:
        """Get all recorded entries."""
        return self._entries.copy()

    def get_denied(self) -> list:
        """Get all DENY decisions."""
        return [e for e in self._entries if e["result"] == "DENY"]

    def get_by_policy(self, policy_id: str) -> list:
        """Get decisions by policy ID."""
        return [e for e in self._entries if e["policy_id"] == policy_id]

    def clear(self) -> None:
        """Clear all entries."""
        self._entries.clear()

    def __len__(self) -> int:
        return len(self._entries)
