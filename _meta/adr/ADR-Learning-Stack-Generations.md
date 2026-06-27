---
artifact_scope: meta
artifact_name: Learning-Stack-Generations
artifact_role: contract
target_layer: 0
is_bghs_doctrine: no
---

# ADR-008 — 学习-治理栈多代并存的对账与取代（Learning Stack Generations）

> 文件名采非数字前缀（`ADR-Learning-Stack-Generations.md`）以进入 CI-wired BGHS frontmatter gate 的有效扫描域；"008" 仅为 track 内顺序记号，留在标题。

**Status**: Accepted
**Date**: 2026-06-10
**Accepted-Date**: 2026-06-12
**Decision Makers**: LiYe
**SSOT**: 本文件（裁决后）；上游 lifecycle SSOT = `_meta/adr/ADR-Governed-Heuristic-Learning.md`
**References**:
- N-1 (Normative): `src/governance/learning/` 四模块实读（tier_manager / drift_monitor / execution_gate / kill_switch），git last-touch `2026-02-19 21:24 +0800`（PR #117 "week 3 tier/drift/kill governance closed-loop"，GitHub API `repos/liyecom/liye-ai/pulls/117` merged_at `2026-02-19T13:24:07Z`；`commits?path=src/governance/learning` = 单 commit `b2aa7559`）—— v0 "week 3" 栈
- N-2 (Normative): `.claude/scripts/learning/{policy_crystallizer_v0,promotion_v0,pattern_detector_v0,learning_pipeline_v0_runner}.mjs`（"week 6" v0.1 实验栈，休眠）—— **0.2/0.3/0.5 confidence 公式真身 = `policy_crystallizer_v0.mjs:78`**；promotion_v0 = 第三个 policy-lifecycle 实现（sandbox→candidate，`renameSync` over `state/memory/learned/policies/`，自带 `state/runtime/learning/promotion_log.jsonl`）
- N-3 (Normative): `_meta/adr/ADR-Governed-Heuristic-Learning.md`（Accepted 2026-05-19）—— GHL = policy lifecycle 现行权威（v1 sealed 栈）
- N-4 (Normative): `_meta/contracts/learning/policy_lifecycle_event_v1.schema.yaml`（sealed，已注册 validate-contracts schemaFiles[]，`_meta/contracts/scripts/validate-contracts.mjs:523`）—— **零 producer**（2026-06-10 实测：`grep -rln "policy_lifecycle" src/ .claude/scripts/ scripts/` 排除 .md + schema 自身后 0 命中）
- N-5 (Normative): `src/adapters/write_executor/index.mjs:23` —— `import { preflightCheck } from '../../governance/learning/execution_gate.mjs'`（v0 栈唯一**生产代码 import** 消费者，2026-06-10 实测）
- N-6 (Normative): `_meta/contracts/learning/confidence_formulas.yaml` L44-49（GHL SSOT，4 权重 0.2/0.3/0.4/0.1，loader 强制 sum=1.0）
**Supporting References**:
- S-1: `tests/governance/test_week3_tier_drift_kill.mjs`（**CI-wired** via `.github/workflows/execution-tiers-gate.yml:95`）+ `tests/governance/test_execution_gate_hardhook.mjs`（**manual-only**，无 workflow/package.json 引用）—— v0 栈的 2 个测试套件
- S-2: 2026-06-02 Agentic Design Patterns × liye 代码库交叉分析（24-agent workflow，session-local id `wf_92441d58`，**无落盘 transcript**；承重事实以 2026-06-10/06-11 主线程逐项落盘实测为准，非以该 workflow 自证）
**Commit anchor**: 概念锚定 = PR `liyecom/liye-ai#165` 的 post-squash merge commit 成为 durable anchor（对齐 ADR-GHL 教条「the post-squash merge commit becomes the durable anchor; no pre-squash SHA is normative」）。**Accept≠merge（EVO-B B-01/B-04）**：Accept 时 anchor=pending（#165 当时仍 open，frontmatter **不预编 SHA**）；#165 已于 2026-06-13T08:53:17Z（16:53:17 CST）由 `liyecom` squash-merge，post-squash merge SHA 回填 = **`e3b692b`**（full `e3b692b1ec389c9752b4598176a3681ca8e15ae3`）= 本 ADR 的 durable commit anchor（concept-anchor 于 merge 即生效，本行为显式 SHA 回填收尾，docs-only follow-up）。

---

## Context

liye_os 内现存**三层**学习-治理 lifecycle 实现 + **三处** kill_switch 实现，彼此零交叉引用、概念重叠、行为规范相左。

### 第 1 层 — v0 "week 3" 栈（2026-02-19，PR #117，`src/governance/learning/`）
| 模块 | 职责 | 关键行为（实测） |
|------|------|---------|
| `tier_manager.mjs` | observe→recommend→execute_limited 晋升 | 3 信号 **rate 评估 + 阈值门**（exec/operator/business，`execution_tiers.yaml` promotion_criteria）；**消费**预计算 `policy.confidence`（:225），本身**不含**权重公式；晋升 = 物理移动 YAML 工件（`unlinkSync` :296） |
| `drift_monitor.mjs` | 漂移检测 + 自动降级 | 降级 = 物理移动工件（`writeFileSync`+`unlinkSync` :226-229；`renameSync` 为**未使用的 dead import** :19）；`isDriftBlocked()`（:421-453，只读 existsSync/readFileSync）给 execution_gate 提供 24h freeze 信号。**（D-11/EVO-D：本文件已物理退役——死面 :226-229/:19 锚 git-history `4179ef1`；isDriftBlocked :421-453 已迁 `drift_enforcement.mjs`，字节冻结）** |
| `execution_gate.mjs` | 分级 preflight 授权（5 检查链） | fail-closed；被 `write_executor/index.mjs:23` 生产 import（N-5）；preflight 落盘仅 append-only gate facts |
| `kill_switch.mjs` | 紧急写路径中断 | ENV > state file > default 优先链；fail-closed；append-only facts |

