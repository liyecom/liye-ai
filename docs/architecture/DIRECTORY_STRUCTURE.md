# LiYe OS 目录架构全景

> 本文档提供 LiYe OS 代码库的完整目录结构概览，帮助开发者快速理解系统组织方式。

---

## 一、顶层目录总览（19个）

```
liye_os/
├── src/                  # 核心代码 - 4层架构实现
├── docs/                 # 公开文档 - 架构/方法论/白皮书
├── Agents/               # Agent 定义 - 13个 YAML 配置
├── Crews/                # 多智能体团队编排
├── Skills/               # 方法论技能库（12个域，仅1个激活）
├── Extensions/           # MCP 服务器扩展
├── .claude/              # Claude 上下文管理
├── _meta/                # 系统元数据与治理文档
├── tools/                # 工具脚本（Notion同步等）
├── cli/                  # 命令行界面
├── data/                 # 数据存储
├── examples/             # 示例工作流
├── reports/              # 生成报告
├── scripts/              # 实用脚本
├── Artifacts_Vault/      # 产物归档（按日期/项目/技能）
├── Projects_Engine/      # 项目管理（进行中/已完成）
├── Glossaries/           # 术语表（规划中）
├── websites/             # 网站发布输出
└── .github/              # GitHub Actions 工作流
```

---

## 二、核心4层架构详解

```
┌────────────────────────────────────────────────────────────┐
│  Layer 1: METHOD（方法层）                                  │
│  位置: /docs/methodology/ + /Skills/                        │
│  职责: 被动知识资产 - SOP、最佳实践、模板                    │
│  状态: 12个域规划，仅 02_Operation_Intelligence 激活        │
└────────────────────────────────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────┐
│  Layer 2: RUNTIME（运行时层）                               │
│  位置: /src/runtime/                                        │
│  职责: 执行引擎 - MCP协议、内存管理、调度器                 │
│  子模块:                                                    │
│    ├── mcp/          # MCP服务器（3个已实现）               │
│    │   ├── servers/amazon/sellersprite_server.py           │
│    │   ├── servers/knowledge/qdrant_server.py              │
│    │   └── servers/data/duckdb_server.py                   │
│    ├── executor/     # Agent执行引擎（TypeScript）          │
│    ├── memory/       # 记忆管理                             │
│    └── scheduler/    # 任务调度                             │
└────────────────────────────────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────┐
│  Layer 3: SKILL（技能层）                                   │
│  位置: /src/skill/                                          │
│  职责: 原子与组合技能定义、注册、加载                       │
│  结构:                                                      │
│    ├── atomic/       # 4个原子技能                          │
│    │   ├── market_research.ts                              │
│    │   ├── competitor_analysis.ts                          │
│    │   ├── content_optimization.ts                         │
│    │   └── keyword_research.ts                             │
│    ├── composite/    # 组合技能（框架就绪）                 │
│    ├── registry/     # 技能注册表                           │
│    └── loader/       # 技能加载器                           │
└────────────────────────────────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────┐
│  Layer 4: DOMAIN（领域层）                                  │
│  位置: /src/domain/ + /Agents/ + /Crews/                    │
│  职责: 业务逻辑实现、工作流、领域工具                       │
│  活跃领域:                                                  │
│    ├── amazon-growth/    # 主系统 - 10个Agent, 10+工具     │
│    ├── medical-research/ # 医疗研究框架                     │
│    └── geo-os/           # 生成式引擎优化系统 (GEO)         │
└────────────────────────────────────────────────────────────┘
```

---

## 三、Amazon Growth 领域深度结构

```
/src/domain/amazon-growth/
├── config/                # 配置（agents/tasks）
├── tools/                 # 领域工具
│   ├── flow_tool.py              # 广告流分析
│   ├── ollama_embedder.py        # 本地嵌入
│   ├── qdrant_kb_tool.py         # 知识库
│   └── analyze_campaign_*.py     # 活动分析
├── runtime/               # 领域运行时（10+子模块）
│   ├── bidding/           # PPC出价优化
│   ├── traffic_os/        # 流量管理
│   ├── attribution/       # 多触点归因
│   ├── intelligence/      # 分析引擎 (~1,111 LOC)
│   ├── data_lake/         # 数据湖
│   ├── etl/               # ETL编排
│   └── ...
├── skills/                # 领域技能
├── workflows/             # 工作流定义
├── dashboard/             # UI组件
└── docs/                  # 领域文档
```

---

## 四、Agent 与 Crew 结构

```
/Agents/
├── core/                  # 3个基础Agent
│   ├── analyst.yaml
│   ├── orchestrator.yaml
│   └── researcher.yaml
└── amazon-growth/         # 10个专业Agent (1,151 LOC)
    ├── keyword-architect.yaml      # 关键词策略
    ├── sprint-orchestrator.yaml    # Sprint管理
    ├── ppc-strategist.yaml         # PPC优化
    ├── market-analyst.yaml         # 市场情报
    ├── listing-optimizer.yaml      # Listing优化
    └── ...

/Crews/
└── core/
    ├── analysis-team.yaml    # 分析团队
    └── research-team.yaml    # 研究团队
```

