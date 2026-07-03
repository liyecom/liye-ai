---
repo: tinyhumansai/openhuman
url: https://github.com/tinyhumansai/openhuman
date: 2026-07-01
verdict: watch                      # ignore | watch | harvest-adr-candidate
layer_relevance: L0 (primary), L1
license: GPL-3.0
license_caution: "强 copyleft — 代码层面对 LiYe 商业化 Layer 2/3 是硬毒药；仅限概念参照，绝不 vendor / 逐字复用"
stars: ~34039
last_commit: 2026-07-01
evidence: governance 模块读源码确认; velocity 由 PR 编号推断(浅克隆无完整 commit 史); 产品功能面 README 交叉印证
watch_trigger: "LiYe 重构 governance kernel 的『信任标签/taint 传播』层时，把 turn_origin.rs 枚举设计（Unknown fail-closed + SubconsciousTainted 降权）作为只读设计参照（clean-room 重实现，不看 GPL 代码）"
low_cost_action: "推进 source-intake trust-audit taxonomy(#188/#190) 时，把 openhuman 的 taint→封锁 external-effect 工具面作为对照案例写进 rationale，验证分类完备性（纯概念引用，无许可风险）"
---

# 进化情报侦察报告 — tinyhumansai/openhuman

## 1. 是什么
**一句话**：面向个人/社区的开源 agentic 桌面助手（Tauri v2 + React 前端 + Rust 核心），主打「本地记忆 + 一键集成 + 后台自主性」，把一个 personal AI 做成有脸的桌面 mascot。

**成熟度信号**（均为元数据/API 确认）：
- **Star**：34,039（Trendshift/ProductHunt 上榜，高热度）
- **License**：**GPL-3.0**（强 copyleft — 见 Verdict，这是硬约束）
- **技术栈**：Rust 主体（2,393 个 `.rs`，`src/openhuman/*` 按 domain 切成 ~130 个模块）+ TS/React 前端（900 tsx / 883 ts），Tauri 桌面壳
- **活跃度**：`pushed_at` = 2026-07-01；最新 commit 引用 PR #4350 → 累计 4000+ PR，极高开发速度。**注**：depth-1 浅克隆导致 git 历史被压平（shortlog 只显示 1 author），velocity 结论基于 GitHub API + PR 编号，非 commit 历史
- **形态**：完整可运行的**软件产品**（有 installer/Homebrew tap/deb/msi、e2e 套件、CI），非 prompt 目录或数据集。状态自称 early-beta

## 2. 核心思想（读了源码 + 模块 README 确认，非营销话术）
1. **Turn-origin 信任标签 + fail-closed**（`src/openhuman/agent/turn_origin.rs`，读源码确认）：每次 agent turn 都强制携带一个 provenance 标签（`WebChat` / `ExternalChannel` / `TrustedAutomation` / `Cli` / `Unknown`）。未打标签的路径一律当 `Unknown` → 闸门 fail-closed。这是全系统信任决策的单一锚点。
2. **Taint 传播**：`TrustedAutomationSource::SubconsciousTainted` — 当后台 tick 处理的记忆里混入了外部同步来源（Gmail/Slack/Notion）的 chunk，该 turn 被标为 tainted，**external-effect 工具面被整体封锁**。即「读了不可信数据的自主回合，不许对外产生副作用」。
3. **两级人机闸门**：(a) `approval` gate — async 中间件拦截所有 `external_effect=true` 的工具（发邮件/Slack/shell），parked-future + SQLite 持久化 pending 行 + UI 弹窗 + 10min TTL，denial/timeout/channel-drop **全部 fail-closed**，并做 PII redaction + 终态执行审计；(b) `plan_review` gate — 把 live turn 停在 plan 上，用户 Approve/Reject/Revise 后原 turn 恢复执行。
4. **权限天花板 + 确定性工具策略**（`agent_tool_policy`）：per-channel `PermissionLevel` ceiling，把每个工具分类成 Allow/RequireApproval/Deny/HideFromPrompt，产出不可变 `ToolPolicySession` 快照，未知工具默认 `Deny`。
5. **确定性 verdict 契约**：`prompt_injection` 用 regex+heuristic 打分 → `Allow/Review/Block` + score + 稳定 reason codes + SHA-256 prompt hash 审计（PII-safe）；`mcp_audit` 把所有 MCP write-tool 尝试（含失败）落 SQLite 审计表。记忆侧 `memory_tree` 把所有接入数据压成 ≤3k-token Markdown chunk 存本地 SQLite + Obsidian 兼容 vault（Karpathy-style）。

## 3. 对 LiYe 哪一层有关
**Layer 0（liye_os）+ Layer 1（loamwise）**，这是实质关联，且关联度很高：

