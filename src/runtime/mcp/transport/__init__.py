"""
MCP Transport Layer
===================

This module provides the transport abstraction for MCP communication.

Phase 1-2: Only StdioTransport is implemented.
HTTP and WebSocket transports are reserved interfaces for future expansion.

See: docs/architecture/MCP_SPEC.md §4
"""

from .base import MCPTransport
from .stdio import StdioTransport

__all__ = [
    "MCPTransport",
    "StdioTransport",
]
