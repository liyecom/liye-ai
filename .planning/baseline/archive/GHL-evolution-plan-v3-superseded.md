# Governed Heuristic Learning (GHL) — LiYe Systems 进化方案 v3.0

> **状态**: DRAFT，待用户审核 → 通过后转 ADR (`_meta/adr/ADR-Governed-Heuristic-Learning.md`)
> **作者**: Claude Opus 4.7 (1M context) — 综合 Codex + 全代码库扫描
> **日期**: 2026-05-09
> **背景输入**: Jiayi Weng *Learning Beyond Gradients* (May 2026) 论文/仓库
> **覆盖层**: Layer 0 (liye_os) + Layer 1 (loamwise) + Layer 2 (AGE, chaming)
> **canonical 上游**: `liye_os/_meta/portfolio/SYSTEMS.md`

---

## 零、必须先承认的事实

之前两版方案（我的 v1, Codex 的 v1, 我的 v2）都建立在**漏看 60% prior art** 的基础上。穷尽级代码库扫描后揭示的关键事实：

> **liye_os 已经有一条完整的 v0.1 学习管线，每天在跑，但已经"挨饿"两个多月。GHL 的核心价值不是建新基础设施，而是给已有管线接食物链 + 加 trial 粒度 + 解决三个 lifecycle 命名碰撞。**

---

## 一、12 项之前没看见的存量（每条都有文件证据）

| # | 发现 | 路径 | 影响 |
|---|---|---|---|
| 1 | **完整 v0.1 学习管线已上线** | `liye_os/.claude/scripts/learning/` 下 8 个模块 (`policy_crystallizer_v0`、`pattern_detector_v0`、`promotion_v0`、`heartbeat_runner`、`build-learned-bundle`、`validate-learned-bundle`、`discover_new_runs`、`bundle_build_on_change`) + `liye_os/src/governance/learning/` 下 4 个治理模块 (`tier_manager v1.0.0`、`drift_monitor`、`execution_gate`、`kill_switch`) | **不要重建**——升级即可 |
| 2 | **管线在饿肚子** | `state/runtime/learning/patterns/patterns_2026-02-{10,11,18,19}.json` 全部显示 `runs_analyzed: 0, patterns_detected: 0`；`heartbeat_learning_state.json: enabled=false, last_run 2026-02-14` | 接食物链是第一优先级 |
| 3 | **第一条 candidate 已存在并通过** | `state/memory/learned/policies/candidate/BID_RECOMMEND_ACOS_EXACT_CVRHIGH_ACOSLOW_17ED8F.yaml` (sample_size=19, confidence=1) | L0→L2 round-trip 已验证过一次 |
| 4 | **execution_tiers 配置已写好** | `liye_os/.claude/config/execution_tiers.yaml`：`observe → recommend → execute_limited` + 完整 promotion 标准（`min_runs`/`exec_success_rate`/`operator_approval_rate`/`business_success_rate`/`min_confidence`/`min_days`） | 不要在 ADR 重新定义 tier，直接 cite |
| 5 | **Playbook IO contract v1.1.1** | `liye_os/_meta/contracts/playbook/playbook_io.schema.yaml`（含 tier/risk_level/rollback_plan/primary_metric） | 第二份 L0 contract，必须与 GHL 协调 |
| 6 | **Epiplexity contract v0.1 已是 GHL-shaped** | `liye_os/_meta/contracts/epiplexity.contract.yaml`（VFC / drift_risk / reuse_yield 三信号） | 直接复用为 GHL trial scoring 依据 |
| 7 | **AGE step_evaluation_v1 schema 完美对位 GHL trial result** | `amazon-growth-engine/contracts/step_evaluation_v1.schema.json` 三层评估（structural/quantitative/semantic），`overall_verdict ∈ {PASS, FAIL, NEEDS_HUMAN, DOWNGRADED}` | GHL trial outcome 直接 map 上来，**无需新 schema** |
| 8 | **AGE 已有 frozen golden replay corpus** | `amazon-growth-engine/eval/autoresearch/scenarios/keyword_kill/regression/{XCH,FGD,SKG,QNB}-R01.yaml`（`split: regression`、`frozen: true`、`failure_cluster_tags`、`evidence_tier`、`historical lesson`） | **AGE 已经有 golden_replay 了，且叫"regression"**——直接采纳现成命名 |
| 9 | **AGE 文化已是"假设非真理"** | `amazon-growth-engine/config/amazon-growth/priority_score.yaml v4.2`：*"PriorityScore 是假设，不是真理 — 每次使用必须写入 TRACE，设置验证窗口，更新置信度，失败假设禁止复用"* | GHL 思想在 AGE 已经是文化，不是引入；缺的是机制层 |
| 10 | **三套 Trust 体系并存（不只 TrustMatrix）** | (a) `liye_os/src/control/trust.ts: TrustScoreStore`（agent EMA, alpha=0.1）<br>(b) `loamwise/.planning/quarantine/2026-05-06/trust_matrix.py`（candidate G/R/D rule bands, sealed）<br>(c) `loamwise/construct/candidates/skill_candidate.py: TrustLevel`（pipeline grade enum） | **GHL 不允许引入第四种"信任"**——必须复用 `learned_policy.confidence: 0..1` |
| 11 | **三套 lifecycle FSM 并存** | (a) `learned_policy.validation_status` (Python 管线): sandbox/candidate/production/quarantine/disabled<br>(b) `liye_os/src/runtime/governance/skill_lifecycle/types.ts: SkillLifecycleState` (TS BGHS): DRAFT/CANDIDATE/QUARANTINED/ACTIVE/DEPRECATED/REVOKED<br>(c) `loamwise/construct/candidates/skill_review_queue.py + review_queue.py` (Python): QUARANTINED→SCANNED→UNDER_REVIEW→ACCEPTED/REJECTED→PROMOTED + P1 OntologyCandidate | GHL 必须**显式 alias 到 (a)**，不再造第四个 |
| 12 | **AGE engine_manifest.yaml 字段失真** | `engine_manifest.yaml:93` 声明 `write_capability: none`，但 `src/execution/write_engine.py` + `s2a_allowlist.yaml` + 13-gate `write_automation_policy_v1.yaml` 实际有写路径，`brand_defense/executor.py:41` 还有 `AGE_BD_SP_WRITE_ENABLED` ENV gate。`docs/audits/2026-04-18_reality_calibration.md:141,270` 已标注此 drift | **GHL contract negotiation 之前必须先修这条** |

