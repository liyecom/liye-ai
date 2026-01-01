# Release Notes: v6.1.1

> **发布日期**: 2026-01-01
> **类型**: 硬化版本（Hardening Release）
> **分支**: `release/v6.1.1-hardening`

---

## 概述

v6.1.1 是一个**硬化版本**，将 v6.1.0 的架构整合变成可审计、可复用、可被 CI 强制的稳态版本。

---

## 主要变更

### 新增

| 文件/目录 | 用途 |
|-----------|------|
| `tools/audit/verify_v6_1.py` | 架构验收脚本（CI 强制） |
| `.github/workflows/architecture-hardening-gate.yml` | CI 工作流 |
| `_meta/docs/SYMLINKS.md` | Symlink 治理文档 |
| `docs/architecture/MIGRATION_v6_0_to_v6_1.md` | 迁移指南 |
| `docs/architecture/RELEASE_v6.1.1_CHECKLIST.md` | 发布清单 |
| `tests/smoke/test_amazon_growth_bootstrap.py` | Smoke 测试 |

### 更新

| 文件 | 变更 |
|------|------|
| `src/domain/amazon-growth/agent_loader.py` | 强化到 v2.0.0（严格校验、CLI、报告） |
| `_meta/docs/ARCHITECTURE_CONSTITUTION.md` | 更新到 v1.2（新增 Symlink 和生成产物治理） |
| `CLAUDE.md` | 新增"新手执行路径"段落 |

### 删除

| 文件/目录 | 原因 |
|-----------|------|
| `src/domain/main.py` | 遗留入口，已被 amazon-growth/main.py 取代 |
| `.scaffold/` | 遗留模板目录 |

---

## 验收脚本

```bash
# 运行完整验收
python tools/audit/verify_v6_1.py

# 输出示例
CHECK A: SSOT Agent Definition Compliance    [PASS]
CHECK B: Agent Loader Assertions             [PASS]
CHECK C: Symlink Governance                  [PASS]
CHECK D: Smoke Test                          [PASS]

ALL CHECKS PASSED
```

---

## CI 集成

新增 GitHub Action `.github/workflows/architecture-hardening-gate.yml`：

- **触发条件**: `pull_request` + `push main`
- **检查项**:
  - SSOT 违规检测
  - Agent 数量验证
  - Symlink 登记验证
- **失败时**: Block merge

---

## Agent 加载器增强

`agent_loader.py` 升级到 v2.0.0：

| 功能 | 说明 |
|------|------|
| `--dry-run` | 仅验证，不调用外部 API |
| `--report` | 生成报告到 Artifacts_Vault |
| `--verbose` | 详细输出 |
| `--json` | JSON 格式输出 |
| 重复 ID 检测 | 发现重复立即抛错 |
| 必填字段校验 | 缺少字段立即抛错 |

---

## Symlink 治理

新增 `_meta/docs/SYMLINKS.md`：

- 8 个 symlinks 全部登记
- 每个 symlink 有退役版本（v6.3.0）
- 禁止新增规则
- 迁移指引

---

## 宪法更新

`ARCHITECTURE_CONSTITUTION.md` 更新到 v1.2：

| 条款 | 内容 |
|------|------|
| 第 4.2 条 | Symlink 治理（禁止新增、必须退役） |
| 第 4.3 条 | 生成产物治理（.compiled 等不入库） |

---

## 统计

| 指标 | 值 |
|------|-----|
| 新增文件 | 7 |
| 更新文件 | 3 |
| 删除文件 | 2 |
| Agent 数量 | 14（12 原生 + 2 别名） |
| Symlinks | 8 |
| CI 检查项 | 4 |

---

## 回滚

如需回滚：

```bash
git checkout feat/amazon-growth-os-v4.2-governance
```

---

## 下一步

| 版本 | 计划 |
|------|------|
| v6.2.0 | 下一个功能版本 |
| v6.3.0 | 删除所有兼容 symlinks |

---

**发布者**: Claude Code (Release Captain)
**审核者**: 架构委员会
