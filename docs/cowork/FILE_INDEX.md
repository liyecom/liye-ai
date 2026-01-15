# 文件级清单 (File Index)

> **Phase**: 1-C (File-Level Analysis)
> **Author**: Claude Cowork
> **Created**: 2026-01-13
> **Status**: Draft

---

## 统计概览

| 目录 | 文件数 | 主要类型 | 稳定性级别 |
|------|--------|----------|------------|
| src/ | 153 | .js, .md | Stable |
| .claude/ | 34 | .mjs, .md, .yaml | Stable |
| _meta/ | 35 | .md, .yaml, .json | Frozen/Stable |
| tools/ | 240 | .py, .js, .json | Experimental |
| systems/ | 55 | .js, .json, .md | Experimental |
| docs/ | 131 | .md | Stable |
| .github/workflows/ | 23 | .yml | Frozen |
| tracks/ | 8 | .md, .yaml | Experimental |
| verdicts/ | 4 | .md | Stable |
| builders/ | 5 | .md | Experimental |
| Agents/ | 9 | .md | Experimental |
| Crews/ | 4 | .md | Archive候选 |
| Skills/ | 39 | .md | Experimental |

**总计**: ~700+ 文件 (不含 node_modules, .venv, .compiled)

---

## 1. src/ — 核心运行时 (153 files)

### 1.1 kernel/ — 内核层

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `src/kernel/README.md` | 内核文档 | 文档 |
| `src/kernel/state/` | 状态管理 | High |
| `src/kernel/registry/` | 服务注册 | High |

### 1.2 domain/ — 领域层

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `src/domain/geo/config.yaml` | Geo Pipeline 配置 | Critical |
| `src/domain/geo/README.md` | Geo 文档 | 文档 |
| `src/domain/geo/spec.md` | Geo 规范 | High |

### 1.3 runtime/ — 运行时层

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `src/runtime/context/` | 上下文管理 | High |
| `src/runtime/lifecycle/` | 生命周期 | High |
| `src/runtime/router/` | 路由逻辑 | High |

### 1.4 brokers/ — 中介层

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `src/brokers/llm/` | LLM 调用 | High |
| `src/brokers/message/` | 消息传递 | Medium |
| `src/brokers/tool/` | 工具调用 | High |

### 1.5 mission/ — 任务系统

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `src/mission/types.js` | 类型定义 | Critical (高引用) |
| `src/mission/utils.js` | 工具函数 | Critical (高引用) |
| `src/mission/executor.js` | 任务执行器 | High |
| `src/mission/planner.js` | 任务规划器 | High |
| `src/mission/validator.js` | 任务验证器 | High |

### 1.6 interfaces/ — 接口层

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `src/interfaces/cli/` | CLI 接口 | Medium |
| `src/interfaces/api/` | API 接口 | Medium |

---

## 2. .claude/ — Claude Code 入口 (34 files)

### 2.1 scripts/ — 核心脚本

| 路径 | 用途 | 入口类型 | 关键性 |
|------|------|----------|--------|
| `.claude/scripts/assembler.mjs` | Pack 编译器 | CLAUDE.md | Critical |
| `.claude/scripts/guardrail.mjs` | 护栏检查 | CLAUDE.md | Critical |
| `.claude/scripts/pre_tool_check.mjs` | 工具预检 | CLAUDE.md | Critical |
| `.claude/scripts/stop_gate.mjs` | 停止门 | CLAUDE.md | Critical |
| `.claude/scripts/verify_glossary_usage.sh` | 术语验证 | CI | High |

### 2.2 packs/ — 上下文包

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `.claude/packs/*.md` | 上下文定义 | High |
| `.claude/packs/geo.md` | Geo 上下文 | High |
| `.claude/packs/governance.md` | 治理上下文 | High |

### 2.3 skills/ — Claude 技能

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `.claude/skills/*.md` | 技能定义 | Medium |

### 2.4 配置文件

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `.claude/settings.json` | Claude 设置 | High |
| `.claude/CLAUDE.md` | 主入口 | Critical |

---

## 3. _meta/ — 元治理层 (35 files)

### 3.1 governance/ — 宪法层 (Frozen)

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `_meta/governance/ARCHITECTURE_CONTRACT.md` | 架构契约 | Critical |
| `_meta/governance/CLAUDE_GUIDE.md` | Claude 指南 | Critical |
| `_meta/governance/CONSTITUTIONAL_LOCK.md` | 宪法锁 | Critical |

### 3.2 contracts/ — 机器契约

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `_meta/contracts/decision_contract.yaml` | 决策契约 | Critical |
| `_meta/contracts/stability_contract.yaml` | 稳定性契约 | Critical |

### 3.3 schemas/ — JSON Schema

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `_meta/schemas/geo_unit.schema.json` | Geo 单元 Schema | High |
| `_meta/schemas/track.schema.json` | Track Schema | High |

