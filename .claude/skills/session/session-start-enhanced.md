# Session Start Enhanced (Memory as a Product)

> **Version**: 1.0.0
> **Part of**: Memory as a Product (MaaP) v1.0

## Objective

On every new session/task, bootstrap canonical memory and enforce citation contract.

## Trigger

- Every new Claude Code session start
- Every new task that requires domain knowledge

## Procedure

### Step 1: Bootstrap Memory

Run the memory bootstrap script with the current task:

```bash
node .claude/scripts/memory_bootstrap.mjs "<TASK>"
```

### Step 2: Load Memory Brief

Ensure `.claude/.compiled/memory_brief.md` is included in the final compiled context.

The assembler should automatically include this file after running the bootstrap.

### Step 3: Pre-Action Memory Check

Before giving definitions/metrics/decisions, perform a "Memory Check":

| Situation | Action |
|-----------|--------|
| SSOT exists in glossary | Cite it: `(ref: path, term, version)` |
| SSOT exists in ADR | Cite it: `(ref: path, section)` |
| SSOT missing | Propose patch (do not guess) |

## Output Contract

**MUST** include citations for:
- **Definitions**: glossary path + term + version
- **Metrics**: glossary path + formula reference
- **Decisions**: ADR file path + section

## Example Citation

```markdown
ACoS (Advertising Cost of Sales) = 广告花费 ÷ 广告销售额 × 100%
(ref: knowledge/glossary/amazon-advertising.yaml, ACoS, v1.0)
```

## Fallback

If memory_brief.md is missing or malformed:
1. Log warning
2. Continue with graceful degradation
3. Prompt user to run bootstrap manually

## Related Skills

- `correction-detector.md`: Detects when user corrects a concept
- `glossary-updater.md`: Updates glossary after correction
