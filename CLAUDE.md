# CLAUDE.md (Kernel)

> 本文件是 liye_os（GitHub repo `liyecom/liye-ai`）的启动路牌 + 最小常驻 context。
> 只放导航、命令、纪律；不放 SOP/协议/skill 全文。
> 本文件受机器门保护：guardrail ≤10,000 chars（`node .claude/scripts/guardrail.mjs`）；
> 改动本文件的 PR 标题须 `kernel:`/`governance:` 前缀或 `kernel-change` label（Kernel Guard CI）。

## System Role

- Layer: **0（制度底座）**——LiYe Systems 的 governance / contract compiler + 窄控制面工具；语义入宪、实现下沉，不拥有预建通用 agent runtime。
- **系统级 SSOT**: `_meta/portfolio/SYSTEMS.md`（生态分层、BGHS 四分法、D0-D3 成熟度、依赖方向）。
- **项目级 SSOT**: `_meta/contracts/`。讨论生态角色/层级以 SYSTEMS.md 为准；讨论本仓治理以 contracts 为准。
- 本仓不做具体业务逻辑：向 domain engines（AGE/UGE/chaming）和按需执行体输出合约；常驻 runtime 必须重新满足 demand-pull 或 risk-pull。

## 治理面导航（2026-07 现状；计数会漂移，以命令重数为准）

| 资产 | 路径 | 一句话 |
|------|------|--------|
| 契约 SSOT（21-schema gate） | `_meta/contracts/` | learning×13 · engine×2（v1+v2）· governance×3 · loop×1 · playbook×1 · proactive×1；其中 16 个注册在 `validate-contracts.mjs` `schemaFiles[]`，5 个由专用校验器覆盖 |
| loop contract v2（C1-C13） | `_meta/contracts/loop/` | governed work loop 契约语言层：schema + template + fixtures，两层校验（ajv 结构 + 语义派生）；v2 增 stop_condition/kill_switch/evidence_package/词表收紧；`contract_status: schema_validated_only`，背后无 runner |
| 政策 | `_meta/policies/` | `DEFAULT_SKILL_POLICY.md`（9 条，Policy 9=Surgical Scope）+ `BACKLOG_INTAKE_POLICY.md`（agent 只 propose、operator 翻牌） |
| ADR | `_meta/adr/` | 22 份；新决策先查重再增 |
| SPEC | `_meta/specs/` | 跨仓 SPEC（含 user-growth-engine） |
| 学习管线 | `.claude/scripts/learning/` | import_facts → pattern_detector → crystallizer → promotion → heartbeat → metrics → phase4_entry_gate；**全部 operator/CI 触发，无调度器** |
| 学习源注册表 | `.claude/config/learning_sources.yaml` | 写门之一：enabled + expected_manifest_hash 双字段；arm 只授权 import 信任，不授权 emit/平台写 |
| 外源引入 | `tools/source-intake/` | URL→artifact 受控轨道 S0-S6 七阶三门；`tools/github-scout/` 只读探查 |
| skill 工厂 | `_meta/skill-factory/` | SFC v0.2 契约 + 单一 SSOT frontmatter 解析器 + `sfc-ci.yml` |
| 台账 | `_meta/contracts/ledger/` | manifest reality 每日 append-only 记录（Band B 时钟证据） |
| 改革蓝图 | `_meta/reform/` | v1.1 |
| Portfolio disposition evidence | `_meta/portfolio/decommission/` | 主轴 B 与 websites 的 inventory；只记录证据/目标处置，不授权迁移、关停或逐仓定级 |

## 常用校验命令（从仓库根跑）

```bash
node _meta/contracts/scripts/validate-contracts.mjs              # 契约总校验
node _meta/contracts/scripts/validate-contracts.mjs --check-ssot # SSOT 单实例检查
node _meta/contracts/scripts/validate-governed-work-loop.mjs     # loop C1-C13（已接 contracts-gate CI）
python3 _meta/contracts/scripts/validate_manifest_reality.py     # Hard Gate 5 / manifest reality
node .claude/scripts/guardrail.mjs                               # 本文件+packs 字数门
npm test                                                         # vitest（已 exclude node:test 系列）
node --test .claude/scripts/learning/tests/                      # learning 套件（node 内建 runner）
```