### 3.4 templates/ — 模板

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `_meta/templates/adr_template.md` | ADR 模板 | Medium |
| `_meta/templates/rfc_template.md` | RFC 模板 | Medium |

---

## 4. tools/ — 工具生态 (240 files)

### 4.1 geo-pipeline/ — 知识引擎 (~4400 lines)

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `tools/geo-pipeline/config.yaml` | 主配置 | Critical |
| `tools/geo-pipeline/README.md` | 文档 | High |
| `tools/geo-pipeline/ingestion/normalize.py` | 文档归一化 | High |
| `tools/geo-pipeline/processing/chunk.py` | 分块处理 | High |
| `tools/geo-pipeline/processing/extract.py` | 结构提取 | High |
| `tools/geo-pipeline/outputs/export_json.py` | JSON 导出 | High |
| `tools/geo-pipeline/refinement/truth_delta_gate.py` | T2→T1 门控 | Critical |

### 4.2 notion-sync/ — Notion 同步

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `tools/notion-sync/src/index.js` | 主入口 | Medium |
| `tools/notion-sync/config/` | 配置 | Medium |

### 4.3 web-publisher/ — Web 发布

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `tools/web-publisher/` | 发布工具 | Low |

### 4.4 audit/ — 审计工具

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `tools/audit/` | 审计脚本 | Medium |

### 4.5 recall/ — Recall 工具

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `tools/recall/recall.js` | package.json bin 入口 | High |

---

## 5. systems/ — 应用系统 (55 files)

### 5.1 information-radar/ — 信息雷达

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `systems/information-radar/src/` | 源码 | Medium |
| `systems/information-radar/config/` | 配置 | Medium |

### 5.2 site-deployer/ — 站点部署

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `systems/site-deployer/` | 部署工具 | Low |

---

## 6. .github/workflows/ — CI 工作流 (23 files, Frozen)

| 文件 | 用途 | 关键性 |
|------|------|--------|
| `architecture-gate.yml` | 架构门禁 | Critical |
| `domain-replay-gate.yml` | 回放测试 | Critical |
| `i18n-gate.yml` | 国际化门禁 | High |
| `pr-title-gate.yml` | PR 标题检查 | High |
| `amazon-leak-guard.yml` | 敏感信息检测 | Critical |
| `pre-commit.yml` | 预提交检查 | High |

---

## 7. docs/ — 文档 (131 files)

### 7.1 architecture/ — 架构文档

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `docs/architecture/CONSTITUTION.md` | 宪法 | Critical |
| `docs/architecture/T1_CANONICAL_DEFINITION.md` | T1 定义 | Critical |
| `docs/architecture/WORLD_MODEL_GATE.md` | 世界模型门 | Critical |

### 7.2 adrs/ — 架构决策记录

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `docs/adrs/` | ADR 集合 | High |

### 7.3 rfcs/ — RFC 提案

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `docs/rfcs/` | RFC 集合 | Medium |

---

## 8. 执行相关目录

### 8.1 tracks/ — 执行容器 (8 files)

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `tracks/*/spec.md` | 任务规范 | High |
| `tracks/*/plan.md` | 执行计划 | High |
| `tracks/*/checkpoint.yaml` | 检查点 | High |

### 8.2 verdicts/ — 决策语义 (4 files)

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `verdicts/README.md` | 说明 | High |
| `verdicts/geo/` | Geo 决策 | Medium |

### 8.3 replays/ — 回放测试

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `replays/geo/cases/*.json` | 测试用例 | High |
| `replays/geo/README.md` | 说明 | Medium |

---

## 9. 其他目录

### 9.1 builders/ — 构建者模板 (5 files)

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `builders/README.md` | 说明 | Low |
| `builders/templates/` | 模板 | Low |

### 9.2 Agents/ — Agent 定义 (9 files)

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `Agents/README.md` | 说明 | Low |
| `Agents/geo_agent.md` | Geo Agent | Medium |

### 9.3 Crews/ — Crew 定义 (4 files) — Archive候选

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `Crews/` | CrewAI 遗留 | Archive |

### 9.4 Skills/ — 技能库 (39 files)

| 路径 | 用途 | 关键性 |
|------|------|--------|
| `Skills/README.md` | 说明 | Low |
| `Skills/geo/` | Geo 技能 | Medium |

---

## 10. 根目录文件

| 文件 | 用途 | 关键性 |
|------|------|--------|
| `CLAUDE.md` | Claude 主入口 | Critical |
| `package.json` | NPM 配置 | High |
| `README.md` | 项目说明 | High |
| `.gitignore` | Git 忽略 | Medium |
| `.env.example` | 环境变量模板 | Medium |

---

*Phase 1-C FILE_INDEX 完成*
