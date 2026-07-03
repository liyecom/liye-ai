---
name: github-digest
description: 研究一个**已知的** GitHub 项目/repo，判断它对 LiYe Systems 的进化有没有可借鉴之处，产出定型的 evolution-recon 报告并归档到 recon-log。Use whenever the user gives a specific GitHub repo URL and asks to 研究/研读/消化/digest/study it, wants to know whether a project 对 LiYe / AGE / loamwise 有没有帮助/可借鉴/值得参考, asks "这个项目对我们有没有用", floats "看看 <repo> 有没有能学的", or types /github-digest — even if they never name the report format. This is the KNOWN-repo research step that sits UPSTREAM of github-scout (which DISCOVERS unknown repos) and source-intake (which INGESTS a chosen repo). Reach for it when the repo is already chosen and the real question is "is it worth our attention / what can LiYe learn". Do NOT use it to search/discover repos (that is github-scout) or to actually vendor/ingest a repo (that is source-intake).
domain: 01_Research_Intelligence
category: prior-art
version: 1.0.0
status: active
skeleton: workflow
triggers:
  commands: ["/github-digest"]
  patterns:
    - "研究这个 repo"
    - "研究一下这个项目"
    - "这个项目对 liye 有没有帮助"
    - "对 liye systems 的进化有什么帮助"
    - "digest this repo"
    - "study this github project"
    - "跑下一个 repo"
inputs:
  required: ["repo_url"]
  optional: ["focus_question"]
outputs:
  artifacts:
    - "docs/methodology/01_Research_Intelligence/recon-log/<YYYY-MM-DD>-<repo-slug>.md"
    - "recon-log README 索引行"
failure_modes:
  - symptom: "克隆失败（网络 / 404 / private）"
    recovery: "退回 `gh repo view <owner>/<repo>` + 网页元数据；报告显式标注『未能完整获取，判断基于 X』，证据强度降级"
  - symptom: "repo 内容稀薄 / 几乎为空"
    recovery: "如实说明，verdict=忽略，不硬凑"
  - symptom: "强 copyleft（GPL/AGPL）许可"
    recovery: "仅概念参照；frontmatter 记 license_caution；绝不复制其源码进任何 LiYe 仓"
verification:
  evidence_required: true
  how_to_verify:
    - "node .claude/scripts/sfc_lint.mjs Skills/01_Research_Intelligence/prior-art/github-digest"
    - "确认 recon-log 新增条目 frontmatter 有 verdict + 证据强度声明"
governance:
  constitution: "_meta/governance/SKILL_CONSTITUTION_v0.1.md"
  policy: "_meta/policies/DEFAULT_SKILL_POLICY.md"
---

# GitHub Digestion — 进化情报侦察

给定一个**已知的** GitHub repo，把它读懂，判断对 LiYe Systems 进化有没有可借鉴之处，
产出一份**定型结构报告**并归档。它回答的是"这东西值不值得我们上心"——站在
`github-scout`（发现未知 repo）和 `source-intake`（受控 intake 已选 repo）的**上游**。

> **这个 skill 决定不了复用。** 它只出 advisory 报告 + verdict。任何真实复用都要走
> harvest-ADR / Reference Declaration 仪式（SYSTEMS.md Fork 纪律）。

## 为什么用 subagent 而不是主线直接读

一个真实 repo 读下来是 50–80k tokens（README + 目录 + 关键源码）。**默认 dispatch 一个
只读研究 subagent** 去啃，让它只回传定型报告——主线上下文不被源码淹没，且每份报告长同一个样、
可横向比较。只有当 repo 极小（几个文件）时才值得主线内联。

## 工作流

1. **接收输入**：repo URL（必需）+ 可选的关注问题。从 URL 解析 `<owner>/<repo>` 与 `<repo-slug>`。
2. **Dispatch 研究 subagent**：用 `references/subagent-prompt.md` 作模板，填入目标 URL、
   clone 目标路径、关注问题。subagent 负责只读获取 + clean-room 读 + 按模板出报告。
3. **落盘归档**：把 subagent 回传的报告写成 `docs/methodology/01_Research_Intelligence/recon-log/<YYYY-MM-DD>-<repo-slug>.md`
   （日期用当前实际日期），并在 `recon-log/README.md` 的索引表**顶部**加一行
   （日期 / repo / verdict emoji / LiYe 层 / 一句话）。
4. **应用清理策略**（见下）：按 verdict 处置克隆。
5. **回主线汇报**：verdict-first 摘要（结论 + 最相关的 2–3 点 + 许可风险标记 + 下一步）。

