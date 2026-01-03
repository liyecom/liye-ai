# Memory Governance Architecture

> **Version**: 1.0.0
> **Last Updated**: 2026-01-01
> **Status**: Active

## Overview

This document defines the governance architecture for LiYe OS memory systems, ensuring consistent terminology, auditable decisions, and zero-drift knowledge management.

---

## §1 Memory as a Product (MaaP)

### 1.1 Core Principle

Memory is treated as a first-class product with:
- **SSOT (Single Source of Truth)**: All definitions come from versioned glossaries
- **Traceability**: Every term citation includes path + term + version
- **Auditability**: All memory access and mutations are logged

### 1.2 Architecture

```
┌─────────────────────────────────────────────────┐
│                  Session Start                   │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│              memory_bootstrap.mjs                │
│  - Domain detection                              │
│  - Glossary loading                              │
│  - ADR/Playbook indexing                         │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│              Memory Brief (MaaP)                 │
│  .claude/.compiled/memory_brief.md               │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│              Context Assembler                   │
│  Injects Memory Brief after Kernel               │
└─────────────────────────────────────────────────┘
```

### 1.3 Output Contract

All outputs MUST follow:

1. **Definition/metric/decision** outputs cite: `glossary: path + term + version`
2. **Missing SSOT** triggers: propose patch instead of guessing
3. **Pre-Action Memory Check**: verify before making decisions

---

## §2 Domain Detection

### 2.1 Mechanism

Domain detection uses keyword scoring:

```javascript
score = keyword_hits × domain_priority
confidence = min(0.95, 0.3 + score / 200)
```

### 2.2 Configuration

Domain mappings are defined in:
```
.claude/config/domain-mapping.yaml
```

Each domain specifies:
- `id`: Unique identifier
- `keywords`: Trigger words
- `priority`: Weight multiplier
- `glossary`: Path to canonical glossary
- `adrs_glob`: Pattern for ADR files
- `playbooks_glob`: Pattern for playbook files

---

## §3 Glossary Management

### 3.1 Glossary Structure

```yaml
# knowledge/glossary/<domain>.yaml
metadata:
  domain: amazon-advertising
  version: "1.0.0"
  last_updated: "2026-01-01"

glossary:
  - concept_id: acos
    term: ACoS
    definition: "Advertising Cost of Sales..."
    formula: "Ad Spend ÷ Ad Sales × 100%"
    version: "1.0.0"
    aliases: ["Advertising Cost of Sales"]
    related: ["ROAS", "ACoAS"]
```

### 3.2 Version Policy

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Typo fix | Patch (x.x.1) | "Advertizing" → "Advertising" |
| Clarification | Minor (x.1.0) | Add example to definition |
| Formula change | Major (1.0.0) | Change calculation method |
| New term | Minor (x.1.0) | Add new concept |
| Remove term | Major (1.0.0) | Deprecate concept |

### 3.3 Citation Format

```
Standard:  (ref: knowledge/glossary/amazon-advertising.yaml#acos@1.0.0)
Shorthand: [[ACoS@1.0.0]]
Inline:    ACoS (ref: acos@1.0.0)
```

---

## §4 Glossary Drift Protection

### 4.1 Purpose

Prevent terminology drift by enforcing:
- All technical terms are registered in glossary
- All citations include version
- No version mismatches

**Violation = Output Blocked**

### 4.2 Detection Rules

| Rule | Description | Action on Violation |
|------|-------------|---------------------|
| UNREGISTERED_TERM | Term not in glossary | Block + suggest add |
| MISSING_CITATION | Domain term without ref | Block + require citation |
| VERSION_MISMATCH | Citation version != current | Block + require update |

### 4.3 Implementation

The Glossary Drift Detector skill:
- **Location**: `.claude/skills/memory/glossary-drift-detector.md`
- **Priority**: P0 (highest, before all domain skills)
- **Phase**: Output Contract Enforcement
- **Mode**: Blocking (strict by default)

### 4.4 Strictness Levels

```yaml
# .claude/config/memory-governance.yaml
glossary_drift:
  strictness: strict  # strict | warn | off
```

| Level | Behavior |
|-------|----------|
| `strict` | Block output on any violation |
| `warn` | Log warning, allow output |
| `off` | Disable detection |

### 4.5 Exclusions

The detector skips:
- Code blocks (` ``` `)
- Quoted text (`>`)
- Standard programming terms (API, URL, HTTP, JSON)
- Common English words

### 4.6 Audit Trail

All detections logged to:
```
data/traces/glossary-drift/<date>_session_<id>.json
```

### 4.7 Recovery Flow

```
┌─────────────────┐
│ Drift Detected  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Output Blocked  │
└────────┬────────┘
         │
    ┌────┴────────────┐
    │                 │
    ▼                 ▼
┌─────────┐    ┌──────────────┐
│ Add to  │    │ Use existing │
│ Glossary│    │   synonym    │
└─────────┘    └──────────────┘
```

---

## §5 Memory Diff (Audit)

### 5.1 Purpose

Track cognitive changes between sessions for:
- Auditability
- Regression detection
- Domain confidence monitoring

### 5.2 Diff Output

Location: `memory/diff/MEMORY_DIFF_<timestamp>.md`

Contents:
- Domain changes (add/remove)
- Confidence changes (with warnings if > 0.2)
- Glossary term changes

### 5.3 Warning Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| Domain confidence change | > 0.2 | WARNING (non-blocking) |
| New unregistered terms | > 5 | WARNING |
| Version mismatches | > 0 | ERROR (blocking) |

---

## §6 Governance Gates

### 6.1 CI Enforcement

File: `.github/workflows/memory-governance-gate.yml`

Triggers on changes to:
- `glossary/*.yaml`
- `.claude/scripts/memory_*.mjs`
- Output Contract files

### 6.2 Gate Rules

| Rule | Enforcement |
|------|-------------|
| Glossary change → version bump required | FAIL if missing |
| MaaP script change → docs update required | FAIL if missing |
| Output Contract change → review required | FAIL without approval |

---

## Appendix A: File Locations

| Component | Path |
|-----------|------|
| Domain mapping | `.claude/config/domain-mapping.yaml` |
| Glossaries | `knowledge/glossary/*.yaml` |
| Memory Brief | `.claude/.compiled/memory_brief.md` |
| Drift Detector | `.claude/skills/memory/glossary-drift-detector.md` |
| Diff output | `memory/diff/MEMORY_DIFF_*.md` |
| Audit traces | `data/traces/glossary-drift/*.json` |

## Appendix B: Related Documents

- [MEMORY_ANTI_FORGETTING_DESIGN.md](./MEMORY_ANTI_FORGETTING_DESIGN.md)
- [MULTI_DOMAIN_MEMORY.md](./MULTI_DOMAIN_MEMORY.md)
- [ARCHITECTURE_CONSTITUTION.md](./_meta/docs/ARCHITECTURE_CONSTITUTION.md)
