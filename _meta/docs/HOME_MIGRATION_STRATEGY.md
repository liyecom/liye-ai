# LiYe 本机文件系统迁移战略
Home Directory Migration Strategy

> **会议类型：** 多角色专家研讨会
> **参与者：** 产品专家 × 技术专家 × 顶级架构师
> **日期：** 2025-12-23
> **议题：** 本机散落文件统一纳管到 4 边界目录

---

## 📊 当前状态盘点（Data Baseline）

### 现有目录结构

```
/Users/liye/
├── github/           (2.2G, 6 items)
│   ├── liye_os/             ✅ 主 repo
│   ├── LiYe-Core/           ✅ 核心库
│   ├── TrendRadar/          ✅ 项目
│   ├── _ops/                ✅ 运维目录
│   ├── sites/               ❓ 空（应该迁移站点）
│   └── tools/               ❓ 空（应该迁移工具）
│
├── websites/         (2.2G, 14 items)
│   ├── learninggithub.com/  🔴 有 .git（应迁移）
│   ├── nuanyan.com/         🔴 有 .git（应迁移）
│   ├── ceshibao.com/        🟡 有 package.json（应初始化 git 后迁移）
│   ├── banfan.com/          ❓ 静态资产还是源码？
│   ├── liye.com/            ❓ 静态资产还是源码？
│   └── [9 other sites]      ❓ 需要逐一判断
│
├── Documents/        (大量散落)
│   ├── 生财有术/              🔴 340M+（应迁 ~/data）
│   ├── 癌症领域/              🔴 大文件（应迁 ~/data）
│   ├── 面试相关资料/           🔴 590M（应迁 ~/data）
│   ├── liye_workspace/       🟡 PARA 工作区（保留？）
│   ├── GitHub/loudmirrror/  🔴 有 .git（应迁移）
│   ├── Obsidian Vault/      🔴 应迁 ~/vaults
│   ├── CLAUDE.md            🔴 应删除（已在 repo）
│   ├── generate-para-indexes.js  🔴 应迁 ~/github/tools
│   └── [散落文件]             🔴 需要清理
│
├── tools/            (21M, 1 item)
│   └── notion-sync/         🟡 应保留？还是迁到 repo？
│
├── data/             (0B, 0 items) ❌ 空（应填充）
├── vaults/           (0B, 0 items) ❌ 空（应填充）
│
├── Home 根目录散落:
│   ├── converter.py         🔴 应迁 ~/github/tools
│   └── run_converter.sh     🔴 应迁 ~/github/tools
│
└── [其他]: agents/, supermemory/, Applications/, ...
```

### 关键数据

| 维度 | 数量 | 状态 |
|-----|------|------|
| Git repos (outside ~/github) | 3 个 | 🔴 需迁移 |
| websites/ 站点 | 14 个 | 🟡 需分类 |
| 大文件目录 (>100MB) | 6 个 | 🔴 需迁移 |
| Home 散落脚本 | 2 个 | 🔴 需迁移 |
| Documents 散落文件 | 若干 | 🔴 需清理 |
| 边界目录已用 | 2/5 | 🟡 未完成 |

---

## 🎭 多角色专家分析

### 👔 产品专家视角：用户体验与工作流

**核心关注：** 不能破坏现有工作习惯，保证平滑过渡

#### 痛点识别

1. **路径混乱导致认知负担**
   - 用户不知道文件应该放哪里
   - 同类资源分散在多个位置（如 git repos 在 ~/Documents/GitHub 和 ~/github）
   - 每次找文件需要"猜"位置

2. **工具脚本难以发现**
   - `converter.py` 放在 Home 根目录
   - `generate-para-indexes.js` 放在 Documents
   - 没有统一的"工具箱"概念

3. **习惯路径依赖**
   - 用户可能有脚本硬编码了旧路径
   - Obsidian、Notion 同步可能依赖特定路径
   - Shell 历史、别名可能指向旧路径

#### 产品建议

**P0 - 保留兼容性（软链接兜底）**
```bash
# 所有迁移都必须保留软链接
mv old_path new_path
ln -s new_path old_path
```

**P1 - 渐进式迁移**
```
Week 1: 迁移 git repos + 工具脚本（低风险）
Week 2: 迁移大文件到 ~/data（中风险）
Week 3: 迁移 Obsidian 到 ~/vaults（中风险）
Week 4: 清理 Documents 散落文件（低风险）
```

**P2 - 用户教育**
```markdown
创建 ~/NAVIGATION.md 文档：
- 我的文件在哪里？（路径对照表）
- 新文件应该放哪里？（决策树）
- 迁移后如何找回旧文件？（软链接说明）
```

