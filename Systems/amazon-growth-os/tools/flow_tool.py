"""
Flow Orchestration Tool for CrewAI Agents.

Provides multi-agent flow coordination capabilities
to CrewAI agents.
"""

from typing import Dict, Optional, Any
import json

# CrewAI integration with fallback
try:
    from crewai.tools import BaseTool
except ImportError:
    class BaseTool:
        def __init__(self):
            pass


class FlowOrchestrationTool(BaseTool):
    """
    Tool for orchestrating multi-agent flows.

    Allows agents to:
    - List available flows
    - Execute multi-agent flows
    - Get flow execution history
    - Check active flow status
    """

    name: str = "Flow Orchestrator"
    description: str = """
    Orchestrate multi-agent flows for complex scenarios.

    Actions:
    - list_flows: List available flows
    - execute_flow: Execute a multi-agent flow
    - get_history: Get flow execution history
    - get_status: Get status of active flows

    Available flows:
    - competitive_response: Respond to competitor price changes
    - brand_crisis: Handle brand health decline
    - product_launch: Launch new product
    - performance_optimization: Cross-functional optimization

    Input format (JSON):
    {
        "action": "list_flows|execute_flow|get_history|get_status",
        "params": {action-specific parameters}
    }
    """

    def __init__(
        self,
        config_path: Optional[str] = None
    ):
        """Initialize flow tool."""
        super().__init__()
        self.config_path = config_path
        self._orchestrator = None

    def _get_orchestrator(self):
        """Lazy initialization of flow orchestrator."""
        if self._orchestrator is None:
            from src.orchestration.flow_orchestrator import FlowOrchestrator
            self._orchestrator = FlowOrchestrator(
                config_path=self.config_path
            )
        return self._orchestrator

    def _run(self, query: str) -> str:
        """Execute the tool with the given query."""
        try:
            if isinstance(query, str):
                try:
                    params = json.loads(query)
                except json.JSONDecodeError:
                    params = self._parse_text_query(query)
            else:
                params = query

            action = params.get('action', 'list_flows')
            action_params = params.get('params', {})

            if action == 'list_flows':
                return self._list_flows()
            elif action == 'execute_flow':
                return self._execute_flow(action_params)
            elif action == 'get_history':
                return self._get_history(action_params)
            elif action == 'get_status':
                return self._get_status()
            else:
                return f"Unknown action: {action}"

        except Exception as e:
            return f"Error: {str(e)}"

    def _parse_text_query(self, query: str) -> Dict:
        """Parse natural language query."""
        query_lower = query.lower()

        if 'list' in query_lower or 'available' in query_lower:
            return {'action': 'list_flows'}
        elif 'execute' in query_lower or 'run' in query_lower:
            # Try to extract flow name
            for flow in ['competitive', 'crisis', 'launch', 'optimization']:
                if flow in query_lower:
                    flow_map = {
                        'competitive': 'competitive_response',
                        'crisis': 'brand_crisis',
                        'launch': 'product_launch',
                        'optimization': 'performance_optimization'
                    }
                    return {
                        'action': 'execute_flow',
                        'params': {'flow_id': flow_map[flow]}
                    }
            return {'action': 'execute_flow'}
        elif 'history' in query_lower:
            return {'action': 'get_history'}
        elif 'status' in query_lower or 'active' in query_lower:
            return {'action': 'get_status'}

        return {'action': 'list_flows'}

    def _list_flows(self) -> str:
        """List available flows."""
        orchestrator = self._get_orchestrator()
        flows = orchestrator.get_available_flows()

        lines = [
            "## Available Multi-Agent Flows",
            "",
            "| Flow ID | Name | Trigger | Description |",
            "|---------|------|---------|-------------|"
        ]

        for flow in flows:
            lines.append(
                f"| `{flow['id']}` | {flow['name']} | "
                f"{flow['trigger_type']} | {flow['description'][:50]}... |"
            )

        lines.extend([
            "",
            "### Usage",
            "",
            "To execute a flow:",
            "```json",
            '{"action": "execute_flow", "params": {"flow_id": "competitive_response", "trigger_data": {...}}}',
            "```"
        ])

        return "\n".join(lines)

    def _execute_flow(self, params: Dict) -> str:
        """Execute a multi-agent flow."""
        orchestrator = self._get_orchestrator()

        flow_id = params.get('flow_id')
        if not flow_id:
            return "Error: flow_id is required. Use list_flows to see available flows."

        trigger_data = params.get('trigger_data', {})
        dry_run = params.get('dry_run', False)

        result = orchestrator.execute_flow(
            flow_id=flow_id,
            trigger_data=trigger_data,
            dry_run=dry_run
        )

        # Format result
        status_icons = {
            'completed': '✅',
            'failed': '❌',
            'escalated': '⚠️',
            'timeout': '⏱️'
        }
        status_icon = status_icons.get(result.status.value, '❓')

        lines = [
            f"## {status_icon} Flow Execution: {result.flow_name}",
            "",
            f"**Flow ID**: `{result.flow_id}`",
            f"**Status**: {result.status.value.upper()}",
            ""
        ]

        # Duration
        if result.context.end_time:
            duration = (result.context.end_time - result.context.start_time).total_seconds()
            lines.append(f"**Duration**: {duration:.1f} seconds")
            lines.append("")

        # Agent results
        lines.append("### Agent Results")
        lines.append("")

        for agent_id, output in result.context.agent_outputs.items():
            agent_icon = "✅" if output.status.value == "completed" else "❌"
            lines.append(f"- {agent_icon} **{agent_id}**: {output.status.value}")

        lines.append("")

        # Recommendations
        if result.recommendations:
            lines.append("### Recommendations")
            lines.append("")
            for rec in result.recommendations[:5]:
                lines.append(f"- {rec}")
            lines.append("")

        # Full report available
        if result.report:
            lines.extend([
                "---",
                "",
                "*Full report available in flow context*"
            ])

        return "\n".join(lines)

    def _get_history(self, params: Dict) -> str:
        """Get flow execution history."""
        orchestrator = self._get_orchestrator()
        limit = params.get('limit', 10)

        history = orchestrator.get_execution_history(limit=limit)

        if not history:
            return "No flow executions in history."

        lines = [
            "## Flow Execution History",
            "",
            "| Time | Flow | Status | Duration |",
            "|------|------|--------|----------|"
        ]

        for execution in history:
            context = execution.get('context', {})
            start = context.get('start_time', '')[:19]
            duration = context.get('duration_seconds')
            duration_str = f"{duration:.1f}s" if duration else "N/A"

            status_icons = {
                'completed': '✅',
                'failed': '❌',
                'escalated': '⚠️'
            }
            status = execution.get('status', 'unknown')
            icon = status_icons.get(status, '❓')

            lines.append(
                f"| {start} | {execution.get('flow_name', 'Unknown')} | "
                f"{icon} {status} | {duration_str} |"
            )

        return "\n".join(lines)

    def _get_status(self) -> str:
        """Get status of active flows."""
        orchestrator = self._get_orchestrator()

        active = orchestrator.active_flows

        if not active:
            return "No flows currently active."

        lines = [
            "## Active Flows",
            "",
            "| Flow ID | Name | Started | Agents Completed |",
            "|---------|------|---------|------------------|"
        ]

        for flow_id, context in active.items():
            completed = sum(
                1 for o in context.agent_outputs.values()
                if o.status.value == "completed"
            )
            total = len(context.agent_outputs)

            lines.append(
                f"| `{flow_id[:20]}...` | {context.flow_name} | "
                f"{context.start_time.strftime('%H:%M:%S')} | {completed}/{total} |"
            )

        return "\n".join(lines)
