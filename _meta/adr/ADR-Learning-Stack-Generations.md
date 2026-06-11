---
artifact_scope: meta
artifact_name: Learning-Stack-Generations
artifact_role: contract
target_layer: 0
is_bghs_doctrine: no
---

# ADR-008 — 学习-治理栈多代并存的对账与取代（Learning Stack Generations）

> 文件名采非数字前缀（`ADR-Learning-Stack-Generations.md`）以进入 CI-wired BGHS frontmatter gate 的有效扫描域；"008" 仅为 track 内顺序记号，留在标题。

**Status**: Proposed
**Date**: 2026-06-10
**Accepted-Date**: （待 operator 裁决）
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
**Commit anchor**: 待 Accept 时按 post-squash merge SHA 锚定（遵循 ADR-GHL commit-anchor 教条：no pre-squash SHA is normative）

---

## Context

liye_os 内现存**三层**学习-治理 lifecycle 实现 + 一处 kill_switch 双实现，彼此零交叉引用、概念重叠、行为规范相左。

### 第 1 层 — v0 "week 3" 栈（2026-02-19，PR #117，`src/governance/learning/`）
| 模块 | 职责 | 关键行为（实测） |
|------|------|---------|
| `tier_manager.mjs` | observe→recommend→execute_limited 晋升 | 3 信号 **rate 评估 + 阈值门**（exec/operator/business，`execution_tiers.yaml` promotion_criteria）；**消费**预计算 `policy.confidence`（:225），本身**不含**权重公式；晋升 = 物理移动 YAML 工件（`unlinkSync` :296） |
| `drift_monitor.mjs` | 漂移检测 + 自动降级 | 降级 = 物理移动工件（`writeFileSync`+`unlinkSync` :226-229；`renameSync` 为**未使用的 dead import** :19）；`isDriftBlocked()`（:421-453，只读 existsSync/readFileSync）给 execution_gate 提供 24h freeze 信号 |
| `execution_gate.mjs` | 分级 preflight 授权（5 检查链） | fail-closed；被 `write_executor/index.mjs:23` 生产 import（N-5）；preflight 落盘仅 append-only gate facts |
| `kill_switch.mjs` | 紧急写路径中断 | ENV > state file > default 优先链；fail-closed；append-only facts |

### 第 2 层 — v0.1 "week 6" 实验栈（休眠，`.claude/scripts/learning/*_v0.mjs`）
- `policy_crystallizer_v0.mjs`：**0.2/0.3/0.5 confidence 公式真身**（:14 header / :78 `0.2*execRate + 0.3*operatorRate + 0.5*businessRate`）——与 GHL SSOT（4 权重，N-6）分叉。
- `promotion_v0.mjs`：**第三个 policy-lifecycle 实现**（:6 "manages policy lifecycle transitions"，sandbox→candidate，`renameSync` over `state/memory/learned/policies/`，自带 `promotion_log.jsonl` :29 + 自有 criteria :40-47）——与 tier_manager 的晋升权威重叠。
- `pattern_detector_v0.mjs` + `learning_pipeline_v0_runner.mjs`（runner 经 execSync 串接三者）。

### 第 3 层 — v1 GHL sealed 栈（活跃，2026-05-19 Accept → 2026-06 持续推进）
`src/reasoning/policy_trial_evaluator.mjs` + `.claude/scripts/learning/` sealed chain（import_facts / canonical_json / heartbeat_runner / metrics_daily_producer / d11_rolling_30d_producer / phase_1_exit_gate_check / phase4_entry_gate_check / operator_feedback_ingest / trial_observation_predicate）：confidence = SSOT `confidence_formulas.yaml`（N-6）；状态 = append-only JSONL + sealed schema + 确定性门禁。lifecycle 事件契约 `policy_lifecycle_event_v1` 已 sealed 入门禁——**但全仓零 producer**（N-4）。