- **Layer 0 治理原语**：openhuman 的 `turn_origin`（信任标签/taint）、`approval`（fail-closed 人机闸）、`agent_tool_policy`（permission ceiling + 未知即 Deny）、`prompt_injection`（Allow/Review/Block verdict 契约）、`mcp_audit`（write 审计流）几乎是 LiYe **BGHS + fail-closed + SSOT + verdict 语义 + 只读侦察/受控 intake 分离**教义的一个**已在生产落地的平行实现**。尤其 `AgentTurnOrigin::Unknown → fail-closed` 与 LiYe 的「未标注即最严」同构。
- **Layer 1 编排**：`agent_orchestration`（parent/child lineage + run_ledger + delegation.rs）+ `DELEGATION_POLICY.md`（4-tier direct-first 决策树）+ `scheduler_gate`（按主机负载/电量 gate 后台 AI 工作）对应 loamwise 的 **CARGE 管线 / Task Ledger / 治理门禁**。
- 与 Layer 2/3（AGE 数据源接入、silkbay 电商）**无实质关联** — openhuman 是水平 agent harness，不碰亚马逊广告/域名/电商域逻辑。

## 4. 可借鉴的 pattern（全部为**思想借鉴，非代码复用** — 理由见 Verdict）
1. **Turn-origin 作为单一信任锚点**（思想借鉴）：LiYe 的 governance 目前散在 contracts/verdicts；openhuman 把「谁调度了这个回合」收敛成一个 typed task-local，被 approval + tool-policy 两个闸门共同读取。这个「单点 provenance，多闸门共读」的收敛方式值得 liye_os kernel 参考。
2. **Taint = 数据来源污染 turn 的外部副作用面**（思想借鉴）：读了外部同步数据的自主 tick 自动降权、封锁对外副作用。直接映射到 LiYe 的「只读侦察 vs 受控 intake 分离」+ source-intake trust-audit taxonomy（正是本仓库近期 #188/#190 在做的事）。
3. **fail-closed 的具体实现清单**（思想借鉴）：persist 失败 / channel drop / TTL timeout / 未知 origin **四条路径全部 Deny**，且 TTL 路径会 re-read 持久化决策以避免 approve-in-race 被误 deny。这是 fail-closed 的工程细节参考。
4. **plan_review parked-turn 模式**（思想借鉴）：把 live turn 停在 plan 上等 Approve/Reject/**Revise(feedback)**，与 LiYe 的 plan-mode / 人机闸门一致，`Revise` 分支（带反馈重新规划再 re-park）是可借鉴的循环设计。
5. **verdict 契约的可审计形状**（思想借鉴）：`{verdict, score, reason_codes, hash}` + 只记 hash 不记原文的 PII-safe 审计行 — 与 liye_os `verdicts/` 的人类可读判定语义思路一致，可作为 verdict schema 的字段参考。

## 5. Verdict
**值得观察（Watch）** — 一句为什么：**治理哲学与 LiYe 高度同构、且是罕见的「生产级平行实现」，值得作为设计参照持续跟踪；但 GPL-3.0 强 copyleft 使任何代码复用对 LiYe 的商业化 Layer 2/3 都是硬毒药，且 LiYe 的 fork 纪律本就要求 reimplement，因此现在不够格直接进 harvest-ADR。**

（为何不是 harvest-ADR 候选：harvest 通常指向「有明确可复用价值、值得走正式复用仪式引入」。这里可借鉴的是**概念/设计模式**而非可移植资产 — LiYe 已有 turn-origin/taint/fail-closed 的自研版本（source-intake trust-audit、Band-B clock、approval 教义），openhuman 提供的是**验证与细节参照**，不是缺口填补。GPL 又叠加了代码层面的隔离要求。故 Watch 更诚实。）

## 6. 下一步
- **归档 + 挂观察**：把本报告存入进化情报库，标记 `watch: openhuman`。触发再看的条件 = 当 LiYe 要重构 governance kernel 的**信任标签/taint 传播**层时，把 `turn_origin.rs` 的枚举设计（尤其 `Unknown` fail-closed + `SubconsciousTainted` 降权）作为**只读设计参照**（clean-room 重实现，不看其 GPL 代码）。
- **不接 source-intake / harvest-ADR**：无可 vendor 资产；且 GPL-3.0 下任何逐字复用会污染 LiYe 许可，与 fork 纪律冲突。
- **一个具体的低成本动作**（可选）：若近期继续推进本仓库的 source-intake trust-audit taxonomy（#188/#190 线），可把 openhuman 的「taint 来源 → 封锁 external-effect 工具面」作为**对照案例**写进该 taxonomy 的 rationale，验证 LiYe 分类的完备性 —— 这是纯概念引用，无许可风险。

---
**证据强度标注**：核心思想（§2）、governance 模块语义（§3-4）均**读了模块 README + `turn_origin.rs`/`plan_review/types.rs` 源码确认**；star/license/language/pushed_at 为 **GitHub API 确认**；velocity（4000+ PR）**由 PR 编号 + pushed_at 推断**（浅克隆无法看完整 commit 历史）；产品功能面（memory tree/auto-fetch/mascot）部分来自 **README 描述 + 模块 README 交叉印证**，未逐一跑通运行时。项目内容**不稀薄** — 是一个真实、活跃、体量很大的生产级 codebase。

---

> **来源纪律**：本报告为 clean-room 只读侦察产出，目标 repo 未 vendor 进任何 LiYe 仓。⚠️ **GPL-3.0 强 copyleft**：即便未来复用，也只能 clean-room 重实现其概念，**绝不阅读/复制其 GPL 源码到 LiYe 任何仓**。任何复用须走 harvest-ADR / Reference Declaration 仪式（SYSTEMS.md Fork 纪律）。
