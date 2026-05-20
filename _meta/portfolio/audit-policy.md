# Automation Audit Policy

## Where logs live

- 本机 only: `~/.local/state/liye-automation/automation-log.jsonl`
- 不入 repo

## Schema

见 `automation-log.schema.json`。每行一个 JSON object。

## Redaction（写入前强制）

Pre-write filter 匹配 token shape，替换为 `<redacted:sha256_12=XXXX>`：

| Pattern | Example |
|---|---|
| `eyJ[A-Za-z0-9_-]{20,}` | JWT |
| `sk_[a-f0-9]{32,}` | Stripe/Medusa secret-key shape |
| `pk_[a-f0-9]{32,}` | Publishable key |
| `Bearer\s+\S+` | Auth header bearer |
| `[A-Z_]{4,}_TOKEN=\S+` | env var assignment |
| `[A-Z_]{4,}_KEY=\S+` | env var assignment |

Filter 是 PostToolUse hook 内置职责。

## 审计导出

`log-summary.sh --since <iso> --kind <action>`（Phase 0B 提供）生成 markdown 摘要：按 action 分组；列 redacted fingerprint counts；不含原始命令文本；输出到 stdout；用户按需 paste 到 `liye_os/_meta/portfolio/audits/YYYY-MM-DD.md`。

## Retention

- jsonl 本机保留 90 天
- 超过 90 天 → 用户手动归档到 `~/.local/state/liye-automation/archive/YYYY-MM.jsonl.gz`
- 不自动删除

## Init record

第一次启用 governance 时（Phase 0A-1 cleanup），audit log 必须含至少一条
`action: phase-0a-1-settings-cleanup` 记录作为审计链起点。
