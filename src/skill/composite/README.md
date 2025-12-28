# Composite Skills

> **状态**: `PLACEHOLDER` - 框架就绪，待实现

## 定位

组合技能层 - 将多个原子技能 (atomic skills) 链接成复杂工作流。

## 设计原则

```
CompositeSkill = AtomicSkill_1 → AtomicSkill_2 → ... → AtomicSkill_N
```

1. **链式执行**: 前一个技能的输出作为后一个技能的输入
2. **类型安全**: 通过 TypeScript 确保技能间的数据契约
3. **可组合性**: 组合技能可以嵌套组合

## 预期实现

- [ ] `market_analysis_pipeline.ts` - 市场分析流水线
  - market_research → competitor_analysis → content_optimization
- [ ] `keyword_optimization_flow.ts` - 关键词优化流
  - keyword_research → content_optimization
- [ ] `full_listing_audit.ts` - 完整 Listing 审计
  - market_research → keyword_research → competitor_analysis → content_optimization

## 激活条件

1. 原子技能层稳定运行
2. 定义清晰的组合模式
3. 完成类型系统设计

## 参考

- 原子技能: `/src/skill/atomic/`
- 技能类型: `/src/skill/types.ts`
- 技能规范: `/docs/architecture/SKILL_SPEC.md`

---
**Created**: 2025-12-28 | **Status**: PLACEHOLDER