**附带肿瘤**（与 GHL 弱相关但顺便记）：
- AGE 24 个 worktree（CLAUDE.md cap 5）
- `negative_keyword_policy_v2.yaml` / `truth_hierarchy.yaml` / `m4_routing_table.py:143-145,262,289` / `replay_harness_b.py` 已重度使用 `*_candidate` 命名空间 → **GHL "candidate" 在 AGE 内必须 namespace 化**

---

## 二、双方提案的具体修订点（带文件证据）

| 我 v2.0 提案 | Codex v1.0 提案 | v3.0 修订（基于实测） |
|---|---|---|
| 在 `liye_os/_meta/contracts/learning/` 加 `heuristic_system.schema.yaml` + `heuristic_trial.schema.yaml` | 在 `liye_os/_meta/contracts/learning/heuristic_system.schema.yaml` 新建 | **改为**：`learned_policy.schema.yaml v1.0` 已是 base，新加**单文件** `governed_heuristic_v1.schema.yaml`（兄弟 schema，引用 base）+ trial-level 字段以**可选 block**（`policy_trial_envelope`）形式增量添加，不再做"系统级 wrapper"独立 schema |
| `loamwise/construct/heuristics/` 平行目录 | `loamwise/construct/heuristics/heuristic_candidate.py` + `task_ledger/heuristic_trial_ledger.py` | **改为**：升级 `liye_os/.claude/scripts/learning/policy_crystallizer_v0` → `_v1`（**就地升级**，保留 v0 直到 cutover）；新增 `liye_os/src/reasoning/policy_trial_evaluator.mjs`（兄弟 `playbook_evaluator.mjs`）；trial ledger 复用现有 `state/runtime/learning/promotion_log.jsonl` + 加 `policy_trials.jsonl` 兄弟。**不在 loamwise 新增 heuristics 目录**——因为学习管线主体在 liye_os，不在 loamwise |
| 全新 `compression_service.py` | 全新 `execute/compression_service.py` | **驳回**：`policy_crystallizer_v0.mjs` 就是压缩器，已经实现了 `confidence = 0.2*exec + 0.3*operator + 0.5*business`、`MIN_SAMPLE_SIZE=10`、`MIN_IMPROVE_RATE=0.6`。**升级 v0 → v1 即可**，新建会撞 `evidence/evidence_pipeline_ran.json` 等已存在 evidence 文件中的 `policy_crystallizer` 引用 |
| AGE 新建 `policy_modules/` | AGE `age.ppc.bid-policy-hs` 包 aggregator+recommender | **改为**：在 `engine_manifest.yaml` 加 `learning_capable: true` + `learning.opt_in_playbooks: [bid_recommend, anomaly_detect]`；feeder 写到本地 `out/facts/fact_run_outcomes.jsonl`，由 liye_os `discover_new_runs.mjs` 主动拉取；regression corpus **直接用** `eval/autoresearch/scenarios/keyword_kill/regression/`，不再造 |
| TrialRecord 是新 schema | HeuristicTrial 是新 schema | **改为**：trial 字段下挂在 `learned_policy` 现有 `evidence: [{trace_id, summary, outcome}]` 里，外加可选 `policy_trial_envelope` block。**不新建 schema 文件**——避免增加第四个 lifecycle 实体 |
| 名字 GHL = Heuristic-Iteration-Pattern | 名字 GHL = Governed Heuristic Learning | **采纳 Codex 命名 GHL**，但实现 **不引入新名词**："trial" 改为 `policy_trial`（避开 AGE `trial_run_*` 与 liye_os `tests/trial-run/v1-*.test.ts`）；"heuristic candidate" 实质就是 `learned_policy.validation_status: candidate`，不再单独建对象 |

