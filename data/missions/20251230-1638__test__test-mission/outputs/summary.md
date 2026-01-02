> Auto-summary (deterministic) · Generated at 2025-12-30T19:08:43.568Z

Multi-Broker Policy 提供了灵活且安全的任务执行框架。关键优势：
• 配置优先：避免硬编码，便于调整
• 安全边界：危险操作需要重新授权
• 可追溯：所有执行记录到 events.jsonl
• 可降级：即使 broker 不可用也能继续工作
• 定期运行 `liye broker check` 确保 broker 可用
• 使用 `liye cost report` 监控执行成功率
• 对高风险任务使用 `manual` 审批模式
本文档总结了 LiYe OS 的 Broker Policy 核心设计。
Multi-Broker 架构允许任务路由到不同的 AI 后端（codex、gemini、claude、antigravity）。
