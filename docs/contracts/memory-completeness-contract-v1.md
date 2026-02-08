# Memory Completeness Contract v1

**Status**: FROZEN
**Effective Date**: 2026-02-08
**Enforced By**: MAAP (Memory as a Product) System
**Governance Level**: CONSTITUTIONAL

---

## 1. 概述 (Overview)

本合约定义了所有写入 liye OS 主记忆池（primary memory pool）的对象必须满足的硬约束条件。

任何不满足本合约的对象被视为**"非法记忆对象"**（illegal memory object），禁止落盘。

---

## 2. 合规对象定义 (Compliant Object Definition)

### 2.1 Observation 对象必须包含以下硬字段（缺一不可）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | string | 非空，唯一 | Observation 的唯一标识符，格式：数字 ID（如 `25467`） |
| `content` | string | 非空，长度 ≥ 10 字符 | 观察的核心内容，不允许空串或仅空白符 |
| `session_id` | string | 非空 | 会话标识，可追溯到具体的对话会话 |
| `source_prompt_id` | string \| number | 非空 | 源提示词 ID，指向触发此观察的用户请求或系统消息 |
| `entities` | string[] | 非空数组，minItems=1 | 至少包含 1 个实体标签，用于关联和检索 |
| `timestamp` | string (ISO8601) | 非空，格式有效 | 观察创建时间，格式：`YYYY-MM-DDTHH:mm:ss.sssZ` |
| `integrity_status` | enum | `VERIFIED` \| `REJECTED` | 完整性验证状态 |
| `governance_reason` | string \| null | 当 REJECTED 时必填 | 拒绝原因或治理备注 |

### 2.2 可选扩展字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `legacy_status` | enum | `trusted` \| `legacy_untrusted`（仅用于历史记忆标记） |
| `observation_type` | string | 观察类型分类（如 `discovery`, `decision`, `bugfix` 等） |
| `context_timeline` | object | 上下文时间线（before/current/after），可选 |

---

## 3. 完整性定义 (Definitions of Completeness)

### 3.1 "完整（complete）"

Observation 满足以下条件：
- **所有硬字段都存在**（id, content, session_id, source_prompt_id, entities, timestamp, integrity_status）
- **没有硬字段为 null 或 undefined**
- **entities 数组至少包含 1 个元素**
- **content 长度 ≥ 10 字符**
- **timestamp 符合 ISO8601 格式**

### 3.2 "可追踪（traceable）"

Observation 满足以下条件：
- **session_id 非空**
- **source_prompt_id 非空**
- **两者都能形成"溯源链"**：Observation → Session → Prompt → User Action

### 3.3 "可用于决策（decision-eligible）"

Observation 满足以下条件：
- **integrity_status = "VERIFIED"**
- **legacy_status ≠ "legacy_untrusted"**（或不存在该字段）
- **可追踪（见 3.2）**
- **不在任何 ignore_list 中**

---

## 4. 非法对象定义 (Illegal Objects)

以下对象**绝对禁止**写入主记忆池：

### 4.1 缺失硬字段的对象
```
❌ { content: "...", session_id: "..." }  // 缺 id, source_prompt_id, entities, timestamp
❌ { id: 1, content: "..." }              // 缺 session_id, source_prompt_id, entities, timestamp
❌ { id: 1, ..., entities: [] }           // entities 数组为空
```

### 4.2 非法的 integrity_status
```
❌ integrity_status: "UNKNOWN"   // 必须是 VERIFIED 或 REJECTED
❌ integrity_status: "PENDING"   // 不允许中间态
```

### 4.3 REJECTED 对象缺少 governance_reason
```
❌ { ..., integrity_status: "REJECTED" }  // 缺少 governance_reason
✅ { ..., integrity_status: "REJECTED", governance_reason: "缺 source_prompt_id" }
```

### 4.4 无效的时间戳
```
❌ timestamp: "2026-02-08"           // 不是 ISO8601 完整格式
❌ timestamp: 1707384000             // Unix 时间戳（必须转换为 ISO8601）
❌ timestamp: "2026/02/08 10:00"     // 非 ISO8601 格式
✅ timestamp: "2026-02-08T10:00:00.000Z"
```

---

## 5. 验证规则 (Validation Rules)

### 5.1 写入路径验证（Fail-Fast）

所有写入操作必须通过以下验证：

