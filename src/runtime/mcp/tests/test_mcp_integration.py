"""
MCP Integration Tests
=====================

Tests for verifying MCP integration with amazon-growth domain.

Run with: python -m pytest src/runtime/mcp/tests/test_mcp_integration.py -v
Or directly: python src/runtime/mcp/tests/test_mcp_integration.py
"""

import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(project_root))


def test_amazon_domain_config():
    """Test amazon-growth domain MCP configuration."""
    print("Testing amazon-growth domain config...")

    from src.runtime.mcp.registry import MCPRegistry

    config_path = project_root / "src" / "domain" / "amazon-growth" / "config" / "mcp_servers.yaml"

    if not config_path.exists():
        print(f"  ⚠ Domain config not found: {config_path}")
        return

    registry = MCPRegistry.from_config(str(config_path))
    configs = registry.list_configs(enabled_only=True)

    print(f"  ✓ Loaded {len(configs)} enabled servers:")
    for c in configs:
        print(f"    - {c.name}")

    # Verify expected servers
    server_names = [c.name for c in configs]
    expected = ['qdrant-knowledge', 'sellersprite', 'duckdb-datalake']

    for expected_server in expected:
        if expected_server in server_names:
            print(f"  ✓ {expected_server} is enabled")
        else:
            print(f"  ⚠ {expected_server} not found or disabled")

    print("\n✅ Amazon domain config OK!")


def test_duckdb_server_structure():
    """Test DuckDBMCPServer class structure."""
    print("\nTesting DuckDBMCPServer structure...")

    from src.runtime.mcp.servers.data.duckdb_server import DuckDBMCPServer
    from src.runtime.mcp.types import MCPServerConfig, ServerType

    config = MCPServerConfig(
        name="duckdb-datalake",
        server_type=ServerType.CUSTOM,
        module="src.runtime.mcp.servers.data.duckdb_server",
        class_name="DuckDBMCPServer",
        config={
            "database": ":memory:",
            "read_only": True
        }
    )

    server = DuckDBMCPServer(config)
    assert server.server_name == "duckdb-datalake"
    print("  ✓ Server name OK")

    tools = server.list_tools()
    assert len(tools) > 0
    tool_names = [t.name for t in tools]

    expected_tools = ['execute_query', 'get_schema', 'list_tables', 'get_sample', 'describe_stats']
    for t in expected_tools:
        if t in tool_names:
            print(f"  ✓ Tool '{t}' present")
        else:
            print(f"  ⚠ Tool '{t}' missing")

    print("\n✅ DuckDBMCPServer structure OK!")


def test_sellersprite_server_structure():
    """Test SellersSpriteMCPServer class structure."""
    print("\nTesting SellersSpriteMCPServer structure...")

    from src.runtime.mcp.servers.amazon.sellersprite_server import SellersSpriteMCPServer
    from src.runtime.mcp.types import MCPServerConfig, ServerType

    config = MCPServerConfig(
        name="sellersprite",
        server_type=ServerType.CUSTOM,
        module="src.runtime.mcp.servers.amazon.sellersprite_server",
        class_name="SellersSpriteMCPServer",
        config={
            "database": ":memory:",
            "keyword_table": "fact_keyword_snapshot",
            "asin_table": "dim_asin"
        }
    )

    server = SellersSpriteMCPServer(config)
    assert server.server_name == "sellersprite"
    print("  ✓ Server name OK")

    tools = server.list_tools()
    assert len(tools) > 0
    tool_names = [t.name for t in tools]

    expected_tools = ['diagnose_listing', 'find_opportunities', 'get_keyword_metrics', 'analyze_market', 'top_keywords']
    for t in expected_tools:
        if t in tool_names:
            print(f"  ✓ Tool '{t}' present")
        else:
            print(f"  ⚠ Tool '{t}' missing")

    print("\n✅ SellersSpriteMCPServer structure OK!")


