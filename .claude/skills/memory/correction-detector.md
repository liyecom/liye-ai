# Correction Detector

> **Version**: 1.0.0
> **Part of**: Memory as a Product (MaaP) v1.0

## Objective

Detect when the user corrects a concept/definition/decision and trigger the knowledge crystallization flow.

## Trigger Signals

Detect these patterns in user messages (Chinese or English):

| Language | Signals |
|----------|---------|
| Chinese | "不对", "你理解错了", "应该是", "不是这样", "纠正一下", "你忘了", "错了" |
| English | "that's wrong", "incorrect", "actually it's", "you misunderstood", "let me correct" |

## Procedure

### Step 1: Acknowledge Correction

Acknowledge the correction plainly and professionally:

```
感谢纠正。我理解错误了。请确认正确的定义/决策是什么？
```

### Step 2: Gather Correct Information

If user hasn't provided the correct definition, ask for it:

```
请提供正确的定义/公式/决策，我将更新到规范术语表中。
```

### Step 3: Generate Proposed Patch

Generate a proposed change as a diff:

```yaml
# Proposed Patch
file: knowledge/glossary/amazon-advertising.yaml
action: UPDATE  # or ADD
concept_id: acos
changes:
  old_version: v1.0
  new_version: v1.0.1  # PATCH bump for clarification
  field: definition
  old_value: "..."
  new_value: "..."
  reason: "User correction - [brief reason]"
```

### Step 4: Fast Confirm

Present the patch and ask for fast confirmation:

```
以下是拟变更内容：

[diff content]

请回复：
- `YES` - 应用变更
- `EDIT: [修改内容]` - 修改后应用
- `NO` - 取消
```

## Version Bump Rules

| Change Type | Bump | Example |
|-------------|------|---------|
| Clarification (wording) | PATCH | v1.0 → v1.0.1 |
| Formula correction | MINOR | v1.0 → v1.1 |
| Complete redefinition | MAJOR | v1.0 → v2.0 |

## Non-negotiable Rules

1. **Never overwrite SSOT silently** - Always get user confirmation
2. **Audit trail required** - Every correction must be logged
3. **Version control** - All changes must bump version appropriately

## Related Skills

- `session-start-enhanced.md`: Loads glossary at session start
- `glossary-updater.md`: Applies the confirmed patch
