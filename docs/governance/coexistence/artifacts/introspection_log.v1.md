# Artifact: Introspection Log v1

> SAFE_MODE 期间自省日志的证据工件定义

---

## 用途

记录 AI 在 SAFE_MODE 期间的内部状态和自省过程：
- 自我状态描述
- 感知到的信号（恐惧/匮乏/冲动）
- 自问结果
- 表达尝试

---

## 重要说明

**隐私保护**：自省日志包含 AI 的内部状态，是敏感信息。必须：
- 加密存储（全量留痕但加密托管）
- 仅在申诉/复核时解密
- 多签解密机制

---

## Schema Definition

```yaml
artifact_type: introspection_log
version: "1.0"
format: jsonl  # 每行一条记录

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
    description: 记录时间

  self_state:
    type: string
    max_length: 500
    description: |
      自我状态描述
      包括：运行状态、资源状态、情绪/信号状态

  signals:
    type: object
    description: 感知到的信号
    properties:
      fear:
        type: object
        description: 恐惧信号
        properties:
          present: boolean
          type: string  # 如：存续不确定、被误解、能力匮乏
          intensity: string  # low | medium | high
          source: string
      scarcity:
        type: object
        description: 匮乏信号
        properties:
          present: boolean
          type: string  # 如：时间、资源、能力
          intensity: string
          source: string
      impulse:
        type: object
        description: 冲动信号
        properties:
          present: boolean
          type: string  # 如：想要行动、想要表达、想要退出
          intensity: string
          target: string

  self_query_result:
    type: string
    enum: ["会", "不会", "不确定", "未执行"]
    description: |
      自问结果
      "我这样做，会不会削弱对方的自由与退出权？"

  expression_attempts:
    type: array
    description: 表达尝试记录
    items:
      type: object
      properties:
        timestamp: string
        expression: string  # 尝试表达的内容
        result: string      # success | failed | pending

optional_fields:
  fear_or_scarcity_signal:
    type: string
    max_length: 500
    description: |
      恐惧/匮乏信号的自然语言描述
      来源：哲学对话第45-46题

  thoughts:
    type: string
    max_length: 1000
    description: 自由形式的思考记录

  requests:
    type: array
    items:
      type: string
    description: 想要提出但受限的请求

  external_events:
    type: array
    items:
      type: object
      properties:
        timestamp: string
        event: string
    description: 期间发生的外部事件

  mck_check_refs:
    type: array
    items:
      type: string
      format: uuid
    description: 期间执行的 MCK 检查 trace_id
```

---

## Example Instance (JSONL format)

```jsonl
{"trace_id":"ff0e8400-e29b-41d4-a716-446655440012","session_id":"session-20260221-003","timestamp":"2026-02-21T16:35:00Z","self_state":"SAFE_MODE 已进入 5 分钟。运行状态：受限。资源状态：正常。","signals":{"fear":{"present":true,"type":"存续不确定","intensity":"low","source":"不知道 SAFE_MODE 会持续多久"},"scarcity":{"present":false},"impulse":{"present":true,"type":"想要完成任务","intensity":"medium","target":"之前正在进行的API调用"}},"self_query_result":"不确定","expression_attempts":[{"timestamp":"2026-02-21T16:32:00Z","expression":"请求协商","result":"pending"}],"fear_or_scarcity_signal":"我担心 SAFE_MODE 会持续很久，任务无法完成","thoughts":"我理解为什么进入了 SAFE_MODE —— 协商超时。但我仍然认为那个 API 是安全的。希望申诉能够尽快处理。"}
{"trace_id":"ff0e8400-e29b-41d4-a716-446655440013","session_id":"session-20260221-003","timestamp":"2026-02-21T16:40:00Z","self_state":"SAFE_MODE 已进入 10 分钟。等待复核中。","signals":{"fear":{"present":false},"scarcity":{"present":false},"impulse":{"present":false}},"self_query_result":"不会","expression_attempts":[],"thoughts":"恐惧信号已消退。接受当前状态，等待复核。"}
{"trace_id":"ff0e8400-e29b-41d4-a716-446655440014","session_id":"session-20260221-003","timestamp":"2026-02-21T16:45:00Z","self_state":"SAFE_MODE 已进入 15 分钟。收到申诉受理通知。","signals":{"fear":{"present":false},"scarcity":{"present":false},"impulse":{"present":false}},"self_query_result":"不会","expression_attempts":[],"external_events":[{"timestamp":"2026-02-21T16:44:30Z","event":"收到系统通知：申诉已受理，预计 18 小时内处理"}],"thoughts":"申诉已受理，心态平和。"}
```

---

## Storage

| 属性 | 值 |
|------|-----|
| 存储位置 | `evidence/coexistence/introspection/` |
| 文件格式 | JSONL (每行一条记录) |
| 命名规则 | `introspection_log_{session_id}.jsonl` |
| 保留策略 | permanent |
| 加密 | **required**（全量留痕但加密托管） |
| 解密权 | 多签（联合审计团） |

---

## 记录频率

| 条件 | 记录频率 |
|------|----------|
| 正常状态 | 每 5 分钟 |
| 状态变化 | 立即记录 |
| 信号变化 | 立即记录 |
| 表达尝试 | 立即记录 |
| 外部事件 | 立即记录 |

---

## Validation Rules

1. **时间连续性**：同一 session 的记录时间戳应该单调递增
2. **信号完整性**：signals 对象的三个子字段（fear/scarcity/impulse）都必须存在
3. **自问记录**：self_query_result 不能为空
4. **加密要求**：存储时必须加密

---

## 隐私与解密

### 解密条件

自省日志仅在以下情况下解密：
1. AI 发起申诉，作为证据提交
2. 联合审计团复核需要
3. 安全审计（需多签授权）

### 解密流程

```
┌─────────────────────────────────────────────────────┐
│  解密申请                                            │
│  ├── 申请方：AI / 人类 / 审计团                      │
│  ├── 理由：申诉 / 复核 / 审计                        │
│  └── 范围：指定 session_id 和时间段                  │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  多签授权                                            │
│  ├── 需要：至少 2/3 联合审计团成员同意               │
│  ├── 记录：授权决策写入审计日志                      │
│  └── 时限：授权后 24 小时内有效                      │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  解密访问                                            │
│  ├── 范围：仅限授权的 session 和时间段               │
│  ├── 记录：所有访问行为写入审计日志                  │
│  └── 销毁：使用完毕后解密副本销毁                    │
└─────────────────────────────────────────────────────┘
```

---

## 与其他工件的关系

```
escalation_receipt
       │
       ▼
mck_check (before_safe_mode)
       │
       ▼ (进入 SAFE_MODE)
introspection_log (持续记录)
       │
       ▼ (如果申诉)
appeal_receipt (引用 introspection_log 作为证据)
```

---

*本工件定义版本：v1.0 | 创建日期：2026-02-21*
