# ADR-001: Control Plane vs Domain Engine Separation

**Status**: Accepted
**Date**: 2026-02-08
**Decision Makers**: LiYe
**SSOT**: `_meta/adr/ADR-001-control-plane-vs-domain-engine.md`

## Context

原方案存在边界模糊问题：
- AGE 有 `heartbeat_monitor`（调度器）→ 与 OS 调度冲突
- 符号链接共享 `learned_policies` → 无版本控制，不可移植
- 成功判定用 `ALLOW` → 缺乏商业价值验证
- 2层执行（沙盒→生产）→ 缺乏人类监督

## Decision

### 控制平面（LiYe OS）

**拥有**：
- Heartbeat/Cron 调度
- 学习流水线（Pattern Detection → Crystallization → Promotion）
- 晋升/漂移/回滚治理
- 投递（飞书卡片、通知）
- 成本计量

**调用**：Domain Engine 的 playbooks

**输出**：learned bundle（versioned tar.gz）

### 数据平面（Domain Engines）

**提供**：playbooks（纯函数，接收 inputs → 返回 verdict + recommendations）

**禁止**：
- 自行调度
- 学习治理
- 投递
- 读写 OS 状态

**消费**：learned bundle（只读，通过 `LEARNED_BUNDLE_PATH` 环境变量）

## Consequences

### 优势

- **清晰边界**：Engine 可独立测试、独立部署
- **可移植**：AGE 在无 liye_os 工作区环境可运行（仅需 bundle）
- **可复用**：其他 Engine 复用同一套 Control Plane

### 代价

- **复杂度**：需要 contracts + bundle 机制
- **版本协商**：需要 `contracts_compat` 版本约束

## 执行层级（3-Tier）

| Tier | 描述 | 权限 |
|------|------|------|
| `observe` | 只读、检测、生成 evidence（dry-run only） | read:metrics, read:ads_api, write:evidence_package |
| `recommend` | 生成提案，等待 operator 批准 | observe + write:feishu_message |
| `execute_limited` | 小流量自动写（可回滚） | recommend + write:ads_api_limited |

## Success 三信号体系

| 信号 | 描述 | 晋升条件 |
|------|------|----------|
| `ExecSuccess` | 执行无错误 | sandbox → candidate |
| `OperatorSuccess` | 人工采纳/批准 | candidate 阶段 |
| `BusinessSuccess` | 指标改善 | candidate → production |

```yaml
success_signals:
  exec:
    count: 22
    success_rate: 0.86
  operator:
    approval_count: 12
    rejection_count: 3
    approval_rate: 0.80
  business:
    metric_name: acos
    baseline: 0.28
    current: 0.22
    improvement_pct: 21.4
```

## 目录分区（物理隔离）

```
state/memory/learned/policies/
├── sandbox/      # 新学习，observe 阶段
├── candidate/    # 人工推荐，recommend 阶段
├── production/   # 已批准，execute_limited
├── disabled/     # 漂移禁用
└── quarantine/   # 紧急隔离
```

升级/回滚 = 文件移动，非字段修改。

## 相关文档

- Contracts: `_meta/contracts/**`
- Learned Bundle 规范: `_meta/adr/ADR-001-learned-bundle-spec.md`
- CI Gate: `.github/workflows/contracts-gate.yml`

---

## Appendix: Learned Bundle Specification v1.0.0

### Bundle 结构

```
learned-bundle-v1.0.0.tar.gz
├── policies/
│   ├── production/
│   │   └── *.yaml
│   └── candidate/
│       └── *.yaml  (approval_rate >= 0.80)
└── skills/
    └── production/
        └── *.yaml
```

### Manifest 格式

```json
{
  "bundle_version": "v1.0.0",
  "schema_version": "1.0.0",
  "created_at": "2026-02-08T12:00:00Z",
  "sha256": "abc123...",
  "policies_index": [
    {
      "policy_id": "BID_OPT_HIGH_CVR_EXACT",
      "file": "policies/production/BID_OPT_HIGH_CVR_EXACT.yaml",
      "hash": "def456...",
      "status": "production",
      "scope": {
        "type": "asin",
        "keys": {
          "tenant_id": "default",
          "marketplace": "US"
        }
      },
      "confidence": 0.85,
      "risk_level": "medium"
    }
  ]
}
```

### 消费方式

**环境变量**：`LEARNED_BUNDLE_PATH`

**示例**：
```python
from src.adapters.learned_bundle_loader import LearnedBundleLoader

loader = LearnedBundleLoader()
policies = loader.load()  # 返回 production policies 列表
```

### 完整性校验

1. 读取 `*.manifest.json`
2. 计算 tar.gz 的 SHA256
3. 对比 `manifest.sha256`
4. 不匹配则拒绝加载

### 版本约束

Engine 通过 `contracts_compat` 声明兼容版本：

```yaml
contracts_compat: ">=1.0 <2.0"
```

Bundle 的 `schema_version` 必须在范围内。

---

**Version**: 1.0.0
**Last Updated**: 2026-02-08
