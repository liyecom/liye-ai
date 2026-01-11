# Multi-Domain Memory Architecture

> **Version**: 1.0.0 (Schema-only)
> **Status**: T1-Ready Design (Runtime not yet activated)
> **Last Updated**: 2026-01-01

## Overview

This document describes the Multi-Domain Stack architecture for LiYe OS memory system. Currently implemented as schema-only; runtime activation planned for T1 migration.

---

## §1 Domain Stack Design

### 1.1 Core Concept

A **Domain Stack** is an ordered list of active knowledge domains for a session. Each domain contributes:
- Glossary terms
- ADRs (Architecture Decision Records)
- Playbooks
- Domain-specific reasoning constraints

### 1.2 Stack Structure

```
┌─────────────────────────────────────┐
│          Domain Stack               │
├─────────────────────────────────────┤
│  Primary Domain (is_primary: true)  │ ← Highest priority
│  ├── confidence: 0.85               │
│  ├── glossary_paths: [...]          │
│  └── terms take precedence          │
├─────────────────────────────────────┤
│  Secondary Domain 1                 │
│  ├── confidence: 0.45               │
│  └── terms require cross-domain tag │
├─────────────────────────────────────┤
│  Secondary Domain 2                 │
│  ├── confidence: 0.30               │
│  └── terms require cross-domain tag │
└─────────────────────────────────────┘
```

### 1.3 Domain Interface

```typescript
interface Domain {
  name: string;              // Unique identifier
  confidence: number;        // 0.0 - 1.0
  glossary_paths: string[];  // Paths to glossary files
  is_primary: boolean;       // Primary domain flag
  detection_reason?: string; // How domain was detected
}
```

---

## §2 Primary vs Secondary Domain

### 2.1 Primary Domain

- **Selection**: Highest confidence domain in the stack
- **Privileges**:
  - Terms can be cited without cross-domain marker
  - Definition conflicts resolved in its favor
  - ADRs/Playbooks loaded first
- **Constraint**: Only ONE primary domain per session

### 2.2 Secondary Domains

- **Role**: Supplementary knowledge sources
- **Constraints**:
  - Terms MUST be marked as cross-domain
  - Cannot override primary domain definitions
  - Lower priority in conflict resolution

### 2.3 Confidence Thresholds

| Confidence | Role | Citation Requirement |
|------------|------|---------------------|
| ≥ 0.6 | Primary eligible | Standard citation |
| 0.3 - 0.6 | Secondary | Cross-domain marker required |
| < 0.3 | Excluded | Not loaded into stack |

---

## §3 Cross-Domain Reasoning Rules

### 3.1 Term Citation

When using a term from a non-primary domain:

```markdown
# Primary domain: amazon-advertising
# Secondary domain: fintech

## Correct
The CAC (ref: knowledge/glossary/fintech.yaml#cac@1.0.0 [cross-domain]) 
for this campaign is calculated differently from ACoS.

## Incorrect (missing cross-domain marker)
The CAC (ref: knowledge/glossary/fintech.yaml#cac@1.0.0) for this campaign...
```

### 3.2 Cross-Domain Markers

| Format | Example |
|--------|---------|
| Full | `[cross-domain: fintech]` |
| Inline | `(ref: path#term@ver [cross-domain])` |
| Tag | `[[term@ver:fintech]]` |

### 3.3 Conflict Resolution

When the same term exists in multiple domains:

```typescript
interface TermConflict {
  term: string;
  domains: string[];
  resolution: 'primary_wins' | 'explicit_required' | 'merged';
}
```

**Resolution Strategies**:

| Strategy | When Used | Behavior |
|----------|-----------|----------|
| `primary_wins` | Default | Primary domain definition used |
| `explicit_required` | Conflicting formulas | User must specify domain |
| `merged` | Compatible definitions | Definitions combined |

---

## §4 Memory Brief with Multi-Domain

### 4.1 Enhanced Structure

```typescript
interface MemoryBrief {
  timestamp: string;
  task: string;
  
  // Multi-domain support
  domains: Domain[];
  primary_domain: string | null;
  
  // Merged terms (all domains)
  terms: GlossaryTerm[];
  
  // Conflict tracking
  conflicts?: TermConflict[];
}
```

### 4.2 Example Multi-Domain Brief

```markdown
# Session Memory Brief

> Generated at: 2026-01-01T12:00:00Z

## Domain Stack

| Domain | Confidence | Role |
|--------|------------|------|
| amazon-advertising | 0.85 | Primary |
| e-commerce | 0.45 | Secondary |
| fintech | 0.32 | Secondary |

## Primary Domain: amazon-advertising
- **glossary**: knowledge/glossary/amazon-advertising.yaml
- **terms**: 12 loaded

## Secondary Domains

### e-commerce (confidence: 0.45)
- **glossary**: knowledge/glossary/e-commerce.yaml
- **terms**: 8 loaded (cross-domain citation required)

### fintech (confidence: 0.32)
- **glossary**: knowledge/glossary/fintech.yaml
- **terms**: 5 loaded (cross-domain citation required)

## Term Conflicts

| Term | Domains | Resolution |
|------|---------|------------|
| ROI | amazon-advertising, fintech | primary_wins |
| conversion_rate | amazon-advertising, e-commerce | merged |

## Output Contract
1. Primary domain terms: standard citation
2. Secondary domain terms: MUST include [cross-domain] marker
3. Conflicting terms: use primary domain definition unless explicit override
```

