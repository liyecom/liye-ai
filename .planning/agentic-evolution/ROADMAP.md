# Agentic Evolution Track — ROADMAP v0.1

**Status**: intake（SPEC-seed 集；每个 phase 须经各自 SPEC ceremony 升 v1.0 后方可 IMPL）
**Date**: 2026-06-10
**来源**: Antonio Gullí《Agentic Design Patterns》（21 patterns）× liye 全代码库交叉分析（2026-06-02，24-agent workflow，session-local id `wf_92441d58`，**无落盘 transcript**；承重事实以 2026-06-10/06-11 主线程逐项落盘实测 + 8-agent 文档对抗校验为准，非以该 workflow 自证）
**与 GHL 链的关系**: 平行 track，**不占用** GHL phase 编号空间（phase-1a..phase-4 namespace 不动）；任何触及 GHL 资产的条目以 GHL frozen 锚点 0-diff 为硬约束。

---

## 核心论点（一句话）

交叉分析裁定：21 patterns 中治理核心已 PRESENT 且实现地道（确定性、fail-closed、零 LLM 治理路径——正确取舍）；**真正的高杠杆不是引入新模式，而是把"已建好未通电"的安全脚手架接上电，并清偿多代学习栈并存的架构债**（红队复核：实为**三层 lifecycle**——v0 week3 / v0.1 week6 实验栈 / v1 GHL sealed——+ kill_switch 三实现，详见 ADR）。

## Phase 总表

| Phase | 标题 | Effort | 依赖 | 仓库 | 状态 |
|-------|------|--------|------|------|------|
| EVO-A | 休眠门禁通电（manifest-reality CI + cost_meter 入禁 + 治理 DSL 校验器） | S-M | ⚠ 0c.4 受 ADR-GHL "Sprint 9 readout (B2)" 前置约束，入场须先确认/豁免 | liye_os | seed |
| EVO-B | ADR 裁决 ceremony（多代学习栈分拆-取代） | S（评审） | `ADR-Learning-Stack-Generations.md` Proposed 已落盘 | liye_os | seed |
| EVO-C | 执行 ADR-008 裁决（superseded 标记 + 语义重分类 + 测试 legacy 化） | M | EVO-B Accept + 24h cooling | liye_os | seed |
| EVO-D | AGE RoutingPolicy route-golden 语料 + replay gate **新建**（corpus 当前 CI-dark；trigger 含 action_planner.py seam） | M | 软依赖 AGE 写路径激活（非 #403 合并；#403 producer 已在 main 但仍 dry_run/sandbox） | amazon-growth-engine | seed v0.3 → `amazon-growth-engine/.planning/replay-golden-expansion/SPEC.md` |
| EVO-E | broker 难度级联路由（default-off seam，assistant 层隔离） | L | EVO-A 完成（cost_meter 须先入禁） | liye_os | seed（deferred，最后做） |

**推荐执行序**: EVO-A → EVO-B →（cooling）→ EVO-C；EVO-D 独立并行（AGE 仓）；EVO-E 显式垫底。

## Gate-count 台账（gate-count 教训纪律）

| 时点 | validate-contracts 计数 | 事件 |
|------|------------------------|------|
| 2a-γ 后 | 20 | d11_rolling_30d_v1 注册（19→20，先例 ceremony） |
| Phase-4 IMPL 后 | 21（`_meta/contracts/scripts/validate-contracts.mjs` schemaFiles 16 项） | phase4_prereq_attestation_v1 注册（L532） |
| EVO-A 预期 | 21 → 22（+cost_meter schemaFiles）→ 22+N（+治理 DSL 自定义校验器，N 由 SPEC ceremony 裁定） | **披露式 carve-out + 三源实测 before/after**，镜像 19→20 先例 |

> 任何 phase 入场时**必须重新三源实测当前计数**，不得沿用本表数字。
> ⚠ **fresh-checkout 警示**：local working tree 的 21 中含 1 个可能被 .gitignore 排除的 candidate policy（`state/memory/learned/policies/candidate/BID_RECOMMEND_*.yaml`，.gitignore L350 非 SAMPLE_ 前缀）；fresh CI checkout 可能为 20。carve-out 文书须注明测量环境 + `git ls-files` 实证 track 状态（2a-γ gate-count 教训）。

