# LiYe OS & Amazon Growth Engine 系统交接文档

**文档版本**: 1.0
**生成日期**: 2026-02-02
**作者**: Claude Code
**目的**: 系统架构交接与开发者入职指南

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [LiYe OS 架构详解](#2-liye-os-架构详解)
3. [Amazon Growth Engine 架构详解](#3-amazon-growth-engine-架构详解)
4. [两个系统的关系](#4-两个系统的关系)
5. [开发环境搭建](#5-开发环境搭建)
6. [常用操作指南](#6-常用操作指南)
7. [治理与安全机制](#7-治理与安全机制)
8. [当前项目状态](#8-当前项目状态)
9. [交接清单](#9-交接清单)

---

## 1. 执行摘要

### 1.1 系统定位

| 系统 | 类型 | 定位 | 仓库 |
|------|------|------|------|
| **LiYe OS** | 公开框架 | AI 原生基础设施参考实现 (v6.3.0) | `~/github/liye_os` |
| **Amazon Growth Engine** | 私有领域实现 | 基于 LiYe OS 的 Amazon 电商优化引擎 | `~/github/amazon-growth-engine` |

### 1.2 核心设计哲学

> "Not letting blind confidence happen structurally."
> (从结构上杜绝盲目自信)

两个系统共同遵循:
- **执行前风险分析**: 通过 World Model Gate (T1/T2/T3) 强制评估风险
- **可追溯审计**: 每个决策都有完整的证据链和回放能力
- **治理优先**: 机器可执行的约束 (Contracts) 优先于人工判断

### 1.3 技术栈概览

```
┌─────────────────────────────────────────────────────────────┐
│                    Amazon Growth Engine                      │
│    (私有领域: Amazon Ads API, TES方法论, 业务规则)           │
├─────────────────────────────────────────────────────────────┤
│                         LiYe OS                              │
│    (公开框架: Kernel, Runtime, Audit, Skills, Agents)       │
├─────────────────────────────────────────────────────────────┤
│  Node.js (≥18) │ Python (≥3.8) │ TypeScript │ SQLite/DuckDB │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. LiYe OS 架构详解

### 2.1 目录结构总览

```
~/github/liye_os/
├── CLAUDE.md                    # 内核入口 (6.5K字符, <10K限制)
├── package.json                 # v6.3.0, Node/npm 工作区根
│
├── .claude/                     # Claude Code 集成层
│   ├── packs/                   # 领域知识包 (按需加载)
│   │   ├── operations.md        # Amazon/PPC/运营规则
│   │   ├── research.md          # 医学/临床/研究规则
│   │   ├── infrastructure.md    # Notion/PARA/架构规则
│   │   └── protocols.md         # 多代理协作协议
│   ├── scripts/                 # 工具脚本
│   │   ├── assembler.mjs        # 上下文编译器
│   │   ├── guardrail.mjs        # 文件大小守卫
│   │   ├── pre_tool_check.mjs   # 工具预检
│   │   └── stop_gate.mjs        # 停止门控
│   └── .githooks/               # Git 钩子
│
├── src/                         # 核心实现
│   ├── kernel/                  # World Model (T1/T2/T3)
│   │   ├── t1/                  # 因果推理层
│   │   ├── t2/                  # 状态评估层 (5D坐标)
│   │   ├── t3/                  # 动态预测层
│   │   └── world_model/         # 运行器
│   ├── runtime/                 # 执行引擎
│   │   ├── execution/           # P6C 监督写入实验
│   │   ├── dispatcher/          # 策略调度
│   │   ├── policy/              # 6个核心策略 (POL_001-006)
│   │   ├── evidence/            # 证据生成
│   │   └── mcp/                 # MCP 服务器
│   ├── audit/                   # 确定性回放 (P3-A 新增)
│   │   ├── evidence/            # 证据包生成
│   │   ├── replay/              # 回放验证器
│   │   └── index/               # 追加索引
│   ├── domain/                  # 领域实现
│   │   ├── skeleton/            # 参考实现模板
│   │   ├── medical-research/    # 医学研究
│   │   └── investment-os/       # 投资分析
│   ├── brokers/                 # LLM 代理抽象
│   ├── memory/                  # 记忆模式
│   └── skill/                   # 技能系统
│
├── _meta/                       # 系统元数据 (治理权威)
│   ├── docs/                    # 架构文档 (FROZEN)
│   │   └── ARCHITECTURE_CONSTITUTION.md  # 架构宪法 v1.8
│   ├── governance/              # 治理规则 (FROZEN)
│   ├── contracts/               # 合约模板
│   └── schemas/                 # JSON Schema
│
├── docs/                        # 文档 (STABLE)
│   ├── start-here/              # 入口文档
│   ├── architecture/            # 架构决策
│   ├── contracts/               # 冻结合约
│   └── adr/                     # 架构决策记录
│
├── Skills/                      # 技能库 (12个领域 + 孵化器)
│   ├── 00_Core_Utilities/       # 核心工具
│   ├── 01_Research_Intelligence/
│   ├── 02_Operation_Intelligence/
│   └── 99_Incubator/            # 实验性技能
│
├── Agents/                      # 代理定义
│   ├── core/                    # 核心代理
│   └── _template.yaml           # 代理规范模板
│
├── Crews/                       # 多代理协作编排
│
├── tools/                       # 运维工具
│   ├── notion-sync/             # Notion 双向同步
│   ├── audit/                   # 审计工具
│   └── track/                   # Track 管理
│
├── examples/                    # 集成示例
│   ├── feishu/                  # 飞书适配器
│   └── dify/                    # Dify 集成
│
├── .github/workflows/           # CI/CD (31个工作流)
│
├── websites/                    # 已构建网站 (8+)
├── Projects_Engine/             # 项目管理
├── Artifacts_Vault/             # 交付物归档
├── verdicts/                    # 决策文档
└── replays/                     # 回放fixture
```

### 2.2 核心系统详解

#### 2.2.1 World Model Gate (T1/T2/T3)

**目的**: 强制执行前的风险分析，三层推理管道:

| 层级 | 问题 | 输出 | 实现位置 |
|------|------|------|----------|
| **T1** | 在压力下哪里会失败？ | 因果链、假设暴露 | `src/kernel/t1/` |
| **T2** | 当前危险状态？ | 5D风险坐标 | `src/kernel/t2/` |
| **T3** | 状态将如何演变？ | 形态描述 | `src/kernel/t3/` |

**关键规则**: 每个输出必须包含 "这个没告诉你的是..."

**5D 坐标系统** (T2):
- **Liquidity** (流动性): 资源可用性
- **Relevance** (相关性): 与目标的关联度
- **Expectation** (预期): 结果预测
- **Leverage** (杠杆): 影响放大器
- **Uncertainty** (不确定性): 风险水平

#### 2.2.2 治理与策略引擎

**6个核心策略** (`src/runtime/policy/policies/`):

| 策略ID | 名称 | 作用 |
|--------|------|------|
| POL_001 | branch_scope | 分支作用域执行 |
| POL_002 | file_class | 文件类别限制 |
| POL_003 | policy_immutability | 策略强制执行 |
| POL_004 | tool_allowlist | 工具白名单 |
| POL_005 | rate_guard | 速率限制 |
| POL_006 | fail_close | 失败安全默认 |

**执行模式**:
- **Fast Path**: 仅写入 traces，无阻塞 (单会话默认)
- **Governed Path**: 完整策略执行 (多会话/PR/交接)

#### 2.2.3 确定性回放 & 审计 (P3-A)

**目的**: 每个决策可追溯、可重现

**组件**:
- **证据生成**: `src/audit/evidence/generate.ts` - 一次写入
- **确定性回放**: `src/audit/replay/replay.ts` - 验证器
- **CI Gate**: `.github/workflows/replay-ci-gate.yml` - 强制可验证性

**合约**: `docs/contracts/EVIDENCE_PACKAGE_V1.md` (FROZEN: 2026-02-01)

#### 2.2.4 MCP 服务器联邦

| 服务器 | 语言 | 功能 | 启动命令 |
|--------|------|------|----------|
| Governance MCP | Node.js | 核心治理工具 | `npm run mcp:governance` |
| Knowledge MCP | Python | Qdrant 语义搜索 | `npm run mcp:knowledge` |
| Data MCP | Python | DuckDB 数据查询 | (包含在 Knowledge) |

### 2.3 配置与上下文系统

#### CLAUDE.md (内核入口)

**位置**: `/Users/liye/github/liye_os/CLAUDE.md`
**限制**: 6.5K / 10K 字符

**职责**:
- Claude Code 最小常驻上下文
- Pack 索引表 (自动加载触发器)
- 常用命令参考
- 执行策略默认值

**Pack 加载触发器**:

| Pack | 触发条件 |
|------|----------|
| `operations.md` | amazon, asin, ppc, listing |
| `research.md` | medical, clinical, drug, crew |
| `infrastructure.md` | notion, para, architecture, mcp |
| `protocols.md` | multi-agent, collaboration |

#### 上下文编译器 (assembler.mjs)

```bash
# 根据任务关键词自动加载相关 Pack
node .claude/scripts/assembler.mjs --task "Optimize Amazon Listing"

# 指定中文输出
node .claude/scripts/assembler.mjs --locale "zh-CN"
```

**输出**: `.claude/.compiled/context.md` (不版本化)

### 2.4 技能系统 (Skills)

**10模块标准结构**:
```
Skills/{domain}/{skill_name}/
├── skill_definition.md          # 核心定义
├── README.md                    # 快速开始
├── methods.md                   # 方法论详情
├── templates/                   # 模板库
├── knowledge_base/              # 知识库
├── evolution_log.md             # 演进日志
├── collaboration_protocols.md   # 协作协议
├── quality_standards.md         # 质量标准
├── automation_scripts/          # 自动化脚本
└── case_studies/                # 案例研究
```

**12个领域分类**:
- 00: 核心工具
- 01-04: 研究/运营/创意/商业智能
- 05-08: 医学/技术/数据/通信
- 09-12: 学习/健康/生活设计/元认知
- 99: 孵化器 (实验性)

### 2.5 代理系统 (Agents)

**代理公式**: `Agent = Persona + Skills + Runtime`

**核心代理** (`Agents/core/`):

| 代理 | 角色 | 技能 |
|------|------|------|
| Orchestrator | 任务协调 | decomposition, selection |
| Researcher | 信息收集 | web_search, analysis |
| Analyst | 数据分析 | pattern_recognition, insights |

**代理规范** (v3.1 YAML 模板):
```yaml
agent:
  id: unique-id
  name: Human Name
  version: 1.0.0
  domain: core | skeleton | medical-research

persona:
  role: 角色描述
  goal: 目标描述
  backstory: 背景故事

skills:
  atomic: [原子技能列表]
  composite: [组合技能列表]

runtime:
  process: sequential | hierarchical | parallel
  memory: true | false
  delegation: true | false
```

### 2.6 CI/CD 系统

**GitHub Workflows (31个)**:

| 层级 | 修改要求 | 示例工作流 |
|------|----------|-----------|
| **Frozen** | 30天通知 | `architecture-gate.yml`, `constitution-*.yml`, `replay-ci-gate.yml` |
| **Stable** | 14天通知 | `ci.yml`, `audit-regression-gate.yml` |
| **Experimental** | 随时 | `reasoning-demo.yml`, `mcp-federation-ci.yml` |

**关键 npm 脚本**:
```bash
npm run recall                  # Recall 系统入口
npm run mcp:up                 # 启动 MCP 服务器
npm run demo:reasoning         # 运行推理演示
npm audit:replay               # 运行确定性回放审计
```

---

## 3. Amazon Growth Engine 架构详解

### 3.1 系统定位

Amazon Growth Engine 是 LiYe OS 框架的**私有领域实现**，专注于:
- Amazon 电商运营优化
- PPC 广告策略自动化
- 数据驱动的决策建议
- 受控执行 (目前仅 dry-run)

**当前状态**: POST P2-PREP (等待 Amazon Ads API 写入权限审批)

### 3.2 目录结构总览

```
~/github/amazon-growth-engine/
├── vendor/liye-ai/              # Git 子模块 - LiYe OS 框架 (公开)
│
├── src/                         # 核心应用代码
│   ├── ads/                     # Amazon Ads API 集成层
│   │   ├── auth.py              # OAuth 2.0 token 生命周期
│   │   ├── profiles.py          # Ads API profile 发现
│   │   ├── reports.py           # 报告生成与轮询
│   │   ├── etl.py               # 解析和规范化报告数据
│   │   └── schemas.py           # 数据结构定义
│   │
│   ├── strategy/                # 策略生成引擎
│   │   ├── action_builder.py    # 从决策构建 Action Spec
│   │   ├── wasted_spend.py      # MVP 策略规则 (仅 P1)
│   │   ├── rules.py             # 规则定义
│   │   └── audit.py             # Action 审计存储 & 护栏
│   │
│   ├── execution/               # 执行规划 & 验证 (P2.0)
│   │   ├── planner.py           # ActionSpec → ExecutionPlan 转换
│   │   ├── validators.py        # 验证框架 (P2.1-A gate)
│   │   ├── payloads.py          # Ads API payload 构建器
│   │   ├── dry_run.py           # 影子执行模拟器
│   │   └── types.py             # ExecutionPlan, RollbackPlan 数据结构
│   │
│   ├── jobs/                    # 调度作业编排
│   │   ├── daily_ads_etl.py     # 每日报告摄入
│   │   ├── p6a_readonly_pilot.py # 只读试点模式
│   │   ├── job_context.py       # 作业执行上下文
│   │   └── storage.py           # T1 Truth 表存储
│   │
│   ├── runtime/mcp/             # MCP 中间件 & 服务器
│   │   ├── middleware/
│   │   │   └── age_write_gate.py # 写入安全的最后物理保险丝
│   │   └── servers/amazon/      # Amazon 特定 MCP 服务器
│   │
│   └── kernel/                  # World model 单元
│
├── Agents/amazon-growth/        # 10+ 专业代理 YAML 定义
│   ├── ppc-strategist.yaml
│   ├── keyword-architect.yaml
│   ├── listing-optimizer.yaml
│   └── ...
│
├── config/amazon-growth/        # 护栏、规则、事件配置
│   ├── guardrails.yaml          # 护栏策略 v4.2
│   ├── event_clock_rules.yaml
│   └── trace_type_profiles.yaml
│
├── contracts/                   # 合约定义 (Action Spec)
├── .claude/skills/              # Claude AI 技能 (TES 方法论)
├── knowledge/                   # 领域知识库
├── tracks/                      # 业务追踪/审计轨迹
├── tests/                       # 综合测试套件
├── fixtures/                    # PPC 测试样本数据
├── sql/                         # 数据库 schema 定义
├── docs/                        # 综合文档
│
└── main.py                      # CLI 入口点
```

### 3.3 CLI 入口与模式

**主入口**: `main.py`

```bash
# PPC 优化
python3 main.py --mode ppc-optimize \
  --asin B0XXXXXXX --target_acos 0.25 --market US --dry_run true

# PPC 审批策略
python3 main.py --mode ppc-approve \
  --input out/apply_pack/actions.json \
  --approve-priority P0 --max-risk MED

# PPC 导出 (执行文件)
python3 main.py --mode ppc-export --input out/approved_actions.json
```

### 3.4 Amazon Ads API 集成

**模块**: `src/ads/` - 严格的职责边界

| 组件 | 文件 | 职责 |
|------|------|------|
| **Auth** | `auth.py` | OAuth 2.0 生命周期, token 刷新, P6-A readonly 模式 |
| **Profiles** | `profiles.py` | 通过 GET /v2/profiles 发现 Ads API profiles |
| **Reports** | `reports.py` | 创建报告请求, 轮询状态, 下载原始数据 |
| **ETL** | `etl.py` | 解析报告数据 → 规范化 schema |
| **Schemas** | `schemas.py` | T1 Truth 表 schema 定义 |

**P6-A 只读模式** (层级1 OAuth 强制):
```bash
ADS_OAUTH_MODE=readonly  # 在 token 级别限制 scope
```

**T1 Truth 表** (核心事实):
- `ad_campaign_daily`: 广告系列级别指标
- `ad_search_term_daily`: 搜索词级别指标

### 3.5 策略引擎 & Action 生成

**核心管道**: Facts → Rules → Action Specs → Execution Plans

**Phase 1 MVP**: 仅 Wasted Spend 规则
```
Search Term Fact (来自 T1 Truth) →
  规则: clicks ≥ 20 AND sales = 0 AND cost ≥ $5 →
    Action Spec: NEGATIVE_KEYWORD_ADD (phrase match) →
      Execution Plan: POST /sp/negativeKeywords (仅 dry-run)
```

**Action Spec Schema** (v1 FROZEN):
```python
ActionSpec:
  - action_id: 确定性哈希 (act_{hash16})
  - trace_id: 链接到触发作业
  - client_id, marketplace_id, profile_id
  - action_type: ENUM (6 种类型, P2.1-A 仅允许 2 种)
  - scope: ENUM (CAMPAIGN/AD_GROUP/KEYWORD/TARGET)
  - payload: Action 特定数据字典
  - evidence: 触发此 action 的 Facts + 规则命中
  - expected_lift: 预测指标收益
  - risk_level: LOW/MEDIUM/HIGH
  - rollback: 如何撤销此 action
  - status: RECOMMENDED → APPROVED → EXECUTED → ...
```

**Frozen Enums** (P2-PREP):
- **ActionType**: NEGATIVE_KEYWORD_ADD, REMOVE, BID_UP, DOWN, PAUSE_TARGET, ENABLE_TARGET
- **P2.1-A 仅允许**: ADD + REMOVE (用于回滚)
- 在 v2 讨论前不能添加新类型

### 3.6 执行系统 (P2.0) - Shadow Execute

**管道**: ActionSpec → ExecutionPlan → Validation → Dry-Run (无真实执行)

**ExecutionPlan 结构** (frozen):
```python
ExecutionPlan:
  - action_id, trace_id, action_type
  - http_method, endpoint, headers, payload
  - idempotency_key (防止重复执行)
  - rollback_plan (如何撤销)
  - blast_radius (影响描述)
  - profile_id, marketplace_id, client_id
```

**P2.1-A 能力矩阵** (LOCKED):
- ✅ `NEGATIVE_KEYWORD_ADD` 在 AD_GROUP 级别 → /sp/negativeKeywords
- ✅ `NEGATIVE_KEYWORD_REMOVE` (仅回滚) → /sp/negativeKeywords/delete
- ❌ Campaign 级别否定词: 延迟到 P2.1-B
- ❌ 出价操作、暂停、启用: 延迟到 P3

### 3.7 审计 & 治理系统

**写入护栏** (所有写入必须有 Trace):
```yaml
write_guardrail:
  enabled: true
  enforcement: "Any impact requires TRACE"
  on_missing_trace: BLOCK
```

**振幅护栏** (单次变更限制):
- 出价变更: 每次 ±30% 最大, 每日 ±50%
- 预算变更: 每次 ±50%, 每日 ±100%
- 内容变更: 标题/A+/要点需要 ESCALATE

**批量护栏** (影响限制):
- 每决策关键词: 最多 20 个
- 每决策广告系列: 最多 3 个
- 每决策 ASIN: 最多 5 个
- 超出 → SPLIT_AND_QUEUE 策略

**AGE Write Gate 中间件** (`src/runtime/mcp/middleware/age_write_gate.py`):
- 写入安全的最后物理保险丝
- 阻止条件:
  1. trace_id 缺失 (MANDATORY)
  2. AGE_WRITE_ENABLED ≠ "1"
- 默认: DISABLED (0)

### 3.8 代理系统

**10+ 专业代理** (`Agents/amazon-growth/`):

| 代理 | 用途 |
|------|------|
| ppc-strategist | PPC 优化 & 出价策略 |
| keyword-architect | 关键词研究 & 策略 |
| listing-optimizer | Listing 内容优化 |
| market-analyst | 市场情报 |
| diagnostic-architect | 性能诊断 |
| intent-analyst | 意图分类 |
| guardrail-governor | 护栏执行 |
| trace-scribe | Trace 记录 |
| review-sentinel | 评论监控 |
| sprint-orchestrator | 工作流协调 |

**职责分离模式** (Signal/Rule/Verdict):
- **Signal Agent**: 仅计算指标 (无逻辑)
- **Rule Agent**: 仅评估布尔触发器
- **Verdict Agent**: 仅输出 schema 绑定的决策

**无自然语言输出** - 全部 schema 验证

### 3.9 TES 方法论 (私有)

**TES** = Traffic Efficiency Score (流量效率分数)

**关键词分类**:
- **WINNER**: TES > 100
- **POTENTIAL**: TES 10-100
- **BROAD**: TES < 10

**Listing 优化策略**:
- 固定骨架 + one-child-one-keyword 策略
- Parent-Child ASIN 关键词分布矩阵

---

## 4. 两个系统的关系

### 4.1 依赖关系

```
┌─────────────────────────────────────────────────────┐
│           Amazon Growth Engine (私有)               │
│   - Amazon 特定业务逻辑                             │
│   - 10+ 专业代理                                    │
│   - TES 方法论 (专有)                               │
│   - 客户数据 & 商业机密                             │
├─────────────────────────────────────────────────────┤
│                     ↓ 依赖                          │
├─────────────────────────────────────────────────────┤
│              vendor/liye-ai/ (Git 子模块)           │
│                   ↓                                 │
├─────────────────────────────────────────────────────┤
│               LiYe OS (公开)                        │
│   - Kernel: T1/T2/T3 治理框架                       │
│   - Runtime: MCP 协议, 策略引擎, 代理执行器         │
│   - GEO OS: 文档处理知识引擎                        │
│   - Skills/Agents/Crews 模板                        │
│   - 审计/回放基础设施                               │
└─────────────────────────────────────────────────────┘
```

### 4.2 职责分离

| 层级 | LiYe OS 提供 | Amazon Growth Engine 添加 |
|------|--------------|--------------------------|
| **治理** | World Model Gate, 策略引擎 | 业务特定护栏配置 |
| **执行** | MCP 协议, 代理执行器 | Amazon Ads API 集成 |
| **审计** | 证据包, 回放验证器 | 业务决策追踪 |
| **知识** | 技能模板, 知识引擎 | TES 方法论, 领域知识 |
| **代理** | 代理规范, 核心代理 | 10+ Amazon 专业代理 |

### 4.3 数据流

```
Truth Sources (外部数据: Amazon Ads API)
  ↓
GEO OS (知识引擎)
  ↓
Amazon Growth Engine (领域逻辑)
  ↓
Agents (决策制定)
  ↓
Actions (执行计划)
  ↓
T1 Truth (审计轨迹)
```

---

## 5. 开发环境搭建

### 5.1 LiYe OS 环境

**前置要求**:
- Node.js ≥ 18.0.0
- Python ≥ 3.8 (MCP 服务器)
- Git

**步骤**:
```bash
# 1. 克隆仓库
git clone git@github.com:liyecom/liye_os.git ~/github/liye_os
cd ~/github/liye_os

# 2. 安装依赖
npm install

# 3. 配置 Notion 同步 (可选)
cd tools/notion-sync
cp .env.example .env
# 编辑 .env, 填写 NOTION_API_KEY 和 NOTION_DATABASE_ID
npm install

# 4. 测试连接
node notion-test.js

# 5. 运行护栏检查
cd ~/github/liye_os
node .claude/scripts/guardrail.mjs
```

### 5.2 Amazon Growth Engine 环境

**前置要求**:
- Python ≥ 3.8
- Git (支持子模块)
- Amazon Ads API 凭证

**步骤**:
```bash
# 1. 克隆仓库 (含子模块)
git clone --recursive git@github.com:loudmirror/amazon-growth-engine.git ~/github/amazon-growth-engine
cd ~/github/amazon-growth-engine

# 2. 安装依赖
pip install -r src/domain/amazon-growth/requirements.txt

# 3. 配置环境
cp .env.template .env
# 编辑 .env, 填写 Ads API 凭证

# 4. 运行冒烟测试
python -m pytest tests/smoke/

# 5. 测试 Ads 连接
python -m src.ads.auth --test-connection
```

**环境变量** (`.env`):
```bash
# Amazon Ads API OAuth
ADS_CLIENT_ID="amzn1.application-oa2-client.xxxxx"
LWA_CLIENT_SECRET="xxxxxxxxxxxxx"
LWA_REFRESH_TOKEN="Atzr|IwEBxxxxx"
ADS_PROFILE_ID="1234567890"
ADS_MARKETPLACE_ID="US"

# 执行模式 (P2.0)
AGE_WRITE_ENABLED="0"       # 默认 DISABLED
ADS_OAUTH_MODE="readonly"   # 或 "full"
```

---

## 6. 常用操作指南

### 6.1 LiYe OS 常用命令

```bash
# 生成任务上下文
node .claude/scripts/assembler.mjs --task "Your task"

# 检查架构合规性
node .claude/scripts/guardrail.mjs

# Notion 同步
cd tools/notion-sync
npm run pull   # 从 Notion 拉取
npm run diff   # 检查差异
npm run push   # 推送到 Notion

# MCP 服务器
npm run mcp:up

# 演示/测试
npm run demo:reasoning
npm audit:replay

# Git 工作流
git add -A
git commit -m "feat(domain): description"
git push
```

### 6.2 Amazon Growth Engine 常用命令

```bash
# 测试 PPC 优化
python3 main.py --mode ppc-optimize \
  --input fixtures/ppc_sample.json \
  --target_acos 0.25 \
  --output-dir out \
  --emit recommendations,report \
  --report-format both

# 运行 ETL 作业
python3 -c "
from src.jobs.daily_ads_etl import DailyAdsEtlJob
from datetime import date
job = DailyAdsEtlJob(clients=[...], storage=AdsStorage())
result = job.run(report_date=date.today())
"

# 验证 action (执行前)
python3 -c "
from src.execution.validators import P2_1_A_GateValidator
validator = P2_1_A_GateValidator()
errors = validator.validate(execution_plan)
if errors: print('Blocked:', errors)
"
```

---

## 7. 治理与安全机制

### 7.1 稳定性合约

| 级别 | 修改要求 | 示例 |
|------|----------|------|
| **Frozen** | 30天通知 | 治理规则, 合约, CI gates |
| **Stable** | 14天通知 | 文档, 内核, 公共 API |
| **Experimental** | 随时 | 代理, crews, 内部实现 |

### 7.2 不可变规则

1. **系统 locale 始终为英语** - 内核/packs 无例外
2. **共享工具必须纯净** - 无副作用、API 调用或领域耦合
3. **工具不决定架构** - 不从工具需求反推
4. **Frozen 路径不可侵犯** - Gates 阻止未授权更改
5. **审计轨迹永久** - 不删除 verdicts/evidence

### 7.3 Amazon Growth Engine 安全层

```
Layer 1: OAuth Scope (P6-A)
  ↓ ADS_OAUTH_MODE=readonly 限制 token scope

Layer 2: Runtime Policy
  ↓ P2.1-A Gate Validator 限制操作类型

Layer 3: MCP Middleware
  ↓ AGE Write Gate - 最后物理保险丝

Layer 4: Trace Enforcement
  ↓ 所有写入必须有 trace_id
```

### 7.4 3-Strike 协议

- **触发**: 3次连续失败
- **动作**: 自动升级 Fast → Governed (Recovery Mode)
- **退出**: 手动干预或成功执行

---

## 8. 当前项目状态

### 8.1 LiYe OS 活跃阶段

| 阶段 | 组件 | 状态 | 标签 |
|------|------|------|------|
| **P1** | Governance Gateway | CLOSED | v1.1.0 |
| **P2-B** | Deterministic Replay Verifier | ACTIVE | Evidence Package v1 |
| **P3-A** | Replay CI Gate | ACTIVE | 当前工作 |
| **P6-C** | Supervised Minimal Write | ACTIVE | Four-key gating |

### 8.2 Amazon Growth Engine 阶段门控

**当前状态**: POST P2-PREP (等待审批)

| 检查项 | 状态 |
|--------|------|
| Action Spec v1 FROZEN | ✅ 完成 |
| 能力矩阵 LOCKED | ✅ 完成 |
| Dry-run/shadow 执行 | ✅ 完成 |
| Amazon Ads API 写入权限 | ❌ **等待审批** |

**限制** (审批前):
- ❌ 不能进入 P2.1-A (Real Execute)
- ❌ 不能执行真实 Ads API 写入
- ❌ 不能修改 Action Spec 语义
- ❌ 不能扩展 Action 类型或范围

### 8.3 当前分支状态

**LiYe OS**:
- 分支: `chore/p3a-replay-ci-gate`
- 修改文件:
  - `examples/dify/governed-tool-call-gateway/server.mjs`
  - `examples/feishu/cards/render_verdict_card.mjs`
  - `examples/feishu/feishu_adapter.mjs`

---

## 9. 交接清单

### 9.1 必读文档

- [ ] **LiYe OS**:
  - [ ] `README.md` - 项目概述
  - [ ] `CLAUDE.md` - Claude Code 上下文
  - [ ] `_meta/docs/ARCHITECTURE_CONSTITUTION.md` - 架构宪法 v1.8
  - [ ] `docs/start-here/ARCHITECTURE_CONTRACT.md` - 稳定性合约

- [ ] **Amazon Growth Engine**:
  - [ ] `README.md` - 项目状态
  - [ ] `docs/architecture/SYSTEM_OVERVIEW.md` - 系统设计
  - [ ] `docs/contracts/ACTION_SPEC_V1_FROZEN.md` - 规范定义

### 9.2 环境设置

- [ ] 克隆两个仓库 (含子模块)
- [ ] 安装 Node.js (≥18) 和 Python (≥3.8)
- [ ] 配置环境变量 (`.env` 文件)
- [ ] 运行冒烟测试
- [ ] 验证 Notion 连接 (如需要)
- [ ] 验证 Ads API 连接 (如需要)

### 9.3 架构理解

- [ ] 理解 World Model (T1/T2/T3) 三层推理
- [ ] 理解稳定性合约级别 (Frozen/Stable/Experimental)
- [ ] 理解治理策略 (POL_001-006)
- [ ] 理解代理规范 (v3.1)
- [ ] 理解 Action Spec 生命周期
- [ ] 理解阶段门控 (P2-PREP 限制)

### 9.4 开发流程

- [ ] 熟悉 CI gate 模式
- [ ] 理解 Pack 系统和上下文加载
- [ ] 了解 3-Strike 协议
- [ ] 掌握确定性回放机制
- [ ] 理解写入护栏和 trace 要求

### 9.5 关键联系人/资源

- **维护者**: LiYe AI (liyecom/liye-ai GitHub 组织)
- **文档层次**:
  1. `README.md` - 从这里开始
  2. `CLAUDE.md` - Claude Code 上下文
  3. `docs/start-here/` - 采用路径
  4. `_meta/docs/ARCHITECTURE_CONSTITUTION.md` - 宪法规则
  5. `docs/architecture/` - 详细架构

---

## 附录 A: 关键文件速查表

### LiYe OS

| 类别 | 文件 | 用途 |
|------|------|------|
| 入口 | `CLAUDE.md` | Claude Code 上下文 |
| 内核 | `src/kernel/t1/`, `t2/`, `t3/` | World Model |
| 治理 | `src/runtime/policy/` | 策略引擎 |
| 审计 | `src/audit/` | 证据 & 回放 |
| 技能 | `Skills/` | 技能库 |
| 代理 | `Agents/core/` | 核心代理 |
| 合约 | `_meta/contracts/` | 合约模板 |

### Amazon Growth Engine

| 类别 | 文件 | 用途 |
|------|------|------|
| 入口 | `main.py` | CLI 入口 |
| Ads API | `src/ads/` | API 集成 |
| 策略 | `src/strategy/wasted_spend.py` | MVP 策略 |
| 执行 | `src/execution/planner.py` | 执行计划 |
| 审计 | `src/strategy/audit.py` | 审计 + 护栏 |
| 安全 | `src/runtime/mcp/middleware/age_write_gate.py` | 写入保险丝 |
| 配置 | `config/amazon-growth/guardrails.yaml` | 护栏规则 |

---

## 附录 B: 术语表

| 术语 | 定义 |
|------|------|
| **Skill** | 方法论、SOP、模板 (被动知识) |
| **Agent** | 单个 AI 角色定义 (原子能力) |
| **Crew** | 多代理协作 (组合) |
| **System** | 完整可部署平台 (一等公民) |
| **Extension** | 能力插件 (运行时依赖) |
| **Contract** | 机器可执行的治理约束 |
| **Verdict** | 人类可读的决策语义 |
| **Track** | 长期项目文件夹 (审计、交接、治理) |
| **Trace** | 执行痕迹 (事实记录) |
| **Pack** | 领域知识包 (按需加载) |
| **T1/T2/T3** | World Model 三层推理管道 |
| **Action Spec** | 决策规范 (冻结的 schema) |
| **Execution Plan** | 机器可执行的计划 |
| **AGE** | Amazon Growth Engine |
| **TES** | Traffic Efficiency Score (流量效率分数) |

---

**文档版本**: 1.0
**生成日期**: 2026-02-02
**字数**: ~6,000 中文字符
**LiYe OS 版本**: 6.3.0
