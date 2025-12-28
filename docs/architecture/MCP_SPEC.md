# MCP_SPEC · MCP 工程级规范
MCP Engineering Specification (v5.0)

> **Version**: 5.0
> **Status**: Phase 1–2 VERIFIED
> **Change Policy**: Feature freeze until data contracts satisfied
> **Date**: 2025-12-27

---

## §0 定义声明（冻结）

**MCP (Model Context Protocol) = AI 系统的标准化外部连接协议**

MCP 是 LiYe OS 与外部世界通信的**唯一标准接口**，
不是工具库、不是插件系统、不是 API 框架。

```
┌─────────────────────────────────────────────────────────────────┐
│                      LiYe OS Runtime                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    MCP Layer                              │  │
│  │  ┌─────────┐   ┌─────────┐   ┌─────────┐                 │  │
│  │  │Registry │   │Security │   │Adapters │                 │  │
│  │  └────┬────┘   └────┬────┘   └────┬────┘                 │  │
│  │       │             │             │                       │  │
│  │  ┌────▼─────────────▼─────────────▼────┐                 │  │
│  │  │           Transport Layer            │                 │  │
│  │  │   (stdio | HTTP | WebSocket)         │                 │  │
│  │  └────────────────┬─────────────────────┘                 │  │
│  └───────────────────│───────────────────────────────────────┘  │
└──────────────────────│──────────────────────────────────────────┘
                       │
         ┌─────────────▼─────────────┐
         │      External World       │
         │  ┌─────┐ ┌─────┐ ┌─────┐  │
         │  │Qdrant│ │APIs │ │DBs  │  │
         │  └─────┘ └─────┘ └─────┘  │
         └───────────────────────────┘
```

---

## §1 MCP 在四层架构中的位置（冻结）

### 1.1 架构位置

```
src/runtime/mcp/    ← MCP 属于 Runtime 层
```

| 层 | 职责 | MCP 关系 |
|----|------|---------|
| Method | 定义 WHY | MCP 不触碰 |
| Runtime | 执行 HOW | **MCP 所在层** |
| Skill | 声明 WHAT | MCP 暴露 Skill |
| Domain | 组装 WHERE | Domain 配置 MCP |

### 1.2 为何不在 Extensions？

- `Extensions/` 是 Claude 特定扩展
- MCP 是**平台级执行基础设施**
- MCP 与 `executor/`、`scheduler/`、`memory/` 平级

**禁止**：将 MCP 实现放在 `Extensions/mcp-servers/`（该目录仅保留配置模板）

---

## §2 MCP 核心职责（冻结）

### MCP 可以做的
- 暴露 Skill 为标准化 Tool
- 管理与外部服务的连接
- 提供统一的认证与授权
- 记录工具调用审计日志

### MCP 不可以做的
- 定义业务逻辑
- 修改 Method / Skill 规则
- 绕过 Domain 配置直接启用服务器
- 存储业务状态

---

## §3 目录结构（冻结）

```text
src/runtime/mcp/
├── __init__.py
├── types.py                    # 核心类型定义
├── registry.py                 # 服务器注册与生命周期
├── base_server.py              # 抽象服务器基类
│
├── transport/                  # Transport 抽象层（预留扩展）
│   ├── __init__.py
│   ├── base.py                 # Transport 接口
│   ├── stdio.py                # stdio 实现
│   └── http.py                 # HTTP 实现（预留）
│
├── security/
│   ├── __init__.py
│   ├── vault.py                # 凭证保险库
│   ├── permissions.py          # 工具权限矩阵
│   └── audit.py                # 审计日志
│
├── servers/                    # MCP Server 实现
│   ├── __init__.py
│   ├── knowledge/              # 知识类服务器
│   ├── amazon/                 # Amazon 领域服务器
│   ├── data/                   # 数据类服务器
│   └── external/               # 外部 API 服务器
│
├── adapters/                   # Agent 框架适配器
│   ├── __init__.py
│   └── crewai_adapter.py       # CrewAI 集成
│
└── config/
    └── default.yaml            # 系统默认配置
```

---

## §4 Transport 抽象层（冻结）

### 4.1 Transport 接口定义

```python
# src/runtime/mcp/transport/base.py
from abc import ABC, abstractmethod
from typing import Any

class MCPTransport(ABC):
    """MCP Transport 抽象接口"""

    @abstractmethod
    async def connect(self) -> None:
        """建立连接"""
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        """断开连接"""
        pass

    @abstractmethod
    async def send(self, message: dict) -> None:
        """发送消息"""
        pass

    @abstractmethod
    async def receive(self) -> dict:
        """接收消息"""
        pass

    @property
    @abstractmethod
    def transport_type(self) -> str:
        """返回 transport 类型标识"""
        pass
```

