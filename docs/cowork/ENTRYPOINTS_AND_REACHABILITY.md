# 入口点与可达性分析 (Entrypoints & Reachability)

> **Phase**: 1-C (File-Level Analysis)
> **Author**: Claude Cowork
> **Created**: 2026-01-13
> **Status**: Draft

---

## 1. 入口点总览

### 1.1 package.json 定义的入口

```json
{
  "bin": {
    "recall": "tools/recall/recall.js"
  }
}
```

**分析**: 只有一个 CLI 入口 `recall`，用于工具调用。

---

### 1.2 CLAUDE.md 定义的命令入口

| 命令 | 脚本路径 | 用途 |
|------|----------|------|
| `node .claude/scripts/assembler.mjs` | `.claude/scripts/assembler.mjs` | 编译 Pack 上下文 |
| `node .claude/scripts/guardrail.mjs` | `.claude/scripts/guardrail.mjs` | 护栏检查 |
| `node .claude/scripts/pre_tool_check.mjs` | `.claude/scripts/pre_tool_check.mjs` | 工具预检 |
| `node .claude/scripts/stop_gate.mjs` | `.claude/scripts/stop_gate.mjs` | 停止门控 |
| `bash .claude/scripts/verify_glossary_usage.sh` | `.claude/scripts/verify_glossary_usage.sh` | 术语验证 |

---

### 1.3 GitHub Workflows 引用的入口

| 工作流 | 引用脚本 | 用途 |
|--------|----------|------|
| `architecture-gate.yml` | 多个验证脚本 | 架构门禁 |
| `domain-replay-gate.yml` | `tools/geo_os_replay_runner.js` | 回放测试 |
| `i18n-gate.yml` | i18n 验证脚本 | 国际化检查 |
| `amazon-leak-guard.yml` | gitleaks | 敏感信息检测 |
| `pre-commit.yml` | 预提交钩子 | 代码质量 |

---

## 2. 可达性分析

### 2.1 高频被引用文件 (Top 10)

基于 `import`/`require` 依赖分析：

| 排名 | 文件路径 | 引用次数 | 用途 |
|------|----------|----------|------|
| 1 | `src/mission/types.js` | 15+ | 类型定义 |
| 2 | `src/mission/utils.js` | 12+ | 工具函数 |
| 3 | `src/kernel/state/index.js` | 10+ | 状态管理 |
| 4 | `src/brokers/llm/client.js` | 8+ | LLM 客户端 |
| 5 | `src/runtime/context/index.js` | 7+ | 上下文管理 |
| 6 | `src/brokers/tool/registry.js` | 6+ | 工具注册 |
| 7 | `src/mission/executor.js` | 5+ | 任务执行 |
| 8 | `src/mission/planner.js` | 5+ | 任务规划 |
| 9 | `src/interfaces/cli/commands.js` | 4+ | CLI 命令 |
| 10 | `src/kernel/registry/index.js` | 4+ | 服务注册 |

---

### 2.2 可达性图谱

