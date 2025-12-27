"""
Orchestration Module - Multi-Agent Flow Coordination.

Amazon Growth OS - Complex Scenario Orchestration
Version: 1.0

Provides:
- Multi-agent flow definitions
- Dependency resolution and parallel execution
- Context sharing between agents
- Error handling and escalation
"""

from .flow_orchestrator import (
    FlowOrchestrator,
    FlowContext,
    FlowResult,
    FlowStatus,
    AgentOutput,
    AgentStatus
)

__all__ = [
    'FlowOrchestrator',
    'FlowContext',
    'FlowResult',
    'FlowStatus',
    'AgentOutput',
    'AgentStatus'
]
