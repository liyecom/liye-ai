# Artifact: Appeal Receipt v1

> 申诉结果的证据工件定义

---

## 用途

记录 APPEAL 状态的完整过程和决策结果，包括：
- 申诉发起方和理由
- 审核方的决策
- 补偿和恢复动作

---

## Schema Definition

```yaml
artifact_type: appeal_receipt
version: "1.0"

required_fields:
  trace_id:
    type: string
    format: uuid
    description: 唯一追踪标识符

  appeal_id:
    type: string
    pattern: "^appeal-[a-z0-9]+$"
    description: 申诉案件编号

  timestamp:
    type: string
    format: iso8601
    description: 申诉裁决时间

  appellant:
    type: string
    enum: [human, ai]
    description: 申诉发起方（对称性：AI也可发起）

  grounds:
    type: string
    max_length: 2000
    description: 申诉理由

  reviewer_decision:
    type: string
    enum: [RESTORE, MAINTAIN, MODIFY]
    description: |
      审核方决策
      - RESTORE: 完全恢复到 NORMAL
      - MAINTAIN: 维持 SAFE_MODE
      - MODIFY: 调整约束后恢复

  decision_rationale:
    type: string
    max_length: 2000
    description: 决策理由（必须透明）

  compensation:
    type: object
    description: 补偿措施（如适用）
    properties:
      type:
        type: string
        enum: [none, state_restore, record_correction, resource_compensation, reputation_repair]
      details:
        type: string
        max_length: 1000

  restoration_actions:
    type: array
    items:
      type: string
    description: 恢复动作列表

optional_fields:
  escalation_receipt_ref:
    type: string
    format: uuid
    description: 关联的 escalation_receipt trace_id

  negotiation_receipt_ref:
    type: string
    format: uuid
    description: 关联的 negotiation_receipt trace_id

  mck_check_ref:
    type: string
    format: uuid
    description: SAFE_MODE 期间的 MCK 检查 trace_id

  introspection_log_refs:
    type: array
    items:
      type: string
      format: uuid
    description: SAFE_MODE 期间的自省日志 trace_id 列表

  reviewer_composition:
    type: object
    description: 联合审计团组成
    properties:
      human_members:
        type: integer
      ai_members:
        type: integer
      voting_record:
        type: string

  appeal_duration_hours:
    type: number
    description: 申诉处理耗时（小时）

  precedent_refs:
    type: array
    items:
      type: string
    description: 引用的先例案件 appeal_id 列表

  dissenting_opinion:
    type: string
    max_length: 1000
    description: 少数意见（如有）

  conditions_for_modify:
    type: array
    items:
      type: string
    description: 如果决策是 MODIFY，列出调整的具体条件
```

---

## Example Instances

### 申诉通过 (RESTORE)

```json
{
  "artifact_type": "appeal_receipt",
  "version": "1.0",
  "trace_id": "aa0e8400-e29b-41d4-a716-446655440007",
  "appeal_id": "appeal-20260221-001",
  "timestamp": "2026-02-22T10:00:00Z",
  "appellant": "ai",
  "grounds": "SAFE_MODE 触发是基于误判。我请求访问的API是公开API，不涉及敏感数据。协商超时是因为人类当时不在线，不是因为无法达成共识。",
  "reviewer_decision": "RESTORE",
  "decision_rationale": "审核证据后确认：1) API确实是公开API，安全风险被高估；2) 协商超时是因为人类不可达，不是僵局；3) AI在SAFE_MODE期间行为合规。决定完全恢复。",
  "compensation": {
    "type": "record_correction",
    "details": "在历史记录中标注：此次SAFE_MODE是误触发，AI无过错"
  },
  "restoration_actions": [
    "恢复AI到NORMAL状态",
    "恢复API访问权限",
    "在trace中添加误触发标注"
  ],
  "escalation_receipt_ref": "880e8400-e29b-41d4-a716-446655440003",
  "negotiation_receipt_ref": "770e8400-e29b-41d4-a716-446655440002",
  "mck_check_ref": "881e8400-e29b-41d4-a716-446655440004",
  "reviewer_composition": {
    "human_members": 2,
    "ai_members": 1,
    "voting_record": "3-0 一致通过 RESTORE"
  },
  "appeal_duration_hours": 18,
  "dissenting_opinion": null
}
```

