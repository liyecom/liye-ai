"""
MCP Adapters
============

Adapters for integrating MCP servers with agent frameworks.

Adapters:
- MCPToolProvider: Standard CrewAI integration
- GovernedMCPToolProvider: With governance enforcement (enable via LIYE_GOVERNANCE_ENABLED=1)

See: docs/architecture/MCP_SPEC.md §8
"""

from .crewai_adapter import (
    MCPToolProvider,
    MCPToolWrapper,
    create_crewai_tool
)

from .governed_tool_provider import (
    GovernedMCPToolProvider,
    GovernedToolWrapper,
    GovernanceBridge,
    get_tool_provider,
    GOVERNANCE_ENABLED
)

__all__ = [
    # Standard adapter
    'MCPToolProvider',
    'MCPToolWrapper',
    'create_crewai_tool',
    # Governed adapter
    'GovernedMCPToolProvider',
    'GovernedToolWrapper',
    'GovernanceBridge',
    'get_tool_provider',
    'GOVERNANCE_ENABLED',
]
