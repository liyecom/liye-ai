# EVO-E SPEC-seed v0.1 — broker 难度级联路由（pre-ceremony intake · deferred）

**Status**: seed（**显式垫底**：依赖 EVO-A 完成 cost_meter 入禁；track 内最后执行）
**Date**: 2026-06-10
**Pattern 来源**: Ch16 Resource-Aware Optimization（2026-06-02 交叉分析对抗验证评 CONFIRM high；**verdict 台账未落盘、仅 session 内**，入场 ceremony 不得引用"唯一 CONFIRM high"为既证事实）

---

## Goal

在 assistant/broker 层（liye 全系统**唯一合法跑 LLM 的层**）补上"难度→broker 级联 + 预算感知"：简单任务走轻 broker，失败/低置信升级到重 broker，升级决策读 cost_meter ledger。

## Normative anchors（2026-06-02 对抗验证实读，入场须复测）

| ID | 锚点 | 实测状态 |
|----|------|---------|
| N-E1 | `src/brokers/registry.js:13-18` | 静态 BrokerType→instance map（4 broker：codex/claude/gemini/antigravity）；`getBroker()` 纯查表（仅收 brokerType 字符串） |
| N-E2 | `src/mission/run.js:104` | `getBroker(mission.broker)`——broker 由 **mission 创建时**写死（new.js:33/53，默认 codex）；`routeConfig.broker` 在 run.js:44-47 计算但 **:104 直接用 mission.broker 绕过** → route→broker 映射对 broker 选择是**死路径**；若 mission.yaml 缺 broker，getBroker(undefined) 抛 'Unknown broker'（registry.js:27-28），不 fallback route default |
| N-E3 | `src/config/load.js:26-35`（BUILTIN_DEFAULTS fallback）+ **`config/brokers.yaml:20-75`（实际生效源**，优先级 ENV `LIYE_BROKERS_CONFIG` > repo config/ > builtin，load.js:92-106） | 全 9 路由 4 broker（ask→codex / build·ship·refactor→claude / batch·outline·summarize→gemini / research·browser→antigravity）；粗粒度 task-type，**非** runtime-difficulty 驱动；两源入场都须复测（防 brokers.yaml drift 或 ENV override） |
| N-E4 | 全 src/brokers + src/mission grep | **零** escalation/verifier/confidence/hysteresis/max-escalation 逻辑（仅 CLI 不可用时 manual-mode fallback） |
| N-E5 | `runMission`/`createMission` 全仓 grep | **当前 0 in-repo 调用方**（唯一消费者 = `tests/smoke/broker-config-smoke.mjs:167`；`cli/` 目录不存在，package.json bin 仅 liye-recall）——**broker 层现为休眠资产**；'feature-flag 关闭态字节等价' 基线是当前不可达代码 |

## 设计要求（seed 级，ceremony 展开）

1. **default-off**：feature-flag 关闭态行为与现状字节等价。**⚠ seam 落点待 ceremony 裁**：`getBroker`（registry.js:25）仅收 brokerType 字符串，看不到 route / attempt_count 等难度信号（attempt_count 在 run.js:78/:99 的 meta）——seam 可能须上移到 run.js 调用点或扩 getBroker 签名，N-E2 死路径意味着不能简单复用 routeConfig.broker。
2. **隔离纪律**：契约层面禁止本机制进入任何 governed write 路径（assistant 层 only）；与 GHL/loamwise/AGE 零接触。
3. **预算感知**：升级决策消费 cost_meter ledger（**前置 EVO-A D-2/D-4 完成后**该契约入禁——见 Entry criteria）；fail-closed = 预算异常时退回静态路由（绝不因预算读取失败而拒绝服务或盲升级）。
4. **防振荡**：升级单调（难度只升不降 per-task）+ max-escalation 上限。

## Out of scope

- 任何 governed/write 路径触碰。
- LLM 评分器自动判难度的"聪明"方案 v1 不做——先用确定性信号（任务类型 + 失败重试计数 + 显式 caller hint）。

## Entry criteria

1. EVO-A merged（cost_meter 入禁）；N-E1..E5 复测仍成立（含 brokers.yaml 两源 + 死路径 + 休眠状态）。
2. **operator 确认 broker 层调用方/激活计划**（或显式接受为前瞻性 seam）——N-E5 证明 runMission/createMission 当前 0 调用方，若永不激活则 Effort-L 不成立，本 phase 应降级或 defer。

## Open questions（ceremony 裁）

- OQ-1: 难度信号集 v1 的最小集合（失败计数阈值？显式 hint 字段？）。
- OQ-2: ledger 读取的时点（per-call vs per-mission 缓存）与 UTC 窗口对齐 cost_meter 契约。
- OQ-3: 可观测性——升级事件是否落本地 JSONL（非 governed，仿 phase4 gate 的 gitignored 审计行先例）。