---

## 三、修订后 6 个交付件（全部 file-path-anchored）

### #0 ADR：`ADR-Governed-Heuristic-Learning.md`

放 `liye_os/_meta/adr/`。**新核心立场**："GHL 是把已有的 v0.1 学习管线 + AGE 的 step_evaluation + AGE 的 regression corpus + epiplexity contract 串起来；不引入新 lifecycle / 新 trust 概念 / 新 candidate 类型"。

```yaml
artifact_scope: meta
artifact_name: Governed-Heuristic-Learning
artifact_role: harvest          # 不是 doctrine
target_layer: cross
extends_existing:               # 必须列出
  - liye_os/_meta/contracts/learning/learned_policy.schema.yaml v1.0.0
  - liye_os/_meta/contracts/playbook/playbook_io.schema.yaml v1.1.1
  - liye_os/_meta/contracts/epiplexity.contract.yaml v0.1
  - liye_os/.claude/config/execution_tiers.yaml v1.0.0
  - amazon-growth-engine/contracts/step_evaluation_v1.schema.json
non_goals:
  - 引入新 trust 体系（已有三套：TrustScoreStore / TrustMatrix sealed / TrustLevel enum）
  - 引入新 lifecycle FSM（已有三套：validation_status / SkillLifecycleState / SkillReviewQueue）
  - 引入新 candidate 类型（已有四种：LearnedPolicy / Skill / Ontology / AGE *_candidate 命名空间）
  - 复活 .planning/quarantine/2026-05-06/ 内 TrustMatrix（明文禁运 until Sprint 9 readout）
  - 删除/重写 policy_crystallizer_v0（升级 v0→v1 而不是替换）
  - 在 loamwise 新建 construct/heuristics/（学习管线主体在 liye_os）
  - HL paper 的 342-session unattended sweep / open-loop macro / single-reward optimization
mapping_to_bghs:
  Brain: coding agent (model-contingent)
  Governance: tier_manager + drift_monitor + execution_gate + kill_switch（**全部已存在**）
  Hands: policy_trial_evaluator + crystallizer_v1（升级现有）
  Session: promotion_log.jsonl + policy_trials.jsonl + golden_replay refs（**全部已有写入位置**）
```

**ADR 必含 Open Questions 章**：
- (a) TrustMatrix post-readout 处置（A 复活 / B 重写 / C 在 GHL 框架内合并到 `learned_policy.confidence`）
- (b) AGE write_capability:none 失真修正时机
- (c) AGE 24 worktree 清理（与 GHL 弱相关，但建议同期处理）

### #1 单文件 schema 扩展（不新建子目录）

**新建**：`liye_os/_meta/contracts/learning/governed_heuristic_v1.schema.yaml`

