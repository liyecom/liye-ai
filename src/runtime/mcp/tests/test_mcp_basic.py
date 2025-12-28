"""
Basic MCP Module Tests
======================

Tests for verifying MCP module structure and basic functionality.

Run with: python -m pytest src/runtime/mcp/tests/test_mcp_basic.py -v
Or directly: python src/runtime/mcp/tests/test_mcp_basic.py
"""

import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(project_root))


def test_imports():
    """Test that all MCP modules can be imported."""
    print("Testing imports...")

    # Core types
    from src.runtime.mcp.types import (
        MCPTool,
        MCPResource,
        MCPServerConfig,
        MCPPermissions,
        ToolRisk,
        TransportType,
        ServerType,
    )
    print("  ✓ types.py imports OK")

    # Transport
    from src.runtime.mcp.transport.base import MCPTransport, MCPError
    from src.runtime.mcp.transport.stdio import StdioTransport
    print("  ✓ transport imports OK")

    # Base server
    from src.runtime.mcp.base_server import (
        BaseMCPServer,
        ToolNotFoundError,
        ToolExecutionError,
    )
    print("  ✓ base_server.py imports OK")

    # Registry
    from src.runtime.mcp.registry import MCPRegistry
    print("  ✓ registry.py imports OK")

    # Adapter
    from src.runtime.mcp.adapters.crewai_adapter import (
        MCPToolProvider,
        MCPToolWrapper,
    )
    print("  ✓ crewai_adapter.py imports OK")

    # Top-level imports
    from src.runtime.mcp import (
        MCPTool,
        MCPRegistry,
        BaseMCPServer,
        MCPToolProvider,
    )
    print("  ✓ __init__.py exports OK")

    print("\n✅ All imports successful!")


def test_types():
    """Test type definitions."""
    print("\nTesting types...")

    from src.runtime.mcp.types import (
        MCPTool,
        MCPServerConfig,
        ToolRisk,
        TransportType,
        ServerType,
    )

    # Test MCPTool
    tool = MCPTool(
        name="test-tool",
        description="A test tool",
        input_schema={"type": "object", "properties": {}},
        risk_level=ToolRisk.READ_ONLY
    )
    assert tool.name == "test-tool"
    assert tool.risk_level == ToolRisk.READ_ONLY
    print("  ✓ MCPTool creation OK")

    # Test MCPServerConfig
    config = MCPServerConfig(
        name="test-server",
        server_type=ServerType.CUSTOM,
        module="test.module",
        class_name="TestServer"
    )
    assert config.name == "test-server"
    assert config.transport == TransportType.STDIO
    print("  ✓ MCPServerConfig creation OK")

    # Test enums
    assert ToolRisk.FINANCIAL.value == "financial"
    assert TransportType.HTTP.value == "http"
    print("  ✓ Enums OK")

    print("\n✅ All types work correctly!")


def test_registry_config_loading():
    """Test registry configuration loading."""
    print("\nTesting registry...")

    from src.runtime.mcp.registry import MCPRegistry

    # Test empty registry
    registry = MCPRegistry()
    configs = registry.list_configs()
    assert isinstance(configs, list)
    print("  ✓ Empty registry OK")

    # Test loading default config (if exists)
    config_path = project_root / "src/runtime/mcp/config/default.yaml"
    if config_path.exists():
        registry = MCPRegistry.from_config(str(config_path))
        configs = registry.list_configs(enabled_only=False)
        print(f"  ✓ Loaded {len(configs)} server configs")
        for c in configs:
            print(f"    - {c.name} (enabled={c.enabled})")
    else:
        print("  ⚠ default.yaml not found, skipping")

    print("\n✅ Registry works correctly!")


def test_qdrant_server_structure():
    """Test QdrantMCPServer class structure."""
    print("\nTesting QdrantMCPServer structure...")

    from src.runtime.mcp.servers.knowledge.qdrant_server import QdrantMCPServer
    from src.runtime.mcp.types import MCPServerConfig, ServerType

    # Create config
    config = MCPServerConfig(
        name="qdrant-knowledge",
        server_type=ServerType.CUSTOM,
        module="src.runtime.mcp.servers.knowledge.qdrant_server",
        class_name="QdrantMCPServer",
        config={
            "url": "http://localhost:6333",
            "collection": "test_collection"
        }
    )

    # Create server (don't initialize - just check structure)
    server = QdrantMCPServer(config)
    assert server.server_name == "qdrant-knowledge"
    print("  ✓ Server name OK")

    # Check tools
    tools = server.list_tools()
    assert len(tools) > 0
    tool_names = [t.name for t in tools]
    assert "semantic_search" in tool_names
    print(f"  ✓ Found {len(tools)} tools: {tool_names}")

    print("\n✅ QdrantMCPServer structure OK!")


def test_adapter_structure():
    """Test CrewAI adapter structure."""
    print("\nTesting CrewAI adapter structure...")

    from src.runtime.mcp.adapters.crewai_adapter import (
        MCPToolProvider,
        MCPToolWrapper,
    )
    from src.runtime.mcp.registry import MCPRegistry

    # Create empty registry
    registry = MCPRegistry()
    provider = MCPToolProvider(registry)

    # Test list_available_tools with empty registry
    available = provider.list_available_tools()
    assert isinstance(available, dict)
    print("  ✓ MCPToolProvider creation OK")

    # Test get_tools with non-existent server
    tools = provider.get_tools(["non-existent"])
    assert tools == []
    print("  ✓ get_tools handles missing server OK")

    print("\n✅ CrewAI adapter structure OK!")


def run_all_tests():
    """Run all tests."""
    print("=" * 60)
    print("MCP Module Basic Tests")
    print("=" * 60)

    test_imports()
    test_types()
    test_registry_config_loading()
    test_qdrant_server_structure()
    test_adapter_structure()

    print("\n" + "=" * 60)
    print("🎉 All tests passed!")
    print("=" * 60)


if __name__ == "__main__":
    run_all_tests()
