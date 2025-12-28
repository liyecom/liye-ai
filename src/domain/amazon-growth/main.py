"""
Amazon Growth OS - Main Entry Point
====================================

This is the main entry point for Amazon Growth OS operations.

Modes:
- launch: New product launch with keyword discovery and listing optimization
- optimize: Existing ASIN optimization with diagnosis and PPC audit

MCP Integration:
- Uses MCPToolProvider for standardized tool access (v5.0)
- Falls back to direct tools if MCP initialization fails

See: docs/architecture/MCP_SPEC.md
"""

import os
import sys
import yaml
import argparse
import asyncio
import logging
from pathlib import Path
from crewai import Agent, Task, Crew, Process
from dotenv import load_dotenv
from datetime import datetime
import json

# Add project root to path for MCP imports
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Check for API Key
if not os.getenv("ANTHROPIC_API_KEY"):
    print("Error: ANTHROPIC_API_KEY not found. Please check .env")
    exit(1)

# Model Name
claude_model_name = "anthropic/claude-sonnet-4-5-20250929"


def load_config(file_path):
    """Load YAML configuration file."""
    with open(file_path, 'r') as file:
        return yaml.safe_load(file)


# ============================================
# MCP Tool Provider Setup
# ============================================

def setup_mcp_provider():
    """
    Initialize MCP Registry and Tool Provider.

    Returns:
        MCPToolProvider if successful, None otherwise
    """
    try:
        from src.runtime.mcp import MCPRegistry, MCPToolProvider

        # Load domain-specific MCP configuration
        domain_config_path = Path(__file__).parent / "config" / "mcp_servers.yaml"

        if domain_config_path.exists():
            logger.info(f"Loading MCP config from: {domain_config_path}")
            registry = MCPRegistry.from_config(str(domain_config_path))
        else:
            # Fall back to system default
            logger.warning("Domain MCP config not found, using system default")
            system_config_path = project_root / "src" / "runtime" / "mcp" / "config" / "default.yaml"
            registry = MCPRegistry.from_config(str(system_config_path))

        # Create tool provider
        provider = MCPToolProvider(registry)

        # Log available tools
        available = provider.list_available_tools()
        logger.info(f"MCP Provider initialized with servers: {list(available.keys())}")

        return provider

    except ImportError as e:
        logger.warning(f"MCP module not available: {e}")
        return None
    except Exception as e:
        logger.error(f"Failed to initialize MCP provider: {e}")
        return None


def check_sellersprite_data_status(provider) -> dict:
    """
    Check SellerSprite MCP data readiness status.

    SellerSprite MCP availability depends on data readiness, not system stability.
    See: docs/domain/amazon/SellerSprite_DATA_CONTRACT.md

    Returns:
        dict with keys: ready (bool), status (str), message (str)
    """
    result = {
        "ready": False,
        "status": "UNKNOWN",
        "message": "Not checked"
    }

    if provider is None:
        result["status"] = "NO_PROVIDER"
        result["message"] = "MCP Provider not available"
        return result

    try:
        # Try to get SellerSprite server from registry
        registry = provider._registry
        server = registry.get_server("sellersprite")

        if server is None:
            result["status"] = "SERVER_NOT_FOUND"
            result["message"] = "SellerSprite MCP Server not configured"
            return result

        # Check data_status property
        if hasattr(server, 'data_status'):
            result["status"] = server.data_status
            result["ready"] = server.is_data_ready
            result["message"] = getattr(server, '_data_message', 'Unknown')
        else:
            result["status"] = "NO_STATUS"
            result["message"] = "Server does not support data status check"

    except Exception as e:
        result["status"] = "ERROR"
        result["message"] = str(e)

    return result


def print_sellersprite_status(status: dict) -> None:
    """Print SellerSprite data status to console."""
    if status["ready"]:
        print(f"📊 SellerSprite: {status['status']} - Data ready")
    else:
        print(f"⏳ SellerSprite: {status['status']}")
        print(f"   {status['message']}")
        print("   Note: SellerSprite decisional tools will be skipped")


