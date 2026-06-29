# 研究综合：环境工程（Environment Engineering）× liye system / AGE 进化

> **类型**：外部研究综合 (external research synthesis) — 非 ADR、非宪法，供 ADR / 规划引用
> **日期**：2026-06-20
> **方法**：deep-research workflow（101 agents / 18 源抓取 / 90 claim 提取 / top 25 三票对抗核验 → 24 confirmed / 1 killed）+ 三层代码库实地测绘（AGE / liye_os GHL / loamwise，Explore agents，证据带 `file:line`）
> **一句话**：这批资料对 liye/AGE 的最大价值不是新功能，而是一面**诊断镜**——精确照出 liye 把工程力 all-in 在 harness 的「权限」一维（强到过剩），却让真正的能力杠杆（闭合的评判性反馈回路 + 通电的学习环境）断着电。

---

## 0. 核验状态总表（含诚实的核验缺口）

| # | 资料 | 核验状态 | 说明 |
|---|------|---------|------|
| 1 | **arXiv:2606.12191** *Agentic Environment Engineering: A Survey of Environment Modeling, Synthesis, Evaluation, and Application* (Jiachun Li et al.) | ✅ **3-0 已证实** | 标题/摘要逐字核验，4 阶段生命周期成立 |
| 2 | **arXiv:2606.13662** *EurekAgent: Agent Environment Engineering is All You Need for Autonomous Scientific Discovery* | ✅ **3-0 已证实** | 官方 repo `github.com/THU-Team-Eureka/EurekAgent` 实在；SOTA 26-圆装填 <$11 API 成本 |
| — | *bonus* **arXiv:2511.09586** *Environment Scaling* survey | ✅ 已证实 | workflow 自行挖出；提供 GEF 闭环权威定义 |
| 5 | **Karpathy** *autoresearch* `github.com/karpathy/autoresearch` | ✅ **3-0 已证实** | repo 实在 |
| 3 | Addy Osmani *Loop Engineering* | ⚠️ **核验存疑** | 博客 URL 抓到，5 条 claim 全是学术源语义重复，去重后无独立存活 claim |
| 4 | Addy Osmani *Agent Harness Engineering* | ⚠️ **核验存疑** | 同上 |
| 6 | WorkOS *Key takeaways from Boris Cherny on building Claude Code* | ⚠️ **核验存疑** | 同上 |

**关于存疑的 3 源**：不是「不存在」——URL 都抓到、各提 5 条 claim，但对抗核验+去重后，它们跟 EurekAgent / autoresearch 一手源**说的是同一件事**，被当语义重复合并。即：**Osmani 与 WorkOS 是同一组工程原则的二手佐证，而非独立信源**。下文把原则归因到可核验的一手源，把这 3 篇当「相互印证但不单独引用」。实践派与学术派指向同一结论，交叉验证了原则稳健性。

> ⚠️ **arXiv ID 提醒**：2606.* 是 2026-06 的 ID（今天 2026-06-20），论文仅数天到数月大，属 2025–26 快速演进前沿，结论可能被后续修订。
> ❌ **被否决的过度版本**（0-3 killed）：「交互式环境是能力持续提升的*唯一*驱动力，而非模型」——过度，修正为「约束瓶颈 / 重心转移」。

---

## 1. 经核验的 8 条核心原则

