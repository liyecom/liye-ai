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


# Amazon Growth units - predefined for MVP
# In future versions, this could be dynamically loaded based on task analysis
AMAZON_GROWTH_UNITS = {
    "t1": [
        {
            "id": "budget_reflexivity",
            "failure_mode": "预算增加 → 竞价提高 → CPC 上涨 → 预算消耗更快 → 需要更多预算（正反馈螺旋）",
            "key_assumption": "假设市场价格不会因为你的行为而变化",
            "stop_signal": "当 CPC 涨幅超过 ROI 容忍阈值时，停止加预算",
            "not_telling_you": "竞争对手的预算上限是多少",
        },
        {
            "id": "attribution_not_causality",
            "failure_mode": "广告归因数据显示'广告带来了销售'，但那些顾客可能本来就会购买",
            "key_assumption": "假设归因系统完美反映因果关系",
            "stop_signal": "当无法证明'没有广告就没有这笔销售'时，不要断言广告有效",
            "not_telling_you": "有多少销售是'被广告抢走'的自然转化",
        },
        {
            "id": "seasonality_false_trend",
            "failure_mode": "把季节性波动误认为是真实趋势，在错误的时间做出错误的决策",
            "key_assumption": "假设销售变化主要由内部策略驱动",
            "stop_signal": "在大促期间不要评估长期策略效果",
            "not_telling_you": "今年的季节性是否和往年相同",
        },
    ],
    "t2": {
        "liquidity": {
            "level": "medium",
            "evidence": ["用户未提供具体库存/现金数据，基于输入描述推断"],
            "gaps": ["实际库存周转天数", "广告预算占销售额比例", "现金流状况"],
        },
        "correlation": {
            "level": "medium",
            "evidence": ["Amazon 广告系统内各指标存在系统性关联"],
            "gaps": ["自然排名与广告投放的真实相关性", "跨品类关联效应"],
        },
        "expectation": {
            "level": "medium",
            "evidence": ["市场竞争状态需要具体数据验证"],
            "gaps": ["竞品实际广告策略", "类目整体 CPC 趋势", "新进入者情况"],
        },
        "leverage": {
            "level": "medium",
            "evidence": ["广告是运营杠杆之一，但非唯一杠杆"],
            "gaps": ["产品差异化程度", "定价空间", "供应链弹性"],
        },
        "uncertainty": {
            "level": "high",
            "evidence": ["Amazon 算法持续变化，外部因素难以预测"],
            "gaps": ["算法变更计划", "竞品动态", "宏观经济影响"],
        },
    },
    "t3": [
        {
            "type": "amplification",
            "name": "CPC 螺旋放大",
            "conditions": ["多个主要卖家同时竞争", "关键词搜索量有限"],
            "early_signals": [
                "CPC 涨幅 > 搜索量涨幅",
                "广告位排名波动剧烈",
                "小幅调整竞价导致显著排名变化",
            ],
        },
        {
            "type": "phase_transition",
            "name": "断货相变",
            "conditions": ["库存周转过快", "供应链有不确定性"],
            "early_signals": [
                "库存天数 < 14 天",
                "补货周期延长",
                "销售速度突然加快",
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

    if domain != "amazon-growth":
        raise ValueError(f"Unsupported domain: {domain}. Only 'amazon-growth' is supported in MVP.")

    units = AMAZON_GROWTH_UNITS
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

    # Build allowed_actions
    allowed_actions = {
        "allowed": [
            "诊断当前广告效果，识别问题根因",
            "设计小规模 A/B 测试验证假设",
            "补全缺失数据（库存、CPC历史、竞品信息）",
            "优化单个关键词或广告组",
            "设置预算/CPC 硬上限作为安全阀",
        ],
        "not_allowed": [
            "直接加大总预算而不先诊断问题",
            "承诺具体的 ROI 或销售增长数字",
            "同时调整多个杠杆（预算+竞价+关键词）",
            "在数据不足时做出重大决策",
            "忽略季节性因素做趋势判断",
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
        domain: The domain (e.g., "amazon-growth")
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
