# Domain Conflict Policy

> **Version**: 1.0.0
> **Status**: Active
> **Last Updated**: 2026-01-01
> **Scope**: Multi-Domain Memory Stack conflict resolution

---

## Overview

When a query spans multiple knowledge domains, the system MUST apply deterministic conflict resolution rules. This document defines the **hard rules** for domain routing, term precedence, and cross-domain citation.

---

## §1 Decision Inputs

The domain routing algorithm receives the following inputs for each candidate domain:

| Input | Type | Description |
|-------|------|-------------|
| `keyword_hits` | integer | Count of keywords from domain config matching the query |
| `negative_hits` | integer | Count of negative keywords matching (disqualifying signal) |
| `confidence` | float | Calculated confidence score (0.0 - 1.0) |
| `priority` | integer | Domain priority from config (higher = preferred in ties) |

### Confidence Calculation

```
if negative_hits > 0:
    effective_hits = 0
else:
    effective_hits = keyword_hits

confidence = f(effective_hits):
    1-2 hits  → 0.70
    3 hits    → 0.75
    4-5 hits  → 0.85
    ≥6 hits   → 0.95
```

---

## §2 Primary Domain Decision Rules

The system MUST apply the following rules **in order of precedence**:

### Rule A: Negative Keyword Exclusion (MUST)

If `negative_hits > 0` for a domain, that domain MUST be excluded from consideration.

```
IF domain.negative_hits > 0:
    domain.excluded = true
    domain.effective_hits = 0
    domain.score = 0
```

**Rationale**: Negative keywords indicate explicit domain boundary violation.

### Rule B: Highest Confidence Wins (MUST)

Among non-excluded domains, the domain with the highest confidence MUST be selected as primary.

```
primary = argmax(domains, key=confidence)
```

### Rule C: Priority Tiebreaker (MUST)

If multiple domains have identical confidence, the domain with higher priority MUST win.

```
IF confidence_a == confidence_b:
    primary = domain with higher priority
```

### Rule D: Ambiguity Mode Trigger (SHOULD)

If the confidence difference between top two candidates is less than 0.10, the system SHOULD enter Ambiguity Mode.

```
IF |confidence_primary - confidence_secondary| < 0.10:
    ambiguity_mode = true
```

See §4 for Ambiguity Mode handling.

---

## §3 Term Conflict Rules

When the same term exists in multiple domain glossaries:

### Rule 3.1: Primary Wins (MUST)

The primary domain's definition MUST take precedence. The term MUST be cited from the primary domain glossary.

```markdown
# Primary domain: amazon-advertising
# Query mentions "CTR"

Correct:
  CTR (ref: knowledge/glossary/amazon-advertising.yaml#ctr@v1.0)
  点击率 = 点击次数 ÷ 曝光次数 × 100%

Incorrect:
  CTR (ref: knowledge/glossary/geo-seo.yaml#ctr@v1.0)  # Wrong domain!
```

### Rule 3.2: Secondary Domain Citation (MUST)

If output needs to explain a secondary domain's interpretation of the same term, it MUST:

1. Explicitly mark the source domain
2. Use the cross-domain citation format

```markdown
# Primary: amazon-advertising, Secondary: geo-seo
# Explaining CTR difference

**Amazon CTR** (ref: knowledge/glossary/amazon-advertising.yaml#ctr@v1.0)
= 广告点击次数 ÷ 广告曝光次数 × 100%

**Local Pack CTR** (ref: knowledge/glossary/geo-seo.yaml#ctr@v1.0 [source_domain=geo-seo])
= Local Pack 点击次数 ÷ Local Pack 曝光次数 × 100%
```

### Rule 3.3: No Redefinition (MUST NOT)

Secondary domain terms MUST NOT redefine the primary domain's established definitions. Reference only.

---

## §4 Ambiguity Mode

### 4.1 Trigger Condition

Ambiguity Mode is triggered when:

```
|confidence_primary - confidence_secondary| < 0.10
```

### 4.2 Required Output (MUST)

When in Ambiguity Mode, the output MUST append a **Domain Ambiguity Note**:

```markdown
---
## Domain Ambiguity Note

Multiple domains detected with similar confidence:

| Domain | Confidence | Reason |
|--------|------------|--------|
| amazon-advertising | 0.75 | keyword_score(3_hits) |
| geo-seo | 0.70 | keyword_score(2_hits) |

Primary domain selected: amazon-advertising (higher confidence + priority)
Cross-domain terms require explicit source_domain citation.
---
```

### 4.3 Non-Blocking (SHOULD)

Ambiguity Mode SHOULD NOT block output generation. It is an advisory mechanism for transparency.

---

