"""
MCP Core Type Definitions
=========================

This module defines all core types for the MCP subsystem.
These types are frozen as per MCP_SPEC.md v5.0.

See: docs/architecture/MCP_SPEC.md §4, §6
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class TransportType(Enum):
    """
    MCP Transport types.

    Phase 1-2: Only STDIO is implemented.
    HTTP and WEBSOCKET are reserved for future expansion.

    IMPORTANT: Do not hardcode transport types in server implementations.
    Always use configuration to specify transport.
    """
    STDIO = "stdio"
    HTTP = "http"
    WEBSOCKET = "websocket"


class ToolRisk(Enum):
    """
    Tool risk classification for permission matrix.

    See: MCP_SPEC.md §7.2

    - READ_ONLY: No side effects, no confirmation needed
    - MUTATING: Modifies data, requires audit logging
    - EXTERNAL: Network calls, requires rate limiting
    - FINANCIAL: Monetary impact, MUST require user confirmation
    """
    READ_ONLY = "read_only"
    MUTATING = "mutating"
    EXTERNAL = "external"
    FINANCIAL = "financial"


class ServerType(Enum):
    """
    MCP Server types.

    - CUSTOM: Python implementation in src/runtime/mcp/servers/
    - EXTERNAL: External process (e.g., npx @modelcontextprotocol/server-*)
    """
    CUSTOM = "custom"
    EXTERNAL = "external"


class ToolStability(Enum):
    """
    Tool stability classification per MCP_CONTRACT.md §3.2.

    - STABLE: Can be relied upon long-term, no breaking changes allowed
    - EXPERIMENTAL: May change, Agents should not use by default
    - DEPRECATED: Will be removed, must provide migration path
    """
    STABLE = "stable"
    EXPERIMENTAL = "experimental"
    DEPRECATED = "deprecated"


@dataclass
class MCPTool:
    """
    Represents an MCP tool exposed by a server.

    Attributes:
        name: Unique tool identifier (kebab-case)
        description: Human-readable description for LLM
        input_schema: JSON Schema for tool arguments
        risk_level: Risk classification for permission control
        stability: Tool stability level per MCP_CONTRACT.md §3.2
        requires_confirmation: Whether user confirmation is needed

    Contract Compliance (MCP_CONTRACT.md §3):
        - Tool must have single responsibility
        - Name must be business-semantic (not API-semantic)
        - Stability must be declared
    """
    name: str
    description: str
    input_schema: Dict[str, Any]
    risk_level: ToolRisk = ToolRisk.READ_ONLY
    stability: ToolStability = ToolStability.STABLE
    requires_confirmation: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to MCP protocol format."""
        return {
            "name": self.name,
            "description": self.description,
            "inputSchema": self.input_schema,
            "stability": self.stability.value,
        }


@dataclass
class MCPResource:
    """
    Represents an MCP resource exposed by a server.

    Resources are read-only context data accessible to the AI.

    Attributes:
        uri: Resource URI (e.g., "qdrant://collection/documents")
        name: Human-readable name
        description: Description for LLM
        mime_type: MIME type of resource content
    """
    uri: str
    name: str
    description: str
    mime_type: str = "application/json"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to MCP protocol format."""
        return {
            "uri": self.uri,
            "name": self.name,
            "description": self.description,
            "mimeType": self.mime_type,
        }


@dataclass
class MCPPermissions:
    """
    Permission configuration for an MCP server.

    See: MCP_SPEC.md §7
    """
    read: bool = True
    write: bool = False
    allowed_paths: List[str] = field(default_factory=list)
    denied_paths: List[str] = field(default_factory=list)
    allowed_tools: List[str] = field(default_factory=list)
    denied_tools: List[str] = field(default_factory=list)
    rate_limit: Optional[int] = None  # requests per minute


@dataclass
class MCPServerConfig:
    """
    Configuration for an MCP server.

    This is the primary configuration type used by MCPRegistry.

    Attributes:
        name: Server identifier (kebab-case, e.g., "qdrant-knowledge")
        server_type: CUSTOM or EXTERNAL
        transport: Transport type (stdio, http, websocket)
        enabled: Whether server is enabled

        # For CUSTOM servers
        module: Python module path (e.g., "src.runtime.mcp.servers.knowledge.qdrant_server")
        class_name: Server class name (e.g., "QdrantMCPServer")

        # For EXTERNAL servers
        command: Command to run (e.g., "npx")
        args: Command arguments
        env: Environment variables

        # Common
        config: Server-specific configuration
        permissions: Permission settings
        tools: List of tool names exposed by this server
    """
    name: str
    server_type: ServerType
    transport: TransportType = TransportType.STDIO
    enabled: bool = True

    # CUSTOM server fields
    module: Optional[str] = None
    class_name: Optional[str] = None

    # EXTERNAL server fields
    command: Optional[str] = None
    args: List[str] = field(default_factory=list)
    env: Dict[str, str] = field(default_factory=dict)

    # Common fields
    config: Dict[str, Any] = field(default_factory=dict)
    permissions: MCPPermissions = field(default_factory=MCPPermissions)
    tools: List[str] = field(default_factory=list)

    def __post_init__(self):
        """Validate configuration."""
        if self.server_type == ServerType.CUSTOM:
            if not self.module or not self.class_name:
                raise ValueError(
                    f"CUSTOM server '{self.name}' requires 'module' and 'class_name'"
                )
        elif self.server_type == ServerType.EXTERNAL:
            if not self.command:
                raise ValueError(
                    f"EXTERNAL server '{self.name}' requires 'command'"
                )


@dataclass
class ToolInvocation:
    """
    Record of a tool invocation for audit logging.

    See: MCP_SPEC.md §7.3
    """
    timestamp: str
    server_name: str
    tool_name: str
    agent_id: str
    arguments: Dict[str, Any]
    result_preview: Optional[str] = None
    duration_ms: int = 0
    success: bool = True
    error_message: Optional[str] = None


@dataclass
class MCPMessage:
    """
    Base MCP protocol message (JSON-RPC 2.0).
    """
    jsonrpc: str = "2.0"
    id: Optional[int] = None
    method: Optional[str] = None
    params: Optional[Dict[str, Any]] = None
    result: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-RPC format."""
        msg = {"jsonrpc": self.jsonrpc}
        if self.id is not None:
            msg["id"] = self.id
        if self.method:
            msg["method"] = self.method
        if self.params:
            msg["params"] = self.params
        if self.result is not None:
            msg["result"] = self.result
        if self.error:
            msg["error"] = self.error
        return msg