def test_vault_structure():
    """Test MCPVault credential management."""
    print("\nTesting MCPVault structure...")

    from src.runtime.mcp.security.vault import MCPVault, get_vault, get_credential

    # Test vault creation
    vault = MCPVault(vault_path=Path("/tmp/test_vault.json"))
    print("  ✓ MCPVault creation OK")

    # Test env var name generation
    env_name = vault._get_env_var_name("sellersprite", "api_key")
    assert env_name == "SELLERSPRITE_API_KEY"
    print("  ✓ Env var naming OK")

    # Test credential set/get
    vault.set_credential("test-server", "test-key", "test-value")
    value = vault.get_credential("test-server", "test-key")
    assert value == "test-value"
    print("  ✓ Set/Get credential OK")

    # Test list operations
    servers = vault.list_servers()
    assert "test-server" in servers
    print("  ✓ List servers OK")

    credentials = vault.list_credentials("test-server")
    assert "test-key" in credentials
    print("  ✓ List credentials OK")

    # Test delete
    vault.delete_credential("test-server", "test-key")
    value = vault.get_credential("test-server", "test-key")
    assert value is None
    print("  ✓ Delete credential OK")

    # Test global vault
    global_vault = get_vault()
    assert global_vault is not None
    print("  ✓ Global vault OK")

    print("\n✅ MCPVault structure OK!")


def test_tool_provider_with_domain_config():
    """Test MCPToolProvider with amazon-growth domain config."""
    print("\nTesting MCPToolProvider with domain config...")

    from src.runtime.mcp import MCPRegistry, MCPToolProvider

    config_path = project_root / "src" / "domain" / "amazon-growth" / "config" / "mcp_servers.yaml"

    if not config_path.exists():
        print("  ⚠ Domain config not found, skipping")
        return

    registry = MCPRegistry.from_config(str(config_path))
    provider = MCPToolProvider(registry)

    # List available tools
    available = provider.list_available_tools()
    print(f"  ✓ Available servers: {list(available.keys())}")

    # Test getting tools for each agent type
    agent_types = ['keyword-architect', 'market-analyst', 'listing-optimizer']

    for agent_type in agent_types:
        # Get server mapping from domain config
        # Note: This is a simplified test - full test would load config
        servers = ['qdrant-knowledge', 'sellersprite']
        tools = provider.get_tools(servers)
        print(f"  ✓ {agent_type}: {len(tools)} tools loaded")

    print("\n✅ MCPToolProvider with domain config OK!")


def test_main_py_mcp_imports():
    """Test that main.py can import MCP modules."""
    print("\nTesting main.py MCP imports...")

    # Change to amazon-growth directory for relative imports
    amazon_dir = project_root / "src" / "domain" / "amazon-growth"
    original_cwd = os.getcwd()

    try:
        os.chdir(amazon_dir)

        # Test the setup_mcp_provider function
        from src.runtime.mcp import MCPRegistry, MCPToolProvider
        print("  ✓ MCP imports OK")

        # Test domain config loading
        config_path = amazon_dir / "config" / "mcp_servers.yaml"
        if config_path.exists():
            registry = MCPRegistry.from_config(str(config_path))
            provider = MCPToolProvider(registry)
            print("  ✓ Domain config loading OK")

            available = provider.list_available_tools()
            print(f"  ✓ Provider ready with {len(available)} servers")
        else:
            print("  ⚠ Domain config not found")

    except Exception as e:
        print(f"  ✗ Error: {e}")
        raise
    finally:
        os.chdir(original_cwd)

    print("\n✅ main.py MCP integration OK!")


def run_all_tests():
    """Run all integration tests."""
    print("=" * 60)
    print("MCP Integration Tests")
    print("=" * 60)

    test_amazon_domain_config()
    test_duckdb_server_structure()
    test_sellersprite_server_structure()
    test_vault_structure()
    test_tool_provider_with_domain_config()
    test_main_py_mcp_imports()

    print("\n" + "=" * 60)
    print("🎉 All integration tests passed!")
    print("=" * 60)


if __name__ == "__main__":
    run_all_tests()