**P3 - 工作流优化**
```bash
# 创建快捷命令
alias repos="cd ~/github"
alias sites="cd ~/github/sites"
alias mytools="cd ~/github/tools"
alias mydata="cd ~/data"
alias myvaults="cd ~/vaults"

# 添加到 ~/.zshrc
```

---

### 💻 技术专家视角：技术债务与性能

**核心关注：** 清理技术债务，提升系统性能和安全性

#### 技术问题

1. **存储浪费**
   ```
   websites/: 2.2G（很多可能是静态编译产物，不应版本化）
   Documents/面试相关资料: 590M（PDF/视频，不适合 Git）
   生财有术: 340M+（媒体文件，不适合 Documents）
   ```

2. **Git 仓库污染风险**
   ```
   - websites/ 如果有 node_modules、dist/ 未被 gitignore
   - 大文件可能误提交到 git
   - .DS_Store 可能散落各处
   ```

3. **符号链接链路过长**
   ```
   ~/Documents/liye_workspace/liye_os → ~/github/liye_os
   如果再加一层软链接，可能导致工具混乱
   ```

4. **重复数据**
   ```
   ~/tools/notion-sync 和 ~/github/liye_os/tools/notion-sync
   内容可能重复或不一致
   ```

#### 技术建议

**T0 - 清理脚本**
```bash
#!/bin/bash
# cleanup_tech_debt.sh

# 1. 查找并删除所有 .DS_Store
find ~ -name ".DS_Store" -type f -delete

# 2. 查找并删除 node_modules（保留 package.json）
find ~/websites -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null

# 3. 查找大文件（>50MB）
find ~/Documents ~/websites -type f -size +50M 2>/dev/null

# 4. 查找重复目录
find ~ -type d -name "liye_os" 2>/dev/null
find ~ -type d -name "notion-sync" 2>/dev/null
```

**T1 - Git 仓库健康检查**
```bash
#!/bin/bash
# check_git_health.sh

for repo in $(find ~/github ~/websites ~/Documents -name ".git" -type d 2>/dev/null | sed 's|/\.git$||'); do
  echo "=== $repo ==="
  cd "$repo"

  # 检查仓库大小
  du -sh .git

  # 检查是否有未提交变更
  git status --short

  # 检查是否有大文件
  git ls-files | xargs -I{} du -sh {} 2>/dev/null | grep -E "^[0-9]+M" | head -5

  echo ""
done
```

**T2 - 性能优化**
```bash
# 1. 大文件用软链接而非复制
mv ~/Documents/生财有术 ~/data/shengcai
ln -s ~/data/shengcai ~/Documents/生财有术

# 2. Git repos 清理历史大文件（如果有）
cd ~/github/liye_os
git filter-branch --tree-filter 'rm -rf Systems/a private repository/venv' HEAD

# 3. 压缩旧归档（可选）
tar -czf ~/data/archives/interview_materials_$(date +%Y%m%d).tar.gz ~/Documents/面试相关资料
```

**T3 - 安全加固**
```bash
# 1. 敏感文件加密
find ~/data -name "*.xlsx" -o -name "*.csv" | while read file; do
  # 可选：用 gpg 加密财务/个人数据
  # gpg -c "$file"
done

# 2. 限制目录权限
chmod 700 ~/data
chmod 700 ~/vaults

# 3. 添加 .gitignore 到所有 repos
for repo in $(find ~/github -name ".git" -type d 2>/dev/null | sed 's|/\.git$||'); do
  cd "$repo"
  if [ ! -f .gitignore ]; then
    cp ~/github/liye_os/.gitignore .gitignore
  fi
done
```

---

### 🏛️ 架构师视角：系统设计与边界划分

**核心关注：** 清晰的职责边界，长期可维护性

#### 架构原则

**1. 单一职责原则（SRP）**
```
每个目录有且仅有一个明确职责：
- ~/github:    Git 版本化的代码/文档
- ~/data:      不入库的大文件/私有数据
- ~/vaults:    笔记/知识库（Obsidian 等）
- ~/websites:  【废弃】迁移后删除
- ~/Documents: 【废弃】仅保留 Mac 系统默认用途（截图、下载等）
```

**2. 依赖倒置原则（DIP）**
```
高层策略不依赖底层路径：
- 配置文件用相对路径或环境变量
- 脚本读取 ~/.paths.config.json
- 避免硬编码绝对路径
```

**3. 开闭原则（OCP）**
```
系统对扩展开放，对修改关闭：
- 新增项目：~/github/new_project（无需修改现有结构）
- 新增站点：~/github/sites/new_site
- 新增工具：~/github/tools/new_tool
```

#### 边界定义（详细规范）

##### ~/github（Git 仓库边界）

**职责：** 所有需要版本控制的代码、配置、文档

