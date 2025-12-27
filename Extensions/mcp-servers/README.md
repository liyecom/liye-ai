# MCP Servers

Model Context Protocol server configurations for LiYe AI.

## What is MCP?

MCP (Model Context Protocol) is a standard for connecting AI models to external tools and data sources. MCP servers provide:
- Tool access (file operations, APIs, databases)
- Context injection (documentation, knowledge bases)
- Resource management

## Configuration Format

Each server is defined in a JSON file:

```json
{
  "name": "server-name",
  "description": "What this server provides",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-name"],
  "env": {
    "API_KEY": "${API_KEY}"
  }
}
```

## Available Servers

| Server | Purpose | Tools Provided |
|--------|---------|----------------|
| `filesystem.json` | File operations | read, write, list |
| `postgres.json` | Database access | query, schema |
| `github.json` | GitHub integration | repos, issues, PRs |

## Installation

### In Claude Desktop

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "liye-filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/liye_os"]
    }
  }
}
```

### In VS Code (Continue)

Add to `.continue/config.json`:

```json
{
  "mcpServers": [
    {
      "name": "liye-filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"]
    }
  ]
}
```

## Creating a Custom Server

1. Create a new JSON config in this directory
2. Specify command, args, and any environment variables
3. Test connection: `npx @modelcontextprotocol/inspector`
4. Add to your Claude/VS Code settings

## Security Notes

- Never commit API keys or secrets
- Use environment variable references: `${VAR_NAME}`
- Review server permissions before enabling
- Limit filesystem access to necessary directories

## Integration with LiYe AI

MCP servers extend agent capabilities:

```yaml
# In agent definition
skills:
  mcp:
    - server: filesystem
      tools: [read_file, write_file]
    - server: github
      tools: [list_issues, create_pr]
```
