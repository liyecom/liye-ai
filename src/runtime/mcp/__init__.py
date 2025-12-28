"""
LiYe OS MCP (Model Context Protocol) Module
============================================

MCP is the standardized interface for LiYe OS to communicate with external services.

Architecture Position: src/runtime/mcp/ (Runtime Layer)

Core Components:
- types: Core type definitions (MCPTool, MCPResource, MCPServerConfig)
- transport: Transport abstraction layer (stdio, http, websocket)
- registry: Server registration and lifecycle management
- base_server: Abstract base class for MCP servers
- security: Credential vault and permission matrix
- adapters: Integration adapters for agent frameworks

Usage:
    from src.runtime.mcp import MCPRegistry, MCPToolProvider

    registry = MCPRegistry.from_config("config/mcp_servers.yaml")
    provider = MCPToolProvider(registry)
    tools = provider.get_tools(["qdrant-knowledge", "sellersprite"])

See: docs/architecture/MCP_SPEC.md for full specification.

Version: 5.0
Status: FROZEN (architecture), IN_PROGRESS (implementation)
"""

from .types import (
    MCPTool,
    MCPResource,
    MCPServerConfig,
    MCPPermissions,
    ToolRisk,
    ToolStability,
    TransportType,
    ServerType,
)
from .registry import MCPRegistry
from .base_server import BaseMCPServer, ToolNotFoundError, ToolExecutionError
from .adapters.crewai_adapter import MCPToolProvider

__all__ = [
    # Types
    "MCPTool",
    "MCPResource",
    "MCPServerConfig",
    "MCPPermissions",
    "ToolRisk",
    "ToolStability",
    "TransportType",
    "ServerType",
    # Core
    "MCPRegistry",
    "BaseMCPServer",
    "ToolNotFoundError",
    "ToolExecutionError",
    # Adapters
    "MCPToolProvider",
]

__version__ = "5.0.0"