报告结构与 frontmatter 见 `references/recon-report-template.md`——**严格按它产出**，
否则历史条目无法横向比较。

## 克隆位置与生命周期（清理策略）

- **克隆到 repo 外、持久目录**：`~/.liye-os/github-digest/clones/<repo-slug>/`
  （`git clone --depth 1`）。**绝不**克隆进 liye_os / 任何工作仓，绝不 fork / vendor。
  （持久目录而非 session scratchpad，因为 watch 的克隆要留到价值兑现。）
- **跑完按 verdict 处置克隆**：
  - `忽略 (ignore)` — 确认没用 → **当下即删**：`rm -rf ~/.liye-os/github-digest/clones/<repo-slug>`。
  - `值得观察 (watch)` / `harvest-adr 候选` — **保留**：在报告 frontmatter 记
    `clone_path` + `clone_status: retained`；留到该 repo 的价值兑现（整合进 LiYe systems /
    走完 harvest-ADR）**或**被判定不再有用，那时才删。
- 删克隆是 clean-room 收尾，不是 governance 操作；但删 watch 克隆前要确认其价值已了结。

## Governance 硬边界（永远不替用户越过）

- **只读 / clean-room**：可以理解概念，**绝不逐字誊抄源码**进报告或任何 LiYe 仓。
- **强 copyleft 是硬毒药**：GPL/AGPL 等即使 verdict=watch，也只能概念参照、clean-room
  重实现，**绝不阅读其源码后照抄**；frontmatter 必标 `license_caution`。
- **不 fork / 不 clone 进工作仓 / 不 vendor / 不建运行时依赖**——surface，别 act。
- 任何复用走 harvest-ADR / Reference Declaration（reimplement + ≥3 scenarios）。

## Verdict 语义（三选一，必须落一个）

| Verdict | emoji | 含义 |
|---------|-------|------|
| `忽略 (ignore)` | 🔴 | 与 LiYe 无实质增益 → 删克隆 |
| `值得观察 (watch)` | 🟡 | 有相关性但暂不动手，挂 `watch_trigger` → 留克隆 |
| `harvest-adr 候选` | 🟢 | 有明确可复用价值，值得走正式复用仪式 → 留克隆 + 指出 source-intake 切入点 |

诚实优先：可借鉴的若只是**概念/设计模式**（LiYe 已有自研版），verdict 是 `watch` 不是
`harvest` —— harvest 指向"缺口填补 + 可复用资产"，不是"设计参照"。

## 证据强度纪律

每份报告结尾必须标注：哪些结论**读了源码确认**、哪些是**元数据/README 推断**、哪些是
**架构判断（对 LiYe 各层的映射几乎总是推断）**。浅克隆看不到完整 commit 历史——velocity
类结论要标注"基于 PR 编号/API 推断"。

## Read First（L1 方法论 = SSOT）

- `docs/methodology/01_Research_Intelligence/recon-log/README.md` — recon-log 定位、
  报告契约、verdict 图例、与 scout/source-intake 的分工。
- `references/recon-report-template.md` — 报告 frontmatter + 6 段定型模板。
- `references/subagent-prompt.md` — 研究 subagent 的派发提示模板（含 LiYe 分层背景）。

## Usage Examples

**示例 1（最常见）：**
Input: "研究一下这个项目：https://github.com/getredash/redash 看看对 liye systems 的进化有什么帮助没有？"
Output: dispatch subagent → 定型报告 → 落 `recon-log/<date>-redash.md` + 更新索引 → verdict-first 摘要（redash 🟡 watch，连接器契约/结果快照/tri-state 告警直指 AGE）。

**示例 2（连续跑）：**
Input: "跑下一个 repo：https://github.com/tinyhumansai/openhuman"
Output: 同上流程；若命中 GPL-3.0 → frontmatter 标 license_caution，摘要顶部亮许可警告。

**示例 3（判否）：**
Input: "这个 https://github.com/foo/bar 对我们有用吗"
Output: 若 repo 与任何层无实质关联 → verdict=🔴 忽略，落一条精简 recon-log，**当下删克隆**。

## Dependencies

- `git`（浅克隆）、`gh` CLI（元数据兜底）。
- 依赖 subagent 能力（keep 主线 context 干净）；无 subagent 时可主线内联但会更耗 context。
- 无外部服务；默认 unauthenticated 公开读。

---
**Created**: 2026-07-01 | 三层位置：L1=docs/methodology/.../recon-log · L3=本文件 · 兄弟=github-scout
