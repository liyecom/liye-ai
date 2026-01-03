# Domain: Geo-SEO (Local SEO)

> **Version**: 1.0.0
> **Status**: Active
> **Last Updated**: 2026-01-01
> **SSOT**: `knowledge/glossary/geo-seo.yaml`

---

## Overview

Geo-SEO (也称 Local SEO) 是针对本地搜索优化的专业领域，核心关注点是帮助商家在 Google 地图和本地搜索结果（Local Pack）中获得更高的可见度。

### 典型问题场景

| 场景 | 示例问题 |
|------|---------|
| **GBP 优化** | "如何选择 Primary Category？" |
| **排名诊断** | "为什么我的店铺不出现在 Local Pack？" |
| **竞品分析** | "竞品的 SoLV 是多少？我们差距在哪？" |
| **评论管理** | "Reviews Velocity 多少才算健康？" |
| **NAP 一致性** | "如何检查和修复 NAP 不一致？" |
| **引用建设** | "Citation 和 Backlink 有什么区别？" |

---

## SSOT 术语来源

所有 Geo-SEO 术语定义来源于：

1. **Google 官方文档**
   - Google Business Profile Help Center
   - Google Search Central (Local SEO guidelines)

2. **行业权威工具**
   - Whitespark (Local Citation Finder, Local Rank Tracker)
   - BrightLocal (Local SEO tools and reports)
   - Local Falcon (Geo Grid ranking)

3. **社区共识**
   - Local Search Ranking Factors (Whitespark annual survey)
   - Sterling Sky local SEO research

---

## 引用契约（Output Contract）

在任何涉及 Geo-SEO 术语的输出中，**必须**按以下格式引用 SSOT：

### 契约格式规范

| 元素 | 格式 | 示例 |
|------|------|------|
| **完整引用** | `(ref: <path>#<concept_id>@<version>)` | `(ref: knowledge/glossary/geo-seo.yaml#solv@v1.0)` |
| **path** | glossary 文件相对路径 | `knowledge/glossary/geo-seo.yaml` |
| **concept_id** | 术语 ID（小写下划线） | `solv`, `nap_consistency`, `local_pack` |
| **version** | 语义版本号 | `v1.0` |

### 必须遵守的引用规则

1. **每个术语首次出现时必须引用**：`(ref: path#term@version)`
2. **引用必须包含完整三要素**：path + concept_id + version
3. **未登记术语禁止使用**：必须先提交 glossary patch

---

### 示例 1: 解释 SoLV（含完整引用）

**SoLV (Share of Local Voice)** 是量化本地可见度的核心指标。
(ref: knowledge/glossary/geo-seo.yaml#solv@v1.0)

| 引用字段 | 值 |
|----------|-----|
| path | `knowledge/glossary/geo-seo.yaml` |
| concept_id | `solv` |
| version | `v1.0` |

**计算口径**：进入 Top N 的格点数 ÷ 总格点数 × 100%

---

### 示例 2: 解释 NAP 一致性（含完整引用）

**NAP Consistency** 是影响 Prominence 的关键因素。
(ref: knowledge/glossary/geo-seo.yaml#nap_consistency@v1.0)

| 引用字段 | 值 |
|----------|-----|
| path | `knowledge/glossary/geo-seo.yaml` |
| concept_id | `nap_consistency` |
| version | `v1.0` |

NAP = Name + Address + Phone，商家在全网各平台的信息必须完全一致。

---

### 示例 3: 区分易混术语（多术语引用）

**Citation** 和 **Backlink** 是两个不同概念：

| 术语 | 引用 | 定义 |
|------|------|------|
| Citation | (ref: knowledge/glossary/geo-seo.yaml#citation@v1.0) | 第三方网站上的 NAP 信息（不需要链接） |
| Backlink | (ref: knowledge/glossary/geo-seo.yaml#backlink@v1.0) | 指向官网的超链接（必须有链接） |

**易错点**: "我们有 100 个 Citation" ≠ "我们有 100 个外链"

---

### 示例 4: 排名三要素（批量引用）

Local Pack 排名由三大要素决定：

| 要素 | 引用 | 可优化性 |
|------|------|----------|
| Proximity | (ref: knowledge/glossary/geo-seo.yaml#proximity@v1.0) | ❌ 不可优化 |
| Relevance | (ref: knowledge/glossary/geo-seo.yaml#relevance@v1.0) | ✅ 可优化 |
| Prominence | (ref: knowledge/glossary/geo-seo.yaml#prominence@v1.0) | ✅ 可优化 |

---

## Domain 边界

### Geo-SEO vs Amazon-Advertising

| 维度 | Geo-SEO | Amazon-Advertising |
|------|---------|-------------------|
| **平台** | Google Search/Maps | Amazon |
| **目标** | 本地到店/到访 | 电商购买 |
| **核心指标** | SoLV, Review Rating, Direction Requests | ACoS, ROAS, ACoAS |
| **排名因素** | Proximity, Relevance, Prominence | 关键词竞价、关联性、销量 |
| **触发关键词** | GBP, Local Pack, NAP, Citation | Amazon, ASIN, PPC, ACoS |

### 边界判断规则

1. **排他检测**: 如果 query 同时包含 `amazon` 和 `local pack`，以 `amazon` 优先（priority 更高）
2. **负向排除**: geo-seo 配置了 negative_keywords，遇到 `acos`, `acoas`, `ppc` 等会自动排除
3. **显式指定**: 用户可在 query 中明确说 "这是 Geo-SEO 问题" 来强制路由

---

## 核心术语速查

### 实体与配置

| 术语 | 说明 | Version |
|------|------|---------|
| GBP | Google Business Profile，商家资料管理平台 | v1.0 |
| GMB | GBP 旧称（历史名，2021 年后弃用） | v1.0 |
| NAP | Name + Address + Phone 三要素 | v1.0 |
| Primary Category | GBP 主类目，直接影响排名 | v1.0 |
| Service Areas | 服务区域（SAB 业务） | v1.0 |

### 排名三要素

| 术语 | 说明 | 可优化性 |
|------|------|---------|
| Proximity | 用户与商家的距离 | ❌ 不可优化 |
| Relevance | GBP 信息与搜索意图匹配度 | ✅ 可优化 |
| Prominence | 商家线上线下知名度 | ✅ 可优化 |

### 监控与分析

| 术语 | 说明 | 公式 |
|------|------|------|
| Geo Grid | 地理网格排名检测方法 | - |
| SoLV | 本地声量份额 | Top N 格点数 ÷ 总格点数 × 100% |
| Reviews Velocity | 评论增长速度 | 新增评论数 ÷ 时间周期 |

---

## 相关文档

- SSOT Glossary: `knowledge/glossary/geo-seo.yaml`
- Domain Mapping: `.claude/config/domain-mapping.yaml`
- Multi-Domain Architecture: `docs/architecture/MULTI_DOMAIN_MEMORY.md`
- Memory Governance: `docs/architecture/MEMORY_GOVERNANCE.md`