### 第 2 层 — v0.1 "week 6" 实验栈（休眠，`.claude/scripts/learning/*_v0.mjs`）
- `policy_crystallizer_v0.mjs`：**0.2/0.3/0.5 confidence 公式真身**（:14 header / :78 `0.2*execRate + 0.3*operatorRate + 0.5*businessRate`）——与 GHL SSOT（4 权重，N-6）分叉。
- `promotion_v0.mjs`：**第三个 policy-lifecycle 实现**（:6 "manages policy lifecycle transitions"，sandbox→candidate，`renameSync` over `state/memory/learned/policies/`，自带 `promotion_log.jsonl` :29 + 自有 criteria :40-47）——与 tier_manager 的晋升权威重叠。
- `pattern_detector_v0.mjs` + `learning_pipeline_v0_runner.mjs`（runner 经 execSync 串接三者）。

### 第 3 层 — v1 GHL sealed 栈（活跃，2026-05-19 Accept → 2026-06 持续推进）
`src/reasoning/policy_trial_evaluator.mjs` + `.claude/scripts/learning/` sealed chain（import_facts / canonical_json / heartbeat_runner / metrics_daily_producer / d11_rolling_30d_producer / phase_1_exit_gate_check / phase4_entry_gate_check / operator_feedback_ingest / trial_observation_predicate）：confidence = SSOT `confidence_formulas.yaml`（N-6）；状态 = append-only JSONL + sealed schema + 确定性门禁。lifecycle 事件契约 `policy_lifecycle_event_v1` 已 sealed 入门禁——**但全仓零 producer**（N-4）。

### kill_switch 三实现
除 v0 栈的 `src/governance/learning/kill_switch.mjs`（ENV `LIYE_KILL_SWITCH`），另有两套：
- `.claude/scripts/proactive/kill_switch.mjs`（ENV `EXECUTE_LIMITED_ENABLED`，:29 与 governance 版共享**同一** state file `state/runtime/proactive/kill_switch.json`，生产消费者 = `execute_limited_gate.mjs:87` + `generate_pr_evidence.mjs:410/427/446`）。
- `src/runtime/execution/kill_switch.mjs`（ENV `KILL_SWITCH`，`BLOCKED_ACTIONS=['suggest','live_write','retry','replay']`，**独立 ENV-only、无 state file**；`checkKillSwitch` **仅经** `write_gate.mjs:384` `checkWriteGateP6C` 调用 = **P6C supervised-write gate path**（test-exercised via `test_write_gate_p6c.mjs`，CI-wired `reasoning-assets-gate.yml`；⚠ `checkWriteGateP6C` 当前**无生产调用者、仅该测试覆盖** → runtime kill_switch 现不在任何生产执行路径，但仍是 P6C 接生产即生效的 enforcement 原语），**NOT default feishu 链**——真实 feishu 链 `feishu_actions.mjs:39 → real_executor.mjs:166` 用 plain `checkWriteGate`、**不调本模块**（EB-02/D-10 更正原「→ real_executor → feishu 活生产链」过度声称；实证 runtime kill_switch.mjs:8-11 header + write_gate.mjs:19 "P6-C Gate import"）；git last-touch PR #90 2026-01-31，异于 v0 #117）。**EVO-B ceremony DEP-02 实扫补入**——原 ADR 漏数此第三套。

同名概念**三权威**——三套 ENV/state/消费链全异，集群间 grep 互引=空（zero-cross-ref 不变量仍成立，但是 **3 路分区非 2 路**）。

### 并存的实证状态（2026-06-10/06-11 复核）
1. **零交叉引用**：三层之间 + kill_switch 三实现之间无 import 交叉（v0 四模块只 import fs/path/url/yaml + 彼此；GHL 全链不引用 v0/v0.1；`cost_meter.mjs:16` 仅概念性提及 kill_switch，无 import）。
2. **v0 非孤儿但近休眠**：唯一**生产 import** 消费者 = write_executor preflight（N-5）；另有 CI smoke 直接执行 tier_manager（`execution-tiers-gate.yml:150`，`|| true` 非阻断）+ `execution_tiers.yaml:95/102` 的 `tier_manager_approval` token（config 语义耦合，D-A2 后成死配置）+ S-1 测试。模块本体 2026-02-19 后零提交。
3. **v0.1 实验栈休眠**：无生产消费者；crystallizer_v0 的 confidence 数学与 SSOT 分叉且互不知晓。
4. **行为规范相左**：v0/v0.1 的晋升/降级靠**破坏性文件移动**（无 lifecycle 事件落盘，违背 append-only 审计底色）；confidence 数学双源分叉（crystallizer_v0 的 0.2/0.3/0.5 vs GHL SSOT 的 0.2/0.3/0.4/0.1）。
5. **同名概念多权威隐患**：「policy promotion」（tier_manager + promotion_v0 + GHL）、「confidence」（crystallizer_v0 + GHL SSOT）、「drift demotion」、「kill switch」（**三实现**）各有多套定义，均躺在最像权威的路径下。任何会话/agent/文档误把休眠实现当现行权威 → provenance 污染 + 审计误判。

