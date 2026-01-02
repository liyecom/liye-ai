"""
P3.3 Decision Replay Test

Proves: Decision is a stable system output, independent of execution context.
Contract can be replayed and verified without Planner.
"""

import json
import os
from pathlib import Path

from src.runtime.policy import PolicyEngine, Action


FIXTURES_DIR = Path(__file__).parent / "fixtures" / "decisions"


def load_fixture(name: str) -> dict:
    """Load a decision fixture."""
    with open(FIXTURES_DIR / name) as f:
        return json.load(f)


def test_deny_decision_replay():
    """
    Replay a DENY decision and verify contract consistency.

    Proves: Same action → Same decision (deterministic).
    """
    fixture = load_fixture("deny_governance_write.json")
    engine = PolicyEngine()

    # Recreate action from fixture
    action = Action.create(
        action_type=fixture["action"]["type"],
        target=fixture["action"]["target"],
        metadata=fixture["action"].get("metadata", {}),
    )

    # Evaluate and get contract
    decision = engine.evaluate(action)
    contract = decision.to_contract()

    # Verify contract matches expected
    expected = fixture["expected_contract"]
    assert contract["result"] == expected["result"]
    assert contract["severity"] == expected["severity"]
    assert contract["suggestion"] is not None
    assert expected["reason"] in decision.policy_id


def test_allow_decision_replay():
    """
    Replay an ALLOW decision and verify contract consistency.

    Proves: Safe operations produce soft severity.
    """
    fixture = load_fixture("allow_safe_read.json")
    engine = PolicyEngine()

    # Recreate action from fixture
    action = Action.create(
        action_type=fixture["action"]["type"],
        target=fixture["action"]["target"],
        metadata=fixture["action"].get("metadata", {}),
    )

    # Evaluate and get contract
    decision = engine.evaluate(action)
    contract = decision.to_contract()

    # Verify contract matches expected
    expected = fixture["expected_contract"]
    assert contract["result"] == expected["result"]
    assert contract["severity"] == expected["severity"]


def test_contract_is_json_serializable():
    """
    Verify contract can be serialized to JSON.

    Proves: Contract is portable, can be stored/transmitted.
    """
    engine = PolicyEngine()
    action = Action.create(
        action_type="file.read",
        target="/tmp/test.txt",
        metadata={"tool_name": "read"},
    )

    decision = engine.evaluate(action)
    contract = decision.to_contract()

    # Should not raise
    json_str = json.dumps(contract)
    parsed = json.loads(json_str)

    assert parsed["result"] == contract["result"]
    assert parsed["severity"] == contract["severity"]
