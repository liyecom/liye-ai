"""
MCP Server Abstract Base Class
==============================

This module defines the abstract base class for all MCP server implementations.

All custom MCP servers in src/runtime/mcp/servers/ MUST inherit from BaseMCPServer.

See: docs/architecture/MCP_SPEC.md §6
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
import logging

from .types import MCPTool, MCPResource, MCPServerConfig
from .transport.base import MCPTransport


logger = logging.getLogger(__name__)


class BaseMCPServer(ABC):
    """
    Abstract base class for MCP server implementations.

    All MCP servers must inherit from this class and implement:
    - server_name: Unique identifier for the server
    - list_tools(): Return list of available tools
    - handle_tool(): Execute a tool call

    Optional:
    - list_resources(): Return list of available resources
    - handle_resource(): Read a resource

    Usage (implementing a server):
        class QdrantMCPServer(BaseMCPServer):
            @property
            def server_name(self) -> str:
                return "qdrant-knowledge"

            def list_tools(self) -> List[MCPTool]:
                return [
                    MCPTool(
                        name="semantic_search",
                        description="Search knowledge base",
                        input_schema={...}
                    )
                ]

            async def handle_tool(self, name: str, arguments: dict) -> dict:
                if name == "semantic_search":
                    return await self._search(arguments)

    IMPORTANT:
    - Do NOT store cross-call state in the server
    - Do NOT directly operate Transport (use base class methods)
    - Do NOT define business logic (that belongs in Skill/Domain)
    """

    def __init__(self, config: MCPServerConfig):
        """
        Initialize the server with configuration.

        Args:
            config: Server configuration from MCPRegistry
        """
        self._config = config
        self._transport: Optional[MCPTransport] = None
        self._initialized: bool = False

    @property
    @abstractmethod
    def server_name(self) -> str:
        """
        Return the unique server identifier.

        Must be kebab-case (e.g., "qdrant-knowledge").
        """
        pass

    @property
    def config(self) -> MCPServerConfig:
        """Return server configuration."""
        return self._config

    @property
    def is_initialized(self) -> bool:
        """Check if server has been initialized."""
        return self._initialized

    def set_transport(self, transport: MCPTransport) -> None:
        """
        Set the transport for this server.

        Called by MCPRegistry during server initialization.
        """
        self._transport = transport

    async def initialize(self) -> None:
        """
        Initialize the server.

        Override this method to perform setup (e.g., connect to database).
        Always call super().initialize() first.
        """
        self._initialized = True
        logger.info(f"MCP Server '{self.server_name}' initialized")

    async def shutdown(self) -> None:
        """
        Shutdown the server.

        Override this method to perform cleanup.
        Always call super().shutdown() last.
        """
        self._initialized = False
        logger.info(f"MCP Server '{self.server_name}' shutdown")

    @abstractmethod
    def list_tools(self) -> List[MCPTool]:
        """
        Return list of tools exposed by this server.

        Returns:
            List of MCPTool definitions
        """
        pass

    @abstractmethod
    async def handle_tool(
        self,
        name: str,
        arguments: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute a tool call.

        Args:
            name: Tool name
            arguments: Tool arguments matching input_schema

        Returns:
            Tool result as dictionary

        Raises:
            ToolNotFoundError: If tool name is unknown
            ToolExecutionError: If execution fails
        """
        pass

    def list_resources(self) -> List[MCPResource]:
        """
        Return list of resources exposed by this server.

        Override this method if your server exposes resources.
        Default implementation returns empty list.

        Returns:
            List of MCPResource definitions
        """
        return []

    async def handle_resource(
        self,
        uri: str
    ) -> Dict[str, Any]:
        """
        Read a resource.

        Override this method if your server exposes resources.

        Args:
            uri: Resource URI

        Returns:
            Resource content as dictionary

        Raises:
            ResourceNotFoundError: If resource URI is unknown
        """
        raise ResourceNotFoundError(f"Resource not found: {uri}")

    def get_tool(self, name: str) -> Optional[MCPTool]:
        """
        Get a specific tool by name.

        Args:
            name: Tool name

        Returns:
            MCPTool if found, None otherwise
        """
        for tool in self.list_tools():
            if tool.name == name:
                return tool
        return None

    def has_tool(self, name: str) -> bool:
        """Check if server has a specific tool."""
        return self.get_tool(name) is not None

    async def __aenter__(self):
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.shutdown()
        return False


class ToolNotFoundError(Exception):
    """Raised when a tool is not found."""
    pass


class ToolExecutionError(Exception):
    """Raised when tool execution fails."""

    def __init__(self, message: str, tool_name: str = "", details: Any = None):
        self.tool_name = tool_name
        self.details = details
        super().__init__(message)


class ResourceNotFoundError(Exception):
    """Raised when a resource is not found."""
    pass