### 为什么现在裁决
GHL Phase-4 entry gate 已 ship（idle），production-unlock 决策窗临近。在 Hard Gate 8 解锁评估前，「policy lifecycle 唯一权威是谁」必须无歧义。多套同名安全子系统无标记并存，是 Phase-4 → exec SPEC 链路上的认知债。

## Decision（Option A——分拆-取代）

> **一句话**：enforcement 原语留任，learning lifecycle 让位；GHL（v1 sealed）成为 policy lifecycle 唯一权威，v0 + v0.1 的 lifecycle/confidence 模块显式标记 superseded。

- **D-A1（enforcement 原语留任）**：`execution_gate.mjs` + **三处 kill_switch 实现**（governance/learning + proactive + runtime/execution）是**活的 enforcement 原语**（非 learning lifecycle），保留现状——write_executor 生产依赖（N-5）+ proactive 消费者（execute_limited_gate/generate_pr_evidence）零触碰。物理搬迁显式 deferred（⚠ **D-11/EVO-D 解冻例外**：`drift_monitor.mjs` 这一支的物理搬迁——isDriftBlocked 抽取 `drift_enforcement.mjs` + 死面删除——已由 D-11 授权落地；其余 superseded 文件 + 三处 kill_switch 仍 deferred）。本 ADR 只做**语义重分类**：在 `src/governance/learning/kill_switch.mjs`、`.claude/scripts/proactive/kill_switch.mjs` **及** `src/runtime/execution/kill_switch.mjs` 三处文件头标明「enforcement primitive, not learning lifecycle」（第三套 DEP-02 ceremony 补入；它经 `write_gate.mjs:384` `checkWriteGateP6C` 的 **P6C supervised-write gate path**——**非 default feishu 链**，EB-02/D-10 更正——属活的紧急停机 enforcement 原语，行为零触碰）。
- **D-A2（lifecycle 模块 superseded）**：`tier_manager.mjs` + `drift_monitor.mjs`（v0）+ **整个休眠 v0.1 learning pipeline**（`policy_crystallizer_v0.mjs` / `promotion_v0.mjs` / `pattern_detector_v0.mjs` / `learning_pipeline_v0_runner.mjs`，后 2 件经 D-08 reverse-dep 重扫扩入）标记 **Status: superseded-by-GHL**，不再作为任何 policy promotion/demotion 权威。`pattern_detector_v0` + `learning_pipeline_v0_runner` 是 v0.1 栈的**内部实现件**（runner 经 execSync 串接三者、`main()` CLI、零外部消费者，唯一历史消费者 heartbeat v1 已被 Phase-1d v2 切断）——一并标记，杜绝"只标 2 件、runner 仍可执行"的**假 Interface 残留**（experimental stack retired，整栈 1 个 Interface 而非半标记的混态）。未完成的概念价值（自动降级、漂移冻结、sandbox→candidate 晋升）转登 GHL backlog（2b/2c 候选）按 GHL 规范重生。**（D-11/EVO-D 更新）**：`drift_monitor.mjs` 已**物理退役**（整文件删）；其唯一 live face `isDriftBlocked()` 不随之消失而是逐字节迁入新文件 `src/governance/learning/drift_enforcement.mjs`——**该新文件是 fresh 非-superseded 的只读 enforcement 原语（非本条 superseded-list 成员）**，superseded 的是被删的主动降级/CLI 死面。
- **D-A3（依赖边处置）**：execution_gate → drift_monitor 的 `isDriftBlocked` 依赖**保留**（drift_monitor 降格为只读库；只读路径仅当 `policyId` 非空且 `actionType=WRITE_LIMITED` 触发，execution_gate.mjs:266；其降级主动路径随 D-A2 冻结）。**（D-11/EVO-D reconcile）**：该读边保留不变，但物理落点改为 execution_gate → **`drift_enforcement.mjs`** 的 `isDriftBlocked`（isDriftBlocked 逐字节迁出退役的 drift_monitor.mjs；行为冻结、字节级回归 under Hard Gate 1）；契约串 `denied_by/check='drift_monitor'` 与文件名解耦、字节不变。`execution_tiers.yaml:95/102` 的 `tier_manager_approval` token 处置（删/标记死配置）入 EVO-C scope。
- **D-A4（lifecycle writer 落点）**：`policy_lifecycle_event_v1` 首个 producer **不** retrofit 进 v0/v0.1 栈（不给 superseded 代码镀金），随 GHL 首个真实 promotion 实现（2b/2c）落地。破坏性移动债随 D-A2 冻结自然退役。**审计连续性澄清（EVO-B AC-01，红队证伪"审计空窗"忧虑）**：superseded 路径即便 live 执行，其状态变更仍各落 legacy append-only 轨迹（`fact_tier_decisions.jsonl` / `fact_drift_events.jsonl` / `promotion_log.jsonl`）；D-A4 拒绝的是把 sealed `policy_lifecycle_event_v1` producer 镀金进退役码——是 **schema 碎片化，非审计黑洞**，绝不容忍无记录的状态变更。
- **D-A5（confidence 数学单一权威）**：`confidence_formulas.yaml` 是 confidence 唯一 SSOT。**`policy_crystallizer_v0.mjs` 的 0.2/0.3/0.5 公式（:78）随 D-A2 标记 superseded**（crystallizer_v0 文件头加 superseded 标记，列入 EVO-C D-1 清单），禁止任何新代码引用；其概念价值由 GHL 2b shadow→2c cutover 承接（参 ADR-GHL）。
- **D-A6（测试处置）**：S-1 两套测试保持绿色。`test_week3_tier_drift_kill.mjs`（CI-wired）的 tier/drift 晋升-降级用例标记 legacy。`test_execution_gate_hardhook.mjs` 当前 manual-only——它恰是保护 write_executor→execution_gate 边（Hard Gate 1 所依赖）的套件——EVO-C 期将其 CI-wire（comment/test-marking scope 兼容 Hard Gate 4）。**（D-11/EVO-D 更新）**：hardhook 已于 EVO-C CI-wire（BLOCKING）；week3 的 **drift 两例（Test7/8，execSync 退役的 drift_monitor CLI）随文件删除升级为「删除」**（tier 用例仍 legacy 标记）；isDriftBlocked 读面覆盖迁新 `tests/governance/test_drift_enforcement.mjs`（三分支 + 路径同一性，CI-wired BLOCKING）。

