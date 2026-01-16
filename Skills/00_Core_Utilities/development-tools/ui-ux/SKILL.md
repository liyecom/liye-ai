---
name: ui-ux
description: SFC patched skill. Use when "ui-ux" is relevant.

# SFC v0.1 Required Fields
skeleton: "reference"
triggers:
  commands: ["/ui-ux"]
  patterns: ["ui-ux"]
inputs:
  required: []
  optional: []
outputs:
  artifacts: ["SKILL.md"]
failure_modes:
  - symptom: "Missing required inputs or context"
    recovery: "Provide the missing info and retry"
  - symptom: "Unexpected tool/runtime failure"
    recovery: "Rerun with minimal steps; escalate after 3 failures"
verification:
  evidence_required: true
  how_to_verify: ["node .claude/scripts/sfc_lint.mjs <skill_dir>"]
governance:
  constitution: "_meta/governance/SKILL_CONSTITUTION_v0.1.md"
  policy: "_meta/policies/DEFAULT_SKILL_POLICY.md"
---

# UI/UX Pro Max Skill

> **Version**: 1.0.0
> **Source**: Fork from [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
> **License**: MIT

---

## Module 01: Skill Identity

### Core Mission
Provide AI-assisted design intelligence for UI/UX decisions, enabling developers to create professional-grade interfaces without deep design expertise.

### Value Proposition
- **58+ UI styles** with compatibility and performance ratings
- **95+ color palettes** categorized by industry
- **56+ typography pairings** with Google Fonts integration
- **24+ chart types** with accessibility guidance
- **98+ UX guidelines** for common anti-patterns

### Applicable Scenarios
- Creating new website/app designs
- Filling `site-design.contract.yaml` for Builder system
- Choosing color schemes for specific industries
- Selecting typography for brand identity
- Evaluating UX compliance

### Boundaries
- Does NOT generate code directly (use Builder for that)
- Does NOT make aesthetic judgments (provides options, user decides)
- Does NOT replace professional design review for production

---

## Module 02: Capability Model

| Capability | Description | Proficiency |
|------------|-------------|-------------|
| **Style Discovery** | Find UI styles matching requirements | High |
| **Color Recommendation** | Suggest palettes by industry/mood | High |
| **Typography Pairing** | Match fonts for heading/body | High |
| **Chart Selection** | Choose visualization types for data | Medium |
| **UX Audit** | Identify anti-patterns and issues | Medium |
| **Stack Guidelines** | Framework-specific best practices | Medium |

---

## Module 03: Mental Models

### BM25 Ranking
Search uses BM25 algorithm for relevance scoring:
- TF-IDF weighting for term importance
- Document length normalization
- Query term frequency saturation

### Domain Detection
Auto-detects search domain from keywords:
- "color", "palette" → color domain
- "SaaS", "dashboard" → product domain
- "font", "typography" → typography domain

---

## Module 04: Methods & SOPs

### SOP: Contract-Driven Design

**Phase 1: Discover Style**
```bash
python scripts/search.py "modern SaaS dashboard" --domain style
```

**Phase 2: Select Colors**
```bash
python scripts/search.py "SaaS enterprise" --domain color
```

**Phase 3: Choose Typography**
```bash
python scripts/search.py "professional tech" --domain typography
```

**Phase 4: Generate Contract**
Use results to fill `site-design.contract.yaml`:
```yaml
tokens:
  colors:
    primary: "#3B82F6"      # From color search
    background: "#FFFFFF"
  typography:
    primary_font: "Inter"    # From typography search
    heading_font: "Poppins"
```

**Phase 5: Run Builder**
```bash
npx tsx builders/theme-factory/builder.ts <track-id>
```

---

## Module 05: Execution Protocols

### Pre-Checklist
- [ ] User has described target audience
- [ ] User has specified industry/domain
- [ ] User has indicated mood/tone preference

### Decision Logic
```
IF industry specified → search color with industry keyword
ELIF mood specified → search style with mood keyword
ELSE → search product with general keyword
```

### Quality Standards
- Always provide 3+ options for user choice
- Include accessibility ratings in recommendations
- Note performance implications for complex styles

---

## Module 06: Output Structure

### Style Recommendation Template
```markdown
## Recommended Style: [Style Name]

**Why this style:**
- [Reason 1]
- [Reason 2]

**Colors:**
- Primary: [hex] - [usage]
- Background: [hex] - [usage]

**Typography:**
- Heading: [font name]
- Body: [font name]

**Performance:** [rating]
**Accessibility:** [rating]
```

---

## Module 07: Templates & Prompts

### Activation Prompt
```
Search UI/UX Pro Max for design recommendations:
- Industry: [specify]
- Style preference: [modern/classic/playful/professional]
- Color mood: [warm/cool/vibrant/muted]
```

### Quick Start
```bash
# Find styles for SaaS
python scripts/search.py "SaaS modern" --domain style

# Find colors for healthcare
python scripts/search.py "healthcare trust" --domain color

# Find typography for tech startup
python scripts/search.py "startup tech" --domain typography
```

---

## Module 08: Tools Access

### Required Tools
- Python 3.x (no external dependencies)
- CSV data files in `data/` directory

### Knowledge Assets
| Asset | File | Records |
|-------|------|---------|
| Styles | `styles.csv` | 58 |
| Colors | `colors.csv` | 95 |
| Typography | `typography.csv` | 56 |
| Charts | `charts.csv` | 24 |
| UX Guidelines | `ux-guidelines.csv` | 98 |
| Icons | `icons.csv` | 100 |

### Integration Points
- Builder system reads Contract, this Skill helps write Contract
- Assembler can trigger this Skill via keywords

---

## Module 09: Evaluation & Scoring

### Output Quality Metrics
- Relevance: Does recommendation match user intent?
- Completeness: Are all required fields covered?
- Actionability: Can user directly use in Contract?

### Pass Criteria
- At least 1 relevant result per search
- Accessibility rating provided
- Performance impact noted

---

## Module 10: Feedback & Evolution

### Evolution Triggers
- New UI style trends emerge
- Framework compatibility changes
- User feedback on missing categories

### Version History
| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-14 | Initial fork from UI UX Pro Max |

### Upstream Sync
```bash
# Check for updates
cd /tmp && git clone --depth 1 https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git
# Compare data/ directory
```
