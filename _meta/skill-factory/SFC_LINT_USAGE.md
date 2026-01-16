# SFC Lint Usage

**Script**: `.claude/scripts/sfc_lint.mjs`
**Mode**: WARNING-only (不阻断，仅提示)

---

## 运行方式

```bash
node .claude/scripts/sfc_lint.mjs <skill_dir>
```

**示例**:
```bash
# 检查某个 Skill 目录
node .claude/scripts/sfc_lint.mjs Skills/00_Core_Utilities/meta/skill-creator

# 检查模板目录
node .claude/scripts/sfc_lint.mjs _meta/skill_template
```

---

## 检查项

| # | 检查项 | 严重程度 |
|---|--------|----------|
| 1 | SKILL.md 是否存在 | WARNING |
| 2 | SKILL.md 行数是否 > 500 | WARNING |
| 3 | YAML frontmatter 是否存在 | WARNING |
| 4 | frontmatter 必填键是否齐全 | WARNING |
| 5 | skeleton 是否属于有效值 | WARNING |

**必填键**: `name`, `description`, `skeleton`, `triggers`, `inputs`, `outputs`, `failure_modes`, `verification`

**有效 skeleton**: `workflow` | `task` | `reference` | `capabilities`

---

## 输出示例

**通过**:
```
✅ SFC Lint PASS (no warnings)
Skill Dir: /path/to/skill
```

**有警告**:
```
⚠️ SFC Lint WARNINGS
Skill Dir: /path/to/skill
- Frontmatter missing required key: triggers
- Frontmatter missing required key: failure_modes

Suggested Fix (minimal):
1) Ensure SKILL.md exists
2) Add YAML frontmatter with required keys
3) Keep SKILL.md <= 500 lines; move long parts to references/
4) Use skeleton in: workflow/task/reference/capabilities
```

---

## 注意事项

- 输出仅 WARNING，**不会阻断** (exit code 始终为 0)
- 用于开发时自检，不接入 pre-commit hook
- 如需强制合规，可集成到 CI 流程并修改 exit code
