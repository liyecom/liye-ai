# Integration Patch: assembler.mjs

> **Version**: 1.0.0
> **Part of**: Memory as a Product (MaaP) v1.0

## Overview

This document describes how to integrate the Memory as a Product (MaaP) system with the existing `assembler.mjs` context compiler.

## Required Behavior

### 1. Run Memory Bootstrap Before Context Compilation

Before building `.claude/.compiled/context.md`, run:

```bash
node .claude/scripts/memory_bootstrap.mjs "<TASK>"
```

Where `<TASK>` is the current task description or session identifier.

### 2. Include Memory Brief in Compiled Context

Ensure the compiled context includes:

```
.claude/.compiled/memory_brief.md
```

This file should be inserted **after** the Pack loading and **before** the task-specific context.

## Integration Points

### Minimal Insertion Points in assembler.mjs

```javascript
// 1. After reading task prompt (TASK variable ready)
const task = getTaskFromArgs() || "session";

// 2. Run memory bootstrap
import { execSync } from "child_process";
try {
  execSync(`node .claude/scripts/memory_bootstrap.mjs "${task}"`, {
    cwd: process.cwd(),
    stdio: "inherit"
  });
} catch (e) {
  console.warn("[Memory] Bootstrap failed, continuing without memory brief");
}

// 3. Before writing compiled context file
const memoryBrief = safeRead(".claude/.compiled/memory_brief.md");
if (memoryBrief) {
  contextParts.push(memoryBrief);
}
```

## Context Order

The final compiled context should follow this order:

```
1. CLAUDE.md (Kernel)
2. Loaded Packs (based on task keywords)
3. **Memory Brief** (domain glossary + citations)
4. Task-specific context
5. Recent history (if applicable)
```

## Fallback Behavior

If `memory_brief.md` is missing:
1. Assembler must still compile successfully (graceful degradation)
2. Log a warning: `[Memory] Brief not found, skipping`
3. Continue with standard context compilation

## Testing

```bash
# Test memory bootstrap directly
node .claude/scripts/memory_bootstrap.mjs "amazon ppc optimization"

# Verify output
cat .claude/.compiled/memory_brief.md

# Test full assembly
node .claude/scripts/assembler.mjs --task "amazon ppc optimization"
cat .claude/.compiled/context.md | grep "Canonical Glossary"
```

## Schema Validation (Optional Enhancement)

For TypeScript projects, consider adding runtime validation:

```typescript
import { GlossaryFileSchema } from "../src/memory/schema/glossary";

function validateGlossary(path: string): boolean {
  const content = YAML.parse(fs.readFileSync(path, "utf8"));
  const result = GlossaryFileSchema.safeParse(content);
  return result.success;
}
```

## Related Files

| File | Purpose |
|------|---------|
| `.claude/scripts/memory_bootstrap.mjs` | Generates memory brief |
| `.claude/scripts/assembler.mjs` | Context compiler (to be patched) |
| `.claude/config/domain-mapping.yaml` | Domain detection rules |
| `knowledge/glossary/*.yaml` | Canonical glossaries |