```yaml
# Sibling to learned_policy.v1, NOT a wrapper.
# Adds optional trial-level evidence block onto LearnedPolicy.
$ref: "learned_policy.schema.yaml#"     # 复用 base
$id: "https://liye.com/contracts/learning/governed_heuristic.v1"
allOf:
  - $ref: "learned_policy.schema.yaml#"
properties:
  policy_trial_envelope:                # 可选 block
    type: object
    properties:
      trial_id: { type: string }
      mode_config: { type: object }      # OBS_MODE 类比
      repeat_index: { type: integer }
      resource_used:                     # multi-currency
        type: object
        properties:
          model_tokens: { type: integer }
          spend_usd: { type: number }
          truth_write_tokens: { type: integer }
          wall_seconds: { type: number }
          human_review_minutes: { type: number }
      score_min: { type: number }
      score_max: { type: number }
      parent_trial_id: { type: string, nullable: true }
      regression_replay_refs:            # AGE corpus paths
        type: array
        items: { type: string }          # e.g. "amazon-growth-engine/eval/autoresearch/scenarios/keyword_kill/regression/XCH-R01.yaml"
      golden_pack_id: { type: string }
      audit_trace_ids:                   # 反向链接
        type: array
        items: { type: string }
      step_evaluation_ref:               # AGE step_evaluation_v1 instance
        type: string
```

**`liye_os/_meta/contracts/scripts/validate-contracts.mjs` 已是 fail-closed 验证器**——只需扩展它扫到这个新文件即可，无需新工具。

### #2 升级现有 v0.1 学习管线（不新建管线）

| 改动 | 路径 | 类型 |
|---|---|---|
| 升级 crystallizer 到 v1：吃 GHL trial envelope，emit candidate with `policy_trial_envelope` 字段 | `liye_os/.claude/scripts/learning/policy_crystallizer_v1.mjs`（保留 v0 直到 cutover） | 升级 |
| 新增 trial evaluator（兄弟 playbook_evaluator） | `liye_os/src/reasoning/policy_trial_evaluator.mjs` | 新增 |
| 加 trial 级别 ledger | `liye_os/state/runtime/learning/policy_trials.jsonl`（兄弟 `promotion_log.jsonl`） | 新增数据文件 |
| 让 heartbeat 重新打开 | `liye_os/state/runtime/proactive/heartbeat_learning_state.json` 改 `enabled: true`（**待 AGE feeder 上线后**才打开） | 配置 |

**完全不在 loamwise 新增 heuristics 目录**。原因：学习管线主体在 liye_os；loamwise 的 P3 SkillReviewQueue 是 *skill* 候选，与 *learned_policy* 候选是不同实体。

### #3 修复 AGE manifest 失真（GHL contract negotiation 前置条件）

**改 `amazon-growth-engine/engine_manifest.yaml`**：
- `write_capability: none` → `write_capability: limited` + 列出实际写路径（与 `s2a_allowlist.yaml`、`write_automation_policy_v1.yaml` 13 gate 对齐）
- 加 `learning_capable: true`
- 加 `learning.opt_in_playbooks: [bid_recommend, anomaly_detect]`
- 加 `learning.contracts_compat: ">=1.0 <2.0"`
- 加 `learning.fact_emission_path: "out/facts/fact_run_outcomes.jsonl"`（AGE 本地路径，由 liye_os 主动拉取）

**这个改动必须先于 #4 落地**，否则 GHL trial 与现实写能力不一致。

### #4 AGE feeder（让饿管线吃饭）— 依赖方向合规版

**关键约束**：feeder 是 **AGE 写本地 → liye_os 主动拉取** 的单向流。AGE 不写 liye_os 路径（保持 SYSTEMS.md 依赖方向：liye_os 读 AGE 文件，不反向）。

| 来源 | 中转 | 终点 | 字段 |
|---|---|---|---|
| `amazon-growth-engine/out/replay/{trace_id}/verification.json` | `amazon-growth-engine/scripts/learning/emit_fact.py` 写本地 `out/facts/fact_run_outcomes.jsonl` | liye_os `discover_new_runs.mjs` 拉取 → `state/memory/facts/fact_run_outcomes.jsonl` 追加 | `{exec, operator, business}` 三信号 + `trace_id` + `playbook_ref` |
| `amazon-growth-engine/out/replay/{trace_id}/policy_suggestions.json` | 同上 | 同上 | 作为 `evidence` 引用 |
| `amazon-growth-engine/contracts/step_evaluation_v1.schema.json` instance | 同上 | 同上 | `step_evaluation_ref` 字段 |
| AGE 已有 `eval/autoresearch/scenarios/keyword_kill/regression/*.yaml` | 路径引用，不复制 | GHL `governed_heuristic_v1.regression_replay_refs[]` | 引用即可 |

