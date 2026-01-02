# Migration Guide: v6.0 → v6.1

> **版本**: v6.1.1
> **日期**: 2026-01-01
> **影响范围**: 目录结构、Agent 加载、配置路径

---

## 概述

v6.1 是一次**架构整合**版本，主要目标是：
1. 消除 1.4MB 重复代码
2. 建立 Agent SSOT（单一真相源）
3. 精简顶层目录从 28 → 18 个
4. 引入 CI 强制的架构治理

---

## Breaking Changes

### 1. 删除的目录/文件

| 已删除 | 原因 | 替代方案 |
|--------|------|----------|
| `src/domain/src/` | 与 `amazon-growth/runtime/` 重复 | 使用 `src/domain/amazon-growth/runtime/` |
| `src/domain/agents/` | 与 `Agents/amazon-growth/` 重复 | 使用 `Agents/amazon-growth/` |
| `src/domain/config/agents.yaml` | SSOT 违规 | 使用 `agent_loader.py` |
| `src/domain/main.py` | 遗留入口 | 使用 `src/domain/amazon-growth/main.py` |
| `.scaffold/` | 遗留模板 | 使用 `_meta/templates/` |

### 2. Agent 加载机制变更

**旧方式**（v6.0）：
```python
# 从 config 文件加载（只有 3 个 Agent）
agents_config = load_config('config/agents.yaml')
```

**新方式**（v6.1）：
```python
# 从 SSOT 动态加载（14 个 Agent）
from agent_loader import load_agents_from_ssot
agents_config = load_agents_from_ssot()
```

**影响**：
- Agent 数量从 3 → 14
- 新增兼容别名：`keyword_analyst` → `keyword_architect`
- 新增兼容别名：`competitor_analyst` → `market_analyst`

### 3. 目录结构变更

| 旧路径 | 新路径 | Symlink 兼容 |
|--------|--------|--------------|
| `governance/` | `_meta/governance/` | ✅ 有 |
| `schemas/` | `_meta/schemas/` | ✅ 有 |
| `templates/` | `_meta/templates/` | ✅ 有 |
| `stats/` | `data/stats/` | ✅ 有 |
| `traces/` | `data/traces/` | ✅ 有 |
| `adapters/` | `src/adapters/` | ✅ 有 |
| `reports/` | `Artifacts_Vault/reports/` | ✅ 有 |
| `scripts/` | `tools/` | ✅ 有 |

**Symlink 退役**：v6.3.0 将删除所有兼容 symlinks

---

## 迁移步骤

### 步骤 1: 更新 Agent 加载代码

如果你的代码使用 `load_config('config/agents.yaml')`：

```python
# 修改前
agents_config = load_config('config/agents.yaml')

# 修改后
from agent_loader import load_agents_from_ssot
agents_config = load_agents_from_ssot()
```

### 步骤 2: 更新路径引用

搜索并替换以下路径：

```bash
# 检查旧路径引用
grep -rn "src/domain/src/" .
grep -rn "src/domain/agents/" .
grep -rn "config/agents.yaml" .
```

### 步骤 3: 使用新路径（推荐）

虽然 symlinks 提供兼容，但新代码应使用新路径：

```python
# 不推荐（使用 symlink）
from governance.validator import validate

# 推荐（使用新路径）
from _meta.governance.validator import validate
```

### 步骤 4: 验证迁移

运行架构验收脚本：

```bash
python tools/audit/verify_v6_1.py
```

所有检查必须 PASS。

---

## 常见问题

### Q: 为什么删除了 src/domain/src/？

A: 它与 `src/domain/amazon-growth/runtime/` 是**字节级重复**（1.4MB，47 个文件）。保留一份即可。

### Q: 新的 Agent 在哪里定义？

A: `Agents/amazon-growth/` 是唯一权威位置（SSOT）。运行时使用 `agent_loader.py` 动态加载。

### Q: symlinks 什么时候删除？

A: v6.3.0 将删除所有兼容 symlinks。请在此之前迁移到新路径。

### Q: 如何验证我的代码兼容 v6.1？

A: 运行 `python tools/audit/verify_v6_1.py`，确保所有检查通过。

---

## 版本时间线

| 版本 | 日期 | 变更 |
|------|------|------|
| v6.0.0 | 2025-12-30 | 删除 liye CLI，Claude Code Native |
| v6.1.0 | 2025-12-31 | 架构整合（删除重复、SSOT、目录精简） |
| v6.1.1 | 2026-01-01 | 硬化版本（CI 强制、验收脚本） |
| v6.2.0 | TBD | 下一个功能版本 |
| v6.3.0 | TBD | 删除所有兼容 symlinks |

---

## 相关文档

- [架构宪法](./_meta/docs/ARCHITECTURE_CONSTITUTION.md)
- [Symlink 治理](./_meta/docs/SYMLINKS.md)
- [Release Checklist](./RELEASE_v6.1.1_CHECKLIST.md)

---

**需要帮助？** 联系架构委员会或查看 `docs/architecture/` 目录。
