# LiYe OS 仓库世界模型 (Repo World Model)

> **Phase**: 1-A (只读理解)
> **Author**: Claude Cowork
> **Created**: 2026-01-13
> **Status**: Draft

---

## 1. 仓库整体目标与定位

### 1.1 核心定位

LiYe OS 是一个 **AI 原生基础设施项目 (AI-Native Infrastructure)**，专注于：

- **智能代理编排** (Intelligent Agent Orchestration)
- **人机协作升级** (Human-System Collaboration Upgrade)
- **可审计、可回放、可控演进的工程系统** (Auditable, Replayable, Controllable Engineering Systems)

**关键定义**: 这是一个 **参考实现 (Reference Implementation)**，不是产品。采用者需要阅读文档、理解架构后才能获得价值。

### 1.2 核心哲学

> "让盲目自信在结构上不可能发生" (Make blind confidence structurally impossible)

通过 **世界模型门禁 (World Model Gate)** 强制执行前风险分析：

| 层级 | 问题 | 输出 |
|------|------|------|
| T1 | 压力下哪里会失败？ | 因果链、假设暴露 |
| T2 | 当前危险状态？ | 5D 坐标 |
| T3 | 状态将如何演变？ | 形态描述 |

### 1.3 版本与当前状态

- **当前版本**: 6.3.0
- **当前分支**: `feat/two-speed-fastpath-gates` (活跃开发)
- **主分支**: `main`
- **许可证**: Apache 2.0

---

## 2. 一级目录地图

### 2.1 核心基础设施层

| 目录 | 职责 | 稳定性 | 活跃度 |
|------|------|--------|--------|
| `src/` | 源代码核心实现 | Stable (接口) / Experimental (内部) | 高 |
| `src/kernel/` | 世界模型内核 (T1/T2/T3) | Stable 接口 | 高 |
| `src/domain/` | 领域特定实现 | Experimental | 中 |
| `src/runtime/` | 运行时 (AgentExecutor, MCP) | Experimental | 中 |

### 2.2 AI 协作层

| 目录 | 职责 | 稳定性 | 活跃度 |
|------|------|--------|--------|
| `Agents/` | Agent 定义 (core, geo) | Experimental | 中 |
| `Crews/` | CrewAI 多智能体协作配置 | Experimental | 低 |
| `Skills/` | 技能库 (14 个领域分类) | Stable 结构 | 中 |

### 2.3 治理与元数据层

| 目录 | 职责 | 稳定性 | 活跃度 |
|------|------|--------|--------|
| `_meta/` | 元数据、文档、治理 | 部分 Frozen | 高 |
| `_meta/contracts/` | 机器可执行约束 | Frozen | 高 |
| `_meta/governance/` | 治理规则 | Frozen | 中 |
| `_meta/schemas/` | JSON 验证 schema | Stable | 低 |

### 2.4 执行与追踪层

| 目录 | 职责 | 稳定性 | 活跃度 |
|------|------|--------|--------|
| `tracks/` | 执行容器 (领域作用域工作单元) | Experimental | 高 |
| `verdicts/` | 决策语义 (人类可读解释) | Experimental | 中 |
| `replays/` | 回放记录 | Experimental | 中 |

### 2.5 工具与系统层

| 目录 | 职责 | 稳定性 | 活跃度 |
|------|------|--------|--------|
| `tools/` | 工具脚本 | Experimental | 高 |
| `tools/notion-sync/` | Notion 同步工具 | Experimental | 高 |
| `tools/web-publisher/` | 网页发布工具 | Experimental | 中 |
| `tools/geo-pipeline/` | **Geo Pipeline 知识引擎** (详见 2.5.1) | Experimental | 高 |
| `systems/` | 可执行系统 | Experimental | 高 |
| `systems/information-radar/` | 信息雷达 | Experimental | 高 |
| `systems/site-deployer/` | 站点部署 | Experimental | 中 |

#### 2.5.1 Geo Pipeline 详解 (知识引擎)

**Geo = Generative Engine Optimization (生成式引擎优化)**，不是地理数据管道。

**定位**: LiYe OS 的核心基础设施层 (Core Infrastructure)

**职责**:
- 将原始文档 (PDF, DOCX 等) 转换为结构化、可被系统消费的知识单元 (`geo_units.json`)
- 作为上游知识提供者，被下游应用系统消费

**架构位置**:
```
Application Systems (Amazon OS, Research OS, etc.)
           ↓ (consumes geo_units.json)
       Geo Pipeline ← Core Infrastructure
           ↓ (processes)
      Truth Sources (~/data/archives/)
        ├── geo_seo      [Priority 1] GEO-SEO 知识库 (Local SEO)
        ├── shengcai     [Priority 2] 生财有术知识库
        └── ...          [扩展中]
```

