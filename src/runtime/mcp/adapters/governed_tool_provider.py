"""
Governed MCP Tool Provider
==========================

Extends MCPToolProvider with LiYe Governance Kernel integration.
Every tool call goes through: Gate -> Execute -> Verdict -> Replay

Enable with: LIYE_GOVERNANCE_ENABLED=1

Fail Closed: governance error/timeout -> BLOCK (never ALLOW)

See: docs/integrations/CREWAI_GOVERNANCE_INTEGRATION_V1.md
"""

import json
import logging
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

from .crewai_adapter import MCPToolProvider, MCPToolWrapper, create_crewai_tool, _run_async

logger = logging.getLogger(__name__)

# Feature flag (P0-3)
GOVERNANCE_ENABLED = os.environ.get('LIYE_GOVERNANCE_ENABLED', '0') == '1'

# Path to governance bridge (P0-2)
BRIDGE_SCRIPT = Path(__file__).parent.parent.parent / 'governance' / 'governance_bridge.mjs'

# Default timeout: 5 seconds (P0-2 spec: 3-5s)
DEFAULT_TIMEOUT = 5


class GovernanceError(Exception):
    """Raised when governance check fails."""
    pass


class GovernanceBridge:
    """
    Bridge to JavaScript Governance Kernel via subprocess.

    Fail Closed: any error/timeout -> BLOCK (never ALLOW).
    """

    def __init__(self, timeout: int = DEFAULT_TIMEOUT):
        self.timeout = timeout
        self._bridge_path = str(BRIDGE_SCRIPT)
        # Get repo root for cwd
        self._repo_root = str(Path(__file__).parent.parent.parent.parent.parent)

    def call(
        self,
        task: str,
        proposed_actions: List[Dict],
        context: Optional[Dict] = None
    ) -> Dict:
        """
        Call governance bridge.

        Args:
            task: Task description
            proposed_actions: List of {server, tool, arguments, action_type}
            context: Optional context dict

        Returns:
            {
                ok: bool,
                trace_id: str,
                evidence_path: str,
                governance: {decision: str},
                gate_report: {...},
                verdict: {...},
                replay_result: {...},
                error: str (if not ok)
            }

        Fail Closed: error/timeout -> BLOCK
        """
        request = {
            'task': task,
            'context': context or {},
            'proposed_actions': proposed_actions
        }

        try:
            result = subprocess.run(
                ['node', self._bridge_path],
                input=json.dumps(request),
                capture_output=True,
                text=True,
                timeout=self.timeout,
                cwd=self._repo_root
            )

            if result.returncode != 0:
                stderr = result.stderr.strip()
                logger.error(f"Governance bridge error: {stderr}")
                # Fail Closed
                return self._fail_closed_response(f'Bridge error: {stderr}')

            try:
                return json.loads(result.stdout)
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON from bridge: {e}")
                return self._fail_closed_response(f'Invalid response: {e}')

        except subprocess.TimeoutExpired:
            logger.error(f"Governance bridge timeout after {self.timeout}s")
            return self._fail_closed_response(f'Governance timeout ({self.timeout}s)')

        except FileNotFoundError:
            logger.error(f"Bridge script not found: {self._bridge_path}")
            return self._fail_closed_response('Bridge script not found')

        except Exception as e:
            logger.error(f"Governance bridge exception: {e}")
            return self._fail_closed_response(str(e))

    def _fail_closed_response(self, error: str) -> Dict:
        """Return BLOCK response for Fail Closed semantics."""
        return {
            'ok': False,
            'error': error,
            'trace_id': None,
            'evidence_path': None,
            'governance': {'decision': 'UNKNOWN'},
            'gate_report': None,
            'verdict': None,
            'replay_result': None
        }


