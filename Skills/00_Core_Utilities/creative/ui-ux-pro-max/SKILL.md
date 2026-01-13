---
name: ui-ux-pro-max
description: Translate human UI/UX requirements into site-design.contract.yaml
domain: 00_Core_Utilities
category: creative
version: 1.0.0
status: active
---

# UI/UX Pro Max Skill

> **Sole Responsibility**: Translate human UI/UX requirements into `tracks/<track_id>/site-design.contract.yaml`

This Skill acts as a **translator** between human design intent and machine-executable contracts. It does NOT generate UI, pages, components, or styles.

## Inputs (Required)

| Input | Description | Examples |
|-------|-------------|----------|
| `project_type` | Site category | saas, landing, docs, blog, dashboard |
| `audience` | Target users | b2b, b2c, developer, enterprise |
| `brand_keywords` | Design tone descriptors | modern, minimal, professional, playful |
| `stack` | Technical stack | astro, react, tailwind, next |

## Output (Sole)

```
tracks/<track_id>/site-design.contract.yaml
```

Contract must:
- Pass `python _meta/governance/validator.py`
- Be consumable by Builders without modification

## Knowledge Reference (Read-Only)

```
knowledge/design/ui-ux/
├── ui_styles.yaml        # Style patterns (minimalism, glassmorphism, etc.)
├── color_schemes.yaml    # Color palettes by product type
├── font_pairings.yaml    # Typography combinations
├── chart_types.yaml      # Data visualization guidance
└── ux_guidelines.yaml    # UX patterns and anti-patterns
```

### Lookup Strategy

1. Match `brand_keywords` → `ui_styles.yaml` (find matching style)
2. Match `project_type` → `color_schemes.yaml` (find base palette)
3. Match style keywords → `font_pairings.yaml` (select typography)
4. Cross-check `ux_guidelines.yaml` for anti-patterns

## Prohibited Actions

| Action | Reason |
|--------|--------|
| Generate UI/pages/components | Builder responsibility |
| Modify contract schema | Schema is frozen |
| Read Builder feedback | One-way data flow (Skill → Builder) |
| Treat knowledge as SSOT | Knowledge is reference, Constitution is SSOT |

## Contract Generation Process

### Step 1: Parse Inputs

Extract structured requirements from user description:

```
"Build a dark-mode SaaS dashboard for developers"
→ project_type: saas
→ audience: developer
→ brand_keywords: [dark, tech, minimal]
→ stack: [to be specified]
```

### Step 2: Query Knowledge

```yaml
# From ui_styles.yaml (brand_keywords: dark, tech)
matched_style: dark_mode_oled
  primary_colors: ["#000000", "#121212"]
  effects: [minimal-glow, high-readability]

# From color_schemes.yaml (project_type: saas)
matched_scheme: developer_tools
  primary: "#3B82F6"
  background: "#0F172A"

# From font_pairings.yaml (keywords: tech, developer)
matched_pairing: developer_mono
  heading: JetBrains Mono
  body: IBM Plex Sans
```

### Step 3: Generate Contract

Write to `tracks/<track_id>/site-design.contract.yaml`:

```yaml
version: "1.0"
kind: site-design
scope: track-instance
enforcement: warning

inherits:
  from: _meta/contracts/site-design.contract.yaml

site:
  name: <track_id>
  stack: [user-specified]

tokens:
  colors:
    primary: "#3B82F6"
    background: "#0F172A"
    # ... (derived from knowledge)
  typography:
    primary_font: "IBM Plex Sans"
    heading_font: "JetBrains Mono"
    # ...

style:
  allowed_modes: [dark]
  default_mode: dark

ux:
  accessibility:
    min_contrast_ratio: 4.5
  anti_patterns:
    - confirm_shaming
    - forced_popup
```

### Step 4: Validate

```bash
python _meta/governance/validator.py
```

## Usage Examples

### Example 1: SaaS Dashboard

**Input:**
```
Create design contract for a B2B SaaS analytics dashboard.
Modern, professional, dark mode preferred.
Stack: Astro + Tailwind
Track: analytics-dashboard
```

**Output:** `tracks/analytics-dashboard/site-design.contract.yaml`

### Example 2: Landing Page

**Input:**
```
Design contract for a wellness app landing page.
Calm, organic, light colors.
Stack: Next.js + Tailwind
Track: wellness-landing
```

**Output:** `tracks/wellness-landing/site-design.contract.yaml`

## Integration Notes

- **Builders** consume `tracks/<track_id>/site-design.contract.yaml` (read-only)
- **Validators** verify contracts against `_meta/schemas/contracts.schema.json`
- **CI Gates** block builds if contracts are invalid

## Stop Rule

This skill MUST stop execution once a valid `site-design.contract.yaml` has been generated and validated.

The skill MUST NOT:
- Iterate on visual quality
- Refine aesthetics
- Generate UI components or layouts
- Optimize design beyond contract scope

---
**Created**: 2026-01-13 | **Version**: 1.0.0
