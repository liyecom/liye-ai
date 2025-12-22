# Context Pack: Infrastructure（架构/Notion/PARA/配置）

**加载条件：** 涉及 Notion 同步、PARA 组织、路径配置、命名规范、系统架构理解时加载。

## Notion Sync 系统

**位置：** `tools/notion-sync/`

**架构：** Node.js + Notion API + Markdown 双向同步

### 脚本说明

| 脚本 | 用途 | 输入 | 输出 |
|-----|------|------|------|
| `notion-test.js` | 测试连接 | `.env` | 连接状态 |
| `analyze-notion-content.js` | 分析内容 | Database ID | 统计报告 |
| `notion-daily-sync.js` | 每日同步 | 配置文件 | 同步日志 |
| `index.js` (新) | CLI 工具 | 命令参数 | 执行结果 |
| `scripts/pull.js` | 从 Notion 拉取 | Database | Markdown 文件 |
| `scripts/push.js` | 推送到 Notion | Markdown | Notion Pages |
| `scripts/diff.js` | 对比差异 | - | 差异报告 |

### 配置管理

**环境变量（`.env`）：**
```bash
# Notion API
NOTION_API_KEY=secret_xxxxx
NOTION_DATABASE_ID=xxxxx

# 本地路径
LOCAL_SYNC_DIR=../Documents/Obsidian Vault

# 同步行为
SYNC_INTERVAL_MINUTES=30
AUTO_SYNC_ENABLED=false
CONFLICT_RESOLUTION=ask  # ask | local-wins | notion-wins | merge
```

**路径配置（`.paths.config.json`，可选）：**
```json
{
  "vaults": {
    "obsidian": "~/Documents/Obsidian Vault",
    "para": "~/Documents/liye_workspace"
  },
  "databases": {
    "skills": "database_id_1",
    "projects": "database_id_2",
    "areas": "database_id_3"
  },
  "output": {
    "logs": "~/github/liye_os/.cache/notion-sync/logs",
    "state": "~/github/liye_os/.cache/notion-sync/state.json"
  }
}
```

### 使用流程

```bash
cd ~/github/liye_os/tools/notion-sync

# 1. 首次配置
cp .env.example .env
vim .env  # 填入 NOTION_API_KEY 和 NOTION_DATABASE_ID

# 2. 安装依赖（如果还没有）
npm install

# 3. 测试连接
node notion-test.js

# 4. 查看差异
npm run diff

# 5. 拉取 Notion 内容
npm run pull

# 6. 推送本地更改
npm run push

# 7. 强制覆盖（谨慎使用）
npm run pull -- --force
npm run push -- --force
```

### Frontmatter 格式

**Notion → Markdown：**
```yaml
---
notion_id: abc123def456
notion_url: https://www.notion.so/...
last_synced: 2024-01-20T10:30:00Z
last_edited_notion: 2024-01-20T09:15:00Z
title: My Page Title
tags:
  - tag1
  - tag2
status: In Progress
---

# Content starts here
...
```

**Markdown → Notion：**
- 根据 `notion_id` 判断是更新还是新建
- `title` 映射到 Notion 的 Title 属性
- `tags`、`status` 等映射到对应的 Notion 属性
- Markdown 内容转换为 Notion Blocks

### 状态管理

**同步状态文件（`.cache/sync-state.json`）：**
```json
{
  "last_sync": "2024-01-20T10:30:00Z",
  "page_count": 42,
  "pages": [
    {
      "id": "abc123",
      "title": "Page Title",
      "last_edited": "2024-01-20T09:15:00Z"
    }
  ]
}
```

**注意：** `.cache/` 目录应在 `.gitignore` 中

## PARA / 目录治理

**原则：** Repo（工程/系统）和 Vault（笔记）必须分区，避免工具扫描导致性能崩溃

### 物理隔离

```
~/github/liye_os/           # Git 仓库（代码、配置、文档）
~/Documents/Obsidian Vault/  # Obsidian 笔记库（知识管理）
~/Documents/liye_workspace/  # PARA 工作区（项目、领域）
~/data/                     # 大文件存储（数据集、媒体）
~/vaults/                   # 其他 Vault（备份、归档）
```

**连接方式：**
- 软链接：让旧路径指向新位置（兜底）
- 索引文件：在 repo 中维护指向外部 Vault 的索引
- 双向同步：Notion ↔ Obsidian ↔ LiYe OS（选择性）

### PARA 结构

```
~/Documents/liye_workspace/
├── 00 Inbox/              # 收集箱
├── 10 Projects/           # 活跃项目（有明确截止日期）
│   ├── amazon_q4_launch/
│   └── medical_research_xxx/
├── 20 Areas/              # 持续领域（无截止日期）
│   ├── Health/
│   ├── Finance/
│   └── Career/
├── 30 Resources/          # 参考资料
│   ├── Templates/
│   ├── Checklists/
│   └── Knowledge_Base/
└── 40 Archive/            # 已完成/暂停项目
```

