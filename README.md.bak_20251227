# LiYe AI

> 个人 AI 操作系统 | Personal AI Operating System

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-3.1.0-green.svg)](package.json)

---

## 这是什么？

**LiYe AI** 是一个 AI 驱动的个人操作系统，它能帮你：

- 🤖 **自动化复杂任务** — 多个 AI 智能体协同工作
- 📚 **管理知识技能** — 把经验沉淀成可复用的技能库
- 🔄 **持续自我进化** — 从每次执行中学习改进
- 🎯 **专注领域应用** — 目前支持电商运营、医疗研究等场景

---

## 快速上手

```bash
# 克隆项目
git clone https://github.com/liyecom/liye-ai.git
cd liye-ai

# 安装依赖
npm install

# 查看系统状态
npx liye-ai status
```

---

## 核心概念（3 分钟理解）

### 1️⃣ 智能体 (Agent)
一个有特定角色和技能的 AI 助手。比如"市场分析师"、"文案优化师"。

### 2️⃣ 团队 (Crew)
多个智能体组成的协作团队，一起完成复杂任务。

### 3️⃣ 技能 (Skill)
智能体具备的能力，比如"关键词分析"、"竞品研究"。

### 4️⃣ 工作流 (Workflow)
预定义的任务流程，串联多个智能体按步骤执行。

---

## 项目结构一览

```
liye-ai/
│
├── 📄 README.md              ← 你正在看的文件
├── 📄 CLAUDE.md              ← Claude AI 的配置文件
├── 📄 LICENSE                ← 开源许可证 (Apache 2.0)
├── 📄 CONTRIBUTING.md        ← 贡献指南
├── 📄 RELEASE_NOTES.md       ← 版本更新说明
├── 📄 package.json           ← npm 包配置
│
├── 🤖 Agents/                ← 智能体定义
├── 👥 Crews/                 ← 团队配置
├── 🔧 skills/                ← 技能方法论库（人类可读）
├── 🔌 Extensions/            ← 扩展插件
├── 📖 Glossaries/            ← 术语表
│
├── 💻 src/                   ← 核心代码（四层架构）
├── ⚙️ Systems/               ← 可执行系统
├── 🛠️ tools/                 ← 工具脚本
├── 📚 docs/                  ← 文档
├── 📦 examples/              ← 使用示例
├── 🖥️ cli/                   ← 命令行入口
│
├── 🗄️ _meta/                 ← 元数据和内部文档
├── 📁 .claude/               ← Claude 配置
├── 🏗️ Artifacts_Vault/       ← 产物归档
└── 📋 Projects_Engine/       ← 项目管理
```

---

## 详细目录说明

### 🤖 Agents/ — 智能体定义

存放所有 AI 智能体的配置文件。

```
Agents/
├── README.md           # 说明文档
├── _template.yaml      # 智能体模板（创建新智能体时复制这个）
└── core/               # 核心智能体
    ├── orchestrator.yaml    # 协调者 — 负责任务调度
    ├── researcher.yaml      # 研究员 — 负责信息收集
    └── analyst.yaml         # 分析师 — 负责数据分析
```

**智能体配置包含：**
- `persona` — 角色人设（谁）
- `skills` — 具备技能（能做什么）
- `runtime` — 运行配置（怎么执行）

---

### 👥 Crews/ — 团队配置

定义智能体团队的协作方式。

```
Crews/
├── README.md              # 说明文档
├── _template.yaml         # 团队模板
└── core/                  # 核心团队
    ├── research-team.yaml     # 研究团队（协调者+研究员+分析师）
    └── analysis-team.yaml     # 分析团队（分析师+研究员）
```

---

### 🔧 skills/ — 技能方法论库

**人类可读**的技能文档，按领域分类。

```
skills/
├── 01_Research_Intelligence/      # 研究情报
├── 02_Analysis_Strategy/          # 分析策略
├── 02_Operation_Intelligence/     # 运营情报（Amazon 等）
│   ├── amazon-keyword-analysis/   # 亚马逊关键词分析技能
│   └── amazon-operations-crew/    # 亚马逊运营团队
├── 03_Creative_Production/        # 创意生产
├── 04_Business_Operations/        # 商业运营
├── 05_Medical_Intelligence/       # 医疗情报
│   └── Medical_Research_Analyst/  # 医疗研究分析师
├── 06_Technical_Development/      # 技术开发
│   ├── CrewAI_Multi_Agent_Framework/  # CrewAI 框架
│   └── Intelligent_Agent_Design/      # 智能体设计
├── 07_Data_Science/               # 数据科学
├── 08_Communication/              # 沟通表达
├── 09_Learning_Growth/            # 学习成长
├── 10_Health_Wellness/            # 健康养生
├── 11_Life_Design/                # 人生设计
├── 12_Meta_Cognition/             # 元认知
└── 99_Incubator/                  # 孵化区（实验性技能）
```