**实现位置**：
- AGE: `amazon-growth-engine/scripts/learning/emit_fact.py`（**新文件**，与 `scripts/asin_growth/evaluate_step.py` 一起跑，复用其 launchd cadence）
- liye_os: 改 `discover_new_runs.mjs`，加 AGE 路径 source

### #5 命名约束 4 条（必须写进 ADR Glossary）

| 词 | 在 GHL 里指 | 必须避开 | 原因 |
|---|---|---|---|
| `trial` 单独使用 | ❌ 禁止 | 用 `policy_trial` | AGE `scripts/trial_run_*` + liye_os `tests/trial-run/v1-*.test.ts` 已占用 |
| `candidate` 单独使用 | ❌ 禁止 | 用 `learned_policy.validation_status: candidate` | AGE `negative_keyword_policy_v2.yaml`/`truth_hierarchy.yaml`/`m4_routing_table.py` + loamwise `SkillCandidate`/`OntologyCandidate` 已占用 |
| `trust_score` / `trust_matrix` 类新对象 | ❌ 禁止 | 复用 `learned_policy.confidence: 0..1` | 三套 trust 已存在，引第四个会撞 |
| `evaluator` 类名 | ❌ 禁止裸用 | 用 `PolicyTrialEvaluator` 或 `GHLEvaluator` | 4 个 Evaluator 类已存在 (`playbook_evaluator.mjs`, `policy/evaluator.py`, `evaluate_step.py`, `brand_defense/evaluator.py`) |

---

## 四、Sprint 9 安全时序

| 阶段 | 时间 | 动作 | 路径 | baseline 安全？ |
|---|---|---|---|---|
| **0a** | 立刻 | 起草 ADR-GHL（含 12 项 prior art 清单 + Open Questions + Glossary） | `liye_os/_meta/adr/` | ✅ |
| **0b** | 与 0a 并行 | 起草 `governed_heuristic_v1.schema.yaml` + 扩展 validate-contracts.mjs | `liye_os/_meta/contracts/learning/` + `_meta/contracts/scripts/` | ✅ |
| **0c** | 与 0a 并行 | 修复 AGE `engine_manifest.yaml` write_capability 失真 + 加 learning fields | `amazon-growth-engine/engine_manifest.yaml` + 同步 `docs/SYSTEM_OVERVIEW.md` | ✅（AGE 不在 loamwise baseline 保护区内） |
| **0d** | 与 0a 并行 | 写 AGE feeder + 让 liye_os `discover_new_runs.mjs` 拉取 | `amazon-growth-engine/scripts/learning/emit_fact.py` + 改 `liye_os/.claude/scripts/learning/discover_new_runs.mjs` | ✅ |
| **1a** | 0a-d 都过后 | 升级 crystallizer v0→v1（保留 v0 一段时间） + 加 `policy_trial_evaluator.mjs` | `liye_os/.claude/scripts/learning/` + `liye_os/src/reasoning/` | ✅（liye_os 不受 loamwise Sprint 9 baseline 约束） |
| **1b** | 与 1a 并行 | heartbeat enabled=true 跑首批 trial（用 AGE 已有的 19-sample BID_RECOMMEND policy 作锚点） | `liye_os/state/runtime/proactive/heartbeat_learning_state.json` | ✅ |
| **2** | Sprint 9 readout 后（≥ 2026-05-13Z） | TrustMatrix 处置决策；loamwise 内若需 P3 联通 GHL（如把 SkillReviewQueue PROMOTED 事件 emit 到 fact_run_outcomes），此时才动 loamwise baseline 保护区 | `loamwise/construct/candidates/`、`audit/`、`govern/` | 等 readout |
| **3** | Q3 2026 | AGE worktree 减肥 + chaming 的 engine_manifest.yaml 起草 + GHL 第二个 pilot（chaming 域名状态机 → fact_run_outcomes） | cross | 数据驱动 |

---

## 五、需要审核的 5 个决策点

1. **核心叙事采纳**：GHL 是"复活 + 串联 + 限名"，不是"建新框架"——你接受这个根本转向吗？
   - **判断**：必须接受，否则会重复造已有 8 个学习模块。
2. **依赖方向**：feeder 是 (a) AGE 主动写 liye_os 路径（违反宪法但简单），还是 (b) AGE 写本地 + liye_os 主动拉取（合规但多一步）？
   - **推荐 (b)**，因为 `discover_new_runs.mjs` 本来就是干这个的。
