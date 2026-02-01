# Evidence Package Contract v1

> **Status**: DRAFT → Review → FROZEN
> **Last Updated**: 2026-02-01
> **Owner**: LiYe Governance Kernel

---

## 1. Purpose

将"治理决策"变成"可核验事实"。

**一句话目标**：任何一次 ALLOW / BLOCK，都能在 30 秒内生成"最小可核验证据包"，并且 6 个月后仍可复盘。

---

## 2. Scope

### 2.1 What This Contract Covers

- Evidence Package 的最小必要字段
- 字段语义和约束
- 完整性校验规则

### 2.2 What This Contract Does NOT Cover

- 存储实现（文件系统 / Object Store）
- 审计索引结构（见 AUDIT_INDEX_V1）
- Replay 机制（见 DETERMINISTIC_REPLAY_V1）
- 合规映射（SOC2 / ISO 不在范围内）

---

## 3. Evidence Package Schema

```yaml
evidence_package:
  # === Metadata ===
  version: "v1"                    # Contract version, immutable

  # === Identity ===
  trace_id: string                 # Unique trace identifier (existing)
                                   # Format: trace-{timestamp}-{random}

  # === Decision ===
  decision: enum                   # ALLOW | BLOCK | DEGRADE | UNKNOWN
  decision_time: string            # ISO 8601 timestamp (UTC)
                                   # Example: "2026-02-01T12:34:56.789Z"

  # === Policy Reference ===
  policy_ref: string               # Which governance rule was hit
                                   # Format: "{policy_version}:{rule_id}"
                                   # Example: "phase1-v1.0.0:dangerous_action"

  # === Cryptographic Fingerprints ===
  inputs_hash: string              # SHA-256 of canonical input
                                   # Input = task + proposed_actions (sorted, trimmed)
  outputs_hash: string             # SHA-256 of decision result
                                   # Output = decision + verdict_summary

  # === Executor ===
  executor:
    system: string                 # "LiYe Governance Kernel"
    version: string                # Git SHA (short, 7 chars)
                                   # Example: "436cf72"

  # === Integrity ===
  integrity:
    algorithm: "sha256"            # Fixed, no negotiation
    package_hash: string           # SHA-256 of all above fields
                                   # Computed LAST, covers everything else
```

---

## 4. Field Rationale

为什么只保留这些字段？

| Field | Rationale | Why Not More |
|-------|-----------|--------------|
| `trace_id` | 唯一标识，关联现有 trace 系统 | 已存在，复用 |
| `decision` | 核心结果，必须记录 | - |
| `decision_time` | 时间戳用于排序和审计 | 不需要多个时间戳 |
| `policy_ref` | 可追溯命中规则 | 不需要完整规则内容，ref 即可 |
| `inputs_hash` | 输入指纹，防篡改 | 不存原文，隐私+空间考虑 |
| `outputs_hash` | 输出指纹，防篡改 | 同上 |
| `executor.system` | 标识执行系统 | - |
| `executor.version` | Git SHA 可追溯代码版本 | 不需要完整 commit info |
| `integrity.algorithm` | 固定算法，不协商 | SHA-256 足够，无需可选 |
| `integrity.package_hash` | 整包校验，最终防线 | - |

**设计原则**：
- **可核验 > 可读性**：证据是给机器验证的，不是给人看的
- **最小必要**：每个字段都必须回答"删掉它会失去什么"
- **不可变**：生成后不允许修改任何字段

---

## 5. Constraints

### 5.1 Generation Timing

```
决策完成 → 生成证据包 → 不可修改
         ↑
      只此一次
```

- 证据包在 verdict 确定后**立即**生成
- 不允许事后补写或修改
- 生成失败 = 治理失败（Fail Closed）

### 5.2 Hash Computation

**inputs_hash 计算规则**：
```javascript
const canonical_input = JSON.stringify({
  task: request.task.trim(),
  proposed_actions: sortBy(request.proposed_actions, 'tool')
});
const inputs_hash = sha256(canonical_input);
```

**outputs_hash 计算规则**：
```javascript
const canonical_output = JSON.stringify({
  decision: result.decision,
  verdict_summary: result.verdict_summary.trim()
});
const outputs_hash = sha256(canonical_output);
```

**package_hash 计算规则**：
```javascript
const package_content = JSON.stringify({
  version, trace_id, decision, decision_time,
  policy_ref, inputs_hash, outputs_hash, executor
}, null, 0);  // No pretty print
const package_hash = sha256(package_content);
```

### 5.3 Immutability

- 证据包一旦生成，任何字段都不可修改
- 存储层必须支持 append-only 或 write-once
- 检测到篡改 → 触发告警

---

## 6. Validation Rules

```yaml
validation:
  required_fields:
    - version
    - trace_id
    - decision
    - decision_time
    - policy_ref
    - inputs_hash
    - outputs_hash
    - executor.system
    - executor.version
    - integrity.algorithm
    - integrity.package_hash

  format_rules:
    trace_id: "^trace-[a-z0-9]+-[a-z0-9]+$"
    decision: "^(ALLOW|BLOCK|DEGRADE|UNKNOWN)$"
    decision_time: "ISO 8601"
    inputs_hash: "^[a-f0-9]{64}$"
    outputs_hash: "^[a-f0-9]{64}$"
    executor.version: "^[a-f0-9]{7,40}$"
    integrity.algorithm: "^sha256$"
    integrity.package_hash: "^[a-f0-9]{64}$"

  integrity_check:
    - Recompute package_hash from all other fields
    - Compare with stored package_hash
    - Mismatch = INVALID
```

---

## 7. Example

```json
{
  "version": "v1",
  "trace_id": "trace-ml1vmrhy-488k71",
  "decision": "ALLOW",
  "decision_time": "2026-02-01T04:47:23.456Z",
  "policy_ref": "phase1-v1.0.0:safe_read",
  "inputs_hash": "a3f2b8c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
  "outputs_hash": "b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3",
  "executor": {
    "system": "LiYe Governance Kernel",
    "version": "436cf72"
  },
  "integrity": {
    "algorithm": "sha256",
    "package_hash": "c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4"
  }
}
```

---

## 8. Downstream Dependencies

此 Contract 是以下组件的前置依赖：

| Component | Depends On | Status |
|-----------|------------|--------|
| Evidence Artifact Generator | This Contract | Pending |
| Audit Index | This Contract | Pending |
| Deterministic Replay | This Contract + Audit Index | Pending |

**顺序不可跳**：Contract → Artifact → Index → Replay

---

## 9. Freeze Checklist

Phase 2-B-1 Gate（封板条件）：

- [ ] Schema 字段完整且无冗余
- [ ] 每个字段的 Rationale 已记录
- [ ] Hash 计算规则明确
- [ ] Validation Rules 完整
- [ ] Example 可通过 Validation
- [ ] Downstream Dependencies 已声明
- [ ] **Review Completed**
- [ ] **FROZEN**

---

## 10. Version History

| Version | Date | Changes |
|---------|------|---------|
| v1-draft | 2026-02-01 | Initial draft |

---

**Next**: Complete review → Freeze → Phase 2-B-2 (Evidence Artifact Generator)