**结构：**
```
~/github/
├── liye_os/              # 主 repo（LiYe OS 核心）
├── LiYe-Core/            # 核心库
├── TrendRadar/           # 独立项目
├── sites/                # 站点源码（有 .git + package.json）
│   ├── learninggithub.com/
│   ├── nuanyan.com/
│   ├── ceshibao.com/
│   └── [其他源码站点]
├── tools/                # 工具脚本（有 .git）
│   ├── converters/       # 转换工具
│   │   ├── converter.py
│   │   └── run_converter.sh
│   ├── notion_utils/     # Notion 相关工具
│   │   └── generate-para-indexes.js
│   └── home_migration/   # 迁移工具（本次新增）
└── _ops/                 # 运维/元操作

```

**准入标准：**
- ✅ 必须有 `.git`（版本控制）
- ✅ 主要是代码/配置/文档（非二进制大文件）
- ✅ 需要跨设备同步
- ❌ 不包含敏感数据（用 .env.example 代替 .env）
- ❌ 不包含编译产物（用 .gitignore 排除）

##### ~/data（大文件/私有数据边界）

**职责：** 不适合版本控制的大文件、私有数据、媒体资源

**结构：**
```
~/data/
├── archives/             # 归档文件
│   ├── shengcai/         # 生财有术资料
│   ├── cancer/           # 癌症领域资料
│   └── interviews/       # 面试相关资料
├── amazon_data/          # Amazon 运营数据
│   ├── reports/          # 广告报表（CSV/Excel）
│   ├── uploads/          # 上传的临时文件
│   └── databases/        # DuckDB 数据库
├── media/                # 媒体文件
│   ├── videos/
│   ├── pdfs/
│   └── images/
├── backups/              # 备份文件
│   └── [dated_backups]/
└── temp/                 # 临时文件（定期清理）
```

**准入标准：**
- ✅ 大文件（>10MB）
- ✅ 二进制文件（PDF、视频、数据库）
- ✅ 隐私敏感数据（不能 git 提交）
- ✅ 本地缓存、临时文件
- ❌ 不需要跨设备同步（或用网盘同步）

**访问方式：**
```bash
# 在 repo 中通过软链接引用
ln -s ~/data/amazon_data ~/github/liye_os/Systems/amazon_growth_os/data_external

# 配置文件中用环境变量
DATA_DIR=~/data/amazon_data
```

##### ~/vaults（笔记/知识库边界）

**职责：** Obsidian、Logseq 等知识管理工具的 Vault

**结构：**
```
~/vaults/
├── obsidian_main/        # Obsidian 主 Vault
│   ├── 00 Inbox/
│   ├── 10 Projects/
│   ├── 20 Areas/
│   ├── 30 Resources/
│   └── 40 Archive/
├── obsidian_work/        # 工作 Vault（可选）
├── logseq/               # Logseq 数据（可选）
└── .sync/                # 同步状态（Notion sync 等）
```

**准入标准：**
- ✅ Markdown 笔记
- ✅ 知识库索引
- ✅ Obsidian/Logseq 配置
- ❌ 不包含大文件（媒体用 `![[path]]` 外部链接）
- ❌ 不包含代码（代码在 ~/github）

**同步策略：**
```bash
# 1. Vault ↔ Notion（双向同步）
cd ~/github/liye_os/tools/notion-sync
npm run sync -- --vault ~/vaults/obsidian_main

# 2. Vault ↔ Git（可选，用于备份）
cd ~/vaults/obsidian_main
git init
git add .
git commit -m "backup"
```

##### ~/github/sites（站点源码子边界）

**职责：** 网站源码（需要 git + 构建工具）

**结构：**
```
~/github/sites/
├── learninggithub.com/
│   ├── .git
│   ├── package.json
│   ├── src/
│   └── dist/            # gitignored
├── nuanyan.com/
└── ceshibao.com/
```

**准入标准：**
- ✅ 有 `.git`
- ✅ 有 `package.json` 或类似构建配置
- ✅ 源码（非编译产物）
- ❌ 不包含 node_modules、dist/（gitignored）

**部署产物：**
```bash
# 编译产物不放 ~/github，而是：
# 1. 本地预览：~/github/sites/{site}/dist（gitignored）
# 2. 生产部署：直接推送到服务器或 CDN
```

##### ~/github/tools（工具脚本子边界）

**职责：** 可复用的工具脚本（可能有 git，也可能只是单文件）

**结构：**
```
~/github/tools/
├── converters/           # 格式转换工具
│   ├── .git
│   ├── converter.py
│   ├── run_converter.sh
│   └── README.md
├── notion_utils/         # Notion 相关工具
│   ├── .git
│   ├── generate-para-indexes.js
│   ├── package.json
│   └── README.md
└── home_migration/       # 本次迁移工具
    ├── .git
    ├── migrate.sh
    ├── verify.sh
    └── README.md
```

