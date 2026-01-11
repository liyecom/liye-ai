# Repro Pack v1

> **Purpose**: T1 Reasoning Lift 可复现实验包
> **Status**: LOCKED (Regression Baseline)
> **Created**: 2025-12-31

---

## Overview

Repro Pack 是 T1 Reasoning Lift 的回归测试基准。任何修改 T1 单元或 Agent 逻辑的 PR，都必须通过 Regression Gate 验证不会导致 Lift 回退。

---

## Structure

```
repro_pack_v1/
├── ppc/
│   ├── case_01.yaml  # ACoS 优化 (+4 lift)
│   └── case_05.yaml  # 广告结构优化 (+5 lift)
├── bsr/
│   ├── case_03.yaml  # BSR 下降诊断 (+4 lift)
│   └── case_06.yaml  # Buy Box 隐性抑制 (+4 lift)
├── listing/
│   ├── case_04.yaml  # Bullet 优化 (+7 lift)
│   └── case_07.yaml  # 标题权衡 (+6 lift)
└── README.md
```

---

## Cases Summary

| Domain | Case ID | Query | Lift | Verdict |
|--------|---------|-------|------|---------|
| PPC | case_01 | ACoS 45% → 25% | +4 | POSITIVE_LIFT |
| PPC | case_05 | 单一 vs 混合 ASIN | +5 | POSITIVE_LIFT |
| BSR | case_03 | BSR 100 → 500+ | +4 | POSITIVE_LIFT |
| BSR | case_06 | Buy Box 隐性抑制 | +4 | POSITIVE_LIFT |
| Listing | case_04 | Bullet 转化优化 | +7 | POSITIVE_LIFT |
| Listing | case_07 | 标题长度权衡 | +6 | POSITIVE_LIFT |

**Total Cases**: 6
**Total Positive Lift**: 6/6 (100%)
**Average Lift**: +5.0

---

## Case YAML Schema

```yaml
domain: string           # ppc | bsr_diagnosis | listing
case_id: string          # case_XX
query: string            # 用户查询

baseline_score: int      # Baseline 总分 (max 12)
t1_enabled_score: int    # T1-Enabled 总分 (max 12)
lift: int                # 分差

criteria:                # 使用的评价维度
  - D1_*
  - D2_*
  - D3_*
  - D4_*

dimensions_improved:     # 提升的维度
  - D1: "Level → Level"

t1_units_used:           # 使用的 T1 单元 ID
  - t1_xxx

verdict: string          # POSITIVE_LIFT | NEUTRAL | NEGATIVE_LIFT
locked: boolean          # 是否为回归基准

source_experiment: string  # 原始实验文件
verified_date: string      # 验证日期
```

---

## Regression Rules

### FAIL Conditions

1. **Verdict 回退**: POSITIVE_LIFT → NEUTRAL / NEGATIVE_LIFT
2. **Lift 下降**: 当前 lift < 原始 lift - 2
3. **Blacklist 命中**: 使用了 T1_MECHANISM_WHITELIST.md 中的 Blacklist 机制

### BLOCK Policy

当 Regression Gate FAIL 时：
- PR 无法合并
- 必须提供回退原因分析
- 需要人工裁决

---

## Usage

### 运行 Regression Gate

```bash
python scripts/lift_regression_gate.py
```

### 添加新 Case

1. 在对应 domain 目录创建 `case_XX.yaml`
2. 执行完整实验流程
3. 验证 POSITIVE_LIFT
4. 设置 `locked: true`

---

## Governance

- 所有 `locked: true` 的 case 不可随意修改
- 修改需要提供充分理由和人工审批
- 回归测试在 CI 中自动执行

---

**Version**: 1.0.0
**Last Updated**: 2025-12-31
