---
repo: msitarzewski/agency-agents
url: https://github.com/msitarzewski/agency-agents
date: 2026-07-01
verdict: watch                      # ignore | watch | harvest-adr-candidate
layer_relevance: L0 (primary), L1
license: MIT
stars: ~121759
last_commit: 2026-06-30
evidence: mechanisms source-confirmed; LiYe-layer mapping inferred
watch_trigger: "LiYe 要把 Skills/Agents 资产向多宿主（Claude Code / openclaw / FirstLightClaw）分发时，重评其 tools.json 契约模型与 convert_openclaw 切分"
---

# Evolution Recon 报告：msitarzewski/agency-agents

## 1. 是什么

一句话定位：**一个「AI 机构」式的 agent 人格提示词目录（agent-persona catalog）** — 232 个专业分工的 AI agent，每个是一份带人格/流程/交付物的 Markdown prompt，配一套把「单一 canonical 定义」转译并安装进 14 种 agentic 工具（Claude Code / Cursor / Codex / Gemini CLI / OpenClaw / Osaurus 等）的 shell 工具链。

成熟度信号（均为元数据/源码确认）：
- **Star ~121,759 / Fork ~19,891 / Watchers 907** — 顶流量级开源项目（gh API 确认）。
- **最近 commit：2026-06-30**，高度活跃；有配套原生桌面 app（独立 repo）+ 官网 agencyagents.app。
- **License：MIT (SPDX: MIT)**，`Copyright (c) 2025 AgentLand Contributors`（LICENSE 确认）。
- **技术栈**：主体是 277 个 `.md`（agent 定义）+ Shell（install.sh 51KB / convert.sh 20KB）+ 少量 Python（originality 检查、hermes 插件构建）。GitHub 主语言标为 Shell。
- 起源：README 自述「源于一个 Reddit thread」，社区贡献驱动。

## 2. 核心思想（源码确认）

1. **Prompt-as-artifact / 人格化 agent 定义**：每个 agent = 一份 Markdown，YAML frontmatter（`name/description/color/emoji/vibe`，lint 强制 `name/description/color`）+ 结构化 body（`Identity & Memory` / `Core Mission` / `Critical Rules` / `Workflow Phases`）。不是「Act as X」泛提示，而是带强人格、明确交付物、成功指标的固化资产。
2. **单一来源 → 多工具渲染（canonical → N formats）**：`convert.sh` 里每个工具一个 `convert_<tool>` 函数，把同一份 `.md` 渲染成 TOML/MDC/SKILL.md/多文件工作区等；`tools.json` 用 `format`（保证字节级一致）+ `installKind`（`per-agent`/`roster`/`plugin`）声明安装契约。这是一套**声明式的「能力资产分发适配层」**。
3. **catalog SSOT + CI 一致性门禁**：`divisions.json` / `tools.json` 是显式标注的 source-of-truth；三个 GitHub workflow（check-divisions / check-tools / lint-agents）在 CI 上校验「磁盘目录 ↔ JSON ↔ install.sh/convert.sh 数组」四方不一致就 fail build。SSOT 漂移被机器拦截。
4. **原创性治理（反 re-skin 抄袭）**：`check-agent-originality.sh` 用「实体中性化 + 8-word shingle Jaccard 重叠」检测新 agent 是否是既有 agent 的 find-replace 换皮（把 country/platform 专名归一后仍算重复），阈值 WARN 20% / FAIL 40%，基线库最坏同对相似度 ~1.5%。这是一个**防止资产库被低质复制稀释的量化门禁**。
5. **多 agent 编排层（概念级，非运行时）**：`strategy/` 下有 NEXUS pipeline —— `agents-orchestrator`（PM→Arch→[Dev↔QA loop]→Integration，含 3-retry 上限 + 质量闸）、`handoff-templates.md`（标准化 agent 间交接文档，防上下文丢失）、`testing-reality-checker`（默认判 NEEDS WORK、要求压倒性证据才 certify 的 fail-closed 验收 agent）。**注意：这些是 prompt/模板，不是执行引擎**——编排靠人/宿主工具跑，本 repo 不含 runtime。

## 3. 对 LiYe 哪一层有关

**主要落点是分发/适配机制，而非某个域引擎。**

- **Layer 0 liye_os（最相关）**：两点直接呼应治理底座。
  - **`tools.json` 的 `format`+`installKind` 声明式安装契约** ≈ liye_os 的 `engine_manifest` / contracts 思路：用一份机器可读契约描述「一个能力资产如何被 N 个宿主消费」。
  - **`convert_openclaw` 的 body 拆分**把一份 agent 按 `## header` 关键词切成 `SOUL.md`（identity/communication/critical-rules）+ `AGENTS.md`（mission/workflow）+ `IDENTITY.md` —— 这是**BGHS 教义里 Brain/persona 与 Hands/operations 分离的一个外部实证**。而且它们已经原生支持 **openclaw**（正是索引外的 liyecom/openclaw / FirstLightClaw 生态用的运行时）。
