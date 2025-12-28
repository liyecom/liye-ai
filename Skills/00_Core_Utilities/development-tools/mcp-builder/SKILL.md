---
name: mcp-builder
description: MCP (Model Context Protocol) 服务器构建指南
domain: 00_Core_Utilities
category: development-tools
version: 1.0.0
status: active
source: awesome-claude-skills
source_url: https://github.com/ComposioHQ/awesome-claude-skills
license: Apache-2.0
---

# MCP Builder

> **来源**: ComposioHQ/awesome-claude-skills
> **适配**: LiYe OS 三层架构

指导创建高质量的 Model Context Protocol (MCP) 服务器，用于将外部 API 和服务集成到 LLM 中。

## When to Use This Skill

当 Claude 需要帮助构建 MCP 服务器时：
- 设计 MCP 服务器架构
- 实现 Python 或 TypeScript MCP 服务器
- 定义工具接口和参数
- 处理错误和边界情况
- 测试和调试 MCP 集成

## Core Capabilities

### 1. 架构设计
- MCP 协议理解
- 服务器结构规划
- 工具设计模式
- 资源管理策略

### 2. Python 实现 (FastMCP)
```python
from fastmcp import FastMCP

mcp = FastMCP("my-server")

@mcp.tool()
def my_tool(param: str) -> str:
    """工具描述"""
    return f"结果: {param}"
```

### 3. TypeScript 实现 (MCP SDK)
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server';

const server = new McpServer({
  name: 'my-server',
  version: '1.0.0'
});

server.tool('my_tool', 'Tool description', {
  param: { type: 'string', description: 'Parameter' }
}, async (args) => {
  return { result: `Result: ${args.param}` };
});
```

### 4. 工具定义最佳实践
- 清晰的工具命名
- 详细的参数描述
- 类型安全的输入输出
- 错误处理模式

### 5. 测试与调试
- 单元测试策略
- 集成测试方法
- 日志和监控
- 性能优化

## Usage Examples

### 示例 1: 创建数据库查询 MCP
```
用户: 帮我创建一个查询 PostgreSQL 的 MCP 服务器
Claude: [使用 mcp-builder 技能设计架构，生成代码框架]
```

### 示例 2: 集成第三方 API
```
用户: 我想让 Claude 能调用天气 API
Claude: [使用 mcp-builder 技能创建 weather-mcp-server]
```

### 示例 3: 扩展现有 MCP
```
用户: 给 SellerSprite MCP 添加新的工具
Claude: [使用 mcp-builder 技能分析现有结构，设计新工具]
```

## Dependencies

- Python: fastmcp, mcp
- TypeScript: @modelcontextprotocol/sdk

## LiYe OS Integration

### 业务域引用
此技能被以下业务域引用：
- **06_Technical_Development**: MCP 生态扩展（主域）

### 已有 MCP 服务器参考
LiYe OS 已有 3 个 MCP 服务器可作为参考：
- `src/runtime/mcp/servers/amazon/sellersprite_server.py`
- `src/runtime/mcp/servers/knowledge/qdrant_server.py`
- `src/runtime/mcp/servers/data/` (数据层)

### 三层架构位置
- **物理层 (本文件)**: Skills/00_Core_Utilities/development-tools/mcp-builder/
- **逻辑层索引**: Skills/{domain}/index.yaml
- **L3 指令层**: .claude/skills/{domain}/mcp-builder/

---
**Created**: 2025-12-28 | **Adapted for LiYe OS**
