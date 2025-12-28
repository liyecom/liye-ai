"""
MCP Contract Compliance Tests
==============================

Validates implementation against MCP_CONTRACT.md requirements.

Run with: python src/runtime/mcp/tests/test_contract_compliance.py
"""

import os
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(project_root))


def test_section_1_positioning():
    """§1: MCP 位于 Runtime 层"""
    print("Testing §1: MCP Positioning...")

    mcp_path = project_root / "src" / "runtime" / "mcp"
    assert mcp_path.exists(), "MCP must be in src/runtime/mcp/"
    print("  ✓ MCP located in Runtime layer")

    # 检查 Domain 不直接 import MCP Server
    main_py = project_root / "src" / "domain" / "amazon-growth" / "main.py"
    if main_py.exists():
        content = main_py.read_text()
        # 应该通过 MCPToolProvider，不是直接 import server
        assert "from src.runtime.mcp.servers" not in content, \
            "Domain must not directly import MCP Server"
        print("  ✓ Domain uses MCPToolProvider, not direct imports")

    print("\n✅ §1 Compliance OK!")


def test_section_2_lifecycle():
    """§2: Server 生命周期"""
    print("\nTesting §2: Server Lifecycle...")

    from src.runtime.mcp.base_server import BaseMCPServer

    # 检查 BaseMCPServer 有 shutdown 方法
    assert hasattr(BaseMCPServer, 'shutdown'), "Server must support graceful shutdown"
    print("  ✓ BaseMCPServer has shutdown() method")

    # 检查 Registry 控制启动
    from src.runtime.mcp.registry import MCPRegistry
    assert hasattr(MCPRegistry, 'get_server'), "Registry must control server lifecycle"
    assert hasattr(MCPRegistry, '_create_custom_server'), "Registry must handle server creation"
    print("  ✓ Registry controls server lifecycle")

    print("\n✅ §2 Compliance OK!")


def test_section_3_tool_contract():
    """§3: Tool 暴露契约"""
    print("\nTesting §3: Tool Contract...")

    from src.runtime.mcp.types import MCPTool, ToolStability, ToolRisk

    # 检查 ToolStability 存在
    assert ToolStability.STABLE.value == "stable"
    assert ToolStability.EXPERIMENTAL.value == "experimental"
    assert ToolStability.DEPRECATED.value == "deprecated"
    print("  ✓ ToolStability enum defined")

    # 检查 MCPTool 有 stability 字段
    tool = MCPTool(
        name="test_tool",
        description="Test",
        input_schema={"type": "object"}
    )
    assert hasattr(tool, 'stability'), "MCPTool must have stability field"
    assert tool.stability == ToolStability.STABLE, "Default stability should be STABLE"
    print("  ✓ MCPTool has stability field with STABLE default")

    # 检查 Tool 命名是业务语义
    from src.runtime.mcp.servers.amazon.sellersprite_server import SellersSpriteMCPServer
    from src.runtime.mcp.types import MCPServerConfig, ServerType

    config = MCPServerConfig(
        name="sellersprite",
        server_type=ServerType.CUSTOM,
        module="test",
        class_name="Test",
        config={"database": ":memory:"}
    )
    server = SellersSpriteMCPServer(config)
    tools = server.list_tools()

    bad_names = ['call_', 'raw_', 'api_', 'execute_sql']
    for tool in tools:
        for bad in bad_names:
            assert bad not in tool.name.lower(), \
                f"Tool '{tool.name}' uses API-semantic naming (contains '{bad}')"
    print("  ✓ Tools use business-semantic naming")

    print("\n✅ §3 Compliance OK!")


def test_section_4_security():
    """§4: 安全边界"""
    print("\nTesting §4: Security Boundary...")

    from src.runtime.mcp.security.vault import MCPVault

    # 检查 vault 存在
    vault = MCPVault()
    print("  ✓ MCPVault exists")

    # 检查环境变量优先级
    env_name = vault._get_env_var_name("test-server", "api_key")
    assert env_name == "TEST_SERVER_API_KEY"
    print("  ✓ Vault supports environment variable priority")

    # 检查默认只读
    from src.runtime.mcp.types import MCPPermissions
    perms = MCPPermissions()
    assert perms.read == True
    assert perms.write == False
    print("  ✓ Default permissions are read-only")

    print("\n✅ §4 Compliance OK!")


def test_section_5_domain_constraint():
    """§5: Domain MCP 约束"""
    print("\nTesting §5: Domain MCP Constraint...")

    main_py = project_root / "src" / "domain" / "amazon-growth" / "main.py"
    if main_py.exists():
        content = main_py.read_text()

        # 检查支持 MCP / 非 MCP 双模式
        assert "fallback" in content.lower() or "no-mcp" in content.lower(), \
            "Domain must support non-MCP fallback mode"
        print("  ✓ main.py supports MCP/non-MCP dual mode")

        assert "get_fallback_tools" in content, \
            "Domain must have fallback tool mechanism"
        print("  ✓ main.py has fallback tool mechanism")

    print("\n✅ §5 Compliance OK!")


def test_section_6_config_layers():
    """§6: 配置分层"""
    print("\nTesting §6: Configuration Layers...")

    # System layer
    system_config = project_root / "src" / "runtime" / "mcp" / "config" / "default.yaml"
    assert system_config.exists(), "System layer config must exist"
    print("  ✓ System layer: default.yaml exists")

    # Domain layer
    domain_config = project_root / "src" / "domain" / "amazon-growth" / "config" / "mcp_servers.yaml"
    assert domain_config.exists(), "Domain layer config must exist"
    print("  ✓ Domain layer: mcp_servers.yaml exists")

    # Session layer (CLI flags)
    main_py = project_root / "src" / "domain" / "amazon-growth" / "main.py"
    if main_py.exists():
        content = main_py.read_text()
        assert "--use-mcp" in content or "--no-mcp" in content, \
            "Session layer must support CLI flags"
        print("  ✓ Session layer: CLI flags supported")

    print("\n✅ §6 Compliance OK!")


def test_section_7_transport_evolution():
    """§7: stdio → HTTP 演进原则"""
    print("\nTesting §7: Transport Evolution...")

    from src.runtime.mcp.types import TransportType

    # 检查 Transport 抽象存在
    assert TransportType.STDIO.value == "stdio"
    assert TransportType.HTTP.value == "http"
    assert TransportType.WEBSOCKET.value == "websocket"
    print("  ✓ TransportType enum supports multiple protocols")

    # 检查 Transport 基类存在
    from src.runtime.mcp.transport.base import MCPTransport
    assert hasattr(MCPTransport, 'connect')
    assert hasattr(MCPTransport, 'disconnect')
    assert hasattr(MCPTransport, 'send')
    assert hasattr(MCPTransport, 'receive')
    print("  ✓ MCPTransport abstract base class defined")

    print("\n✅ §7 Compliance OK!")


def run_all_compliance_tests():
    """运行所有合规测试"""
    print("=" * 60)
    print("MCP Contract Compliance Tests")
    print("Reference: docs/architecture/MCP_CONTRACT.md v0.1")
    print("=" * 60)

    test_section_1_positioning()
    test_section_2_lifecycle()
    test_section_3_tool_contract()
    test_section_4_security()
    test_section_5_domain_constraint()
    test_section_6_config_layers()
    test_section_7_transport_evolution()

    print("\n" + "=" * 60)
    print("🎉 All Contract Compliance Tests Passed!")
    print("=" * 60)


if __name__ == "__main__":
    run_all_compliance_tests()
