# Symlink Governance Document

> **版本**: 1.1
> **创建日期**: 2026-01-01
> **状态**: 生效中
> **目的**: 记录所有 symlinks 及其退役计划
> **宪法条款**: 第 4.2 条 + Amendment 2026-01-01-A

---

## 核心原则

1. **Symlinks 是临时兼容层**，不是永久架构
2. **禁止新增 symlinks**，除非通过 RFC 审批
3. **每个 symlink 必须有退役版本**
4. **新代码禁止使用 symlink 路径**
5. **OVERDUE symlinks 被 CI 阻止**（见 Amendment 2026-01-01-A）

> **强制执行**：当 `current_version >= retire_by` 时，`verify_v6_1.py` 会返回 exit 1，CI 将阻止合并。
> 参见：[ARCHITECTURE_CONSTITUTION.md](./ARCHITECTURE_CONSTITUTION.md#amendment-2026-01-01-a-symlink-retirement-enforcement)

---

## 当前 Symlinks 清单

| Symlink | 目标路径 | 创建版本 | 退役版本 | 状态 |
|---------|----------|----------|----------|------|
| `governance` | `_meta/governance` | v6.1.0 | v6.3.0 | 活跃 |
| `schemas` | `_meta/schemas` | v6.1.0 | v6.3.0 | 活跃 |
| `templates` | `_meta/templates` | v6.1.0 | v6.3.0 | 活跃 |
| `stats` | `data/stats` | v6.1.0 | v6.3.0 | 活跃 |
| `traces` | `data/traces` | v6.1.0 | v6.3.0 | 活跃 |
| `adapters` | `src/adapters` | v6.1.0 | v6.3.0 | 活跃 |
| `reports` | `Artifacts_Vault/reports` | v6.1.0 | v6.3.0 | 活跃 |
| `scripts` | `tools` | v6.1.0 | v6.3.0 | 活跃 |

**总计**: 8 个 symlinks

---

## 详细说明

### 1. governance → _meta/governance

**兼容原因**: v6.0 及之前版本使用 `governance/` 作为治理规则目录

**新路径**: `_meta/governance/`

**迁移指引**:
```python
# 旧代码（禁止新增）
from governance.validator import validate

# 新代码（推荐）
from _meta.governance.validator import validate
```

**退役版本**: v6.3.0

---

### 2. schemas → _meta/schemas

**兼容原因**: v6.0 及之前版本使用 `schemas/` 作为数据结构目录

**新路径**: `_meta/schemas/`

**迁移指引**:
```python
# 旧代码（禁止新增）
schema_path = "schemas/agent.json"

# 新代码（推荐）
schema_path = "_meta/schemas/agent.json"
```

**退役版本**: v6.3.0

---

### 3. templates → _meta/templates

**兼容原因**: v6.0 及之前版本使用 `templates/` 作为模板目录

**新路径**: `_meta/templates/`

**迁移指引**: 同上

**退役版本**: v6.3.0

---

### 4. stats → data/stats

**兼容原因**: v6.0 及之前版本使用 `stats/` 存储统计数据

**新路径**: `data/stats/`

**迁移指引**:
```python
# 旧代码（禁止新增）
stats_dir = Path("stats")

# 新代码（推荐）
stats_dir = Path("data/stats")
```

**退役版本**: v6.3.0

---

### 5. traces → data/traces

**兼容原因**: v6.0 及之前版本使用 `traces/` 存储执行轨迹

**新路径**: `data/traces/`

**迁移指引**: 同上

**退役版本**: v6.3.0

---

### 6. adapters → src/adapters

**兼容原因**: v6.0 及之前版本使用 `adapters/` 存储适配器

**新路径**: `src/adapters/`

**迁移指引**:
```python
# 旧代码（禁止新增）
from adapters.t1 import T1Adapter

# 新代码（推荐）
from src.adapters.t1 import T1Adapter
```

**退役版本**: v6.3.0

---

### 7. reports → Artifacts_Vault/reports

**兼容原因**: v6.0 及之前版本使用 `reports/` 存储报告

**新路径**: `Artifacts_Vault/reports/`

**迁移指引**:
```python
# 旧代码（禁止新增）
report_path = Path("reports") / "daily.md"

# 新代码（推荐）
report_path = Path("Artifacts_Vault/reports") / "daily.md"
```

**退役版本**: v6.3.0

---

### 8. scripts → tools

**兼容原因**: v6.0 及之前版本使用 `scripts/` 存储脚本

**新路径**: `tools/`

**迁移指引**:
```bash
# 旧路径（禁止新增）
./scripts/derive_all.sh

# 新路径（推荐）
./tools/derive_all.sh
```

**退役版本**: v6.3.0

---

## 新增 Symlink 流程

如果确实需要新增 symlink（极少数情况），必须：

1. **提交 RFC**：说明兼容原因和退役计划
2. **架构审批**：获得架构委员会批准
3. **更新本文档**：添加到清单
4. **设置退役版本**：必须在 3 个次版本内退役

**RFC 模板**:
```markdown
## Symlink RFC

**名称**: [symlink_name]
**目标**: [target_path]
**原因**: [为什么需要兼容]
**退役版本**: [必须指定]
**迁移指引**: [如何从旧路径迁移到新路径]
```

---

## 退役流程

当版本达到退役版本时：

1. **扫描引用**：确保没有代码引用旧路径
2. **删除 symlink**：`rm <symlink_name>`
3. **更新本文档**：将状态改为"已退役"
4. **更新 CHANGELOG**：记录 breaking change

---

## 审计脚本

使用以下命令检查 symlink 合规性：

```bash
python tools/audit/verify_v6_1.py
```

该脚本会：
- 验证所有 symlinks 都在本文档中登记
- 检查是否有未登记的 symlinks
- 验证 symlink 目标有效

---

**Version**: 1.0
**Last Updated**: 2026-01-01
