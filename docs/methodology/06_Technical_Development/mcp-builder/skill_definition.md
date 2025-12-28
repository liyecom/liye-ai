# 🔧 MCP Server Builder Skill

**Version**: 1.0
**Created**: 2025-12-28
**Last Updated**: 2025-12-28
**Status**: Active
**Source**: Awesome Claude Skills → LiYe OS Adapted

---

## 🔹01. Skill Identity（技能身份）

**Skill Name**: MCP Server Builder / MCP 服务器构建

**Core Mission**:
指导创建高质量的 Model Context Protocol (MCP) 服务器，将外部 API 和服务集成到 LLM 工作流中，扩展 LiYe OS 的 MCP 生态系统。

**Capability Domain**: Technical Development
- MCP 服务器架构设计
- Python/TypeScript 实现
- 工具定义最佳实践
- 错误处理与重试
- 测试与调试

**Target Scenarios**:
- 集成新的外部 API（SellerSprite, Amazon SP-API 等）
- 创建自定义工具服务器
- 扩展 LiYe OS MCP 能力
- 连接内部系统与 Claude

---

## 🔹02. Capability Model（能力模型）

### Key Competencies（核心能力维度）

#### A. MCP 协议理解
- MCP 架构原理
- Transport 层（stdio, SSE, WebSocket）
- 消息格式（JSON-RPC 2.0）
- 工具/资源/提示的区别

#### B. 工具设计
- 工具命名规范
- 参数 Schema 定义（JSON Schema）
- 返回值设计
- 错误码定义

#### C. Python 实现 (FastMCP)
```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("my-server")

@mcp.tool()
def my_tool(param: str) -> str:
    """Tool description"""
    return f"Result: {param}"
```

#### D. TypeScript 实现 (MCP SDK)
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const server = new Server({
  name: "my-server",
  version: "1.0.0"
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{ name: "my_tool", ... }]
}));
```

#### E. 测试与部署
- 单元测试编写
- 集成测试
- 本地调试
- Claude Desktop 集成

---

## 🔹03. Mental Models / Principles（思维模型 / 原则）

### Core Thinking Frameworks

#### 1. MCP 架构分层
```
┌─────────────────────────────────┐
│          Claude (Host)          │
├─────────────────────────────────┤
│         MCP Protocol            │
├─────────────────────────────────┤
│    Transport (stdio/SSE/WS)     │
├─────────────────────────────────┤
│         MCP Server              │
│  ┌─────────┬─────────┬───────┐  │
│  │  Tools  │Resources│Prompts│  │
│  └─────────┴─────────┴───────┘  │
├─────────────────────────────────┤
│        External APIs            │
└─────────────────────────────────┘
```

#### 2. 工具设计原则
```
单一职责：一个工具做一件事
明确命名：动词_名词（search_products, get_keywords）
参数最小化：只要必须参数
错误明确：返回有意义的错误信息
幂等性：相同输入相同输出
```

#### 3. 开发流程
```
需求 → 设计 → 实现 → 测试 → 集成 → 文档
```

### Unbreakable Principles（不可违反原则）

1. **安全第一**：不暴露敏感信息，验证输入
2. **向后兼容**：工具签名变更需谨慎
3. **错误优雅**：永不崩溃，返回有意义错误
4. **文档完整**：每个工具都有描述和示例

---

## 🔹04. Methods & SOPs（方法论 / 操作手册）

### Standard Operating Procedure: MCP Server Creation

#### Phase 1: 需求分析与设计
```
Step 1.1 明确目标
  - 集成什么 API/服务？
  - 需要哪些工具？
  - 用户是谁？使用场景？

Step 1.2 工具设计
  - 列出所有工具
  - 定义每个工具的：
    ✓ 名称（snake_case）
    ✓ 描述（一句话）
    ✓ 参数（必须/可选）
    ✓ 返回值
    ✓ 错误情况

Step 1.3 架构决策
  - 语言选择（Python/TypeScript）
  - Transport 选择（stdio/SSE）
  - 依赖管理
```

#### Phase 2: 实现
```
Step 2.1 项目初始化
  Python:
    mkdir my-mcp-server && cd my-mcp-server
    uv init
    uv add "mcp[cli]"

  TypeScript:
    npm init -y
    npm install @modelcontextprotocol/sdk

Step 2.2 服务器框架
  - 创建入口文件
  - 配置服务器元数据
  - 设置 Transport

Step 2.3 工具实现
  - 逐个实现工具函数
  - 添加参数验证
  - 实现错误处理
  - 添加日志

Step 2.4 资源与提示（可选）
  - 实现 resources（如果需要）
  - 实现 prompts（如果需要）
```

#### Phase 3: 测试
```
Step 3.1 单元测试
  - 测试每个工具函数
  - 测试边界情况
  - 测试错误处理