1. **环境是 agent 能力的约束瓶颈**（3-0）。底座模型饱和后，约束从「模型/prompt」转移到「环境」——反馈回路、评测 harness、权限/产物/预算脚手架。横贯全 6 源的承重论点。
2. **环境工程 4 阶段生命周期**（3-0）：**Modeling → Synthesis（符号合成 vs 神经合成两范式）→ Evaluation → Application**；按 8 属性 × 8 领域刻画环境。
3. **agent-环境协同进化**（3-0）。Agent 侧 4 路径：**记忆中心（经验）/ 编排中心（工作流）/ 轨迹中心（离线）/ 探索中心（在线）**；环境侧 3 范式：神经/难度/规模驱动。未来方向：Environment-as-a-Service、多 agent 环境、神经-符号环境。
4. **GEF 闭环**（3-0）：环境 **G**enerate 任务 → **E**xecute 中返回观测 → 对 rollout 给**评判性 F**eedback 喂回学习。**关键：feedback 必须是「评判性」而非仅「观测性」才能驱动改进。**
5. **EurekAgent 把 harness 拆成 4 工程维度**（3-0）：① **权限工程**（Docker 隔离 + 私有评测 + GPU 管控）② **产物工程**（文件系统 + Git 历史 = 共享长期记忆）③ **预算工程**（wall-clock + API 成本上限）④ **人在环工程**（**低摩擦**观测/介入）。设计目标：**放大有益行为、抑制有害行为（reward hacking、评测篡改、高摩擦人审）**。
6. **评测必须 problem-defined + 防博弈**（3-0）：用不可变私有「真相源」钉死任务与打分（INSTRUCTION.md + SUBMISSION_FORMAT.md + 私有 evaluate.py，**agent 不能改评测器**）。autoresearch 用 `val_bpb`（与词表大小无关）使架构改动被公平打分、无法靠词表 trick 刷分。
7. **固定 wall-clock 预算**（3-0）：autoresearch 训练永远跑满 5 分钟，使异构实验直接可比，且防止 agent「用算力买分数」。
8. **自主发现循环结构**（2-1/3-0）：**Prepare → [Propose 多样假设 → 并行 Implement]×R 轮 → keep/discard 选择 + 排名 carry-forward**。**提案与实现分离**；keep/discard 即自纠错；**手术刀式写面**（autoresearch 只碰 `train.py`）。EurekAgent 实证：**把现成 CLI agent（Claude Code）包进好环境、不改模型就拿 SOTA**——大量能力已在底座 agent 里，环境负责解锁。

---

## 2. 核心诊断：研究透镜 × liye 现状

定性：**liye system 的整条学习闭环是「建好了但从未通电」。**

> **研究说「环境/反馈回路才是能力杠杆」；liye 把绝大部分工程投入压在 harness 的「权限工程」一维上（强到过剩），却让真正的能力杠杆——闭合的评判性反馈回路——处于断电状态。**

### 诊断 A：用 EurekAgent 的 4-harness 维度给 liye 打分

| EurekAgent harness 维度 | liye/AGE 现状（证据） | 评分 |
|---|---|---|
| ① **权限工程** | 15-guard 链 (`AGE guards/__init__.py:57`)、强制 fail-closed S2-A allowlist (`AGE execute_request.py:1054`)、Hard Gate 8 永锁、4 态 Phase-4 gate (`liye_os phase4_entry_gate_check.mjs:104`)、租户隔离 StoreContext、schema 契约 gate (`liye_os validate-contracts.mjs:508`) | 🟢🟢🟢 **世界级，甚至过度投资** |
| ② **产物工程**（Git/FS 当长期记忆） | 基质全建好：fact ledger、evidence-ledger、provenance(commit/branch/dirty `AGE emit_fact.py:359`)、`out/facts/`、~70 个 `trace/exec-*` 收据 | 🟡 **`out/facts/` 空盘——记忆从未写入** |
| ③ **预算工程** | `max_trials_per_day:50`、cost-meter 校验器存在 | 🟡 **有上限，缺「固定可比预算」做策略 A/B 的概念** |
| ④ **人在环工程**（研究强调**低摩擦**） | Sprint 9 readout、11-prereq Phase-4 gate、manifest flip 仪式 | 🟠 **极高摩擦——高到回路从未通电** |

**这张表即诊断本身**：liye 权限维度爆表，产物维度有基质却空，预算维度半成，人在环维度——研究说要低摩擦、liye 刻意高摩擦。后三项相加，导致整个 GEF 回路的反馈半段从未运转。

### 诊断 B：GEF 闭环——liye 有 G、有部分 E、缺评判性 F 的闭合

| GEF 阶段 | liye/AGE 现状（证据） | 缺口 |
|---|---|---|
| **Generate** | 人手跑 asin-growth Step 1→11；无自驱任务生成 | 无自治循环（`AGE write_engine.py` / `loamwise execute/write_engine.py:1-3` 均自陈 "Not an autonomous loop"）|
| **Execute** | 写路径成熟、drift 检测 (`AGE write_engine.py:304`)、逐 action readback (`AGE execute_keyword_actions.py:988`) | ✅ 最强项 |
| **Feedback** | emit_fact 已 live-wire 进 Phase 5.5.2 (`AGE write_engine.py:284`) 但 gate-closed→`disabled_noop`；评判器只产 `NEEDS_HUMAN` (`liye_os policy_trial_evaluator.mjs:477`) | 🔴 **观测性反馈很多（post_change_monitor / readback / drift），评判性反馈闭回学习那段 idle——系统在「观测」但还不「学习」** |