**准入标准：**
- ✅ 脚本/工具代码
- ✅ 可能被多个项目复用
- ✅ 有独立的 README
- 🟡 可选有 `.git`（如果是独立项目）

---

#### 架构决策记录（ADR）

**ADR-001: 废弃 ~/websites 和 ~/Documents 作为主要工作目录**

- **决策：** 将 ~/websites 和 ~/Documents 仅保留 Mac 系统默认用途，所有工作内容迁移到 4 边界
- **理由：**
  1. 职责混乱（代码、数据、笔记混在一起）
  2. 不符合 Unix 哲学（一事一地）
  3. 难以备份和同步（太多异构内容）
- **影响：**
  - 需要迁移 14 个站点 + 若干 git repos
  - 需要更新所有脚本的路径引用
  - 需要通知 Obsidian、Notion 同步工具

**ADR-002: ~/data 不使用 Git，使用网盘同步（可选）**

- **决策：** ~/data 中的大文件不使用 Git 版本控制
- **理由：**
  1. Git 不适合大文件（>10MB）
  2. 二进制文件 diff 无意义
  3. 隐私数据不应进入 Git 历史
- **替代方案：**
  - iCloud Drive / Dropbox / 坚果云 同步（可选）
  - 本地备份到移动硬盘
  - 用 `tar` + `gpg` 加密归档

**ADR-003: 所有迁移保留软链接兜底**

- **决策：** 迁移后在旧路径建立软链接指向新路径
- **理由：**
  1. 避免破坏现有脚本
  2. 用户习惯路径不变
  3. 渐进式适应新结构
- **过渡期：** 6 个月后可删除软链接（届时发出通知）

**ADR-004: ~/github/liye_os/tools/notion-sync 是 Canonical 版本**

- **决策：** repo 内的 `tools/notion-sync/` 是唯一真实版本，~/tools/notion-sync 作为软链接
- **理由：**
  1. 方便版本控制
  2. 与 repo 其他部分一起管理
  3. CI/CD 更容易
- **实现：**
  ```bash
  rm -rf ~/tools/notion-sync
  ln -s ~/github/liye_os/tools/notion-sync ~/tools/notion-sync
  ```

---

## 🗺️ 综合迁移方案（Consensus Plan）

经过三方专家讨论，达成共识方案如下：

### Phase 0: 准备阶段（Pre-Migration）

**目标：** 确保迁移安全，建立回滚机制

```bash
#!/bin/bash
# phase0_prepare.sh

set -euo pipefail

echo "=== Phase 0: Preparation ==="

# 1. 全量备份
BACKUP_DIR=~/Backups/home_migration_$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

echo "📦 Creating full backup to $BACKUP_DIR"
rsync -av ~/Documents/ "$BACKUP_DIR/Documents/" --exclude=".Trash"
rsync -av ~/websites/ "$BACKUP_DIR/websites/"
rsync -av ~/tools/ "$BACKUP_DIR/tools/"
cp ~/converter.py ~/run_converter.sh "$BACKUP_DIR/" 2>/dev/null || true

# 2. 创建迁移日志
MIGRATION_LOG=~/github/liye_os/_meta/logs/migration_$(date +%Y%m%d_%H%M%S).log
mkdir -p ~/github/liye_os/_meta/logs
touch "$MIGRATION_LOG"

echo "📝 Migration log: $MIGRATION_LOG"

# 3. 盘点当前状态
echo "📊 Inventory snapshot:"
find ~ -maxdepth 2 -type d 2>/dev/null > "$MIGRATION_LOG"

# 4. 检查磁盘空间
AVAILABLE=$(df -h ~ | tail -1 | awk '{print $4}')
echo "💾 Available disk space: $AVAILABLE"

if [ "$(df ~ | tail -1 | awk '{print $4}')" -lt 10485760 ]; then
  echo "⚠️  Warning: Less than 10GB free space. Consider cleanup first."
  exit 1
fi

echo "✅ Phase 0 complete. Backup at: $BACKUP_DIR"
```

---

### Phase 1: Git Repos 迁移（Week 1）

**优先级：P0** | **风险：低** | **影响：小**

