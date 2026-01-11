# LiYe OS 目录架构全景

> 本文档提供 LiYe OS 代码库的完整目录结构概览，帮助开发者快速理解系统组织方式。
> 未来各模块更新时请同步更新本文档。

---

## 一、顶层目录总览

```
liye_os/
├── CLAUDE.md              # 内核入口路由器 (≤10,000 chars)
├── package.json           # Node.js 依赖 (v6.3.0)
├── README.md              # 项目说明
│
├── .claude/               # Claude Code 集成层
│   ├── packs/             # 按需加载的上下文包
│   ├── scripts/           # 工具自动化 (assembler, guardrail)
│   ├── .compiled/         # 编译输出 (不版本化)
│   └── .githooks/         # Git 钩子
│
├── _meta/                 # 系统元数据与治理 (Frozen)
│   ├── docs/              # 架构宪法、治理规范
│   ├── governance/        # 治理规则
│   ├── schemas/           # 数据结构定义
│   └── templates/         # 模板库
│
├── src/                   # 核心代码 - 4层架构实现
│   ├── kernel/            # 世界模型 (T1/T2/T3)
│   ├── runtime/           # 执行引擎 (MCP, 调度器, 策略)
│   ├── skill/             # 技能层 (原子/组合技能)
│   ├── domain/            # 领域层 (业务实现)
│   └── ...                # 其他子模块
│
├── Skills/                # 知识层 - 方法论/SOP (SSOT)
├── Agents/                # Agent 定义 (SSOT)
├── Crews/                 # 多 Agent 编排
├── Systems/               # 可部署子系统
├── Glossaries/            # 术语表 (YAML)
│
├── tools/                 # 开发工具
├── docs/                  # 公开文档
├── data/                  # 运行时数据 (不版本化)
├── memory/                # 记忆索引
├── state/                 # 状态管理
├── tracks/                # 执行轨道
├── Extensions/            # MCP 服务器扩展
├── Artifacts_Vault/       # 产物归档
├── Projects_Engine/       # 项目管理
│
├── i18n/                  # 国际化
├── examples/              # 示例
├── tests/                 # 测试
└── .github/               # CI/CD Gates (Frozen)
```

---

## 二、核心4层 + 内核架构

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: DOMAIN（领域层）                                   │
│  位置: /src/domain/ + /Agents/ + /Crews/ + /Systems/        │
│  职责: 业务实现、工作流编排、可部署子系统                    │
│  活跃领域:                                                   │
│    ├── geo-os/           # 核心知识引擎 (生产)               │
│    ├── skeleton/         # 最小参考领域                      │
│    ├── medical-research/ # 医学研究框架                      │
│    └── information-os/   # 信息系统 (Systems/)              │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│ Method Layer │ │Skill     │ │ Runtime Layer│
│ (WHY)        │ │ Layer    │ │ (HOW)        │
│ 业务逻辑      │ │ (WHAT)   │ │ 执行引擎     │
│ docs/        │ │ Skills/  │ │ src/runtime/ │
│ methodology/ │ │ src/skill│ │              │
└──────────────┘ └──────────┘ └──────────────┘
        ▲            ▲            ▲
        └────────────┼────────────┘
                     │
        ┌────────────▼────────────┐
        │ Kernel Layer            │
        │ 世界模型 (T1/T2/T3)      │
        │ src/kernel/             │
        └─────────────────────────┘
```

### 世界模型内核 (src/kernel/)

```
src/kernel/
├── t1/                    # 因果推理 "这在压力下会在哪里失败?"
│   ├── REGISTRY.yaml      # 失败模式注册表
│   ├── TRIGGERS.yaml      # 触发条件
│   └── scheduler.yaml
│
├── t2/                    # 世界状态评估 "世界现在处于什么危险状态?"
│   ├── REGISTRY.yaml      # 状态维度 (5D)
│   └── MAP_FROM_T1.yaml   # T1→T2 映射
│
├── t3/                    # 动态投影 "状态在压力下可能如何演变?"
│   ├── REGISTRY.yaml      # 动态模式
│   └── DYNAMICS_TEMPLATE.yaml
│
├── world_model/           # 运行时引擎
│   ├── runner.py          # 执行引擎
│   └── types.py           # 类型定义
│
├── GOVERNANCE_RULES.yaml  # 输出分类规则 (Frozen)
└── WORLD_MODEL_PIPELINE.yaml  # T1→T2→T3 编排
```

**治理规则**: 世界模型只输出状态描述、动态形式、因果链，**不输出预测或建议**。

---

## 三、Systems/ 可部署子系统

```
Systems/
├── information-os/        # 信息操作系统 v1.0
│   ├── workers/           # Cloudflare Workers
│   │   ├── hn-collector/  # HackerNews 信号采集
│   │   ├── ph-collector/  # ProductHunt 信号采集
│   │   └── push/          # 多渠道推送
│   ├── wrangler.toml      # 部署配置
│   └── README.md          # 系统文档
│
└── site-deployer/         # 网站部署系统
    └── ...
