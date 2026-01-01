# Release v6.1.1 Hardening Checklist

> **版本**: v6.1.1-hardening
> **创建日期**: 2026-01-01
> **状态**: 进行中
> **目标**: 将 v6.1 架构整合变成可审计、可复用、可被 CI 强制的稳态版本

---

## 基线快照

| 项目 | 值 |
|------|-----|
| **Base Git SHA** | `8935aafc4ceb6ec652f16c6aaec9712c42d1027a` |
| **Base Branch** | `feat/amazon-growth-os-v4.2-governance` |
| **Release Branch** | `release/v6.1.1-hardening` |
| **创建时间** | 2026-01-01 |

---

## 顶层目录清单

### 真实目录（18个）

| 目录 | 用途 |
|------|------|
| `_meta/` | 系统元信息（governance, schemas, templates, docs） |
| `Agents/` | Agent 定义 SSOT |
| `Artifacts_Vault/` | 成果库（含 reports） |
| `config/` | 顶层配置 |
| `Crews/` | 团队定义 |
| `data/` | 运行时数据（stats, traces, missions） |
| `docs/` | 用户文档 |
| `examples/` | 示例 |
| `Extensions/` | 能力扩展 |
| `Glossaries/` | 术语表 |
| `node_modules/` | Node 依赖（不入库） |
| `Projects_Engine/` | 项目引擎 |
| `Skills/` | 方法论 |
| `src/` | 源代码 |
| `systems/` | 可部署系统 |
| `tests/` | 测试套件 |
| `tools/` | 开发工具 |
| `websites/` | 网站发布 |

### Symlinks（8个）

| Symlink | 目标 | 兼容原因 |
|---------|------|----------|
| `governance` | `_meta/governance` | 旧路径兼容 |
| `schemas` | `_meta/schemas` | 旧路径兼容 |
| `templates` | `_meta/templates` | 旧路径兼容 |
| `stats` | `data/stats` | 旧路径兼容 |
| `traces` | `data/traces` | 旧路径兼容 |
| `adapters` | `src/adapters` | 旧路径兼容 |
| `reports` | `Artifacts_Vault/reports` | 旧路径兼容 |
| `scripts` | `tools` | 旧路径兼容 |

---

## Agent 统计

| 指标 | 值 |
|------|-----|
| **SSOT 位置** | `Agents/amazon-growth/` |
| **Agent 总数** | 14（12 原生 + 2 兼容别名） |
| **加载器** | `src/domain/amazon-growth/agent_loader.py` |

### Agent 列表

| ID | Role |
|----|------|
| intent_analyst | Purchase Intent Analyst |
| listing_optimizer | Amazon Listing Optimization Expert |
| execution_agent | Tactical Operator |
| sprint_orchestrator | Sprint Orchestrator |
| keyword_architect | Keyword Ecosystem Architect |
| guardrail_governor | Operational Risk Guardian |
| quality_gate | Quality Assurance Gatekeeper |
| review_sentinel | Customer Voice Analyst |
| ppc_strategist | Amazon PPC Engineer |
| diagnostic_architect | Amazon Performance Diagnostic Architect |
| trace_scribe | Decision Trace Guardian |
| market_analyst | Market Intelligence Analyst |
| keyword_analyst | (alias → keyword_architect) |
| competitor_analyst | (alias → market_analyst) |

---

## 入口文件

| 领域 | 入口文件 | 位置 |
|------|----------|------|
| amazon-growth | main.py | `src/domain/amazon-growth/main.py` |
| agent-loader | agent_loader.py | `src/domain/amazon-growth/agent_loader.py` |

---

## 验收脚本

**位置**: `tools/audit/verify_v6_1.py`

**检查项**:
- [x] SSOT: Agent 只能从 Agents/ 加载
- [x] Agent Loader 断言: 14 agents, 唯一 ID, 必填字段
- [x] Symlink 治理: 8 个 symlinks 全部登记
- [x] Smoke Test: 入口模块可导入

**运行方式**:
```bash
python tools/audit/verify_v6_1.py
```

---

## CI Gate

**位置**: `.github/workflows/architecture-hardening-gate.yml`

**触发条件**: `pull_request` + `push main`

**失败时**: Block merge

---

## 回滚点

| 阶段 | 回滚命令 |
|------|----------|
| 任意阶段 | `git checkout feat/amazon-growth-os-v4.2-governance` |
| 部分修改 | `git stash && git checkout .` |

---

## 变更记录

| 日期 | 阶段 | 变更 |
|------|------|------|
| 2026-01-01 | PHASE 0 | 创建分支，记录基线快照 |
| 2026-01-01 | HOTFIX | Symlink 退役强制执行 (branch: `hotfix/v6.1.1-symlink-retire-enforcement`, base: `ba4e168`) |

---

## Hotfix: Symlink Retirement Enforcement

**分支**: `hotfix/v6.1.1-symlink-retire-enforcement`
**基线 SHA**: `ba4e168`

### 变更内容

1. **verify_v6_1.py 强制 FAIL 逻辑**
   - 当 `current_version >= retire_by` 时，verify 必须 exit 1
   - 输出强制整改清单（删除 symlink + 迁移动作 + 受影响引用）

2. **selftest 脚本**
   - `tools/audit/selftest_symlink_retire.sh`
   - 验证语义版本比较与 FAIL 行为

3. **宪法修订**
   - `ARCHITECTURE_CONSTITUTION.md` v1.3
   - 新增条款：Symlink Retirement Enforcement + Rollback Policy Hardening