3. **AGE manifest 修复**：write_capability 由 `none` 改 `limited` 是 GHL 前置硬条件，但需要 AGE owner 同时审 `s2a_allowlist.yaml` 与 13-gate 实情。**是否同意把这个修复并入 GHL ADR 作为 Section 1？**
4. **TrustMatrix 处置定调**：confirm 否决"立即 reconciliation PR"，改在 ADR §Open Questions 列三选项（A 复活 / B 重写 / C 在 GHL 框架内合并到 `learned_policy.confidence`），post-Sprint-9-readout 决？
5. **命名约束执行力度**：是否同意把 #5 的 4 条命名禁用作为**ADR 硬约束**（违反则 review block），而不是建议？因为这是三套 trust + 三套 lifecycle 历史教训告诉我们的——再宽松一次会变 4 套。

---

## 六、与 Learning Beyond Gradients (HL) 的对位回顾

| HL 论文原语 | LiYe 对位 | 现状 |
|---|---|---|
| `trials.jsonl` per game | `state/runtime/learning/policy_trials.jsonl` (新增) + `promotion_log.jsonl` (已有) | 部分已有 |
| Forced simplification (revert if regress) | `policy_crystallizer_v0.mjs` 的 `MIN_IMPROVE_RATE=0.6` + `drift_monitor` 的 auto-demote | **已有等价机制** |
| Regression contract | AGE `eval/autoresearch/scenarios/keyword_kill/regression/*.yaml` (`split: regression`, `frozen: true`) | **已有 frozen corpus** |
| `OBS_MODE × repeat` 复现性 | `policy_trial_envelope.mode_config + repeat_index` (新增) | 待加 |
| Failure-as-feedback | AGE `out/replay/{trace_id}/verification.json` + `policy_suggestions.json` | **已有结构化失败** |
| Heuristic System wrapper | `learned_policy v1` + `governed_heuristic v1` 兄弟 schema | 新增 v1 sibling |
| 简化失败处理 | LiYe truth-write 不可逆 → 简化失败版本 quarantine 为新 candidate；promoted 不动 | 适配现有 lifecycle |

**结论**：HL 论文给我们的不是"新算法"，是"工程纪律的命名"。LiYe 已经走到 80%，缺的是命名收口 + 食物链接通 + trial 粒度。

---

## 七、一句话总结

之前两版方案都把 GHL 当成"要从零建的新平台"，扫描全代码库后真相是：**liye_os 已经有完整学习管线但在挨饿，AGE 已经有 hypothesis-as-state 文化和 frozen golden corpus 但没接出去，三套 lifecycle+三套 trust 已经在打架。GHL 真正的工作是接食物链 + 限名 + 修 AGE 失真 manifest，不是另起炉灶**。这与 HL 论文的核心思想其实更贴近：HL 也不是发明新算法，而是把"trial-log + regression + simplification"这套已有概念用编程 agent 串起来。我们做的事是同构的，只不过 LiYe 已经走到了 80%，缺最后那 20% 的食物链 + 命名收口。

---

## 附录 A：参考来源

- [Learning Beyond Gradients - Jiayi Weng](https://trinkle23897.github.io/learning-beyond-gradients/) (May 2026)
- [Trinkle23897/learning-beyond-gradients GitHub repo](https://github.com/Trinkle23897/learning-beyond-gradients)
- LiYe Systems SSOT: `liye_os/_meta/portfolio/SYSTEMS.md`
- 关键 prior art 文件证据见 §一（12 项发现表）

## 附录 B：扫描方法学

本方案 v3.0 基于以下并行扫描产生（v1/v2 仅基于浅层 grep，故 60% 漏看）：
1. `gsd-codebase-mapper` agent（focus: AGE learning/governance subsystems）→ `amazon-growth-engine/.planning/codebase/AGE-LEARNING-INVENTORY.md` (553 行)
2. `general-purpose` agent 跨 5 repo 扫 14 关键词族 → 三表（reuse / collide / quarantine）
3. 既有 `.planning/codebase/` intel：liye_os (7 docs)、loamwise (7 docs)、chaming (7 docs)、silkbay (7 docs)
4. 直接 Read：`learned_policy.schema.yaml`、`MANIFEST.md` (TrustMatrix quarantine)、AGE `aggregator.py` / `recommender.py`

任何下次想做架构进化的 session，应先跑同等深度扫描，避免重蹈漏看 prior art 的覆辙。
