#!/usr/bin/env node
/**
 * LiYe Governance MCP Server v1
 *
 * Minimal MCP server exposing 4 governance tools:
 * - governance_gate
 * - governance_enforce
 * - governance_verdict
 * - governance_replay
 *
 * Protocol: JSON-RPC 2.0 over stdio
 *
 * Usage:
 *   node src/mcp/server.mjs
 *
 * Or import for programmatic use:
 *   import { handleRequest, listTools, callTool } from './server.mjs';
 */

import { createInterface } from 'readline';
import { toolDefinitions, handleToolCall } from './tools.mjs';

/**
 * MCP Server version
 */
const MCP_VERSION = '1.0.0';
const SERVER_NAME = 'liye-governance';
const SERVER_VERSION = '1.0.0';

/**
 * MCP protocol capabilities
 */
const CAPABILITIES = {
  tools: {}
};

/**
 * Handle MCP initialize request
 *
 * @param {Object} params
 * @returns {Object}
 */
function handleInitialize(params) {
  return {
    protocolVersion: MCP_VERSION,
    serverInfo: {
      name: SERVER_NAME,
      version: SERVER_VERSION
    },
    capabilities: CAPABILITIES
  };
}

/**
 * Handle MCP tools/list request
 *
 * @returns {Object}
 */
export function listTools() {
  return {
    tools: toolDefinitions.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  };
}

/**
 * Handle MCP tools/call request
 *
 * @param {Object} params
 * @param {string} params.name - Tool name
 * @param {Object} params.arguments - Tool arguments
 * @returns {Promise<Object>}
 */
export async function callTool(params) {
  const { name, arguments: args } = params;

  // Call tool handler
  const result = await handleToolCall(name, args || {});

  // Format as MCP tool result
  if (result.error) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
}

/**
 * Handle a single MCP JSON-RPC request
 *
 * @param {Object} request - JSON-RPC 2.0 request
 * @returns {Promise<Object>} - JSON-RPC 2.0 response
 */
export async function handleRequest(request) {
  const { id, method, params } = request;

  let result;
  let error;

  try {
    switch (method) {
      case 'initialize':
        result = handleInitialize(params);
        break;

      case 'initialized':
        // Notification, no response needed
        return null;

      case 'tools/list':
        result = listTools();
        break;

      case 'tools/call':
        result = await callTool(params);
        break;

      case 'ping':
        result = {};
        break;

      default:
        error = {
          code: -32601,
          message: `Method not found: ${method}`
        };
    }
  } catch (err) {
    error = {
      code: -32000,
      message: err.message
    };
  }

  // Build response
  if (error) {
    return {
      jsonrpc: '2.0',
      id,
      error
    };
  }

  return {
    jsonrpc: '2.0',
    id,
    result
  };
}

/**
 * Start MCP server on stdio
 */
export function startServer() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  // Read JSON-RPC messages (one per line)
  rl.on('line', async (line) => {
    if (!line.trim()) return;

    try {
      const request = JSON.parse(line);
      const response = await handleRequest(request);

      // Send response (notifications return null)
      if (response) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch (err) {
      // Parse error
      const response = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: `Parse error: ${err.message}`
        }
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    }
  });

  rl.on('close', () => {
    process.exit(0);
  });

  // Handle errors
  process.on('uncaughtException', (err) => {
    console.error('[MCP Server Error]', err.message);
    process.exit(1);
  });
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