## 全 track 硬约束（Hard-NO，继承 GHL 纪律）

1. GHL frozen 锚点 0 触碰（File-B `scripts/heartbeat_runner.mjs` 等全清单 0-diff 实证）。
2. Hard Gate 8（production write 永锁）0 crack；本 track 无任何条目触及 write-path 解锁。
3. Surgical scope（DEFAULT_SKILL_POLICY Policy 9）：每 PR 只做该 phase SPEC 圈定面。
4. 每 phase IMPL PR 前置各自 SPEC ceremony（红队 + DoD），seed ≠ SPEC。

## 显式不做清单（来自交叉分析对抗验证，防 cargo-cult）

- ❌ 向量 RAG / 语义检索接入确定性治理或 GHL 热路径（破坏 deterministic-replay + provenance）。
- ❌ governed 路径引入 LLM reasoning（CoT/ToT/ReAct）——零-LLM 治理核是特性。
- ❌ bandit/epsilon/UCB 自主探索循环（违反 fail-closed + Pilot-1 negative-learning）。
- ❌ 为并行化改 orchestrator 串行循环（牺牲确定性回放）。
- ❌ 抢占式优先级队列（违反 Pilot-1 手动触发不变量）。

## 已被对抗验证驳回的候选（存档，防重提）

| 候选 | 驳回理由 |
|------|---------|
| loamwise→AGE 真实 dispatch 打通（Multi-Agent） | 是目标态 milestone，非单 phase 可完成 |
| changeset compiler（Planning） | scope 过大 + 与 Pilot-1 手动触发抵触 |
| post_change_monitor critique-fact 闭环（Reflection） | 承重假设证伪：evaluator 唯一 trial 触发路径 = duplicate_conflict，非任意 critique fact；"加一行就通"不成立 |
| learned_policy_loader 召回可观测化（Memory） | 杠杆降级：activation 前消费方为零，无观测对象 |

## 评审轮次（audit 连续性）

- **R1**（2026-06-11，8-agent 文档对抗校验）：6 HIGH/20 MED fold（confidence 归因/BGHS frontmatter gate/tier_manager 消费者/三层真相等，见 ADR Appendix A）。
- **R2**（2026-06-11，operator-review 5-finding 独立复核 `wf_eb8f954a`，全 CONFIRMED/PARTIAL，全 fold）：
  - **F1**（EVO-A，HIGH）：D-1 须建 Python toolchain——`validate_manifest_reality.py` imports jsonschema，contracts-gate 仅装 Node yaml；house 先例装 pyyaml 但**都不装 jsonschema**。⚠ 现役非红（无 workflow 引用，条件性 gap）；本地装了 jsonschema 会掩盖缺口。
  - **F2**（EVO-D，HIGH）：replay gate trigger 扩至 `action_planner.py` 真实 seam（:160 调用，非 operator :141 注释）+ 加 integration golden；纯 decide-only 是 false safety（action_planner 未冻结）。
  - **F3**（EVO-A，MED）：D-4 cost-meter 须确定性 CI 模式——抽样 gitignored `data/facts/*.jsonl`（.gitignore:337），缺席→warn-pass、本地→18 error，门禁不得依赖 runtime state 存否。
  - **F4**（EVO-C，PARTIAL）：D-5 token 处置门硬化——`validate-execution-tiers.mjs` **不解析 transitions.requires**（no-op 门），改 grep/golden 实证。⚠ **证伪 operator 一处锚点**：token 在 `:95/:102` 非 :88（SPEC 原锚正确保留）；同款假缓解亦在 ADR L123，已一并修。
  - **F5**（ADR↔EVO-C，MED）：R-3a 落点 D-4→D-6（D-4 是 hardhook CI-wire）；kill_switch 计数措辞对齐 D-2（**EVO-B DEP-02 后升 4 文件**：execution_gate + 3 处 kill_switch）。
  - **操作员建议序**：ADR 进 EVO-B ceremony 但 **fold F5 后方可 Accept**；EVO-A/EVO-D 并行备 v1.0（**未解锁 IMPL**）；EVO-C 续阻塞于 EVO-B Accept + 24h cooling，且 F4 写入 v1.0。
