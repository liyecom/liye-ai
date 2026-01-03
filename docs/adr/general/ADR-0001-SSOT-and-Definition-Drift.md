# ADR-0001: SSOT & Definition Drift Control

- decision_id: ADR-0001
- domain: general
- status: accepted
- created: 2026-01-01
- tags: [ssot, governance, definition-drift, memory]

## Context
同一概念在不同文档/对话/代码中重复定义，导致口径漂移与决策不可复现。

## Decision
1) Glossary YAML 是"定义类 SSOT"
2) ADR 是"决策类 SSOT"
3) 输出必须引用 SSOT（path + concept_id/version 或 ADR path）
4) CI 校验 glossary schema，防止漂移

## Consequences
- 优点：可审计、可回滚、跨会话稳定复现
- 代价：新增写 ADR 的治理开销（但一次投入，持续复用）

## Alternatives Considered
- 只靠聊天记忆 / mem：不可审计、易漂移（拒绝）
