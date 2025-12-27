"""
Flow Orchestrator for Amazon Growth OS.

Coordinates multi-agent workflows for complex scenarios
including competitive response, crisis management, and product launches.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Callable, Any
from enum import Enum
import yaml
import json


class FlowStatus(Enum):
    """Status of a flow execution."""
    PENDING = "pending"
    RUNNING = "running"
    WAITING_DEPENDENCY = "waiting_dependency"
    COMPLETED = "completed"
    FAILED = "failed"
    ESCALATED = "escalated"
    TIMEOUT = "timeout"


class AgentStatus(Enum):
    """Status of an agent within a flow."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class AgentOutput:
    """Output from an agent execution."""
    agent_id: str
    timestamp: datetime
    status: AgentStatus
    outputs: Dict[str, Any]
    reasoning: str = ""
    execution_time_seconds: float = 0.0
    error: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            'agent_id': self.agent_id,
            'timestamp': self.timestamp.isoformat(),
            'status': self.status.value,
            'outputs': self.outputs,
            'reasoning': self.reasoning,
            'execution_time_seconds': self.execution_time_seconds,
            'error': self.error
        }


@dataclass
class FlowContext:
    """Shared context across agents in a flow."""
    flow_id: str
    flow_name: str
    trigger_data: Dict = field(default_factory=dict)
    agent_outputs: Dict[str, AgentOutput] = field(default_factory=dict)
    shared_data: Dict = field(default_factory=dict)
    start_time: datetime = field(default_factory=datetime.now)
    end_time: Optional[datetime] = None

    def get_agent_output(self, agent_id: str, output_key: str) -> Any:
        """Get a specific output from a previous agent."""
        if agent_id in self.agent_outputs:
            return self.agent_outputs[agent_id].outputs.get(output_key)
        return None

    def get_all_outputs(self) -> Dict:
        """Get all outputs from all agents."""
        result = {}
        for agent_id, output in self.agent_outputs.items():
            result[agent_id] = output.outputs
        return result

    def to_dict(self) -> Dict:
        return {
            'flow_id': self.flow_id,
            'flow_name': self.flow_name,
            'trigger_data': self.trigger_data,
            'agent_outputs': {k: v.to_dict() for k, v in self.agent_outputs.items()},
            'shared_data': self.shared_data,
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'duration_seconds': (
                (self.end_time - self.start_time).total_seconds()
                if self.end_time else None
            )
        }


@dataclass
class FlowResult:
    """Result of a complete flow execution."""
    flow_id: str
    flow_name: str
    status: FlowStatus
    context: FlowContext
    final_output: Dict = field(default_factory=dict)
    report: str = ""
    recommendations: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            'flow_id': self.flow_id,
            'flow_name': self.flow_name,
            'status': self.status.value,
            'context': self.context.to_dict(),
            'final_output': self.final_output,
            'recommendations': self.recommendations
        }