研究第 4 条「feedback 要评判性而非观测性」精准命中：**AGE 不缺观测，缺的是把评判结果闭合回策略的那一环**（读 `LEARNED_BUNDLE_PATH` 的 playbook 全 `status: placeholder`——回路返回半段在代码里就缺 seam）。

### 诊断 C：协同进化 4 路径——liye 只点了 1 个半，且都没通电

| 进化路径 | liye 对应基质 | 状态 |
|---|---|---|
| 记忆中心（经验） | `fact_run_outcome_records.jsonl` | 🟡 基质在，idle |
| 编排中心（工作流） | policy/playbook 进化 | ⚪ 未建（playbook placeholder）|
| **轨迹中心（离线）** | **~70 个 exec 收据 + `out/replay/` golden 案例已在盘** | 🟢 **数据已在，可立即离线学习，无需任何 gate flip** |
| 探索中心（在线） | heartbeat `trialing` flip (`liye_os heartbeat_runner.mjs:150`) | 🟠 Hard Gate 8 锁死 |

**最有价值的实操发现**：4 路径里**轨迹中心离线进化今天就能做**——AGE 盘上已有 ~70 个 exec-* 轨迹和 replay golden，离线从已落盘数据学习**不需翻门、不碰真钱、零激活风险**。

---

## 3. 最高杠杆的进化动作（按"先做哪个"排序）

> 前提：尊重系统刻意的 Pilot-1 治理姿态（`AGE CONTEXT.md:7-9` "governed console with human-confirmed execution"）。**不建议**「翻门冲自治」，而是在不破坏治理哲学的前提下指出杠杆点。

**① 立即可做｜离线轨迹学习（零翻门、零真钱）** ⭐ 推荐起点
研究协同进化第 3 路径 + EurekAgent 产物工程。AGE 已有 ~70 exec 收据 + replay golden。建一个**离线评判 pass**：把历史收据喂进 `policy_trial_evaluator` 逻辑（dry-run 模式本就存在），让评判机器**在真实历史数据上空转**，产出第一批 `policy_trials.jsonl` / `metrics_daily.jsonl`。同时验证「建好但从未通电」的下游管线，完全在 Hard Gate 8 之内。**这是把空盘 `out/facts/` 第一次填上数据、又不碰激活墙的唯一路径。**

**② 中期最大缺口｜为 AGE 合成一个评测环境（replay/模拟器）** ⭐ 研究指向的核心新构件
研究最尖锐的开放问题：autoresearch 的「5 分钟可重跑沙箱」在 AGE 不存在——广告结果**噪声大、延迟、真钱、不可重跑**。对应环境工程第 2 阶段 **Synthesis（符号 vs 神经合成）**：
- **符号合成**：用历史数据建规则型 marketplace 模拟器；
- **神经合成**：LLM 生成反事实场景。

AGE 已有种子（`out/replay/`、`trace/.baselines/`、`eval/asin-growth/case-index.json`、`measurement_baseline.json`）。**一个合成的广告评测环境 = AGE 缺失的「5 分钟沙箱」**，让策略候选在碰真钱前被廉价、防博弈地打分。研究能给 AGE 的**最大单点新构件**。

**③ 硬问题｜防博弈的广告 reward 信号**（对应 autoresearch `val_bpb`）
ACOS/ROAS 极易被博弈（暂停全部 → ACOS 漂亮但销量死；归因窗口可挑樱桃）。AGE 需一个「与词表无关」的广告版指标——portfolio 级（marketplace-growth skill 已有）、holdout/对照组、固定测量窗口的复合指标。**liye 的评判器架构本身已是教科书级防篡改**（读冻结 `confidence_formulas.yaml` 而非硬编码、canonical byte-equal 哈希、fail-closed），缺的是**领域指标层**的防博弈设计。

