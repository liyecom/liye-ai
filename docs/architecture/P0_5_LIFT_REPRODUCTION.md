# P0.5: Lift Reproduction & Regression

> **Status**: ACTIVE
> **Purpose**: 把 POSITIVE_LIFT 从「单点成功」升级为「可持续工程能力」
> **Created**: 2025-12-31
> **Phase Priority**: Reproducibility > Coverage > Scale

---

## Core Principle

> **P0.5 的目标是可复现性，不是覆盖扩展。**

在 P0 (Listing T1 填补) 完成后，我们有 3 个 Domain 验证了 Positive Lift：
- PPC: +4 lift (Case 01)
- BSR: +4 lift (Case 03)
- Listing: +7 lift (Case 04)

但这些是「单点成功」。P0.5 的任务是：
1. 确保这些 Lift 可复现
2. 防止未来修改导致 Lift 回退
3. 理解 Lift 的方差来源

---

## Scope Constraints

### P0.5 允许做的事

| Activity | Status | 说明 |
|----------|--------|------|
| 构建 Repro Pack | ✅ 必须 | 可复现实验包 |
| 实现 Regression Gate | ✅ 必须 | 阻断级回归护栏 |
| 分析 Variance | ✅ 必须 | 方差来源审计 |
| 新增同 Domain Case | ✅ 允许 | 扩充 Repro 基准 |

### P0.5 禁止做的事

| Activity | Status | 说明 |
|----------|--------|------|
| 新增 Domain | ❌ 禁止 | 先稳固已验证领域 |
| 接 External LLM API | ❌ 禁止 | 引入不可控变量 |
| 产品化 | ❌ 禁止 | 未达到工程成熟度 |
| 对外宣传 Lift | ❌ 禁止 | 内部能力积累阶段 |

---

## Deliverables

### 1. Repro Pack v1

**位置**: `experiments/repro_pack_v1/`

**结构**:
```
experiments/repro_pack_v1/
├── ppc/
│   ├── case_01.yaml
│   └── case_05.yaml
├── bsr/
│   ├── case_03.yaml
│   └── case_06.yaml
├── listing/
│   ├── case_04.yaml
│   └── case_07.yaml
└── README.md
```

**要求**:
- 每个 Domain ≥ 2 cases
- 所有 case.yaml 格式统一
- `locked: true` 标记回归基准

### 2. Lift Regression Gate

**位置**: `scripts/lift_regression_gate.py`

**功能**:
- 加载 Repro Pack 所有 case.yaml
- 检测 Lift 回退
- FAIL 条件：
  - POSITIVE_LIFT → NEUTRAL / NEGATIVE
  - lift 下降 ≥ 2
  - 使用 BLACKLIST 机制

**CI 集成**: `.github/workflows/lift-regression-gate.yml`

### 3. Variance Report

**位置**: `docs/analysis/LIFT_VARIANCE_REPORT.md`

**内容**:
- 识别 Lift 方差来源
- 评估可控性
- 提供缓解策略

---

## Success Criteria (DoD)

P0.5 视为完成，当且仅当：

```
✅ Repro Pack ≥ 6 cases (3 domains × 2)
✅ Regression Gate 在 CI 中生效
✅ 任意破坏 Lift 的 PR 会被 Block
✅ Variance Report 已提交
```

---

## Governance

### Lift 回退处理流程

当 PR 导致 Repro Pack 中既有 POSITIVE_LIFT 回退时：

1. CI 自动 Block Merge
2. PR 作者必须提供：
   - 回退原因分析
   - 替代机制方案
   - 明确是否接受回退
3. 需要人工裁决才能继续

### 回归阈值

| 指标 | 阈值 | 动作 |
|------|------|------|
| Lift 下降 | ≥ 2 | BLOCK |
| Verdict 变化 | POSITIVE → 非 POSITIVE | BLOCK |
| Blacklist 命中 | 任意 | BLOCK |

---

## References

- `experiments/reasoning_comparison/evaluation_summary.md` - Lift 验证结果
- `docs/architecture/T1_MECHANISM_WHITELIST.md` - 机制白名单
- `docs/CONSTITUTION.md` § 9-10 - 治理约束

---

**Version**: 1.0.0
**Created**: 2025-12-31
