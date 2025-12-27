## 🧠 Skill 三层模型 · PR 审查清单

> 本项目采用 **Skill 三层架构模型（已宪法级冻结）**。
> 所有 PR 必须通过以下自检，否则视为架构违规。

---

### ✅ 基本信息

- PR 类型：
  - [ ] 新增 Skill
  - [ ] 修改现有 Skill
  - [ ] 新增 / 修改 Agent
  - [ ] 文档 / 架构调整
  - [ ] 其他（请说明）

---

## 🔹 L1 · Methodology Skill（人类知识层）
**位置：`docs/methodology/`**

- [ ] 本 PR 是否修改 / 新增方法论内容？
- [ ] 内容是否 **仅包含** 思维框架、判断逻辑、决策原则？
- [ ] 是否 **未包含** Prompt、Claude 指令或代码实现？
- [ ] 如果方法论发生变化，是否已评估下游影响：
  - [ ] `src/skill/` 或 `src/domain/*/skills`
  - [ ] `.claude/skills/`

---

## 🔹 L2 · Executable Skill（机器执行层）
**位置：`src/skill/`、`src/domain/*/skills/`**

- [ ] 本 PR 中的代码是否 **只关注可执行能力**？
- [ ] 是否 **未包含** 教学性文本或方法论解释？
- [ ] 是否明确输入 / 输出边界？
- [ ] 是否避免在代码中"重新定义"业务方法论？

---

## 🔹 L3 · Instruction Skill（AI 操作层）
**位置：`.claude/skills/`**

- [ ] 本 PR 是否修改 Claude Skill？
- [ ] 是否仅包含 **角色、步骤、输出格式、注意事项**？
- [ ] 是否 **未引入新的判断规则或方法论**？
- [ ] 是否确认该内容为 **实现细节，而非知识源**？

---

## 🔗 权威链校验（必选）

```text
docs/methodology
        ↓
src/skill / src/domain/*
        ↓
.claude/skills
```

- [ ] 本 PR 是否严格遵守 **自上而下依赖**？
- [ ] 是否不存在 Claude → 方法论 的反向定义？
- [ ] 是否不存在代码 → 方法论 的隐性裁决？

---

## 🚨 架构违规快速自检（红线）

- [ ] 是否在 `.claude/skills/` 中新增了"规则 / 原则 / 判断标准"？（❌）
- [ ] 是否在 `src/skill/` 中写入了教学性方法论？（❌）
- [ ] 是否出现 Skill 层级混用、职责漂移？（❌）

> **任一项为 Yes，必须在合并前整改。**

---

## 📌 参考文档（权威）

- `docs/architecture/SKILL_CONSTITUTION.md`
- README → 🧠 Skill 三层模型

---

## ✍️ 提交者确认

- [ ] 我已阅读并理解 Skill 三层架构宪法
- [ ] 本 PR 不破坏已冻结的架构边界
