"""
Deterministic LLM Runner
========================

Executes LLM calls with strict determinism guarantees.

Core Principles:
1. LLM is Executor, not Reasoner
2. All outputs must be reproducible (same input → same output)
3. No retries (introduces variance)
4. No temperature (introduces randomness)
5. Schema-validated outputs only

Reference: docs/architecture/P2_DETERMINISTIC_LLM_RUNNER.md
"""

import json
import yaml
import hashlib
from pathlib import Path
from dataclasses import dataclass
from typing import Dict, Any, Optional, List
from datetime import datetime
import logging

from .execution_contract import (
    InputContract,
    OutputContract,
    ContractViolation,
    build_execution_prompt
)
from .output_validator import (
    OutputValidator,
    ValidationReport,
    ValidationResult
)


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DeterminismViolation(Exception):
    """Raised when determinism requirements are violated"""
    pass


class RunnerConfigError(Exception):
    """Raised when runner configuration is invalid"""
    pass


@dataclass
class RunnerConfig:
    """Runner configuration loaded from runner_config.yaml"""

    # LLM settings
    provider: str
    model: str
    temperature: float
    top_p: float
    max_tokens: int

    # Execution settings
    retries: int
    parallel: bool
    timeout_sec: int

    # Determinism settings
    enforce_schema: bool
    reject_free_text: bool
    hash_outputs: bool

    @classmethod
    def load(cls, config_path: Optional[str] = None) -> 'RunnerConfig':
        """Load configuration from YAML file"""
        if config_path is None:
            config_path = Path(__file__).parent / "runner_config.yaml"

        with open(config_path, 'r') as f:
            data = yaml.safe_load(f)

        config = cls(
            provider=data['llm']['provider'],
            model=data['llm']['model'],
            temperature=data['llm']['temperature'],
            top_p=data['llm']['top_p'],
            max_tokens=data['llm']['max_tokens'],
            retries=data['execution']['retries'],
            parallel=data['execution']['parallel'],
            timeout_sec=data['execution']['timeout_sec'],
            enforce_schema=data['determinism']['enforce_schema'],
            reject_free_text=data['determinism']['reject_free_text'],
            hash_outputs=data['determinism']['hash_outputs'],
        )

        # Validate frozen values
        config.validate_frozen_values()

        return config

    def validate_frozen_values(self):
        """Validate that frozen configuration values are correct"""
        violations = []

        if self.temperature != 0.0:
            violations.append(f"temperature must be 0.0, got {self.temperature}")

        if self.top_p != 1.0:
            violations.append(f"top_p must be 1.0, got {self.top_p}")

        if self.retries != 0:
            violations.append(f"retries must be 0, got {self.retries}")

        if self.parallel:
            violations.append("parallel must be false")

        if not self.enforce_schema:
            violations.append("enforce_schema must be true")

        if not self.reject_free_text:
            violations.append("reject_free_text must be true")

        if not self.hash_outputs:
            violations.append("hash_outputs must be true")

        if violations:
            raise RunnerConfigError(
                f"Configuration violates frozen values: {violations}"
            )


@dataclass
class ExecutionResult:
    """Result of a deterministic execution"""
    success: bool
    input_hash: str
    output_hash: Optional[str]
    validated_output: Optional[OutputContract]
    validation_report: ValidationReport
    execution_time_ms: int
    timestamp: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "input_hash": self.input_hash,
            "output_hash": self.output_hash,
            "validated_output": self.validated_output.to_dict() if self.validated_output else None,
            "validation_report": self.validation_report.to_dict(),
            "execution_time_ms": self.execution_time_ms,
            "timestamp": self.timestamp
        }


