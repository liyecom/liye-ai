"""
MCP End-to-End Tests
====================

Tests actual MCP Server functionality with real data.

Run with: python src/runtime/mcp/tests/test_e2e.py
"""

import asyncio
import os
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(project_root))


async def test_duckdb_server_e2e():
    """测试 DuckDB Server 连接实际数据库"""
    print("Testing DuckDB Server E2E...")

    from src.runtime.mcp.servers.data.duckdb_server import DuckDBMCPServer
    from src.runtime.mcp.types import MCPServerConfig, ServerType

    # 使用实际数据库路径
    db_path = project_root / "src" / "domain" / "data" / "growth_os.duckdb"

    if not db_path.exists():
        print(f"  ⚠ Database not found: {db_path}")
        print("  ⚠ Skipping DuckDB E2E test")
        return False

    config = MCPServerConfig(
        name="duckdb-datalake",
        server_type=ServerType.CUSTOM,
        module="src.runtime.mcp.servers.data.duckdb_server",
        class_name="DuckDBMCPServer",
        config={
            "database": str(db_path),
            "read_only": True,
            "max_rows": 100
        }
    )

    server = DuckDBMCPServer(config)

    try:
        # 初始化连接
        await server.initialize()
        print("  ✓ DuckDB connection initialized")

        # 测试 list_tables
        result = await server.handle_tool("list_tables", {})
        tables = result.get("tables", [])
        print(f"  ✓ Found {len(tables)} tables:")
        for t in tables[:5]:  # 只显示前5个
            print(f"    - {t['name']} ({t['row_count']} rows)")
        if len(tables) > 5:
            print(f"    ... and {len(tables) - 5} more")

        # 测试 execute_query
        if tables:
            first_table = tables[0]["name"]
            result = await server.handle_tool("execute_query", {
                "sql": f"SELECT * FROM {first_table} LIMIT 3"
            })
            print(f"  ✓ Query executed, got {result.get('row_count', 0)} rows")

        # 关闭连接
        await server.shutdown()
        print("  ✓ DuckDB connection closed")

        print("\n✅ DuckDB E2E Test Passed!")
        return True

    except Exception as e:
        print(f"  ✗ Error: {e}")
        await server.shutdown()
        return False


async def test_sellersprite_server_e2e():
    """
    测试 SellerSprite Server 数据就绪状态处理

    Per SellerSprite_DATA_CONTRACT.md:
    - DATA_NOT_READY is an expected state, not a failure
    - Server should NOT throw exception for missing table
    """
    print("\nTesting SellerSprite Server E2E...")

    from src.runtime.mcp.servers.amazon.sellersprite_server import SellersSpriteMCPServer, DataStatus
    from src.runtime.mcp.types import MCPServerConfig, ServerType

    db_path = project_root / "src" / "domain" / "data" / "growth_os.duckdb"

    if not db_path.exists():
        print(f"  ⚠ Database not found: {db_path}")
        print("  ⚠ Skipping SellerSprite E2E test")
        return True  # Not a failure - just skip

    config = MCPServerConfig(
        name="sellersprite",
        server_type=ServerType.CUSTOM,
        module="src.runtime.mcp.servers.amazon.sellersprite_server",
        class_name="SellersSpriteMCPServer",
        config={
            "database": str(db_path),
            "keyword_table": "fact_keyword_snapshot",
            "asin_table": "dim_asin"
        }
    )

    server = SellersSpriteMCPServer(config)

    try:
        await server.initialize()
        print("  ✓ SellerSprite Server initialized")

        # Check data status
        print(f"  ✓ Data status: {server.data_status}")

        if server.is_data_ready:
            # Data is ready - run actual tests
            result = await server.handle_tool("analyze_market", {})
            stats = result.get("summary", {})
            print(f"  ✓ Market analysis: {stats.get('total_keywords', 0)} keywords")
        else:
            # DATA_NOT_READY is expected - verify graceful degradation
            print(f"  ✓ Data not ready (expected): {server._data_message}")

            # Verify tool returns proper status (not exception)
            result = await server.handle_tool("analyze_market", {})
            assert result.get("status") == DataStatus.NOT_READY, \
                "Tool should return DATA_NOT_READY status"
            assert "message" in result, "Response should include message"
            assert "next_action" in result, "Response should include next_action"
            print("  ✓ Graceful degradation verified")

        await server.shutdown()
        print("  ✓ SellerSprite Server closed")

        print("\n✅ SellerSprite E2E Test Passed!")
        return True

    except Exception as e:
        print(f"  ✗ Error: {e}")
        try:
            await server.shutdown()
        except:
            pass
        return False


async def test_mcp_provider_e2e():
    """测试 MCPToolProvider 端到端"""
    print("\nTesting MCPToolProvider E2E...")

    from src.runtime.mcp import MCPRegistry, MCPToolProvider

    config_path = project_root / "src" / "domain" / "amazon-growth" / "config" / "mcp_servers.yaml"

    if not config_path.exists():
        print(f"  ⚠ Config not found: {config_path}")
        return False

    registry = MCPRegistry.from_config(str(config_path))
    provider = MCPToolProvider(registry)

    available = provider.list_available_tools()
    print(f"  ✓ Available servers: {list(available.keys())}")

    # 获取 DuckDB 工具
    tools = provider.get_tools(["duckdb-datalake"])
    print(f"  ✓ Got {len(tools)} tools from duckdb-datalake")

    for tool in tools:
        print(f"    - {tool.name}: {tool.description[:50]}...")

    print("\n✅ MCPToolProvider E2E Test Passed!")
    return True


async def run_all_e2e_tests():
    """运行所有端到端测试"""
    print("=" * 60)
    print("MCP End-to-End Tests")
    print("=" * 60)

    results = []

    results.append(await test_duckdb_server_e2e())
    results.append(await test_sellersprite_server_e2e())
    results.append(await test_mcp_provider_e2e())

    print("\n" + "=" * 60)
    passed = sum(results)
    total = len(results)
    if passed == total:
        print(f"🎉 All {total} E2E tests passed!")
    else:
        print(f"⚠ {passed}/{total} E2E tests passed")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_all_e2e_tests())
