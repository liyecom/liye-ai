# Role Metadata Specification

> **Version**: 1.0 (Draft)
> **Status**: Reserved Interface
> **Created**: 2025-12-28

---

## Overview

Role Metadata 是 LiYe OS Roles 层的前瞻性设计，为未来扩展预留接口位。

**当前状态**：已实现解析，但未启用功能逻辑。
**设计目的**：一年后可能需要的能力，现在预留接口。

---

## Metadata Format

```yaml
---
name: backend-developer
tags: [backend, api, database, rest]
confidence: high | medium | low
source: VoltAgent | BMad | Custom
priority: 1-10
---
```

### Fields

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | string | (从路径推断) | 角色唯一标识 |
| `tags` | string[] | [] | 语义标签，用于匹配和分类 |
| `confidence` | enum | medium | 角色可靠性等级 |
| `source` | string | VoltAgent | 来源标识 |
| `priority` | number | 5 | 冲突裁决优先级 (1-10) |

---

## Future Use Cases

### 1. Role Ranking

当多个 Role 匹配时，按 `confidence` 和 `priority` 排序：

```javascript
// 未来实现
roles.sort((a, b) => {
  const confOrder = { high: 3, medium: 2, low: 1 };
  return (confOrder[b.confidence] - confOrder[a.confidence])
    || (b.priority - a.priority);
});
```

### 2. Multi-Role Conflict Resolution

当匹配到冲突角色时（如 backend-developer vs fullstack-developer），根据 `priority` 裁决：

```javascript
// 未来实现
if (hasConflict(roleA, roleB)) {
  return roleA.priority > roleB.priority ? roleA : roleB;
}
```

### 3. LLM Switch / Prompt Weight

不同 LLM 可能需要不同的 Role 配置：

```yaml
---
name: backend-developer
llm_weights:
  claude: 1.0
  gpt4: 0.8
  gemini: 0.7
---
```

### 4. Enterprise Governance

企业版白名单 / 灰度控制：

```yaml
---
name: security-auditor
governance:
  whitelist: [team-security, team-infra]
  graylist: [team-dev]
  blacklist: [team-intern]
---
```

---

## Current Implementation

### Parser Location

`.claude/scripts/assembler.mjs` → `parseRoleMetadata()`

### Output Format

编译后的上下文包含 HTML 注释形式的 metadata：

```markdown
## Remote Role: backend-developer

<!-- Role Metadata: confidence=medium, source=VoltAgent, priority=5 -->

[Role Content...]
```

---

## Compatibility

- **向后兼容**：没有 frontmatter 的 Role 使用默认值
- **向前兼容**：未知字段被忽略
- **无破坏性**：metadata 不影响 Claude 理解 Role 内容

---

## Migration Path

### Phase 1: Reserved (Current)
- 解析 metadata，不使用
- 收集 `loadedRolesMetadata` 数组

### Phase 2: Ranking (Future)
- 启用 Role Ranking
- 根据 confidence/priority 排序

### Phase 3: Governance (Future)
- 添加企业版治理字段
- 白名单/灰度控制

---

## Related Documents

- `AGENT_SPEC.md` - LiYe OS Agent 规范（不同概念）
- `SKILL_SPEC.md` - LiYe OS Skill 规范
- `.claude/scripts/assembler.mjs` - 上下文编译器实现

---

**END OF SPEC**