**④ 战略｜双速回路，调和「低摩擦人在环」与「高摩擦 Pilot-1 门」**
EurekAgent 说人在环要低摩擦；liye 刻意高摩擦。两者不矛盾——EurekAgent 在无真钱沙箱里，liye 碰真实广告预算。但研究警告成立：**摩擦高到回路从不通电 = 零经验数据 = 按核心论点零能力增长**。解法 = liye 已有的 **Two-Speed** 概念落地：**低摩擦/廉价/防博弈的离线评测内环（无门）+ 高摩擦/gated 的真钱执行外环（守 Hard Gate 8）**。①②③ 全落在内环，外环治理姿态完全不动。

**⑤ 战术｜固定预算做公平 A/B**（对应 autoresearch 固定 5 分钟）
策略 A/B 时锁死预算+测量窗口+ASIN 队列，使改进可归因于策略而非额外花费/更长窗口。`measurement_baseline.json` + `post_change_monitor --check-day 1` 骨架已在，研究告诉你把「预算+窗口固定」补成显式不变量。

**✅ 顺带验证了 liye 架构赌注是对的**：EurekAgent 实证「把现成 CLI agent 包进好环境、不改模型 → SOTA」。这**正是 AGE 的形状**（治理层包 Claude Code）。研究说这形状高杠杆、能达 benchmark 级——liye 架构选择被一手实证背书。差别只在：**EurekAgent 的环境通了电且高产，liye 的同构环境断着电。**

---

## 4. 悬而未决的硬问题（研究留给 AGE 的）

1. **防博弈的领域 reward 怎么造**：隐私+不可变+词表无关之外，如何硬化广告 ROAS/ACOS 信号防 gaming？（开放设计题）
2. **固定预算/防博弈指标怎么跨域迁移**：从 ML 研究（确定、廉价、可重跑）到 AGE（噪声、延迟、真钱、不可重跑），「固定可比预算」与「不可变私有评测器」的广告版对应物是什么？→ 正是 **动作 ②（合成评测环境）** 要回答的。
3. **两套四元体系的关系**：survey 的「生命周期(modeling/synthesis/eval/application)」vs「agent 进化路径(memory/orchestration/trajectory/exploration)」——哪个该映射到 liye 学习架构？需读论文正文确认 crosswalk（摘要未给）。

---

## 5. 引用源

**一手（已核验）**
- arXiv:2606.12191 — Agentic Environment Engineering Survey — https://arxiv.org/abs/2606.12191
- arXiv:2606.13662 — EurekAgent — https://arxiv.org/abs/2606.13662 ；官方 repo https://github.com/THU-Team-Eureka/EurekAgent
- arXiv:2511.09586 — Environment Scaling / GEF loop（bonus）— https://arxiv.org/pdf/2511.09586
- Karpathy autoresearch — https://github.com/karpathy/autoresearch

**二手（佐证但核验存疑，不单独引用）**
- Addy Osmani, Loop Engineering — https://addyosmani.com/blog/loop-engineering/
- Addy Osmani, Agent Harness Engineering — https://addyosmani.com/blog/agent-harness-engineering/
- WorkOS, Boris Cherny on Claude Code — https://workos.com/blog/boris-cherny-claude-code-acquired-interview-takeaways

**代码库证据**：AGE `amazon-growth-engine/`（write_engine / execute_request / emit_fact / guards / CONTEXT.md）、liye_os `.claude/scripts/learning/` + `_meta/contracts/scripts/`（heartbeat_runner / policy_trial_evaluator / phase4_entry_gate_check / validate-contracts）、loamwise `execute/` + `task_ledger/` + `govern/`。具体 `file:line` 见 §2 各表。

---

## 6. 补充（2026-06-20）：基于技术博主解读的 3 个增量

> 来源：架构师（老李），《Harness工程还没喘息，Environment工程已然登场》，2026-06-19，微信公众号。该文解读同一批 6 份资料，与本报告 §1 八条原则、GEF 闭环、reward-hacking、防博弈评测高度重合；以下仅记录**真正的增量**。

### 增量 1：「Self-Harness」——焦点外移阶梯多了一级

博主主线是一条 6 级阶梯：`Prompt → Context → Harness → Loop → **Self-Harness** → Environment`。本报告原缺 **Self-Harness** 一级——指 agent 改写自己的运行规则/harness（"结构升级、规则更新"），区别于 Loop 的"任务持续推进"。