```

### information-os 推送优先级

| 优先级 | 渠道 | 状态 | 说明 |
|-------|------|------|------|
| 1 | 微信测试号 | 默认 | 免费，需配置 OpenID |
| 2 | 企业微信 Bot | 热备 | 自动 failover |
| 3 | PushPlus | 冷备 | 自动 failover |

---

## 四、.claude/ 上下文管理

```
.claude/
├── packs/                 # 按任务关键词加载
│   ├── operations.md      # amazon, asin, ppc → 加载
│   ├── research.md        # medical, clinical → 加载
│   ├── infrastructure.md  # notion, architecture → 加载
│   └── protocols.md       # multi-agent, crew → 加载
│
├── scripts/
│   ├── assembler.mjs      # 上下文编译器 (核心)
│   ├── guardrail.mjs      # 尺寸守护 (≤10KB/15KB)
│   ├── memory_bootstrap.mjs
│   └── validate_*.mjs     # Schema 验证器
│
├── .compiled/             # 编译输出 (不入库)
│   └── context.md         # 组装后的上下文
│
└── .githooks/             # Git 钩子
    └── pre-commit         # 提交前检查
```

---

## 五、外部系统集成

### 5.1 集成全景

| 外部服务 | 用途 | 集成位置 | 配置 |
|---------|------|---------|------|
| **Notion API** | 知识双向同步 | tools/notion-sync/ | NOTION_API_KEY, NOTION_DATABASE_ID |
| **Gemini API** | 中文摘要生成 | Systems/information-os/ | GEMINI_API_KEY |
| **Product Hunt** | 信号采集 (GraphQL) | Systems/information-os/ | PH_ACCESS_TOKEN |
| **Hacker News** | 信号采集 (RSS) | Systems/information-os/ | 无需认证 |
| **微信测试号** | 推送通知 | Systems/information-os/ | WECHAT_APPID, WECHAT_SECRET |
| **企业微信 Bot** | 推送热备 | Systems/information-os/ | WECOM_WEBHOOK_URL |
| **PushPlus** | 推送冷备 | Systems/information-os/ | PUSHPLUS_TOKEN |

### 5.2 Notion 同步命令

```bash
cd tools/notion-sync
npm run pull    # Notion → 本地
npm run push    # 本地 → Notion
npm run diff    # 查看差异
```

---

## 六、数据流与协作关系

### 6.1 执行流程

```
用户命令 (Claude Code)
         │
         ▼
┌─────────────────────────────────────┐
│ CLAUDE.md (内核路由器)               │
│ - 识别任务关键词                     │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ assembler.mjs (上下文编译)           │
│ - 加载匹配的 .claude/packs/*.md     │
│ - 注入 Glossary 术语                 │
│ - 注入 i18n 语言偏好                 │
│ - 输出 .compiled/context.md         │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 世界模型 Gate (T1→T2→T3)            │
│ - T1: 识别失败模式                   │
│ - T2: 评估世界状态 (5D)              │
│ - T3: 投影动态演变                   │
│ - 输出: 因果链 (非预测)              │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ Domain 执行                          │
│ - 加载 Agents/ (SSOT)               │
│ - 加载 Skills/ (SSOT)               │
│ - 编排 Crews/                        │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 输出持久化                           │
│ - data/traces/   执行轨迹           │
│ - Artifacts_Vault/  产物归档         │
│ - tracks/<id>/   执行轨道           │
└─────────────────────────────────────┘
```

### 6.2 SSOT 单一权威源

| 资源类型 | SSOT 位置 | 禁止位置 |
|---------|----------|---------|
| Agent 定义 | Agents/ | src/domain/*/agents/ |
| Skill 方法论 | Skills/ | 散落各处 |
| Crew 编排 | Crews/ | config/crews.yaml |
| 术语表 | Glossaries/ | 硬编码 |
| 版本号 | config/version.txt | package.json |

---

## 七、Runtime 层详细结构

