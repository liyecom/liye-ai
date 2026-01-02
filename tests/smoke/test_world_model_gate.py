"""
World Model Gate Smoke Tests - LiYe OS v6.2.0
==============================================

These tests verify that the World Model Gate:
1. Generates valid T1/T2/T3 analysis
2. Writes trace JSON and report MD files
3. Fails properly when validation errors occur
4. Blocks execution without a valid WorldModelResult

Run:
    pytest tests/smoke/test_world_model_gate.py -v
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime
from unittest.mock import patch, MagicMock

import pytest

# Add repo root to path
REPO_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(REPO_ROOT))


class TestWorldModelGatePositive:
    """Test cases for normal (happy path) World Model Gate operation."""

    def test_run_world_model_returns_valid_result(self):
        """A) run_world_model should return a valid WorldModelResult."""
        from src.kernel.world_model import run_world_model, validate_world_model_result

        result, trace_path, artifact_path = run_world_model(
            domain="amazon-growth",
            task="Test task: verify world model generation",
            context={"user_input": "test input"},
        )

        # Validate result
        errors = validate_world_model_result(result)
        assert errors == [], f"Validation errors: {errors}"

        # Check structure
        assert result["version"] == "v1"
        assert result["domain"] == "amazon-growth"
        assert "t1" in result
        assert "t2" in result
        assert "t3" in result
        assert "allowed_actions" in result
        assert "audit" in result

    def test_trace_file_generated(self):
        """A) Trace JSON file should be generated."""
        from src.kernel.world_model import run_world_model

        result, trace_path, artifact_path = run_world_model(
            domain="amazon-growth",
            task="Test task: verify trace generation",
        )

        assert trace_path.exists(), f"Trace file not found: {trace_path}"
        assert trace_path.suffix == ".json"

        # Verify JSON content
        with open(trace_path) as f:
            trace_data = json.load(f)

        assert trace_data["version"] == "v1"
        assert trace_data["domain"] == "amazon-growth"

    def test_artifact_file_generated(self):
        """A) Report MD file should be generated."""
        from src.kernel.world_model import run_world_model

        result, trace_path, artifact_path = run_world_model(
            domain="amazon-growth",
            task="Test task: verify artifact generation",
        )

        assert artifact_path.exists(), f"Artifact file not found: {artifact_path}"
        assert artifact_path.suffix == ".md"

        # Verify content
        content = artifact_path.read_text()
        assert "World Model Report" in content
        assert "T1:" in content or "Failure Modes" in content
        assert "allowed" in content.lower()
        assert "not allowed" in content.lower()

    def test_failure_modes_count(self):
        """A) WorldModelResult should have >= 3 failure modes."""
        from src.kernel.world_model import run_world_model

        result, _, _ = run_world_model(
            domain="amazon-growth",
            task="Test task",
        )

        failure_modes = result["t1"]["failure_modes"]
        assert len(failure_modes) >= 3, f"Expected >= 3 failure modes, got {len(failure_modes)}"

    def test_not_telling_you_count(self):
        """A) WorldModelResult should have >= 2 not_telling_you items."""
        from src.kernel.world_model import run_world_model

        result, _, _ = run_world_model(
            domain="amazon-growth",
            task="Test task",
        )

        not_telling_you = result["t1"]["not_telling_you"]
        assert len(not_telling_you) >= 2, f"Expected >= 2 not_telling_you, got {len(not_telling_you)}"

    def test_allowed_actions_count(self):
        """A) WorldModelResult should have >= 3 allowed and >= 3 not_allowed."""
        from src.kernel.world_model import run_world_model

        result, _, _ = run_world_model(
            domain="amazon-growth",
            task="Test task",
        )

        allowed = result["allowed_actions"]["allowed"]
        not_allowed = result["allowed_actions"]["not_allowed"]

        assert len(allowed) >= 3, f"Expected >= 3 allowed, got {len(allowed)}"
        assert len(not_allowed) >= 3, f"Expected >= 3 not_allowed, got {len(not_allowed)}"

    def test_t2_dimensions_complete(self):
        """A) All T2 dimensions should be present."""
        from src.kernel.world_model import run_world_model

        result, _, _ = run_world_model(
            domain="amazon-growth",
            task="Test task",
        )

        required_dims = ["liquidity", "correlation", "expectation", "leverage", "uncertainty"]
        for dim in required_dims:
            assert dim in result["t2"], f"Missing T2 dimension: {dim}"
            assert "level" in result["t2"][dim]
            assert "evidence" in result["t2"][dim]
            assert "gaps" in result["t2"][dim]

    def test_t3_dynamics_present(self):
        """A) T3 dynamics should have at least 1 pattern."""
        from src.kernel.world_model import run_world_model

        result, _, _ = run_world_model(
            domain="amazon-growth",
            task="Test task",
        )

        dynamics = result["t3"]["dynamics"]
        assert len(dynamics) >= 1, f"Expected >= 1 dynamic, got {len(dynamics)}"

        for dynamic in dynamics:
            assert "type" in dynamic
            assert "conditions" in dynamic
            assert "early_signals" in dynamic


class TestWorldModelGateNegative:
    """Test cases for error handling in World Model Gate."""

    def test_unsupported_domain_raises_error(self):
        """B) Unsupported domain should raise ValueError."""
        from src.kernel.world_model import run_world_model

        with pytest.raises(ValueError) as exc_info:
            run_world_model(
                domain="unsupported-domain",
                task="Test task",
            )

        assert "unsupported" in str(exc_info.value).lower()

    def test_invalid_result_raises_validation_error(self):
        """B) Invalid WorldModelResult should raise ValidationError."""
        from src.kernel.world_model.types import validate_world_model_result, ValidationError, validate_or_raise

        # Create an invalid result (missing required fields)
        invalid_result = {
            "version": "v1",
            "domain": "amazon-growth",
            # Missing: task, t1, t2, t3, allowed_actions, audit
        }

        errors = validate_world_model_result(invalid_result)
        assert len(errors) > 0, "Expected validation errors for invalid result"

        # Should raise ValidationError
        with pytest.raises(ValidationError):
            validate_or_raise(invalid_result)

    def test_missing_failure_modes_fails_validation(self):
        """B) Missing or insufficient failure_modes should fail validation."""
        from src.kernel.world_model.types import validate_world_model_result

        result_with_few_failures = {
            "version": "v1",
            "domain": "amazon-growth",
            "task": "test",
            "t1": {
                "failure_modes": ["only one"],  # Should have >= 3
                "key_assumptions": ["a", "b"],
                "stop_signals": ["a", "b"],
                "not_telling_you": ["a", "b"],
            },
            "t2": {},  # Invalid
            "t3": {},  # Invalid
            "allowed_actions": {},  # Invalid
            "audit": {},  # Invalid
        }

        errors = validate_world_model_result(result_with_few_failures)
        assert any("failure_modes" in e and ">= 3" in e for e in errors)

    def test_wrong_version_fails_validation(self):
        """B) Wrong version should fail validation."""
        from src.kernel.world_model.types import validate_world_model_result

        result_with_wrong_version = {
            "version": "v2",  # Should be v1
            "domain": "amazon-growth",
            "task": "test",
        }

        errors = validate_world_model_result(result_with_wrong_version)
        assert any("version" in e for e in errors)


class TestWorldModelGateIntegration:
    """Integration tests for World Model Gate in amazon-growth entry."""

    def test_main_py_imports_world_model(self):
        """Verify main.py imports World Model module."""
        main_py = REPO_ROOT / "src" / "domain" / "amazon-growth" / "main.py"
        content = main_py.read_text()

        assert "from src.kernel.world_model import" in content
        assert "run_world_model" in content

    def test_main_py_has_dry_run_flag(self):
        """Verify main.py has --dry-run argument."""
        main_py = REPO_ROOT / "src" / "domain" / "amazon-growth" / "main.py"
        content = main_py.read_text()

        assert "--dry-run" in content

    def test_main_py_has_gate_enforcement(self):
        """Verify main.py has World Model Gate enforcement."""
        main_py = REPO_ROOT / "src" / "domain" / "amazon-growth" / "main.py"
        content = main_py.read_text()

        assert "WORLD_MODEL_REQUIRED" in content
        assert "World Model Gate" in content


# Cleanup test artifacts
@pytest.fixture(autouse=True)
def cleanup_test_artifacts():
    """Clean up test-generated trace and artifact files after tests."""
    yield

    # Optional: Clean up test traces (comment out to keep for inspection)
    # traces_dir = REPO_ROOT / "data" / "traces" / "world_model"
    # for f in traces_dir.glob("wm_*_smoke*.json"):
    #     f.unlink()
