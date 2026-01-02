# Broker Policy 分析

本文档总结了 LiYe OS 的 Broker Policy 核心设计。

## 背景

Multi-Broker 架构允许任务路由到不同的 AI 后端（codex、gemini、claude、antigravity）。

## 关键发现

1. 配置驱动路由：所有路由规则从 config/brokers.yaml 加载
2. 模型别名映射：gpt-5.2-thinking 自动映射到 gpt-5.2
3. Semi-auto 审批：一次授权，危险操作重新确认
4. 降级策略：broker 不可用时生成 MANUAL_PROMPT.md

## 结论

Multi-Broker Policy 提供了灵活且安全的任务执行框架。关键优势：

- 配置优先：避免硬编码，便于调整
- 安全边界：危险操作需要重新授权
- 可追溯：所有执行记录到 events.jsonl
- 可降级：即使 broker 不可用也能继续工作

## 建议

1. 定期运行 `liye broker check` 确保 broker 可用
2. 使用 `liye cost report` 监控执行成功率
3. 对高风险任务使用 `manual` 审批模式