class DeterministicRunner:
    """
    Deterministic LLM execution runner.

    This is the ONLY interface for executing LLM calls in the system.
    All LLM interactions must go through this class.
    """

    def __init__(self, config: Optional[RunnerConfig] = None):
        """
        Initialize runner with configuration.

        Args:
            config: Runner configuration. If None, loads from default path.
        """
        self.config = config or RunnerConfig.load()
        self.validator = OutputValidator(strict_mode=True)
        self._llm_client = None  # Lazy initialization

    def _get_llm_client(self):
        """
        Get LLM client (lazy initialization).

        Currently returns a stub. Replace with actual client for production.
        """
        if self._llm_client is None:
            # Stub implementation for testing
            # Replace with actual OpenAI/Anthropic client
            self._llm_client = StubLLMClient(self.config)
        return self._llm_client

    def _compute_input_hash(self, input_contract: InputContract) -> str:
        """Compute hash of input for tracking"""
        canonical = json.dumps(input_contract.to_dict(), sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(canonical.encode('utf-8')).hexdigest()[:16]

    def execute(
        self,
        mechanism: Dict[str, Any],
        input_contract: InputContract
    ) -> ExecutionResult:
        """
        Execute deterministic LLM call.

        Args:
            mechanism: T1 mechanism definition
            input_contract: Validated input contract

        Returns:
            ExecutionResult with validated output
        """
        start_time = datetime.now()

        # Validate input contract
        input_contract.validate()
        input_hash = self._compute_input_hash(input_contract)

        logger.info(f"Executing: {input_contract.case_id} | input_hash={input_hash}")

        # Build prompt (ONLY place prompts are constructed)
        prompt = build_execution_prompt(
            mechanism=mechanism,
            context=input_contract.context_data,
            question=input_contract.question
        )

        # Execute LLM call
        client = self._get_llm_client()
        raw_output = client.complete(prompt)

        # Validate output
        validation_report = self.validator.validate(raw_output)

        # Calculate execution time
        execution_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        # Build result
        result = ExecutionResult(
            success=validation_report.result == ValidationResult.PASS,
            input_hash=input_hash,
            output_hash=validation_report.output_hash,
            validated_output=validation_report.validated_output,
            validation_report=validation_report,
            execution_time_ms=execution_time_ms,
            timestamp=datetime.now().isoformat()
        )

        logger.info(
            f"Completed: {input_contract.case_id} | "
            f"success={result.success} | "
            f"output_hash={result.output_hash[:16] if result.output_hash else 'N/A'}"
        )

        return result

    def verify_reproducibility(
        self,
        mechanism: Dict[str, Any],
        input_contract: InputContract,
        runs: int = 3
    ) -> bool:
        """
        Verify that multiple runs produce identical outputs.

        Args:
            mechanism: T1 mechanism
            input_contract: Input contract
            runs: Number of runs to compare

        Returns:
            True if all runs produce identical hash
        """
        hashes = []

        for i in range(runs):
            result = self.execute(mechanism, input_contract)
            if not result.success:
                logger.error(f"Run {i+1} failed validation")
                return False
            hashes.append(result.output_hash)

        # Check all hashes are identical
        unique_hashes = set(hashes)
        if len(unique_hashes) > 1:
            logger.error(f"Reproducibility failure: {len(unique_hashes)} unique hashes")
            return False

        logger.info(f"Reproducibility verified: {runs} runs, 1 unique hash")
        return True


class StubLLMClient:
    """
    Stub LLM client for testing.

    Returns deterministic outputs based on input hash.
    Replace with actual LLM client for production.
    """

    def __init__(self, config: RunnerConfig):
        self.config = config

    def complete(self, prompt: str) -> str:
        """
        Return deterministic stub response.

        This stub extracts the mechanism_id from the prompt and returns
        a valid JSON response matching the output schema.
        """
        # Parse mechanism_id from prompt
        import re
        id_match = re.search(r'"id":\s*"([^"]+)"', prompt)
        mechanism_id = id_match.group(1) if id_match else "unknown"

        domain_match = re.search(r'"domain":\s*"([^"]+)"', prompt)
        domain = domain_match.group(1) if domain_match else "unknown"

        # Return deterministic stub output
        stub_output = {
            "mechanism_id": mechanism_id,
            "domain": domain,
            "trigger_match": True,
            "applicable_rules": [
                "stub_rule_1",
                "stub_rule_2"
            ],
            "recommended_actions": [
                "stub_action_1",
                "stub_action_2"
            ],
            "boundary_conditions_checked": [
                "stub_condition_1"
            ]
        }

        return json.dumps(stub_output, indent=2)


def create_runner(config_path: Optional[str] = None) -> DeterministicRunner:
    """
    Factory function to create runner instance.

    This is the recommended way to create a runner.
    """
    config = RunnerConfig.load(config_path) if config_path else RunnerConfig.load()
    return DeterministicRunner(config)
