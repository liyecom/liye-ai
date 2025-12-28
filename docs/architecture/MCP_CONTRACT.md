# LiYe OS · MCP Runtime Contract

**Version**: v0.1
**Status**: Active
**Scope**: Runtime / Control Plane
**Audience**: LiYe OS Core Developers · MCP Server Authors · Agent Integrators

---

## §0. 目的（Purpose）

本 Contract 用于定义 LiYe OS 中 MCP（Model Context Protocol）作为 Runtime 控制平面的：

- 生命周期规则
- 能力暴露边界
- 稳定性与演进原则
- 安全与权限约束

**目标**：
确保 MCP 可长期演进、可扩展、可被第三方接入，且不破坏 LiYe OS 核心稳定性。

---

## §1. MCP 的定位（Non-Negotiable）

- MCP 属于 **Runtime 层**，不是 Domain、Agent 或 Tool 层
- MCP 是 **Control Plane**，不是业务实现
- MCP Server 是 **能力提供者**，Agent 是 **能力消费者**

**禁止行为**：
- ❌ Agent 直接依赖 MCP Server 内部实现
- ❌ Domain 代码直接 import MCP Server
- ❌ MCP Server 持有业务状态或业务决策权

---

## §2. MCP Server 生命周期（Lifecycle）

### 2.1 启动原则

- MCP Server 必须由 **Runtime 启动**
- 禁止 Agent / Domain 自行启动 MCP Server
- Server 启动顺序由 registry 控制

```
Runtime
 └── MCP Registry
      └── MCP Server (stdio / future: http)
```

### 2.2 关闭原则

- MCP Server 必须支持 **graceful shutdown**
- Runtime 负责：
  - 资源回收
  - 连接终止
  - 凭证卸载

---

## §3. Tool 暴露契约（Tool Contract）

### 3.1 Tool 的定义标准

每个 MCP Tool 必须满足：

- **单一职责**（One Intent）
- **业务语义清晰**（非 API 语义）
- **可幂等**（尽可能）

**正确示例**：
- `diagnose_listing`
- `find_opportunities`

**错误示例**：
- `call_sellersprite_api`
- `raw_sql_execute`

### 3.2 Tool 稳定性等级

| 等级 | 含义 | 约束 |
|------|------|------|
| `stable` | 可长期依赖 | 禁止破坏性修改 |
| `experimental` | 可变 | Agent 不可默认使用 |
| `deprecated` | 将移除 | 必须给出迁移路径 |

每个 Tool 必须声明其 `stability`。

---

## §4. 安全边界（Security Boundary）

### 4.1 凭证规则

- 所有密钥必须经 **vault** 管理
- MCP Server 禁止直接读取 `.env`
- 优先级顺序：
  1. Runtime 注入
  2. Environment Variable
  3. 明确配置（仅限开发）

### 4.2 写操作规则（Hard Rule）

**默认规则**：
- MCP Server 一律视为"只读"

**如需写操作，必须满足 全部条件**：
1. 显式声明 `write` capability
2. 在 Runtime 中白名单启用
3. Tool 名称明确标注写意图（如 `update_`, `create_`）
4. 具备回滚或 dry-run 模式

---

## §5. Domain MCP 约束

- MCP Server 可以属于 Domain
- 但 **Domain 不得依赖 MCP Server 存在**
- Domain 逻辑必须支持：
  - MCP 模式
  - 非 MCP（direct tool）模式

👉 **MCP 是增强层，不是硬依赖。**

---

## §6. 配置分层（Configuration Layers）

MCP 配置必须遵循三层模型：

```
System Layer   → Runtime / registry
Domain Layer   → domain/*/config/mcp_servers.yaml
Session Layer  → CLI flags / runtime args
```

**优先级**：
```
Session > Domain > System
```

---

## §7. stdio → HTTP 演进原则

**v0.x 阶段允许**：
- stdio only
- 单机 Runtime

**强约束**：
- MCP Server 不得假设传输协议
- Tool Schema 必须 protocol-agnostic

**HTTP / Remote 版本**：
- 只能作为 **传输层替换**
- 不得引入语义变化

---

## §8. 监控与可观测性（v0.1 Minimal）

**v0.1 最低要求**：
- MCP Server 启动 / 关闭日志
- Tool 调用计数
- Tool 错误率

**禁止**：
- MCP Server 内部直接接入全局监控系统

---

## §9. 破坏性变更规则（Breaking Change）

任何破坏性修改必须：
1. 提升 MCP Contract 版本
2. 标注 affected servers / tools
3. 提供 fallback 或迁移说明

---

## §10. 最终原则（不可违反）

> **MCP 存在的唯一目的是：让 LiYe OS 更开放，而不是更脆弱。**

---

## §11. Phase 演进入口条件

### Phase 3 (External Services) Entry Conditions

Phase 3 may begin **only when ALL conditions are met**:

1. **SellerSprite data contract satisfied**
   - `fact_keyword_snapshot` table exists
   - Table has required columns per `SellerSprite_DATA_CONTRACT.md`

2. **At least one SellerSprite MCP decisional tool runs end-to-end**
   - `diagnose_listing` or `find_opportunities` executes successfully
   - Returns actual data (not DATA_NOT_READY)

3. **MCP coverage ≥ 70% in Amazon Growth main flow**
   - More than 70% of Agent tools come from MCP
   - Fallback tools usage < 30%

### Phase 4 (Production Hardening) Entry Conditions

Phase 4 may begin **only when ALL conditions are met**:

1. Phase 3 completed
2. HTTP Transport implemented and tested
3. All Phase 2 MCP Servers have health checks
4. Audit logging operational

---

## 附录：合规检查清单

### Server 实现检查

- [ ] Server 由 Registry 启动，非自启动
- [ ] 支持 graceful shutdown
- [ ] 不持有业务状态
- [ ] 凭证通过 vault 获取

### Tool 实现检查

- [ ] 单一职责，业务语义命名
- [ ] 声明 stability 等级
- [ ] 只读优先，写操作显式声明
- [ ] Schema 与传输协议无关

### Domain 集成检查

- [ ] 支持 MCP / 非 MCP 双模式
- [ ] 不直接 import MCP Server
- [ ] 配置遵循三层模型

---

**📌 End of Contract — MCP Runtime v0.1**
