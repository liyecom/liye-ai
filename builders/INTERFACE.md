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
- [ ] Generates `build-manifest.json` alongside artifacts

---

## Build Manifest Specification (v1.1)

Builders SHOULD output a `build-manifest.json` alongside generated artifacts.
This manifest enables version tracking, GDP integration, and artifact registry.

### Output Location

```
themes/sites/{site-id}/build-manifest.json
```

### Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["version", "site_id", "generated_at", "artifacts", "contract_hash"],
  "properties": {
    "version": {
      "type": "string",
      "description": "Manifest schema version",
      "const": "1.0"
    },
    "site_id": {
      "type": "string",
      "description": "Site identifier matching _registry.yaml"
    },
    "generated_at": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 build timestamp"
    },
    "contract_hash": {
      "type": "string",
      "description": "SHA256 hash of source contract (for change detection)"
    },
    "builder_version": {
      "type": "string",
      "description": "Builder tool version"
    },
    "artifacts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["file", "type", "size_bytes"],
        "properties": {
          "file": { "type": "string" },
          "type": { "enum": ["css", "json", "html", "js"] },
          "size_bytes": { "type": "integer" }
        }
      }
    },
    "theme": {
      "type": "object",
      "description": "Theme summary extracted from contract",
      "properties": {
        "primary_color": { "type": "string" },
        "mode": { "enum": ["light", "dark"] }
      }
    }
  }
}
```

### Example

```json
{
  "version": "1.0",
  "site_id": "timomats",
  "generated_at": "2026-01-15T14:30:00Z",
  "contract_hash": "sha256:a1b2c3...",
  "builder_version": "1.0.0",
  "artifacts": [
    { "file": "theme.css", "type": "css", "size_bytes": 1024 },
    { "file": "tailwind.config.js", "type": "js", "size_bytes": 512 }
  ],
  "theme": {
    "primary_color": "#2563EB",
    "mode": "light"
  }
}
```

### Usage

1. **Version Tracking**: Compare `contract_hash` to detect stale builds
2. **GDP Integration**: Manifest provides metadata for analytics dashboards
3. **Artifact Registry**: `artifacts` array enables npm/CDN distribution
4. **Build Verification**: CI can validate manifest existence and schema

---

**Frozen**: 2026-01-13 (v1.0) | Extended: 2026-01-15 (v1.1 - build-manifest)
