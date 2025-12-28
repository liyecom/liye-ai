"""
CrewAI MCP Adapter
==================

Adapter for integrating MCP servers with CrewAI agents.

This adapter converts MCP tools to CrewAI-compatible BaseTool instances,
enabling agents to use MCP servers transparently.

See: docs/architecture/MCP_SPEC.md §8
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional, Type
from functools import wraps

from ..registry import MCPRegistry
from ..base_server import BaseMCPServer
from ..types import MCPTool, MCPServerConfig

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run async function in sync context."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If we're already in an async context, create a new thread
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, coro)
                return future.result()
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        # No event loop, create one
        return asyncio.run(coro)


class MCPToolWrapper:
    """
    Wrapper that converts an MCP tool to a CrewAI-compatible tool.

    This class dynamically creates a tool class that:
    - Has the MCP tool's name and description
    - Calls the MCP server's handle_tool method
    - Handles async-to-sync conversion for CrewAI
    """

    def __init__(
        self,
        server: BaseMCPServer,
        tool: MCPTool,
        server_name: str
    ):
        self._server = server
        self._tool = tool
        self._server_name = server_name

        # Set tool attributes
        self.name = tool.name
        self.description = tool.description

    def _run(self, *args, **kwargs) -> str:
        """
        Execute the MCP tool.

        This is the method CrewAI calls when using the tool.
        CrewAI may pass input as:
        - Direct kwargs
        - A string that needs JSON parsing
        - A single positional argument
        """
        import json

        # Log what we receive for debugging
        logger.debug(f"Tool {self.name} _run called with args={args}, kwargs={kwargs}")

        # Handle positional arguments (CrewAI sometimes passes input this way)
        if args and not kwargs:
            # First positional arg might be the input
            first_arg = args[0]
            if isinstance(first_arg, str):
                try:
                    kwargs = json.loads(first_arg)
                except json.JSONDecodeError:
                    # Not JSON, try to map to first required param
                    schema = self._tool.input_schema
                    if schema and schema.get('required'):
                        kwargs = {schema['required'][0]: first_arg}
                    else:
                        kwargs = {'query': first_arg}  # Default fallback
            elif isinstance(first_arg, dict):
                kwargs = first_arg

        try:
            # Handle various input formats from CrewAI
            parsed_kwargs = self._parse_input(kwargs)

            # Run async handle_tool in sync context
            result = _run_async(
                self._server.handle_tool(self._tool.name, parsed_kwargs)
            )

            # Format result as string for CrewAI
            if isinstance(result, dict):
                return self._format_result(result)
            return str(result)

        except Exception as e:
            logger.error(f"MCP tool execution failed: {e}")
            return f"Error executing {self.name}: {str(e)}"

    def _parse_input(self, kwargs: Dict[str, Any]) -> Dict[str, Any]:
        """Parse input from CrewAI into proper tool arguments."""
        import json

        logger.debug(f"Tool {self.name} received kwargs: {kwargs}")

        # If kwargs is empty, nothing to parse
        if not kwargs:
            return {}

        # Check for common CrewAI input patterns
        for key in ['tool_input', 'input', 'args', 'arguments']:
            if key in kwargs:
                value = kwargs[key]
                # If it's a string, try to parse as JSON
                if isinstance(value, str):
                    try:
                        parsed = json.loads(value)
                        if isinstance(parsed, dict):
                            return parsed
                    except json.JSONDecodeError:
                        # Not JSON, might be a simple string query
                        # Check tool schema for the expected parameter
                        schema = self._tool.input_schema
                        if schema and 'properties' in schema:
                            props = schema['properties']
                            # Find the first string parameter
                            for prop_name, prop_def in props.items():
                                if prop_def.get('type') == 'string':
                                    return {prop_name: value}
                        # Fallback: use "query" as default
                        return {'query': value}
                elif isinstance(value, dict):
                    return value

        # If kwargs directly contain expected parameters, use them
        if self._tool.input_schema and 'properties' in self._tool.input_schema:
            props = self._tool.input_schema['properties']
            # Check if any expected property is in kwargs
            for prop_name in props:
                if prop_name in kwargs:
                    return kwargs

        # Last resort: if there's a single key-value, try to use it intelligently
        if len(kwargs) == 1:
            key, value = next(iter(kwargs.items()))
            if isinstance(value, str):
                try:
                    parsed = json.loads(value)
                    if isinstance(parsed, dict):
                        return parsed
                except json.JSONDecodeError:
                    # Try to map to expected parameter
                    if self._tool.input_schema and 'required' in self._tool.input_schema:
                        required = self._tool.input_schema['required']
                        if required:
                            return {required[0]: value}
                    return {'query': value}

        # Default: return as-is
        return kwargs

    def _format_result(self, result: Dict[str, Any]) -> str:
        """Format dictionary result as readable string."""
        if "error" in result:
            return f"Error: {result['error']}"

        # Handle semantic_search results
        if "results" in result and isinstance(result["results"], list):
            output = f"Query: {result.get('query', 'N/A')}\n"
            output += f"Found {result.get('total_results', len(result['results']))} results\n\n"

            for i, doc in enumerate(result["results"], 1):
                output += f"## Result {i}: {doc.get('source_file', 'Unknown')}\n"
                output += f"Score: {doc.get('score', 0)}%\n"
                output += f"Section: {doc.get('section_title', 'N/A')}\n"
                if doc.get('text_preview'):
                    output += f"Preview: {doc['text_preview'][:500]}...\n"
                output += "\n"

            return output

        # Generic formatting
        lines = []
        for key, value in result.items():
            if isinstance(value, list):
                lines.append(f"{key}:")
                for item in value:
                    lines.append(f"  - {item}")
            else:
                lines.append(f"{key}: {value}")
        return "\n".join(lines)


def create_crewai_tool(wrapper: MCPToolWrapper) -> Any:
    """
    Create a CrewAI BaseTool from an MCPToolWrapper.

    This function dynamically creates a tool class compatible with CrewAI.
    """
    try:
        from crewai.tools import BaseTool
        from pydantic import PrivateAttr, Field, create_model, BaseModel
        from typing import Optional, Type, ClassVar
    except ImportError:
        logger.warning("CrewAI not installed, returning wrapper directly")
        return wrapper

    # Capture wrapper in closure to avoid serialization issues
    captured_wrapper = wrapper

    # Create args_schema from MCP tool's input_schema
    args_schema_class: Optional[Type[BaseModel]] = None
    input_schema = wrapper._tool.input_schema
    if input_schema and input_schema.get('properties'):
        # Build Pydantic model fields from JSON schema
        fields = {}
        properties = input_schema.get('properties', {})
        required = input_schema.get('required', [])

        for prop_name, prop_def in properties.items():
            prop_type = prop_def.get('type', 'string')
            prop_desc = prop_def.get('description', '')
            prop_default = prop_def.get('default')

            # Map JSON schema types to Python types
            type_mapping = {
                'string': str,
                'integer': int,
                'number': float,
                'boolean': bool,
                'array': list,
                'object': dict,
            }
            python_type = type_mapping.get(prop_type, str)

            # Required fields vs optional fields
            if prop_name in required:
                if prop_default is not None:
                    fields[prop_name] = (python_type, Field(default=prop_default, description=prop_desc))
                else:
                    fields[prop_name] = (python_type, Field(..., description=prop_desc))
            else:
                fields[prop_name] = (Optional[python_type], Field(default=prop_default, description=prop_desc))

        if fields:
            # Create dynamic Pydantic model for args_schema
            schema_name = f"{wrapper.name.replace('-', '_').replace('.', '_')}Schema"
            args_schema_class = create_model(schema_name, **fields)

    # Create a dynamic tool class
    # Pass name and description through __init__ instead of class attributes
    # to avoid Pydantic field override issues
    tool_name = captured_wrapper.name
    tool_desc = captured_wrapper.description

    class DynamicMCPTool(BaseTool):
        # Use PrivateAttr for non-Pydantic fields
        _mcp_wrapper: MCPToolWrapper = PrivateAttr(default=None)

        def _run(self, *args, **kwargs) -> str:
            return self._mcp_wrapper._run(*args, **kwargs)

    # Set class name for debugging
    DynamicMCPTool.__name__ = f"MCP_{captured_wrapper.name.replace('-', '_').replace('.', '_')}"

    # Create instance with name, description, and args_schema passed to __init__
    init_kwargs = {'name': tool_name, 'description': tool_desc}
    if args_schema_class:
        init_kwargs['args_schema'] = args_schema_class

    instance = DynamicMCPTool(**init_kwargs)
    instance._mcp_wrapper = captured_wrapper

    return instance


class MCPToolProvider:
    """
    Provider that converts MCP servers to CrewAI tools.

    This is the main interface for agents to access MCP tools.

    Usage:
        # Initialize registry
        registry = MCPRegistry.from_config("config/mcp_servers.yaml")

        # Create provider
        provider = MCPToolProvider(registry)

        # Get tools for agent
        tools = provider.get_tools(["qdrant-knowledge", "sellersprite"])

        # Use in agent
        agent = Agent(
            config=agent_config,
            tools=tools,
            llm=model
        )
    """

    def __init__(self, registry: MCPRegistry):
        """
        Initialize the provider.

        Args:
            registry: MCPRegistry with server configurations
        """
        self._registry = registry
        self._tool_cache: Dict[str, List[Any]] = {}
        self._initialized_servers: set = set()

    def get_tools(
        self,
        server_names: List[str],
        tool_filter: Optional[List[str]] = None
    ) -> List[Any]:
        """
        Get CrewAI-compatible tools from specified MCP servers.

        Args:
            server_names: List of server names to get tools from
            tool_filter: Optional list of tool names to include
                        (if None, includes all tools)

        Returns:
            List of CrewAI BaseTool instances

        Example:
            tools = provider.get_tools(
                ["qdrant-knowledge"],
                tool_filter=["semantic_search"]
            )
        """
        all_tools = []

        for server_name in server_names:
            # Check cache first
            if server_name in self._tool_cache:
                server_tools = self._tool_cache[server_name]
            else:
                server_tools = self._load_server_tools(server_name)
                self._tool_cache[server_name] = server_tools

            # Apply filter if specified
            if tool_filter:
                server_tools = [
                    t for t in server_tools
                    if getattr(t, 'name', '') in tool_filter
                ]

            all_tools.extend(server_tools)

        logger.info(f"Loaded {len(all_tools)} tools from {len(server_names)} servers")
        return all_tools

    def _load_server_tools(self, server_name: str) -> List[Any]:
        """Load and wrap tools from a server."""
        server = self._registry.get_server(server_name)

        if not server:
            logger.warning(f"Server not found or disabled: {server_name}")
            return []

        # Initialize server if needed
        if server_name not in self._initialized_servers:
            try:
                _run_async(server.initialize())
                self._initialized_servers.add(server_name)
            except Exception as e:
                logger.error(f"Failed to initialize server {server_name}: {e}")
                return []

        # Get tools and wrap them
        tools = []
        for mcp_tool in server.list_tools():
            wrapper = MCPToolWrapper(server, mcp_tool, server_name)
            crewai_tool = create_crewai_tool(wrapper)
            tools.append(crewai_tool)
            logger.debug(f"Wrapped tool: {mcp_tool.name} from {server_name}")

        return tools

    def get_tool(
        self,
        server_name: str,
        tool_name: str
    ) -> Optional[Any]:
        """
        Get a specific tool by name.

        Args:
            server_name: Server name
            tool_name: Tool name

        Returns:
            CrewAI BaseTool instance or None if not found
        """
        tools = self.get_tools([server_name], tool_filter=[tool_name])
        return tools[0] if tools else None

    def list_available_tools(self) -> Dict[str, List[str]]:
        """
        List all available tools from all enabled servers.

        Returns:
            Dictionary mapping server name to list of tool names
        """
        result = {}

        for config in self._registry.list_configs(enabled_only=True):
            server = self._registry.get_server(config.name)
            if server:
                try:
                    if config.name not in self._initialized_servers:
                        _run_async(server.initialize())
                        self._initialized_servers.add(config.name)

                    result[config.name] = [
                        tool.name for tool in server.list_tools()
                    ]
                except Exception as e:
                    logger.error(f"Failed to list tools for {config.name}: {e}")
                    result[config.name] = []

        return result

    async def shutdown(self) -> None:
        """Shutdown all initialized servers."""
        for server_name in self._initialized_servers:
            server = self._registry.get_server(server_name)
            if server:
                try:
                    await server.shutdown()
                except Exception as e:
                    logger.error(f"Error shutting down {server_name}: {e}")

        self._initialized_servers.clear()
        self._tool_cache.clear()
