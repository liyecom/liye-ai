# EVO-B SPEC-seed v0.1 — ADR-008 裁决 ceremony（pre-ceremony intake）

**Status**: seed
**Date**: 2026-06-10
**Pattern 来源**: Ch9 Learning（lifecycle 单一权威）· Ch8 Memory（append-only 审计连续性）

---

## Goal

把 `_meta/adr/ADR-Learning-Stack-Generations.md`（Proposed，2026-06-10 已落盘；注：文件已从数字前缀 `ADR-008-*` 重命名以过 BGHS CI gate，D-05）推过 house ADR lifecycle，**采 ADR-GHL 双 cooling 模型**（house 先例 ADR-GHL L328-333）：评审 → 红队 fold → **24h draft cooling（pre-Accept 反思窗）** → operator Accept 签字（Accepted-Date 落盘）→ **24h post-Accept cooling（撤回窗，期内 EVO-C 不得动工）** → EVO-C 解锁以 Accepted-Date+24h 计。两窗语义不同（前者可改、后者可撤），均显式保留。

## 这是决策 phase，不是实现 phase

产物 = Accepted 的 ADR-008（含红队 fold 后的 Decision Log 增补）。代码 0 改动。实现归 EVO-C。

## 评审必读（裁决人最小上下文包）

1. ADR-008 全文（含 N-1..N-5 锚点）。
2. 关键修正史：初判"v0 栈零外部调用者"**有误**（grep glob 失败误报）；实情 = `src/adapters/write_executor/index.mjs:23` 生产 import `execution_gate.preflightCheck` + 2 测试套件在用 → 裁决形态从"整栈归档"改为"分拆-取代"（D-01/D-02 已披露）。
3. 依赖边图：write_executor → execution_gate → { kill_switch, drift_monitor(isDriftBlocked), execution_tiers.yaml }。**tier_manager 无生产代码 import 消费者，但有 3 类已知外部引用**（HIGH 红队 fold，D-04）：CI smoke 直接执行（`.github/workflows/execution-tiers-gate.yml:150`，`|| true` 非阻断）；`execution_tiers.yaml` transitions 的 `tier_manager_approval` 审批 token（:95/:102，D-A2 后成死配置，需 EVO-C 处置）；test_week3 的 CLI 调用（S-1 已知）。另：`promotion_v0.mjs` 与 tier_manager 晋升权威重叠（第三 lifecycle，ADR Context 第 2 层）。

## 红队 lens 建议（≥3）

- **依赖完整性**：全仓 reverse-dep 重扫（.mjs/.js/.ts/.yaml/.json/package.json scripts/.github workflows），证伪"tier_manager 无外部消费者"与"GHL 零引用 v0"。
- **审计连续性**：D-A4（lifecycle writer 不 retrofit v0、随 GHL 2b/2c 落地）是否在 superseded 标记后留下审计窗口期？注意 write_executor preflight 路径**仅当 `policyId` 非空且 `actionType=WRITE_LIMITED` 时**间接调 isDriftBlocked（`execution_gate.mjs:266`；write_executor 默认 `policyId=null`，:325）；该读路径本身**只读** quarantine 目录与 drift facts，不产生工件移动，preflight 落盘仅 append-only gate facts。故窗口期风险面比"无条件触发"窄——红队据此评估是否真存在无 lifecycle 记录的状态变更路径。
- **GHL 边界**：D-A2 移交 backlog 的概念（自动降级/漂移冻结）与 GHL 2b/2c 既定 scope 是否冲突或重复。

## Accept 条件

- [ ] 红队 findings 全 fold 或显式驳回（记 Decision Log）
- [ ] operator 签字 + Accepted-Date 落盘 + 24h cooling
- [ ] commit anchor 按 post-squash SHA 锚定（ADR-GHL commit-anchor 教条）

## Out of scope

EVO-C 的任何实现细节争论（标记粒度、测试处置）——那是 EVO-C 自己的 SPEC ceremony。