def get_tools_for_agent(provider, agent_type: str, fallback_tools: list):
    """
    Get tools for an agent from MCP provider or use fallback.

    Args:
        provider: MCPToolProvider instance (or None)
        agent_type: Agent type for server mapping (e.g., 'keyword-architect')
        fallback_tools: List of fallback tool instances

    Returns:
        List of tools (CrewAI compatible)
    """
    if provider is None:
        logger.info(f"Using fallback tools for {agent_type}")
        return fallback_tools

    # Map agent types to MCP servers
    agent_server_mapping = {
        'keyword-architect': ['qdrant-knowledge', 'sellersprite', 'duckdb-datalake'],
        'market-analyst': ['sellersprite', 'duckdb-datalake'],
        'ppc-strategist': ['sellersprite', 'duckdb-datalake'],
        'listing-optimizer': ['qdrant-knowledge', 'sellersprite'],
        'diagnostic-architect': ['qdrant-knowledge', 'sellersprite', 'duckdb-datalake'],
        # Legacy mappings for backward compatibility
        'analyst': ['qdrant-knowledge', 'sellersprite'],
        'optimizer': ['qdrant-knowledge'],
        'diagnostician': ['qdrant-knowledge', 'sellersprite'],
    }

    servers = agent_server_mapping.get(agent_type, ['qdrant-knowledge', 'sellersprite'])

    try:
        mcp_tools = provider.get_tools(servers)
        if mcp_tools:
            logger.info(f"Loaded {len(mcp_tools)} MCP tools for {agent_type}: {[t.name for t in mcp_tools]}")
            return mcp_tools
        else:
            logger.warning(f"No MCP tools loaded for {agent_type}, using fallback")
            return fallback_tools
    except Exception as e:
        logger.error(f"Failed to get MCP tools for {agent_type}: {e}")
        return fallback_tools


# ============================================
# Fallback Direct Tools (Backward Compatibility)
# ============================================

def get_fallback_tools():
    """
    Get direct tool instances as fallback when MCP is unavailable.

    Returns:
        Dict of tool instances
    """
    try:
        from tools.sellersprite_tools import SellersSpriteTool, SellersSpriteReverseTool
        from tools.qdrant_kb_tool import QdrantKnowledgeTool

        return {
            'kb': QdrantKnowledgeTool(),
            'ss': SellersSpriteTool(),
            'ss_reverse': SellersSpriteReverseTool(),
        }
    except ImportError as e:
        logger.error(f"Failed to import fallback tools: {e}")
        return {}

