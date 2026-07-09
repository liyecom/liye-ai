# Skill Factory Contract (SFC) v0.2

> Layer 0 制度文档。定版日期 2026-07-03（改革蓝图 v1.1 Phase 1）。
> 本文件定义 SFC v0.2 的 skill frontmatter 形状与兼容规则。与 v0.1（`SKILL_FACTORY_CONTRACT_v0.1.md`）**并存**：v0.1 skill 继续合规，v0.2 是推荐的目标形状。
> 命名澄清：本仓 **SFC = Skill Factory Contract**（LiYe 自研技能工厂契约），**不是** Anthropic 的 "Skill File Convention"。二者是两套约定；v0.2 借鉴 Anthropic 原生 skill 的"轻顶层 frontmatter"惯例，但保留 LiYe 全部治理字段（下沉到 metadata）。

## 0. 为什么有 v0.2

v0.1 把 8 个必填字段（name / description / skeleton / triggers / inputs / outputs / failure_modes / verification）全部平铺在 frontmatter 顶层。两个问题：

- Anthropic 原生 skill loader 只读 `name` + `description`；其余 6 个 LiYe 治理字段对平台是噪声，污染 loader 可见面。
- `description` 被当成"写什么都行"，实践中被塞进整条工作流摘要（如 asin-growth），违背"description 只用于触发判断"的本意。

v0.2 的目标：**平台可见顶层收敛为 Anthropic 标准（name + description [+ version]），LiYe 治理字段整体下沉到 `metadata.liye.*`** —— 治理数据一个不丢，只是换位置。

## 1. v0.2 frontmatter 形状

顶层（平台可见，Anthropic loader 读）：

```yaml
name: <skill-id>
description: "<触发条件：什么时候用 + 范围边界；不写工作流摘要>"
version: "5.0.0"   # 可选；若存在必须留顶层，禁止下沉
```

治理块（LiYe 工具读，平台 loader 忽略）：

```yaml
metadata:
  liye:
    sfc_version: "0.2"
    skeleton: workflow            # workflow | task | reference | capabilities
    triggers:
      commands: ["/asin-growth"]
      patterns: ["优化这个ASIN", "listing优化"]
    inputs: [...]
    outputs: [...]
    failure_modes: [...]
    verification:
      evidence_required: true
      how_to_verify: [...]
    governance: <constitution/policy 路径>
```

## 2. 字段定义

| 字段 | 位置 | 必填 | 说明 |
|---|---|---|---|
| name | 顶层 | 是 | skill 唯一 id |
| description | 顶层 | 是 | 只写触发条件（what + when）+ 范围边界；禁工作流摘要（见 §4） |
| version | 顶层 | 否 | 若存在必须顶层（AGE `test_skill_version_contract` 契约），不得进 metadata |
| sfc_version | metadata.liye | v0.2 skill 是 | 固定 `"0.2"`，标记本 skill 采用 v0.2 形状 |
| skeleton | metadata.liye | 是 | 枚举 {workflow, task, reference, capabilities} |
| triggers | metadata.liye | 是 | commands[] + patterns[] |
| inputs | metadata.liye | 是 | |
| outputs | metadata.liye | 是 | |
| failure_modes | metadata.liye | 是 | |
| verification | metadata.liye | 是 | evidence_required + how_to_verify |
| governance | metadata.liye | 建议 | 指向 constitution / policy 路径 |

## 3. 兼容包络（linter 接受规则）

一个 skill 合规，当且仅当满足以下之一：

- **v0.1 形状**：8 个键（name / description / skeleton / triggers / inputs / outputs / failure_modes / verification）全部在**顶层**。
- **v0.2 形状**：`name` + `description` 在顶层，且 `skeleton / triggers / inputs / outputs / failure_modes / verification`（同样这 6 个）全部在 `metadata.liye.*` 下。

附加约束（两形状都适用）：

- `version` 若存在，必须在顶层，不得下沉到 metadata。
- `skeleton` 值必须属于 {workflow, task, reference, capabilities}。

含义：迁移期 v0.1 与 v0.2 skill 并存，各自合规、**全程双绿**，无需一次性 big-bang；未迁移的 skill 不报错。

## 4. description 规范

description = **触发判断的唯一元数据**，供 Anthropic loader 与人判断"何时调用本 skill"。

- 写：what（这个 skill 做什么，一句）+ when（什么请求该触发它）+ 范围边界（哪些交给别的 skill）。
- 不写：工作流步骤、数据管线、内部机制 —— 那些属正文与 references。
- 反例（v0.1 遗留）：asin-growth 的 description 含"数据 -> 因子 -> 决策 -> compile -> 受控执行 -> D+7 verdict"整条链。v0.2 迁移时必须收敛；因其改变语义触发面，属**行为变更**，需回归验证触发不退化（见 §5 语义部分）。

## 5. 迁移语义（v0.1 -> v0.2）

**机械部分（零行为风险）**：把 6 个治理字段从顶层原样搬进 `metadata.liye.*`，加 `sfc_version: "0.2"`。无任何测试断言这些字段内容（AGE test-coupling 侦察证实）。必须护住：

- 顶层 `version` 不动、不下沉。
- SKILL.md 正文的 anchor 注释与 router -> reference 链接**不在同一 PR 触碰**（AGE PR #522 爆炸半径在正文，不在 frontmatter）。