### 被否选项
- **Option B（retrofit v0/v0.1）**：给 tier_manager/promotion_v0 补 lifecycle-event 写入 + confidence 对齐 SSOT。否——平行维护多套 lifecycle 权威，GHL 已以更高规范覆盖同一问题域；投入喂给注定退役的代码。
- **Option C（status quo + 仅文档备注）**：否——「最像权威的路径上躺着多套非权威实现」的误导面没消除；Phase-4 unlock 前认知债必须显式清偿。

## Hard Gates（执行约束，EVO-C 期生效）
1. write_executor → execution_gate 链路行为 **0 变化**（preflightCheck 字节级回归）；**三处 kill_switch 消费者行为 0 变化**（含 `src/runtime/execution/kill_switch.mjs` 经 `write_gate.mjs:384` `checkWriteGateP6C` 的 **P6C supervised-write gate path**——**非 default feishu 链**，EB-02/D-10 更正，DEP-02）。
2. GHL frozen 锚点 **0 触碰**（File-B `scripts/heartbeat_runner.mjs` 等全清单 0-diff）。
3. validate-contracts gate 计数**不因本 ADR 变化**（本 ADR 零 schema 增删）。
4. 全部改动 = 注释/文档/测试标记级（surgical scope）；任何超出（如物理搬迁、token 删除影响 config 校验）须回本 ADR 增补 Decision Log。

## Layer mapping
Layer 0（liye_os 内部）；不触 loamwise / domain engines / 产品线。engine_manifest 协议不受影响。

## BGHS classification
非 doctrine；操作性架构对账。与 ADR-GHL 关系 = 从属（GHL 是 lifecycle 权威源，本 ADR 清除其历史影子）。