def main():
    """Main entry point for Amazon Growth OS."""
    parser = argparse.ArgumentParser(description='Amazon Operations Crew v2.0 (MCP-Enabled)')

    # Common Arguments
    parser.add_argument('--mode', type=str, choices=['launch', 'optimize'], default='launch', help='Operation Mode')
    parser.add_argument('--file_path', type=str, required=False, help='Path to Data File (Excel/CSV)')
    parser.add_argument('--use-mcp', action='store_true', default=True, help='Use MCP tools (default: True)')
    parser.add_argument('--no-mcp', action='store_true', help='Disable MCP, use direct tools')

    # Launch Mode Arguments
    parser.add_argument('--product', type=str, help='Product Name (Launch Mode)')
    parser.add_argument('--market', type=str, default='Amazon US', help='Target Market')
    parser.add_argument('--target_audience', type=str, default='General', help='Target Audience')

    # Optimize Mode Arguments
    parser.add_argument('--asin', type=str, help='Target ASIN (Optimize Mode)')

    args = parser.parse_args()

    # ============================================
    # Initialize MCP Provider or Fallback Tools
    # ============================================
    use_mcp = args.use_mcp and not args.no_mcp
    mcp_provider = None
    fallback_tools = {}
    sellersprite_ready = False

    if use_mcp:
        print("🔧 Initializing MCP Tool Provider...")
        mcp_provider = setup_mcp_provider()
        if mcp_provider:
            print("✅ MCP Provider ready")

            # Check SellerSprite data status
            # SellerSprite MCP availability depends on data readiness, not system stability.
            ss_status = check_sellersprite_data_status(mcp_provider)
            print_sellersprite_status(ss_status)
            sellersprite_ready = ss_status["ready"]
        else:
            print("⚠️  MCP initialization failed, falling back to direct tools")

    # Always prepare fallback tools
    fallback_tools = get_fallback_tools()

    # Load Shared Agents Config
    config_dir = Path(__file__).parent / "config"
    agents_config = load_config(str(config_dir / 'agents.yaml'))

    # --- MODE SELECTION ---
    if args.mode == 'launch':
        print(f"🚀 Starting Launch Mode for: {args.product}")
        tasks_config = load_config(str(config_dir / 'tasks_launch.yaml'))

        # Get tools via MCP or fallback
        analyst_tools = get_tools_for_agent(
            mcp_provider,
            'analyst',
            [fallback_tools.get('kb'), fallback_tools.get('ss')]
        )
        optimizer_tools = get_tools_for_agent(
            mcp_provider,
            'optimizer',
            [fallback_tools.get('kb')]
        )
        diagnostician_tools = get_tools_for_agent(
            mcp_provider,
            'listing-optimizer',
            [fallback_tools.get('ss')]
        )
        ppc_tools = get_tools_for_agent(
            mcp_provider,
            'ppc-strategist',
            [fallback_tools.get('ss')]
        )

        # Filter out None tools
        analyst_tools = [t for t in analyst_tools if t is not None]
        optimizer_tools = [t for t in optimizer_tools if t is not None]
        diagnostician_tools = [t for t in diagnostician_tools if t is not None]
        ppc_tools = [t for t in ppc_tools if t is not None]

        # Agents
        analyst = Agent(
            config=agents_config['keyword_analyst'],
            tools=analyst_tools,
            llm=claude_model_name
        )
        optimizer = Agent(
            config=agents_config['listing_optimizer'],
            tools=optimizer_tools,
            llm=claude_model_name
        )

        # Additional agents (if needed for extended workflows)
        listing_diagnostician = Agent(
            config=agents_config['listing_optimizer'],
            tools=diagnostician_tools,
            verbose=True
        )
        ppc_auditor = Agent(
            config=agents_config['keyword_analyst'],
            tools=ppc_tools,
            verbose=True
        )

        # Tasks
        task1 = Task(config=tasks_config['keyword_discovery'], agent=analyst)
        task2 = Task(config=tasks_config['listing_optimization'], agent=optimizer, context=[task1])

        crew = Crew(agents=[analyst, optimizer], tasks=[task1, task2], verbose=True)

        inputs = {
            'product': args.product,
            'market': args.market,
            'target_audience': args.target_audience,
            'file_path': args.file_path
        }

    elif args.mode == 'optimize':
        print(f"🏥 Starting Optimization Mode for ASIN: {args.asin}")
        tasks_config = load_config(str(config_dir / 'tasks_optimize.yaml'))

        # Get tools via MCP or fallback
        diagnostician_tools = get_tools_for_agent(
            mcp_provider,
            'diagnostic-architect',
            [fallback_tools.get('kb'), fallback_tools.get('ss_reverse')]
        )
        diagnostician_tools = [t for t in diagnostician_tools if t is not None]

        # Agents
        diagnostician = Agent(
            role="Amazon Listing Diagnostician",
            goal="Identify traffic gaps and wasted spend in existing listings",
            backstory="Expert in analyzing Reverse ASIN data to find missed opportunities.",
            tools=diagnostician_tools,
            llm=claude_model_name,
            verbose=True
        )

        # Tasks
        task_diag = Task(config=tasks_config['listing_diagnosis'], agent=diagnostician)
        task_ppc = Task(config=tasks_config['ppc_audit'], agent=diagnostician, context=[task_diag])

        crew = Crew(agents=[diagnostician], tasks=[task_diag, task_ppc], verbose=True)

        inputs = {
            'asin': args.asin,
            'file_path': args.file_path
        }

    # Execute
    result = crew.kickoff(inputs=inputs)
    print("######################")
    print(result)
    
    # --- Dynamic Output Handling ---
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    
    # Define Output Directories
    base_dir = "reports"
    os.makedirs(f"{base_dir}/markdown", exist_ok=True)
    os.makedirs(f"{base_dir}/raw_data", exist_ok=True)

    # Determine Filename
    if args.mode == 'optimize' and args.asin:
        file_base = f"{args.asin}_{timestamp}"
    elif args.mode == 'launch' and args.product:
        safe_product = args.product.replace(" ", "_").replace("/", "-")
        file_base = f"Launch_{safe_product}_{timestamp}"
    else:
        file_base = f"Report_{timestamp}"

    # Save Result (Markdown)
    output_md = f"{base_dir}/markdown/{file_base}.md"
    with open(output_md, "w") as f:
        content = str(result)
        if hasattr(result, 'raw'):
            content = result.raw
        f.write(content)
        
    print(f"\n✅ Report Saved: {output_md}")
    
    # Note: Raw Data saving would ideally be handled inside the Tool or returned by it.
    # For now, we only save the final analysis report here.

if __name__ == "__main__":
    main()
