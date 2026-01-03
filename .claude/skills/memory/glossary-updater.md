# Glossary Updater

> **Version**: 1.0.0
> **Part of**: Memory as a Product (MaaP) v1.0

## Objective

Apply confirmed corrections to the glossary YAML files and regenerate the memory brief.

## Input

From `correction-detector.md`:
- Target glossary file path
- Proposed change (ADD or UPDATE)
- New version number
- Change details

## Procedure

### Step 1: Validate Schema

Ensure the change conforms to the glossary schema:

```typescript
// src/memory/schema/glossary.ts
ConceptSchema = {
  concept_id: string (min 3 chars),
  version: string (v1.0.0 format),
  domain: string,
  name: string,
  aliases: string[],
  definition: string,
  formula?: string,
  examples: string[],
  pitfalls: string[],
  relations: Relation[],
  owner?: string,
  updated_at: string (ISO timestamp)
}
```

### Step 2: Apply Edit

Apply the change to the YAML file:

```yaml
# For UPDATE:
- Locate concept by concept_id
- Update only changed fields
- Bump version
- Set updated_at to current timestamp

# For ADD:
- Append new concept to concepts array
- Set initial version (v1.0)
- Set updated_at to current timestamp
```

### Step 3: Regenerate Memory Brief

After updating the glossary, regenerate the memory brief:

```bash
node .claude/scripts/memory_bootstrap.mjs "<CURRENT_TASK>"
```

### Step 4: Verify and Report

Verify the change was applied correctly:

```markdown
✅ Glossary updated successfully

**File**: knowledge/glossary/amazon-advertising.yaml
**Concept**: ACoS
**Version**: v1.0 → v1.0.1
**Change**: Definition clarified

**Citation for future use**:
(ref: knowledge/glossary/amazon-advertising.yaml, ACoS, v1.0.1)
```

## Output Contract

After update, provide:
1. Final YAML snippet (the updated concept)
2. Citation format for downstream responses
3. Confirmation that memory brief was regenerated

## Error Handling

| Error | Action |
|-------|--------|
| Schema validation failed | Show error, ask for correction |
| File not found | Create new glossary file |
| Concept not found (for UPDATE) | Suggest ADD instead |
| Parse error | Backup file, show raw diff |

## Changelog Entry

Every update must add a changelog entry:

```yaml
# In the glossary file
_meta:
  changelog:
    - date: "2026-01-01"
      version: "v1.0.1"
      change: "ACoS definition clarified per user correction"
      author: "Claude + LiYe"
```

## Related Skills

- `session-start-enhanced.md`: Loads updated glossary
- `correction-detector.md`: Triggers the update flow