**处理流水线 (v0.1 确定性处理，无 AI 依赖)**:
1. **Normalize**: 各类文档 → Markdown
2. **Chunk**: 长文档 → 固定大小 chunks
3. **Extract**: 提取结构 (标题、列表)
4. **Export**: 输出 `geo_units.json`

**Truth Source 分层治理**:

| 层级 | 权限 | 说明 |
|------|------|------|
| T0 | 完全可用 | 允许默认运行、RAG、导出 |
| T1 | 需提升标记 | 需要 promotion_flag |
| T2 | 需精炼流水线 | 禁止直接导出，必须经过 refinement pipeline |

**相关目录**:
- `Agents/geo/` - Geo 领域 Agent 管道 (signal → rule → verdict)
- `verdicts/geo/` - Geo 决策契约 (人类可读解释)
- `replays/geo/` - Geo 回放测试用例 (确定性验证)
- `knowledge/glossary/geo-seo.yaml` - GEO-SEO 术语表 (35KB+)
- `knowledge/glossary/geo.yaml` - Geo 通用术语表

**GEO-SEO (Local SEO) 子领域**:
- 针对 Google Maps / Local Pack 的本地搜索优化
- 核心概念: GBP (Google Business Profile), NAP, SoLV, Proximity/Relevance/Prominence
- 详见 `docs/architecture/DOMAIN_GEO_SEO.md`

### 2.6 文档层

| 目录 | 职责 | 稳定性 | 活跃度 |
|------|------|--------|--------|
| `docs/` | 文档中心 | Stable | 高 |
| `docs/architecture/` | 架构文档 (60+ 文件) | Stable | 高 |
| `docs/governance/` | 治理规范 | Stable | 中 |
| `docs/adr/` | 架构决策记录 | Stable | 高 |

### 2.7 Claude 配置层

| 目录 | 职责 | 稳定性 | 活跃度 |
|------|------|--------|--------|
| `.claude/` | Claude Code 配置与脚本 | Stable | 高 |
| `.claude/packs/` | 领域知识包 (按需加载) | Stable | 高 |
| `.claude/scripts/` | 工具脚本 (assembler, guardrail) | Stable | 高 |

### 2.8 CI/CD 层

| 目录 | 职责 | 稳定性 | 活跃度 |
|------|------|--------|--------|
| `.github/workflows/` | GitHub Actions (25 个工作流) | Frozen (`*gate*`, `*guard*`) / Stable (其他) | 高 |

### 2.9 其他目录

| 目录 | 职责 | 稳定性 | 活跃度 |
|------|------|--------|--------|
| `knowledge/` | 知识资产 | Experimental | 中 |
| `Glossaries/` | 术语表 | Stable | 低 |
| `memory/` | 记忆系统 | Experimental | 低 |
| `data/` | 数据存储 | Experimental | 中 |
| `websites/` | 网站项目 (kuachu) | Experimental | 低 |
| `builders/` | 构建器 | Experimental | 高 |
| `i18n/` | 国际化 | Stable | 低 |
| `config/` | 配置文件 | Stable | 低 |
| `examples/` | 示例 | Experimental | 低 |
| `tests/` | 测试 | Experimental | 低 |

---

## 3. 关键入口与执行路径

### 3.1 主入口点

#### Claude Code 入口
```
CLAUDE.md (Kernel)
    ├── 启动路由
    ├── 常用命令索引
    └── Pack 按需加载索引
```

**核心流程**:
1. Claude Code 读取 `CLAUDE.md`
2. 根据任务关键词加载对应 `.claude/packs/` 中的详细规则
3. 或使用 Assembler 自动编译上下文

#### 上下文编译入口
```bash
node .claude/scripts/assembler.mjs --task "任务描述"
# 输出: .claude/.compiled/context.md
```

### 3.2 本地开发流程

```bash
# 1. 安装依赖
cd tools/notion-sync && npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 NOTION_API_KEY 和 NOTION_DATABASE_ID

# 3. 检查架构合规性
node .claude/scripts/guardrail.mjs

# 4. 生成任务上下文
node .claude/scripts/assembler.mjs --task "任务描述"

# 5. 执行任务...

# 6. 提交前检查
node .claude/scripts/guardrail.mjs
```

### 3.3 CI/CD 工作流

#### Gate 类工作流 (Frozen - 强制执行)

| 工作流 | 用途 |
|--------|------|
| `architecture-gate.yml` | 架构合规检查 |
| `constitution-*-gate.yml` | 宪法检查 |
| `lift-regression-gate.yml` | Lift 回归保护 |
| `memory-governance-gate.yml` | 记忆治理 |
| `security-gate.yml` | 安全检查 |
| `trace-governance-gate.yml` | Trace 治理 |
| `domain-replay-gate.yml` | 领域回放门禁 |

