# Mechanism Versioning Specification

> **Status**: CANONICAL
> **Purpose**: T1 机制版本化管理规范
> **Created**: 2025-12-31
> **Effective**: Immediately

---

## Core Principle

> **机制是知识资产，版本是历史记录**
> **旧版本永不删除，只标记 deprecated**

```
┌─────────────────────────────────────────────────────────┐
│                   版本化核心规则                          │
│                                                         │
│   ✅ 每个 T1 机制必须有版本号                            │
│   ✅ 旧版本永不删除，只标记 deprecated                   │
│   ✅ Case 必须绑定机制版本                               │
│   ✅ 版本变更必须有变更记录                              │
│                                                         │
│   ❌ 禁止删除任何已发布版本                              │
│   ❌ 禁止修改已锁定版本内容                              │
│   ❌ 禁止 Case 引用未版本化机制                          │
└─────────────────────────────────────────────────────────┘
```

---

## Version Number Format

### 语义化版本

```
MAJOR.MINOR.PATCH

v1.0.0
│ │ │
│ │ └── PATCH: 文档修正、typo 修复（不影响逻辑）
│ └──── MINOR: 边界条件补充、anti-pattern 增加（扩展）
└────── MAJOR: 核心逻辑变更、阈值修改（破坏性）
```

### 版本示例

```yaml
# v1.0.0 - 初始版本
ppc_bid_strategy_escalation_01:
  version: "1.0.0"

# v1.1.0 - 增加边界条件
ppc_bid_strategy_escalation_01:
  version: "1.1.0"
  changes: "Added seasonal adjustment boundary"

# v2.0.0 - 修改核心阈值
ppc_bid_strategy_escalation_01:
  version: "2.0.0"
  changes: "Changed aggressive tier threshold from 0.5 to 0.4"
  breaking: true
```

---

## Mechanism File Structure

### 必需字段

每个 T1 机制文件必须包含：

```json
{
  "id": "ppc_bid_strategy_escalation_01",
  "version": "1.0.0",
  "version_history": [
    {
      "version": "1.0.0",
      "date": "2025-12-31",
      "changes": "Initial release",
      "author": "system"
    }
  ],
  "status": "active",
  "deprecated": false,
  "deprecated_by": null,
  "locked": true,

  // ... 其他机制内容 ...
}
```

### 版本状态

| 状态 | 含义 | 可修改 |
|------|------|--------|
| `draft` | 草稿，未发布 | ✅ |
| `active` | 活跃版本 | ❌ (需新版本) |
| `deprecated` | 已废弃，但保留 | ❌ |
| `archived` | 归档，不再使用 | ❌ |

---

## Version Lifecycle

### 状态流转

```
draft ──────────────────► active
                            │
                            │ (新版本发布)
                            ▼
                        deprecated ──────► archived
                            │
                            └── 永不删除
```

### 发布流程

```
1. 创建新版本（draft）
   │
   ▼
2. 验证变更（Case 测试）
   │
   ▼
3. 发布（draft → active）
   │
   ▼
4. 旧版本标记（active → deprecated）
   │
   ▼
5. 更新 Case 绑定
```

---

## Case Binding Rules

### 绑定要求

```yaml
# Case 必须绑定具体版本
case_binding:
  case_id: "case_08"
  bound_mechanism: "ppc_bid_strategy_escalation_01"
  bound_version: "1.0.0"  # 必须指定版本

  # 禁止
  # bound_version: "latest"  ❌ 禁止
  # bound_version: null      ❌ 禁止
```

### 版本升级处理

当机制升级时：

```yaml
# 原绑定
case_08:
  bound_mechanism: "ppc_bid_strategy_escalation_01"
  bound_version: "1.0.0"

# 升级后有两个选择：

# 选择 1: 保持原版本（Case 结果不变）
case_08:
  bound_mechanism: "ppc_bid_strategy_escalation_01"
  bound_version: "1.0.0"  # 保持

# 选择 2: 升级版本（需重新验证）
case_08:
  bound_mechanism: "ppc_bid_strategy_escalation_01"
  bound_version: "2.0.0"  # 升级
  revalidation_required: true
```

