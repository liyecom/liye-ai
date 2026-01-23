#!/bin/bash
#
# MCP Federation - One Command Up
#
# Starts both MCP servers (Governance + Knowledge) locally.
#
# Usage:
#   ./.claude/scripts/mcp_up.sh        # Start both
#   ./.claude/scripts/mcp_up.sh stop   # Stop both
#   ./.claude/scripts/mcp_up.sh status # Check status
#
# Note: For stdio-based servers, they don't run as background daemons.
# This script is primarily for documentation and testing purposes.
# Use docker-compose for production deployments.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# PID files for tracking
PID_DIR="$PROJECT_ROOT/.liye"
GOVERNANCE_PID="$PID_DIR/governance.pid"
KNOWLEDGE_PID="$PID_DIR/knowledge.pid"

# Ensure directories exist
mkdir -p "$PID_DIR/traces"

usage() {
    echo "Usage: $0 [start|stop|status]"
    echo ""
    echo "Commands:"
    echo "  start   Start both MCP servers (default)"
    echo "  stop    Stop both MCP servers"
    echo "  status  Check server status"
    echo ""
    echo "Note: For stdio servers, use 'test' mode for quick validation."
}

start_servers() {
    echo "=== LiYe MCP Federation ==="
    echo ""
    echo "Starting MCP servers..."
    echo ""

    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        echo "Error: Node.js not found. Install Node.js to run Governance MCP."
        exit 1
    fi

    # Check if Python is available
    if ! command -v python3 &> /dev/null; then
        echo "Error: Python 3 not found. Install Python 3 to run Knowledge MCP."
        exit 1
    fi

    echo "Governance MCP (Control Plane):"
    echo "  Command: node src/mcp/server.mjs"
    echo "  Protocol: JSON-RPC 2.0 over stdio"
    echo ""

    echo "Knowledge MCP (Data Plane):"
    echo "  Command: python3 -m src.runtime.mcp.server_main"
    echo "  Protocol: JSON-RPC 2.0 over stdio"
    echo ""

    echo "=== Quick Test ==="
    echo ""
    echo "To test Governance MCP:"
    echo '  echo '\''{"jsonrpc":"2.0","id":1,"method":"tools/list"}'\'' | node src/mcp/server.mjs'
    echo ""
    echo "To test Knowledge MCP:"
    echo '  echo '\''{"jsonrpc":"2.0","id":1,"method":"tools/list"}'\'' | python3 -m src.runtime.mcp.server_main'
    echo ""
    echo "=== Docker Compose (Recommended) ==="
    echo ""
    echo "  docker compose -f docker-compose.mcp.yml up"
    echo ""
}

stop_servers() {
    echo "Stopping MCP servers..."

    # Since stdio servers don't background, this is mostly a placeholder
    if [ -f "$GOVERNANCE_PID" ]; then
        kill $(cat "$GOVERNANCE_PID") 2>/dev/null || true
        rm -f "$GOVERNANCE_PID"
        echo "Governance MCP stopped"
    fi

    if [ -f "$KNOWLEDGE_PID" ]; then
        kill $(cat "$KNOWLEDGE_PID") 2>/dev/null || true
        rm -f "$KNOWLEDGE_PID"
        echo "Knowledge MCP stopped"
    fi

    echo "Done."
}

check_status() {
    echo "=== MCP Server Status ==="
    echo ""

    # Check Node.js
    if command -v node &> /dev/null; then
        echo "Node.js: $(node --version)"
    else
        echo "Node.js: NOT INSTALLED"
    fi

    # Check Python
    if command -v python3 &> /dev/null; then
        echo "Python:  $(python3 --version)"
    else
        echo "Python:  NOT INSTALLED"
    fi

    echo ""

    # Check if servers can be imported
    echo "Governance MCP:"
    if [ -f "$PROJECT_ROOT/src/mcp/server.mjs" ]; then
        echo "  Source: src/mcp/server.mjs (exists)"
    else
        echo "  Source: src/mcp/server.mjs (MISSING)"
    fi

    echo ""

    echo "Knowledge MCP:"
    if [ -f "$PROJECT_ROOT/src/runtime/mcp/server_main.py" ]; then
        echo "  Source: src/runtime/mcp/server_main.py (exists)"
    else
        echo "  Source: src/runtime/mcp/server_main.py (MISSING)"
    fi

    echo ""

    # Check trace directory
    if [ -d "$PROJECT_ROOT/.liye/traces" ]; then
        TRACE_COUNT=$(ls -1 "$PROJECT_ROOT/.liye/traces" 2>/dev/null | wc -l)
        echo "Traces:  .liye/traces/ ($TRACE_COUNT traces)"
    else
        echo "Traces:  .liye/traces/ (not created)"
    fi
}

# Main
cd "$PROJECT_ROOT"

case "${1:-start}" in
    start)
        start_servers
        ;;
    stop)
        stop_servers
        ;;
    status)
        check_status
        ;;
    *)
        usage
        exit 1
        ;;
esac
