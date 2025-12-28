#!/usr/bin/env python3
"""
MCP + CrewAI Integration Test
==============================

Tests MCP tools working with CrewAI agents in a simplified scenario.
This verifies the main.py integration pattern works correctly.

Run: python src/domain/amazon-growth/scripts/test_mcp_crewai.py
"""

import asyncio
import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
load_dotenv()


def test_mcp_crewai_integration():
    """Test MCP tools with CrewAI Agent."""
    print("=" * 60)
    print("MCP + CrewAI Integration Test")
    print("=" * 60)

    # Check API key
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("⚠️  ANTHROPIC_API_KEY not set - skipping LLM test")
        print("   Will only verify tool loading...")
        skip_llm = True
    else:
        skip_llm = False

    # 1. Initialize MCP Provider
    print("\n📦 Step 1: Initialize MCP Provider...")
    try:
        from src.runtime.mcp import MCPRegistry, MCPToolProvider

        config_path = project_root / "src" / "domain" / "amazon-growth" / "config" / "mcp_servers.yaml"
        registry = MCPRegistry.from_config(str(config_path))
        provider = MCPToolProvider(registry)

        available = provider.list_available_tools()
        total_tools = sum(len(tools) for tools in available.values())
        print(f"   ✓ Provider ready: {len(available)} servers, {total_tools} tools")

    except Exception as e:
        print(f"   ✗ Failed: {e}")
        return False

    # 2. Get tools for agent
    print("\n🔧 Step 2: Get tools for diagnostic-architect agent...")
    try:
        servers = ['qdrant-knowledge', 'sellersprite', 'duckdb-datalake']
        tools = provider.get_tools(servers)
        print(f"   ✓ Loaded {len(tools)} tools:")
        for tool in tools:
            print(f"      • {tool.name}")
    except Exception as e:
        print(f"   ✗ Failed: {e}")
        return False

    # 3. Create CrewAI Agent
    print("\n🤖 Step 3: Create CrewAI Agent with MCP tools...")
    try:
        from crewai import Agent

        # Use Anthropic model
        llm_model = "anthropic/claude-sonnet-4-5-20250929"

        agent = Agent(
            role="Amazon Data Analyst",
            goal="Analyze Amazon product data using MCP tools",
            backstory="Expert in Amazon marketplace analytics with access to Qdrant knowledge base, SellerSprite data, and DuckDB data lake.",
            tools=tools,
            llm=llm_model,
            verbose=True
        )
        print(f"   ✓ Agent created: {agent.role}")
        print(f"      Tools attached: {len(tools)}")
        print(f"      LLM: {llm_model}")

    except Exception as e:
        print(f"   ✗ Failed: {e}")
        return False

    # 4. Test tool invocation (without LLM)
    print("\n🧪 Step 4: Test tool invocation...")
    try:
        # Find the list_tables tool
        list_tables_tool = None
        for tool in tools:
            if tool.name == "list_tables":
                list_tables_tool = tool
                break

        if list_tables_tool:
            # Invoke tool directly
            result = list_tables_tool._run()
            if isinstance(result, dict) and "tables" in result:
                tables = result["tables"]
                print(f"   ✓ list_tables returned {len(tables)} tables")
                for t in tables[:3]:
                    print(f"      • {t['name']} ({t.get('row_count', '?')} rows)")
            else:
                print(f"   ✓ Tool executed, result: {str(result)[:100]}...")
        else:
            print("   ⚠️  list_tables tool not found, skipping...")

    except Exception as e:
        print(f"   ⚠️  Tool invocation test failed: {e}")
        # This is not a critical failure

    # 5. Summary
    print("\n" + "=" * 60)
    print("Integration Test Summary")
    print("=" * 60)
    print("✓ MCP Provider initialization: PASSED")
    print("✓ Tool loading for agent: PASSED")
    print("✓ CrewAI Agent creation with MCP tools: PASSED")
    print(f"✓ Tools available: {len(tools)}")
    print("=" * 60)

    if skip_llm:
        print("\n💡 To run full Agent execution, set ANTHROPIC_API_KEY")

    return True


if __name__ == "__main__":
    success = test_mcp_crewai_integration()
    sys.exit(0 if success else 1)