### kill_switch 双实现
除 v0 栈的 `src/governance/learning/kill_switch.mjs`，另有 `.claude/scripts/proactive/kill_switch.mjs`（:29 共享**同一** state file `state/runtime/proactive/kill_switch.json`，自有 ENV>config>default 链，生产消费者 = `execute_limited_gate.mjs:87` + `generate_pr_evidence.mjs:410/427/446`）。同名概念双权威。

### 并存的实证状态（2026-06-10/06-11 复核）
1. **零交叉引用**：三层之间 + kill_switch 双实现之间无 import 交叉（v0 四模块只 import fs/path/url/yaml + 彼此；GHL 全链不引用 v0/v0.1；`cost_meter.mjs:16` 仅概念性提及 kill_switch，无 import）。
2. **v0 非孤儿但近休眠**：唯一**生产 import** 消费者 = write_executor preflight（N-5）；另有 CI smoke 直接执行 tier_manager（`execution-tiers-gate.yml:150`，`|| true` 非阻断）+ `execution_tiers.yaml:95/102` 的 `tier_manager_approval` token（config 语义耦合，D-A2 后成死配置）+ S-1 测试。模块本体 2026-02-19 后零提交。
3. **v0.1 实验栈休眠**：无生产消费者；crystallizer_v0 的 confidence 数学与 SSOT 分叉且互不知晓。
4. **行为规范相左**：v0/v0.1 的晋升/降级靠**破坏性文件移动**（无 lifecycle 事件落盘，违背 append-only 审计底色）；confidence 数学双源分叉（crystallizer_v0 的 0.2/0.3/0.5 vs GHL SSOT 的 0.2/0.3/0.4/0.1）。
5. **同名概念多权威隐患**：「policy promotion」（tier_manager + promotion_v0 + GHL）、「confidence」（crystallizer_v0 + GHL SSOT）、「drift demotion」、「kill switch」（双实现）各有多套定义，均躺在最像权威的路径下。任何会话/agent/文档误把休眠实现当现行权威 → provenance 污染 + 审计误判。

### 为什么现在裁决
GHL Phase-4 entry gate 已 ship（idle），production-unlock 决策窗临近。在 Hard Gate 8 解锁评估前，「policy lifecycle 唯一权威是谁」必须无歧义。多套同名安全子系统无标记并存，是 Phase-4 → exec SPEC 链路上的认知债。

## Decision（Proposed：Option A——分拆-取代）

> **一句话**：enforcement 原语留任，learning lifecycle 让位；GHL（v1 sealed）成为 policy lifecycle 唯一权威，v0 + v0.1 的 lifecycle/confidence 模块显式标记 superseded。

- **D-A1（enforcement 原语留任）**：`execution_gate.mjs` + `kill_switch.mjs`（两实现）是**活的 enforcement 原语**（非 learning lifecycle），保留现状——write_executor 生产依赖（N-5）+ proactive 消费者（execute_limited_gate/generate_pr_evidence）零触碰。物理搬迁显式 deferred。本 ADR 只做**语义重分类**：在 `src/governance/learning/kill_switch.mjs` **及** `.claude/scripts/proactive/kill_switch.mjs` 两处文件头标明「enforcement primitive, not learning lifecycle」。
- **D-A2（lifecycle 模块 superseded）**：`tier_manager.mjs` + `drift_monitor.mjs`（v0）+ `promotion_v0.mjs`（v0.1）标记 **Status: superseded-by-GHL**，不再作为任何 policy promotion/demotion 权威。未完成的概念价值（自动降级、漂移冻结、sandbox→candidate 晋升）转登 GHL backlog（2b/2c 候选）按 GHL 规范重生。
- **D-A3（依赖边处置）**：execution_gate → drift_monitor 的 `isDriftBlocked` 依赖**保留**（drift_monitor 降格为只读库；只读路径仅当 `policyId` 非空且 `actionType=WRITE_LIMITED` 触发，execution_gate.mjs:266；其降级主动路径随 D-A2 冻结）。`execution_tiers.yaml:95/102` 的 `tier_manager_approval` token 处置（删/标记死配置）入 EVO-C scope。
- **D-A4（lifecycle writer 落点）**：`policy_lifecycle_event_v1` 首个 producer **不** retrofit 进 v0/v0.1 栈（不给 superseded 代码镀金），随 GHL 首个真实 promotion 实现（2b/2c）落地。破坏性移动债随 D-A2 冻结自然退役。
- **D-A5（confidence 数学单一权威）**：`confidence_formulas.yaml` 是 confidence 唯一 SSOT。**`policy_crystallizer_v0.mjs` 的 0.2/0.3/0.5 公式（:78）随 D-A2 标记 superseded**（crystallizer_v0 文件头加 superseded 标记，列入 EVO-C D-1 清单），禁止任何新代码引用；其概念价值由 GHL 2b shadow→2c cutover 承接（参 ADR-GHL）。
- **D-A6（测试处置）**：S-1 两套测试保持绿色。`test_week3_tier_drift_kill.mjs`（CI-wired）的 tier/drift 晋升-降级用例标记 legacy。`test_execution_gate_hardhook.mjs` 当前 manual-only——它恰是保护 write_executor→execution_gate 边（Hard Gate 1 所依赖）的套件——EVO-C 期将其 CI-wire（comment/test-marking scope 兼容 Hard Gate 4）。

