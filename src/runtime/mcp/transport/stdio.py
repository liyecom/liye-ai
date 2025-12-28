"""
MCP Stdio Transport Implementation
==================================

This module implements the stdio transport for MCP communication.

Stdio transport uses standard input/output streams to communicate
with a subprocess. This is the recommended transport for local
development and Phase 1-2 implementation.

See: docs/architecture/MCP_SPEC.md §4
"""

import asyncio
import json
import os
from typing import Any, Dict, List, Optional

from .base import MCPTransport, TransportError


class StdioTransport(MCPTransport):
    """
    Stdio-based MCP transport.

    Communicates with an MCP server subprocess via stdin/stdout.

    Usage:
        transport = StdioTransport(
            command="npx",
            args=["-y", "@modelcontextprotocol/server-filesystem", "/path"]
        )
        async with transport:
            result = await transport.request("tools/list")
    """

    def __init__(
        self,
        command: str,
        args: Optional[List[str]] = None,
        env: Optional[Dict[str, str]] = None,
        cwd: Optional[str] = None,
    ):
        """
        Initialize stdio transport.

        Args:
            command: Command to execute (e.g., "npx", "python")
            args: Command arguments
            env: Additional environment variables
            cwd: Working directory for subprocess
        """
        super().__init__()
        self._command = command
        self._args = args or []
        self._env = env or {}
        self._cwd = cwd

        self._process: Optional[asyncio.subprocess.Process] = None
        self._read_buffer: bytes = b""

    @property
    def transport_type(self) -> str:
        return "stdio"

    async def connect(self) -> None:
        """Start the subprocess and establish stdio communication."""
        if self._connected:
            return

        # Merge environment variables
        env = os.environ.copy()
        env.update(self._env)

        try:
            self._process = await asyncio.create_subprocess_exec(
                self._command,
                *self._args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
                cwd=self._cwd,
            )
            self._connected = True
        except FileNotFoundError:
            raise TransportError(
                f"Command not found: {self._command}"
            )
        except Exception as e:
            raise TransportError(
                f"Failed to start subprocess: {e}"
            )

    async def disconnect(self) -> None:
        """Terminate the subprocess."""
        if not self._connected or not self._process:
            return

        self._connected = False

        try:
            # Try graceful termination first
            self._process.terminate()
            try:
                await asyncio.wait_for(
                    self._process.wait(),
                    timeout=5.0
                )
            except asyncio.TimeoutError:
                # Force kill if graceful termination fails
                self._process.kill()
                await self._process.wait()
        except ProcessLookupError:
            # Process already terminated
            pass
        finally:
            self._process = None
            self._read_buffer = b""

    async def send(self, message: Dict[str, Any]) -> None:
        """Send a JSON-RPC message to the subprocess."""
        if not self._connected or not self._process or not self._process.stdin:
            raise TransportError("Not connected")

        try:
            # MCP uses newline-delimited JSON
            data = json.dumps(message) + "\n"
            self._process.stdin.write(data.encode("utf-8"))
            await self._process.stdin.drain()
        except Exception as e:
            raise TransportError(f"Failed to send message: {e}")

    async def receive(self, timeout: Optional[float] = None) -> Dict[str, Any]:
        """Receive a JSON-RPC message from the subprocess."""
        if not self._connected or not self._process or not self._process.stdout:
            raise TransportError("Not connected")

        try:
            # Read until we get a complete JSON line
            while True:
                # Check if we already have a complete line in buffer
                if b"\n" in self._read_buffer:
                    line, self._read_buffer = self._read_buffer.split(b"\n", 1)
                    return json.loads(line.decode("utf-8"))

                # Read more data
                if timeout is not None:
                    chunk = await asyncio.wait_for(
                        self._process.stdout.read(4096),
                        timeout=timeout
                    )
                else:
                    chunk = await self._process.stdout.read(4096)

                if not chunk:
                    # EOF - process terminated
                    raise TransportError("Subprocess terminated unexpectedly")

                self._read_buffer += chunk

        except asyncio.TimeoutError:
            raise TimeoutError(f"No response within {timeout} seconds")
        except json.JSONDecodeError as e:
            raise TransportError(f"Invalid JSON response: {e}")
        except Exception as e:
            if isinstance(e, (TransportError, TimeoutError)):
                raise
            raise TransportError(f"Failed to receive message: {e}")

    async def get_stderr(self) -> str:
        """
        Read any stderr output from the subprocess.

        Useful for debugging server errors.
        """
        if not self._process or not self._process.stderr:
            return ""

        try:
            # Non-blocking read of available stderr
            stderr_data = await asyncio.wait_for(
                self._process.stderr.read(4096),
                timeout=0.1
            )
            return stderr_data.decode("utf-8")
        except asyncio.TimeoutError:
            return ""
        except Exception:
            return ""
