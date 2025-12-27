# Skill 三层架构宪法
Skill Tri-Layer Architecture Constitution

## §0 立场声明

在 LiYe AI 中，Skill 不是单一概念，而是跨 **人类认知、机器执行、AI 操作** 的复合能力。
任何将 Skill 扁平化处理的设计，都会在规模化阶段产生语义坍塌。

本系统正式冻结 Skill 三层模型。

---

## §1 三层定义（冻结）

### L1 · Methodology Skill（人类知识层）
- 位置：docs/methodology/
- 职责：方法论、判断逻辑、决策框架
- 面向：人类阅读与学习
- 不要求可执行

### L2 · Executable Skill（机器执行层）
- 位置：src/skill/、src/domain/*/skills/
- 职责：可调用、可组合、可调度的能力
- 面向：系统与运行时
- 不包含教学文本

### L3 · Instruction Skill（AI 操作层）
- 位置：.claude/skills/
- 职责：约束 LLM 的角色、步骤与输出
- 面向：Claude / LLM
- 属于实现细节

---

## §2 权威链规则（宪法级）

docs/methodology
→ src/domain/* / src/skill
→ .claude/skills

只允许自上而下依赖，禁止反向引用。

---

## §3 禁止反向依赖

- Claude 指令不能成为方法论来源
- Prompt 中出现的方法论必须上移到 docs/methodology
- 代码不得承担教学职责

违反即视为架构违规。

---

## §4 变更触发机制

当 docs/methodology 发生变更时，必须评估：
- [ ] src/domain/*/skills 是否需要同步
- [ ] .claude/skills 是否需要更新

Instruction Skill 为最低层，不具备裁决权。

---

## §5 冻结声明

自本宪法生效起：
- Skill 不再是单一概念
- 新增能力必须声明所属层级
- 命名必须服务语义，而非历史习惯