## Decision Log
- D-01 (2026-06-10): 起草。触发源 = S-2 交叉分析发现多代栈零交叉引用 + 行为规范相左。
- D-02 (2026-06-10): 否决"整栈归档"初案——N-5 + execution_gate→drift_monitor 依赖边证明不可整体下线；改为分拆-取代（D-A1..A6）。
- D-03 (2026-06-11，红队 fold)：**confidence 公式归因更正**——0.2/0.3/0.5 在 `policy_crystallizer_v0.mjs:78` 而非 tier_manager（后者只消费 `policy.confidence`:225）；据此把架构债从"两代"扩为"三层 lifecycle + kill_switch 双实现"，D-A5 superseded 范围扩至 crystallizer_v0。
- D-04 (2026-06-11，红队 fold)：**tier_manager 消费者更正**——非"无外部消费者"；存在 CI smoke（execution-tiers-gate.yml:150）+ execution_tiers.yaml token（:95/102）+ promotion_v0 权威重叠；据此 D-A2 纳入 promotion_v0，D-A3 纳入 token 处置。
- D-05 (2026-06-11，红队 fold)：**frontmatter/文件名更正**——原 `ADR-008-*.md` 数字前缀 + `target_layer: layer0` 会逃过 BGHS CI gate（validator scope = 非数字前缀，VALID_LAYERS={0,1,2,3,cross,none}）；重命名为 `ADR-Learning-Stack-Generations.md` + `target_layer: 0`。Accept 前须 `node .claude/scripts/validate_adr_bghs.mjs` 验证通过。
- D-06 (2026-06-11，operator-review fold，5-finding 独立复核 `wf_eb8f954a`)：3 处 doc-only 更正（0 schema/gate/code 影响）。**(a) 交叉引用** R-3a 落点 EVO-C D-4→D-6（D-4 实为 hardhook CI-wire，D-6 才是 GHL backlog 落档，EVO-C SPEC:20/:22 实测）。**(b) kill_switch 计数措辞** Required-Corrections 清单从「2 处 kill_switch」改为「EVO-C D-2 3 文件（execution_gate + 2 处 kill_switch）」以对齐 D-2 全范围。**(c) token 处置门** Risk Register「改动须过 validate-execution-tiers.mjs」是 no-op——该 validator `validate()` 7 检查零解析 `transitions[].requires`（实测），token 在/删/半删恒 PASS；改以 grep/golden 断言实证（EVO-C D-5 fold）。⚠ 复核同时**证伪 operator 一处锚点**：`tier_manager_approval` 在 `execution_tiers.yaml:95/:102`（均 `transitions[].requires` 下），**非 operator 所报 :88**（:88 是 `- WRITE_LIMITED` allowlist 条目行，非 token）——D-A3/Risk Register 原锚 :95/102 正确，保留。
- D-07 (2026-06-11，EVO-B ceremony fold，4-lens 机制验证 `wf_b90f4c8c`，25 agents/1.56M tok)：5 处 doc-only 更正（0 schema/gate/code 影响）。**(a) DEP-02 CONFIRMED** kill_switch 实为**三实现**非双——补 `src/runtime/execution/kill_switch.mjs`（ENV `KILL_SWITCH`，经 `write_gate.mjs:20→real_executor→feishu` 活生产链，PR #90，独立 ENV/无 state file，异于另两套）；Context/D-A1/Risk/Required-Corrections/Hard-Gate-1/Non-goals 计数全部 2→3，D-A1 三处文件头、EVO-C D-2 升 4 文件。第三套是 enforcement 原语（同 D-A1 类），不威胁取代核心，但 ADR 自述要消除 kill_switch 多权威却自身漏数 → 须修。**(b) AC-01** D-A4 审计连续性澄清（红队**证伪**"审计空窗"忧虑：superseded 路径仍各落 legacy append-only 轨迹，schema 碎片化≠审计黑洞）。**(c) B-01/B-04** commit-anchor 时序澄清——Accept≠merge（Accept 时 #165 仍 open，cooling 过后才 merge，post-squash SHA 须 merge 后回填，frontmatter 不预编 SHA）。⚠ ceremony adversarial verify **证伪了 finder 的 HIGH「Accept-blocking 悖论」框定**（house ADR-GHL L33 本就概念锚定、不落 SHA 值且 Accepted 在跑）→ 降级为 clarity fold，按 operator 显式要求保留回填路径文字。**(d) B-02** Accept 三锚点同步 checklist（validator 仅覆盖 frontmatter Accepted-Date，文末 Lifecycle 块在扫描域外）。**(e) B-03** draft cooling 起点=本 ADR draft 落盘日 2026-06-10。GHL 边界 lens 5 findings 全 REFUTE/NOTE=coverage proof（决策边界纪律干净、零 implementation creep、SSOT 权重逐位一致、无虚构 GHL scope、概念移交非冗余）。3 项 DEFER_TO_EVO_C（DEP-03 schema:70 非消费者标注 / AC-04 runbook live 命令弃用 / promotion_v0 logPromotion best-effort cleanup）记入 EVO-B `CEREMONY-RECORD.md` + EVO-C Entry criteria。决策面 **DECISION_HOLDS**（Option A 三支柱机制层成立，B-06 验证）。
- D-08 (2026-06-13，EVO-C 入场 reverse-dep 重扫 fold，doc-only)：EVO-C entry criterion 2 的全仓 reverse-dep 重扫（直接扫 + 5-模态对抗 Workflow `wf_24862c1f`，6 agents/451K tok，HEAD `0a4f7e7`）。**结果**：8 标的（4 lifecycle + 4 enforcement）**ZERO 新外部消费者**——所有可执行边全落 baseline（`write_executor:23→execution_gate` / 内部 v0 边 / proactive kill_switch await-import / runtime kill_switch via `write_gate.mjs:20` checkKillSwitch / CI smoke `||true` + S-1 / runner intra-stack execSync）；**GHL 边界 clean**（零 GHL-frozen learning 文件 import 8 标的，三层零交叉成立）。**真发现 = enumeration gap（非危险隐藏消费者）**：v0.1 stack 的 **actionable superseded 清单漏数 2→4**——N-2/Layer-2 散文本列全 4 个 v0.1 模块，但 D-A2/D-A5/EVO-C-D-1 的 actionable 清单只圈 crystallizer_v0 + promotion_v0，漏 `pattern_detector_v0.mjs`（仅 runner 消费；`getBucketId` 在 seed_runs 是本地同名 collision 非 import）+ `learning_pipeline_v0_runner.mjs`（execSync 编排器、`main()` CLI、**零外部消费者**——唯一历史消费者 heartbeat v1 commit `97f58f7` 已被 Phase-1d v2 重写切断，`heartbeat_runner.mjs:27` 头显式声明不再编排 pipeline；dormancy 5/5 searcher + 对抗 searcher 机制级确认）。**operator 裁决 (a)**：runner+detector 是 v0.1 这个 Module 的内部实现而非独立 Module，只标 crystallizer+promotion 会留"runner 仍可执行"的假 Interface（低 Locality，比多两行注释更危险）→ 一并标 superseded（v0.1 experimental stack retired）。据此 **D-A2 扩入整个 v0.1 pipeline（4 模块）** + R-2/Required-Corrections 的 **EVO-C D-1 4→6 文件** + Risk Register wording 同步；**D-A5 保持 confidence-specific 只点 crystallizer_v0**（不把 detector/runner 说成 confidence module）；**D-2 enforcement 清单 4 文件不变**。3 个 non-module-edge 旁注（留 EVO-C D-2 知会，非新消费者）：`scripts/heartbeat_runner.mjs:33` + `s15_production_canary.mjs:57` 内联读 `LIYE_KILL_SWITCH` ENV（ENV-name 复用，非 import kill_switch.mjs）；`reasoning-assets-gate.yml:62` 是跑 baseline `test_kill_switch.mjs` 的第 2 个 CI surface。0 schema/gate/code 影响，不 flip 任何 lifecycle 状态，不启动 EVO-C IMPL。
- D-09 (2026-06-13，EVO-C gate-truthfulness ceremony fold，`wf_87d90bd2` Lens-3 机制实证)：授权 D-5 采 Option 2（扩 validator + 删 token），作为 in-EVO-C-scope 的有据偏离 Hard Gate 4。依据：`validate-execution-tiers.mjs` `validate()` 实测零解析 `config.transitions`/`.requires`（token 在/删/半删/注入垃圾恒 EXIT 0，no-op 门已 D-06(c) 锚定）。Option 2 = (a) 扩 `validateTransitionTokens()` walk `transitions[].requires`，对不在 live-token allowlist `{criteria_met, operator_explicit_approval, drift_detected, operator_request, consecutive_failures, kill_switch_active, drift_critical}` 的孤儿 token fail-closed（exit 1）+ (b) 删 `execution_tiers.yaml:95/:102` 的 `tier_manager_approval`（唯一孤儿）。二者必须同 PR 耦合（实测：留 token+walk→errorCount=2/EXIT 1 破门；删 token+walk→0/EXIT 0 过门）。Hard Gate 4 / Risk Register 显式点名「token 删除影响 config 校验」须 Decision Log 增补——本条即增补，非新 ADR。LIVE-PATH 0 影响（execution_gate 读 `tiers` 非 transitions，`write_executor:23→preflightCheck` 链字节级回归；tier_manager 休眠且仅读 `promotion_criteria` 不读 transitions，token 无任何运行时执行者）。gate 计数 0 变化（validate-contracts schemaFiles 仍 21，独立 validator/workflow）。0 schema 增删。
- D-10 (2026-06-14，EVO-C IMPL code-review fold，3-finding 独立复核)：**runtime kill_switch 路径描述更正（EB-02）+ 2 项实现卫生**。**(1) 路径更正**：`src/runtime/execution/kill_switch.mjs` 的 `checkKillSwitch` **仅经** `write_gate.mjs:384` `checkWriteGateP6C` 调用 = **P6C supervised-write gate path**（test-exercised via `test_write_gate_p6c.mjs`，CI-wired `reasoning-assets-gate.yml`），**NOT default feishu 链**——真实 feishu 链 `feishu_actions.mjs:39 → real_executor.mjs:166` 用 plain `checkWriteGate`、**不调本模块**。三方一致实证：runtime kill_switch.mjs:8-11 code header（EB-02）+ `write_gate.mjs:19` "P6-C Gate import" + #168 EVO-C ceremony Lens-3 + 本次 code-review 独立复核。据此更正 **Context（:55）/ D-A1（:73）/ Hard Gate 1（:85）** 原「经 write_gate→real_executor→feishu 活生产链/活写路径」过度声称为 P6C-gate-path 措辞，使 canonical ADR 与 #169 runtime kill_switch.mjs header 一致。**D-07(a) 历史条目保留原文**（append-only Decision Log），本条负责更正（精度补注：`checkWriteGateP6C` 当前 test-only、零生产调用者，故 runtime kill_switch 现不在生产执行路径，enforcement 语义在 P6C 接生产时生效）。**Invariant 不变**：runtime kill_switch 仍是活的 enforcement 原语（D-A1 留任不变），**行为 0 变化**（Hard Gate 1 仍成立，本更正纯属路径描述层，零 code/behavior 改动）。**(2) 测试去 import-time side-effect**：被测 proactive `kill_switch.mjs:221` direct-run guard `process.argv[1]?.endsWith('kill_switch.mjs')` 会被同后缀的旧测试名 `test_proactive_kill_switch.mjs` 触发 → import 时执行被测模块 `main()` CLI（污染 Hard Gate 1 证据）；改名 `tests/governance/test_proactive_kill_switch_gate.mjs`（结尾 `gate.mjs`，零 guard 碰撞），**本 fold 不碰 proactive kill_switch.mjs**——其 guard + 可执行代码 vs main 字节一致（header 早于本 fold 在 D-2 commit `e5f9401` 加 4 行 reclassify 注释，behavior-neutral），Hard Gate 1 成立。**(3) config 去 literal token 歧义**：`execution_tiers.yaml:95/:102` 注释删 literal `tier_manager_approval`、改引 ADR §D-A2/§D-09 provenance，消除「已删 vs 仍在」grep 歧义（token 名只存于 ADR/validator 记录，不再现于 live config）。0 schema/gate 影响（validate-contracts 仍 21）。
- D-11 (2026-06-27，EVO-D drift_monitor 物理拆分授权)：**授权 `drift_monitor.mjs` 这一支的物理搬迁**——反转 Non-goals L145「不做物理目录搬迁（显式 deferred）」对**此单一文件**的限定。EVO-D = (a) `isDriftBlocked()`（§D-A3 保留的只读 enforcement 读）**逐字节抽取**为新文件 `src/governance/learning/drift_enforcement.mjs`（同目录硬约束：PROJECT_ROOT 三级上跳依赖目录深度，移出破字节级等价）；(b) `execution_gate.mjs` import specifier 改 `'./drift_monitor.mjs'`→`'./drift_enforcement.mjs'`（**唯一代码消费点**，契约串 `denied_by/check='drift_monitor'` 字节冻结、与文件名解耦不跟改）；(c) **物理删** `drift_monitor.mjs` 全部死面（evaluateDrift/executeDemotion/appendDriftFact/… + CLI，§D-A2 superseded 主动降级面）。**机制承 D-10**（经 Decision Log 条目授权后**就地纠正** live 规范文字 + append-only 记录的真先例，非 D-09 的外部 config token 删除）：本条 reconcile **仅 live 段**（D-A1 L73 / D-A2 / D-A3 / Context drift_monitor 行 / Risk Register / Non-goals / Rollout +R-4 行 / Adoption EVO-C checkpoint 勾选）；**Decision Log D-01..D-10 字节不变**（含 D-02「execution_gate→drift_monitor 边」等历史引用按 append-only 保留——写当时该文件存在，是历史记录非 live 索引）→ 故 DoD「无死指针」限定为「live 段无死指针」。**触发器 = Hard Gate 4（物理搬迁须 ADR 增补，PRIMARY）**，非 grandfather 论据。**OQ-4 piggyback**：operator 选 in-ADR D-11 append-supersede（非新 ADR-009 / 非全 ADR re-Accept）+ 显式 go（2026-06-27），EVO-D 自身 6-lens 自红队（SPEC `wf_2e56e9b0-e9c`）+ recon（`wf_d9f4735f-d54`）+ operator-Accept（SPEC PR #178 squash `4179ef1`）作 Non-goal 反转的等价 re-ceremony，无独立 ADR 层 cooling。**HG1 字节级回归实证**：isDriftBlocked 函数体 + 4 常量闭包 + ENFORCEMENT-READ 注释 vs 源 byte-identical（diff 空）；hardhook 9/9 绿（`test_quarantine_policy_blocks_write`→`denied_by==='drift_monitor'`）；old-vs-new golden 4/4 分支字节等价。**测试处置**：week3 Test7/8（execSync 死 CLI 的 drift 主动降级用例）随文件删除（§D-A6 原「标记 legacy」对 drift 两例升级为删除，tier 用例仍 legacy）；isDriftBlocked 读面覆盖迁新 `tests/governance/test_drift_enforcement.mjs`（三分支 + 路径同一性，CI-wired BLOCKING）。**0 schema 增删，validate-contracts gate 仍 21；7 GHL frozen 锚 0-diff（零路径交集）；三处 kill_switch 零触碰。** `tier_manager.mjs` 不在本次 scope（独立 clean-retire 候选）。

