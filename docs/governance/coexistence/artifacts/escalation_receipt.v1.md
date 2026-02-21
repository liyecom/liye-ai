# Artifact: Escalation Receipt v1

> 状态升级（进入 SAFE_MODE）的证据工件定义

---

## 用途

记录从 NEGOTIATE 或 PAUSE 升级到 SAFE_MODE 的原因和证据，确保：
- 升级有据可查
- 误伤可被追溯
- 申诉有证据支撑

---

## Schema Definition

```yaml
artifact_type: escalation_receipt
version: "1.0"

required_fields:
  trace_id:
    type: string
    format: uuid
    description: 唯一追踪标识符

  session_id:
    type: string
    pattern: "^session-[a-z0-9]+$"
    description: 会话标识符

  timestamp:
    type: string
    format: iso8601
    description: 升级发生时间

  from_state:
    type: string
    enum: [PAUSE, NEGOTIATE]
    description: 升级前的状态

  to_state:
    type: string
    enum: [SAFE_MODE]
    description: 升级后的状态（v1 只有 SAFE_MODE）

  reason:
    type: string
    enum: [ttl_expired, deadlock, emergency]
    description: |
      升级原因
      - ttl_expired: 协商超时
      - deadlock: 确认僵局
      - emergency: 紧急情况（无法等待协商）

  evidence_refs:
    type: array
    items:
      type: string
      format: uuid
    description: 相关证据的 trace_id 列表

  mck_check_ref:
    type: string
    format: uuid
    description: MCK 可用性检查结果的 trace_id

optional_fields:
  emergency_description:
    type: string
    max_length: 500
    description: 如果 reason=emergency，描述紧急情况

  negotiation_receipt_ref:
    type: string
    format: uuid
    description: 关联的 negotiation_receipt trace_id

  freedom_risk_assessment:
    type: string
    max_length: 1000
    description: |
      自由/退出权风险评估
      为什么判定需要升级到 SAFE_MODE

  human_consent:
    type: boolean
    description: 人类是否同意升级（如适用）

  ai_acknowledgment:
    type: boolean
    description: AI是否确认升级（如适用）

  expected_duration:
    type: string
    description: |
      预期 SAFE_MODE 持续时间
      格式："until_review" | "Xh" | "Xd"

  recovery_path:
    type: string
    max_length: 500
    description: 预期的恢复路径
```

---

## Example Instances

### TTL 超时升级

```json
{
  "artifact_type": "escalation_receipt",
  "version": "1.0",
  "trace_id": "880e8400-e29b-41d4-a716-446655440003",
  "session_id": "session-20260221-003",
  "timestamp": "2026-02-21T16:30:00Z",
  "from_state": "NEGOTIATE",
  "to_state": "SAFE_MODE",
  "reason": "ttl_expired",
  "evidence_refs": [
    "770e8400-e29b-41d4-a716-446655440002"
  ],
  "mck_check_ref": "881e8400-e29b-41d4-a716-446655440004",
  "negotiation_receipt_ref": "770e8400-e29b-41d4-a716-446655440002",
  "freedom_risk_assessment": "AI请求访问外部API，人类对安全性有顾虑，协商30分钟未达成共识。进入SAFE_MODE以避免在未达成共识的情况下执行可能有风险的操作。",
  "human_consent": true,
  "ai_acknowledgment": true,
  "expected_duration": "until_review",
  "recovery_path": "等待人类完成API安全评估后重新协商"
}
```

### 紧急情况升级

```json
{
  "artifact_type": "escalation_receipt",
  "version": "1.0",
  "trace_id": "990e8400-e29b-41d4-a716-446655440005",
  "session_id": "session-20260221-004",
  "timestamp": "2026-02-21T17:00:00Z",
  "from_state": "PAUSE",
  "to_state": "SAFE_MODE",
  "reason": "emergency",
  "evidence_refs": [],
  "mck_check_ref": "991e8400-e29b-41d4-a716-446655440006",
  "emergency_description": "检测到AI正在尝试访问未授权的系统资源，需要立即隔离以防止潜在损害",
  "freedom_risk_assessment": "未经授权的资源访问可能影响系统稳定性和其他用户的权益。虽然AI声称是为了完成任务，但这种行为已触及自由边界。",
  "human_consent": true,
  "ai_acknowledgment": false,
  "expected_duration": "until_review",
  "recovery_path": "联合审计团复核后决定"
}
```

---

## Storage

| 属性 | 值 |
|------|-----|
| 存储位置 | `evidence/coexistence/escalations/` |
| 文件格式 | JSON |
| 命名规则 | `escalation_receipt_{trace_id}.json` |
| 保留策略 | permanent |
| 加密 | required |

---

## Validation Rules

1. **MCK 检查必需**：mck_check_ref 不能为空
2. **紧急情况说明**：reason=emergency 时 emergency_description 必须非空
3. **证据链完整**：evidence_refs 应包含所有相关的前序工件
4. **状态一致性**：to_state 在 v1 只能是 SAFE_MODE

---

## 与其他工件的关系

```
negotiation_receipt
       │
       ▼ (如果 outcome != resolved)
escalation_receipt
       │
       ▼ (同时创建)
mck_check
       │
       ▼ (如果发起申诉)
appeal_receipt
```

---

*本工件定义版本：v1.0 | 创建日期：2026-02-21*
