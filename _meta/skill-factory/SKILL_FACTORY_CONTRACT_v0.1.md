# Skill Factory Contract (SFC) v0.1

**Status:** ACTIVE
**Scope:** Skill 生产与接入规范（适用于 cc / skill-forge / 外部 Skill 接入）
**Applies To:** LiYe OS 全部 Skill（process / domain / tool）
**Non-Goal:** 本文不定义新的硬规则，不替代 Constitution / Policy

---

## 0. 定位与边界

SFC（Skill Factory Contract）用于把 Skill 从"文档"升级为"可持续制造的能力模块（SOP + 工具包）"。

- **Constitution（硬法）**：不可违反，违者必须阻断
- **Policy（软法）**：默认建议，可解释性 override
- **Skill Playbook（具体打法）**：实现层细节与操作步骤
- **SFC（生产契约）**：规定 Skill 产物的结构、拆分方式与最小可执行要素

> 本合同不新增硬约束；所有硬约束以 Constitution 为准。

---

## 1. Skill 的定义（统一口径）

在 LiYe OS 中：

- **Prompt**：一次性指令（对话级）
- **Command**：常用片段（可复用片段）
- **Skill**：常驻能力模块（SOP + 工具包），可复用、可迭代、可治理、可回溯

Skill 的最小目标是：
**"未来遇到这类事情，系统知道怎么做，并能给出可验证的证据产出。"**

---

## 2. 4 种骨架（Skeleton）——生产时必须先选型

每个 Skill 在创建前必须选择一种骨架；不要混用导致结构发散。

### 2.1 Workflow-based（流程型）
**适用：固定顺序、强步骤依赖的任务**

推荐结构（SKILL.md）：
1) Overview
2) Decision Tree（如有分支）
3) Steps（Step 1..N）
4) Failure & Recovery
5) Verification
6) Outputs / Artifacts

建议目录：
- SKILL.md
- scripts/
- references/
- assets/

---

### 2.2 Task-based（任务菜单型）
**适用：同一领域下多种操作（多个子任务）**

推荐结构（SKILL.md）：
1) Overview
2) Quick Start（最短路径）
3) Task Menu（Task 1..N，每个任务有输入/步骤/输出）
4) Failure & Recovery（共用）
5) Verification（共用）

建议目录：
- SKILL.md
- scripts/（每个 Task 对应可选脚本）
- references/
- assets/

---

### 2.3 Reference / Guidelines（规范型）
**适用：写作规范、代码规范、命名规范、风格标准**

推荐结构（SKILL.md）：
1) Overview
2) Guidelines（可执行规则，避免空话）
3) Specifications（明确约束项）
4) Usage（如何在项目里应用）
5) Anti-patterns（禁止事项）

建议目录：
- SKILL.md
- references/（长文、标准文档）
- assets/（模板）

---

### 2.4 Capabilities-based（能力清单型）
**适用：系统能力集合（如 Product / Research / Growth 等综合技能）**

推荐结构（SKILL.md）：
1) Overview
2) Core Capabilities（能力 1..N）
3) Typical Inputs / Outputs（常见输入输出）
4) Operating Model（如何协作/组合其他技能）
5) Verification & Evidence

建议目录：
- SKILL.md
- references/
- assets/
- scripts/（可选）

---

## 3. Progressive Disclosure（强制：控制 SKILL.md 体积）

### 3.1 主体长度约束
- **SKILL.md 主体建议 ≤ 500 行**
- 超出部分必须下沉到 resources（避免主文档膨胀）