---

### 🔌 Extensions/ — 扩展插件

与外部工具的集成扩展。

```
Extensions/
├── README.md
├── claude-skills/          # Claude Code 技能
│   ├── README.md
│   └── liye-agent.md       # LiYe 智能体操作技能
└── mcp-servers/            # MCP 协议服务器配置
    ├── README.md
    └── filesystem.json     # 文件系统访问配置
```

---

### 📖 Glossaries/ — 术语表

项目中使用的专业术语解释。

```
Glossaries/
├── README.md
├── architecture.md     # 架构术语（四层架构、依赖模型等）
├── agents.md           # 智能体术语（Persona、Crew、Delegation 等）
└── workflows.md        # 工作流术语（Task、Phase、DAG 等）
```

---

### 💻 src/ — 核心代码（四层架构）

这是系统的技术核心，采用四层架构：

```
src/
├── method/             # ① 方法层 (WHY) — 声明"做什么"
│   ├── personas/       #    角色人设定义
│   ├── workflows/      #    工作流定义
│   ├── phases/         #    阶段定义
│   ├── tracks/         #    轨道规则（快速/标准/企业级）
│   └── evolution/      #    进化协议
│
├── runtime/            # ② 运行时层 (HOW) — 负责"怎么执行"
│   ├── executor/       #    智能体执行器
│   ├── scheduler/      #    任务调度器（DAG）
│   ├── memory/         #    上下文记忆
│   └── evolution/      #    进化引擎
│
├── skill/              # ③ 技能层 (WHAT) — 定义"能做什么"
│   ├── atomic/         #    原子技能（单一功能）
│   ├── composite/      #    组合技能（技能链）
│   ├── registry/       #    技能注册表
│   └── loader/         #    技能加载器
│
└── domain/             # ④ 领域层 (WHERE) — 业务实现
    ├── amazon-growth/      # 亚马逊增长领域
    ├── medical-research/   # 医疗研究领域
    ├── geo-os/             # 知识提取引擎
    ├── registry.ts         # 领域注册表
    └── index.ts            # 领域导出
```

**四层架构简单理解：**

| 层 | 问题 | 职责 | 类比 |
|---|------|------|------|
| Method | WHY | 定义角色和规则 | 剧本和角色设定 |
| Runtime | HOW | 执行和调度 | 导演和摄影 |
| Skill | WHAT | 具体能力 | 演员的表演技能 |
| Domain | WHERE | 业务场景 | 具体的电影题材 |

---

### ⚙️ Systems/ — 可执行系统

完整的、可独立运行的系统。

```
Systems/
├── REGISTRY.yaml           # 系统注册表
├── amazon-growth-os/       # 亚马逊运营系统 ⭐
│   ├── agents/             # 9个专业智能体
│   ├── config/             # 配置文件
│   ├── dashboard/          # 数据看板
│   ├── docs/               # 文档
│   ├── evolution/          # 进化数据
│   ├── scripts/            # 脚本
│   ├── src/                # 源代码
│   └── tools/              # 工具
└── geo-os/                 # 知识提取系统
    ├── config/             # 配置
    ├── ingestion/          # 数据摄入
    ├── processing/         # 处理逻辑
    └── outputs/            # 输出结果
```

---

### 🛠️ tools/ — 工具脚本

辅助工具集合。

```
tools/
├── converters/         # 格式转换工具
├── notion-sync/        # Notion 同步工具
│   ├── notion-test.js          # 连接测试
│   ├── notion-daily-sync.js    # 每日同步
│   └── lib/                    # 库文件
└── web-publisher/      # 网页发布工具
    ├── config/                 # 配置
    └── enhance_articles.py     # 文章增强
```

---

### 📚 docs/ — 文档

项目文档。

```
docs/
├── CONSTITUTION.md     # 项目宪法（核心原则）
├── getting-started.md  # 快速入门指南
└── architecture/       # 架构文档
    ├── ARCHITECTURE.md       # 四层架构说明
    ├── AGENT_SPEC.md         # 智能体规范
    ├── WORKFLOW_DSL.md       # 工作流 DSL 规范
    ├── SKILL_SPEC.md         # 技能规范
    ├── EVOLUTION_PROTOCOL.md # 进化协议
    └── NAMING.md             # 命名规范
```

---

### 📦 examples/ — 使用示例