---

## 五、Claude 上下文管理

```
/.claude/
├── packs/                 # 按任务加载的上下文包
│   ├── operations.md      # Amazon/PPC (4.6KB)
│   ├── research.md        # 医疗研究 (7.1KB)
│   ├── infrastructure.md  # 架构/配置 (8.6KB)
│   └── protocols.md       # 多智能体协议 (9.9KB)
├── scripts/
│   ├── assembler.mjs      # 动态上下文生成
│   └── guardrail.mjs      # 尺寸守护（≤10KB/15KB）
├── skills/                # Claude技能定义
└── .compiled/             # 编译输出（不入库）
```

---

## 六、Runtime 层详细结构

```
/src/runtime/
├── mcp/                   # MCP 协议实现
│   ├── base_server.py     # 基础服务器类
│   ├── registry.py        # 服务注册发现
│   ├── types.py           # 类型定义
│   ├── config/            # MCP 配置
│   ├── transport/         # 传输协议
│   │   ├── stdio.py
│   │   └── base.py
│   ├── security/          # 安全认证
│   │   └── vault.py
│   ├── adapters/          # 集成适配器
│   │   └── crewai_adapter.py
│   ├── servers/           # 服务器实现
│   │   ├── amazon/        # SellerSprite API
│   │   ├── knowledge/     # Qdrant 向量库
│   │   ├── data/          # DuckDB SQL
│   │   └── external/      # 外部服务桥接
│   └── tests/             # 集成测试
├── executor/              # 执行器
│   ├── agent.ts           # Agent执行引擎
│   └── types.ts           # 类型定义
├── memory/                # 记忆管理
├── scheduler/             # 任务调度
└── evolution/             # 系统演进协议
```

---

## 七、文档层次结构

| 文档类型 | 位置 | 用途 |
|---------|------|------|
| **架构宪章** | `/docs/architecture/ARCHITECTURE.md` | 系统设计权威 |
| **目录结构** | `/docs/architecture/DIRECTORY_STRUCTURE.md` | 本文档 |
| **治理规范** | `/_meta/docs/FILE_SYSTEM_GOVERNANCE.md` | 文件系统治理 |
| **方法论** | `/docs/methodology/` | 12个领域方法 |
| **白皮书** | `/docs/whitepaper/` | 治理栈公开版 |
| **审计报告** | `/docs/architecture/AUDIT_*.md` | 合规审计 |
| **修订记录** | `/docs/architecture/AMENDMENTS.md` | 宪章修订 |

---

## 八、Skill 层详细结构

```
/src/skill/
├── atomic/                # 原子技能（单一能力）
│   ├── market_research.ts
│   ├── competitor_analysis.ts
│   ├── content_optimization.ts
│   └── keyword_research.ts
├── composite/             # 组合技能（技能链）
│   └── (框架就绪，待实现)
├── loader/                # 技能加载器
│   └── index.ts
├── registry/              # 技能注册表
│   └── index.ts
└── types.ts               # 技能类型定义
    # SkillInput / SkillOutput - 数据契约
    # Schema - JSON Schema 校验
    # Skill - 基础接口 (execute + validate)
    # CompositeSkill - 链式执行
    # SkillRegistry - 运行时发现
```

---

## 九、数据与产物管理

```
/Artifacts_Vault/          # 产物归档
├── by_date/               # 按日期存储
├── by_project/            # 按项目组织
├── by_skill/              # 按技能索引
└── knowledge_graph/       # 语义链接

/Projects_Engine/          # 项目管理
├── active/                # 进行中项目
├── completed/             # 已完成项目
└── templates/             # 项目模板

/src/domain/data/          # 领域数据
├── inputs/                # 原始输入
├── processed/             # 处理后输出
├── uploads/               # 用户上传
│   ├── Timo-US/
│   └── Timo-CA/
└── reports/               # 生成报告
```

---

## 十、工具与扩展

```
/tools/
├── notion-sync/           # Notion 数据库同步
│   ├── notion-test.js     # 连接测试
│   ├── notion-daily-sync.js
│   └── package.json       # npm run pull/push/diff
├── converters/            # 格式转换工具
└── web-publisher/         # 网站发布管道

/cli/                      # 命令行界面
├── commands/              # CLI命令实现
├── validators/            # 输入校验
├── scaffolds/             # 项目脚手架
└── report/                # 报告生成

/Extensions/               # 扩展
└── mcp-servers/           # MCP 服务器扩展
    └── filesystem.json    # 配置定义
```

---

## 十一、占位符追踪表

> 以下组件已创建占位符 README，规划就绪，待后续激活。

### Skills 技能域（12个）