1. **字段完整性检查**
   ```
   如果任何硬字段缺失 → raise MemoryComplianceError → 不写入
   ```

2. **字段类型检查**
   ```
   如果字段类型不符（如 entities 不是数组） → raise MemoryTypeError → 不写入
   ```

3. **字段值范围检查**
   ```
   如果 content 长度 < 10 → raise MemoryContentError → 不写入
   如果 entities.length == 0 → raise MemoryEntityError → 不写入
   如果 timestamp 无效 ISO8601 → raise MemoryTimeError → 不写入
   ```

4. **integrity_status 一致性检查**
   ```
   如果 integrity_status = "REJECTED" 且缺 governance_reason
      → raise MemoryGovernanceError → 不写入
   ```

### 5.2 拒绝行为（Fail-Closed）

当验证失败时：

1. **立即抛异常**，不继续执行
2. **不写入主存储**（primary memory pool）
3. **写入治理日志**（governance log），包含：
   - `attempted_payload`（可裁剪 content）
   - `failed_validations`（失败的验证项）
   - `governance_reason`（拒绝原因）
   - `timestamp`（拒绝时间）
   - `session_id`（若可用）

---

## 6. 治理日志 (Governance Log)

被拒绝的 Observation 必须记录在治理日志中：

```json
{
  "timestamp": "2026-02-08T12:30:45.000Z",
  "event_type": "COMPLIANCE_REJECTION",
  "session_id": "sess-12345",
  "attempted_id": "25468",
  "failed_validations": [
    "missing_field: source_prompt_id",
    "invalid_type: entities is not an array"
  ],
  "governance_reason": "缺少必要字段：source_prompt_id",
  "content_preview": "观察内容前 100 字符..."
}
```

日志存储位置：
- **文件**: `./.liye/logs/memory-compliance.jsonl`（每行一个 JSON）
- **轮转策略**: 按日期分割（daily）
- **保留期**: 90 天

---

## 7. 历史记忆治理 (Legacy Memory Governance)

### 7.1 标记策略

所有在本合约生效**前**创建的 Observation 自动标记为 `legacy_untrusted`：

```json
{
  "id": 25400,
  "content": "...",
  "legacy_status": "legacy_untrusted",
  "integrity_status": "REJECTED"  // 历史记忆默认为 REJECTED
}
```

### 7.2 决策可用性规则

- **默认检索**：自动过滤 `legacy_untrusted` 的记忆
- **调试/回放**：仅当显式传参 `include_legacy=true` 时才包含
- **决策依据**：**绝不使用** `legacy_untrusted` 的记忆生成决策或结论

---

## 8. 不可变性承诺 (Immutability Pledge)

本合约一旦冻结（FROZEN），**不再修改**：

- ✅ **升级**：可扩展新字段，但不改变现有硬字段的定义
- ❌ **回退**：禁止削弱现有约束
- ❌ **修复历史**：禁止修改已落盘的历史 Observation（只能标记）

任何修改必须：
1. 更新版本号（v2, v3 等）
2. 发布新 Contract 文件
3. 保持 v1 存档（不删除）
4. 在 ADR 中记录升级原因

---

## 9. 检查清单 (Compliance Checklist)

提交任何包含内存操作的 PR 时，必须验证：

- [ ] 所有新 Observation 都有 `id` 且非空
- [ ] 所有新 Observation 都有 `content` 且长度 ≥ 10
- [ ] 所有新 Observation 都有 `session_id` 且非空
- [ ] 所有新 Observation 都有 `source_prompt_id` 且非空
- [ ] 所有新 Observation 都有 `entities` 数组且至少 1 个元素
- [ ] 所有新 Observation 都有有效的 ISO8601 `timestamp`
- [ ] 所有新 Observation 都有 `integrity_status` 为 `VERIFIED` 或 `REJECTED`
- [ ] 所有 `REJECTED` Observation 都有 `governance_reason`
- [ ] 没有绕过验证的写入路径（no bypass calls）
- [ ] 治理日志正确记录了所有拒绝

---

## 10. 参考 (References)

- **ADR**: `docs/adr/ADR-XXX-memory-governance-freeze-v1.md`
- **JSON Schema**: `docs/contracts/memory-completeness-contract-v1.schema.json`
- **实现**: MAAP Fail-Fast Gate（待实施）

---

**Version**: 1.0
**Status**: FROZEN
**Last Updated**: 2026-02-08
**Next Review**: 2026-06-08（6 个月）
