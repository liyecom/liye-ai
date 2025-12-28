#!/usr/bin/env python3
"""
MCP Integration Verification Script
====================================

Verifies MCP tools work correctly in the Amazon Growth OS context.
This script tests the actual MCP integration without running the full CrewAI flow.

Run: python src/domain/amazon-growth/scripts/verify_mcp_integration.py
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
load_dotenv()


async def verify_mcp_provider():
    """Verify MCP Provider initialization and tool loading."""
    print("=" * 60)
    print("MCP Integration Verification")
    print("=" * 60)

    try:
        from src.runtime.mcp import MCPRegistry, MCPToolProvider
        print("✓ MCP modules imported successfully")
    except ImportError as e:
        print(f"✗ Failed to import MCP modules: {e}")
        return False

    # Load domain config
    config_path = project_root / "src" / "domain" / "amazon-growth" / "config" / "mcp_servers.yaml"

    if not config_path.exists():
        print(f"✗ Config not found: {config_path}")
        return False

    print(f"✓ Config found: {config_path}")

    # Create registry and provider
    try:
        registry = MCPRegistry.from_config(str(config_path))
        provider = MCPToolProvider(registry)
        print("✓ MCPRegistry and MCPToolProvider created")
    except Exception as e:
        print(f"✗ Failed to create provider: {e}")
        return False

    # List available tools
    available = provider.list_available_tools()
    print(f"\n📦 Available MCP Servers: {len(available)}")

    for server_name, tools in available.items():
        print(f"\n  [{server_name}]")
        for tool in tools:
            print(f"    • {tool}")

    return True, provider


async def verify_tool_loading(provider):
    """Verify tools can be loaded for agents."""
    print("\n" + "=" * 60)
    print("Tool Loading Test")
    print("=" * 60)

    # Agent to server mapping (from main.py)
    agent_mappings = {
        'keyword-architect': ['qdrant-knowledge', 'sellersprite', 'duckdb-datalake'],
        'market-analyst': ['sellersprite', 'duckdb-datalake'],
        'diagnostic-architect': ['qdrant-knowledge', 'sellersprite', 'duckdb-datalake'],
    }

    results = {}

    for agent_type, servers in agent_mappings.items():
        try:
            tools = provider.get_tools(servers)
            results[agent_type] = {
                'success': True,
                'tool_count': len(tools),
                'tools': [t.name for t in tools] if tools else []
            }
            print(f"\n✓ {agent_type}: {len(tools)} tools loaded")
            for tool in tools:
                print(f"    • {tool.name}")
        except Exception as e:
            results[agent_type] = {
                'success': False,
                'error': str(e)
            }
            print(f"\n✗ {agent_type}: Failed - {e}")

    return results


async def verify_tool_execution(provider):
    """Verify actual tool execution."""
    print("\n" + "=" * 60)
    print("Tool Execution Test")
    print("=" * 60)

    registry = provider._registry
    results = {}

    # Test DuckDB Server
    print("\n🔷 Testing DuckDB Server...")
    try:
        duckdb_server = registry.get_server("duckdb-datalake")
        if duckdb_server:
            await duckdb_server.initialize()
            result = await duckdb_server.handle_tool("list_tables", {})
            tables = result.get("tables", [])
            print(f"  ✓ list_tables returned {len(tables)} tables")
            for t in tables[:3]:
                print(f"    • {t['name']} ({t.get('row_count', '?')} rows)")
            results['duckdb'] = {'success': True, 'tables': len(tables)}
            await duckdb_server.shutdown()
        else:
            print("  ⚠ DuckDB server not configured")
            results['duckdb'] = {'success': False, 'error': 'Not configured'}
    except Exception as e:
        print(f"  ✗ DuckDB test failed: {e}")
        results['duckdb'] = {'success': False, 'error': str(e)}

    # Test SellerSprite Server (with graceful degradation)
    print("\n🔷 Testing SellerSprite Server...")
    try:
        ss_server = registry.get_server("sellersprite")
        if ss_server:
            await ss_server.initialize()

            # Check data status
            if hasattr(ss_server, 'data_status'):
                print(f"  📊 Data status: {ss_server.data_status}")
                print(f"  📊 Is data ready: {ss_server.is_data_ready}")

            # Try a tool call
            result = await ss_server.handle_tool("analyze_market", {})

            if result.get("status") == "DATA_NOT_READY":
                print(f"  ✓ Graceful degradation working:")
                print(f"    Message: {result.get('message', 'N/A')[:60]}...")
                print(f"    Next action: {result.get('next_action', 'N/A')[:60]}...")
                results['sellersprite'] = {'success': True, 'data_ready': False}
            else:
                print(f"  ✓ Data ready, got market analysis")
                results['sellersprite'] = {'success': True, 'data_ready': True}

            await ss_server.shutdown()
        else:
            print("  ⚠ SellerSprite server not configured")
            results['sellersprite'] = {'success': False, 'error': 'Not configured'}
    except Exception as e:
        print(f"  ✗ SellerSprite test failed: {e}")
        results['sellersprite'] = {'success': False, 'error': str(e)}

    # Test Qdrant Server
    print("\n🔷 Testing Qdrant Server...")
    try:
        qdrant_server = registry.get_server("qdrant-knowledge")
        if qdrant_server:
            await qdrant_server.initialize()
            result = await qdrant_server.handle_tool("list_collections", {})
            collections = result.get("collections", [])
            print(f"  ✓ list_collections returned {len(collections)} collections")
            results['qdrant'] = {'success': True, 'collections': len(collections)}
            await qdrant_server.shutdown()
        else:
            print("  ⚠ Qdrant server not configured")
            results['qdrant'] = {'success': False, 'error': 'Not configured'}
    except Exception as e:
        print(f"  ✗ Qdrant test failed: {e}")
        results['qdrant'] = {'success': False, 'error': str(e)}

    return results


async def generate_mcp_coverage_report(tool_results, execution_results):
    """Generate MCP coverage report for Phase 3 gate check."""
    print("\n" + "=" * 60)
    print("MCP Coverage Report (Phase 3 Gate Check)")
    print("=" * 60)

    # Count total tools loaded
    total_tools = sum(
        r['tool_count'] for r in tool_results.values()
        if r.get('success')
    )

    # Count working servers
    working_servers = sum(
        1 for r in execution_results.values()
        if r.get('success')
    )
    total_servers = len(execution_results)

    # Check Phase 3 entry conditions
    print("\n📋 Phase 3 Entry Conditions:")

    # Condition 1: SellerSprite data contract
    ss_result = execution_results.get('sellersprite', {})
    if ss_result.get('success'):
        if ss_result.get('data_ready'):
            print("  ✓ SellerSprite data contract: SATISFIED")
            condition1 = True
        else:
            print("  ⏳ SellerSprite data contract: DATA_NOT_READY")
            condition1 = False
    else:
        print("  ✗ SellerSprite data contract: FAILED")
        condition1 = False

    # Condition 2: At least one decisional tool runs
    if ss_result.get('success'):
        if ss_result.get('data_ready'):
            print("  ✓ Decisional tool execution: PASSED")
            condition2 = True
        else:
            print("  ⏳ Decisional tool execution: PENDING (needs data)")
            condition2 = False
    else:
        print("  ✗ Decisional tool execution: FAILED")
        condition2 = False

    # Condition 3: MCP coverage >= 70%
    # For now, estimate based on tool loading success
    coverage = (working_servers / total_servers * 100) if total_servers > 0 else 0
    if coverage >= 70:
        print(f"  ✓ MCP coverage: {coverage:.0f}% (>= 70%)")
        condition3 = True
    else:
        print(f"  ⏳ MCP coverage: {coverage:.0f}% (< 70%)")
        condition3 = False

    # Overall gate status
    print("\n" + "-" * 40)
    if condition1 and condition2 and condition3:
        print("🎉 Phase 3 Gate: PASSED")
    else:
        print("⏳ Phase 3 Gate: BLOCKED")
        print("   Pending conditions:")
        if not condition1:
            print("   • SellerSprite data import required")
        if not condition2:
            print("   • Decisional tool execution pending")
        if not condition3:
            print("   • MCP coverage needs improvement")

    return {
        'total_tools': total_tools,
        'working_servers': working_servers,
        'coverage': coverage,
        'phase3_ready': condition1 and condition2 and condition3
    }


async def main():
    """Run all verification tests."""
    print("\n" + "🚀 " * 20)
    print("Amazon Growth OS - MCP Integration Verification")
    print("🚀 " * 20 + "\n")

    # Step 1: Verify provider
    result = await verify_mcp_provider()
    if isinstance(result, tuple):
        success, provider = result
    else:
        print("\n❌ MCP Provider verification failed")
        return

    # Step 2: Verify tool loading
    tool_results = await verify_tool_loading(provider)

    # Step 3: Verify tool execution
    execution_results = await verify_tool_execution(provider)

    # Step 4: Generate coverage report
    report = await generate_mcp_coverage_report(tool_results, execution_results)

    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"  Total MCP tools loaded: {report['total_tools']}")
    print(f"  Working servers: {report['working_servers']}")
    print(f"  MCP coverage: {report['coverage']:.0f}%")
    print(f"  Phase 3 ready: {'Yes' if report['phase3_ready'] else 'No'}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
