#!/usr/bin/env python3
"""
LiYe Knowledge MCP Server v1

Minimal stdio server exposing Knowledge MCP tools:
- Qdrant: semantic_search, similar_docs, get_document, list_collections
- DuckDB: execute_query, get_schema, list_tables, get_sample, describe_stats

Protocol: JSON-RPC 2.0 over stdio

Usage:
    python -m src.runtime.mcp.server_main

Or run directly:
    python src/runtime/mcp/server_main.py
"""

import asyncio
import json
import sys
import logging
from typing import Any, Dict, List, Optional

# Configure logging to stderr (not stdout, which is used for JSON-RPC)
logging.basicConfig(
    level=logging.INFO,
    format='[Knowledge MCP] %(levelname)s: %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# Server info
MCP_VERSION = '1.0.0'
SERVER_NAME = 'liye-knowledge'
SERVER_VERSION = '1.0.0'

# Available server implementations (lazy loaded)
_servers: Dict[str, Any] = {}


def get_mock_tools() -> List[Dict[str, Any]]:
    """
    Return mock tool definitions for demo/testing.

    In production, these would come from actual server instances.
    For federation demo, we provide mock implementations that don't
    require Qdrant/DuckDB to be running.
    """
    return [
        # Qdrant tools
        {
            'name': 'semantic_search',
            'description': 'Search knowledge base using semantic similarity',
            'inputSchema': {
                'type': 'object',
                'properties': {
                    'query': {'type': 'string', 'description': 'Search query'},
                    'top_k': {'type': 'integer', 'default': 5}
                },
                'required': ['query']
            }
        },
        {
            'name': 'similar_docs',
            'description': 'Find documents similar to a given document',
            'inputSchema': {
                'type': 'object',
                'properties': {
                    'doc_id': {'type': 'string'},
                    'top_k': {'type': 'integer', 'default': 5}
                },
                'required': ['doc_id']
            }
        },
        {
            'name': 'get_document',
            'description': 'Retrieve a specific document by ID',
            'inputSchema': {
                'type': 'object',
                'properties': {
                    'doc_id': {'type': 'string'}
                },
                'required': ['doc_id']
            }
        },
        {
            'name': 'list_collections',
            'description': 'List all available collections',
            'inputSchema': {
                'type': 'object',
                'properties': {},
                'required': []
            }
        },
        # DuckDB tools
        {
            'name': 'execute_query',
            'description': 'Execute a read-only SQL query',
            'inputSchema': {
                'type': 'object',
                'properties': {
                    'sql': {'type': 'string'},
                    'max_rows': {'type': 'integer', 'default': 1000}
                },
                'required': ['sql']
            }
        },
        {
            'name': 'list_tables',
            'description': 'List all tables in the database',
            'inputSchema': {
                'type': 'object',
                'properties': {},
                'required': []
            }
        }
    ]


async def handle_tool_call(name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle a tool call.

    For federation demo, returns mock responses.
    In production, would route to actual server implementations.
    """
    logger.info(f"Tool call: {name} with args: {arguments}")

    # Mock responses for demo
    if name == 'semantic_search':
        query = arguments.get('query', '')
        return {
            'query': query,
            'collection': 'amazon_knowledge_base',
            'total_results': 3,
            'results': [
                {
                    'id': 'doc-001',
                    'score': 95.2,
                    'source_file': 'advertising_strategies.md',
                    'section_title': 'ACOS Optimization',
                    'text_preview': f'Results for: {query}...'
                },
                {
                    'id': 'doc-002',
                    'score': 87.5,
                    'source_file': 'keyword_research.md',
                    'section_title': 'Keyword Selection',
                    'text_preview': 'Related content...'
                },
                {
                    'id': 'doc-003',
                    'score': 82.1,
                    'source_file': 'ppc_guide.md',
                    'section_title': 'Campaign Structure',
                    'text_preview': 'Additional reference...'
                }
            ]
        }

    elif name == 'similar_docs':
        return {
            'source_doc_id': arguments.get('doc_id'),
            'collection': 'amazon_knowledge_base',
            'similar_docs': [
                {'id': 'doc-004', 'score': 91.0, 'source_file': 'related.md'}
            ]
        }

    elif name == 'get_document':
        return {
            'id': arguments.get('doc_id'),
            'collection': 'amazon_knowledge_base',
            'document': {
                'source_file': 'example.md',
                'section_title': 'Example Section',
                'text': 'This is the document content.'
            }
        }

    elif name == 'list_collections':
        return {
            'collections': [
                {'name': 'amazon_knowledge_base', 'vectors_count': 1500},
                {'name': 'general_knowledge', 'vectors_count': 500}
            ],
            'total': 2
        }

    elif name == 'execute_query':
        return {
            'query': arguments.get('sql'),
            'columns': ['keyword', 'search_volume', 'acos'],
            'row_count': 2,
            'data': [
                {'keyword': 'example', 'search_volume': 1000, 'acos': 25.5},
                {'keyword': 'demo', 'search_volume': 500, 'acos': 18.2}
            ]
        }

    elif name == 'list_tables':
        return {
            'database': 'data/warehouse.duckdb',
            'table_count': 3,
            'tables': [
                {'name': 'fact_keyword_snapshot', 'row_count': 10000},
                {'name': 'dim_product', 'row_count': 500},
                {'name': 'fact_sales', 'row_count': 25000}
            ]
        }

    else:
        return {
            'error': f'Unknown tool: {name}'
        }


def handle_initialize(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle MCP initialize request."""
    return {
        'protocolVersion': MCP_VERSION,
        'serverInfo': {
            'name': SERVER_NAME,
            'version': SERVER_VERSION
        },
        'capabilities': {
            'tools': {}
        }
    }


def handle_tools_list() -> Dict[str, Any]:
    """Handle MCP tools/list request."""
    return {
        'tools': get_mock_tools()
    }


async def handle_tools_call(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle MCP tools/call request."""
    name = params.get('name', '')
    arguments = params.get('arguments', {})

    result = await handle_tool_call(name, arguments)

    if 'error' in result:
        return {
            'isError': True,
            'content': [
                {'type': 'text', 'text': json.dumps(result, indent=2)}
            ]
        }

    return {
        'content': [
            {'type': 'text', 'text': json.dumps(result, indent=2)}
        ]
    }


async def handle_request(request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Handle a single MCP JSON-RPC request."""
    request_id = request.get('id')
    method = request.get('method', '')
    params = request.get('params', {})

    result = None
    error = None

    try:
        if method == 'initialize':
            result = handle_initialize(params)
        elif method == 'initialized':
            # Notification, no response
            return None
        elif method == 'tools/list':
            result = handle_tools_list()
        elif method == 'tools/call':
            result = await handle_tools_call(params)
        elif method == 'ping':
            result = {}
        else:
            error = {
                'code': -32601,
                'message': f'Method not found: {method}'
            }
    except Exception as e:
        error = {
            'code': -32000,
            'message': str(e)
        }

    # Build response
    if error:
        return {
            'jsonrpc': '2.0',
            'id': request_id,
            'error': error
        }

    return {
        'jsonrpc': '2.0',
        'id': request_id,
        'result': result
    }


async def main():
    """Main entry point - run stdio server."""
    logger.info(f'Starting {SERVER_NAME} v{SERVER_VERSION}')

    # Read from stdin, write to stdout (JSON-RPC over stdio)
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)
    await asyncio.get_event_loop().connect_read_pipe(lambda: protocol, sys.stdin)

    writer_transport, writer_protocol = await asyncio.get_event_loop().connect_write_pipe(
        asyncio.streams.FlowControlMixin,
        sys.stdout
    )
    writer = asyncio.StreamWriter(writer_transport, writer_protocol, reader, asyncio.get_event_loop())

    while True:
        try:
            line = await reader.readline()
            if not line:
                break

            line = line.decode('utf-8').strip()
            if not line:
                continue

            request = json.loads(line)
            response = await handle_request(request)

            if response:
                writer.write((json.dumps(response) + '\n').encode('utf-8'))
                await writer.drain()

        except json.JSONDecodeError as e:
            error_response = {
                'jsonrpc': '2.0',
                'id': None,
                'error': {
                    'code': -32700,
                    'message': f'Parse error: {e}'
                }
            }
            writer.write((json.dumps(error_response) + '\n').encode('utf-8'))
            await writer.drain()
        except Exception as e:
            logger.error(f'Error: {e}')
            break

    logger.info('Server shutdown')


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
