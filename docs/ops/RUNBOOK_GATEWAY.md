# RUNBOOK: Governed Tool Call Gateway

> 5 分钟运维手册 - 给未来的你 / 合作者

---

## 1. 健康检查

```bash
# 公网端点
curl -s https://gateway.liye.ai/health | jq .status
# 预期: "ok"

# 本地端点 (如果在本机)
curl -s http://localhost:3210/health | jq .status
```

**健康 = `"ok"`，不健康 = 连接失败或非 ok 状态**

---

## 2. API Key 验证

```bash
# 无 Key (应返回 401)
curl -s -o /dev/null -w "%{http_code}" https://gateway.liye.ai/v1/governed_tool_call -X POST
# 预期: 401

# 有 Key (应返回 200)
curl -s -o /dev/null -w "%{http_code}" https://gateway.liye.ai/v1/governed_tool_call \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-LIYE-API-KEY: $LIYE_API_KEY" \
  -d '{"task":"test","proposed_actions":[{"action_type":"read","tool":"test"}]}'
# 预期: 200
```

**Key 失效判断**: 401 响应 + `"Unauthorized"` 错误

---

## 3. Tunnel 故障恢复

### 检查 Tunnel 状态

```bash
# 检查进程
pgrep -l cloudflared

# 检查日志
tail -20 /tmp/cloudflared.liye.gateway.log
```

### Tunnel 挂了的第一反应

```bash
# 1. 重启 cloudflared
pkill cloudflared
cloudflared tunnel run liye-governance-gateway > /tmp/cloudflared.liye.gateway.log 2>&1 &

# 2. 等待 10 秒后验证
sleep 10
curl -s https://gateway.liye.ai/health
```

### Tunnel 配置文件

```
~/.cloudflared/config.yml
~/.cloudflared/840d7f6f-a439-4c7c-b40f-85e6f6cd08b3.json (凭证)
```

---

## 4. Gateway 故障恢复

### 检查 Gateway 状态

```bash
# 检查进程
pgrep -f "server.mjs"

# 检查本地端口
curl -s http://localhost:3210/health
```

### Gateway 挂了的第一反应

```bash
# 1. 重启 Gateway
cd ~/github/liye_os
LIYE_API_KEY="your-key" node examples/dify/governed-tool-call-gateway/server.mjs &

# 2. 验证
curl -s http://localhost:3210/health
```

---

## 5. Dify 回滚点

如果 `gateway.liye.ai` 不可用，Dify 可回滚到：

| 方式 | Server URL | 说明 |
|------|------------|------|
| Quick Tunnel | `https://xxx.trycloudflare.com` | 临时，每次重启变化 |
| 本地测试 | `http://localhost:3210` | 仅限本机 |

**回滚步骤**:
1. Dify → Tools → Custom → LiYe Governed Tool Call
2. Configure → 修改 Server URL
3. Save

---

## 6. 关键配置

| 配置项 | 值 |
|--------|-----|
| 公网地址 | `https://gateway.liye.ai` |
| Tunnel ID | `840d7f6f-a439-4c7c-b40f-85e6f6cd08b3` |
| API Key Header | `X-LIYE-API-KEY` |
| 本地端口 | `3210` |
| 稳定 Tag | `integration-dify-gateway-v1.1.0` |

---

## 7. 告警阈值

| 指标 | 正常 | 告警 |
|------|------|------|
| Health 响应时间 | < 500ms | > 2s |
| API 响应时间 | < 1s | > 5s |
| Tunnel 连接数 | 4 | < 2 |

---

## 8. 联系人

- 主要负责人: LiYe
- 代码仓库: `liyecom/liye-ai`
- 相关文档: `docs/integrations/DIFY_*.md`

---

**Version**: 1.0.0
**Last Updated**: 2026-01-31
**Tag**: `integration-dify-gateway-v1.1.0`