学习如何使用 LiYe AI 的示例代码。

```
examples/
├── hello-world/        # 最简单的入门示例
├── custom-agent/       # 如何创建自定义智能体
└── amazon-workflow/    # 亚马逊工作流示例
```

---

### 🖥️ cli/ — 命令行入口

CLI 工具的入口文件。

```
cli/
├── index.js        # 主入口
└── commands/       # 子命令
```

**使用方式：**
```bash
npx liye-ai status          # 查看系统状态
npx liye-ai agent list      # 列出所有智能体
npx liye-ai skill list      # 列出所有技能
```

---

### 🗄️ _meta/ — 元数据

项目内部文档和元数据（不面向普通用户）。

```
_meta/
├── docs/                           # 内部文档
│   ├── ARCHITECTURE_CONSTITUTION.md
│   ├── FILE_SYSTEM_GOVERNANCE.md
│   └── ...
├── scripts/                        # 内部脚本
├── skill_template/                 # 技能模板
├── EVOLUTION_ROADMAP_2025.md       # 2025 路线图
├── QUICK_START_GUIDE.md            # 快速指南
└── ...
```

---

### 📁 .claude/ — Claude 配置

Claude AI 助手的配置文件。

```
.claude/
├── packs/              # 上下文包（按需加载）
│   ├── operations.md       # 运营相关上下文
│   ├── research.md         # 研究相关上下文
│   ├── infrastructure.md   # 基础设施上下文
│   └── protocols.md        # 协议上下文
├── scripts/            # 辅助脚本
│   ├── assembler.mjs       # 上下文组装器
│   └── guardrail.mjs       # 守护脚本
├── .githooks/          # Git 钩子
└── .compiled/          # 编译输出（不入库）
```

---

### 🏗️ Artifacts_Vault/ — 产物归档

存储生成的产物和知识图谱。

```
Artifacts_Vault/
├── by_date/            # 按日期归档
├── by_project/         # 按项目归档
├── by_skill/           # 按技能归档
└── knowledge_graph/    # 知识图谱
```

---

### 📋 Projects_Engine/ — 项目管理

项目管理相关文件。

```
Projects_Engine/
├── active/             # 进行中的项目
├── completed/          # 已完成的项目
└── templates/          # 项目模板
```

---

## 应用领域

### 🛒 Amazon Growth（电商运营）

帮助亚马逊卖家进行产品运营的多智能体系统。

**包含 9 个专业智能体：**
- 市场分析师、关键词架构师、Listing 优化师
- 诊断架构师、PPC 策略师、执行代理
- 质量门卫、评论哨兵、冲刺协调者

**支持的工作流：**
- 新品发布流程
- 产品优化流程
- 问题诊断流程

---

### 🏥 Medical Research（医疗研究）

AI 驱动的医疗文献研究和证据合成系统。

**特点：**
- GRADE 方法论进行证据分级
- PRISMA 标准的系统综述流程
- PubMed 文献检索和分析

---

### 🌐 GEO OS（知识引擎）

通用知识提取和处理引擎。

**功能：**
- 文档标准化（PDF、DOCX → Markdown）
- 语义分块和结构提取
- 输出结构化 JSON 供其他系统使用

---

## 技术栈

| 类型 | 技术 |
|------|------|
| 语言 | TypeScript, Python |
| 运行时 | Node.js 18+, Python 3.11+ |
| 包管理 | npm, pip |
| AI 框架 | CrewAI, LangChain |
| 数据库 | DuckDB (分析), Qdrant (向量) |

---

## 贡献指南

欢迎贡献！请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)。

```bash
# 开发流程
npm install           # 安装依赖
npm test              # 运行测试
npm run lint          # 代码检查
npm run build         # 构建
```

---

## 许可证

Apache License 2.0 — 详见 [LICENSE](LICENSE)

---

## 致谢

LiYe AI 基于以下开源项目构建：

- **[BMad Method](https://github.com/bmad-code-org/BMAD-METHOD)** (Apache 2.0) — AI 驱动的敏捷方法论
- **[CrewAI](https://github.com/joaomdmoura/crewAI)** (MIT) — 多智能体编排框架
- **[Skill Forge](https://github.com/anthropics/agent-skills)** (MIT) — 智能体技能管理

---

## 链接

- 🌐 官网: [liye.ai](https://liye.ai)
- 📖 文档: [docs/](docs/)
- 🐛 问题反馈: [GitHub Issues](https://github.com/liyecom/liye-ai/issues)

---

**LiYe AI v3.1.0** | 2025

*"能自我学习的系统，终将势不可挡。"*
