# EVO-C SPEC-seed v0.1 — 执行 ADR-008 裁决（pre-ceremony intake）

**Status**: seed（**阻塞于 EVO-B Accept + 24h cooling**；若 ADR-008 裁决偏离 Option A，本 seed 全文重写）
**Date**: 2026-06-10（2026-06-11 operator-review fold F4：D-5 token 处置门硬化——`validate-execution-tiers.mjs` 不解析 `transitions.requires`，改 grep/golden 实证；锚点 :95/:102 经复核保留，operator :88 证伪）
**Pattern 来源**: Ch9 Learning · Ch8 Memory

---

## Goal（假定 Option A Accept）

落地 ADR-008 R-2/R-3：v0 学习栈分拆-取代的全部**注释/文档/测试标记级**改动，单 PR，surgical。

> ADR 权威源文件 = `_meta/adr/ADR-Learning-Stack-Generations.md`（非数字前缀，D-05 重命名）。

## Deliverables（草案）

- D-1: **4 个 lifecycle 文件**头 superseded 标记（三行注释：Status: superseded-by-GHL / 权威源指针 ADR-Learning-Stack-Generations + ADR-GHL / 禁止新代码引用）——`src/governance/learning/tier_manager.mjs` + `src/governance/learning/drift_monitor.mjs`（v0）+ `.claude/scripts/learning/promotion_v0.mjs` + `.claude/scripts/learning/policy_crystallizer_v0.mjs`（v0.1 实验栈，crystallizer 含 0.2/0.3/0.5 confidence 公式真身 :78，D-A5）。
- D-2: **3 处 kill_switch + execution_gate（4 文件）** 文件头语义重分类注释（enforcement primitive, not learning lifecycle）——`src/governance/learning/execution_gate.mjs` + `src/governance/learning/kill_switch.mjs`（ENV `LIYE_KILL_SWITCH`）+ `.claude/scripts/proactive/kill_switch.mjs`（ENV `EXECUTE_LIMITED_ENABLED`，与 governance 共享 state file，消费者 execute_limited_gate/generate_pr_evidence）+ `src/runtime/execution/kill_switch.mjs`（ENV `KILL_SWITCH`，经 write_gate→real_executor→feishu 活生产链，PR #90，**EVO-B DEP-02 补入**）（D-A1）。
- D-3: `test_week3_tier_drift_kill.mjs` tier/drift 用例 legacy 标记（粒度**于本 SPEC ceremony 裁决**：整套 vs 按用例，即 ADR OQ-1 defer 至此的待裁项）。
- D-4: **hardhook CI-wire**（D-A6）：`test_execution_gate_hardhook.mjs` 当前 manual-only，它保护 write_executor→execution_gate 边（Hard Gate 1 所依赖）——本 PR 将其接入 CI（comment/test-marking scope 兼容 Hard Gate 4）。
- D-5: `tier_manager_approval` token 处置（D-A3）：`execution_tiers.yaml:95/:102`（均在 `transitions[].requires` 下，2026-06-11 grep 实测仅此两处——**非 :88**）的死配置 token（删/标记）。⚠ **不得**以「改动须过 `validate-execution-tiers.mjs`」作处置门——该 validator 的 `validate()` 仅跑 7 项检查（version/required-tiers/tier-fields/execute-limited-safety/no-write/default-tier/kill-switch），**零解析 `config.transitions`/`requires`**，token 在/删/半删它都恒 PASS，是 no-op 门。处置须附**真实断言**（ceremony 择一）：(Option 1，轻) 本 SPEC DoD 加 grep/golden——删=`grep -c tier_manager_approval .claude/config/execution_tiers.yaml == 0`；标记=每处带 `DEAD-CONFIG` 标注注释，实证零半死残留；(Option 2，重) 扩 `validate-execution-tiers.mjs` 新增 walk `transitions[].requires`，对不在 live-token allowlist 的孤儿 token fail-closed。
- D-6: GHL backlog **条目落档**（R-3a，单 PR 内）：自动降级 + 漂移冻结 + sandbox→candidate 概念 → 2b/2c 候选条目，附 v0/v0.1 file:line 指针 + 已知缺陷清单（drift_monitor 降级方向硬编码 ACOS-shaped :168-170；**run_id 含 policy_id 子串松匹配** `f.run_id?.includes(policyId)` :127-128 + 同模式 tier_manager.mjs:139）。
- D-7: write_executor → execution_gate 链路字节级回归证据 + **三处 kill_switch 消费者行为不变**（含 `src/runtime/execution/kill_switch.mjs` 活 write_gate→real_executor→feishu 路径，**最高风险**，DEP-02）（Hard Gate 1）。

## Hard Gates（继承 ADR-008）

1. write_executor preflight 行为 0 变化（回归实证）。
2. GHL frozen 锚点全清单 0-diff。
3. gate 计数 0 变化（本 phase 零 schema 增删）。
4. 改动面 = 注释/文档/测试标记 + CI-wire（hardhook）+ config token 处置（均经 ADR Hard Gate 4 显式授权；其余超出须回 ADR 增补 Decision Log）。

## Entry criteria

1. ADR-008 Status == Accepted 且 cooling 已过（出示 Accepted-Date + now 差值）。
2. 入场 reverse-dep 重扫（EVO-B 红队 lens 1 的复跑）——若发现新消费者，先回 ADR-008 Decision Log 增补再动工。
3. **EVO-B ceremony defer-ins**（见 `../EVO-B-adr008-ceremony/CEREMONY-RECORD.md`）须并入本 PR：(a) **DEP-03** — reverse-dep 重扫将 `_meta/contracts/learning/policy_lifecycle_event_v1.schema.yaml:70`「e.g. system:tier_manager」prose 标注为**已知非消费者**（schema description 内的命名示例，非 load-bearing，删 tier_manager 不影响校验，防后续误判）；(b) **AC-04** — `docs/runbooks/week3-tier-drift-kill.md:49/70` 的非 `--dry-run` live 命令纳入 runbook 弃用/加 superseded 警示（comment-only 标记不能 disable 手动 paste 触发的工件移动）；(c) **AC-01 子缺陷** — `promotion_v0.mjs` 的 logPromotion 与 movePolicy 非 co-located + error-swallowing try/catch（best-effort logging gap），cleanup 时一并记。

## DoD 草案

- [ ] D-1 4 文件 superseded 标记 + D-2 **4 文件**重分类注释落地，diff 仅注释行（diff 实证）
- [ ] **S-1（ADR Supporting Reference：`test_week3_tier_drift_kill.mjs` + `test_execution_gate_hardhook.mjs`）两测试套件绿**（行为守恒）；hardhook 已 CI-wire（D-4）
- [ ] `tier_manager_approval` token 处置经**真实断言**实证（grep/golden 证零半死残留，或扩 validator walk `transitions[].requires`）——**不**以 inert `validate-execution-tiers.mjs`（不解析 transitions）充数（D-5）
- [ ] D-6 backlog 条目可被 GHL 2b/2c SPEC ceremony 直接引用（含 file:line + 缺陷清单）
- [ ] 全量测试绿 + GHL frozen 0-diff 清单 + write_executor/**三处 kill_switch** 行为字节级回归（含 runtime/execution 活写路径，Hard Gate 1）