```bash
#!/bin/bash
# phase1_migrate_repos.sh

set -euo pipefail

echo "=== Phase 1: Migrate Git Repositories ==="

# 1. 迁移 ~/Documents/GitHub/loudmirrror
if [ -d ~/Documents/GitHub/loudmirrror/.git ]; then
  echo "📦 Moving loudmirrror..."
  mv ~/Documents/GitHub/loudmirrror ~/github/loudmirrror
  ln -s ~/github/loudmirrror ~/Documents/GitHub/loudmirrror
  echo "  ✅ Moved + linked"
fi

# 2. 迁移 ~/websites/learninggithub.com
if [ -d ~/websites/learninggithub.com/.git ]; then
  echo "📦 Moving learninggithub.com..."
  mv ~/websites/learninggithub.com ~/github/sites/learninggithub.com
  ln -s ~/github/sites/learninggithub.com ~/websites/learninggithub.com
  echo "  ✅ Moved + linked"
fi

# 3. 迁移 ~/websites/nuanyan.com
if [ -d ~/websites/nuanyan.com/.git ]; then
  echo "📦 Moving nuanyan.com..."
  mv ~/websites/nuanyan.com ~/github/sites/nuanyan.com
  ln -s ~/github/sites/nuanyan.com ~/websites/nuanyan.com
  echo "  ✅ Moved + linked"
fi

# 4. 迁移 ~/websites/ceshibao.com (先 git init)
if [ -d ~/websites/ceshibao.com ] && [ -f ~/websites/ceshibao.com/package.json ]; then
  echo "📦 Initializing git for ceshibao.com..."
  cd ~/websites/ceshibao.com
  [ ! -d .git ] && git init && git add . && git commit -m "Initial commit: ceshibao.com source code"

  echo "📦 Moving ceshibao.com..."
  cd ~
  mv ~/websites/ceshibao.com ~/github/sites/ceshibao.com
  ln -s ~/github/sites/ceshibao.com ~/websites/ceshibao.com
  echo "  ✅ Moved + linked"
fi

echo "✅ Phase 1 complete"
```

---

### Phase 2: 工具脚本迁移（Week 1）

**优先级：P0** | **风险：低** | **影响：小**

```bash
#!/bin/bash
# phase2_migrate_tools.sh

set -euo pipefail

echo "=== Phase 2: Migrate Tool Scripts ==="

# 1. 创建 ~/github/tools 子目录
mkdir -p ~/github/tools/converters
mkdir -p ~/github/tools/notion_utils
mkdir -p ~/github/tools/home_migration

# 2. 迁移 converter.py + run_converter.sh
if [ -f ~/converter.py ]; then
  echo "🔧 Moving converter.py..."
  mv ~/converter.py ~/github/tools/converters/converter.py
  ln -s ~/github/tools/converters/converter.py ~/converter.py
fi

if [ -f ~/run_converter.sh ]; then
  echo "🔧 Moving run_converter.sh..."
  mv ~/run_converter.sh ~/github/tools/converters/run_converter.sh
  chmod +x ~/github/tools/converters/run_converter.sh
  ln -s ~/github/tools/converters/run_converter.sh ~/run_converter.sh
fi

# 3. 迁移 Documents/generate-para-indexes.js
if [ -f ~/Documents/generate-para-indexes.js ]; then
  echo "🔧 Moving generate-para-indexes.js..."
  mv ~/Documents/generate-para-indexes.js ~/github/tools/notion_utils/generate-para-indexes.js
  ln -s ~/github/tools/notion_utils/generate-para-indexes.js ~/Documents/generate-para-indexes.js
fi

# 4. 初始化 git repos（如果还没有）
cd ~/github/tools/converters
[ ! -d .git ] && git init && git add . && git commit -m "feat: add converter tools"

cd ~/github/tools/notion_utils
[ ! -d .git ] && git init && git add . && git commit -m "feat: add Notion utilities"

# 5. 软链接 ~/tools/notion-sync 到 repo
if [ -d ~/tools/notion-sync ]; then
  echo "🔧 Linking notion-sync to repo canonical version..."
  rm -rf ~/tools/notion-sync
  ln -s ~/github/liye_os/tools/notion-sync ~/tools/notion-sync
fi

echo "✅ Phase 2 complete"
```

---

### Phase 3: 大文件迁移到 ~/data（Week 2）

**优先级：P1** | **风险：中** | **影响：中**