| 域 | 目录 | 状态 | 说明 |
|----|------|------|------|
| 01 | `Skills/01_Research_Intelligence/` | `PLACEHOLDER` | 研究智能 |
| 02 | `Skills/02_Operation_Intelligence/` | `ACTIVE` | 运营智能（已激活） |
| 03 | `Skills/03_Creative_Production/` | `PLACEHOLDER` | 创意生产 |
| 04 | `Skills/04_Business_Operations/` | `PLACEHOLDER` | 商业运营 |
| 05 | `Skills/05_Medical_Intelligence/` | `PLACEHOLDER` | 医疗智能（框架就绪） |
| 06 | `Skills/06_Technical_Development/` | `PLACEHOLDER` | 技术开发（框架就绪） |
| 07 | `Skills/07_Data_Science/` | `PLACEHOLDER` | 数据科学 |
| 08 | `Skills/08_Communication/` | `PLACEHOLDER` | 沟通 |
| 09 | `Skills/09_Learning_Growth/` | `PLACEHOLDER` | 学习成长 |
| 10 | `Skills/10_Health_Wellness/` | `PLACEHOLDER` | 健康 |
| 11 | `Skills/11_Life_Design/` | `PLACEHOLDER` | 生活设计 |
| 12 | `Skills/12_Meta_Cognition/` | `PLACEHOLDER` | 元认知 |
| 99 | `Skills/99_Incubator/` | `ACTIVE` | 孵化器 |

### 代码层组件

| 组件 | 位置 | 状态 | 说明 |
|------|------|------|------|
| 组合技能 | `src/skill/composite/` | `PLACEHOLDER` | 框架就绪，待实现技能链 |

### 方法论域（13个）

| 域 | 目录 | 状态 | 说明 |
|----|------|------|------|
| 01 | `docs/methodology/01_Research_Intelligence/` | `PLACEHOLDER` | 有 README |
| 02a | `docs/methodology/02_Analysis_Strategy/` | `PLACEHOLDER` | 有 README |
| 02b | `docs/methodology/02_Operation_Intelligence/` | `ACTIVE` | 有实际内容 |
| 03 | `docs/methodology/03_Creative_Production/` | `PLACEHOLDER` | 有 README |
| 04 | `docs/methodology/04_Business_Operations/` | `PLACEHOLDER` | 有 README |
| 05 | `docs/methodology/05_Medical_Intelligence/` | `PARTIAL` | 有子目录内容 |
| 06 | `docs/methodology/06_Technical_Development/` | `PARTIAL` | 有子目录内容 |
| 07 | `docs/methodology/07_Data_Science/` | `PLACEHOLDER` | 有 README |
| 08 | `docs/methodology/08_Communication/` | `PLACEHOLDER` | 有 README |
| 09 | `docs/methodology/09_Learning_Growth/` | `PLACEHOLDER` | 有 README |
| 10 | `docs/methodology/10_Health_Wellness/` | `PLACEHOLDER` | 有 README |
| 11 | `docs/methodology/11_Life_Design/` | `PLACEHOLDER` | 有 README |
| 12 | `docs/methodology/12_Meta_Cognition/` | `PLACEHOLDER` | 有 README |
| 99 | `docs/methodology/99_Incubator/` | `ACTIVE` | 孵化器 |

### 状态说明

- `ACTIVE` - 已激活，有实际内容
- `PARTIAL` - 部分激活，有基础框架
- `PLACEHOLDER` - 占位符，待激活

---

## 十二、状态总结

| 组件 | 状态 | 数量 |
|------|------|------|
| **活跃领域** | 生产 | 1 (amazon-growth) |
| **框架领域** | 就绪 | 2 (medical-research, geo-os) |
| **Agent 定义** | 激活 | 13个 YAML |
| **MCP 服务器** | 运行 | 3个 (SellerSprite/Qdrant/DuckDB) |
| **原子技能** | 实现 | 4个 TypeScript |
| **方法论域** | 激活/规划 | 3/13 |
| **Skills 域** | 激活/规划 | 2/13 |

---

## 十三、架构特点

1. **宪法驱动**: 所有重大组件都有设计决策文档
2. **4层隔离**: Method → Runtime → Skill → Domain 清晰分离
3. **MCP扩展**: 外部能力通过 MCP 协议暴露
4. **YAML声明式**: Agents/Crews/Tasks 用 YAML 定义，与运行时代码分离
5. **领域驱动**: 每个领域自包含 runtime/skills/tools

---

## 相关文档

- [架构宪章](./ARCHITECTURE.md) - 系统设计权威
- [命名规范](./NAMING.md) - 目录与文件命名
- [技能规范](./SKILL_SPEC.md) - 技能定义标准
- [Agent规范](./AGENT_SPEC.md) - Agent定义标准
- [MCP规范](./MCP_SPEC.md) - MCP协议规范

---

**Version**: 1.2
**Created**: 2025-12-28
**Last Updated**: 2025-12-28
**Changelog**:
- v1.2 修正 geo-os 描述为"生成式引擎优化系统 (GEO)"
- v1.1 添加占位符追踪表