class FlowOrchestrator:
    """
    Orchestrates multi-agent flows for complex scenarios.

    Handles:
    - Flow definition and configuration
    - Agent dependency resolution
    - Parallel execution where possible
    - Context sharing between agents
    - Error handling and escalation
    """

    def __init__(
        self,
        config_path: Optional[str] = None
    ):
        """Initialize flow orchestrator."""
        self.config_path = config_path or "config/multi_agent_flows.yaml"
        self.config = self._load_config()

        # Registered agent handlers
        self.agent_handlers: Dict[str, Callable] = {}

        # Flow execution history
        self.execution_history: List[FlowResult] = []

        # Active flows
        self.active_flows: Dict[str, FlowContext] = {}

    def _load_config(self) -> Dict:
        """Load configuration from YAML file."""
        try:
            with open(self.config_path, 'r') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            return self._default_config()

    def _default_config(self) -> Dict:
        """Default configuration if file not found."""
        return {
            'flows': {},
            'agent_defaults': {
                'timeout_seconds': 300,
                'retry_attempts': 2
            },
            'execution': {
                'parallel_agents': True,
                'max_parallel': 3
            }
        }

    def register_agent(self, agent_id: str, handler: Callable):
        """
        Register an agent handler function.

        Handler signature: def handler(context: FlowContext, agent_config: Dict) -> AgentOutput
        """
        self.agent_handlers[agent_id] = handler

    def get_available_flows(self) -> List[Dict]:
        """Get list of available flows."""
        flows = self.config.get('flows', {})
        return [
            {
                'id': flow_id,
                'name': flow_config.get('name', flow_id),
                'description': flow_config.get('description', ''),
                'trigger_type': flow_config.get('trigger', {}).get('type', 'manual')
            }
            for flow_id, flow_config in flows.items()
        ]

    def get_flow_config(self, flow_id: str) -> Optional[Dict]:
        """Get configuration for a specific flow."""
        return self.config.get('flows', {}).get(flow_id)

    def _generate_flow_id(self) -> str:
        """Generate unique flow execution ID."""
        import uuid
        return f"flow_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"

    def _resolve_dependencies(self, agents: List[Dict]) -> List[List[str]]:
        """
        Resolve agent dependencies into execution stages.

        Returns list of stages, where each stage contains agents
        that can run in parallel.
        """
        # Build dependency graph
        agent_deps = {
            agent['id']: set(agent.get('depends_on', []))
            for agent in agents
        }

        # Find execution order
        stages = []
        completed = set()

        while len(completed) < len(agents):
            # Find agents with all dependencies satisfied
            ready = [
                agent_id for agent_id, deps in agent_deps.items()
                if agent_id not in completed and deps.issubset(completed)
            ]

            if not ready:
                # Circular dependency or missing agent
                remaining = [a for a in agent_deps if a not in completed]
                raise ValueError(f"Cannot resolve dependencies for: {remaining}")

            stages.append(ready)
            completed.update(ready)

        return stages

    def execute_flow(
        self,
        flow_id: str,
        trigger_data: Optional[Dict] = None,
        dry_run: bool = False
    ) -> FlowResult:
        """
        Execute a multi-agent flow.

        Args:
            flow_id: ID of the flow to execute
            trigger_data: Data that triggered the flow
            dry_run: If True, simulate without executing agents

        Returns:
            FlowResult with all agent outputs and final synthesis
        """
        flow_config = self.get_flow_config(flow_id)
        if not flow_config:
            raise ValueError(f"Unknown flow: {flow_id}")

        # Create execution context
        execution_id = self._generate_flow_id()
        context = FlowContext(
            flow_id=execution_id,
            flow_name=flow_config.get('name', flow_id),
            trigger_data=trigger_data or {}
        )

        self.active_flows[execution_id] = context

        try:
            # Get agent configurations
            agents = flow_config.get('agents', [])
            if not agents:
                return self._create_result(
                    context,
                    FlowStatus.FAILED,
                    error="No agents defined in flow"
                )

            # Resolve execution order
            stages = self._resolve_dependencies(agents)
            agent_configs = {a['id']: a for a in agents}

            # Execute stages
            for stage_num, stage in enumerate(stages):
                stage_results = self._execute_stage(
                    context,
                    stage,
                    agent_configs,
                    dry_run
                )

                # Check for failures
                for agent_id, output in stage_results.items():
                    context.agent_outputs[agent_id] = output

                    if output.status == AgentStatus.FAILED:
                        # Check escalation policy
                        escalation = flow_config.get('escalation', {})
                        return self._handle_escalation(
                            context,
                            agent_id,
                            output.error,
                            escalation
                        )

            # All stages complete - synthesize final output
            context.end_time = datetime.now()
            return self._create_result(context, FlowStatus.COMPLETED)

        except Exception as e:
            context.end_time = datetime.now()
            return self._create_result(
                context,
                FlowStatus.FAILED,
                error=str(e)
            )

        finally:
            # Remove from active flows
            if execution_id in self.active_flows:
                del self.active_flows[execution_id]

    def _execute_stage(
        self,
        context: FlowContext,
        agent_ids: List[str],
        agent_configs: Dict[str, Dict],
        dry_run: bool
    ) -> Dict[str, AgentOutput]:
        """Execute a stage of agents (potentially in parallel)."""
        results = {}

        for agent_id in agent_ids:
            agent_config = agent_configs.get(agent_id, {})

            if dry_run:
                # Simulate execution
                results[agent_id] = AgentOutput(
                    agent_id=agent_id,
                    timestamp=datetime.now(),
                    status=AgentStatus.COMPLETED,
                    outputs={key: f"[DRY RUN] {key}" for key in agent_config.get('outputs', [])},
                    reasoning="Dry run - no actual execution",
                    execution_time_seconds=0.0
                )
            else:
                # Execute agent
                results[agent_id] = self._execute_agent(context, agent_config)

        return results

    def _execute_agent(
        self,
        context: FlowContext,
        agent_config: Dict
    ) -> AgentOutput:
        """Execute a single agent."""
        agent_id = agent_config.get('id', 'unknown')
        start_time = datetime.now()

        try:
            # Check if handler is registered
            if agent_id in self.agent_handlers:
                handler = self.agent_handlers[agent_id]
                output = handler(context, agent_config)
                return output

            # Default execution using simulated output
            # In production, this would use CrewAI or similar
            outputs = {}
            for output_key in agent_config.get('outputs', []):
                # Generate based on role and context
                outputs[output_key] = self._generate_agent_output(
                    agent_id,
                    output_key,
                    agent_config.get('role', ''),
                    context
                )

            execution_time = (datetime.now() - start_time).total_seconds()

            return AgentOutput(
                agent_id=agent_id,
                timestamp=datetime.now(),
                status=AgentStatus.COMPLETED,
                outputs=outputs,
                reasoning=f"Executed role: {agent_config.get('role', 'Unknown')}",
                execution_time_seconds=execution_time
            )

        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds()
            return AgentOutput(
                agent_id=agent_id,
                timestamp=datetime.now(),
                status=AgentStatus.FAILED,
                outputs={},
                error=str(e),
                execution_time_seconds=execution_time
            )

    def _generate_agent_output(
        self,
        agent_id: str,
        output_key: str,
        role: str,
        context: FlowContext
    ) -> Any:
        """Generate simulated agent output based on context."""
        # This is a simplified simulation
        # In production, this would use actual LLM calls

        trigger_data = context.trigger_data

        if output_key == 'price_analysis':
            return {
                'competitor_price': trigger_data.get('competitor_price', 0),
                'our_price': trigger_data.get('our_price', 0),
                'price_gap': trigger_data.get('price_gap', 0),
                'recommendation': 'monitor_closely'
            }
        elif output_key == 'market_position':
            return {
                'rank': 2,
                'market_share': 15.5,
                'trend': 'stable'
            }
        elif output_key == 'bid_adjustments':
            return [
                {'keyword': 'example', 'action': 'increase', 'amount': 0.10}
            ]
        elif output_key == 'action_plan':
            return {
                'immediate': ['Monitor prices', 'Review inventory'],
                'short_term': ['Adjust bids', 'Update listing'],
                'medium_term': ['Evaluate strategy']
            }
        else:
            return f"Generated output for {output_key}"

    def _handle_escalation(
        self,
        context: FlowContext,
        failed_agent: str,
        error: str,
        escalation_config: Dict
    ) -> FlowResult:
        """Handle escalation when an agent fails."""
        context.end_time = datetime.now()

        return FlowResult(
            flow_id=context.flow_id,
            flow_name=context.flow_name,
            status=FlowStatus.ESCALATED,
            context=context,
            final_output={
                'escalation_reason': f"Agent {failed_agent} failed",
                'error': error,
                'escalation_action': escalation_config.get('if_no_consensus', 'human_review')
            },
            recommendations=[
                f"Review failure in agent: {failed_agent}",
                "Consider manual intervention",
                "Check agent configuration and inputs"
            ]
        )

    def _create_result(
        self,
        context: FlowContext,
        status: FlowStatus,
        error: Optional[str] = None
    ) -> FlowResult:
        """Create a flow result from context."""
        # Synthesize final output from all agent outputs
        final_output = {}
        recommendations = []

        for agent_id, output in context.agent_outputs.items():
            if output.status == AgentStatus.COMPLETED:
                final_output[agent_id] = output.outputs

                # Extract recommendations if present
                if 'action_plan' in output.outputs:
                    plan = output.outputs['action_plan']
                    if isinstance(plan, dict):
                        for actions in plan.values():
                            if isinstance(actions, list):
                                recommendations.extend(actions)

        if error:
            final_output['error'] = error

        result = FlowResult(
            flow_id=context.flow_id,
            flow_name=context.flow_name,
            status=status,
            context=context,
            final_output=final_output,
            report=self._generate_report(context, status),
            recommendations=recommendations[:10]  # Top 10 recommendations
        )

        self.execution_history.append(result)
        return result

    def _generate_report(self, context: FlowContext, status: FlowStatus) -> str:
        """Generate a markdown report from flow execution."""
        lines = [
            f"# Flow Execution Report: {context.flow_name}",
            f"*Flow ID: {context.flow_id}*",
            f"*Status: {status.value.upper()}*",
            "",
            f"**Start Time**: {context.start_time.strftime('%Y-%m-%d %H:%M:%S')}",
        ]

        if context.end_time:
            duration = (context.end_time - context.start_time).total_seconds()
            lines.extend([
                f"**End Time**: {context.end_time.strftime('%Y-%m-%d %H:%M:%S')}",
                f"**Duration**: {duration:.1f} seconds",
            ])

        lines.extend([
            "",
            "## Trigger Data",
            "",
            "```json",
            json.dumps(context.trigger_data, indent=2, default=str),
            "```",
            "",
            "## Agent Executions",
            ""
        ])

        for agent_id, output in context.agent_outputs.items():
            status_icon = "✅" if output.status == AgentStatus.COMPLETED else "❌"
            lines.extend([
                f"### {status_icon} {agent_id}",
                "",
                f"- **Status**: {output.status.value}",
                f"- **Execution Time**: {output.execution_time_seconds:.2f}s",
            ])

            if output.reasoning:
                lines.append(f"- **Reasoning**: {output.reasoning}")

            if output.error:
                lines.append(f"- **Error**: {output.error}")

            if output.outputs:
                lines.extend([
                    "",
                    "**Outputs**:",
                    "```json",
                    json.dumps(output.outputs, indent=2, default=str)[:500],
                    "```",
                ])

            lines.append("")

        return "\n".join(lines)

    def get_execution_history(self, limit: int = 10) -> List[Dict]:
        """Get recent flow execution history."""
        recent = self.execution_history[-limit:]
        return [r.to_dict() for r in reversed(recent)]