### 3.2 资源拆分约定（统一目录语义）
- **scripts/**：确定性执行逻辑（可重复、可验证）
- **references/**：大块文档 / API / schema / 背景知识
- **assets/**：模板 / boilerplate / 字体 / UI 资产

> 目标：让 SKILL.md 保持"可读、可执行、可导航"，而不是百科全书。

---

## 4. Skill 必填元信息（每个新 Skill 都必须包含）

所有新 Skill 的 SKILL.md 顶部必须包含一段元信息（建议 YAML frontmatter）：

```yaml
---
name: "<skill-name>"
description: "<只写什么时候用，不写流程摘要>"
status: "active"        # active | frozen | deprecated | archived
skeleton: "workflow"    # workflow | task | reference | capabilities
version: "0.1.0"
owner: "cc"             # cc | skill-forge | marketplace | human
scope:
  includes: ["..."]
  excludes: ["..."]
triggers:
  commands: ["/...", "/..."]
  patterns: ["..."]
inputs:
  required: ["..."]
  optional: ["..."]
outputs:
  artifacts: ["..."]    # 产物文件/报告/变更点
failure_modes:
  - symptom: "..."
    recovery: "..."
verification:
  evidence_required: true
  how_to_verify: ["..."]  # 必须给可执行验证或可观察证据
governance:
  constitution: "_meta/governance/SKILL_CONSTITUTION_v0.1.md"
  policy: "_meta/policies/DEFAULT_SKILL_POLICY.md"
---
```

说明：

- **description**：只写"什么时候用"，不要写工作流摘要
- **status**：支持冻结/弃用/归档治理
- **owner**：强制记录来源（可追溯）

---

## 5. 最小可执行要素（Skill 不能只是一篇文章）

每个 Skill 至少要覆盖以下 4 件事：

1. **触发条件（When to use）**：什么时候应该调用它
2. **输入（Inputs）**：最少需要什么信息
3. **失败处理（Failure & Recovery）**：遇到问题怎么回退/恢复
4. **验证证据（Verification）**：完成必须能给出可验证证据

缺任一项，Skill 即退化为"参考文章"，不应作为生产技能接入。

---

## 6. 失败与验证（必须对齐 Constitution 口径）

SFC 不复述硬法，仅做接入要求：

- 所有"完成/修复/通过"必须提供 **证据输出**
- 遇到失败必须进入"修复循环"，直到验证通过
- 连续失败达到阈值必须升级处理（遵循 Constitution 的 stop-loss）

---

## 7. FIXED vs VARIABLE（建议：模板类技能必须标注）

对于模板类/生成类 Skill，建议明确：

- **FIXED（不可修改区）**：布局、结构、强制资源引用、品牌一致性要求
- **VARIABLE（可变区）**：算法、参数、内容区、局部样式

目的：避免产物失控与风格漂移。

---

## 8. Override Protocol（软策略可解释覆盖）

当某条 Policy 默认建议不适用时，允许 override，但必须声明原因：

```yaml
policy_overrides:
  - policy: "<policy-name>"
    reason: "<why override>"
    scope: "<what parts impacted>"
```

只允许 override Policy，不允许 override Constitution。

---

## 9. 质量门槛（SFC 附录：最小检查清单）

在提交/接入一个新 Skill 前，至少自检：

- [ ] SKILL.md ≤ 500 行（否则已下沉 references/）
- [ ] skeleton 已选择且结构一致
- [ ] 有输入/输出/失败恢复/验证证据
- [ ] description 只写触发条件
- [ ] 引用 Constitution / Policy（而不是重复写一遍规则）
- [ ] 产物路径与证据可追溯（artifact/evidence 明确）

---

## 10. 版本策略（轻量）

- **v0.1**：结构合同 + 最小质量门槛
- **v0.2+**：仅在出现大规模结构冲突/迁移需要时再升级版本

---

## 11. 快速落地指南（给 cc / skill-forge）

创建新 Skill 的最短路径：

1. 先选骨架（workflow/task/reference/capabilities）
2. 创建目录：`<skill-dir>/SKILL.md`
3. 写入元信息 frontmatter
4. 主体只写核心流程与关键判断
5. 复杂内容下沉到 `references/`
6. 可复用逻辑下沉到 `scripts/`
7. 明确验证证据（必须可追溯）
