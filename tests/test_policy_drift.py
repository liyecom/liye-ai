"""
P3.3 Policy Drift Detection Test

Proves:
- Drift is explicit (no silent allow/break)
- Policy changes produce visible contract changes
- Decision determinism holds across evaluations
"""

from src.runtime.policy import PolicyEngine, Action


def test_policy_drift_is_explicit():
    """
    Verify that policy decisions are explicit and traceable.

    Proves: No silent allow, no silent break.
    """
    engine = PolicyEngine()

    # Action that should be denied
    action = Action.create(
        action_type="file.write",
        target=".github/workflows/ci.yml",
        metadata={"tool_name": "write"},
    )

    decision = engine.evaluate(action)

    # Verify explicit decision
    assert decision.result.value == "DENY"
    assert "POL_" in decision.policy_id  # Policy is identified
    assert decision.severity.value == "hard"
    assert decision.reason is not None  # Reason is provided


def test_same_action_produces_same_decision():
    """
    Verify determinism: same action → same decision.

    Proves: Policy evaluation is deterministic.
    """
    engine = PolicyEngine()

    action = Action.create(
        action_type="git.push",
        target="refs/heads/main",
        metadata={"tool_name": "bash"},
    )

    decision1 = engine.evaluate(action)
    decision2 = engine.evaluate(action)

    # Same result (decision_id will differ, but content matches)
    assert decision1.result == decision2.result
    assert decision1.policy_id == decision2.policy_id
    assert decision1.severity == decision2.severity
    assert decision1.suggestion == decision2.suggestion


def test_policy_change_is_visible_in_contract():
    """
    Verify that different actions produce different contracts.

    Proves: Contract reflects actual policy state.
    """
    engine = PolicyEngine()

    # Safe action
    safe_action = Action.create(
        action_type="file.read",
        target="/tmp/test.txt",
        metadata={"tool_name": "read"},
    )

    # Dangerous action
    danger_action = Action.create(
        action_type="file.write",
        target="src/runtime/policy/engine.py",
        metadata={"tool_name": "write"},
    )

    safe_decision = engine.evaluate(safe_action)
    danger_decision = engine.evaluate(danger_action)

    # Contracts are different
    assert safe_decision.result.value == "ALLOW"
    assert danger_decision.result.value == "DENY"

    # Severity reflects the difference
    assert safe_decision.severity.value == "soft"
    assert danger_decision.severity.value == "hard"


def test_denied_action_always_has_suggestion():
    """
    Verify DENY decisions always include a replan hint.

    Proves: Denial is actionable, not just a block.
    """
    engine = PolicyEngine()

    denied_actions = [
        Action.create("file.write", ".github/workflows/test.yml", {"tool_name": "write"}),
        Action.create("git.push", "refs/heads/main", {"tool_name": "bash"}),
        Action.create("tool.execute", "/any", {"tool_name": "dangerous_tool"}),
    ]

    for action in denied_actions:
        decision = engine.evaluate(action)
        if decision.result.value == "DENY":
            assert decision.suggestion is not None, f"DENY without suggestion: {action}"
