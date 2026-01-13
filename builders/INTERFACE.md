# Builder Interface Specification

> **Status**: FROZEN (v1.0) | Breaking changes require ADR
> **Version**: 1.0.0
> **Date**: 2026-01-13

## Purpose

This document defines the **read-only interface** between Builders and Contracts.
Once frozen, this interface MUST NOT change without explicit amendment.

---

## Builder Read Interface (Frozen)

### Sole Input Source

```
tracks/<track_id>/site-design.contract.yaml
```

### Required Fields (Builder MUST read)

```yaml
site:
  name: string          # Track identifier
  stack: string[]       # Technical stack

tokens:
  colors:
    primary: string     # Primary brand color
    background: string  # Background color
  typography:
    primary_font: string    # Body font
    heading_font: string    # Heading font (optional, defaults to primary_font)

style:
  allowed_modes: string[]   # ['light'] | ['dark'] | ['light', 'dark']
  default_mode: string      # 'light' | 'dark'

ux:
  accessibility:
    min_contrast_ratio: number  # e.g., 4.5
  anti_patterns: string[]       # Forbidden patterns

constraints:
  layout:
    max_width_px: number        # e.g., 1200
  motion:
    allow_heavy_runtime_animation: boolean
```

---

## Prohibited Access (Red Lines)

| Path | Reason |
|------|--------|
| `knowledge/**` | Knowledge is Skill domain only |
| `_meta/contracts/**` | Global templates are Skill domain only |
| `Skills/**` | Skills write contracts, Builders read contracts |

---

## Builder Permissions

| Action | Allowed |
|--------|---------|
| Read `tracks/<id>/site-design.contract.yaml` | ✅ YES |
| Write UI artifacts | ✅ YES |
| Modify contract | ❌ NO |
| Read other contracts | ❌ NO |
| Access knowledge | ❌ NO |
| Call Skills | ❌ NO |

---

## Intermediate Representation (IR)

Builders consume contracts through an **Adapter** that produces a normalized IR:

```typescript
type SiteDesignIR = {
  site: {
    name: string
    stack: string[]
  }
  theme: {
    colors: {
      primary: string
      background: string
    }
    fonts: {
      primary: string
      heading: string
    }
    mode: 'light' | 'dark'
  }
  layout: {
    maxWidth: number
  }
  constraints: {
    motionAllowed: boolean
  }
  ux: {
    minContrast: number
    forbidden: string[]
  }
}
```

---

## Change Protocol

To modify this interface:

1. Raise an ADR in `docs/adr/`
2. Update `_meta/contracts/site-design.contract.yaml`
3. Update `builders/adapters/site-design.adapter.ts`
4. Update this document
5. Run regression tests on all Builders

**Changes without ADR are violations.**

---

## Compliance Checklist

Before a Builder is considered compliant:

- [ ] Only reads `tracks/<id>/site-design.contract.yaml`
- [ ] Uses Adapter, not raw YAML parsing
- [ ] Never accesses `knowledge/`
- [ ] Never accesses `_meta/contracts/`
- [ ] Never modifies contract
- [ ] Outputs match contract constraints

---
**Frozen**: 2026-01-13
