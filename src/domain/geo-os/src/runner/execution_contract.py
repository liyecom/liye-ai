"""
Execution Contract
==================

Defines the strict input/output contracts for Deterministic LLM Runner.

Contract Rules:
1. Input must include: domain, t1_units_used, case_id
2. Output must be structured JSON only
3. No free text allowed
4. No self-introduced mechanisms
5. No summaries, extensions, or speculation

Reference: docs/architecture/P2_DETERMINISTIC_LLM_RUNNER.md
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum
import json


class ContractViolation(Exception):
    """Raised when contract is violated"""
    pass


class OutputFieldType(Enum):
    """Allowed output field types"""
    REQUIRED = "required"
    OPTIONAL = "optional"
    FORBIDDEN = "forbidden"


@dataclass
class InputContract:
    """
    Input contract for Deterministic Runner.

    All fields are REQUIRED unless marked optional.
    """
    domain: str                          # REQUIRED: ppc, bsr, listing
    t1_units_used: List[str]             # REQUIRED: explicit mechanism IDs
    case_id: str                         # REQUIRED: case reference
    context_data: Dict[str, Any]         # REQUIRED: scenario-specific data
    question: str                        # REQUIRED: the question to answer

    def validate(self) -> bool:
        """Validate input contract"""
        errors = []

        # Domain validation
        valid_domains = ["ppc", "bsr", "listing"]
        if self.domain not in valid_domains:
            errors.append(f"Invalid domain: {self.domain}. Must be one of {valid_domains}")

        # T1 units validation
        if not self.t1_units_used or len(self.t1_units_used) == 0:
            errors.append("t1_units_used cannot be empty - must explicitly specify mechanisms")

        # Case ID validation
        if not self.case_id or not self.case_id.startswith("case_"):
            errors.append(f"Invalid case_id: {self.case_id}. Must start with 'case_'")

        # Context data validation
        if not isinstance(self.context_data, dict):
            errors.append("context_data must be a dictionary")

        # Question validation
        if not self.question or len(self.question.strip()) == 0:
            errors.append("question cannot be empty")

        if errors:
            raise ContractViolation(f"Input contract violations: {errors}")

        return True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            "domain": self.domain,
            "t1_units_used": self.t1_units_used,
            "case_id": self.case_id,
            "context_data": self.context_data,
            "question": self.question
        }


@dataclass
class OutputContract:
    """
    Output contract for Deterministic Runner.

    Defines allowed and forbidden fields in LLM output.
    """

    # Schema definition
    SCHEMA = {
        "mechanism_id": OutputFieldType.REQUIRED,
        "domain": OutputFieldType.REQUIRED,
        "trigger_match": OutputFieldType.REQUIRED,
        "applicable_rules": OutputFieldType.REQUIRED,
        "recommended_actions": OutputFieldType.REQUIRED,
        "boundary_conditions_checked": OutputFieldType.REQUIRED,

        # FORBIDDEN - will cause validation failure
        "confidence": OutputFieldType.FORBIDDEN,
        "summary": OutputFieldType.FORBIDDEN,
        "explanation": OutputFieldType.FORBIDDEN,
        "reasoning": OutputFieldType.FORBIDDEN,
        "analysis": OutputFieldType.FORBIDDEN,
        "thoughts": OutputFieldType.FORBIDDEN,
        "suggestions": OutputFieldType.FORBIDDEN,
        "recommendations": OutputFieldType.FORBIDDEN,  # use recommended_actions instead
    }

    # Required output structure
    mechanism_id: str
    domain: str
    trigger_match: bool
    applicable_rules: List[str]
    recommended_actions: List[str]
    boundary_conditions_checked: List[str]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'OutputContract':
        """Create from dictionary with validation"""
        # Check for forbidden fields
        forbidden_found = []
        for field_name, field_type in cls.SCHEMA.items():
            if field_type == OutputFieldType.FORBIDDEN and field_name in data:
                forbidden_found.append(field_name)

        if forbidden_found:
            raise ContractViolation(
                f"Forbidden fields in output: {forbidden_found}. "
                "LLM must not produce free-form text or explanations."
            )

        # Check for required fields
        required_missing = []
        for field_name, field_type in cls.SCHEMA.items():
            if field_type == OutputFieldType.REQUIRED and field_name not in data:
                required_missing.append(field_name)

        if required_missing:
            raise ContractViolation(
                f"Missing required fields: {required_missing}"
            )

        # Check for extra fields (strict mode)
        allowed_fields = {k for k, v in cls.SCHEMA.items() if v != OutputFieldType.FORBIDDEN}
        extra_fields = set(data.keys()) - allowed_fields
        if extra_fields:
            raise ContractViolation(
                f"Extra fields not in schema: {extra_fields}. "
                "Strict mode rejects undefined fields."
            )

        return cls(
            mechanism_id=data["mechanism_id"],
            domain=data["domain"],
            trigger_match=data["trigger_match"],
            applicable_rules=data["applicable_rules"],
            recommended_actions=data["recommended_actions"],
            boundary_conditions_checked=data["boundary_conditions_checked"]
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "mechanism_id": self.mechanism_id,
            "domain": self.domain,
            "trigger_match": self.trigger_match,
            "applicable_rules": self.applicable_rules,
            "recommended_actions": self.recommended_actions,
            "boundary_conditions_checked": self.boundary_conditions_checked
        }


# Prompt template - FROZEN, no modification allowed
EXECUTION_PROMPT_TEMPLATE = """You are a deterministic executor. You MUST:
1. Output ONLY valid JSON matching the exact schema
2. Use ONLY the provided T1 mechanism - no new reasoning
3. NO explanations, summaries, or free text
4. NO "I think", "based on my analysis", or similar phrases

T1 Mechanism:
{mechanism_json}

Context Data:
{context_json}

Question:
{question}

Output the following JSON structure EXACTLY:
{{
  "mechanism_id": "<mechanism id from T1>",
  "domain": "<domain>",
  "trigger_match": <true/false>,
  "applicable_rules": ["<rule 1>", "<rule 2>"],
  "recommended_actions": ["<action 1>", "<action 2>"],
  "boundary_conditions_checked": ["<condition 1>", "<condition 2>"]
}}

JSON OUTPUT ONLY:"""


def build_execution_prompt(
    mechanism: Dict[str, Any],
    context: Dict[str, Any],
    question: str
) -> str:
    """
    Build the execution prompt from template.

    This function is the ONLY place where prompts are constructed.
    No other code may build prompts for the LLM.
    """
    return EXECUTION_PROMPT_TEMPLATE.format(
        mechanism_json=json.dumps(mechanism, indent=2, ensure_ascii=False),
        context_json=json.dumps(context, indent=2, ensure_ascii=False),
        question=question
    )