## Schema Deltas
无（本 ADR 零 schema 增删；D-A4 的 producer 属 GHL 2b/2c 范畴）。

## Rollout Phases
| 阶段 | 内容 | 落点 |
|------|------|------|
| R-1 | 本 ADR 评审 → 红队 → 24h draft cooling → operator Accept → 24h post-Accept cooling（cooling 模型见下方注） | `.planning/agentic-evolution/EVO-B-adr008-ceremony/SPEC.md` |
| R-2 | superseded 标记（**6 文件**：tier_manager/drift_monitor + 整个 v0.1 栈 promotion_v0/crystallizer_v0/pattern_detector_v0/learning_pipeline_v0_runner，后 2 件 D-08 扩入）+ kill_switch 三实现语义重分类 + 测试 legacy 标记 + hardhook CI-wire + token 处置（D-A1/A2/A3/A5/A6） | EVO-C（单 PR，surgical） |
| R-3a | GHL backlog **条目落档**（自动降级/漂移冻结/sandbox→candidate 概念 → 2b/2c 候选，附 v0/v0.1 file:line + 缺陷清单） | **EVO-C D-6（单 EVO-C PR 内）**（D-06 更正：原写 D-4 实为 hardhook CI-wire；GHL backlog 落档在 D-6） |
| R-3b | backlog 条目的**消费/重生** | GHL 2b/2c 各自 ceremony |
| R-4 | **drift_monitor 物理拆分**（isDriftBlocked 逐字节抽取 `drift_enforcement.mjs` + import 重定向 + 死面物理删 + 7 同步点 + 测试迁移）；授权 = **D-11** | EVO-D（单 PR，surgical） |

