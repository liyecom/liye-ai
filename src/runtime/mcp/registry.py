"""
MCP Server Registry
===================

This module provides the MCPRegistry for server registration,
discovery, and lifecycle management.

The registry implements the three-tier configuration model:
- System: src/runtime/mcp/config/default.yaml
- Domain: src/domain/*/config/mcp_servers.yaml
- Session: .claude/settings.local.json

See: docs/architecture/MCP_SPEC.md §5
"""

import importlib
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Type

import yaml

from .types import (
    MCPServerConfig,
    MCPPermissions,
    ServerType,
    TransportType,
)
from .base_server import BaseMCPServer
from .transport.base import MCPTransport
from .transport.stdio import StdioTransport


logger = logging.getLogger(__name__)


class MCPRegistry:
    """
    Central registry for MCP servers.

    The registry manages server configurations, instantiation,
    and lifecycle. It supports the three-tier configuration model.

    Usage:
        # Load from domain config (inherits system defaults)
        # Example: registry = MCPRegistry.from_config("src/domain/<your-domain>/config/mcp_servers.yaml")

        # Get a server
        server = registry.get_server("qdrant-knowledge")

        # List all enabled servers
        servers = registry.list_servers()

        # Initialize all servers
        await registry.initialize_all()

        # Shutdown all servers
        await registry.shutdown_all()
    """

    def __init__(self):
        self._configs: Dict[str, MCPServerConfig] = {}
        self._servers: Dict[str, BaseMCPServer] = {}
        self._transports: Dict[str, MCPTransport] = {}

    @classmethod
    def from_config(
        cls,
        config_path: str,
        system_config_path: Optional[str] = None
    ) -> "MCPRegistry":
        """
        Create registry from configuration file.

        Args:
            config_path: Path to domain config (mcp_servers.yaml)
            system_config_path: Path to system config (default.yaml)
                               If None, uses src/runtime/mcp/config/default.yaml

        Returns:
            Configured MCPRegistry instance
        """
        registry = cls()

        # Load system defaults
        if system_config_path is None:
            system_config_path = "src/runtime/mcp/config/default.yaml"

        if Path(system_config_path).exists():
            registry._load_config(system_config_path)

        # Load domain config (may override system)
        if Path(config_path).exists():
            registry._load_config(config_path, is_domain=True)

        return registry

    def _load_config(self, path: str, is_domain: bool = False) -> None:
        """Load configuration from YAML file."""
        with open(path, "r") as f:
            data = yaml.safe_load(f)

        if not data:
            return

        servers = data.get("servers", {})

        for name, server_data in servers.items():
            if is_domain:
                # Domain config can only enable/disable and override params
                if name in self._configs:
                    # Update existing config
                    existing = self._configs[name]
                    if "enabled" in server_data:
                        existing.enabled = server_data["enabled"]
                    # Support both 'override' and 'config' for overriding values
                    if "override" in server_data:
                        existing.config.update(server_data["override"])
                    if "config" in server_data:
                        existing.config.update(self._expand_env_vars(server_data["config"]))
                else:
                    # Domain defines new server (must be complete config)
                    config = self._parse_server_config(name, server_data)
                    self._configs[name] = config
            else:
                # System config - full definition
                config = self._parse_server_config(name, server_data)
                self._configs[name] = config

    def _parse_server_config(
        self,
        name: str,
        data: Dict[str, Any]
    ) -> MCPServerConfig:
        """Parse server configuration from dict."""
        # Parse server type
        server_type_str = data.get("type", "custom")
        server_type = ServerType(server_type_str)

        # Parse transport type
        transport_str = data.get("transport", "stdio")
        transport = TransportType(transport_str)

        # Parse permissions
        perm_data = data.get("permissions", {})
        permissions = MCPPermissions(
            read=perm_data.get("read", True),
            write=perm_data.get("write", False),
            allowed_paths=perm_data.get("allowed_paths", []),
            denied_paths=perm_data.get("denied_paths", []),
            allowed_tools=perm_data.get("allowed_tools", []),
            denied_tools=perm_data.get("denied_tools", []),
            rate_limit=perm_data.get("rate_limit"),
        )

        # Expand environment variables in config
        config = self._expand_env_vars(data.get("config", {}))

        return MCPServerConfig(
            name=name,
            server_type=server_type,
            transport=transport,
            enabled=data.get("enabled", True),
            module=data.get("module"),
            class_name=data.get("class"),
            command=data.get("command"),
            args=data.get("args", []),
            env=self._expand_env_vars(data.get("env", {})),
            config=config,
            permissions=permissions,
            tools=data.get("tools", []),
        )

    def _expand_env_vars(self, data: Any) -> Any:
        """Expand environment variables in configuration."""
        if isinstance(data, str):
            # Match ${VAR:-default} or ${VAR}
            pattern = r'\$\{(\w+)(?::-([^}]*))?\}'

            def replace(match):
                var_name = match.group(1)
                default = match.group(2) or ""
                return os.environ.get(var_name, default)

            return re.sub(pattern, replace, data)
        elif isinstance(data, dict):
            return {k: self._expand_env_vars(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._expand_env_vars(item) for item in data]
        return data

    def register(self, config: MCPServerConfig) -> None:
        """
        Register a server configuration.

        Args:
            config: Server configuration
        """
        self._configs[config.name] = config
        logger.info(f"Registered MCP server: {config.name}")

    def unregister(self, name: str) -> None:
        """
        Unregister a server.

        Args:
            name: Server name
        """
        if name in self._configs:
            del self._configs[name]
        if name in self._servers:
            del self._servers[name]
        if name in self._transports:
            del self._transports[name]
        logger.info(f"Unregistered MCP server: {name}")

    def get_config(self, name: str) -> Optional[MCPServerConfig]:
        """
        Get server configuration by name.

        Args:
            name: Server name

        Returns:
            MCPServerConfig if found, None otherwise
        """
        return self._configs.get(name)

    def list_configs(self, enabled_only: bool = True) -> List[MCPServerConfig]:
        """
        List all server configurations.

        Args:
            enabled_only: If True, only return enabled servers

        Returns:
            List of server configurations
        """
        configs = list(self._configs.values())
        if enabled_only:
            configs = [c for c in configs if c.enabled]
        return configs

    def get_server(self, name: str) -> Optional[BaseMCPServer]:
        """
        Get or create a server instance.

        Args:
            name: Server name

        Returns:
            BaseMCPServer instance if configured, None otherwise
        """
        if name in self._servers:
            return self._servers[name]

        config = self._configs.get(name)
        if not config or not config.enabled:
            return None

        if config.server_type == ServerType.CUSTOM:
            server = self._create_custom_server(config)
        else:
            # External servers are managed differently
            # They communicate via transport, not direct instance
            server = None

        if server:
            self._servers[name] = server

        return server

    def _create_custom_server(self, config: MCPServerConfig) -> BaseMCPServer:
        """Create a custom server instance from module path."""
        try:
            # Import the module
            module = importlib.import_module(config.module)

            # Get the class
            server_class: Type[BaseMCPServer] = getattr(module, config.class_name)

            # Create instance
            server = server_class(config)

            return server
        except ImportError as e:
            raise ImportError(
                f"Failed to import module '{config.module}': {e}"
            )
        except AttributeError as e:
            raise AttributeError(
                f"Class '{config.class_name}' not found in module '{config.module}': {e}"
            )

    def get_transport(self, name: str) -> Optional[MCPTransport]:
        """
        Get or create a transport for a server.

        Args:
            name: Server name

        Returns:
            MCPTransport instance if configured, None otherwise
        """
        if name in self._transports:
            return self._transports[name]

        config = self._configs.get(name)
        if not config or not config.enabled:
            return None

        transport = self._create_transport(config)
        if transport:
            self._transports[name] = transport

        return transport

    def _create_transport(self, config: MCPServerConfig) -> Optional[MCPTransport]:
        """Create appropriate transport for server."""
        if config.transport == TransportType.STDIO:
            if config.server_type == ServerType.EXTERNAL:
                return StdioTransport(
                    command=config.command,
                    args=config.args,
                    env=config.env,
                )
            # CUSTOM servers may not need external transport
            return None
        elif config.transport == TransportType.HTTP:
            # Reserved for future implementation
            raise NotImplementedError("HTTP transport not yet implemented")
        elif config.transport == TransportType.WEBSOCKET:
            # Reserved for future implementation
            raise NotImplementedError("WebSocket transport not yet implemented")

        return None

    async def initialize_all(self) -> None:
        """Initialize all enabled servers."""
        for name, config in self._configs.items():
            if not config.enabled:
                continue

            try:
                server = self.get_server(name)
                if server:
                    await server.initialize()

                transport = self.get_transport(name)
                if transport:
                    await transport.connect()

                logger.info(f"Initialized MCP server: {name}")
            except Exception as e:
                logger.error(f"Failed to initialize MCP server '{name}': {e}")

    async def shutdown_all(self) -> None:
        """Shutdown all servers."""
        for name, server in self._servers.items():
            try:
                await server.shutdown()
            except Exception as e:
                logger.error(f"Error shutting down server '{name}': {e}")

        for name, transport in self._transports.items():
            try:
                await transport.disconnect()
            except Exception as e:
                logger.error(f"Error disconnecting transport '{name}': {e}")

        self._servers.clear()
        self._transports.clear()
        logger.info("All MCP servers shutdown")

    async def __aenter__(self):
        """Async context manager entry."""
        await self.initialize_all()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.shutdown_all()
        return False
