# ADR-003: Business Probe 验收口径冻结

**状态**: Accepted
**日期**: 2026-02-08
**决策者**: LiYe

## Context

Week 4 实现了 `business_probe_anomaly_recovery.mjs`，但缺少明确的验收口径：
- "回归"用什么区间判定？
- 指标从哪里读取？
- 周报 KPI 列名是什么？

如果不冻结这些口径，Week 5 会陷入"什么算恢复"的争议，拖慢进度。

## Decision

### 1. Probe 回归区间：[p25, p75]（稳健区间）

```yaml
recovery_interval:
  type: percentile
  lower: 25  # p25
  upper: 75  # p75
  rationale: |
    - 稳健区间，避免异常值干扰
    - 比 [p10, p90] 更严格，减少误判
    - 指标在 [p25, p75] 内视为"正常/恢复"
    - 低于 p25 或高于 p75 视为"异常未恢复"
```

**判定逻辑**:
- `improved`: 指标从异常区间回归到 [p25, p75] 内
- `regressed`: 指标仍在异常区间或恶化
- `stable`: 指标无显著变化（变化 < 5%）

### 2. Probe 数据来源：最小可信源

```yaml
data_sources:
  # Week 4-5 最小可信源（优先级排序）
  primary:
    name: "AGE T1 Truth Tables"
    location: "amazon-growth-engine/data/t1/*.parquet"
    type: "duckdb"
    latency: "T+1d"
    confidence: "high"

  fallback:
    name: "Ads API Direct Query"
    type: "amazon_ads_api"
    latency: "real-time"
    confidence: "medium"
    rate_limit: "100 req/min"

  insufficient_data_policy:
    action: "mark_insufficient"
    status: "insufficient_data"
    retry_after_hours: 24
    max_retries: 3
    explanation_required: true
```

**insufficient_data 情况**:
- T1 表无该 ASIN 数据
- 数据时间窗口不足 24h
- API 请求失败且重试耗尽

### 3. Weekly Report KPI 列名冻结

```yaml
weekly_report_columns:
  # 核心列（不可变，修改需 ADR）
  frozen_columns:
    - name: "runs_total"
      description: "本周 playbook 执行总次数"
      type: "integer"

    - name: "exec_success_count"
      description: "执行成功次数"
      type: "integer"

    - name: "exec_success_rate"
      description: "执行成功率 (%)"
      type: "float"
      formula: "exec_success_count / runs_total * 100"

    - name: "operator_accept_count"
      description: "Operator 批准次数"
      type: "integer"

    - name: "operator_accept_rate"
      description: "Operator 批准率 (%)"
      type: "float"
      formula: "operator_accept_count / (operator_accept_count + operator_reject_count) * 100"

    - name: "probe_measured_count"
      description: "已完成 business probe 的 run 数"
      type: "integer"

    - name: "probe_measured_rate"
      description: "Business probe 完成率 (%)"
      type: "float"
      formula: "probe_measured_count / runs_total * 100"

    - name: "recovery_count"
      description: "指标恢复/改善的 run 数"
      type: "integer"

    - name: "recovery_rate"
      description: "恢复率 (%)"
      type: "float"
      formula: "recovery_count / probe_measured_count * 100"

  # 扩展列（可自由添加，无需 ADR）
  extensible_columns:
    - avg_improvement_pct
    - by_playbook_breakdown
    - by_engine_breakdown
```

## Consequences

### Positive
- Week 5 不会因为口径争议拖慢
- KPI 可对比、可追溯
- insufficient_data 有明确处理策略

### Negative
- [p25, p75] 可能过于严格，需观察实际数据分布
- T1 表 T+1d 延迟可能影响及时性

### Migration
- 现有 `business_probe_anomaly_recovery.mjs` 需更新为区间判定逻辑
- `report_weekly.mjs` 需更新为冻结列名

## References
- Week 4 实现: `.claude/scripts/proactive/`
- ADR-001: 控制平面与数据平面分离