### 被否选项
- **Option B（retrofit v0/v0.1）**：给 tier_manager/promotion_v0 补 lifecycle-event 写入 + confidence 对齐 SSOT。否——平行维护多套 lifecycle 权威，GHL 已以更高规范覆盖同一问题域；投入喂给注定退役的代码。
- **Option C（status quo + 仅文档备注）**：否——「最像权威的路径上躺着多套非权威实现」的误导面没消除；Phase-4 unlock 前认知债必须显式清偿。

## Hard Gates（执行约束，EVO-C 期生效）
1. write_executor → execution_gate 链路行为 **0 变化**（preflightCheck 字节级回归）；proactive kill_switch 消费者行为 0 变化。
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
- D-06 (2026-06-11，operator-review fold，5-finding 独立复核 `wf_eb8f954a`)：3 处 doc-only 更正（0 schema/gate/code 影响）。**(a) 交叉引用** R-3a 落点 EVO-C D-4→D-6（D-4 实为 hardhook CI-wire，D-6 才是 GHL backlog 落档，EVO-C SPEC:20/:22 实测）。**(b) kill_switch 计数措辞** Required-Corrections 清单从「2 处 kill_switch」改为「EVO-C D-2 3 文件（execution_gate + 2 处 kill_switch）」以对齐 D-2 全范围。**(c) token 处置门** Risk Register「改动须过 validate-execution-tiers.mjs」是 no-op——该 validator `validate()` 7 检查零解析 `transitions[].requires`（实测），token 在/删/半删恒 PASS；改以 grep/golden 断言实证（EVO-C D-5 fold）。⚠ 复核同时**证伪 operator 一处锚点**：`tier_manager_approval` 在 `execution_tiers.yaml:95/:102`（均 `transitions[].requires` 下），**非 operator 所报 :88**（:88 是注释行）——D-A3/Risk Register 原锚 :95/102 正确，保留。

## Schema Deltas
无（本 ADR 零 schema 增删；D-A4 的 producer 属 GHL 2b/2c 范畴）。

## Rollout Phases
| 阶段 | 内容 | 落点 |
|------|------|------|
| R-1 | 本 ADR 评审 → 红队 → 24h draft cooling → operator Accept → 24h post-Accept cooling（cooling 模型见下方注） | `.planning/agentic-evolution/EVO-B-adr008-ceremony/SPEC.md` |
| R-2 | superseded 标记（tier_manager/drift_monitor/promotion_v0/crystallizer_v0）+ kill_switch 双实现语义重分类 + 测试 legacy 标记 + hardhook CI-wire + token 处置（D-A1/A2/A3/A5/A6） | EVO-C（单 PR，surgical） |
| R-3a | GHL backlog **条目落档**（自动降级/漂移冻结/sandbox→candidate 概念 → 2b/2c 候选，附 v0/v0.1 file:line + 缺陷清单） | **EVO-C D-6（单 EVO-C PR 内）**（D-06 更正：原写 D-4 实为 hardhook CI-wire；GHL backlog 落档在 D-6） |
| R-3b | backlog 条目的**消费/重生** | GHL 2b/2c 各自 ceremony |