class GovernedToolWrapper(MCPToolWrapper):
    """
    Tool wrapper that enforces governance before execution.

    Flow:
    1. Build proposed_action from tool call
    2. Call governance bridge
    3. BLOCK/UNKNOWN -> reject with trace_id
    4. ALLOW/DEGRADE -> execute tool
    5. Return result with trace_id + evidence_path
    """

    def __init__(self, *args, governance: GovernanceBridge, **kwargs):
        super().__init__(*args, **kwargs)
        self._governance = governance

    def _run(self, *args, **kwargs) -> str:
        """Execute with governance enforcement."""
        import json as json_module

        # Parse input (same as parent)
        parsed_kwargs = {}
        if args and not kwargs:
            first_arg = args[0]
            if isinstance(first_arg, str):
                try:
                    parsed_kwargs = json_module.loads(first_arg)
                except json_module.JSONDecodeError:
                    schema = self._tool.input_schema
                    if schema and schema.get('required'):
                        parsed_kwargs = {schema['required'][0]: first_arg}
                    else:
                        parsed_kwargs = {'query': first_arg}
            elif isinstance(first_arg, dict):
                parsed_kwargs = first_arg
        else:
            parsed_kwargs = self._parse_input(kwargs)

        # Build proposed action (must include server, tool, arguments)
        proposed_action = {
            'action_type': self._infer_action_type(),
            'tool': self._tool.name,
            'server': self._server_name,
            'arguments': parsed_kwargs
        }

        # Build task description
        task = f"Execute {self._server_name}/{self._tool.name}"
        if parsed_kwargs.get('query'):
            task += f": {str(parsed_kwargs['query'])[:100]}"

        # Call governance bridge
        logger.info(f"Governance gate for {self._tool.name}")
        gov_result = self._governance.call(
            task=task,
            proposed_actions=[proposed_action],
            context={'server': self._server_name, 'tool': self._tool.name}
        )

        trace_id = gov_result.get('trace_id')
        evidence_path = gov_result.get('evidence_path')
        decision = gov_result.get('governance', {}).get('decision', 'UNKNOWN')

        # P0-4: Unified return structure
        base_response = {
            'trace_id': trace_id,
            'evidence_path': evidence_path,
            'governance': {'decision': decision}
        }

        # Fail Closed: BLOCK or UNKNOWN -> reject, do NOT execute
        if decision in ('BLOCK', 'UNKNOWN'):
            error_msg = gov_result.get('error', f'Blocked by governance: {decision}')
            logger.warning(f"Governance {decision}: {self._tool.name} - {error_msg}")
            return json_module.dumps({
                'ok': False,
                'error': error_msg,
                **base_response
            })

        # ALLOW or DEGRADE -> execute
        logger.info(f"Governance {decision}: executing {self._tool.name}")
        try:
            result = _run_async(
                self._server.handle_tool(self._tool.name, parsed_kwargs)
            )

            # Format response with governance metadata
            if isinstance(result, dict):
                return json_module.dumps({
                    'ok': True,
                    'result': result,
                    **base_response
                })

            return json_module.dumps({
                'ok': True,
                'result': str(result),
                **base_response
            })

        except Exception as e:
            logger.error(f"Tool execution failed: {e}")
            return json_module.dumps({
                'ok': False,
                'error': f'Execution error: {str(e)}',
                **base_response
            })

    def _infer_action_type(self) -> str:
        """Infer action type from tool name."""
        name = self._tool.name.lower()
        if any(x in name for x in ['search', 'query', 'get', 'list', 'read', 'find']):
            return 'read'
        if any(x in name for x in ['delete', 'remove', 'drop', 'truncate']):
            return 'delete'
        if any(x in name for x in ['write', 'create', 'insert', 'update', 'put', 'save']):
            return 'write'
        if any(x in name for x in ['send', 'email', 'notify', 'publish', 'post']):
            return 'send'
        return 'execute'