```
src/runtime/
├── mcp/                   # MCP 协议实现
│   ├── base_server.py     # 基础服务器类
│   ├── registry.py        # 服务注册发现
│   ├── config/            # MCP 配置
│   ├── transport/         # 传输协议 (stdio)
│   ├── security/          # 安全认证 (vault)
│   ├── adapters/          # 集成适配器
│   └── servers/           # 服务器实现
│       ├── amazon/        # SellerSprite API
│       ├── knowledge/     # Qdrant 向量库
│       └── data/          # DuckDB SQL
│
├── executor/              # Agent 执行引擎
├── scheduler/             # 任务调度 (DAG)
├── policy/                # 策略执行
└── memory/                # 上下文管理
```

---

## 八、Skill 层详细结构

```
src/skill/
├── atomic/                # 原子技能 (单一能力)
│   ├── market_research.ts
│   ├── competitor_analysis.ts
│   ├── content_optimization.ts
│   └── keyword_research.ts
│
├── composite/             # 组合技能 (技能链)
├── loader/                # 技能加载器
├── registry/              # 技能注册表
└── types.ts               # 类型定义
```

### Skills/ 知识层 (方法论)

```
Skills/
├── 00_Core_Utilities/         # 文档/数据/通信工具
├── 01_Research_Intelligence/  # 研究方法论
├── 02_Operation_Intelligence/ # 运营流程 (ACTIVE)
├── 03_Creative_Production/    # 内容创作
├── 04_Business_Operations/    # 商业实践
├── 05_Medical_Intelligence/   # 医学研究
├── 07_Data_Science/           # 数据分析
├── 08_Communication/          # 沟通
├── 10_Health_Wellness/        # 健康
├── 11_Life_Design/            # 生活设计
├── 12_Meta_Cognition/         # 元认知
└── 99_Incubator/              # 孵化器 (ACTIVE)
```

---

## 九、CI/CD 治理 Gates (Frozen)

| Workflow | 用途 | 触发 |
|----------|------|------|
| `architecture-gate.yml` | 架构契约执行 | PR |
| `constitution-*-gate.yml` | 宪法合规 | PR |
| `security-gate.yml` | 密钥检测 | PR |
| `governance-audit.yml` | 治理审计 | 周一 00:00 UTC |
| `memory-gate.yml` | 记忆完整性 | PR |
| `layer-dependency-gate.yml` | 层依赖规则 | PR |

---

## 十、数据与产物管理

| 目录 | 用途 | 版本化 |
|------|------|--------|
| `data/traces/` | 执行轨迹 | 否 |
| `data/missions/` | 任务记录 | 选择性 |
| `data/stats/` | 统计数据 | 否 |
| `data/demo/` | 演示数据集 | 是 |
| `Artifacts_Vault/` | 产物归档 | 否 |
| `tracks/<id>/` | 执行轨道 | 选择性 |
| `.claude/.compiled/` | 编译上下文 | 否 |

---

## 十一、版本与稳定性

**当前版本**: 6.3.0 (2026-01-02)

| 稳定级别 | 变更策略 | 组件 |
|---------|---------|------|
| **Frozen** | RFC + 30天通知 | `_meta/governance/`, `*gate*` workflows |
| **Stable** | 14天通知 | `docs/architecture/`, `src/kernel/` 接口, `CLAUDE.md` |
| **Experimental** | 无需通知 | `Agents/`, `Crews/`, `Systems/`, `src/domain/` |

---

## 十二、快速命令参考

```bash
# 上下文生成
node .claude/scripts/assembler.mjs --task "你的任务描述"

# 治理检查
node .claude/scripts/guardrail.mjs

# Notion 同步
cd tools/notion-sync && npm run pull

# 知识查询
npm run recall
```

---

## 十三、相关文档

- [架构宪章](./ARCHITECTURE.md) - 系统设计权威 (Frozen)
- [命名规范](./NAMING.md) - 目录与文件命名
- [技能规范](./SKILL_SPEC.md) - 技能定义标准
- [Agent 规范](./AGENT_SPEC.md) - Agent 定义标准
- [MCP 规范](./MCP_SPEC.md) - MCP 协议规范
- [治理宪法](/_meta/docs/ARCHITECTURE_CONSTITUTION.md) - 架构治理

---

**Version**: 2.0
**Created**: 2025-12-28
**Last Updated**: 2026-01-10
**Changelog**:
- v2.0 (2026-01-10) 重构：添加世界模型内核、外部集成、数据流章节；更新领域迁移状态
- v1.2 修正 geo-os 描述为"生成式引擎优化系统 (GEO)"
- v1.1 添加占位符追踪表