---

## §5 Implementation Status

### 5.1 Current State (Schema-only)

| Component | Status |
|-----------|--------|
| `Domain` interface | ✅ Defined |
| `MemoryBrief` interface | ✅ Defined |
| `TermConflict` interface | ✅ Defined |
| Single-domain runtime | ✅ Active |
| Multi-domain detection | ⏳ Planned (T1) |
| Conflict resolution | ⏳ Planned (T1) |
| Cross-domain validation | ⏳ Planned (T1) |

### 5.2 Migration Path

```
v6.1.1 (Current)
└── Single domain detection
└── Schema supports multi-domain
└── Output contract: single domain only

T1 Migration
└── Enable multi-domain detection
└── Implement conflict resolution
└── Activate cross-domain validation
└── Update output contract enforcement
```

### 5.3 Activation Checklist

Before enabling multi-domain runtime:

- [ ] All domain glossaries versioned and complete
- [ ] Cross-domain citation format finalized
- [ ] Conflict resolution rules documented
- [ ] Drift detector updated for cross-domain
- [ ] CI gates updated for multi-domain validation

---

## §6 API Reference

### 6.1 Type Definitions

See: `src/memory/schema/glossary.ts`

### 6.2 Key Functions

```typescript
// Parse citation string
parseCitation(citation: string): TermCitation | null

// Format citation for output
formatCitation(citation: TermCitation, format: 'full' | 'short' | 'inline'): string

// Type guards
isGlossaryTerm(obj: unknown): obj is GlossaryTerm
isDomain(obj: unknown): obj is Domain
```

---

## Appendix A: Design Rationale

### Why Multi-Domain?

1. **Real-world complexity**: Tasks often span multiple knowledge areas
2. **Precision**: Cross-domain markers prevent term confusion
3. **Auditability**: Clear provenance for all definitions
4. **Scalability**: New domains can be added without breaking existing flows

### Why Schema-First?

1. **Stability**: Define contracts before implementation
2. **Testability**: Can validate data against schema
3. **Migration safety**: Existing flows unaffected until activation
4. **Documentation**: Schema IS the specification

---

---

## Appendix B: Domain Examples

### B.1 Geo-SEO as Secondary Domain Example

当用户 query 同时涉及多个领域时，Multi-Domain Stack 将按以下方式处理：

**示例场景**: "比较 Amazon 广告 ACoS 和 GBP Local Pack 转化率"

```markdown
## Domain Stack

| Domain | Confidence | Role |
|--------|------------|------|
| amazon-advertising | 0.75 | Primary |
| geo-seo | 0.55 | Secondary |

## Cross-Domain Citation Example

当引用 geo-seo 术语时，必须标记 [cross-domain]:

"Amazon 广告的 **ACoS** (ref: knowledge/glossary/amazon-advertising.yaml#acos@v1.0)
衡量广告效率，而 GBP 的 **Local Pack**
(ref: knowledge/glossary/geo-seo.yaml#local_pack@v1.0 [cross-domain])
关注的是地理可见度。"
```

### B.2 Geo-SEO 作为 Primary Domain

当 query 明确为 Geo-SEO 领域时：

**示例 query**: "解释 SoLV 是什么，并给出计算口径"

```markdown
## Domain Detection

- **domain**: geo-seo
- **confidence**: 0.85 (keyword_score: solv, 计算口径)
- **glossary_path**: knowledge/glossary/geo-seo.yaml

## Output Contract

所有术语引用格式:
(ref: knowledge/glossary/geo-seo.yaml#<concept_id>@<version>)
```

### B.3 边界冲突处理

当 query 可能属于多个 domain 时（如 "seo 优化"），系统按以下优先级判断：

1. **Negative Keywords 排除**: 如果出现 `amazon`, `acos` 等，排除 geo-seo
2. **Priority 比较**: amazon-advertising (90) > geo-seo (85) > geo (80)
3. **Keyword Hit Count**: 命中更多关键词的 domain 获得更高 confidence

**当前状态**: 单 Domain 行为（仅选择最高 confidence 的 domain）
**未来 T1**: 启用 Multi-Domain Stack，支持 Primary + Secondary 并行加载

---

## Related Documents

- [MEMORY_GOVERNANCE.md](./MEMORY_GOVERNANCE.md)
- [MEMORY_ANTI_FORGETTING_DESIGN.md](./MEMORY_ANTI_FORGETTING_DESIGN.md)
- [DOMAIN_GEO_SEO.md](./DOMAIN_GEO_SEO.md)
- Schema: `src/memory/schema/glossary.ts`