### 4.2 支持的 Transport 类型

| 类型 | 状态 | 使用场景 |
|------|------|---------|
| `stdio` | Phase 1 实现 | 本地进程通信 |
| `http` | 预留接口 | 云端/远程服务 |
| `websocket` | 预留接口 | 实时双向通信 |

### 4.3 Transport 选择规则

- Phase 1-2：**仅使用 stdio**
- 未来扩展：通过 `transport_type` 配置切换
- **禁止**：在代码中硬编码 Transport 类型

---

## §5 三层配置模型（冻结）

### 5.1 配置层级

```
System (架构师) → Domain (领域负责人) → Session (开发者)
```

| 层级 | 位置 | 权限 |
|------|------|------|
| **System** | `src/runtime/mcp/config/default.yaml` | 定义默认服务器 |
| **Domain** | `src/domain/*/config/mcp_servers.yaml` | 启用/禁用/覆盖参数 |
| **Session** | `.claude/settings.local.json` | 开发时临时覆盖 |

### 5.2 配置合并规则

1. System 提供默认值
2. Domain 可覆盖 `enabled`、`config` 参数
3. Session 可覆盖任意参数（仅限本地）
4. **禁止**：Domain 定义 System 未声明的服务器

### 5.3 System 配置示例

```yaml
# src/runtime/mcp/config/default.yaml
version: "1.0"
schema: "mcp-config-v5"

servers:
  qdrant-knowledge:
    type: custom
    module: src.runtime.mcp.servers.knowledge.qdrant_server
    class: QdrantMCPServer
    transport: stdio                    # 显式声明 Transport
    config:
      url: "${QDRANT_URL:-http://localhost:6333}"
      collection: "default"
    permissions:
      read: true
      write: false
    tools:
      - semantic_search
      - similar_docs

  filesystem:
    type: external
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem"]
    transport: stdio
    permissions:
      read: true
      write: true
      allowed_paths:
        - "Artifacts_Vault/"
        - "reports/"
      denied_paths:
        - ".env"
        - "secrets/"
```

### 5.4 Domain 配置示例

```yaml
# src/domain/amazon-growth/config/mcp_servers.yaml
inherit: src/runtime/mcp/config/default.yaml

servers:
  qdrant-knowledge:
    enabled: true
    override:
      collection: "amazon_kb_production"

  sellersprite:
    enabled: true
    # Domain 可启用 System 未启用的服务器
```

---

## §6 Server 规范（冻结）

### 6.1 Server 基类

```python
# src/runtime/mcp/base_server.py
from abc import ABC, abstractmethod
from typing import List
from .types import MCPTool, MCPResource
from .transport.base import MCPTransport

class BaseMCPServer(ABC):
    """MCP Server 抽象基类"""

    def __init__(self, transport: MCPTransport, config: dict):
        self._transport = transport
        self._config = config

    @property
    @abstractmethod
    def server_name(self) -> str:
        """服务器唯一标识"""
        pass

    @abstractmethod
    def list_tools(self) -> List[MCPTool]:
        """声明可用工具"""
        pass

    @abstractmethod
    async def handle_tool(self, name: str, arguments: dict) -> dict:
        """执行工具调用"""
        pass

    def list_resources(self) -> List[MCPResource]:
        """声明可用资源（可选）"""
        return []
```

### 6.2 Server 实现规则

- 每个 Server 必须继承 `BaseMCPServer`
- 必须实现 `server_name`、`list_tools`、`handle_tool`
- **禁止**：在 Server 中直接操作 Transport（通过基类）
- **禁止**：在 Server 中存储跨调用状态

### 6.3 Server 分类

| 类别 | 目录 | 示例 |
|------|------|------|
| knowledge | `servers/knowledge/` | qdrant_server, notion_server |
| amazon | `servers/amazon/` | sellersprite_server, ads_api_server |
| data | `servers/data/` | duckdb_server, etl_server |
| external | `servers/external/` | openai_server, anthropic_server |

---

## §7 安全模型（冻结）

### 7.1 凭证管理

```
优先级：环境变量 > 加密保险库 > 报错
```

| 存储位置 | 用途 |
|----------|------|
| 环境变量 | 开发/CI 环境 |
| `~/.liye/mcp_vault.encrypted` | 生产凭证存储 |