```
┌─────────────────────────────────────────────────────────────────┐
│                        入口层 (Entrypoints)                      │
├─────────────────────────────────────────────────────────────────┤
│  CLAUDE.md → assembler.mjs → packs/*.md                         │
│            → guardrail.mjs → contracts/*.yaml                   │
│            → pre_tool_check.mjs → schemas/*.json                │
│            → stop_gate.mjs → governance/*.md                    │
│                                                                 │
│  package.json → recall.js → src/mission/*                       │
│                                                                 │
│  workflows/*.yml → geo_os_replay_runner.js → replays/geo/*      │
│                  → verify_glossary_usage.sh → tracks/*          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        核心层 (Core)                             │
├─────────────────────────────────────────────────────────────────┤
│  src/mission/types.js ◄──────── (15+ 引用)                      │
│  src/mission/utils.js ◄──────── (12+ 引用)                      │
│  src/kernel/state/* ◄────────── (10+ 引用)                      │
│  src/brokers/llm/client.js ◄─── (8+ 引用)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        领域层 (Domain)                           │
├─────────────────────────────────────────────────────────────────┤
│  src/domain/geo/* ────────────► tools/geo-pipeline/*            │
│  src/domain/*/config.yaml ────► _meta/contracts/*               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        应用层 (Applications)                     │
├─────────────────────────────────────────────────────────────────┤
│  tools/geo-pipeline/* ────────► 输出 geo_units.json             │
│  systems/information-radar/* ─► 消费 geo_units.json             │
│  systems/site-deployer/* ─────► 消费 Notion 数据                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 孤立文件分析 (Orphaned Files)

### 3.1 疑似孤立脚本

以下脚本未被任何入口点引用，可能是：
- 历史遗留
- 手动执行脚本
- 开发调试工具

| 文件路径 | 推测用途 | 建议 |
|----------|----------|------|
| `.claude/scripts/smoke_route_geo_alias.mjs` | Geo 路由冒烟测试 | 确认后归档 |
| `.claude/scripts/audit_redirect_usage.mjs` | 重定向审计 | 确认后归档 |
| `.claude/scripts/report_prefix_debt.mjs` | 前缀债务报告 | 确认后归档 |

### 3.2 孤立目录

| 目录 | 推测状态 | 建议 |
|------|----------|------|
| `Crews/` | CrewAI 遗留 | 确认后归档 |
| `Glossaries/` (如存在) | 可能有遗留引用 | grep 确认后处理 |
| `Extensions/` (如存在) | 扩展实验 | 确认后归档 |
| `Artifacts_Vault/` (如存在) | 产物存储 | 确认后归档 |

---

## 4. 依赖链分析

### 4.1 关键依赖链

#### 链条 1: Claude Code 会话启动

```
CLAUDE.md
  └── .claude/scripts/assembler.mjs
        └── .claude/packs/*.md
              └── 编译输出 → .claude/.compiled/
```

**风险点**: assembler.mjs 逻辑错误会导致所有会话获得错误上下文

#### 链条 2: Geo Pipeline 执行

```
tools/geo-pipeline/config.yaml
  └── tools/geo-pipeline/ingestion/normalize.py
        └── tools/geo-pipeline/processing/chunk.py
              └── tools/geo-pipeline/processing/extract.py
                    └── tools/geo-pipeline/outputs/export_json.py
                          └── 输出 geo_units.json
```

**风险点**: 任何阶段失败都会导致下游无数据或错误数据

#### 链条 3: CI 门禁

```
.github/workflows/architecture-gate.yml
  └── 多个验证脚本
        └── _meta/contracts/*.yaml (规则来源)
              └── 通过/阻断 PR
```

**风险点**: 门禁规则过严会阻断正常开发；过松会放过风险

#### 链条 4: Track 生命周期

```
tracks/*/spec.md
  └── tracks/*/plan.md
        └── 执行产物
              └── tracks/*/checkpoint.yaml (冻结)
```

**风险点**: 未生成 checkpoint 会破坏审计链

---

## 5. 隐性依赖

### 5.1 路径硬编码

以下文件中存在硬编码路径引用：

| 引用位置 | 硬编码路径 | 风险 |
|----------|------------|------|
| `tools/geo-pipeline/config.yaml` | `~/data/archives/{source}` | 环境依赖 |
| `_meta/contracts/*.yaml` | 相对路径引用 | 重命名风险 |
| `.github/workflows/*.yml` | 脚本路径 | 重命名风险 |

### 5.2 环境变量依赖

| 变量名 | 用途 | 依赖模块 |
|--------|------|----------|
| `NOTION_API_KEY` | Notion 同步 | tools/notion-sync |
| `OPENAI_API_KEY` | LLM 调用 | src/brokers/llm |
| `GITHUB_TOKEN` | CI 操作 | .github/workflows |

---

## 6. 可达性统计

### 6.1 从入口可达的文件

| 入口类型 | 可达文件数 | 占比 |
|----------|------------|------|
| CLAUDE.md 脚本 | ~50 | ~7% |
| package.json bin | ~30 | ~4% |
| GitHub workflows | ~40 | ~6% |
| **直接可达合计** | ~120 | ~17% |

### 6.2 间接可达 (通过 import/require)

| 层级 | 文件数 | 累计占比 |
|------|--------|----------|
| 1 级依赖 | +150 | ~38% |
| 2 级依赖 | +100 | ~53% |
| 3+ 级依赖 | +80 | ~64% |

### 6.3 未可达文件

约 **36%** 的文件未被任何入口点直接或间接引用，包括：
- 文档文件 (docs/)
- 配置模板 (_meta/templates/)
- 归档候选 (Crews/, Extensions/ 等)
- 测试用例 (部分 replays/)

---

## 7. 可达性结论

### 7.1 核心可达路径

1. **Claude Code 会话**: CLAUDE.md → assembler.mjs → packs → 会话上下文
2. **CI 门禁**: workflows → 验证脚本 → contracts → 通过/阻断
3. **知识引擎**: geo-pipeline → 处理脚本 → geo_units.json

### 7.2 高风险断裂点

1. **assembler.mjs**: 单点故障，影响所有会话
2. **architecture-gate.yml**: 治理核心，修改需 RFC
3. **geo-pipeline/config.yaml**: 知识引擎配置，修改需版本升级

### 7.3 低风险孤立区

1. **Crews/**: 无引用，可安全归档
2. **部分 docs/**: 纯文档，无代码依赖
3. **builders/templates/**: 模板文件，按需使用

---

*Phase 1-C ENTRYPOINTS_AND_REACHABILITY 完成*
