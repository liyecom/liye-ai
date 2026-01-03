# Glossary Drift Detector

> **Priority**: P0 (executes before all domain skills)
> **Phase**: Output Contract Enforcement
> **Version**: 1.0.0

## Purpose

Prevent terminology drift by enforcing that all technical terms in outputs are:
1. Registered in the canonical glossary (loaded via MaaP)
2. Correctly cited with `path + term + version`
3. Version-consistent with the current glossary

**Violation = Compilation Error** (output blocked)

---

## Detection Scope

### Term Patterns

The detector scans for:

| Pattern | Example | Regex |
|---------|---------|-------|
| UPPERCASE acronyms (2-6 chars) | `ACoS`, `ROAS`, `CTR` | `\b[A-Z][A-Za-z]{1,5}\b` |
| camelCase identifiers | `totalACoS`, `adSpend` | `\b[a-z]+[A-Z][a-zA-Z]*\b` |
| snake_case identifiers | `total_acos`, `ad_spend` | `\b[a-z]+_[a-z_]+\b` |
| Glossary tags | `[[ACoS]]`, `{{ROAS}}` | `\[\[([^\]]+)\]\]` or `\{\{([^}]+)\}\}` |
| Inline citations | `(ref: glossary/amazon-advertising.yaml#ACoS)` | `\(ref:\s*[^)]+\)` |

### Exclusion List

Skip detection for:
- Common English words (the, is, are, etc.)
- Standard programming terms (API, URL, HTTP, JSON, etc.)
- File paths and code blocks
- User-quoted content (preserve original)

---

## Validation Rules

### Rule 1: Term Existence

```
FOR each detected_term IN output:
  IF detected_term NOT IN loaded_glossary.terms:
    RAISE GlossaryDriftError(
      term=detected_term,
      reason="UNREGISTERED_TERM",
      action="Add to glossary or use registered synonym"
    )
```

### Rule 2: Citation Required

```
FOR each domain_term IN output:
  IF domain_term IN loaded_glossary.terms:
    IF NOT has_citation(domain_term):
      RAISE GlossaryDriftError(
        term=domain_term,
        reason="MISSING_CITATION",
        action="Add citation: (ref: path#term@version)"
      )
```

### Rule 3: Version Consistency

```
FOR each citation IN output:
  parsed = parse_citation(citation)  # path#term@version
  IF parsed.version != glossary[parsed.term].version:
    RAISE GlossaryDriftError(
      term=parsed.term,
      reason="VERSION_MISMATCH",
      expected=glossary[parsed.term].version,
      found=parsed.version,
      action="Update citation to current version"
    )
```

---

## Error Format

When drift is detected, output is blocked and error is raised:

```
=====================================
GLOSSARY DRIFT DETECTED - OUTPUT BLOCKED
=====================================

Term: ACoAS
Reason: UNREGISTERED_TERM
Location: Line 42, "The ACoAS metric shows..."

Action Required:
  Option A: Add term to glossary
    Path: knowledge/glossary/amazon-advertising.yaml
    Template:
      - concept_id: acoas
        term: ACoAS
        definition: "..."
        formula: "..."
        version: "1.0.0"

  Option B: Use registered synonym
    Similar terms in glossary:
      - ACoS (knowledge/glossary/amazon-advertising.yaml#acos@1.0.0)

=====================================
```

---

## Integration Points

### 1. MaaP Context Injection

The detector reads glossary from Memory Brief:

```javascript
// Loaded automatically via MaaP injection
const loadedGlossary = parseMemoryBrief(context)
  .filter(section => section.type === 'Canonical Glossary')
  .flatMap(section => section.terms);
```

### 2. Output Contract Enforcement

Executes at the final output stage:

```
┌─────────────────┐
│  Agent Output   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Glossary Drift  │◄── Priority: P0
│    Detector     │
└────────┬────────┘
         │
    ┌────┴────┐
    │ Pass?   │
    └────┬────┘
         │
    ┌────┴────┐
   Yes       No
    │         │
    ▼         ▼
┌───────┐  ┌───────────┐
│ Output│  │   ERROR   │
│ Emit  │  │ (blocked) │
└───────┘  └───────────┘
```

### 3. Skill Priority

```yaml
# .claude/config/skill-priority.yaml
enforcement_order:
  - name: glossary-drift-detector
    priority: 0  # Highest (P0)
    phase: output-validation
    blocking: true

  - name: domain-skills
    priority: 10
    phase: content-generation
    blocking: false
```

---

## Configuration

### Strictness Levels

```yaml
# .claude/config/memory-governance.yaml
glossary_drift:
  enabled: true
  strictness: strict  # strict | warn | off

  # strict: block output on any violation
  # warn: log warning but allow output
  # off: disable detection

  exclusions:
    - pattern: "```.*?```"  # Code blocks
      reason: "Code may contain non-glossary identifiers"
    - pattern: "^>"         # Quoted text
      reason: "Preserve user quotes"
```

### Per-Domain Overrides

```yaml
# knowledge/glossary/amazon-advertising.yaml
metadata:
  drift_detection:
    strictness: strict
    require_version_citation: true
    allow_synonyms: false
```

---

## Audit Trail

All drift detections are logged:

```
data/traces/glossary-drift/
├── 2026-01-01_session_001.json
├── 2026-01-01_session_002.json
└── ...
```

Log format:

```json
{
  "timestamp": "2026-01-01T05:30:00Z",
  "session_id": "abc123",
  "domain": "amazon-advertising",
  "violations": [
    {
      "term": "ACoAS",
      "reason": "UNREGISTERED_TERM",
      "location": "line:42",
      "action_taken": "BLOCKED"
    }
  ],
  "glossary_version": "1.0.0",
  "outcome": "BLOCKED"
}
```

---

## Recovery Actions

When drift is detected:

1. **Immediate**: Output blocked, error shown
2. **User Action**:
   - Add term to glossary (preferred)
   - Use existing synonym
   - Mark as `[[PROVISIONAL:term]]` (requires follow-up)
3. **System Action**:
   - Log to audit trail
   - Increment drift counter for domain
   - Trigger glossary review if threshold exceeded

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-01 | Initial implementation |