**语义部分（有行为风险，单独 PR + UAT）**：description 从"含工作流摘要"收敛为"纯触发条件"，改后需验证 skill 触发不漏不误。

## 6. 工具契约

- 单一 SSOT parser：`.claude/scripts/sfc_frontmatter.mjs`（用 yaml 库真解析，非正则），导出 `parseFrontmatter()` 与 `checkCompliance()`；sfc_lint / sfc_ci_gate / sfc_sweep 全部经它判定，不再各自硬编码 REQUIRED_KEYS。
- CI 强制等级维持 **WARNING**（`sfc_ci_gate.mjs --mode warn` 恒 exit 0）。strict 化是 v0.2 全面落地后的独立决定，不随本 spec 生效。
- debt 扫描面排除 `worktrees` / `.planning` / `vendor` 镜像，只统计活跃 canonical skill。

## 7. 退役注记

`.claude/scripts/sfc_skill_router.mjs` 当前是**死代码**（全仓零调用，唯一引用是一份静态分析清单文档）。其 triggers 读取用正则读顶层，与 v0.2 下沉不兼容。**本 spec 不要求修它**；它是 Phase 4 退役候选。若未来复活 router，必须改用 `sfc_frontmatter.mjs` 读 `metadata.liye.triggers`。

## 8. 与其他制度文档的关系

- `SKILL_FACTORY_CONTRACT_v0.1.md` —— 前身形状，继续有效（在兼容包络内）。
- `_meta/governance/CAPABILITY_MODEL.md` —— 五概念定版（Skill 是什么）。
- `_meta/governance/SKILL_PLACEMENT.md` —— placement 教义（skill 放哪）。
- 本文件 —— skill frontmatter 形状（skill 长什么样）。

## 9. 适用范围与豁免（authored / vendored / stub 三分法）

> 2026-07-09 增补（task#5 收窄裁决）。§1-§8 定义 v0.2 的形状；本节定义**哪些 skill 必须采用它**。

SFC v0.2 迁移不是对 `Skills/` 下每个 SKILL.md 无差别强制。按 provenance 分三类，各有不同处置：

### 9.1 authored（LiYe 自研）
带真·LiYe 治理内容、由 LiYe 编写的 skill。**必须**采用 v0.2 形状（6 治理键 + governance 下沉 `metadata.liye.*`，见 §5 机械迁移）。
- 判据：无 upstream 标记（`source:` / `source_url:` / `license:`）**且**治理字段是针对本 skill 的真实内容（非机器脚手架样板）。
- 示例：`github-digest`（真实 failure_modes + 解析到真路径的 verification + resolve 的 governance 指针）。

### 9.2 vendored（第三方 upstream）
从外部（Anthropic / awesome-claude-skills 等）vendored 进来的第三方 skill，带 `source:` / `source_url:` / `license:` upstream 标记。**豁免** v0.2 迁移，保持 upstream 形态。
- 理由：这些是可被上游更新的 vendored 副本。加 `metadata.liye.*` 会 diverge upstream、令未来 re-vendor 每次冲突；且第三方通用工具没有 LiYe 专属治理语义可诚实编码，强加即复刻空壳反模式。
- 示例：pdf / docx / pptx / xlsx / canvas-design / mcp-builder / playwright 等（16 个）。

### 9.3 stub（脚手架空壳，triage-required）
既无 upstream 标记、又无真·LiYe 治理内容的机器脚手架空壳（`# SFC v0.1 Required Fields` 注释 + 样板 failure_modes + 未解析占位）。**不 lift，且不算 vendored exemption**——不得借豁免洗白。
- 处置：另开独立 live recon，判定**删除**（若死代码 / 无消费者，比照已删 amazon-ad-optimization）或**真 authoring**（若确为所需 skill）。triage 结论落地前保持隔离，不进 v0.2 迁移批次。
- 示例：`ui-ux-pro-max`（markers 被剥 + 样板治理 + `outputs: ["SKILL.md"]` + 残缺 description）。

### 9.4 顶层键保留规则
liye_os `Skills/` 的 SKILL.md 比 AGE skill 多携带分类/registry 与 provenance 键。v0.2 down-sink **只**搬 6 治理键（skeleton / triggers / inputs / outputs / failure_modes / verification）+ governance 进 `metadata.liye.*`；以下键**保持顶层不下沉**：
- 分类/registry：`domain` / `category` / `status`（liye_os 目录与状态语义，非 SFC 治理键）。
- provenance：`source` / `source_url` / `license`（vendored 溯源，下沉会破坏 §9.2 的标记识别）。
- `version`：按 §2 顶层例外，不下沉。

### 9.5 future strict 只写原则、不预定实现
§6 的 strict-v0.2 化仍是「v0.2 全面落地后独立决定」。届时若 flip strict：**必须 honor** 本节的 vendored 豁免（§9.2）与 stub 隔离（§9.3）——vendored / stub 不得因 strict 化被误判为债。
- 具体的识别与跳过机制**留待 strict PR 按本政策实现**，本文件不预先规定。`source:` 标记识别已被 stub（§9.3，markers 被剥仍非 authored）证明单独不可靠；strict 实现须结合 provenance 标记与「有无真治理内容」双判据，不能只靠 marker。

---
*SFC v0.2 · 2026-07-03 定版 · §9 适用范围与豁免 2026-07-09 增补 · LiYe 改革蓝图 Phase 1 / task#5*
