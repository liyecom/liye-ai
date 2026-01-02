# Read-Only Interface Design

> **Status**: CANONICAL
> **Purpose**: 定义系统对外只读接口规范
> **Created**: 2025-12-31
> **Implementation**: Design Only (未实现)

---

## Core Principle

> **外部接口只能"看"，不能"做"**

```
┌─────────────────────────────────────────────────────────┐
│                   接口设计原则                           │
│                                                         │
│   ✅ 可以：读取 verdict                                  │
│   ✅ 可以：读取 trigger 命中情况                         │
│   ✅ 可以：读取机制元数据                                │
│                                                         │
│   ❌ 不能：运行 Runner                                   │
│   ❌ 不能：选择 T1 机制                                  │
│   ❌ 不能：修改输入                                      │
│   ❌ 不能：触发任何执行                                  │
└─────────────────────────────────────────────────────────┘
```

---

## Interface Types

### ⚠️ 重要声明

```
本系统不提供：
❌ API
❌ SDK
❌ 可编程接口
❌ 自动化集成

本系统仅允许以下形式的只读接口：
```

### 1. CLI Demo Mode

```bash
# 只读模式 - 仅查看预设 Case 结果
geo-os demo --case case_01 --read-only

# 输出
{
  "case_id": "case_01",
  "verdict": "POSITIVE_LIFT",
  "trigger_match": true,
  "view_only": true,
  "execution_blocked": true
}
```

限制：
- 只能查看预设 Case
- 不能自定义输入
- 不能运行 Runner
- 输出标记 `view_only: true`

### 2. Static JSON Export

```bash
# 导出静态结果（已验证的 Case）
geo-os export --case case_01 --format json > case_01_result.json
```

导出内容：
```json
{
  "export_metadata": {
    "exported_at": "2025-12-31T00:00:00Z",
    "export_type": "static_snapshot",
    "warning": "This is a read-only snapshot. No execution capability."
  },
  "case": {
    "case_id": "case_01",
    "domain": "ppc",
    "verdict": "POSITIVE_LIFT",
    "lift_score": 4
  },
  "mechanisms_used": ["ppc_bid_strategy_escalation_01"],
  "execution_blocked": true
}
```

### 3. Read-Only Web Viewer (概念设计)

```
┌─────────────────────────────────────────────────────────┐
│  Geo-OS Case Viewer (Read-Only)                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Case: case_01 - PPC ACoS Optimization                  │
│  Domain: PPC                                            │
│  Verdict: ✅ POSITIVE_LIFT (+4)                         │
│                                                         │
│  Mechanisms Used:                                       │
│  • ppc_bid_strategy_escalation_01                       │
│                                                         │
│  [View Details]  [Export JSON]                          │
│                                                         │
│  ⚠️ This is a read-only view. No execution available.  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [No Run Button]  [No Input Fields]  [No Settings]     │
└─────────────────────────────────────────────────────────┘
```

功能限制：
- 无"运行"按钮
- 无输入字段
- 无设置选项
- 无 API 调用能力

---

## Interface Restrictions

### 禁止的接口类型

| 禁止类型 | 理由 |
|----------|------|
| REST API | 允许程序化调用 |
| GraphQL | 允许灵活查询 |
| WebSocket | 允许实时交互 |
| RPC | 允许远程执行 |
| SDK | 允许编程集成 |
| CLI (非 demo 模式) | 允许完整执行 |

### 禁止的操作

```yaml
blocked_operations:
  - run_runner: "禁止运行 Runner"
  - select_mechanism: "禁止选择机制"
  - modify_input: "禁止修改输入"
  - change_config: "禁止修改配置"
  - batch_execute: "禁止批量执行"
  - schedule_run: "禁止定时运行"
  - trigger_webhook: "禁止触发 Webhook"
```

---

## Output Format

### Verdict Display

只读接口只展示验证结果，不展示执行能力：

```json
{
  "display": {
    "verdict": "POSITIVE_LIFT",
    "lift_score": 4,
    "domain": "ppc",
    "mechanisms_referenced": 1
  },
  "restrictions": {
    "execution_available": false,
    "modification_available": false,
    "api_available": false
  },
  "disclaimer": "Read-only view. Not a prediction or guarantee."
}
```

### Forbidden Output Fields

以下字段不得出现在外部接口输出中：

```yaml
forbidden_fields:
  - runner_endpoint: "不暴露执行端点"
  - api_key: "不暴露认证信息"
  - internal_config: "不暴露内部配置"
  - execution_log: "不暴露执行日志"
  - raw_llm_output: "不暴露原始 LLM 输出"
```

---

## Access Control

### E0 Level (Internal)

```yaml
e0_access:
  cli_full: true
  runner_access: true
  mechanism_selection: true
  config_modification: true
```

### E1 Level (Controlled Demo)

```yaml
e1_access:
  cli_demo_only: true
  runner_access: false
  mechanism_selection: false
  config_modification: false
  fixed_cases: [case_01, case_04, case_12]
```

### E2 Level (Partner)

```yaml
e2_access:
  static_export: true
  web_viewer: true
  runner_access: false
  mechanism_selection: false
  domain_selection: true  # 可选 Domain，但不可执行
```

---

## Implementation Notes

### 当前状态

```
Implementation Status: DESIGN ONLY

✅ 设计完成
⏳ 未实现
⏳ 无部署计划

理由：P3 阶段仅定义接口规范，不实现。
```

### 未来实现要求

如果未来实现，必须：

1. 所有执行功能禁用
2. 所有输入字段禁用
3. 添加明显的"只读"标识
4. 添加 Usage Boundary 链接
5. 记录所有访问日志

---

## Security Considerations

### 防止越权

```yaml
security_measures:
  - no_api_endpoint: "不创建任何 API 端点"
  - no_authentication: "无认证意味着无执行能力"
  - static_content_only: "仅提供静态内容"
  - rate_limiting: "即使只读也限制访问频率"
```

### 审计要求

```yaml
audit:
  log_all_access: true
  log_export_requests: true
  alert_on_unusual_patterns: true
  review_frequency: weekly
```

---

**Version**: 1.0.0
**Status**: Design Only
**Implementation**: Not Planned (P3 scope)
