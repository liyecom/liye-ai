"""
P3.3 Human-Consumable Contract Test

Proves: Contract is the OS interface to humans.
Even without Agent, without Planner, Contract alone is sufficient
for human decision-making.
"""

from src.runtime.policy import PolicyEngine, Action


def test_contract_is_human_actionable():
    """
    Verify contract fields are human-interpretable.

    Proves: Human can make decisions based on contract alone.
    """
    engine = PolicyEngine()

    action = Action.create(
        action_type="file.write",
        target=".github/workflows/ci.yml",
        metadata={"tool_name": "write"},
    )

    decision = engine.evaluate(action)
    contract = decision.to_contract()

    # Human judgment criteria (not machine)
    assert contract["result"] in ("ALLOW", "DENY")
    assert isinstance(contract["reason"], str)
    assert contract["severity"] in ("soft", "hard")

    # DENY must have actionable suggestion
    if contract["result"] == "DENY":
        assert contract["suggestion"] is not None
        assert isinstance(contract["suggestion"], str)
        assert len(contract["suggestion"]) > 0


def test_contract_reason_is_descriptive():
    """
    Verify reason field provides useful information.

    Proves: Human can understand WHY without reading code.
    """
    engine = PolicyEngine()

    action = Action.create(
        action_type="git.push",
        target="refs/heads/main",
        metadata={"tool_name": "bash"},
    )

    decision = engine.evaluate(action)

    # Reason should be descriptive
    assert len(decision.reason) > 10  # Not just "DENIED"
    assert "POL_" in decision.policy_id or "Policy" in decision.reason


def test_severity_guides_human_action():
    """
    Verify severity clearly indicates required human action.

    Proves: Human knows whether action is mandatory or optional.
    """
    engine = PolicyEngine()

    # DENY action
    deny_action = Action.create(
        action_type="file.write",
        target="src/runtime/policy/models.py",
        metadata={"tool_name": "write"},
    )

    # ALLOW action
    allow_action = Action.create(
        action_type="file.read",
        target="/tmp/test.txt",
        metadata={"tool_name": "read"},
    )

    deny_contract = engine.evaluate(deny_action).to_contract()
    allow_contract = engine.evaluate(allow_action).to_contract()

    # Severity meanings are clear
    assert deny_contract["severity"] == "hard"  # MUST replan
    assert allow_contract["severity"] == "soft"  # MAY proceed


def test_suggestion_is_natural_language():
    """
    Verify suggestion is human-readable, not code.

    Proves: No technical jargon required to understand next steps.
    """
    engine = PolicyEngine()

    action = Action.create(
        action_type="git.push",
        target="refs/heads/main",
        metadata={"tool_name": "bash"},
    )

    decision = engine.evaluate(action)

    if decision.suggestion:
        # Should be natural language
        assert not decision.suggestion.startswith("{")  # Not JSON
        assert not decision.suggestion.startswith("def ")  # Not code
        assert " " in decision.suggestion  # Has spaces (natural language)


def test_contract_is_self_contained():
    """
    Verify contract contains all info needed for human decision.

    Proves: No external lookup required.
    """
    engine = PolicyEngine()

    action = Action.create(
        action_type="tool.execute",
        target="/any/path",
        metadata={"tool_name": "rm"},
    )

    decision = engine.evaluate(action)
    contract = decision.to_contract()

    # All required fields present
    required_fields = ["result", "reason", "suggestion", "alternative", "severity"]
    for field in required_fields:
        assert field in contract, f"Missing field: {field}"

    # Human can act on this alone
    if contract["result"] == "DENY":
        # Suggestion tells what to do
        assert contract["suggestion"] is not None
        # Severity tells how urgent
        assert contract["severity"] == "hard"
