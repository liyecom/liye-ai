"""
Policy Evaluator

Evaluates actions against individual policies.

CONSTRAINTS:
- Evaluator has NO side effects
- Evaluator does NOT access external systems
- Evaluator is deterministic given the same inputs
"""

import re
from typing import Any, Dict, Optional, Tuple

from .models import Action, Policy, Decision, PolicySeverity
from .exceptions import PolicyEvaluationError


# Policy → Suggestion mapping (Replan Hints)
# These hints guide re-planning without prescribing specific actions.
POLICY_SUGGESTIONS: Dict[str, Tuple[str, Optional[Dict[str, Any]]]] = {
    "POL_001_branch_scope": (
        "Create a feature/* branch and open a PR",
        {"target_pattern": "refs/heads/feature/*"},
    ),
    "POL_002_file_class": (
        "Move change to non-governance path",
        {"excluded_paths": [".github/workflows/"]},
    ),
    "POL_003_policy_immutability": (
        "Policy layer is immutable; modify via governance process",
        None,
    ),
    "POL_004_tool_allowlist": (
        "Use an allowed tool or request approval",
        {"allowed_tools": ["read", "write", "edit", "glob", "grep", "bash", "web_fetch", "web_search", "todo_write", "ask_user"]},
    ),
    "POL_005_rate_guard": (
        "Retry after rate window resets",
        {"rate_limit": 60, "window": "1 minute"},
    ),
    "POL_006_fail_close": (
        "Action denied due to system safety fallback",
        None,
    ),
}


class PolicyEvaluator:
    """
    Evaluates an Action against a Policy to produce a Decision.

    The evaluator is stateless and pure - no side effects.
    """

    def evaluate(self, action: Action, policy: Policy) -> Optional[Decision]:
        """
        Evaluate an action against a policy.

        Args:
            action: The action to evaluate
            policy: The policy to apply

        Returns:
            Decision if the policy conditions are met, None otherwise

        Raises:
            PolicyEvaluationError: If evaluation fails
        """
        try:
            conditions_met = self._check_conditions(action, policy.conditions)

            if not conditions_met:
                return None

            # Conditions are met - return decision based on severity
            if policy.severity == PolicySeverity.DENY:
                # Inject replan hints from suggestion mapping
                suggestion, alternative = self._get_replan_hint(policy.id)
                return Decision.deny(
                    action_id=action.id,
                    policy_id=policy.id,
                    reason=f"Policy {policy.name}: {policy.description}",
                    suggestion=suggestion,
                    alternative=alternative,
                )
            else:
                return Decision.allow(
                    action_id=action.id,
                    policy_id=policy.id,
                    reason=f"Policy {policy.name}: conditions met, action allowed"
                )

        except Exception as e:
            raise PolicyEvaluationError(
                f"Failed to evaluate policy {policy.id}: {e}",
                policy_id=policy.id,
                cause=e
            )

    def _get_replan_hint(self, policy_id: str) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        """
        Get replan hint for a policy.

        Args:
            policy_id: The policy ID

        Returns:
            Tuple of (suggestion, alternative)
        """
        if policy_id in POLICY_SUGGESTIONS:
            return POLICY_SUGGESTIONS[policy_id]
        return (None, None)

    def _check_conditions(self, action: Action, conditions: dict) -> bool:
        """
        Check if action matches policy conditions.

        Supports the following condition types:
        - action_type: Match action type
        - target_equals: Exact target match
        - target_contains: Substring match in target
        - target_pattern: Regex pattern match
        - metadata_key: Check metadata key existence
        - metadata_value: Check metadata value
        - metadata_gt: Check metadata value > threshold

        Args:
            action: The action to check
            conditions: Dictionary of conditions

        Returns:
            True if all conditions are met
        """
        if not conditions:
            return False

        for condition_type, condition_value in conditions.items():
            if not self._check_single_condition(action, condition_type, condition_value):
                return False

        return True

    def _check_single_condition(self, action: Action, condition_type: str, condition_value) -> bool:
        """
        Check a single condition against the action.

        Args:
            action: The action to check
            condition_type: Type of condition
            condition_value: Value to check against

        Returns:
            True if condition is met
        """
        if condition_type == "action_type":
            return action.type == condition_value

        elif condition_type == "action_type_prefix":
            return action.type.startswith(condition_value)

        elif condition_type == "target_equals":
            return action.target == condition_value

        elif condition_type == "target_contains":
            return condition_value in action.target

        elif condition_type == "target_pattern":
            return bool(re.search(condition_value, action.target))

        elif condition_type == "metadata_key":
            return condition_value in action.metadata

        elif condition_type == "metadata_value":
            key = condition_value.get("key")
            value = condition_value.get("value")
            return action.metadata.get(key) == value

        elif condition_type == "metadata_gt":
            key = condition_value.get("key")
            threshold = condition_value.get("threshold")
            actual = action.metadata.get(key, 0)
            return actual > threshold

        elif condition_type == "metadata_in_list":
            key = condition_value.get("key")
            allowed = condition_value.get("allowed", [])
            actual = action.metadata.get(key)
            return actual in allowed

        elif condition_type == "metadata_not_in_list":
            key = condition_value.get("key")
            allowed = condition_value.get("allowed", [])
            actual = action.metadata.get(key)
            return actual not in allowed

        elif condition_type == "always":
            return condition_value is True

        else:
            # Unknown condition type - conservative approach: don't match
            return False