- ⚠️ governance 测试共享 `execution_tiers.yaml` 临时改写：**本地串行跑，禁并行**（并行=假阴性）。
- ⚠️ vitest 与 `node --test` 收集范围互斥（vitest.config.ts 显式 exclude），勿用一个 runner 跑另一个的套件。

## 无人值守自动化（当前仅一条，勿凭旧文档假设更多）

launchd `com.liye.manifest-reality-clock`：每日本地 09:05 跑 `_meta/contracts/scripts/manifest_reality_clock.py --append`，对 AGE manifest 做 R1-R6 reality 校验，append 到 `_meta/contracts/ledger/manifest_reality_amazon-growth-engine.jsonl`。Band B 30 天 streak：**漏一天即 reset，fail-closed 不 backfill**。日志 `~/Library/Logs/liye/`。学习管线没有任何 cron/launchd 挂载。

## 工作纪律（机器门之上的手工纪律）

1. **禁 `git add -A` / `git add .`**——一律按名 add。仓库根常驻 untracked 工件（`.codegraph/` 等），误 add 即污染。
2. **禁 `--no-verify`**。本地 hooks（`bin/install-hooks.sh` → `.claude/.githooks/`）是 LOCAL GUARDRAILS 不是 enforcement，真执行在 CI——但绕过本地门仍是违规。
3. merge 只用 `gh pr merge N --squash --delete-branch`；author 不自 approve、不自合。
4. **主 checkout 不可碰**：改动从 `origin/main` 起 sibling worktree（多会话并发是常态）。
5. forbidden-name lint 扫**整个 staged blob** 而非 diff：改任何源文件可能翻出预存声明阻断——不绕过，最小重命名+披露。
6. 涉密纪律：pre-commit 硬拦 Bearer token 与 `.env*`；fixture 需要凭证形状时 runtime materialize，不实体入库。

## CI（按域切分；计数以命令重数为准）

- 契约门：`contracts-gate.yml`（连字符，真门：validate-contracts + loop C1-C13 + playbook IO）。⚠️ 另有同名旧门 `contracts_gate.yml`（下划线，Phase-1 `src/contracts/` 校验）——checks UI 显示名相同，勿混淆。
- 其余按域：`learning-*`（每 phase 一个）、`sfc-ci`、`manifest-reality-clock-tests`、`kernel-guard`（本文件）、`i18n-gate`、`security-gate`、`memory-gate`、`layer-dependency-gate` 等。

## 静止区（文件在、近两月基本无变动；按需进入，勿按旧文档假设运行态）

`src/`（gateway/MCP/mission broker/world model runner）、`tools/notion-sync/`、`.claude/packs/` + `assembler.mjs`、Two-Speed 会话钩子（`.claude/scripts/pre_tool_check.mjs`/`stop_gate.mjs`，**未默认注册**，issue #145 未收口）。2026-05 以来的活跃面在 `_meta/` 治理层与 `.claude/scripts/learning/`，不在 `src/`。

## 其他资产

- `websites/`：迁移面，不属于 L0 长期身份。Kuachu 已迁出；其余站点的版本化状态、UGE grounding 漂移和逐站 disposition 以 `_meta/portfolio/decommission/websites-disposition-inventory-2026-07-10.md` 为准。当前 Live Site Gate 未获 fail-closed 认证。
- `verdicts/`：判定语义（人读，不进 CI）。Contracts=「系统能不能做」，Verdicts=「决定意味着什么」。

---

**Version**: 3.1（C2 SSOT/navigation truth-sync）
**Last Updated**: 2026-07-10
**前身**: v2.2（2026-01-13，描绘 src/ 运行时与 Notion/packs 工作流——该形态已归入静止区，历史见 git）
