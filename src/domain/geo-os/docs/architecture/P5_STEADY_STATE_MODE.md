# P5 Steady-State Mode Definition

> **Status**: CANONICAL
> **Phase**: P5 (Final)
> **Purpose**: 定义平台进入稳态的条件与治理模式
> **Keyword**: Survivability（生存性），而非 Growth
> **Created**: 2025-12-31
> **Effective**: Immediately & Indefinitely

---

## Declaration

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Geo-OS T1 Reasoning Research Platform                    │
│   已完成所有基础建设。                                       │
│                                                             │
│   自本文档生效之日起，平台进入 稳态模式。                     │
│                                                             │
│   默认不再新增 Phase。                                       │
│   未来变更受严格限制。                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase Completion Record

| Phase | 名称 | 状态 | 完成日期 |
|-------|------|------|----------|
| P0 | Listing T1 Filling | ✅ COMPLETE | 2025-12-31 |
| P0.5 | Lift Reproduction & Regression | ✅ COMPLETE | 2025-12-31 |
| P1 | Mechanism Deepening Sprint | ✅ COMPLETE | 2025-12-31 |
| P2 | Deterministic LLM Runner | ✅ COMPLETE | 2025-12-31 |
| P3 | External Exposure Gate | ✅ COMPLETE | 2025-12-31 |
| P4-A | Research Platform Definition | ✅ COMPLETE | 2025-12-31 |
| P5 | Steady-State Mode | ✅ ACTIVE | 2025-12-31 |

**P6 及后续阶段：原则上永久禁止创建。**

---

## Steady-State Definition

### 什么是稳态

```yaml
steady_state:
  definition: |
    平台在"不扩张、不产品化、不走偏"的前提下，
    长期产生价值与权威性的运行模式。

  characteristics:
    - 基础建设已完成
    - 变更速度接近零
    - 护城河深度持续
    - 外部依赖最小化

  anti_patterns:
    - 持续增长
    - 功能扩展
    - 用户增加
    - 产品化转型
```

### 稳态的核心指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 年度变更次数 | ≤ 2 | 仅 PATCH/MINOR |
| 执行能力增量 | = 0 | 禁止增加 |
| 暴露级别 | ≤ E1 | 永久锁定 |
| 可抄袭性 | 持续降低 | 通过消毒 |

---

## Allowed Changes (唯一允许的三类变更)

### 1. 机制版本演进

```yaml
mechanism_evolution:
  allowed:
    PATCH:
      description: "修正表述错误、typo、格式"
      frequency: "随时"
      approval: "自动"

    MINOR:
      description: "澄清边界、补充假设、细化适用条件"
      frequency: "≤ 每 6 个月"
      approval: "需审查"

  forbidden:
    MAJOR:
      description: "重新定义机制、改变因果结构"
      status: "原则上禁止"
      exception: "全体维护者一致同意"
```

### 2. 方法论澄清

```yaml
methodology_clarification:
  allowed:
    - 解释"为什么这样设计"
    - 说明"为什么不能直接用"
    - 补充"常见误解是什么"

  forbidden:
    - 增加新的方法论步骤
    - 降低理解门槛
    - 提供可操作指南
```

### 3. 防御性修订

```yaml
defensive_revision:
  triggers:
    - 发现外界误读
    - 发现潜在滥用
    - 发现引用违规

  actions:
    - 补充 MISUSE_CASES.md
    - 强化 Usage Restrictions
    - 更新 CITATION_POLICY.md

  forbidden:
    - 以"澄清"为名增加内容
    - 以"防御"为名暴露实现
```

---

## Prohibited Actions (永久禁止)

```
┌─────────────────────────────────────────────────────────────┐
│                   P5 永久禁止清单                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ❌ 以"优化"为名增加可执行性                                 │
│     └── 不可添加 API、CLI、执行脚本                          │
│                                                             │
│  ❌ 以"帮助理解"为名给出参数                                 │
│     └── 不可提供阈值、权重、具体配置                         │
│                                                             │
│  ❌ 以"学术交流"为名泄露实现                                 │
│     └── 不可分享内部代码、Case 结果                          │
│                                                             │
│  ❌ 以"生态建设"为名引入插件/API                             │
│     └── 不可创建扩展点、集成接口                             │
│                                                             │
│  ❌ 以"用户需求"为名降低使用门槛                             │
│     └── 不可简化、不可"开箱即用"                             │
│                                                             │
│  ❌ 以"社区贡献"为名接受外部代码                             │
│     └── 不可 Open Source、不可 PR                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Survivability Criteria

### 半年无人维护测试

平台必须能够：

```yaml
survivability_test:
  duration: "6 个月"
  condition: "无任何人工干预"

  must_remain:
    - 文档完整可读
    - 引用政策有效
    - 误用案例覆盖
    - 版本号不变

  must_not:
    - 出现歧义
    - 被错误引用
    - 被产品化利用
    - 失去权威性
```

### 护城河深度检验

```yaml
moat_depth_check:
  question: "外界能否通过公开内容复现系统？"
  answer: "不能"

  verification:
    - 所有阈值已消毒
    - 所有参数已移除
    - 所有 Case 结果已隐藏
    - 仅保留方法论框架

  if_reproducible:
    action: "立即执行防御性修订"
    priority: "P0"
```

---

## Governance in Steady-State

### 决策权限

```yaml
decision_authority:
  PATCH_release:
    authority: "单一维护者"
    approval: "自动"

  MINOR_release:
    authority: "全体维护者"
    approval: "多数同意"

  MAJOR_release:
    authority: "全体维护者"
    approval: "一致同意"

  phase_creation:
    authority: "N/A"
    status: "原则上禁止"
```

### 例外申请流程

```yaml
exception_process:
  steps:
    1. 提交书面理由
    2. 全体维护者审查
    3. 等待 30 天冷静期
    4. 再次确认必要性
    5. 记录至 CHANGE_LOG

  criteria:
    - 必须证明"不做会导致平台失真"
    - 必须证明"做了不会增加可抄袭性"
    - 必须证明"无替代方案"
```

---

## Periodic Reporting (唯一允许的主动汇报)

### 报告周期

```yaml
reporting_cadence:
  frequency: "季度或半年"
  mandatory: false
  content:
    - 是否出现新的误用趋势
    - 是否需要防御性修订
    - 是否有外界试图推动产品化

  format: |
    ## 稳态周期报告 (YYYY-Q#)

    ### 误用监控
    - 新发现误用: [无 / 有，描述]
    - 防御性修订: [无需 / 已执行，描述]

    ### 产品化压力
    - 外界请求: [无 / 有，已拒绝]

    ### 平台状态
    - Exposure Level: E1 (unchanged)
    - Version: vX.Y.Z
    - Last Change: YYYY-MM-DD
```

---

## Related Documents

| 文档 | 职责 |
|------|------|
| CHANGE_DILUTION_POLICY.md | 变更稀释机制 |
| RELEASE_CADENCE.md | 发布节律锁 |
| INTERACTION_BOUNDARY.md | 外部互动边界 |
| MISUSE_CASES.md | 误用案例库 |

---

## Version History

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2025-12-31 | Initial steady-state definition |

---

**Version**: 1.0.0
**Status**: ACTIVE (Steady-State)
**Next Review**: 2026-06-30 (半年后)