#### Guard 类工作流 (Frozen - 防护)

| 工作流 | 用途 |
|--------|------|
| `amazon-leak-guard.yml` | Amazon 数据泄露防护 |
| `kernel-guard.yml` | 内核保护 |
| `bmad-dehydration-guard.yml` | BMAD 边界防护 |

#### 其他工作流 (Stable)

| 工作流 | 用途 |
|--------|------|
| `ci.yml` | 基础 CI |
| `release.yml` | 发布流程 |
| `governance-audit.yml` | 治理审计 |

### 3.4 Agent/Tool 工作流

#### 执行策略: Two-Speed (D) + Traces-First (F1)

**两种模式**:

1. **Fast Path (默认)**:
   - 无阻塞执行
   - 只写 traces

2. **Governed Path**:
   - 升级触发条件:
     - 存在 active track
     - 3-strike 连续失败
     - PR/发布/交接信号
   - 需要 Stop Gate 检查

**Hooks 设置**:
```bash
# PreToolUse
node "$CLAUDE_PROJECT_DIR/.claude/scripts/pre_tool_check.mjs"

# PostToolUse
node "$CLAUDE_PROJECT_DIR/.claude/scripts/pre_tool_check.mjs" --post

# Stop Gate
node "$CLAUDE_PROJECT_DIR/.claude/scripts/stop_gate.mjs"
```

### 3.5 Notion 同步入口

```bash
cd tools/notion-sync

# 测试连接
node notion-test.js

# 拉取/推送/比较
npm run pull    # 从 Notion 拉取
npm run push    # 推送到 Notion
npm run diff    # 查看差异
```

### 3.6 Recall 工具入口

```bash
# 统一知识查询
node tools/recall/recall.js <query>
# 或
npm run recall <query>
```

---

## 4. 治理机制角色与边界

### 4.1 治理体系概览

```
┌─────────────────────────────────────────────────────────────┐
│  CONSTITUTION (宪法层)                                       │
│  docs/CONSTITUTION.md, _meta/docs/ARCHITECTURE_CONSTITUTION.md │
│  - 最高权威，定义项目身份与边界                              │
└─────────────────────┬───────────────────────────────────────┘
                      │ derives
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  CONTRACTS (契约层)                                          │
│  _meta/contracts/                                            │
│  - 机器可执行约束                                            │
│  - 必须引用 Constitution 条款                                │
│  - 不可自行引入新规则                                        │
└─────────────────────┬───────────────────────────────────────┘
                      │ enforces
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  GATES (门禁层)                                              │
│  .github/workflows/*gate*, *guard*                           │
│  - CI 自动强制执行                                           │
│  - Frozen 级别                                               │
└─────────────────────┬───────────────────────────────────────┘
                      │ produces
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  VERDICTS (判定层)                                           │
│  verdicts/                                                   │
│  - 决策语义解释 (人类可读)                                   │
│  - 用于审计和回放解释                                        │
│  - 不被 CI 或验证器消费                                      │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Contracts (契约)

**位置**: `_meta/contracts/`

**角色**:
- 将 Constitution 硬约束转化为机器可读格式
- 供 CI 门禁自动验证
- 定义 Skills 和 Builders 之间的边界

**流转**:
```
SKILL (UI/UX, Content, etc.)
    │ writes
    ▼
tracks/<track_id>/site-design.contract.yaml (项目实例)
    │ reads
    ▼
BUILDER (Site generator, Component builder)
    │ generates
    ▼
Code / Components
```

**执行级别**:

| 级别 | 行为 | 用例 |
|------|------|------|
| `advisory` | 仅记录 | 实验性规则 |
| `warning` | 发出注释，继续 | 软约束 |
| `blocking` | 非零退出，CI 失败 | 硬约束 |

### 4.3 Verdicts (判定)

**位置**: `verdicts/`

**角色**:
- 解释机器决策的业务含义
- 支持审计、回放和用户解释
- 提供一致的决策解释语言

**非目标**:
- 不定义规则或约束
- 不被 CI、验证器或构建器消费
- 不生成决策

**心智模型**:
```
_meta/contracts/  → "系统能否执行此操作?" (治理)
verdicts/         → "系统决策的含义是什么?" (语义)
```

### 4.4 Tracks (执行轨道)

**位置**: `tracks/`

**角色**:
- 领域作用域的执行容器
- 绑定到特定领域及其术语表
- 阶段冻结以锁定规范和术语版本

**生命周期**:
```
draft → active → done → frozen
  │        │        │        │
  └ spec.md   └ plan.md  └ checkpoint  └ archived
    created     executing    created       (optional)
