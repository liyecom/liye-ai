# CLAUDE.md (Kernel)

本文件是 **LiYe OS 的启动路由/最小常驻上下文**。不要把长 SOP、长协议、完整技能说明塞回这里。
需要细节时按任务加载 `.claude/packs/`，或用装配器生成 `.claude/.compiled/context.md`。

## Repo Root
- Repo: `~/github/liye_os`
- Claude 执行目录：以当前打开的 repo 为准（不要依赖 ~ 下的 CLAUDE.md）

## 最常用命令（Top）

### Notion Sync（在 repo 根目录执行）

```bash
# 测试 Notion 连接
node tools/notion-sync/notion-test.js

# 分析 Notion 内容
node tools/notion-sync/analyze-notion-content.js

# 每日同步
node tools/notion-sync/notion-daily-sync.js

# 使用新脚手架（pull/push/diff）
cd tools/notion-sync
npm run pull    # 从 Notion 拉取到本地
npm run push    # 推送本地到 Notion
npm run diff    # 查看差异
```

**环境配置：**
- `tools/notion-sync/.env` 需要 `NOTION_API_KEY` 和 `NOTION_DATABASE_ID`
- 参考 `tools/notion-sync/.env.example` 进行配置
- 确保 `.env` 已在 .gitignore 中

### 生成"本次任务上下文"（推荐）

```bash
# 按任务自动加载相关 Packs
node .claude/scripts/assembler.mjs --task "优化 Amazon Listing"

# 然后让 Claude 读取编译后的上下文：
# Read .claude/.compiled/context.md
```

### 文件系统治理

```bash
# 检查 CLAUDE.md 和 Packs 是否超标
node .claude/scripts/guardrail.mjs

# 查看治理方案
cat _meta/docs/FILE_SYSTEM_GOVERNANCE.md
```

## 按需加载 Packs（关键规则）

| 任务类型                   | 读哪个 Pack                          | 触发关键词 |
| ---------------------- | --------------------------------- | ----- |
| Amazon/跨境/运营/关键词/PPC   | `.claude/packs/operations.md`     | amazon, asin, ppc, listing, 跨境 |
| 医疗研究/循证/临床/文献/CrewAI   | `.claude/packs/research.md`       | 医疗, 治疗, 药物, 临床, crew |
| 架构/Notion/PARA/配置/命名规范 | `.claude/packs/infrastructure.md` | notion, para, 架构, 配置, sync |
| 多智能体协作/职责分工/交付协议       | `.claude/packs/protocols.md`      | multi-agent, 协作, 协议 |

**使用方式：**
1. **手动加载**：直接 `Read .claude/packs/operations.md`
2. **自动加载**：使用 Assembler 根据任务关键词自动拼接

## 核心原则（Guardrails）

### 性能边界
- `CLAUDE.md` ≤ 10,000 chars（当前文件）
- 每个 Pack ≤ 15,000 chars
- 超标直接阻止提交（pre-commit hook）

### 职责分离
- **Kernel（本文件）**：启动路由、常用命令、Pack 索引
- **Packs**：按领域分类的详细规则（operations, research, infrastructure, protocols）
- **Skills**：具体技能的完整文档（10模块标准）
- **Systems**：可执行代码系统（amazon_growth_os, notion_sync 等）

### 检查命令

```bash
# 运行 Guardrail 检查
node .claude/scripts/guardrail.mjs

# 如果失败，查看具体超标文件并精简
```

## 目录结构速查

```
~/github/liye_os/
├── CLAUDE.md              # 本文件（Kernel）
├── .claude/               # Claude 配置和脚本
│   ├── packs/             # 按需加载的详细规则
│   ├── scripts/           # 工具脚本（assembler, guardrail）
│   ├── .compiled/         # 编译输出（不入库）
│   └── .githooks/         # Git hooks
├── _meta/                 # 元数据和文档
│   ├── docs/              # 架构文档
│   │   ├── ARCHITECTURE_CONSTITUTION.md
│   │   └── FILE_SYSTEM_GOVERNANCE.md
│   └── templates/         # 模板库
├── Skills/                # 技能库（12个域）
├── Systems/               # 可执行系统
│   └── a private repository/  # Amazon 运营系统
├── tools/                 # 工具脚本
│   └── notion-sync/       # Notion 同步工具
├── Projects_Engine/       # 项目管理
└── Artifacts_Vault/       # 产物归档
```

## 架构边界（重要）

### LiYe CLI vs LiYe OS

| 概念 | 职责 | 位置 |
|------|------|------|
| **LiYe CLI** | 命令入口，路由命令 | `cli/` |
| **LiYe OS** | 能力平台（知识+技能+引擎） | 其他所有目录 |
| **Context Compiler** | 智能上下文编译 | `.claude/scripts/assembler.mjs`（属于 OS） |

**关键边界**：
- CLI 只负责解析命令和调用 assembler.mjs
- CLI 不编译上下文、不执行 Agent、不管理知识
- assembler.mjs 属于 OS，不是 CLI 组件

### Runtime ≠ CLI

注意术语区分：
- **Runtime** = OS 的执行引擎层（`src/runtime/`），包含 AgentExecutor、MCP
- **CLI** = 命令行入口（`cli/`），只做路由
- 两者不是同一个东西

## 快速开始

### 第一次使用

```bash
# 1. 安装 Notion sync 依赖
cd tools/notion-sync
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 NOTION_API_KEY 和 NOTION_DATABASE_ID

# 3. 测试连接
node notion-test.js

# 4. 运行 Guardrail 确保规范
cd ~/github/liye_os
node .claude/scripts/guardrail.mjs
```

### 典型工作流

```bash
# 1. 开始新任务前，生成上下文
node .claude/scripts/assembler.mjs --task "你的任务描述"

# 2. Claude 读取编译后的上下文
# Read .claude/.compiled/context.md

# 3. 执行任务...

# 4. 提交前检查
node .claude/scripts/guardrail.mjs
git add -A
git commit -m "..."
```

## 重要提醒

1. **不要污染 Kernel**：新规则添加到对应 Pack，不要写回本文件
2. **使用 Assembler**：让系统自动加载需要的 Packs，避免手动维护
3. **遵守 Guardrails**：超标会被 pre-commit hook 阻止
4. **数据文件外置**：`.env`、数据文件、日志等不入库
5. **保持版本化**：`.claude/` 所有内容都应该在 Git 中（除 `.compiled/`）

## 参考文档

- 架构宪章：`_meta/docs/ARCHITECTURE_CONSTITUTION.md`
- 文件系统治理：`_meta/docs/FILE_SYSTEM_GOVERNANCE.md`
- 进化路线图：`_meta/EVOLUTION_ROADMAP_2025.md`
- Notion Sync 文档：`tools/notion-sync/README.md`

---

**Version**: 1.1
**Last Updated**: 2025-12-29
**Char Count**: ~5,200 / 10,000