**禁止**：
- 凭证写入代码
- 凭证写入 YAML 配置
- 凭证写入版本控制

### 7.2 工具权限矩阵

```python
# src/runtime/mcp/security/permissions.py
from enum import Enum

class ToolRisk(Enum):
    READ_ONLY = "read_only"      # 无副作用
    MUTATING = "mutating"        # 修改数据
    EXTERNAL = "external"        # 外部网络
    FINANCIAL = "financial"      # 财务影响
```

| 风险等级 | 要求 |
|----------|------|
| READ_ONLY | 无需确认 |
| MUTATING | 记录审计日志 |
| EXTERNAL | 速率限制 |
| FINANCIAL | **必须用户确认** |

### 7.3 审计日志

所有工具调用必须记录：
- 时间戳
- Server 名称
- Tool 名称
- 调用 Agent
- 参数（脱敏）
- 耗时

**位置**：`~/.liye/mcp_audit.jsonl`

---

## §8 Adapter 规范（冻结）

### 8.1 Adapter 职责

Adapter 将 MCP Server 转换为 Agent 框架可用的工具。

```
MCP Server → Adapter → Agent Framework Tool
```

### 8.2 CrewAI Adapter 示例

```python
# src/runtime/mcp/adapters/crewai_adapter.py
from crewai.tools import BaseTool
from ..registry import MCPRegistry

class MCPToolProvider:
    """将 MCP Server 转换为 CrewAI Tool"""

    def __init__(self, registry: MCPRegistry):
        self._registry = registry

    def get_tools(self, server_names: list[str]) -> list[BaseTool]:
        """获取指定服务器的所有工具"""
        tools = []
        for name in server_names:
            server = self._registry.get_server(name)
            tools.extend(self._wrap_tools(server))
        return tools
```

### 8.3 Agent 使用模式

```python
# 目标用法（Phase 2 后）
from src.runtime.mcp.registry import MCPRegistry
from src.runtime.mcp.adapters.crewai_adapter import MCPToolProvider

registry = MCPRegistry.from_config("config/mcp_servers.yaml")
provider = MCPToolProvider(registry)

analyst = Agent(
    config=agents_config['keyword_analyst'],
    tools=provider.get_tools(["qdrant-knowledge", "sellersprite"]),
    llm=claude_model_name
)
```

---

## §9 禁止模式（红线）

| 违规模式 | 说明 |
|----------|------|
| ❌ MCP Server 定义业务逻辑 | 业务逻辑属于 Skill/Domain |
| ❌ 硬编码 Transport 类型 | 必须通过配置声明 |
| ❌ Server 直接读取环境变量 | 必须通过 Vault |
| ❌ Domain 定义 System 未声明的 Server | Domain 只能启用/禁用 |
| ❌ Agent 直接实例化 MCP Server | 必须通过 Registry + Adapter |
| ❌ 跳过审计日志 | 所有调用必须记录 |

---

## §10 与其他规范的关系

### 10.1 裁决顺序

当 MCP 实现出现争议时：

1. `NAMING.md`
2. `ARCHITECTURE.md`
3. **`MCP_SPEC.md`**
4. `AGENT_SPEC.md`

### 10.2 依赖关系

```
NAMING.md          ← 命名规范（MCP 类型命名遵循）
    ↓
ARCHITECTURE.md    ← 四层架构（MCP 位于 Runtime）
    ↓
MCP_SPEC.md        ← 本文件
    ↓
AGENT_SPEC.md      ← Agent 通过 Adapter 使用 MCP
```

---

## §11 演进路径（非冻结）

### Phase 1-2（当前）
- Transport：仅 stdio
- Server：Qdrant, SellerSprite, DuckDB
- Adapter：CrewAI

### Phase 3-4（未来）
- Transport：增加 HTTP
- Server：Notion, OpenAI, Anthropic
- 功能：速率限制、健康监控

### Long-term
- Transport：WebSocket
- 生态：第三方 Server 接入
- 分布式：多节点调度

---

## §12 冻结声明

自本文件生效起：
- 新增 / 修改 MCP 实现必须符合本规范
- 不符合规范的实现视为架构违规
- Transport 抽象层、三层配置模型、安全模型为**冻结条款**
- 演进路径（§11）为**非冻结条款**，可根据实际调整
- 本文件修改需单独 PR，并说明原因

---

**This document is FROZEN as of v5.0 (2025-12-27).**
