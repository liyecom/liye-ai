---
name: skill-creator
description: Claude Skills 创建指南与最佳实践
domain: 00_Core_Utilities
category: meta
version: 1.0.0
status: active
source: awesome-claude-skills
source_url: https://github.com/ComposioHQ/awesome-claude-skills
license: Apache-2.0
---

# Skill Creator

> **来源**: ComposioHQ/awesome-claude-skills
> **适配**: LiYe OS 三层架构

提供创建 Claude Skills 的完整指导，包括专业知识封装、工作流设计、工具集成等。

## When to Use This Skill

当需要创建新的 Claude 技能时：
- 设计技能结构和范围
- 编写 SKILL.md 规范文件
- 组织脚本和模板
- 遵循最佳实践
- 发布和维护技能

## Core Capabilities

### 1. 技能结构设计

**标准目录结构**：
```
skill-name/
├── SKILL.md          # 必须：技能定义文件
├── scripts/          # 可选：辅助脚本
├── templates/        # 可选：文档模板
└── references/       # 可选：参考资料
```

### 2. SKILL.md 编写规范

**必须包含的 Frontmatter**：
```yaml
---
name: skill-name
description: 清晰描述技能功能
domain: 所属域
version: 1.0.0
status: active | draft | deprecated
---
```

**必须包含的章节**：
- **When to Use This Skill**: 明确使用场景
- **Core Capabilities**: 核心能力列表
- **Usage Examples**: 真实使用示例
- **Dependencies**: 依赖项说明

### 3. LiYe OS 三层适配

在 LiYe OS 中创建技能需要考虑三层架构：

**L1 方法论层** (docs/methodology/):
```markdown
# skill_definition.md - 10 模块结构
1. Skill Identity
2. Capability Model
3. Mental Models
4. Methods & SOPs
5. Execution Protocols
6. Output Structure
7. Templates
8. Tools Access
9. Evaluation
10. Evolution
```

**L2 可执行层** (src/skill/atomic/):
```typescript
// index.ts
export const skill: Skill = {
  id: 'skill-name',
  name: 'Skill Name',
  execute: async (input) => { ... }
};

// spec.yaml
id: skill-name
type: atomic
input: { ... }
output: { ... }
```

**L3 指令层** (.claude/skills/):
```markdown
# SKILL.md - 简洁的使用指导
针对 Claude 的操作指令
```

### 4. 最佳实践

- **单一职责**: 每个技能专注一个明确目标
- **清晰边界**: 明确说明何时使用/不使用
- **丰富示例**: 提供真实场景的使用案例
- **版本管理**: 使用 SemVer 版本号
- **持续演进**: 维护 evolution_log.md

### 5. 发布流程

1. 在 99_Incubator 开发和测试
2. 完成所有必需文件
3. 通过验证清单
4. 迁移到正式域
5. 更新索引文件

## Usage Examples

### 示例 1: 创建数据分析技能
```
用户: 帮我创建一个 Amazon 广告分析技能
Claude: [使用 skill-creator 技能设计结构、生成模板文件]
```

### 示例 2: 从文档生成技能
```
用户: 把这个 API 文档转换成 Claude 技能
Claude: [使用 skill-creator 技能提取关键信息、生成 SKILL.md]
```

### 示例 3: 评审现有技能
```
用户: 检查这个技能是否符合规范
Claude: [使用 skill-creator 技能对照最佳实践进行评审]
```

## Dependencies

无外部依赖，纯知识型技能。

## LiYe OS Integration

### 业务域引用
此技能被以下业务域引用：
- **99_Incubator**: 技能孵化（主域）

### 相关资源
- 技能规范: `/docs/architecture/SKILL_SPEC.md`
- 技能模板: `/_meta/skill_template/`
- Skill Forge 工具: `.claude/skills/skill-forge/`

### 三层架构位置
- **物理层 (本文件)**: Skills/00_Core_Utilities/meta/skill-creator/
- **逻辑层索引**: Skills/{domain}/index.yaml
- **L3 指令层**: .claude/skills/{domain}/skill-creator/

---
**Created**: 2025-12-28 | **Adapted for LiYe OS**