Step 3.2 集成测试
  - 启动服务器
  - 使用 MCP Inspector 测试
  - 验证 JSON-RPC 响应

Step 3.3 端到端测试
  - 在 Claude Desktop 中测试
  - 验证工具调用流程
```

#### Phase 4: 文档与部署
```
Step 4.1 文档编写
  - README.md
  - 工具使用说明
  - 配置示例

Step 4.2 Claude 配置
  - 更新 claude_desktop_config.json
  - 配置环境变量

Step 4.3 部署（如需远程）
  - SSE 服务器部署
  - 健康检查配置
```

---

## 🔹05. Execution Protocols（执行协议）

### Pre-Execution Checklist

**必须确认的问题**：
1. ✓ 要集成的 API 有文档吗？
2. ✓ 需要什么认证方式？（API Key, OAuth）
3. ✓ 有速率限制吗？
4. ✓ 选择 Python 还是 TypeScript？
5. ✓ 需要哪些工具？

### Decision-Making Logic

**选择 Python (FastMCP)**：
→ 快速原型
→ 已有 Python 生态
→ 简单 API 集成

**选择 TypeScript (MCP SDK)**：
→ 需要细粒度控制
→ 已有 Node.js 生态
→ 复杂协议处理

---

## 🔹06. Output Structure（标准化交付格式）

### Template: MCP 服务器项目结构

```
my-mcp-server/
├── src/
│   ├── __init__.py
│   ├── server.py          # 服务器入口
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── search.py      # 搜索工具
│   │   └── analysis.py    # 分析工具
│   └── utils/
│       ├── __init__.py
│       └── api_client.py  # API 客户端
├── tests/
│   ├── test_tools.py
│   └── test_integration.py
├── pyproject.toml
├── README.md
└── .env.example
```

### Template: 工具定义

```python
@mcp.tool()
def search_keywords(
    keyword: str,
    marketplace: str = "US"
) -> dict:
    """
    Search for Amazon keywords and return analysis data.

    Args:
        keyword: The keyword to search for
        marketplace: Amazon marketplace code (US, UK, DE, etc.)

    Returns:
        Dictionary containing keyword metrics:
        - search_volume: Monthly search volume
        - competition: Competition level (1-10)
        - suggested_bid: Suggested PPC bid
    """
    # Implementation
    pass
```

---

## 🔹07. Templates & Prompts（模板库）

### 激活 Prompt

```
激活 MCP Server Builder Skill

目标：创建 [服务名称] MCP 服务器
API 文档：[API 文档链接]
工具列表：
1. [tool_name_1]: [描述]
2. [tool_name_2]: [描述]

请按照 skill_definition.md 的 SOP 生成项目代码。
```

### FastMCP 快速启动模板

```python
# server.py
from mcp.server.fastmcp import FastMCP
import os

mcp = FastMCP("my-server")

@mcp.tool()
def hello(name: str) -> str:
    """Say hello to someone."""
    return f"Hello, {name}!"

if __name__ == "__main__":
    mcp.run()
```

---

## 🔹08. Tools Access / Knowledge Assets（工具 & 知识接口）

### Required Dependencies

**Python**：
- mcp[cli] >= 1.0.0
- httpx（HTTP 客户端）
- pydantic（数据验证）

**TypeScript**：
- @modelcontextprotocol/sdk
- zod（Schema 验证）

### LiYe OS Integration Points

**现有 MCP 服务器**：
- SellerSprite Server（Amazon 关键词）
- Qdrant Server（知识库）
- （待扩展）

**配置路径**：
- `src/runtime/mcp/servers/`
- `~/.config/claude/claude_desktop_config.json`

---

## 🔹09. Evaluation & Scoring（绩效 & 质量指标）

### Output Quality Metrics

| 维度 | 权重 | 评分标准 |
|------|------|----------|
| 工具设计 | 30% | 命名清晰、参数合理、错误处理 |
| 代码质量 | 30% | 可读性、可维护性、测试覆盖 |
| 文档完整 | 20% | README、工具说明、示例 |
| 集成顺畅 | 20% | Claude 调用成功率 |

### Self-Evaluation Checklist

- [ ] 所有工具都有描述？
- [ ] 参数验证完整？
- [ ] 错误处理优雅？
- [ ] 测试覆盖关键路径？
- [ ] 文档清晰可用？

---

## 🔹10. Feedback / Evolution Loop（进化循环机制）

### 持续改进触发条件

1. **MCP 协议更新**：跟进官方更新
2. **新集成需求**：扩展模板库
3. **错误模式**：更新最佳实践

### 版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2025-12-28 | 初始版本创建 |

---

**END OF SKILL DEFINITION**