> **Cooling 模型（D-05 锚定，对齐 ADR-GHL house lifecycle）**：ADR-GHL 实际跑的是**双 cooling**——draft → first 24h cooling → 红队 round → second 24h cooling → GO（ADR-GHL L328-333）。本 ADR 采同款：**draft cooling（pre-Accept 反思窗）+ post-Accept cooling（撤回窗，期内 EVO-C 不得动工，EVO-C 解锁以 Accepted-Date+24h 计）**。两窗语义不同，均显式保留。

## Required Corrections Before Accept
- [ ] D-03/D-04/D-05 的更正已 fold 进正文（本版已 fold）
- [ ] `node .claude/scripts/validate_adr_bghs.mjs` 通过（D-05）
- [ ] EVO-C D-1 标记清单含 4 文件（tier_manager/drift_monitor/promotion_v0/crystallizer_v0）+ EVO-C D-2 enforcement 重分类清单含 **3 文件**（execution_gate + 2 处 kill_switch）

## Risk Register
| 风险 | 等级 | 缓解 |
|------|------|------|
| superseded 标记后仍有隐藏消费者依赖 tier_manager/promotion_v0 主动路径 | M | EVO-C 入场全仓 reverse-dep 重扫（.mjs/.js/.ts/.yaml/.json/package.json scripts/.github workflows）；已知边：write_executor / execution-tiers-gate.yml:150 / execution_tiers.yaml:95,102 |
| kill_switch 双实现的语义重分类漏掉 proactive 副本 | M | D-A1 明列两处文件头；EVO-C reverse-dep 重扫覆盖 `.claude/scripts/proactive/` |
| execution_gate→drift_monitor 边在冻结后行为漂移 | M | Hard Gate 1 字节级回归 + S-1 测试保绿；hardhook 套件 EVO-C 期 CI-wire（D-A6） |
| 删 `tier_manager_approval` token 影响 execution_tiers.yaml 校验 | M | D-A3 显式纳入 EVO-C scope。⚠ D-06 更正：`validate-execution-tiers.mjs` **不解析 `transitions[].requires`**（validate() 仅 7 检查，无 transitions），故「改动须过该 validator」对 token 处置是 **no-op 门**——EVO-C D-5 改以 grep/golden 断言实证零半死残留（或扩 validator walk transitions[].requires），详见 EVO-C SPEC D-5 |
| GHL 2b/2c 重生时遗漏 v0/v0.1 已验证设计教训 | L | R-3a backlog 条目须附 file:line 指针 + 已知缺陷（drift_monitor ACOS-shaped 硬编码方向 :168-170；run_id 含 policy_id 子串松匹配 :128 + tier_manager:139） |

## Open Questions
- OQ-1: `test_week3_tier_drift_kill.mjs` legacy 标记粒度（整套 vs 按用例）——EVO-C SPEC ceremony 裁。
- OQ-2: kill_switch facts 落盘路径与 GHL evidence-ledger 是否统一——defer，不阻塞本裁决。
- OQ-3: promotion_v0 的 `promotion_log.jsonl` 历史数据是否需迁移/归档——EVO-C 裁。

## Non-goals
- 不实现 GHL 2b/2c 的任何 promotion/demotion 本体。
- 不动 write_executor、不动 execution_tiers.yaml 的 token 之外结构、不动任何 GHL frozen 锚点、不动 proactive kill_switch 行为。
- 不做物理目录搬迁（显式 deferred）。

## Adoption Checkpoints
- [ ] 红队评审（≥3 lens：依赖完整性 / 审计连续性 / GHL 边界）
- [ ] `validate_adr_bghs.mjs` 通过
- [ ] Operator Accept + 双 cooling
- [ ] EVO-C PR merged（R-2 + R-3a 全项落地，Hard Gates 1-4 实证）
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
**Accepted**: —
**Status**: Proposed