```bash
#!/bin/bash
# phase3_migrate_data.sh

set -euo pipefail

echo "=== Phase 3: Migrate Large Files to ~/data ==="

# 1. 创建 ~/data 结构
mkdir -p ~/data/archives/{shengcai,cancer,interviews,professional_growth}
mkdir -p ~/data/amazon_data/{reports,uploads,databases}
mkdir -p ~/data/media/{pdfs,videos,images}
mkdir -p ~/data/backups
mkdir -p ~/data/temp

# 2. 迁移生财有术（340M+）
if [ -d ~/Documents/生财有术 ]; then
  echo "💾 Moving 生财有术..."
  mv ~/Documents/生财有术 ~/data/archives/shengcai
  ln -s ~/data/archives/shengcai ~/Documents/生财有术
  echo "  ✅ Moved + linked ($(du -sh ~/data/archives/shengcai | awk '{print $1}'))"
fi

# 3. 迁移癌症领域
if [ -d ~/Documents/癌症领域 ]; then
  echo "💾 Moving 癌症领域..."
  mv ~/Documents/癌症领域 ~/data/archives/cancer
  ln -s ~/data/archives/cancer ~/Documents/癌症领域
  echo "  ✅ Moved + linked"
fi

# 4. 迁移面试相关资料（590M）
if [ -d ~/Documents/面试相关资料 ]; then
  echo "💾 Moving 面试相关资料..."
  mv ~/Documents/面试相关资料 ~/data/archives/interviews
  ln -s ~/data/archives/interviews ~/Documents/面试相关资料
  echo "  ✅ Moved + linked"
fi

# 5. 迁移职场成长服务相关行业研报（327M）
if [ -d ~/Documents/职场成长服务相关行业研报 ]; then
  echo "💾 Moving 职场成长服务相关行业研报..."
  mv ~/Documents/职场成长服务相关行业研报 ~/data/archives/professional_growth
  ln -s ~/data/archives/professional_growth ~/Documents/职场成长服务相关行业研报
  echo "  ✅ Moved + linked"
fi

# 6. 迁移其他大文件目录（如 hangye.com.cn行业研报）
if [ -d ~/Documents/hangye.com.cn行业研报 ]; then
  echo "💾 Moving hangye.com.cn行业研报..."
  mv ~/Documents/hangye.com.cn行业研报 ~/data/archives/hangye_reports
  ln -s ~/data/archives/hangye_reports ~/Documents/hangye.com.cn行业研报
  echo "  ✅ Moved + linked"
fi

# 7. 设置权限（隐私保护）
chmod 700 ~/data
chmod 700 ~/data/archives
chmod 700 ~/data/amazon_data

echo "✅ Phase 3 complete"
echo "📊 ~/data size: $(du -sh ~/data | awk '{print $1}')"
```

---

### Phase 4: Obsidian Vault 迁移（Week 3）

**优先级：P1** | **风险：中** | **影响：中**

```bash
#!/bin/bash
# phase4_migrate_vaults.sh

set -euo pipefail

echo "=== Phase 4: Migrate Obsidian Vaults ==="

# 1. 创建 ~/vaults 结构
mkdir -p ~/vaults/obsidian_main
mkdir -p ~/vaults/.sync

# 2. 迁移 Obsidian Vault（如果存在）
if [ -d ~/Documents/Obsidian\ Vault ]; then
  echo "📓 Moving Obsidian Vault..."

  # 先检查 Obsidian 是否正在运行
  if pgrep -x "Obsidian" > /dev/null; then
    echo "⚠️  Obsidian is running. Please close it first."
    echo "   Then run this script again."
    exit 1
  fi

  mv ~/Documents/Obsidian\ Vault ~/vaults/obsidian_main
  ln -s ~/vaults/obsidian_main ~/Documents/Obsidian\ Vault
  echo "  ✅ Moved + linked"

  # 更新 Obsidian 配置（如果有）
  OBSIDIAN_CONFIG=~/Library/Application\ Support/obsidian/obsidian.json
  if [ -f "$OBSIDIAN_CONFIG" ]; then
    echo "  📝 Updating Obsidian config..."
    # 备份原配置
    cp "$OBSIDIAN_CONFIG" "$OBSIDIAN_CONFIG.backup"
    # 替换路径（简单字符串替换，可能需要手动调整）
    sed -i '' 's|Documents/Obsidian Vault|vaults/obsidian_main|g' "$OBSIDIAN_CONFIG"
  fi
fi

# 3. 迁移 liye_workspace（PARA 工作区）
# 注意：这个可能需要保留在 Documents，因为它可能包含非 Obsidian 的文件
# 暂时不迁移，仅做记录
if [ -d ~/Documents/liye_workspace ]; then
  echo "⚠️  ~/Documents/liye_workspace detected"
  echo "  This contains PARA structure and may have mixed content."
  echo "  Skipping for now. Review manually if needed."
fi

# 4. 设置权限
chmod 700 ~/vaults

echo "✅ Phase 4 complete"
echo "📊 ~/vaults size: $(du -sh ~/vaults | awk '{print $1}')"
```

---

### Phase 5: 清理 Documents 散落文件（Week 4）

**优先级：P2** | **风险：低** | **影响：低**