```

**关键不变量**:

| 规则 | 强制方式 |
|------|----------|
| 一个 Track = 一个领域 | state.yaml schema |
| 术语仅来自术语表 | verify_glossary_usage.sh |
| plan.md 不允许新术语 | verify_glossary_usage.sh |
| 冻结阶段不可变 | checkpoint.yaml + CI |

**Track 不是**:
- 知识存储 (那是 glossary 的工作)
- 工作流引擎 (那是人类的工作)
- Memory 的替代品 (Memory 是语义真相)

**Track 是**:
- 执行容器
- 领域作用域的工作边界
- 验证检查点

### 4.5 .claude (Claude 配置)

**位置**: `.claude/`

**子目录**:

| 路径 | 用途 |
|------|------|
| `.claude/packs/` | 领域知识包 (operations, research, infrastructure, protocols) |
| `.claude/scripts/` | 工具脚本 (assembler, guardrail, pre_tool_check, stop_gate) |
| `.claude/config/` | 配置文件 |
| `.claude/.compiled/` | 编译输出 (不版本化) |
| `.claude/.githooks/` | Git 钩子 |

**Pack 加载规则**:

| 任务类型 | 加载 Pack | 触发关键词 |
|----------|-----------|------------|
| Amazon/跨境/运营/关键词/PPC | operations.md | amazon, asin, ppc, listing |
| 医学研究/循证/临床/文献/CrewAI | research.md | medical, treatment, drug, clinical, crew |
| 架构/Notion/PARA/配置/命名 | infrastructure.md | notion, para, architecture, config, sync |
| 多智能体协作/职责/协议 | protocols.md | multi-agent, collaboration, protocol |

**性能边界**:
- `CLAUDE.md` <= 10,000 字符
- 每个 Pack <= 15,000 字符
- 超限将被 pre-commit hook 阻止

### 4.6 稳定性契约

**定义** (来自 `docs/architecture/ARCHITECTURE_CONTRACT.md`):

| 级别 | 含义 | 变更策略 |
|------|------|----------|
| **Frozen** | 不可变，宪法级 | 需要 RFC + 30 天通知 + 迁移指南 |
| **Stable** | 向后兼容 | 需要 14 天 CHANGELOG 通知 |
| **Experimental** | 可能随时变更 | 无需通知 |

**稳定性地图**:

| 级别 | 路径 |
|------|------|
| Frozen | `_meta/governance/`, `.github/workflows/*gate*`, `.github/workflows/*guard*` |
| Stable | `docs/architecture/`, `src/kernel/` 接口, `CLAUDE.md`, `.claude/packs/`, `Skills/` |
| Experimental | `Agents/`, `Crews/`, `src/domain/`, `src/kernel/` 内部实现 |

---

## 5. 关键文件索引

| 文件 | 用途 |
|------|------|
| `CLAUDE.md` | Claude Code 入口点 (Kernel) |
| `README.md` | 项目说明 (英文) |
| `README.zh-CN.md` | 项目说明 (中文) |
| `docs/CONSTITUTION.md` | 项目宪法 |
| `docs/architecture/ARCHITECTURE_CONTRACT.md` | 稳定性契约 |
| `_meta/docs/ARCHITECTURE_CONSTITUTION.md` | 架构宪法 |
| `_meta/EVOLUTION_ROADMAP_2025.md` | 演进路线图 |
| `package.json` | Node.js 包配置 |
| `.pre-commit-config.yaml` | Pre-commit 钩子配置 |

---

## 6. 风险标注 (仅标记，不做评估)

### 6.1 敏感文件区域 (可能包含密钥/凭证)

- `tools/notion-sync/.env` - Notion API 配置
- `.claude/settings.local.json` - 本地设置 (已在 .gitignore)
- 任何 `.env` 文件

### 6.2 外部依赖

- Notion API
- GitHub Actions
- npm 包依赖 (ajv, yaml, fast-glob 等)

---

## 7. 观察与发现

### 7.1 架构特点

1. **层次分明**: Constitution → Contracts → Gates → Verdicts 形成清晰的治理层级
2. **双速执行**: Fast Path / Governed Path 灵活应对不同场景
3. **领域隔离**: Track 机制强制领域边界和术语一致性
4. **可审计性**: Traces、Replays、Verdicts 支持完整的决策追溯

### 7.2 活跃开发区域

基于 Git 提交历史和文件修改时间：
- `.github/workflows/` - CI/CD 门禁持续完善
- `_meta/contracts/` - 契约系统刚建立
- `builders/` - 构建器系统活跃开发中
- `systems/information-radar/` - 信息雷达系统活跃

### 7.3 待观察区域

- `Crews/` - CrewAI 集成，活跃度较低
- `websites/` - 网站项目，可能为 Constitution 明确排除的范围
- `memory/` - 记忆系统，结构简单

---

*Phase 1-A 完成 - 只读理解阶段*
