"""
MCP Transport Abstract Base Class
=================================

This module defines the abstract interface for MCP transports.

IMPORTANT: This abstraction is FROZEN per MCP_SPEC.md §4.
All transport implementations must inherit from MCPTransport.

Supported Transport Types:
- stdio: Local process communication (Phase 1-2)
- http: Remote HTTP communication (reserved)
- websocket: Real-time bidirectional (reserved)

See: docs/architecture/MCP_SPEC.md §4
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
import asyncio


class MCPTransport(ABC):
    """
    Abstract base class for MCP transport implementations.

    All MCP communication goes through a transport layer.
    This abstraction allows switching between stdio, HTTP, and WebSocket
    without changing server implementations.

    Usage:
        transport = StdioTransport(command="npx", args=[...])
        await transport.connect()
        await transport.send({"method": "tools/list"})
        response = await transport.receive()
        await transport.disconnect()
    """

    def __init__(self):
        self._connected: bool = False
        self._message_id: int = 0

    @property
    @abstractmethod
    def transport_type(self) -> str:
        """
        Return the transport type identifier.

        Returns:
            One of: "stdio", "http", "websocket"
        """
        pass

    @property
    def is_connected(self) -> bool:
        """Check if transport is currently connected."""
        return self._connected

    @abstractmethod
    async def connect(self) -> None:
        """
        Establish the transport connection.

        Raises:
            ConnectionError: If connection fails
        """
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        """
        Close the transport connection.

        Should be idempotent - safe to call multiple times.
        """
        pass

    @abstractmethod
    async def send(self, message: Dict[str, Any]) -> None:
        """
        Send a message through the transport.

        Args:
            message: JSON-RPC 2.0 message dictionary

        Raises:
            ConnectionError: If not connected
            TransportError: If send fails
        """
        pass

    @abstractmethod
    async def receive(self, timeout: Optional[float] = None) -> Dict[str, Any]:
        """
        Receive a message from the transport.

        Args:
            timeout: Maximum seconds to wait (None = infinite)

        Returns:
            JSON-RPC 2.0 message dictionary

        Raises:
            ConnectionError: If not connected
            TimeoutError: If timeout exceeded
            TransportError: If receive fails
        """
        pass

    def next_message_id(self) -> int:
        """Generate next unique message ID."""
        self._message_id += 1
        return self._message_id

    async def request(
        self,
        method: str,
        params: Optional[Dict[str, Any]] = None,
        timeout: Optional[float] = 30.0
    ) -> Any:
        """
        Send a request and wait for response.

        This is a convenience method that handles message ID matching.

        Args:
            method: JSON-RPC method name
            params: Method parameters
            timeout: Response timeout in seconds

        Returns:
            Response result or raises error

        Raises:
            MCPError: If server returns an error
            TimeoutError: If no response within timeout
        """
        msg_id = self.next_message_id()
        message = {
            "jsonrpc": "2.0",
            "id": msg_id,
            "method": method,
        }
        if params:
            message["params"] = params

        await self.send(message)
        response = await self.receive(timeout=timeout)

        if "error" in response:
            raise MCPError(
                code=response["error"].get("code", -1),
                message=response["error"].get("message", "Unknown error"),
                data=response["error"].get("data")
            )

        return response.get("result")

    async def notify(
        self,
        method: str,
        params: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Send a notification (no response expected).

        Args:
            method: JSON-RPC method name
            params: Method parameters
        """
        message = {
            "jsonrpc": "2.0",
            "method": method,
        }
        if params:
            message["params"] = params

        await self.send(message)

    async def __aenter__(self):
        """Async context manager entry."""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.disconnect()
        return False


class MCPError(Exception):
    """
    MCP protocol error.

    Raised when server returns an error response.
    """

    def __init__(self, code: int, message: str, data: Any = None):
        self.code = code
        self.message = message
        self.data = data
        super().__init__(f"MCP Error {code}: {message}")


class TransportError(Exception):
    """
    Transport-level error.

    Raised when transport communication fails.
    """
    pass
