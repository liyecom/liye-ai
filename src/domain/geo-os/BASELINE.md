# GEO OS Baseline Registry

## T0: geo_seo (Frozen Baseline)

**Status**: FROZEN
**Frozen Date**: 2025-12-29
**Units**: 445
**Size**: 0.66 MB

### Purpose

geo_seo 作为 GEO OS 的第一个完整处理的真相源，被冻结为 **T0 基准**。

### 基准规则

1. **永不混合**: geo_seo 永不与其他源混合处理
2. **参照物**: 作为评估其他源质量的参照标准
3. **不可变**: T0 输出不再修改，除非 pipeline 版本升级

### 内容特征

| 指标 | 值 |
|------|-----|
| 原始文件 | 49 |
| Markdown | 24 |
| 知识单元 | 445 |
| 输出大小 | 0.66 MB |

### 内容类型

- 学术论文 (GEO: Generative Engine Optimization)
- 中文深度解析 (原理、方法、案例)
- 实用指南 (平台适配)
- GEO 工具系列 (20+ 工具评测)

### 质量指标 (Baseline Metrics)

```yaml
units_per_file: 18.5  # 445 / 24 markdown
avg_chunk_size: 600   # chars
content_density: high # 学术+分析内容
noise_ratio: low      # 已人工整理
```

### 输出位置

```
~/data/exports/geo_seo/
├── geo_units_v0.1.json      # T0 Baseline
└── geo_units_latest.json    # → symlink
```

---

## Source Classification

| Source | 类型 | 状态 |
|--------|------|------|
| geo_seo | 真相源 (Truth Source) | T0 Frozen |
| shengcai | 经验矿山 (Raw Experience Mine) | 待精炼 |
| industry_reports | 待整理 | Disabled |
| career_reports | 待整理 | Disabled |

### 关键区分

```
真相源 (Truth Source)
  = 已验证、结构化、可直接消费
  = geo_seo

经验矿山 (Raw Experience Mine)
  = 需要精炼、提取、验证
  = shengcai (14062 files → 8 markdown 精选)
```

---

## Version History

| 版本 | 日期 | 事件 |
|------|------|------|
| T0 | 2025-12-29 | geo_seo 冻结为 Baseline |

---

**Principle**: T0 是评估所有后续处理质量的锚点。