**与 LiYe OS Repo 的关系：**
- **Projects** → `Projects_Engine/active/`（索引）
- **Resources** → `Skills/`（方法论版本化）
- **Archive** → `Artifacts_Vault/`（交付物归档）

### 大文件策略

**问题：** Git 不适合存储大文件（>10MB），会导致：
- Clone 时间长
- 存储空间浪费
- 协作效率低

**解决方案：**

```bash
# 1. 大文件统一进 ~/data
~/data/
├── shengcai/              # 生财有术资料
├── cancer/                # 癌症领域资料
├── amazon_reports/        # Amazon 原始报表
└── medical_papers/        # 医学文献 PDF

# 2. 在 Documents 保留软链接（兜底旧路径）
ln -s ~/data/shengcai ~/Documents/生财有术

# 3. 在 repo 中使用外部链接
# Systems/amazon-growth-os/data_external → ~/data/amazon_reports
ln -s ~/data/amazon_reports Systems/amazon-growth-os/data_external
```

**`.gitignore` 配置：**
```gitignore
# 大文件和外部数据
*.csv
*.xlsx
*.pdf
*.mp4
data_external/
uploads/
```

## 命名与可追溯性

### 命名规范

**目录命名：** 小写 + 下划线
```
✅ amazon_growth_os
✅ notion_sync
✅ medical_research_analyst

❌ Amazon-Growth-OS
❌ NotionSync
❌ Medical_Research_Analyst
```

**文件命名：** 描述性 + 日期戳（可选）
```
✅ listing_optimization_report_20240120.md
✅ keyword_analysis.py
✅ config.js

❌ report.md
❌ script1.py
❌ 文件.js
```

**Artifact 命名：** 主题 + 时间戳 + 来源
```
Artifacts_Vault/by_date/2024/01/
└── amazon_listing_optimization_20240120_claude.md

Artifacts_Vault/by_project/timo_canada_q4/
└── ppc_strategy_optimization_20240115.md
```

### 版本追踪

**Git 提交信息（Conventional Commits）：**
```bash
# 格式：<type>(<scope>): <subject>

feat(notion-sync): add diff command to compare local and Notion
fix(amazon-growth-os): correct keyword analysis ACOS calculation
docs(README): update Notion sync configuration guide
chore(gitignore): add .cache and .env to ignore list
refactor(Skills): reorganize 12 domains into 6 active domains
```

**Type 分类：**
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档变更
- `chore`: 构建/配置变更
- `refactor`: 代码重构
- `test`: 测试相关

### 交付物可追溯

**每个 Artifact 必须包含：**
```markdown
---
title: Amazon Listing Optimization Report
date: 2024-01-20
project: Timo Canada Q4
author: Claude Sonnet 4.5
source: ~/github/liye_os/Systems/amazon-growth-os
input: data/inputs/campaign_report_20240115.csv
output: reports/listing_optimization_20240120.md
---

## 背景
...

## 分析过程
...

## 结论和建议
...

## 附录
- 数据源：[路径]
- 脚本：[路径]
- 依赖版本：[列表]
```

## 架构文档索引

**核心文档：**
- `README.md` - 项目总览和快速开始
- `_meta/docs/ARCHITECTURE_CONSTITUTION.md` - 架构宪章
- `_meta/docs/FILE_SYSTEM_GOVERNANCE.md` - 文件系统治理方案
- `_meta/EVOLUTION_ROADMAP_2025.md` - 进化路线图
- `_meta/DUAL_ENGINE_SUMMARY.md` - 双引擎架构总结
- `_meta/TRIPLE_ENGINE_ARCHITECTURE.md` - 三引擎架构设计

**Skill 文档标准（10 模块）：**
```
Skills/{domain}/{skill_name}/
├── skill_definition.md       # 核心定义
├── README.md                 # 快速开始
├── methods.md                # 方法论详解
├── templates/                # 模板库
├── knowledge_base/           # 知识库
├── evolution_log.md          # 进化日志
├── collaboration_protocols.md # 协作协议
├── quality_standards.md      # 质量标准
├── automation_scripts/       # 自动化脚本
└── case_studies/             # 案例研究
```

## 性能优化建议

**避免仓库膨胀：**
1. 定期检查大文件：`find . -type f -size +10M`
2. 使用 `.gitignore` 排除运行时文件
3. 虚拟环境（venv, node_modules）不入库
4. 数据库文件（*.db, *.duckdb）不入库

**提升 Notion 同步速度：**
1. 增量同步：只处理变更的页面
2. 批量操作：合并多个 API 请求
3. 缓存：利用 `.cache/sync-state.json` 避免重复处理
4. 并发：使用 Promise.all 并行处理多个页面

**Obsidian 性能：**
1. Vault 大小控制在 <50,000 个文件
2. 避免深层嵌套（>5 层）
3. 图片/PDF 使用外部链接而非嵌入
4. 定期归档旧内容到 Archive

---

**Char Count:** ~7,000 / 15,000 ✅