- **Layer 1 loamwise（相关）**：`agents-orchestrator` 的「阶段闸 + 3-strike retry + handoff 契约」和 `reality-checker` 的 fail-closed 验收，概念上映射 CARGE 管线 + 治理门禁；`check-agent-originality` 的量化门禁映射 loamwise 的 Task Ledger/gate 精神。
- **Layer 2/3（弱）**：marketing/paid-media/sales 分区里有大量亚马逊/跨境/PPC 主题 agent（`paid-media-search-query-analyst`、`marketing-cross-border-ecommerce` 等），与 AGE/chaming 域**题材撞车但无机制增益**——都是泛化 prompt，深度远不及 AGE 已落地的 ads-governance / asin-growth skill 闭环，不构成可复用价值。

## 4. 可借鉴的 pattern（全部标注：思想借鉴，非代码复用）

1. **声明式「资产分发契约」（`format`/`installKind`/`dest` 三元组）** — 用一份机器可读清单描述「能力资产 → N 宿主」的渲染与安装契约，CI 校验四方一致。*思想借鉴*：可启发 liye_os 把 Skills/Agents 资产向多宿主（Claude Code / openclaw / FirstLightClaw）分发时的 manifest 设计。非代码复用。
2. **canonical-source + per-target renderer 的适配层分离** — 单一 SSOT，渲染器按目标格式转译，绝不手改下游。*思想借鉴*：与 liye_os「SSOT + 下游只读实例化」哲学同构。非代码复用。
3. **量化反抄袭门禁（entity-neutralized shingle Jaccard）** — 用实体归一后的 n-gram 重叠自动识别「换皮复制」。*思想借鉴*：这恰好是 LiYe **fork 纪律 / harvest-ADR「≥3 scenarios、reimplement 而非誊抄」** 的一个可机检化侧影——可作为「判断某资产是不是别处换皮」的检测思路。非代码复用。
4. **soul/operations 按 header 关键词自动切分（BGHS 落地）** — 把一份人格定义拆成「持久人格面」与「操作面」两个文件。*思想借鉴*：BGHS 分层的一个外部对照实现，验证「人格/操作可静态切分」这个假设。非代码复用。
5. **handoff 契约模板 + fail-closed 验收 agent** — 标准化交接文档（元数据/上下文/验收标准/证据要求）+ 默认判不通过的 reality-checker。*思想借鉴*：呼应 loamwise 门禁与 liye_os fail-closed/可审计底色，但 LiYe 已有更强的机器执行版本。非代码复用。

## 5. Verdict

**值得观察（watch）** — 一句话为什么：它的**能力资产多宿主分发契约（tools.json）+ 量化反换皮门禁 + soul/hands 静态切分**在概念上与 liye_os 的 manifest/contract/BGHS/fork-纪律高度同构，是一个规模验证过（121k star、232 资产、CI 门禁齐全）的**外部对照样本**；但它整体是「静态 prompt 目录 + shell 适配器」，**无 runtime、无治理语义、无 verdict 体系**，深度与执行力全面弱于 LiYe 现有制度层，没有可直接落地的机制增益到需要立刻动手的程度。域层 agent（亚马逊/跨境）与 AGE 撞题但无增益。

## 6. 下一步

**观察即可，不立即接 harvest-ADR。** 建议：
- **归档本报告**为一次 recon 记录；把 repo 留在 scratchpad 或直接删除（已 clean-room 读完，未 vendor 进任何仓）。
- **设一个观察触发条件**：当 LiYe 未来真的要「把 Skills/Agents 资产向 openclaw / FirstLightClaw 等多宿主分发」时，把本项目的 `tools.json`（`format`/`installKind`/`dest` 契约模型）和 `convert_openclaw`（soul/hands 切分）**作为设计参考再评估一次**——那时若确认要复用其 manifest 建模思路，才升级为 harvest-ADR 候选，走 Reference Declaration + reimplement + ≥3 scenarios 仪式（绝不誊抄其 shell）。
- 其 `check-agent-originality.sh` 的「实体归一 shingle Jaccard」算法思路可单独记一笔，作为「检测资产换皮」的候选工具灵感。

---

**证据强度声明**：第 1 节数字全部 gh API / LICENSE 源文件确认；第 2、4 节机制均**读了 `convert.sh` / `tools.json` / `divisions.json` / `check-agent-originality.sh` / `lint-agents.sh` / `agents-orchestrator.md` / `handoff-templates.md` / `testing-reality-checker.md` 源码确认**；第 3 节对 LiYe 各层的映射是**架构判断（推断）**，非项目自述。项目自身不含任何 runtime/执行引擎——由「277 md + shell + 无 src 服务代码」的目录结构确认。

---

> **来源纪律**：本报告为 clean-room 只读侦察产出，目标 repo 未 vendor 进任何 LiYe 仓。任何复用须走 harvest-ADR / Reference Declaration 仪式（SYSTEMS.md Fork 纪律）。
