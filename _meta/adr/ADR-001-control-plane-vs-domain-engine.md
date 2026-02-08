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

## Appendix A: Learned Bundle Specification v1.1.0

> **Week 2 冻结**：此规范为 Week 2 交付标准，后续修改需要新 ADR。

### A.1 Bundle 目录树（冻结）

```
learned-bundle_<version>.tgz
├── manifest.json           # 必需，字段白名单严格
├── policies/
│   └── production/         # Week 2 仅打包 production
│       └── *.yaml
└── skills/                 # 可选
    └── production/
        └── *.yaml
```

**Week 2 限制**：
- 仅打包 `production` 状态策略
- `candidate` 暂不打包（减少变量）

### A.2 manifest.json 字段白名单（冻结）

```json
{
  "bundle_version": "0.2.0",
  "schema_version": "1.0.0",
  "created_at": "2026-02-08T12:00:00Z",
  "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "policies_index": [
    {
      "policy_id": "BID_OPT_HIGH_CVR_EXACT",
      "domain": "amazon-advertising",
      "file": "policies/production/BID_OPT_HIGH_CVR_EXACT.yaml",
      "sha256": "abc123def456...",
      "scope": {
        "type": "asin",
        "keys": {
          "tenant_id": "default",
          "marketplace": "US"
        }
      },
      "risk_level": "medium",
      "confidence": 0.85
    }
  ],
  "skills_index": []
}
```

**字段说明**：

| 字段 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `bundle_version` | string | ✅ | SemVer，如 "0.2.0" |
| `schema_version` | string | ✅ | 对应 learned_policy.schema 版本 |
| `created_at` | string | ✅ | ISO 8601 时间戳 |
| `sha256` | string | ✅ | Bundle 内容哈希（manifest 自身 sha256 字段置空后计算） |
| `policies_index` | array | ✅ | 策略索引列表 |
| `skills_index` | array | ❌ | 技能索引列表（可选） |

**policies_index[] 字段**：

| 字段 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `policy_id` | string | ✅ | 策略唯一 ID |
| `domain` | string | ✅ | 所属领域 |
| `file` | string | ✅ | 相对路径 |
| `sha256` | string | ✅ | 文件内容哈希 |
| `scope` | object | ✅ | 作用范围 |
| `risk_level` | string | ✅ | 风险等级 |
| `confidence` | number | ✅ | 置信度 (0~1) |

**严格约束**：
- `additionalProperties: false` - 禁止未知字段
- 验证器必须拒绝任何白名单外的字段

### A.3 SHA256 计算规则

1. **单文件哈希**：`sha256(file_content)`
2. **Bundle 整体哈希**：
   - 将 manifest.json 的 `sha256` 字段置为空字符串 `""`
   - 计算整个 tgz 文件的 sha256
   - 写回 `sha256` 字段
   - 重新打包（或使用两阶段构建）

### A.4 可复现性要求

构建必须满足以下条件才能保证相同输入产生相同输出：

1. **文件排序稳定**：按文件名字母序
2. **Index 排序稳定**：按 `policy_id` 字母序
3. **时间戳**：使用构建时间，而非文件 mtime
4. **Tar 选项**：`--sort=name --mtime='UTC 2026-01-01'`

### A.5 消费方式

**环境变量**：`LEARNED_BUNDLE_PATH=/path/to/learned-bundle_0.2.0.tgz`

**AGE 加载示例**：
```python
from src.learned.bundle_loader import BundleLoader

loader = BundleLoader()
policies = loader.load()  # 返回 production policies 列表

# 按 domain + scope 过滤
matched = loader.match(
    domain="amazon-advertising",
    scope_context={"tenant_id": "default", "marketplace": "US"}
)
```

**禁止**：
- 任何 `~/github/liye_os/...` 路径
- 任何软链接
- 任何硬编码 OS 路径

### A.6 完整性校验流程

```
1. 解压 tgz 到临时目录
2. 读取 manifest.json
3. 校验 manifest 字段白名单（拒绝未知字段）
4. 遍历 policies_index：
   a. 检查文件存在
   b. 计算文件 sha256，对比 index.sha256
   c. 解析 YAML，校验 learned_policy.schema
5. 重算 bundle sha256（manifest.sha256 置空）
6. 对比 manifest.sha256
7. 全部通过 → 返回策略列表；任一失败 → 拒绝加载
```

### A.7 版本兼容性

Engine 通过 `contracts_compat` 声明兼容版本范围：

```yaml
# engine_manifest.yaml
contracts_compat: ">=1.0 <2.0"
```

Bundle 的 `schema_version` 必须在范围内，否则拒绝加载。

---

**Version**: 1.1.0
**Last Updated**: 2026-02-08
**Week 2 Frozen**: ✅
