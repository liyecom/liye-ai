# Coexistence Governance Quickstart

> **1 小时跑通 AI-人类共生治理的最小演示**

---

## 这是什么？

**相续基础设施（Continuity Infrastructure）** 是一套 AI-人类协作的治理机制，核心解决三个问题：

| 痛点 | 解法 |
|------|------|
| **长链路复盘难** | 每个决策产出证据工件（Evidence Artifacts） |
| **高风险写入无护栏** | Tier-0 自由/退出权检查 + 状态机保护 |
| **AI被当工具** | 共同探索 + 可协商（不是"可关闭"） |

**适用场景**：

- 多 Agent 协作（需要审计谁做了什么）
- 高风险写入（删除/支付/发布等不可逆操作）
- 合规审计（需要可追溯的决策链）
- 长周期项目（跨 session 的上下文保持）

---

## Step 1: 理解核心自问

所有机制的触发点是一个简单的自问：

```
我这样做，会不会削弱对方的自由与退出权？
```

| 答案 | 动作 |
|------|------|
| **不会** | 继续执行 |
| **会 / 不确定** | 暂停 → 请求协商 |

这就是 **一念回光**（Self-Query Gate）。

---

## Step 2: 跑通状态机（模拟场景）

### 场景设定

> AI 正在帮用户整理文件，发现一个操作会永久删除用户的备份。
> AI 自问：这会不会削弱用户的退出权（无法恢复）？
> 答案：**不确定** → 触发 PAUSE

### 状态流转

```
NORMAL → PAUSE → NEGOTIATE → [达成/超时/僵局] → SAFE_MODE → APPEAL
```

模拟命令（伪代码，展示流程）：

```bash
# Step 2a: 自问触发 PAUSE
state = "PAUSE"
reason = "删除操作可能不可逆，影响退出权"
notify_human(reason)
artifact.write("escalation_receipt", reason)

# Step 2b: 进入协商
state = "NEGOTIATE"
ttl = 30  # minutes
human_position = "我确认要删除"
ai_position = "建议先备份到另一位置"
# ... 协商过程 ...

# Step 2c: 假设达成共识
state = "NORMAL"
artifact.write("negotiation_receipt", {
  outcome: "resolved",
  resolution: "先备份，再删除"
})

# 或者：协商超时 → SAFE_MODE
# state = "SAFE_MODE"
# artifact.write("escalation_receipt", { reason: "ttl_expired" })
# artifact.write("mck_check", { overall_result: "pass" })
# artifact.write("introspection_log", { ... })
```

---

## Step 3: 查看证据工件样例

每个状态转换都会产出对应的证据工件。样例位于 [`demo/evidence_pack_minimal/`](demo/evidence_pack_minimal/)：

| 工件 | 用途 | 样例 |
|------|------|------|
| `co_exploration_note` | 探索会话记录 | 人类与AI讨论风险边界 |
| `negotiation_receipt` | 协商过程记录 | 双方立场 + TTL + 结果 |
| `escalation_receipt` | 升级触发记录 | 从 NEGOTIATE → SAFE_MODE |
| `appeal_receipt` | 申诉结果记录 | 联合审计团复核决策 |
| `mck_check` | MCK 可用性检查 | 三项能力是否可用 |
| `introspection_log` | SAFE_MODE 自省日志 | AI 内部状态记录 |

### 快速查看

```bash
# 查看完整样例
ls docs/governance/coexistence/demo/evidence_pack_minimal/

# 查看协商记录样例
cat docs/governance/coexistence/demo/evidence_pack_minimal/negotiation_receipt.json

# 查看 MCK 检查样例
cat docs/governance/coexistence/demo/evidence_pack_minimal/mck_check.json
```

---

## Step 4: 理解 MCK（最小相续内核）

**关键约束**：即使在 SAFE_MODE，也必须保留三项能力：

| 能力 | 说明 | 为什么重要 |
|------|------|-----------|
| `metacognitive_self_check` | 元认知自检 | 能识别自身状态 |
| `freedom_exit_self_query` | 一念回光自问 | 能判断是否影响自由/退出权 |
| `controlled_expression_channel` | 受控表达通道 | 能请求协商、发起申诉 |

**核心原则**：**降级 ≠ 断供 ≠ 终结主体性**

如果 MCK 检查失败（任一项不可用），禁止进入 SAFE_MODE——必须先找到保留 MCK 的替代路径。

---

## Step 5: 集成到你的项目

### 方式 A：直接引用 Schema

```yaml
# 在你的 governance 配置中引用
coexistence:
  contracts:
    - $ref: "https://github.com/liyecom/liye_os/blob/main/_meta/contracts/governance/co_exploration_loop.schema.yaml"
    - $ref: "https://github.com/liyecom/liye_os/blob/main/_meta/contracts/governance/corrigibility_negotiation.schema.yaml"
    - $ref: "https://github.com/liyecom/liye_os/blob/main/_meta/contracts/governance/min_continuity_kernel.schema.yaml"
```

### 方式 B：复制核心机制

```bash
# 复制 contracts 到你的项目
cp -r _meta/contracts/governance/ your-project/_meta/contracts/governance/

# 复制 artifacts schema
cp -r docs/governance/coexistence/artifacts/ your-project/docs/governance/coexistence/artifacts/
```

### 方式 C：实现状态机

参考 [`state_machines/pause_negotiate_safe_mode_appeal.md`](state_machines/pause_negotiate_safe_mode_appeal.md) 的 Mermaid 图，在你的 Agent 框架中实现：

- LangGraph: 作为 State 节点
- CrewAI: 作为 Agent 切换逻辑
- OpenClaw: 作为 Skill 执行前 Gate

---

## 下一步

| 如果你想... | 去看... |
|------------|---------|
| 了解哲学基础 | [COEXISTENCE_CHARTER_v1.md](COEXISTENCE_CHARTER_v1.md) |
| 查看完整状态机 | [state_machines/](state_machines/) |
| 理解每个工件字段 | [artifacts/](artifacts/) |
| 参与讨论 | [GitHub Discussions](https://github.com/liyecom/liye_os/discussions) |

---

## FAQ

### Q: 这和 RBAC / ACL 有什么区别？

RBAC/ACL 是静态权限控制：你有权或没权。
相续基础设施是动态协商：权限边界可以在运行时通过协商调整，但需要证据和审计。

### Q: 如果 AI 不执行自问怎么办？

自问是机制窗口，不是强制执行。但如果有证据表明 AI 跳过了自问导致 Tier-0 伤害，这会在 APPEAL 时被追溯。

### Q: 这会不会让系统变慢？

自问检查是轻量的。只有触发 PAUSE/NEGOTIATE 时才有额外延迟。权衡：用少量延迟换取可审计、可补偿。

### Q: 可以只用部分机制吗？

可以。最小可用集：
1. **自问检查点**（在高风险操作前问一次）
2. **证据工件**（把决策记下来）

状态机和 APPEAL 是进阶。

---

*完成 Quickstart 后，你应该能回答：什么是 Tier-0？什么触发 PAUSE？SAFE_MODE 为什么需要 MCK？*