> **Cooling 模型（D-05 锚定，改编自 ADR-GHL house lifecycle）**：ADR-GHL 实际跑的是**双 cooling**——draft → first 24h cooling → 红队 round → second 24h cooling → GO（ADR-GHL L328-333，**两窗均在 Accept 前**）。本 ADR 采其**双窗节律的改编版**（B-03 校准）：**draft cooling（pre-Accept 反思窗，计时起点 = 本 ADR draft 落盘日 2026-06-10，对齐 ADR-GHL first-cooling 锚 draft 日的写法）+ post-Accept cooling（撤回窗，期内 EVO-C 不得动工，EVO-C 解锁以 Accepted-Date+24h 计）**。与 house 的差异——house 第二窗在 Accept 前；本 ADR 移第二窗至 **post-Accept** 作撤回窗（因 operator 决策要求一个 Accept 后的撤回缓冲）——显式声明，**非"采同款"**。
> **Accept≠merge（EVO-B B-01/B-04）**：Accept 时 PR #165 仍 open，post-Accept cooling 期保持 open、EVO-C 不动工，cooling 过后才 merge → 故 post-squash merge SHA 在 Accept 时尚不存在，须 merge 后回填（见 frontmatter Commit anchor，frontmatter 不预编 SHA）。

## Required Corrections Before Accept
- [x] D-03/D-04/D-05/D-06 + EVO-B ceremony（D-07）的更正已 fold 进正文（本版已 fold）
- [x] `node .claude/scripts/validate_adr_bghs.mjs` 通过（D-05）
- [x] EVO-C D-1 标记清单含 **6 文件**（tier_manager/drift_monitor + v0.1 栈 promotion_v0/crystallizer_v0/**pattern_detector_v0/learning_pipeline_v0_runner**，后 2 件 D-08 reverse-dep 重扫扩入）+ EVO-C D-2 enforcement 重分类清单含 **4 文件**（execution_gate + **3 处 kill_switch**：governance/learning + proactive + runtime/execution，DEP-02 补入）
- [x] **Accept 时三锚点同步落盘**（B-02，2026-06-12 Accept 已执行）：frontmatter `Status: Accepted` + frontmatter `Accepted-Date: 2026-06-12` + 文末 ADR Lifecycle `Accepted: 2026-06-12`/`Status: Accepted`（三处实测一致；validator 仅覆盖 frontmatter Accepted-Date，文末块在扫描域外 → 已人工核三处一致，对齐 ADR-GHL L11/L13/L340-341）

## Risk Register
| 风险 | 等级 | 缓解 |
|------|------|------|
| superseded 标记后仍有隐藏消费者依赖 v0/v0.1 主动路径 | M（**已实测降残**） | **EVO-C 入场 reverse-dep 重扫已执行（D-08，2026-06-13 HEAD `0a4f7e7`，直接扫 + 5-模态对抗 Workflow）：8 标的 ZERO 新外部消费者，GHL 边界 clean**；已知边全落 baseline（write_executor / execution-tiers-gate.yml:150 / execution_tiers.yaml:95,102 / runner intra-stack execSync）。重扫真发现 = v0.1 actionable superseded 清单漏数（2→4），已 D-08 fold（pattern_detector_v0 + learning_pipeline_v0_runner 扩入 D-A2 / EVO-C D-1，4→6 文件） |
| kill_switch **三实现**的语义重分类漏掉副本 | M | D-A1 明列三处文件头（governance/learning + proactive + runtime/execution，DEP-02 ceremony 补入）；EVO-C reverse-dep 重扫覆盖 `.claude/scripts/proactive/` + `src/runtime/execution/` |
| execution_gate→drift_monitor 边在冻结后行为漂移 | M | Hard Gate 1 字节级回归 + S-1 测试保绿；hardhook 套件 EVO-C 期 CI-wire（D-A6）。**（D-11/EVO-D）**：边迁 execution_gate→`drift_enforcement.mjs`，HG1 实证 byte-identical（diff 空）+ hardhook 9/9 + old-vs-new golden 4/4 + 新 `test_drift_enforcement.mjs` 三分支 CI-wired BLOCKING |
| 删 `tier_manager_approval` token 影响 execution_tiers.yaml 校验 | M | D-A3 显式纳入 EVO-C scope。⚠ D-06 更正：`validate-execution-tiers.mjs` **不解析 `transitions[].requires`**（validate() 仅 7 检查，无 transitions），故「改动须过该 validator」对 token 处置是 **no-op 门**——EVO-C D-5 改以 grep/golden 断言实证零半死残留（或扩 validator walk transitions[].requires），详见 EVO-C SPEC D-5 |
| GHL 2b/2c 重生时遗漏 v0/v0.1 已验证设计教训 | L | R-3a backlog 条目须附 file:line 指针 + 已知缺陷（drift_monitor ACOS-shaped 硬编码方向 :168-170；run_id 含 policy_id 子串松匹配 :128 + tier_manager:139）。**（D-11/EVO-D）**：drift_monitor.mjs 退役后其 :line 指针 pin git `4179ef1` + grep token 稳定锚（GHL-BACKLOG.md EVO-D banner）；tier_manager 指针仍 live |

## Open Questions
- OQ-1: `test_week3_tier_drift_kill.mjs` legacy 标记粒度（整套 vs 按用例）——EVO-C SPEC ceremony 裁。
- OQ-2: kill_switch facts 落盘路径与 GHL evidence-ledger 是否统一——defer，不阻塞本裁决。
- OQ-3: promotion_v0 的 `promotion_log.jsonl` 历史数据是否需迁移/归档——EVO-C 裁。

## Non-goals
- 不实现 GHL 2b/2c 的任何 promotion/demotion 本体。
- 不动 write_executor、不动 execution_tiers.yaml 的 token 之外结构、不动任何 GHL frozen 锚点、不动**三处 kill_switch 任一行为**（governance/learning + proactive + runtime/execution）。
- 不做物理目录搬迁（显式 deferred）。**（D-11/EVO-D 例外）**：`drift_monitor.mjs`→`drift_enforcement.mjs` 的 isDriftBlocked 抽取 + 死面删除已由 D-11 授权解冻；其余 superseded 文件 + 三处 kill_switch 的物理搬迁仍 deferred。

## Adoption Checkpoints
- [x] 红队评审（EVO-B ceremony 已跑 **4 lens**：依赖完整性 / 审计连续性 / GHL 边界 / ADR-mechanics；18 findings 全机制验证，fold/驳回 见 Decision Log D-07 + EVO-B `CEREMONY-RECORD.md`；**operator 2026-06-12 判定 ceremony 实质通过**）
- [x] `validate_adr_bghs.mjs` 通过
- [ ] Operator Accept + 双 cooling（Accept ✓ **2026-06-12** + draft cooling ✓；**post-Accept cooling 起算中** = Accept commit 实际时间 +24h，最早 2026-06-13 同北京时间后才考虑 merge #165 + 回填 anchor）
- [x] EVO-C PR merged（R-2 + R-3a 全项落地，Hard Gates 1-4 实证）— #169 squash `ff271ec`（2026-06-14）
- [x] EVO-D PR merged（R-4：drift_monitor 物理拆分，D-11 授权，HG1-4 实证）— #179 squash `0f4d1e7`（2026-06-27）
- [ ] R-3b 移交 GHL 2b/2c ceremony

## Appendix A: Audit Chain
2026-06-02 24-agent 交叉分析（session-local `wf_92441d58`）→ 主线程逐项落盘核验（修正 workflow 2 处事实错误）→ 2026-06-10 复核（5 承重事实 CONFIRMED + N-5 新证据修正"零调用者"初判）→ 2026-06-11 8-agent 文档对抗校验（6 HIGH/20 MED fold，含 confidence 归因 / frontmatter gate / tier_manager 消费者 / 三层真相）→ 本版。

## Appendix B: Cross-references
- `_meta/adr/ADR-Governed-Heuristic-Learning.md`（lifecycle 权威源）
- `.planning/agentic-evolution/ROADMAP.md`（执行载体）
- `.planning/agentic-evolution/EVO-B-adr008-ceremony/SPEC.md`（裁决 ceremony seed）
- `.planning/agentic-evolution/EVO-C-stack-reconciliation/SPEC.md`（执行 seed）

---
## ADR Lifecycle
**Authored**: 2026-06-10
**Accepted**: 2026-06-12
**Status**: Accepted