```bash
#!/bin/bash
# phase5_cleanup_documents.sh

set -euo pipefail

echo "=== Phase 5: Cleanup Documents ==="

# 1. 删除已迁移到 repo 的重复文件
if [ -f ~/Documents/CLAUDE.md ]; then
  echo "🗑️  Removing duplicate CLAUDE.md..."
  rm ~/Documents/CLAUDE.md
fi

if [ -f ~/Documents/generate-para-indexes.js ] && [ -L ~/Documents/generate-para-indexes.js ]; then
  echo "  ℹ️  generate-para-indexes.js is already a symlink (OK)"
fi

# 2. 删除临时/测试文件
if [ -f ~/Documents/测试语义搜索.html ]; then
  echo "🗑️  Removing test files..."
  rm ~/Documents/测试语义搜索.html
fi

if [ -f ~/Documents/cleanup_notion_files.sh ]; then
  echo "🗑️  Removing old cleanup script..."
  rm ~/Documents/cleanup_notion_files.sh
fi

# 3. 删除迁移说明（已归档到 repo）
if [ -f ~/Documents/MIGRATION_NOTES.md ]; then
  echo "🗑️  Removing old migration notes..."
  rm ~/Documents/MIGRATION_NOTES.md
fi

# 4. 清理空目录
find ~/Documents -type d -empty -delete 2>/dev/null || true

# 5. 生成 Documents 清理报告
echo ""
echo "📊 Documents cleanup summary:"
echo "  Remaining top-level items:"
ls ~/Documents | head -20

echo ""
echo "✅ Phase 5 complete"
```

---

### Phase 6: 验证与收尾（Week 4）

**优先级：P0** | **风险：无** | **影响：无**

```bash
#!/bin/bash
# phase6_verify.sh

set -euo pipefail

echo "=== Phase 6: Verification ==="

# 1. 检查 4 个边界目录
echo "📂 Boundary directories check:"
for dir in github data vaults; do
  if [ -d ~/$dir ]; then
    size=$(du -sh ~/$dir 2>/dev/null | awk '{print $1}')
    count=$(find ~/$dir -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | xargs)
    echo "  ✅ ~/$dir: $size, $count items"
  else
    echo "  ❌ ~/$dir: NOT FOUND"
  fi
done

# 2. 检查所有软链接有效性
echo ""
echo "🔗 Symlinks validation:"
find ~ -maxdepth 3 -type l 2>/dev/null | while read link; do
  if [ ! -e "$link" ]; then
    echo "  ❌ Broken: $link"
  fi
done | head -20

# 3. 检查 git repos 健康
echo ""
echo "📦 Git repositories health:"
for repo in $(find ~/github -name ".git" -type d 2>/dev/null | sed 's|/\.git$||'); do
  cd "$repo"
  status=$(git status --short 2>/dev/null | wc -l | xargs)
  size=$(du -sh .git 2>/dev/null | awk '{print $1}')
  echo "  $(basename $repo): .git=$size, uncommitted=$status"
done

# 4. 生成最终报告
REPORT=~/github/liye_os/_meta/logs/migration_final_report_$(date +%Y%m%d).md
cat > "$REPORT" <<EOF
# Home Migration Final Report

**Date:** $(date +%Y-%m-%d)

## Migration Summary

### Boundary Directories
- ~/github: $(du -sh ~/github 2>/dev/null | awk '{print $1}')
- ~/data: $(du -sh ~/data 2>/dev/null | awk '{print $1}')
- ~/vaults: $(du -sh ~/vaults 2>/dev/null | awk '{print $1}')

### Git Repositories
$(find ~/github -name ".git" -type d 2>/dev/null | sed 's|/\.git$||' | sed 's|/Users/liye/||')

### Large Directories in ~/data
$(du -sh ~/data/*/ 2>/dev/null)

### Symlinks Created
$(find ~ -maxdepth 3 -type l 2>/dev/null | wc -l) symlinks

## Next Steps
- [ ] Test all scripts with new paths
- [ ] Update Obsidian settings (if needed)
- [ ] Update Notion sync config (if needed)
- [ ] Monitor for 2 weeks
- [ ] Consider removing old symlinks after 6 months

## Rollback Instructions
Backup location: ~/Backups/home_migration_YYYYMMDD_HHMMSS/
EOF

echo ""
echo "✅ Phase 6 complete"
echo "📄 Final report: $REPORT"
```

---

## 📋 执行检查清单（Execution Checklist）

### Pre-Flight（执行前）

- [ ] 阅读完整方案文档
- [ ] 确保磁盘空间 >10GB
- [ ] 关闭 Obsidian、Notion Desktop
- [ ] 关闭所有使用 ~/Documents、~/websites 的应用
- [ ] 创建全量备份（Phase 0）

### Phase 1-2（Week 1）

- [ ] 执行 Phase 1（Git repos 迁移）
- [ ] 测试迁移后的 repos 可正常 git pull/push
- [ ] 执行 Phase 2（工具脚本迁移）
- [ ] 测试 `converter.py`、`run_converter.sh` 可正常运行
- [ ] 测试 `generate-para-indexes.js` 可正常运行

### Phase 3-4（Week 2-3）

- [ ] 执行 Phase 3（大文件迁移到 ~/data）
- [ ] 验证软链接有效（`ls -la ~/Documents/生财有术`）
- [ ] 执行 Phase 4（Obsidian Vault 迁移）
- [ ] 打开 Obsidian，确认 Vault 路径正确
- [ ] 测试 Notion sync 仍可正常工作

