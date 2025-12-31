# Lift Variance Report

> **Status**: ACTIVE
> **Purpose**: 识别 Lift 方差来源，提供缓解策略
> **Created**: 2025-12-31
> **Last Updated**: 2025-12-31

---

## Executive Summary

T1 Reasoning Lift 在已验证领域表现稳定，但存在以下方差来源需要持续监控：

| Variance Source | Impact Level | Controllability | Status |
|-----------------|--------------|-----------------|--------|
| V1: Input Variance | MEDIUM | ✅ Controllable | MANAGED |
| V2: Rubric Interpretation | MEDIUM | ✅ Controllable | MANAGED |
| V3: T1 Coverage | HIGH | ✅ Controllable | EXPANDING |
| V4: Model Variance | LOW (current) | ⚠️ Future Risk | MONITORED |

---

## Variance Sources

### V1: Input Variance (输入语义差异)

**描述**:
同一 Domain 的不同 Query 可能触发不同的 T1 单元子集，导致输出质量不一致。

**示例**:
```
Query A: "ACoS 45% 降到 25%"  → 触发 4 个 T1 单元 → Lift +4
Query B: "广告预算分配"        → 触发 2 个 T1 单元 → Lift +2
```

**是否可控**: ✅ 是

**缓解策略**:
1. 扩展 `DOMAIN_KEYWORDS` 覆盖更多同义表达
2. 每个 Domain 至少 2 个 Repro Case 覆盖不同表达
3. 使用 Variance Case 测试边界条件

**当前状态**: MANAGED - Repro Pack 每 Domain 2 cases

---

### V2: Rubric Interpretation Variance (判据理解差异)

**描述**:
评估者对 D1-D4 维度的理解可能存在主观差异，导致评分不一致。

**示例**:
```
D1 (Causal Explicitness):
  Evaluator A: "有→符号就算 High"
  Evaluator B: "需要完整链条才算 High"
```

**是否可控**: ✅ 是

**缓解策略**:
1. 在 `REASONING_LIFT_CRITERIA.md` 中提供标准化示例
2. 每个 Level 配有正反例
3. 使用 Case 锁定作为参考基准

**当前状态**: MANAGED - 判据文档已标准化

---

### V3: T1 Coverage Variance (机制覆盖不全)

**描述**:
某些 Query 可能落入 T1 覆盖空白区，导致 Lift 为 0 或负值。

**示例**:
```
Case 02 (原始): Listing Query → 0 T1 单元 → Lift 0
Case 04 (填补后): Listing Query → 4 T1 单元 → Lift +7
```

**是否可控**: ✅ 是

**解决方案**:
1. 使用 `T1_COVERAGE_MAP.md` 跟踪覆盖状态
2. 优先填补 Lift 验证失败的领域
3. 新领域需要先验证 Lift 再产品化

**当前状态**: EXPANDING
- PPC: PARTIAL → P1
- BSR: PARTIAL → P1
- Listing: PARTIAL → P1 (新填补)
- Keyword Research: EMPTY → 待填补
- A+ Content: EMPTY → 待填补

---

### V4: Model Variance (模型方差)

**描述**:
当接入真实 LLM 时，模型版本、temperature、context window 等参数会引入额外方差。

**当前状态**: LOW RISK (当前使用 stub 输出)

**未来风险**:
```
当接入 LLM 后:
  - Temperature 影响输出一致性
  - Context window 限制影响 T1 加载
  - Model version 更新可能改变推理质量
```

**是否可控**: ⚠️ 部分可控

**缓解策略 (Future)**:
1. 固定 Temperature = 0 用于 Repro 测试
2. 锁定 Model Version 在 Repro 期间
3. 设置 Context Budget 上限

**当前状态**: MONITORED - stub 实现暂无此风险

---

## Variance Metrics

### Current Repro Pack Statistics

```
Domain: PPC
  Cases: 2
  Average Lift: +4.5
  Variance: ±0.5 (Low)

Domain: BSR
  Cases: 2
  Average Lift: +4.0
  Variance: ±0.0 (None)

Domain: Listing
  Cases: 2
  Average Lift: +6.5
  Variance: ±0.5 (Low)

Overall:
  Total Cases: 6
  Average Lift: +5.0
  Cross-Domain Variance: ±1.5 (Acceptable)
```

### Variance Thresholds

| Metric | Acceptable | Warning | Critical |
|--------|------------|---------|----------|
| Intra-Domain Variance | ≤ 1.0 | 1.0 - 2.0 | > 2.0 |
| Cross-Domain Variance | ≤ 2.0 | 2.0 - 3.0 | > 3.0 |
| Verdict Consistency | 100% | 80-100% | < 80% |

---

## Monitoring Protocol

### Weekly Check

1. Run `lift_regression_gate.py` on all locked cases
2. Record any variance > threshold
3. Investigate root cause if variance detected

### On T1 Modification

1. CI automatically triggers Regression Gate
2. BLOCK merge if Lift regression detected
3. Require human review for variance > 2

### On Domain Expansion

1. Create ≥ 2 cases for new domain
2. Verify Lift consistency across cases
3. Add to Repro Pack with `locked: true`

---

## Action Items

### Immediate (P0.5)

- [x] Establish Repro Pack v1 (6 cases)
- [x] Implement Regression Gate
- [x] Document Variance Sources

### Short-term (P1)

- [ ] Expand Keyword Research T1 coverage
- [ ] Add variance cases for edge scenarios
- [ ] Implement automated variance tracking

### Medium-term (P2)

- [ ] Prepare for LLM integration variance
- [ ] Establish Model Version locking protocol
- [ ] Create Variance Dashboard

---

## References

- `docs/architecture/P0_5_LIFT_REPRODUCTION.md` - P0.5 阶段定义
- `experiments/repro_pack_v1/` - Repro Pack
- `scripts/lift_regression_gate.py` - 回归 Gate
- `docs/architecture/REASONING_LIFT_CRITERIA.md` - 评价标准

---

**Version**: 1.0.0
**Created**: 2025-12-31
