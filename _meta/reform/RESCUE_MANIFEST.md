# RESCUE_MANIFEST — AGE 分支救援清单（Phase 0A）

> 全量冻结索引。`age-rescue-<date>.bundle`（`git bundle create --all`）是回滚保险，本清单是它的人类可读索引。
> 分诊钉点：AGE origin/main = `58bc918`（2026-07-03 分诊时点）。**冻结执行时** origin/main 已推进至 `8c18914`（+4 commits：#586 write-chokepoint / #582 smoke-fix / bea-v2 storage cron-wiring / keyword-replay-risk doc）——`git bundle --all` 已全量捕获该更新状态，主树 detach 收敛亦落在 8c18914。分诊方法：`git for-each-ref` + `git cherry origin/main <branch>`（patch 等价性）+ squash-PR 标题匹配 + origin/main 树文件存在性核查。全 142 本地分支无抽样。
> 分诊执行 2026-07-03，由 4 路对抗复核 agent 之一完成（324k tokens 复核之一）。

## 冻结规格

- 命令：`git bundle create age-rescue-2026-07-03.bundle --all`
- 覆盖：142 refs/heads · 14 tags · 全 refs/remotes/origin/* · HEAD · refs/stash 尖（1 条）· 3 个 detached worktree HEAD（1af7bc2 / 689a7d7 / 31c6e3c，均可达）
- `git rev-list --all --not --remotes` = **449 commits** 不在任何 remote，全部被 bundle 捕获
- 预估体积：.git 60MB → bundle 重打包 delta 压缩后 ~20–40MB
- **不覆盖**：reflog-only / dangling commits（无 ref 可达）· 各 worktree 的 uncommitted/untracked 脏文件（如主树 `.codegraph/`）
- 落点：repo 外持久位置（建议 `~/github/_reform_rescue/`），**不入任何 git**

## 分诊分类（142 分支）

| 类 | 数量 | 处置 | 说明 |
|----|------|------|------|
| **A 零独有指针** | 45 | bundle+delete（Phase 4） | `git cherry` 显示 0 非等价 commit；内容全在 origin/main。保留 `main`；4 个被 worktree 钉住 |
| **B upstream-gone 已 squash 合并** | 54 | bundle+delete（Phase 4） | cherry 有 + 但内容经 squash-PR 标题匹配 + 文件存在性核实已落 main（PR #54–#562 一长串）。3 个被 stale worktree 钉住 |
| **C 已推送在途** | 11 | **keep** | upstream 存在于 origin，remote-safe。多为活跃 worktree。注：`feat/bea-v2-storage-cron` 本地落后其 remote 1 commit |
| **D review/pr-* 草稿** | 7 | bundle+delete（Phase 4） | 已合并 PR 的本地 review 草稿（#243 #266 #271 #362 #368 #526 + pr-185 的 5b spec 已在 main） |
| **E 已被超越的 WIP/backup/archive** | 15 | bundle+delete（Phase 4） | April 期 commit 链，内容经 squash PR 落地或文件全在 main 树；3 分支共享同尖 c50a172。占 449 commits 大头 |
| **F 主工作树集成 HEAD** | 1 | **keep** | `chore/canonical-realign`（主 repo 当前 checkout；ahead 6 = 5 merge + 1 已被 #535 超集的 doc commit） |
| **G 真独有从未落地** | 9 | **needs-human-review** | 文件经 `git log --follow` 核实从未在 origin/main 出现。共 13 commits。详见下节 |

**可删除总计 = A+B+D+E = 121 分支**（Phase 4 分批 `branch -D`，每批单独 go）。**保留 = C+F + main = 13**。**待裁 = G = 9**。

## G 类：9 个真独有分支明细（共 13 commits，逐项裁）

| 分支 | 独有 commit | 内容评估 | 建议 |
|------|:---:|------|------|
| `wip/onboarding-private-commits` | 2 | `wake_contract.py`（ADR-age-wake-resume）+ state.yaml→jsonl reconcile；PR #104 刻意剔除、main 不含——**有意私有** | bundle 即足；如仍要 → 推 `archive/*` |
| `backup/local-main-onboarding-pre-pr1` | 2 | 与上者同尖 7c40941，**完全重复** | 上者保留后即冗余 |
| `local/y6yf-20260420-isolated-pending` | 1 | `y6yf_20260420_bid_placement_adjust.py`（370 行）+ decision_log；commit 自述"not for push"——**隔离设计** | 历史价值，bundle 即足 |
| `docs/restore-asin-growth-skill-docs` | 1 | April 期交付文档，实质被 SKILL.md v4/v5 超越 | 低价值，bundle 即足 |
| `rescue/restore-product-selection-assets-20260424` | 2 | `amazon-ads-mechanism-playbook-2026.md`（从未落地，**唯一一份**）+ 已被超越的 XHR 参考 | 该 playbook 是唯一独有文件——**Phase 4 裁前人看一眼** |
| `rescue/preserve-product-selection-working-copy-20260425` | 1 | pre-#181 working copy 快照，实质被 v0.3 超越 | 低价值，bundle 即足 |
| `chore/product-selection-skill-boundaries-20260506` | 2 | `references/skill_boundaries.md` 边界契约；文件从未落 main（PR 疑似 closed unmerged）；概念被 placement 教义超越但文本未存他处 | **Phase 4 裁前人看一眼** |
| `chore/timo-us-y6yf-l7fp-d1-complete-detection` | 1 | D+1 北极星（CPC+ACOS+placement-shift）框架 decision doc；从未落 main | 历史 ops 分析价值 |
| `wt-next` | 1 | 13 ahead 中 12 为已超越 store-context；1 独有 = `run_pulse.sh` 8 行 fingerprint 日志；pulse 已迁 age-main-cron 模板（#303） | 疑似过时，bundle 即足 |

> **Phase 4 裁 G 类时的唯一实质提醒**：`rescue/restore-product-selection-assets-*` 的 ads-mechanism-playbook 与 `chore/product-selection-skill-boundaries-*` 的 skill_boundaries.md 是仅有的两份"独一无二且可能仍有参考价值"的文件，删前 Owner 过目。其余 7 分支皆为刻意私有/隔离/已超越，bundle 兜底即可 `branch -D`。

## Worktree 卫生（Phase 4 删分支前置）

18 个 worktree 中 7 个钉住已合并/stale 分支，挡住 `branch -D`，需先 `git worktree remove`：
`age-main-cron`(main·behind 24·cron 在跑，处置见 Phase 0B) · `.claude/worktrees/zen-hamilton-ae5c0f` · `~/worktrees/age-evo-d-g-routing-impl` · `~/worktrees/age-ab1-recon` · `age-action-outcome-ledger-v0`(#560) · `age-measurement-verdict-truth-sync`(#558) · `age-keyword-bid-baseline-receipt`(#562)。

---
*RESCUE_MANIFEST v1.0 · 2026-07-03 · 配套 age-rescue-2026-07-03.bundle*