### Phase 5-6（Week 4）

- [ ] 执行 Phase 5（清理 Documents）
- [ ] 执行 Phase 6（验证）
- [ ] 阅读最终报告
- [ ] 更新 `~/.zshrc` 添加快捷命令（见"产品建议 P3"）
- [ ] 创建 `~/NAVIGATION.md`（路径对照表）

### Post-Migration（迁移后）

- [ ] 监控 2 周，确保无异常
- [ ] 更新所有脚本中的硬编码路径
- [ ] 通知协作者（如果有）新的目录结构
- [ ] 6 个月后考虑删除旧软链接

---

## 🚨 风险与应对

| 风险 | 概率 | 影响 | 应对措施 |
|-----|------|------|---------|
| 软链接失效 | 低 | 中 | 每个 Phase 后运行验证脚本 |
| 路径硬编码导致脚本失败 | 中 | 中 | 保留软链接兜底 |
| Obsidian 配置损坏 | 低 | 高 | 备份 obsidian.json |
| 大文件迁移时磁盘满 | 低 | 高 | Pre-Flight 检查磁盘空间 |
| Git 仓库损坏 | 极低 | 高 | 先备份，迁移后验证 git status |

---

## 📚 附录

### A. 快捷命令（添加到 ~/.zshrc）

```bash
# LiYe OS 边界目录导航
alias repos="cd ~/github"
alias sites="cd ~/github/sites"
alias mytools="cd ~/github/tools"
alias mydata="cd ~/data"
alias myvaults="cd ~/vaults"
alias liyeos="cd ~/github/liye_os"

# 常用操作
alias ll="ls -la"
alias tree="tree -L 2"
alias gitst="git status"

# 迁移相关
alias migration-verify="bash ~/github/liye_os/_meta/scripts/phase6_verify.sh"
```

### B. NAVIGATION.md 模板

```markdown
# LiYe 文件导航指南

## 我的文件在哪里？

| 旧路径 | 新路径 | 类型 |
|-------|--------|------|
| ~/Documents/GitHub/loudmirrror | ~/github/loudmirrror | Git Repo |
| ~/websites/learninggithub.com | ~/github/sites/learninggithub.com | Git Repo |
| ~/converter.py | ~/github/tools/converters/converter.py | 脚本 |
| ~/Documents/生财有术 | ~/data/archives/shengcai | 数据 |
| ~/Documents/Obsidian Vault | ~/vaults/obsidian_main | Vault |

## 新文件应该放哪里？

**决策树：**
1. 是代码/配置吗？→ ~/github
2. 是大文件/数据吗？→ ~/data
3. 是笔记吗？→ ~/vaults
4. 是临时文件吗？→ ~/data/temp

## 常用命令

```bash
# 导航
repos         # → ~/github
sites         # → ~/github/sites
mytools       # → ~/github/tools
mydata        # → ~/data
myvaults      # → ~/vaults

# 验证迁移
migration-verify
```
```

### C. 路径配置文件（~/.paths.config.json）

```json
{
  "version": "1.0",
  "boundaries": {
    "github": "~/github",
    "github_sites": "~/github/sites",
    "github_tools": "~/github/tools",
    "data": "~/data",
    "vaults": "~/vaults"
  },
  "repos": {
    "liye_os": "~/github/liye_os",
    "liye_core": "~/github/LiYe-Core"
  },
  "vaults": {
    "obsidian_main": "~/vaults/obsidian_main"
  },
  "data": {
    "amazon": "~/data/amazon_data",
    "archives": "~/data/archives",
    "backups": "~/data/backups"
  },
  "deprecated": {
    "websites": "~/websites (USE ~/github/sites INSTEAD)",
    "documents_work": "~/Documents (USE boundary dirs INSTEAD)"
  }
}
```

---

## ✅ 决策与审批

**专家组成员：**
- 产品专家：已审阅 ✅
- 技术专家：已审阅 ✅
- 架构师：已审阅 ✅

**一致决议：**
- ✅ 采用 4 边界目录结构（~/github, ~/data, ~/vaults + ~/tools 废弃）
- ✅ 所有迁移保留软链接兜底
- ✅ 分 6 个 Phase 渐进式执行（4 周完成）
- ✅ 废弃 ~/websites 和 ~/Documents 作为主要工作目录

**批准人：** LiYe
**批准日期：** _待定_

---

**下一步行动：**
1. 审阅本方案
2. 执行 Phase 0 备份
3. 按周执行 Phase 1-6
4. 监控和调整

**文档维护：**
本文档将随着迁移进度更新，最终版本将作为 LiYe OS 架构文档的一部分永久保留。