**反转洞察（对 liye）**：liye 恰是 self-harness 机制**极其丰富**的系统——GHL 学习回路更新 policy、heartbeat 翻自己的 `execution_mode` flag、SPEC→IMPL 治理仪式本身就是"系统改写自己规则"。更精确的诊断因此是：**liye 不缺 self-harness 的"手"（治理改写机制完整），缺的是下游 Environment 的"眼睛"（通电的环境反馈）给改写提供依据——能改自己，却无真实环境信号指明往哪改，进化机制在盲跑。** 比 §2「断电」诊断更锋利。

### 增量 2：「Environment Contract」——可直接落地的声明式契约（最有价值）

博主把 EurekAgent 4 维度收敛成**一份声明式契约**（以 `ci-failure-triage` 为例）：

```
Environment Contract
Name: ci-failure-triage
Goal: classify CI failure, propose minimal fix, leave reproducible evidence

Readable state:   repository files (read-only) / CI logs (read-only) / previous attempts (read-only)
Writable state:   working branch only / evidence note under agent path
Allowed actions:  inspect files / run selected tests / edit candidate fix in isolated worktree / produce patch summary
Blocked actions:  push to main / delete tests without explicit approval / touch production secrets / modify evaluator scripts
Evaluators:       unit tests / type check / targeted regression command / human review before merge
Budget:           max 3 repair rounds / max 20 min wall-clock / stop on repeated same failure
Memory policy:    write verified facts only / mark unverified assumptions / never persist secrets or raw customer data
Human handoff:    permission escalation / evaluator conflict / production-impacting change / unclear requirement
```

**关键洞察**：liye 已把该契约**每个字段都实现成散落的机制**，但从未**收敛成"每个环境一份"的单一声明**：

| Environment Contract 字段 | liye 已有的散落实现 |
|---|---|
| Readable/Writable state + Allowed/Blocked actions | S2-A allowlist + 15-guard matrix + Hard Gate 8 |
| Evaluators | `policy_trial_evaluator.mjs` + `confidence_formulas.yaml` |
| Budget | `max_trials_per_day` + cost-meter 校验器 |
| Memory policy | fact ledger + provenance(commit/branch/dirty) |
| Human handoff | operator review gate |

→ 这正是 §3 动作②（合成评测环境）缺的拼图；Environment Contract 就是"合成环境"的 schema。loamwise `dispatcher_contract` 只是其一半（actions）。**建议构件：`_meta/contracts/` 下新增 `environment_contract.schema.yaml`，把 AGE 广告优化环境显式声明成一份契约。**

### 增量 3：「先做小环境」——比真钱广告更稳的首环境候选

博主建议第一个环境别挑大的，选**输入有边界 / 输出可量化 / 副作用局部 / 失败成本可控**的小项目（候选：CI 失败分类、文档置换检查、依赖升级排错、issue 重现复盘、技术债清理、数据迁移对置）；回避高耦合生产库、大量密钥、需大量隐性人判断的过程。

**对 liye 的价值**：§3 动作①是"AGE 历史数据离线轨迹学习"；博主给出**互补且可能更优先**的首环境——**用 liye 自身内部开发循环当第一个"通电"的真实环境**：
- 完全不碰真钱/真广告，比 AGE 广告环境**低一个量级风险**；
- liye 自带大量 CI（validate-contracts、ghl-cbu-door2-ci、28 workflow），**CI 失败本身即边界清晰、可量化、副作用局部的现成环境**；
- 让"建好但从未通电"的 GEF/学习机器在**零真钱风险**下先转起来、被验证，再迁移到高风险广告环境。

与 EurekAgent 闭合（其环境本就是软件工程/科学发现任务）。**结论：liye 可先在自身软件工程治理循环里建第一个 Environment，而非一上来挑战 Amazon 广告这个噪声大、真钱、不可重跑的环境。**

### 纪律差异（本报告不采纳博主之处）

博主把 6 源（含 Osmani×2、Boris Cherny）**不加区分当作等效真实源**引用并给出其具体论点。本报告对抗核验**无法独立证实**这 3 源（见 §0）。保留纪律：博主所述视为"对那 3 篇的合理解读/猜测"，**不升级为已证实事实**。

---

*生成方式：`/deep-research` workflow（run `wf_530ec358-59a`）+ 三层 Explore 测绘 + 技术博主解读补充（§6，2026-06-20）。如需就动作①/③或 §6 增量3（CI-triage 首环境）展开为可执行 spike，或新增 `environment_contract.schema.yaml`，或将本文升级为 ADR，另起 session。*
