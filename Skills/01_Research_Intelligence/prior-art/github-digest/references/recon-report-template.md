# recon-report-template

研究 subagent 回传的报告**严格按此结构**（中文）。落盘为
`docs/methodology/01_Research_Intelligence/recon-log/<YYYY-MM-DD>-<repo-slug>.md`。

## Frontmatter（YAML）

```yaml
---
repo: <owner>/<repo>
url: https://github.com/<owner>/<repo>
date: <YYYY-MM-DD>                  # 当前实际日期
verdict: watch                      # ignore | watch | harvest-adr-candidate
layer_relevance: <如 "L2 (主, AGE), L0"，或 "无实质关联">
license: <SPDX，如 MIT / BSD-2-Clause / GPL-3.0>
license_caution: <仅当强 copyleft 时：一句风险说明；否则删除本字段>
stars: <~N>
last_commit: <YYYY-MM-DD 或 unknown>
evidence: <一句：哪些源码确认、哪些推断>
clone_path: <仅当 verdict != ignore 时：~/.liye-os/github-digest/clones/<repo-slug>>
clone_status: <retained（verdict!=ignore）| deleted（verdict==ignore）>
watch_trigger: <仅当 verdict=watch/harvest：什么条件下回取重评>
low_cost_action: <可选：一个无许可风险的即时概念引用动作>
---
```

## 正文 6 段

```markdown
# 进化情报侦察报告 — <owner>/<repo>

## 1. 是什么
一句话定位 + 成熟度信号（star / 最近 commit / license SPDX / 语言技术栈 / 形态：
软件系统 · prompt 目录 · 数据集 · 框架 · 规范）。每个信号标证据来源（API/源码/推断）。

## 2. 核心思想（3–5 点）
架构/机制关键点，概念级。真实软件要区分子系统。**读源码确认的**优先，标出文件路径。

## 3. 对 LiYe 哪一层有关
明确指向 Layer 0/1/2/3 的具体 repo（liye_os / loamwise / AGE / chaming / silkbay …），
说清"为什么是这一层"。无关就直说"无实质关联"。**这一节几乎总是架构推断，须标注。**

## 4. 可借鉴的 pattern
每条概念级可学点，**逐条注明"思想借鉴，非代码复用"**。无则直说无。

## 5. Verdict
三选一（忽略 / 值得观察 / harvest-adr 候选）+ 一句为什么。
诚实：只是设计参照且 LiYe 已有自研版 → watch，不是 harvest。

## 6. 下一步
- watch → 归档 + 挂 watch_trigger（什么时候回取）。
- harvest 候选 → 指出接 source-intake / harvest-ADR 的具体切入点 + ≥3 scenarios。
- ignore → 归档精简条目 + 当下删克隆。

---
**证据强度标注**：逐项说明源码确认 vs 元数据推断 vs 架构判断；浅克隆的 velocity 结论标"基于 PR/API 推断"。

---

> **来源纪律**：本报告为 clean-room 只读侦察产出，目标 repo 未 vendor 进任何 LiYe 仓。
> <若强 copyleft：⚠️ 加一句 GPL/AGPL 只可概念参照、绝不照抄源码。>
> 任何复用须走 harvest-ADR / Reference Declaration 仪式（SYSTEMS.md Fork 纪律）。
```

## 落盘后：更新索引

在 `recon-log/README.md` 索引表**顶部**插一行（最新在上）：

```markdown
| <date> | [<repo-slug>](./<date>-<repo-slug>.md) | <🔴|🟡|🟢> <verdict> | <层> | <一句话> |
```