## §5 Cross-Domain Citation Rules

### 5.1 Mandatory Format (MUST)

Every cross-domain concept MUST include:

| Element | Format | Required |
|---------|--------|----------|
| path | `knowledge/glossary/<domain>.yaml` | MUST |
| term | `#<concept_id>` | MUST |
| version | `@<version>` | MUST |
| source_domain | `[source_domain=<domain>]` | MUST for cross-domain |

### 5.2 Citation Examples

**Primary domain term (no source_domain needed)**:
```
(ref: knowledge/glossary/amazon-advertising.yaml#acos@v1.0)
```

**Cross-domain term (source_domain required)**:
```
(ref: knowledge/glossary/geo-seo.yaml#solv@v1.0 [source_domain=geo-seo])
```

### 5.3 Validation (MUST)

All cross-domain citations MUST be validated against:
1. Term exists in target glossary
2. Version matches current glossary version
3. source_domain matches the glossary's domain field

---

## §6 Worked Examples

### Example 1: Mixed Growth Query

**Query**: "本地落地页提升 CVR，同时 Amazon Ads ACoS 下降怎么做？"

**Domain Detection**:
| Domain | Hits | Negative Hits | Confidence | Priority |
|--------|------|---------------|------------|----------|
| geo-seo | 2 (local, cvr) | 1 (amazon ads) | 0 (excluded) | 85 |
| amazon-advertising | 3 (amazon, ads, acos) | 0 | 0.75 | 90 |

**Result**:
- geo-seo excluded by Rule A (negative_hits > 0)
- primary = amazon-advertising

**Required Citations**:
```markdown
**ACoS** (ref: knowledge/glossary/amazon-advertising.yaml#acos@v1.0)
= 广告花费 ÷ 广告销售额 × 100%

**CVR** (ref: knowledge/glossary/amazon-advertising.yaml#cvr@v1.0)
= 订单数 ÷ 点击次数 × 100%

若需解释 Local Landing Page 策略：
**Local Landing Page** (ref: knowledge/glossary/geo-seo.yaml#local_landing_page@v1.0 [source_domain=geo-seo])
= 针对特定地理位置优化的网页
```

---

### Example 2: CTR Definition Conflict

**Query**: "解释 CTR 在本地包点击与 Amazon 广告点击的口径差异"

**Domain Detection**:
| Domain | Hits | Confidence | Priority |
|--------|------|------------|----------|
| geo-seo | 2 (local, ctr) | 0.70 | 85 |
| amazon-advertising | 2 (amazon, ctr) | 0.70 | 90 |

**Ambiguity Check**: |0.70 - 0.70| = 0 < 0.10 → **Ambiguity Mode triggered**

**Result**:
- Rule C applies: amazon-advertising wins (priority 90 > 85)
- Ambiguity Note required

**Required Output**:
```markdown
## CTR 口径差异

### Amazon Advertising CTR
(ref: knowledge/glossary/amazon-advertising.yaml#ctr@v1.0)

**公式**: 广告点击次数 ÷ 广告曝光次数 × 100%
**场景**: 衡量 SP/SB/SD 广告的点击效率

### Local Pack CTR
(ref: knowledge/glossary/geo-seo.yaml#ctr@v1.0 [source_domain=geo-seo])

**公式**: Local Pack 点击次数 ÷ Local Pack 曝光次数 × 100%
**场景**: 衡量 GBP 在本地搜索结果中的点击效率

---
## Domain Ambiguity Note

Multiple domains detected with similar confidence:

| Domain | Confidence | Reason |
|--------|------------|--------|
| amazon-advertising | 0.70 | keyword_score(2_hits) |
| geo-seo | 0.70 | keyword_score(2_hits) |

Primary domain selected: amazon-advertising (higher priority: 90 > 85)
Cross-domain terms require explicit source_domain citation.
---
```

---

## §7 Enforcement

### CI Gate

The Memory Governance Gate MUST validate:
1. Cross-domain citations include source_domain
2. Ambiguity Mode outputs include Domain Ambiguity Note
3. All citations follow path + term + version format

### Runtime Enforcement

The Glossary Drift Detector SHOULD flag:
- Missing source_domain on cross-domain terms
- Undefined terms in secondary domain glossaries
- Version mismatches in citations

---

## Related Documents

- [MULTI_DOMAIN_MEMORY.md](./MULTI_DOMAIN_MEMORY.md)
- [DOMAIN_GEO_SEO.md](./DOMAIN_GEO_SEO.md)
- [MEMORY_GOVERNANCE.md](./MEMORY_GOVERNANCE.md)
- Domain Mapping: `.claude/config/domain-mapping.yaml`
