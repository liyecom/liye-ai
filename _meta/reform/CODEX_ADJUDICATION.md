# CODEX_ADJUDICATION — 外审裁决记录（蓝图 v1.0 → v1.1）

> 改革蓝图 v1.0 经外部审核者（Codex）逐条审查后的裁决记录。原则：主张对错看证据，不看谁提的。
> 核查手段：4 路独立复核 agent（324k tokens · 81 次工具调用）+ 全 142 本地分支内容级 git 分诊。
> 钉点：AGE origin/main `58bc918` · liye_os PR#200 MERGED `6afb13e` · 2026-07-03。

## 逐条裁决

| # | Codex 主张 | 裁决 | 证据 / 修订落点 |
|---|-----------|------|----------------|
| 1 | 蓝图三主轴与概念定版成立；应是 PRD + evidence ledger + stop-lines，不是 shell runbook | **采纳** | v1.1 全面制度化：新增 Phase –1 蓝图固化；删除类全部集中 Phase 4 逐批授权；破坏性动作以落盘 PRD 为授权面，不以会话对话为授权面 |
| 2 | Phase 0 应 = 冻结/救援/clean base，删除放最后 | **采纳并强化** | 正确原语 = `git bundle --all` 一步覆盖 449 commits（比"救援单 commit"完整两个量级）；Phase 0 拆为 0A 冻结 / 0B 收敛，零删除 |
| 3 | "canonical-realign 有独有 commit 63598c2，删前必须先救援" | **驳回** | 内容级核查：该文件已由 PR #535（e5bf4e9）逐字节落 origin/main，`diff` 为空。外审只查 commit 可达性、未查 patch 等价性。v1.0 原判"已被 #535 超集"正确 |
| 4 | SFC 不应一次迁 24 个；先 spec + linter + 2 范本 | **部分采纳** | v1.0 本就范本先行。真修正是构成：手迁 7 + 脚本迁 16（vendored 同 v0.1 模板）+ 已合规 3 + 拆分 1 + 退役 2 + 回迁 2；strict-first 实测 23/24 红（"全生态红灯"成立）；根因 = liye_os sfc_lint v0.1 强制字段正是 v0.2 禁止的顶层字段。范本改选 asin-growth + github-digest（ads-governance 是重写不是迁移） |
| 5 | GSD 79 个不应归档，先 lock / source metadata | **采纳** | 核实为 npm 包 `get-shit-done-cc` v1.37.1（非 plugin）且在用（两 repo `.planning/codebase/` 为其产物，liye_os 6 天前刷新；AGE tracked 文档引用其产物）。裁决 keep+lock；未来若删必须整体卸载（skills+agents+hooks+runtime+manifest 一体），不能只删 skills 目录 |
| 6 | KOI 不应全 scrub；internal 保留公式 + export 零泄漏 + lint path 测试 | **采纳但降级** | 非新提案，是 2026-06-27 已 FROZEN 且已实施政策的重述（PR #524 + 58bc918；path 测试已存在 tests/lint/）。真缺口在别处 → KOI 工作流重定义为出口面三件事（见下） |
| 7 | execute_request 拆分延后 | **本就共识** | v1.0 Q5 原建议即"等 #403 Phase 1b"；3591 行实测确认；加执行纪律：split map + characterization tests 先行 |
| 8 | loamwise 先开 archive/release 分支 + 最小 CI，不直推 master | **采纳** | `release/p2-p3-baseline-2026-06-02` 分支已在本地存在（bb3c389），只差 push + CI |
| 9 | PR #200 已合并，蓝图前置提醒过时 | **核实** | MERGED 2026-07-03（6afb13e）；v1.1 已更新 |

## KOI 工作流重定义（裁决 #6 展开）

R8 内部面政策 FROZEN 不重开（决定 A：internal_operator 保留公式——公式本必须存在于 src/scripts，scrub 内部 .md 零边际保密收益）。cleanup 工作流 = 出口边界三件事：
1. **出口门强制化**：`port_scrub_gate.py` 从"工具 + runbook"升级为强制门；首个接线点 = `asin-keyword-koi → 掌象AI` handoff 的 P6 渲染门。
2. **FirstLightClaw EXTERNAL_EXPOSED 跟进**：外部拷贝含可运行公式（W2 审计 5/6 UPHELD，一处接入 live Supabase edge function）——**这才是真正的残余风险，不在本 repo**。通知对方 scrub / 服务端改写。
3. **W3 git 历史审计**：W2 建议升 GO 评估（外泄已确认）。

## 本轮复核新增的外审漏项

1. **生效面漂移有紧迫性**——`~/.claude/skills` 三个 symlink 正在服务 behind-32 的旧 skill；`age-main-cron` 的 cron 正跑 behind-24 的旧 main。Phase 0B 不是洁癖，是止漂。
2. **7 个 stale worktree 钉住已合并分支**，挡住删除路径，需先 `git worktree remove`。
3. **navigator 文档称 `age-main-cron`"非 git 仓库"，实为 AGE worktree**（去幻觉清单 +1）。
4. **`amazon-ad-optimization` 双重问题**（死 skill + 最重 KOI skill 面，`calculate_tes.py` 为可运行公式载体），退役优先级上调至 Phase 3。
5. **`loamwise-ops` / `domain-hunter` 两个自研域 skill 游离在 `~/.claude` 全局层**，按 placement 教义应回迁域 repo。

## 执行约束（关键的坑，已实测）

- **AGE `main` 分支被 `age-main-cron` worktree 占用** → 主 repo 无法 `git switch main`，收敛用 `git switch --detach origin/main`。
- **AGE untracked ∩ origin/main-tracked = 0**（实测）→ detach 无 untracked 覆盖冲突。
- **liye_os 与 origin/main 分叉 1/1 + 未提交 Band-B clock 修改** → 收敛需 stash 保留后切 main。

---
*CODEX_ADJUDICATION v1.0 · 2026-07-03*
