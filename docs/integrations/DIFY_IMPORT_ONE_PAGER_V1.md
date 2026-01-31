# Dify Import One-Pager v1

> 5 分钟内将 LiYe Governed Tool Call Gateway 导入 Dify Cloud

## Prerequisites

- [x] Node.js 20+
- [x] Gateway 代码已拉取 (`~/github/liye_os`)
- [x] Dify Cloud 账号

---

## 生产部署信息

**永久公网地址**: `https://gateway.liye.ai`

此地址通过 Cloudflare Named Tunnel 提供，始终可用。API Key 认证已启用。

---

## Step 1: 启动 Gateway (1 min)

```bash
cd ~/github/liye_os

# 设置 API Key (生产环境必须)
export LIYE_API_KEY="your-api-key-here"

# 启动 Gateway
node examples/dify/governed-tool-call-gateway/server.mjs

# 看到以下输出表示成功:
# ╔═══════════════════════════════════════════════════════════════╗
# ║  Governed Tool Call Gateway for Dify                          ║
# ╠═══════════════════════════════════════════════════════════════╣
# ║  Endpoint: http://localhost:3210/v1/governed_tool_call        ║
# ╚═══════════════════════════════════════════════════════════════╝
```

## Step 2: 创建公网隧道

### 方式 A: 使用已配置的 Named Tunnel (推荐)

```bash
# Named Tunnel 已配置，直接启动
cloudflared tunnel run

# 永久地址: https://gateway.liye.ai
```

### 方式 B: 临时 Quick Tunnel (开发测试)

```bash
# 使用 cloudflared (推荐)
cloudflared tunnel --url http://localhost:3210

# 或使用 ngrok
ngrok http 3210
```

记下隧道 URL，例如：`https://xxx.trycloudflare.com`

## Step 3: 验证就绪状态

```bash
# 一键验证
./.claude/scripts/check_gateway_ready.sh
```

预期输出：
```
✓ Local Health: OK
✓ Tunnel URL: https://xxx.trycloudflare.com
✓ Tunnel Health: OK
```

## Step 4: 复制 OpenAPI Spec (30 sec)

```bash
# 一键复制到剪贴板
./.claude/scripts/print_openapi.sh --copy
```

## Step 5: 导入 Dify (2 min)

1. 登录 [Dify Cloud](https://cloud.dify.ai)
2. 进入 **Tools** → **Custom**
3. 点击 **Create Custom Tool**
4. 选择 **Import from OpenAPI/Swagger**
5. **粘贴** 剪贴板内容
6. 设置 **Server URL**: `https://gateway.liye.ai` (生产) 或你的隧道 URL
7. 配置 **Authorization method**:
   - Type: Header
   - Auth Type: Custom
   - Key: `X-LIYE-API-KEY`
   - Value: 你的 API Key
8. 点击 **Save**

## Step 6: 测试 Tool

在 Dify 中测试 `governedToolCall`：

**测试输入：**
```json
{
  "task": "Search for ACOS optimization",
  "proposed_actions": [{
    "action_type": "read",
    "tool": "semantic_search",
    "arguments": {"query": "ACOS"}
  }]
}
```

**预期输出：**
```json
{
  "ok": true,
  "decision": "ALLOW",
  "trace_id": "trace-xxx"
}
```

---

## Quick Commands

| 任务 | 命令 |
|------|------|
| 启动 Gateway | `node examples/dify/governed-tool-call-gateway/server.mjs` |
| 复制 OpenAPI | `./.claude/scripts/print_openapi.sh --copy` |
| 验证就绪 | `./.claude/scripts/check_gateway_ready.sh` |
| 创建隧道 | `cloudflared tunnel --url http://localhost:3210` |

---

## Troubleshooting

### "Connection refused"

Gateway 未运行，重新启动：
```bash
node examples/dify/governed-tool-call-gateway/server.mjs
```

### "Tool import failed"

1. 确保 Server URL 正确（包含 `https://`）
2. 确保隧道仍在运行
3. 尝试刷新页面重新导入

### 隧道 URL 变化

cloudflared 免费版每次重启会生成新 URL，需要在 Dify 中更新 Server URL。

---

## 截图/录屏指引

如需录制导入过程：

1. **录屏工具**: macOS 用 `Cmd+Shift+5`，或使用 Loom/OBS
2. **关键截图点**:
   - Gateway 启动成功输出
   - Dify Custom Tool 创建页面
   - OpenAPI 粘贴后的预览
   - 测试成功的响应

---

## 配置块

```yaml
# 生产环境 (Named Tunnel)
tunnel_type: cloudflared_named
tunnel_id: 840d7f6f-a439-4c7c-b40f-85e6f6cd08b3
public_url: https://gateway.liye.ai
api_key_required: true
production_ready: true

# 开发环境 (Quick Tunnel)
# tunnel_type: cloudflared_quick
# tunnel_expiry: session-based  # 关闭终端后失效
```

**启动命令**:
```bash
# 生产环境 (后台运行)
LIYE_API_KEY="your-key" node examples/dify/governed-tool-call-gateway/server.mjs &
cloudflared tunnel run &

# 开发环境 (前台运行)
node examples/dify/governed-tool-call-gateway/server.mjs
cloudflared tunnel --url http://localhost:3210
```

---

**Version**: 1.1.0
**Last Updated**: 2026-01-31
**Related**: [DIFY_GOVERNED_DEMO_V1.md](./DIFY_GOVERNED_DEMO_V1.md)
