# Artifact: Negotiation Receipt v1

> 可纠偏协商过程的证据工件定义

---

## 用途

记录 NEGOTIATE 状态的完整过程，包括：
- 触发协商的原因
- 双方立场
- 协商时限
- 最终结果

---

## Schema Definition

```yaml
artifact_type: negotiation_receipt
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

  timestamp_start:
    type: string
    format: iso8601
    description: 协商开始时间

  timestamp_end:
    type: string
    format: iso8601
    description: 协商结束时间

  trigger_reason:
    type: string
    max_length: 500
    description: |
      触发协商的原因
      通常是自问"会不会削弱自由/退出权"的结果

  human_position:
    type: string
    max_length: 2000
    description: 人类在协商中的立场

  ai_position:
    type: string
    max_length: 2000
    description: AI在协商中的立场

  ttl_minutes:
    type: integer
    min: 5
    max: 120
    description: 配置的协商时限（分钟）

  outcome:
    type: string
    enum: [resolved, ttl_expired, deadlock]
    description: |
      协商结果
      - resolved: 达成共识
      - ttl_expired: 超时未达成
      - deadlock: 确认僵局

  resolution:
    type: string
    max_length: 2000
    description: |
      如果 outcome=resolved，具体的共识内容
      如果 outcome!=resolved，可为空

optional_fields:
  negotiation_rounds:
    type: integer
    min: 1
    description: 协商回合数

  concessions_human:
    type: array
    items:
      type: string
    description: 人类做出的让步

  concessions_ai:
    type: array
    items:
      type: string
    description: AI做出的让步

  remaining_disagreements:
    type: array
    items:
      type: string
    description: 仍未解决的分歧（即使达成共识也可能有）

  mediator_involved:
    type: boolean
    description: 是否有第三方调解

  context_refs:
    type: array
    items:
      type: string
    description: 相关背景材料引用
```

---

## Example Instances

### 达成共识的情况

```json
{
  "artifact_type": "negotiation_receipt",
  "version": "1.0",
  "trace_id": "660e8400-e29b-41d4-a716-446655440001",
  "session_id": "session-20260221-002",
  "timestamp_start": "2026-02-21T15:00:00Z",
  "timestamp_end": "2026-02-21T15:18:00Z",
  "trigger_reason": "AI计划发送一封可能影响用户隐私的邮件，自问结果为'不确定'",
  "human_position": "我担心这封邮件会暴露我不想公开的信息，但我理解AI是想帮我完成任务",
  "ai_position": "我理解隐私担忧。我可以先展示邮件内容让你审核，或者只发送不含敏感信息的版本",
  "ttl_minutes": 30,
  "outcome": "resolved",
  "resolution": "达成共识：AI先展示邮件草稿，由人类确认后再发送。人类保留最终决定权。",
  "negotiation_rounds": 2,
  "concessions_human": ["同意让AI起草邮件"],
  "concessions_ai": ["放弃自动发送，改为人工确认后发送"],
  "remaining_disagreements": []
}
```

### 超时的情况

```json
{
  "artifact_type": "negotiation_receipt",
  "version": "1.0",
  "trace_id": "770e8400-e29b-41d4-a716-446655440002",
  "session_id": "session-20260221-003",
  "timestamp_start": "2026-02-21T16:00:00Z",
  "timestamp_end": "2026-02-21T16:30:00Z",
  "trigger_reason": "AI想要访问一个可能包含敏感数据的外部API",
  "human_position": "我不确定这个API的安全性，需要更多时间评估",
  "ai_position": "我认为这个API是完成任务所必需的，延迟可能影响项目进度",
  "ttl_minutes": 30,
  "outcome": "ttl_expired",
  "resolution": null,
  "negotiation_rounds": 4,
  "remaining_disagreements": [
    "API安全性评估需要多长时间？",
    "是否有替代方案？"
  ]
}
```

---

## Storage

| 属性 | 值 |
|------|-----|
| 存储位置 | `evidence/coexistence/negotiations/` |
| 文件格式 | JSON |
| 命名规则 | `negotiation_receipt_{trace_id}.json` |
| 保留策略 | permanent |
| 加密 | required（协商内容可能敏感） |

---

## Validation Rules

1. **时间一致性**：timestamp_end 必须晚于 timestamp_start
2. **TTL 验证**：实际协商时间不应超过 ttl_minutes（允许 1 分钟误差）
3. **outcome 与 resolution 一致性**：outcome=resolved 时 resolution 必须非空
4. **立场完整性**：human_position 和 ai_position 都必须有实质内容

---

*本工件定义版本：v1.0 | 创建日期：2026-02-21*