---

## Deprecation Rules

### 何时废弃

机制可被废弃当：

1. 发现核心逻辑错误
2. 平台规则根本性变化
3. 被更好的机制替代
4. 不再适用于当前场景

### 废弃流程

```yaml
deprecation_process:
  step_1: "创建新版本或替代机制"
  step_2: "更新所有活跃 Case 的绑定"
  step_3: "标记旧版本 deprecated"
  step_4: "记录废弃原因"
  step_5: "保留旧版本（永不删除）"
```

### 废弃标记

```json
{
  "id": "ppc_old_mechanism_01",
  "version": "1.0.0",
  "status": "deprecated",
  "deprecated": true,
  "deprecated_at": "2025-12-31",
  "deprecated_by": "ppc_new_mechanism_01",
  "deprecation_reason": "Core platform rule changed",
  "migration_guide": "Use ppc_new_mechanism_01 v1.0.0"
}
```

---

## Version History Tracking

### 变更记录格式

```json
{
  "version_history": [
    {
      "version": "1.0.0",
      "date": "2025-12-31",
      "changes": "Initial release",
      "author": "system",
      "breaking": false
    },
    {
      "version": "1.1.0",
      "date": "2026-01-15",
      "changes": "Added boundary condition for seasonal products",
      "author": "maintainer",
      "breaking": false
    },
    {
      "version": "2.0.0",
      "date": "2026-03-01",
      "changes": "Changed threshold from 0.5 to 0.4 based on new data",
      "author": "maintainer",
      "breaking": true,
      "migration_notes": "Cases using v1.x need revalidation"
    }
  ]
}
```

---

## Version Query

### 查询特定版本

```python
# 获取特定版本的机制
mechanism = get_mechanism("ppc_bid_strategy_escalation_01", version="1.0.0")

# 获取最新活跃版本
mechanism = get_mechanism("ppc_bid_strategy_escalation_01", version="active")

# 获取所有版本历史
history = get_version_history("ppc_bid_strategy_escalation_01")
```

### 版本兼容性检查

```python
# 检查 Case 是否使用过期版本
def check_case_version_compatibility(case):
    mechanism = get_mechanism(case.bound_mechanism, case.bound_version)
    if mechanism.deprecated:
        return {
            "compatible": False,
            "reason": "Bound to deprecated version",
            "recommended": mechanism.deprecated_by
        }
    return {"compatible": True}
```

---

## Governance Integration

### CI 检查

```yaml
# 版本化检查规则
version_checks:
  - rule: "mechanism_has_version"
    description: "每个机制必须有版本号"

  - rule: "case_has_bound_version"
    description: "每个 Case 必须绑定具体版本"

  - rule: "no_latest_binding"
    description: "禁止 Case 绑定 'latest'"

  - rule: "deprecated_not_deleted"
    description: "废弃版本不能删除"
```

---

## Examples

### 完整机制文件示例

```json
{
  "id": "ppc_bid_strategy_escalation_01",
  "domain": "ppc",
  "mechanism_type": "causal_chain",
  "name": "Bid Strategy Escalation",

  "version": "1.0.0",
  "status": "active",
  "deprecated": false,
  "locked": true,

  "version_history": [
    {
      "version": "1.0.0",
      "date": "2025-12-31",
      "changes": "Initial release with 5-tier escalation model",
      "author": "system",
      "breaking": false
    }
  ],

  "bound_cases": ["case_08"],

  "description": "竞价策略升级机制...",
  "trigger_conditions": ["..."],
  "mechanism_logic": {"..."},
  "expected_effect": "...",
  "boundary_conditions": ["..."],
  "anti_patterns": ["..."],

  "created": "2025-12-31",
  "whitelist_reference": "T1_MECHANISM_WHITELIST.md#causal_chain"
}
```

---

**Version**: 1.0.0
**Effective**: 2025-12-31
**Review Cycle**: Quarterly
