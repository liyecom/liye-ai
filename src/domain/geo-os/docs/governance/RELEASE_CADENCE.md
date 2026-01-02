# Release Cadence (节律锁)

> **Status**: CANONICAL
> **Purpose**: 强制平台变更进入慢速节律
> **Created**: 2025-12-31
> **Effective**: Immediately & Permanently

---

## Cadence Lock Declaration

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   本文档定义的发布节律是 硬性约束，不可调整。                  │
│                                                             │
│   节律的目的不是"合理安排工作"，                              │
│   而是 强制减速，防止过度活跃导致护城河稀释。                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Version Type Definitions

### Semantic Versioning (语义版本)

```
版本格式: MAJOR.MINOR.PATCH

MAJOR: 重大变更（禁止）
MINOR: 功能性变更（严格限制）
PATCH: 修正性变更（允许）
```

---

## Cadence Rules (节律规则)

### PATCH 发布

```yaml
patch_release:
  definition: "修正表述错误、typo、格式问题"

  frequency: "随时"
  cooldown: "无"
  approval: "单一维护者"

  allowed_changes:
    - 修正拼写错误
    - 修正语法错误
    - 修正格式问题
    - 修正失效链接
    - 更新日期戳

  forbidden_changes:
    - 任何内容增加
    - 任何逻辑修改
    - 任何结构调整

  example:
    before: "mechanims"
    after: "mechanisms"
    verdict: "✅ PATCH 允许"
```

### MINOR 发布

```yaml
minor_release:
  definition: "澄清边界、补充假设、细化适用条件"

  frequency: "≤ 每 6 个月一次"
  cooldown: "强制等待 30 天"
  approval: "全体维护者多数同意"

  allowed_changes:
    - 澄清方法论边界
    - 补充适用条件
    - 添加误用警告
    - 强化消毒层
    - 更新 MISUSE_CASES

  forbidden_changes:
    - 添加新机制
    - 添加新方法论
    - 降低理解门槛
    - 增加执行能力

  process:
    1. 提交变更提案
    2. 通过 CHANGE_DILUTION_POLICY 三项检查
    3. 等待 30 天冷静期
    4. 全体维护者投票
    5. 多数同意后发布

  example:
    change: "补充'此机制不适用于新品期'的说明"
    verdict: "✅ MINOR 允许（经审批）"
```

### MAJOR 发布

```yaml
major_release:
  definition: "重新定义机制、改变因果结构、架构重构"

  frequency: "原则上禁止"
  cooldown: "强制等待 90 天"
  approval: "全体维护者一致同意"

  status: |
    MAJOR 发布在稳态模式下原则上永久禁止。

    如确有必要，必须满足全部条件：
    1. 证明"不做会导致平台失真"
    2. 证明"做了不会增加可抄袭性"
    3. 证明"无任何替代方案"
    4. 全体维护者一致同意
    5. 等待 90 天冷静期后再次确认

  historical_note: |
    自 P5 稳态模式生效以来，
    尚未发生过 MAJOR 发布。
    这是正常的。
```

---

## Cooldown Enforcement (冷静期强制执行)

### 冷静期规则

```yaml
cooldown_rules:
  patch:
    cooldown: "0 天"
    reason: "修正性变更无需等待"

  minor:
    cooldown: "30 天"
    reason: "确保决策不是冲动"
    enforcement: |
      从提案提交日算起，
      30 天内禁止执行发布。
      冷静期内可随时撤回提案。

  major:
    cooldown: "90 天"
    reason: "重大变更需要充分考虑"
    enforcement: |
      从一致同意日算起，
      90 天后再次确认是否仍需执行。
      任何维护者可在此期间否决。
```

### 冷静期不可缩短

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   冷静期是硬性约束，不可因任何理由缩短。                       │
│                                                             │
│   ❌ "紧急修复" 不是缩短理由                                  │
│   ❌ "社区压力" 不是缩短理由                                  │
│   ❌ "业务需求" 不是缩短理由                                  │
│   ❌ "已经准备好了" 不是缩短理由                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Release Calendar

### 年度发布上限

```yaml
annual_limits:
  patch: "无限制"
  minor: "≤ 2 次"
  major: "≤ 0 次（原则上）"

  total_changes_per_year: |
    理想状态：0-2 次 PATCH，0-1 次 MINOR
    警告阈值：超过 5 次任何类型发布
    红色警报：超过 10 次任何类型发布
```

### 发布窗口

```yaml
release_windows:
  minor:
    preferred: "每年 1 月 或 7 月"
    reason: "对齐半年审查周期"

  patch:
    preferred: "任意时间"
    avoid: "重大节假日前后"
```

---

## Release Record Template

### 发布记录模板

```markdown
## Release vX.Y.Z

**Date**: YYYY-MM-DD
**Type**: PATCH / MINOR / MAJOR
**Approvers**: [列表]

### Changes
- [变更 1]
- [变更 2]

### Dilution Check
- [ ] 执行能力检查: PASS
- [ ] 理解门槛检查: PASS
- [ ] 可抄袭性检查: PASS

### Cooldown Compliance
- Proposal Date: YYYY-MM-DD
- Cooldown End: YYYY-MM-DD
- Actual Release: YYYY-MM-DD

### Notes
[任何额外说明]
```

---

## Violation Handling

### 违规处理

```yaml
violation_handling:
  skipped_cooldown:
    severity: "严重"
    action: "立即回滚 + 重新进入冷静期"

  exceeded_annual_limit:
    severity: "警告"
    action: "冻结后续发布直到下一年度"

  unauthorized_release:
    severity: "严重"
    action: "立即回滚 + 审计发布流程"

  dilution_discovered:
    severity: "紧急"
    action: "P0 回滚 + 记录至 MISUSE_CASES"
```

---

## Inactivity as Success

### 不活跃是成功的标志

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   在稳态模式下，                                             │
│   长期无发布 是 系统健康 的标志，                             │
│   而非 系统停滞 的标志。                                     │
│                                                             │
│   频繁发布 = 可能正在被稀释                                  │
│   零发布 = 护城河可能完好                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Version History

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2025-12-31 | Initial release cadence definition |

---

**Version**: 1.0.0
**Effective**: 2025-12-31
**Next Allowed MINOR**: 2026-07-01 (最早)
