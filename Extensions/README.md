# LiYe AI Extensions

Extension points for integrating external tools and capabilities.

## Directory Structure

```
Extensions/
├── README.md              # This file
├── claude-skills/         # Claude Code skill definitions
│   ├── README.md
│   └── *.md               # Individual skill files
└── mcp-servers/           # MCP server configurations
    ├── README.md
    └── *.json             # Server configurations
```

## Extension Types

### 1. Claude Skills

Custom skills that extend Claude Code's capabilities within the LiYe AI ecosystem.

- Location: `Extensions/claude-skills/`
- Format: Markdown files following Anthropic's skill format
- Usage: Automatically loaded by Claude Code when working in this repository

### 2. MCP Servers

Model Context Protocol servers that provide tool access.

- Location: `Extensions/mcp-servers/`
- Format: JSON configuration files
- Usage: Configured in Claude settings or VS Code settings

## Adding Extensions

### Adding a Claude Skill

1. Create a new `.md` file in `Extensions/claude-skills/`
2. Follow the skill format specification
3. Test with Claude Code in this repository

### Adding an MCP Server

1. Create a JSON config in `Extensions/mcp-servers/`
2. Add to your Claude/VS Code settings
3. Verify connection with `mcp list`

## Integration with LiYe AI

Extensions integrate with the core system through:

- **Agents**: Can reference extension skills in their `skills` section
- **Crews**: Can utilize MCP servers for tool access
- **Runtime**: Handles extension loading and capability resolution