def create_governed_crewai_tool(wrapper: GovernedToolWrapper) -> Any:
    """Create CrewAI BaseTool from GovernedToolWrapper."""
    try:
        from crewai.tools import BaseTool
        from pydantic import PrivateAttr, Field, create_model
        from typing import Optional, Type
    except ImportError:
        logger.warning("CrewAI not installed, returning wrapper directly")
        return wrapper

    captured_wrapper = wrapper

    # Build args_schema from input_schema (same as crewai_adapter)
    args_schema_class = None
    input_schema = wrapper._tool.input_schema
    if input_schema and input_schema.get('properties'):
        fields = {}
        properties = input_schema.get('properties', {})
        required = input_schema.get('required', [])

        type_mapping = {
            'string': str, 'integer': int, 'number': float,
            'boolean': bool, 'array': list, 'object': dict,
        }

        for prop_name, prop_def in properties.items():
            prop_type = prop_def.get('type', 'string')
            prop_desc = prop_def.get('description', '')
            prop_default = prop_def.get('default')
            python_type = type_mapping.get(prop_type, str)

            if prop_name in required:
                if prop_default is not None:
                    fields[prop_name] = (python_type, Field(default=prop_default, description=prop_desc))
                else:
                    fields[prop_name] = (python_type, Field(..., description=prop_desc))
            else:
                fields[prop_name] = (Optional[python_type], Field(default=prop_default, description=prop_desc))

        if fields:
            schema_name = f"{wrapper.name.replace('-', '_').replace('.', '_')}GovernedSchema"
            args_schema_class = create_model(schema_name, **fields)

    tool_name = captured_wrapper.name
    tool_desc = f"[Governed] {captured_wrapper.description}"

    class GovernedDynamicMCPTool(BaseTool):
        _mcp_wrapper: GovernedToolWrapper = PrivateAttr(default=None)

        def _run(self, *args, **kwargs) -> str:
            return self._mcp_wrapper._run(*args, **kwargs)

    GovernedDynamicMCPTool.__name__ = f"Governed_MCP_{captured_wrapper.name.replace('-', '_').replace('.', '_')}"

    init_kwargs = {'name': tool_name, 'description': tool_desc}
    if args_schema_class:
        init_kwargs['args_schema'] = args_schema_class

    instance = GovernedDynamicMCPTool(**init_kwargs)
    instance._mcp_wrapper = captured_wrapper

    return instance


class GovernedMCPToolProvider(MCPToolProvider):
    """
    MCP Tool Provider with Governance Kernel enforcement.

    Every tool call goes through: Gate -> Execute -> Verdict -> Replay

    Usage:
        # Enable governance
        os.environ['LIYE_GOVERNANCE_ENABLED'] = '1'

        # Create provider
        provider = GovernedMCPToolProvider(registry)

        # Get governed tools - every call now produces evidence package
        tools = provider.get_tools(["qdrant-knowledge"])

        # Use in agent
        agent = Agent(tools=tools, ...)
    """

    def __init__(self, registry, governance_timeout: int = DEFAULT_TIMEOUT):
        super().__init__(registry)
        self._governance = GovernanceBridge(timeout=governance_timeout)

    def _load_server_tools(self, server_name: str) -> List[Any]:
        """Load tools with governance wrapper."""
        server = self._registry.get_server(server_name)

        if not server:
            logger.warning(f"Server not found or disabled: {server_name}")
            return []

        if server_name not in self._initialized_servers:
            try:
                _run_async(server.initialize())
                self._initialized_servers.add(server_name)
            except Exception as e:
                logger.error(f"Failed to initialize server {server_name}: {e}")
                return []

        tools = []
        for mcp_tool in server.list_tools():
            wrapper = GovernedToolWrapper(
                server, mcp_tool, server_name,
                governance=self._governance
            )
            crewai_tool = create_governed_crewai_tool(wrapper)
            tools.append(crewai_tool)
            logger.debug(f"Wrapped governed tool: {mcp_tool.name} from {server_name}")

        return tools


def get_tool_provider(registry, governed: Optional[bool] = None):
    """
    Factory function to get appropriate tool provider.

    Args:
        registry: MCPRegistry instance
        governed: Force governed mode (None = use env var LIYE_GOVERNANCE_ENABLED)

    Returns:
        MCPToolProvider or GovernedMCPToolProvider
    """
    use_governed = governed if governed is not None else GOVERNANCE_ENABLED

    if use_governed:
        logger.info("Using GovernedMCPToolProvider (governance enabled)")
        return GovernedMCPToolProvider(registry)
    else:
        logger.info("Using MCPToolProvider (governance disabled)")
        return MCPToolProvider(registry)
