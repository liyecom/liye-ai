# P3: External Exposure & Productization Gate

> **Status**: CANONICAL
> **Phase**: P3 (Governance, not Productization)
> **Created**: 2025-12-31
> **Current Level**: E0 (Internal Only)

---

## Core Principle

> **P3 ≠ 产品化**
> **P3 = Exposure Readiness & Governance**

```
┌─────────────────────────────────────────────────────────┐
│                   P3 的本质问题                          │
│                                                         │
│   谁能接触？                                             │
│   以什么方式接触？                                       │
│   在什么边界内接触？                                     │
│                                                         │
│   ❌ 不是"如何变成产品"                                  │
│   ❌ 不是"如何推广"                                      │
│   ❌ 不是"如何收费"                                      │
└─────────────────────────────────────────────────────────┘
```

---

## External Exposure Levels

系统对外暴露分为 4 个等级：

| Level | 名称 | 使用者 | 当前状态 |
|-------|------|--------|----------|
| E0 | Internal Only | 核心维护者 | ✅ 当前 |
| E1 | Controlled Demo | 受邀观察者 | 🔒 未开放 |
| E2 | Partner / Research | 合作方 / 研究用途 | 🔒 未开放 |
| E3 | Public API / SaaS | 公众 | ❌ 禁止直接进入 |

### E0 → E1 → E2 → E3 是必经路径

```
E0 (当前)
  │
  ▼ [需满足 E1 条件]
E1 Controlled Demo
  │
  ▼ [需满足 E2 条件 + E1 无事故周期]
E2 Partner Access
  │
  ▼ [需满足 Productization Gate + 独立审批]
E3 Public (禁止跳跃)
```

---

## P3 Scope

### P3 允许

- 定义 Exposure Levels
- 建立 Usage Boundary
- 设计只读接口规范
- 设立 Productization Gate
- 准备 E1 Demo 条件

### P3 禁止

| 禁止事项 | 理由 |
|----------|------|
| ❌ Public API | 越权暴露 |
| ❌ 自动执行 | 风险不可控 |
| ❌ 收费 / 定价讨论 | 超出治理范围 |
| ❌ 营销包装 | 误导风险 |
| ❌ Case Storytelling | 过度承诺 |
| ❌ 直接进入 E3 | 必须经历 E1/E2 |

---

## Governance Documents

P3 强制产出以下治理文档：

```
docs/governance/
├── EXTERNAL_EXPOSURE_LEVELS.md  # Exposure 等级定义
├── USAGE_BOUNDARY.md            # 使用边界（法律化表达）
├── PRODUCTIZATION_GATE.md       # 产品化门禁
└── EXPOSURE_AUDIT_LOG.md        # 暴露审计日志

docs/interface/
└── READ_ONLY_INTERFACE.md       # 只读接口设计
```

---

## Current State

```
Exposure Level: E0 (Internal Only)
External Users: 0
Demo Requests: 0
Boundary Violations: 0

P3 Status: GATE CLOSED
Next Level: E1 (pending governance completion)
```

---

## E1 Entry Criteria

进入 E1 (Controlled Demo) 需满足：

| 条件 | 状态 |
|------|------|
| Usage Boundary 文档完成 | ✅ |
| 只读接口设计完成 | ✅ |
| Demo 固定为特定 Case | ⏳ |
| Demo 不可修改参数 | ⏳ |
| 观察者签署 Boundary | ⏳ |

---

## Risk Prevention

### 系统被误用的常见模式

1. **效果承诺**：声称系统能保证某效果
2. **自动化误解**：认为系统可以自动执行决策
3. **过度泛化**：将特定 Case 结果推广到所有场景
4. **商业滥用**：未经授权用于商业用途

### P3 的防御措施

- Usage Boundary 明确免责
- 只读接口禁止执行
- Exposure Guard CI 拦截产品化语义
- Productization Gate 设立硬性门禁

---

## Definition of Done (P3)

P3 is complete when:

| Criterion | Status |
|-----------|--------|
| ✅ External Exposure Levels 明确 | ⏳ |
| ✅ Usage Boundary 明文化 | ⏳ |
| ✅ 只读接口设计完成 | ⏳ |
| ✅ Productization Gate 已设立 | ⏳ |
| ✅ 系统仍停留在 E0 / E1 | ✅ |

---

## Reporting Requirements

P3 完成后，仅允许汇报 3 件事：

1. 当前 Exposure Level（E0 / E1 / E2）
2. 是否有人请求越权（以及如何被拒绝）
3. 是否出现"效果承诺"风险

---

**Version**: 1.0.0
**Phase**: P3 (Governance)
**Next Phase**: E1 Entry (requires E1 criteria completion)
