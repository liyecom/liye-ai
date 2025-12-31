"""
Deterministic LLM Runner
========================

This module provides deterministic LLM execution with strict
schema validation and reproducibility guarantees.

Usage:
    from src.runner import create_runner, InputContract

    runner = create_runner()
    input_contract = InputContract(
        domain="ppc",
        t1_units_used=["ppc_bid_strategy_escalation_01"],
        case_id="case_08",
        context_data={"keyword_acos": 0.12},
        question="What bid adjustment should be made?"
    )
    result = runner.execute(mechanism, input_contract)

Reference: docs/architecture/P2_DETERMINISTIC_LLM_RUNNER.md
"""

from .deterministic_runner import (
    DeterministicRunner,
    RunnerConfig,
    ExecutionResult,
    DeterminismViolation,
    RunnerConfigError,
    create_runner,
)

from .execution_contract import (
    InputContract,
    OutputContract,
    ContractViolation,
    build_execution_prompt,
)

from .output_validator import (
    OutputValidator,
    ValidationReport,
    ValidationResult,
    validate_runner_output,
)

__all__ = [
    # Runner
    "DeterministicRunner",
    "RunnerConfig",
    "ExecutionResult",
    "DeterminismViolation",
    "RunnerConfigError",
    "create_runner",
    # Contracts
    "InputContract",
    "OutputContract",
    "ContractViolation",
    "build_execution_prompt",
    # Validation
    "OutputValidator",
    "ValidationReport",
    "ValidationResult",
    "validate_runner_output",
]
