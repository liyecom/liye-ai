# Contracts v1 Freeze Runbook

**Version**: 1.0.0
**SSOT**: docs/runbooks/contracts-v1-freeze.md
**Last Updated**: 2026-02-19

## 边界声明

| 层 | 职责 | 示例 |
|----|------|------|
| **Control Plane (LiYe OS)** | 调度、学习、治理、投递、成本 | heartbeat_runner, cost_meter |
| **Domain Engine (Playbooks)** | 纯函数，无调度、无投递、无状态 | bid_recommend, anomaly_detect |

**三大契约**:
- `learned_policy.schema.yaml` — 学习策略格式（三信号、scope、confidence）
- `engine_manifest.schema.yaml` — Engine 能力声明
- `playbook_io.schema.yaml` — Playbook 输入输出格式

## v1.0.0 升级规则

| 变更类型 | 处理方式 |
|----------|----------|
| 新增可选字段 | v1.x.y (minor/patch) |
| 修改字段描述 | v1.x.y (patch) |
| 新增 required 字段 | **v2.0.0** (breaking) |
| 删除/重命名字段 | **v2.0.0** (breaking) |
| 修改字段类型 | **v2.0.0** (breaking) |

## 本地校验

```bash
# 校验三大契约 + 所有 policies
node _meta/contracts/scripts/validate-contracts.mjs

# 校验 bundle (可选)
node _meta/contracts/scripts/validate-contracts.mjs --bundle state/artifacts/learned-bundles/xxx.tgz

# 校验 cost_meter
node _meta/contracts/scripts/validate-cost-meter.mjs
```

## CI 失败修复路径

### 错误 1: Missing required field
```
❌ Missing required field: schema_version
```
**修复**: 在 policy YAML 中添加缺失字段

### 错误 2: Unknown field not allowed
```
❌ Unknown field 'extra_field' not allowed (additionalProperties: false)
```
**修复**: 删除未知字段，或在 schema 中添加该字段定义

### 错误 3: confidence must be number
```
❌ Field 'confidence' must be a number (0~1), got: string
```
**修复**: 将 `confidence: high` 改为 `confidence: 0.85`

### 错误 4: Directory mismatch
```
❌ Directory mismatch: file in 'sandbox/' but validation_status is 'production'
```
**修复**: 移动文件到正确目录，或修改 `validation_status`

### 错误 5: Production policy requires approval
```
❌ Production policy with write actions MUST have 'constraints.require_approval: true'
```
**修复**: 设置 `constraints.require_approval: true`

## 关键约束

1. **additionalProperties: false** — 所有 schema 禁止未知字段
2. **fail-closed** — 校验失败 exit 1，阻断合并
3. **三信号体系** — `success_signals` 必须有 `exec/operator/business`
4. **scope 必填** — 防止跨租户污染
5. **confidence 数值** — 0~1 数值，禁止 high/medium/low 字符串
