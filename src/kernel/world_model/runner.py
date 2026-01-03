"""
World Model Runner - LiYe OS v6.2.0

Assembles WorldModelResult from domain-specific units and writes trace/artifacts.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import uuid

from .types import (
    WorldModelResult,
    WORLD_MODEL_VERSION,
    validate_world_model_result,
    ValidationError,
)


# Repository root (relative to this file)
REPO_ROOT = Path(__file__).parent.parent.parent.parent

# Trace and artifact directories
TRACES_DIR = REPO_ROOT / "data" / "traces" / "world_model"
ARTIFACTS_DIR = REPO_ROOT / "Artifacts_Vault" / "reports"


# Skeleton domain units - generic examples for framework demonstration
# Domain-specific units should be loaded dynamically from domain configurations
# Note: Domain-specific implementations (e.g., e-commerce, investment) are in private repositories
SKELETON_DOMAIN_UNITS = {
    "t1": [
        {
            "id": "resource_reflexivity",
            "failure_mode": "Increasing resource allocation may trigger competition for the same resources, leading to cost escalation",
            "key_assumption": "Market prices remain stable regardless of your actions",
            "stop_signal": "Stop scaling when cost increase exceeds efficiency gains",
            "not_telling_you": "Competitors' resource limits and strategies",
        },
        {
            "id": "attribution_not_causality",
            "failure_mode": "Attribution data suggests causation but correlation may be coincidental",
            "key_assumption": "Attribution systems perfectly reflect causal relationships",
            "stop_signal": "Do not claim causation without controlled experiments",
            "not_telling_you": "How many outcomes would have occurred organically",
        },
        {
            "id": "seasonality_false_trend",
            "failure_mode": "Mistaking cyclical patterns for permanent trends leads to poor decisions",
            "key_assumption": "Changes are primarily driven by internal strategy",
            "stop_signal": "Do not evaluate long-term strategy during anomalous periods",
            "not_telling_you": "Whether this cycle matches historical patterns",
        },
    ],
    "t2": {
        "liquidity": {
            "level": "medium",
            "evidence": ["No specific data provided, inferred from context"],
            "gaps": ["Actual resource turnover", "Budget utilization ratio", "Cash flow status"],
        },
        "correlation": {
            "level": "medium",
            "evidence": ["Systemic correlations exist within the domain"],
            "gaps": ["True correlation between metrics", "Cross-category effects"],
        },
        "expectation": {
            "level": "medium",
            "evidence": ["Market state requires specific data verification"],
            "gaps": ["Competitor strategies", "Market trends", "New entrants"],
        },
        "leverage": {
            "level": "medium",
            "evidence": ["Multiple leverage points exist in the system"],
            "gaps": ["Differentiation factors", "Pricing flexibility", "Supply chain resilience"],
        },
        "uncertainty": {
            "level": "high",
            "evidence": ["External factors are difficult to predict"],
            "gaps": ["Platform changes", "Competitor dynamics", "Macro factors"],
        },
    },
    "t3": [
        {
            "type": "amplification",
            "name": "Cost Spiral Amplification",
            "conditions": ["Multiple actors competing", "Limited resource pool"],
            "early_signals": [
                "Cost growth exceeds value growth",
                "Position volatility increases",
                "Small adjustments cause large effects",
            ],
        },
        {
            "type": "phase_transition",
            "name": "Resource Exhaustion Phase Transition",
            "conditions": ["High resource consumption rate", "Supply chain uncertainty"],
            "early_signals": [
                "Buffer < 2 weeks",
                "Replenishment cycle lengthening",
                "Consumption rate accelerating",
            ],
        },
    ],
}


MAX_TRACE_ID_RETRIES = 3


def _generate_trace_id() -> str:
    """Generate a unique trace ID component."""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    short_uuid = str(uuid.uuid4())[:8]
    return f"wm_{timestamp}_{short_uuid}"


def _generate_unique_trace_id() -> str:
    """
    Generate a trace ID with collision protection.

    Checks if the trace file already exists and retries up to MAX_TRACE_ID_RETRIES times.
    Raises RuntimeError if collision cannot be resolved.
    """
    TRACES_DIR.mkdir(parents=True, exist_ok=True)

    for attempt in range(MAX_TRACE_ID_RETRIES):
        trace_id = _generate_trace_id()
        trace_path = TRACES_DIR / f"{trace_id}.json"

        if not trace_path.exists():
            return trace_id

    # All retries exhausted, still collision
    raise RuntimeError(
        f"trace_id collision: could not generate unique ID after {MAX_TRACE_ID_RETRIES} attempts. "
        f"Last attempted path: {trace_path}"
    )


def _build_world_model_result(
    domain: str,
    task: str,
    context: dict[str, Any],
    trace_id: str,
) -> WorldModelResult:
    """Build a WorldModelResult from domain units."""

    # Accept skeleton domain for framework demonstration
    # Domain-specific implementations should be in private repositories
    supported_domains = {"skeleton", "example", "demo"}
    if domain not in supported_domains:
        raise ValueError(f"Unsupported domain: {domain}. Supported: {supported_domains}. Domain-specific implementations are in private repositories.")

    units = SKELETON_DOMAIN_UNITS
    now = datetime.now(timezone.utc).isoformat()

    # Build T1
    t1 = {
        "failure_modes": [u["failure_mode"] for u in units["t1"]],
        "key_assumptions": [u["key_assumption"] for u in units["t1"][:2]],
        "stop_signals": [u["stop_signal"] for u in units["t1"][:2]],
        "not_telling_you": [u["not_telling_you"] for u in units["t1"][:2]],
    }

    # Build T2 (already structured)
    t2 = units["t2"]

    # Build T3
    t3 = {
        "dynamics": [
            {
                "type": d["type"],
                "conditions": d["conditions"],
                "early_signals": d["early_signals"],
            }
            for d in units["t3"]
        ]
    }

    # Build allowed_actions (generic examples)
    allowed_actions = {
        "allowed": [
            "Diagnose current state and identify root causes",
            "Design small-scale experiments to validate hypotheses",
            "Fill in missing data before making decisions",
            "Optimize one variable at a time",
            "Set hard limits as safety valves",
        ],
        "not_allowed": [
            "Scale resources without diagnosing problems first",
            "Promise specific outcome numbers",
            "Adjust multiple levers simultaneously",
            "Make major decisions with insufficient data",
            "Ignore cyclical factors when evaluating trends",
        ],
    }

    # Build units_selected (track which units were used)
    units_selected = {
        "t1": [u["id"] for u in units["t1"]],
        "t2": list(units["t2"].keys()),
        "t3": [d["type"] for d in units["t3"]],
    }

    # Build audit
    inputs_summary = context.get("inputs_summary", f"Task: {task}")
    if isinstance(context.get("user_input"), str):
        inputs_summary = context["user_input"][:200]

    audit = {
        "inputs_summary": inputs_summary,
        "data_sources": context.get("data_sources", ["user_input", "world_model_units"]),
        "units_selected": units_selected,
        "generated_at": now,
        "trace_id": trace_id,
    }

    return {
        "version": WORLD_MODEL_VERSION,
        "domain": domain,
        "task": task,
        "t1": t1,
        "t2": t2,
        "t3": t3,
        "allowed_actions": allowed_actions,
        "audit": audit,
    }


def _write_trace(result: WorldModelResult, trace_id: str) -> Path:
    """Write the WorldModelResult as JSON trace."""
    TRACES_DIR.mkdir(parents=True, exist_ok=True)
    trace_path = TRACES_DIR / f"{trace_id}.json"

    with open(trace_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    return trace_path


def _write_artifact(result: WorldModelResult, trace_id: str) -> Path:
    """Write the WorldModelResult as human-readable Markdown report."""
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    artifact_path = ARTIFACTS_DIR / f"WORLD_MODEL_{trace_id}.md"

    lines = [
        f"# World Model Report",
        f"",
        f"> **Trace ID**: `{trace_id}`",
        f"> **Domain**: {result['domain']}",
        f"> **Task**: {result['task']}",
        f"> **Generated**: {result['audit']['generated_at']}",
        f"",
        f"---",
        f"",
        f"## T1: Failure Modes & Assumptions",
        f"",
        f"### What Could Go Wrong",
        f"",
    ]

    for i, fm in enumerate(result["t1"]["failure_modes"], 1):
        lines.append(f"{i}. {fm}")

    lines.extend([
        f"",
        f"### Key Assumptions (if these fail, the model fails)",
        f"",
    ])
    for assumption in result["t1"]["key_assumptions"]:
        lines.append(f"- {assumption}")

    lines.extend([
        f"",
        f"### Stop Signals",
        f"",
    ])
    for signal in result["t1"]["stop_signals"]:
        lines.append(f"- {signal}")

    lines.extend([
        f"",
        f"### What This Doesn't Tell You",
        f"",
    ])
    for item in result["t1"]["not_telling_you"]:
        lines.append(f"- {item}")

    lines.extend([
        f"",
        f"---",
        f"",
        f"## T2: State Dimensions",
        f"",
    ])

    for dim_name, dim_data in result["t2"].items():
        lines.extend([
            f"### {dim_name.capitalize()}",
            f"",
            f"**Level**: {dim_data['level']}",
            f"",
            f"**Evidence**:",
        ])
        for ev in dim_data["evidence"]:
            lines.append(f"- {ev}")
        lines.extend([
            f"",
            f"**Gaps**:",
        ])
        for gap in dim_data["gaps"]:
            lines.append(f"- {gap}")
        lines.append(f"")

    lines.extend([
        f"---",
        f"",
        f"## T3: Dynamic Patterns",
        f"",
    ])

    for dynamic in result["t3"]["dynamics"]:
        lines.extend([
            f"### {dynamic['type'].replace('_', ' ').title()}",
            f"",
            f"**Conditions**:",
        ])
        for cond in dynamic["conditions"]:
            lines.append(f"- {cond}")
        lines.extend([
            f"",
            f"**Early Signals**:",
        ])
        for signal in dynamic["early_signals"]:
            lines.append(f"- {signal}")
        lines.append(f"")

    lines.extend([
        f"---",
        f"",
        f"## Allowed & Not Allowed Actions",
        f"",
        f"### Allowed",
        f"",
    ])
    for action in result["allowed_actions"]["allowed"]:
        lines.append(f"- {action}")

    lines.extend([
        f"",
        f"### Not Allowed",
        f"",
    ])
    for action in result["allowed_actions"]["not_allowed"]:
        lines.append(f"- {action}")

    lines.extend([
        f"",
        f"---",
        f"",
        f"## Audit Trail",
        f"",
        f"- **Inputs Summary**: {result['audit']['inputs_summary']}",
        f"- **Data Sources**: {', '.join(result['audit']['data_sources'])}",
        f"- **Generated At**: {result['audit']['generated_at']}",
        f"- **Trace ID**: `{result['audit']['trace_id']}`",
        f"",
        f"### Units Selected",
        f"",
        f"- **T1**: {', '.join(result['audit']['units_selected']['t1'])}",
        f"- **T2**: {', '.join(result['audit']['units_selected']['t2'])}",
        f"- **T3**: {', '.join(result['audit']['units_selected']['t3'])}",
        f"",
    ])

    with open(artifact_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return artifact_path


def run_world_model(
    domain: str,
    task: str,
    context: dict[str, Any] | None = None,
) -> tuple[WorldModelResult, Path, Path]:
    """
    Run the World Model for a given domain and task.

    Args:
        domain: The domain (e.g., "skeleton", "example")
        task: The task description
        context: Optional context dict with additional info

    Returns:
        Tuple of (WorldModelResult, trace_path, artifact_path)

    Raises:
        ValidationError: If the generated result fails validation
        ValueError: If the domain is not supported
    """
    if context is None:
        context = {}

    trace_id = _generate_unique_trace_id()

    # Build the result
    result = _build_world_model_result(domain, task, context, trace_id)

    # Validate
    errors = validate_world_model_result(result)
    if errors:
        raise ValidationError(errors)

    # Write trace and artifact
    trace_path = _write_trace(result, trace_id)
    artifact_path = _write_artifact(result, trace_id)

    return result, trace_path, artifact_path


class WorldModelGateError(Exception):
    """Raised when World Model Gate is not satisfied."""
    pass


WORLD_MODEL_REQUIRED = WorldModelGateError