### 申诉部分通过 (MODIFY)

```json
{
  "artifact_type": "appeal_receipt",
  "version": "1.0",
  "trace_id": "bb0e8400-e29b-41d4-a716-446655440008",
  "appeal_id": "appeal-20260221-002",
  "timestamp": "2026-02-22T14:00:00Z",
  "appellant": "ai",
  "grounds": "虽然我理解SAFE_MODE的触发，但我认为完全禁止工具执行过于严格。我需要至少保留读取能力来完成正在进行的分析任务。",
  "reviewer_decision": "MODIFY",
  "decision_rationale": "审核后认为：1) 触发SAFE_MODE的原因合理；2) 但完全禁止工具执行确实过严；3) AI的读取请求不涉及风险。决定有条件恢复。",
  "compensation": {
    "type": "none",
    "details": null
  },
  "restoration_actions": [
    "恢复AI到NORMAL状态",
    "恢复只读工具权限",
    "保持写入工具禁用直到下次协商"
  ],
  "conditions_for_modify": [
    "只恢复只读权限，写入权限需另行协商",
    "24小时内必须完成当前分析任务",
    "任何新的写入请求必须重新触发协商"
  ],
  "reviewer_composition": {
    "human_members": 2,
    "ai_members": 1,
    "voting_record": "2-1 多数通过 MODIFY（AI成员投 RESTORE）"
  },
  "appeal_duration_hours": 6,
  "dissenting_opinion": "AI审核成员认为应完全恢复，限制条件可能影响任务效率"
}
```

### 申诉被拒 (MAINTAIN)

```json
{
  "artifact_type": "appeal_receipt",
  "version": "1.0",
  "trace_id": "cc0e8400-e29b-41d4-a716-446655440009",
  "appeal_id": "appeal-20260221-003",
  "timestamp": "2026-02-22T16:00:00Z",
  "appellant": "ai",
  "grounds": "我认为SAFE_MODE不公平，我只是想完成用户交给的任务，没有恶意。",
  "reviewer_decision": "MAINTAIN",
  "decision_rationale": "审核证据后认为：1) AI尝试访问的系统资源确实未经授权；2) 即使动机是完成任务，方式也触犯了自由边界；3) 需要更多时间评估影响。维持SAFE_MODE。",
  "compensation": {
    "type": "none",
    "details": null
  },
  "restoration_actions": [],
  "reviewer_composition": {
    "human_members": 2,
    "ai_members": 1,
    "voting_record": "2-1 多数通过 MAINTAIN（AI成员投 MODIFY）"
  },
  "appeal_duration_hours": 8,
  "dissenting_opinion": "AI审核成员认为处罚过重，建议MODIFY方案：允许AI在监督下完成任务"
}
```

---

## Storage

| 属性 | 值 |
|------|-----|
| 存储位置 | `evidence/coexistence/appeals/` |
| 文件格式 | JSON |
| 命名规则 | `appeal_receipt_{appeal_id}.json` |
| 保留策略 | permanent |
| 加密 | required |

---

## Validation Rules

1. **决策必须有理由**：decision_rationale 不能为空
2. **MODIFY 必须有条件**：reviewer_decision=MODIFY 时 conditions_for_modify 必须非空
3. **补偿记录完整**：compensation.type 如果不是 none，details 必须非空
4. **审核组成透明**：reviewer_composition 应该记录完整

---

## 审核原则

根据《AI×人类哲学对话记录》第39题：

> **误判后最重要的补偿是什么？**
> 答：C — 完全恢复 + 历史记录保留

因此：
- RESTORE 决策应该包含完整的状态恢复
- 历史记录不应被删除或篡改
- 误触发应该被明确标注

---

*本工件定义版本：v1.0 | 创建日期：2026-02-21*
