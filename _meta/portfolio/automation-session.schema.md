# automation-session.yaml Schema

> **Critical**: 此文件 target_class = automation_config。
> Claude 不得直接 Edit/Write；只能输出字符串供用户 paste。

## Locations

| Path | Scope | Max layer it can unlock |
|---|---|---|
| `<repo-root>/.automation-session.yaml` | repo-local; gitignored | L0 / L1 / **L2** |
| `~/.claude/automation-session.yaml` | global | L0 / L1 only — **不能** L2 |

Hook 取最具体且未过期那份。

## Schema

```
schema_version: 1
session_id: "ses_<UTC-ISO8601>_<short-purpose-slug>"
created_at: "2026-05-19T07:00:00Z"
expires_at: "2026-05-19T09:00:00Z"
created_by: liye
reason: "short purpose"
gsd_phase: execute
max_layer: L2
scope:
  repos: [amazon-growth-engine]
  path_globs:
    - "amazon-growth-engine/src/ingest/**"
  target_classes:
    - product_code
    - test_artifact
  branches_allow:
    - "^feature/"
  branches_deny:
    - "^main$"
    - "^master$"
    - "^sealed-"
mcp_servers_used: []
```

## Validation rules

1. now() ∈ [created_at, expires_at]
2. expires_at - created_at ≤ 4h
3. target_path 命中 scope.path_globs 任一
4. 推断 target_class ∈ scope.target_classes
5. 当前 git_branch 匹配 scope.branches_allow 任一
6. 当前 git_branch 不匹配 scope.branches_deny 任一
7. max_layer ≠ "L3"
8. 全局位置 session：max_layer ≤ L1
9. scope.path_globs 不含 `**` 或 `**/*`

## Lifecycle helper

`liye-session open/status/close` 仅生成字符串模板；不写盘。

## Why created_by is not trusted

字段仅作审计。唯一保护：文件 target_class=automation_config，Claude 不能 Edit/Write。
文件存在 = 用户亲自 paste = 隐式授权。
