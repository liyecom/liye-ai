# LiYe OS 文件系统治理方案
File System Governance Plan

> Version: 1.0
> Date: 2025-12-23
> Status: Proposed

## 执行摘要 Executive Summary

基于对当前文件系统的全面分析，LiYe OS 存在以下核心问题：

**关键发现：**
- ✅ **架构设计优秀**：清晰的三引擎架构、10模块标准、完善的文档
- ⚠️ **执行差距**：规划了 24+ 技能，实际只有 3-4 个活跃
- 🔴 **技术债务**：1.7GB 虚拟环境被 Git 追踪，数据文件未忽略
- 📊 **组织混乱**：空目录过多、命名不一致、重复结构

**本方案提供：**
1. 立即清理行动计划（P0 优先级）
2. 中期重组路线图（P1-P2）
3. 长期治理标准（持续维护）

---

## 第一部分：当前状态诊断

### 1.1 关键指标

| 指标 | 当前值 | 健康值 | 状态 |
|-----|--------|--------|------|
| Git 仓库大小 | ~1.8GB | <100MB | 🔴 严重超标 |
| 空目录数量 | 17+ | 0-3 | 🔴 过度规划 |
| 活跃 Skill 数量 | 3-4 | 8-12 | 🟡 早期阶段 |
| 命名一致性 | 70% | 95%+ | 🟡 需改进 |
| 文档完整性 | 90% | 90%+ | 🟢 优秀 |
| .DS_Store 文件 | 14 | 0 | 🔴 未清理 |

### 1.2 问题分类

#### P0 - 关键问题（立即处理）

1. **虚拟环境污染 Git**
   - 位置：`Systems/amazon-growth-os/venv/`
   - 大小：1.7GB
   - 影响：Clone 时间长、存储浪费、协作困难
   - 根因：`.gitignore` 添加晚于 `venv/` 提交

2. **macOS 系统文件追踪**
   - 文件：14 个 `.DS_Store`
   - 影响：仓库污染、跨平台协作问题
   - 根因：未在第一次提交时配置好 `.gitignore`

3. **数据文件泄漏风险**
   - 位置：`uploads/` 目录下 65 个 CSV/Excel
   - 影响：可能包含敏感数据、仓库膨胀
   - 根因：未严格执行数据隔离策略

#### P1 - 重要问题（本周处理）

4. **重复的 uploads 目录**
   - `Skills/02_Operation_Intelligence/uploads/`
   - `Systems/amazon-growth-os/uploads/`
   - 影响：数据分散、不明确的职责划分

5. **命名不一致**
   - 混用下划线和连字符：`Medical_Research_Analyst` vs `amazon-keyword-analysis`
   - 影响：代码引用混乱、用户体验差

6. **语言混用**
   - `架构设计.md` vs `README.md`
   - `SOP_操作手册.md` vs English docs
   - 影响：国际化协作困难

#### P2 - 中等问题（本月处理）

7. **过度规划的空目录**
   - 17+ 个空目录（12 个 Skill 域、Agents、Crews、Glossaries 等）
   - 影响：导航困难、误导用户期望

8. **模板文件重复**
   - `_meta/skill_template/skill_definition_template.md`
   - `Skills/99_Incubator/test-skill/skill_definition_template.md`

9. **Systems vs Skills 边界模糊**
   - `amazon-growth-os` 既在 Systems 又有 skill_definition
   - 不清楚两者的区别和关联

---

## 第二部分：立即清理行动计划

### 2.1 Git 仓库清理（P0）

#### 步骤 1：移除虚拟环境

```bash
cd ~/github/liye_os/Systems/amazon-growth-os

# 1. 备份当前 venv（如果需要）
tar -czf ~/Downloads/liye_os_venv_backup_$(date +%Y%m%d).tar.gz venv/

# 2. 从 Git 历史中彻底删除
git filter-branch --force --index-filter \
  'git rm -rf --cached --ignore-unmatch Systems/amazon-growth-os/venv' \
  --prune-empty --tag-name-filter cat -- --all

# 或使用 BFG Repo-Cleaner（更快）
# brew install bfg
# bfg --delete-folders venv --no-blob-protection .

# 3. 强制推送（警告：会重写历史）
git push origin --force --all

# 4. 清理本地引用
git for-each-ref --format='delete %(refname)' refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5. 确保 .gitignore 正确
echo "venv/" >> .gitignore
echo ".venv/" >> .gitignore
```

**风险评估：**
- 🔴 **高风险**：重写 Git 历史会破坏现有 clone
- ✅ **缓解措施**：先在备份分支测试、通知所有协作者重新 clone

#### 步骤 2：清理 .DS_Store

```bash
cd ~/github/liye_os

# 1. 找出所有 .DS_Store
find . -name ".DS_Store" -type f

# 2. 从 Git 中移除
find . -name ".DS_Store" -type f -delete
git add -A
git commit -m "chore: remove all .DS_Store files from repository"

# 3. 确保 .gitignore 包含
echo ".DS_Store" >> .gitignore
echo "**/.DS_Store" >> .gitignore

# 4. 配置全局忽略（推荐）
echo ".DS_Store" >> ~/.gitignore_global
git config --global core.excludesfile ~/.gitignore_global
```

#### 步骤 3：审查和隔离数据文件

```bash
cd ~/github/liye_os

# 1. 列出所有数据文件
find . -type f \( -name "*.csv" -o -name "*.xlsx" -o -name "*.xls" \) | grep -v node_modules

# 2. 移动到 Git 外部位置
mkdir -p ~/Documents/liye_workspace/LiYe_OS_Data/
mv Systems/amazon-growth-os/uploads/*.csv ~/Documents/liye_workspace/LiYe_OS_Data/amazon_uploads/
mv Skills/02_Operation_Intelligence/uploads/*.csv ~/Documents/liye_workspace/LiYe_OS_Data/operation_uploads/

# 3. 创建软链接（如果需要本地访问）
ln -s ~/Documents/liye_workspace/LiYe_OS_Data/amazon_uploads Systems/amazon-growth-os/data_external
ln -s ~/Documents/liye_workspace/LiYe_OS_Data/operation_uploads Skills/02_Operation_Intelligence/data_external

# 4. 更新 .gitignore
cat >> .gitignore << 'EOF'

# Data files
*.csv
*.xlsx
*.xls
*.db
*.sqlite
*.duckdb
data_external/
uploads/
EOF

# 5. 提交变更
git add .gitignore
git commit -m "chore: move data files out of repository and update .gitignore"
```

### 2.2 预期效果

执行完成后：
- ✅ Git 仓库大小：1.8GB → <100MB（减少 95%）
- ✅ Clone 时间：5-10 分钟 → <30 秒
- ✅ 数据隐私：敏感数据移出版本控制
- ✅ 跨平台：移除 macOS 特定文件

---

## 第三部分：目录结构重组方案

### 3.1 现状 vs 目标对比

#### 当前结构（存在问题）

```
liye_os/
├── _meta/                    # ✅ 元数据 - 保留
├── Agents/                   # 🔴 空目录 - 移除或合并
├── Artifacts_Vault/          # 🟡 设计好但未使用 - 激活或简化
├── Crews/                    # 🔴 空目录 - 移除或合并
├── Extensions/               # 🟡 子目录都空 - 简化
│   ├── claude-skills/        # 空
│   └── mcp-servers/          # 空
├── Glossaries/               # 🔴 空目录 - 合并到 _meta
├── Projects_Engine/          # 🟡 设计好但未使用 - 简化
├── Skills/                   # ✅ 核心模块 - 重组
│   ├── 01-12 domains/        # 🔴 10 个空域 - 收缩
│   └── 99_Incubator/         # ✅ 保留
├── Systems/                  # ✅ 可执行系统 - 标准化
└── tools/                    # 🟡 notion-sync 空 - 激活或移动
```

#### 提议结构（精简务实）

```
liye_os/
├── _meta/                          # 元数据和治理文档
│   ├── docs/                       # 架构文档（已有）
│   │   ├── ARCHITECTURE_CONSTITUTION.md
│   │   ├── FILE_SYSTEM_GOVERNANCE.md
│   │   └── NAMING_CONVENTIONS.md
│   ├── templates/                  # 统一的模板库
│   │   ├── skill_template/
│   │   ├── system_template/
│   │   └── project_template/
│   └── glossary/                   # 术语表（合并原 Glossaries/）
│       └── terminology.md
│
├── skills/                         # 重命名为小写，精简域分类
│   ├── research/                   # 合并 01_Research + 02_Analysis
│   │   └── amazon_keyword_analysis/
│   ├── medical/                    # 保留 05_Medical
│   │   └── medical_research_analyst/
│   ├── technical/                  # 保留 06_Technical
│   │   ├── crewai_framework/
│   │   └── agent_design/
│   ├── operations/                 # 合并 02_Operation + 04_Business
│   ├── creative/                   # 保留 03_Creative（未来）
│   ├── data_science/               # 保留 07_Data（未来）
│   └── incubator/                  # 实验性技能
│       └── test_skill/
│
├── systems/                        # 可执行系统（小写）
│   ├── amazon_growth_os/           # 标准化命名
│   │   ├── src/
│   │   ├── config/
│   │   ├── scripts/
│   │   ├── .env.example
│   │   ├── requirements.txt
│   │   └── README.md
│   └── notion_sync/                # 从 tools/ 迁移
│       └── (当前 tools/notion-sync/ 内容)
│
├── projects/                       # 简化 Projects_Engine
│   ├── active/
│   ├── archived/
│   └── templates/
│
├── artifacts/                      # 简化 Artifacts_Vault
│   ├── by_date/
│   └── by_skill/
│
├── extensions/                     # 保留但重组
│   ├── claude_skills/              # 标准化命名
│   └── mcp_servers/                # 标准化命名
│
└── [根目录文件]
    ├── README.md
    ├── .gitignore
    └── CHANGELOG.md
```

### 3.2 命名标准规范

#### 规则 1：统一使用小写 + 下划线

```
✅ GOOD:
- skills/medical/medical_research_analyst/
- systems/amazon_growth_os/
- skills/technical/crewai_framework/

❌ BAD:
- Skills/05_Medical_Intelligence/Medical_Research_Analyst/
- Systems/amazon-growth-os/
- Skills/06_Technical_Development/CrewAI_Multi_Agent_Framework/
```

**理由：**
- Python 包命名规范（PEP 8）
- 避免大小写敏感文件系统问题
- 提高 CLI 输入效率

#### 规则 2：语言标准化

```
✅ 主文档：英文为主
✅ 内部笔记：中英双语或纯中文（放在 docs/cn/ 子目录）
✅ 命名：纯英文
✅ 注释：可用中文但关键 API 用英文

文件命名示例：
- README.md                    # 英文主文档
- README_CN.md                 # 中文翻译
- docs/architecture.md         # 英文
- docs/cn/架构设计.md          # 中文版本
```

#### 规则 3：Skill vs System 区分

| 维度 | Skills | Systems |
|-----|--------|---------|
| 定义 | 方法论、知识库、最佳实践 | 可执行代码、自动化系统 |
| 内容 | Markdown 文档、模板、案例 | Python/JS 代码、配置、数据库 |
| 结构 | 10 模块标准 | 自定义代码结构 |
| 示例 | `medical_research_analyst` | `amazon_growth_os` |
| 进化 | Skill → Agent → System | - |

**迁移路径：**
```
1. 新 Skill：在 skills/ 下创建文档
2. 成熟 Skill：添加自动化脚本（仍在 skills/）
3. 独立 System：迁移到 systems/（有完整代码库）
```

### 3.3 迁移脚本

```bash
#!/bin/bash
# migrate_structure.sh - LiYe OS 文件系统重组脚本

set -euo pipefail

REPO_ROOT="$HOME/github/liye_os"
BACKUP_DIR="$HOME/github/liye_os_backup_$(date +%Y%m%d_%H%M%S)"

echo "🔄 开始 LiYe OS 文件系统重组..."

# 0. 创建备份
echo "📦 创建备份到 $BACKUP_DIR"
cp -R "$REPO_ROOT" "$BACKUP_DIR"

cd "$REPO_ROOT"

# 1. 重命名顶层目录为小写
echo "📝 重命名顶层目录..."
git mv Skills skills 2>/dev/null || mv Skills skills
git mv Systems systems 2>/dev/null || mv Systems systems
git mv Projects_Engine projects 2>/dev/null || mv Projects_Engine projects
git mv Artifacts_Vault artifacts 2>/dev/null || mv Artifacts_Vault artifacts
git mv Extensions extensions 2>/dev/null || mv Extensions extensions

# 2. 合并 Glossaries 到 _meta
echo "📚 合并 Glossaries..."
mkdir -p _meta/glossary
if [ -d "Glossaries" ]; then
  mv Glossaries/* _meta/glossary/ 2>/dev/null || true
  rmdir Glossaries
fi

# 3. 移动 tools/notion-sync 到 systems/
echo "🔧 迁移 notion-sync..."
if [ -d "tools/notion-sync" ]; then
  mkdir -p systems/notion_sync
  mv tools/notion-sync/* systems/notion_sync/
  rmdir tools/notion-sync
  rmdir tools 2>/dev/null || true
fi

# 4. 重命名 amazon-growth-os
echo "🏭 标准化 amazon_growth_os 命名..."
if [ -d "systems/amazon-growth-os" ]; then
  git mv systems/amazon-growth-os systems/amazon_growth_os
fi

# 5. 精简 Skills 域分类
echo "🎯 重组 Skills 域..."
cd skills

# 创建新的域结构
mkdir -p research medical technical operations creative data_science incubator

# 迁移现有 Skills
[ -d "02_Operation_Intelligence/amazon-keyword-analysis" ] && \
  git mv 02_Operation_Intelligence/amazon-keyword-analysis research/amazon_keyword_analysis

[ -d "05_Medical_Intelligence/Medical_Research_Analyst" ] && \
  git mv 05_Medical_Intelligence/Medical_Research_Analyst medical/medical_research_analyst

[ -d "06_Technical_Development/CrewAI_Multi_Agent_Framework" ] && \
  git mv 06_Technical_Development/CrewAI_Multi_Agent_Framework technical/crewai_framework

[ -d "06_Technical_Development/Intelligent_Agent_Design" ] && \
  git mv 06_Technical_Development/Intelligent_Agent_Design technical/agent_design

[ -d "99_Incubator/test-skill" ] && \
  git mv 99_Incubator/test-skill incubator/test_skill

# 删除空域目录
for dir in 01_* 02_* 03_* 04_* 05_* 06_* 07_* 08_* 09_* 10_* 11_* 12_* 99_*; do
  if [ -d "$dir" ] && [ -z "$(ls -A $dir)" ]; then
    rmdir "$dir"
  fi
done

cd "$REPO_ROOT"

# 6. 删除空的顶层目录
echo "🗑️  移除空目录..."
for dir in Agents Crews; do
  if [ -d "$dir" ] && [ -z "$(ls -A $dir)" ]; then
    rmdir "$dir"
  fi
done

# 7. 更新 .gitignore
echo "📋 更新 .gitignore..."
cat >> .gitignore << 'EOF'

# === LiYe OS Governance Standards ===

# Python virtual environments
venv/
.venv/
env/
ENV/

# Data files
*.csv
*.xlsx
*.xls
*.db
*.sqlite
*.duckdb
data_external/
uploads/

# macOS
.DS_Store
.AppleDouble
.LSOverride

# IDE
.vscode/
.idea/
*.swp
*.swo

# Logs
*.log
logs/

# Cache
__pycache__/
*.pyc
.cache/
.pytest_cache/

# Notion sync cache
systems/notion_sync/.cache/
EOF

# 8. 提交变更
echo "💾 提交重组变更..."
git add -A
git commit -m "refactor: reorganize file system according to governance plan

- Rename top-level directories to lowercase
- Consolidate 12 skill domains into 6 active domains
- Move notion-sync from tools/ to systems/
- Standardize naming (underscores, lowercase)
- Merge Glossaries into _meta/glossary
- Remove empty planned directories
- Update .gitignore with comprehensive rules

See _meta/docs/FILE_SYSTEM_GOVERNANCE.md for details"

echo "✅ 重组完成！"
echo "📊 变更摘要："
echo "   - 删除了 $(find $BACKUP_DIR -type d -empty | wc -l) 个空目录"
echo "   - 标准化了所有命名"
echo "   - 备份保存在: $BACKUP_DIR"
echo ""
echo "🔍 请运行以下命令检查："
echo "   git status"
echo "   git log -1"
echo "   tree -L 2 -d"
```

---

## 第四部分：长期治理标准

### 4.1 新增内容检查清单

创建新 Skill 时：
```markdown
- [ ] 放置在正确的域目录下（6 个域之一）
- [ ] 使用小写+下划线命名
- [ ] 包含完整的 10 模块结构
- [ ] 有 skill_definition.md
- [ ] README.md 使用英文
- [ ] 数据文件放在外部 data_external/
- [ ] 添加 evolution_log.md
```

创建新 System 时：
```markdown
- [ ] 放在 systems/ 目录
- [ ] 使用小写+下划线命名
- [ ] 包含 README.md
- [ ] 包含 .env.example（不含敏感信息）
- [ ] requirements.txt 或 package.json
- [ ] 虚拟环境已在 .gitignore
- [ ] 数据目录已排除
```

### 4.2 Git Hooks（自动化检查）

创建 `.git/hooks/pre-commit`：

```bash
#!/bin/bash
# LiYe OS Pre-commit Hook

echo "🔍 LiYe OS 提交前检查..."

# 检查 1：禁止提交 .DS_Store
if git diff --cached --name-only | grep -q "\.DS_Store"; then
  echo "❌ 错误：尝试提交 .DS_Store 文件"
  echo "   运行: find . -name .DS_Store -delete"
  exit 1
fi

# 检查 2：禁止提交大文件（>10MB）
large_files=$(git diff --cached --name-only | while read file; do
  size=$(wc -c < "$file" 2>/dev/null || echo 0)
  if [ $size -gt 10485760 ]; then
    echo "$file ($(numfmt --to=iec-i --suffix=B $size))"
  fi
done)

if [ -n "$large_files" ]; then
  echo "❌ 错误：尝试提交大文件（>10MB）："
  echo "$large_files"
  echo "   请使用 Git LFS 或移到外部存储"
  exit 1
fi

# 检查 3：禁止提交数据文件
if git diff --cached --name-only | grep -E "\.(csv|xlsx|xls|db|sqlite)$"; then
  echo "❌ 错误：尝试提交数据文件"
  echo "   数据文件应放在 data_external/ 并软链接"
  exit 1
fi

# 检查 4：禁止提交 venv
if git diff --cached --name-only | grep -E "venv/|\.venv/"; then
  echo "❌ 错误：尝试提交虚拟环境"
  echo "   请确保 .gitignore 包含 venv/ 和 .venv/"
  exit 1
fi

echo "✅ 所有检查通过"
exit 0
```

激活 Hook：
```bash
chmod +x .git/hooks/pre-commit
```

### 4.3 定期维护任务

**每周：**
```bash
# 检查空目录
find . -type d -empty

# 检查大文件
find . -type f -size +10M | grep -v node_modules | grep -v .git

# 检查命名不一致
find . -type d -name "*-*" | grep -v node_modules | grep -v .git
```

**每月：**
```bash
# 审查 Git 仓库大小
du -sh .git/

# 审查数据文件泄漏
find . -type f \( -name "*.csv" -o -name "*.xlsx" \) | grep -v node_modules

# 更新依赖
cd systems/amazon_growth_os && pip list --outdated
cd systems/notion_sync && npm outdated
```

**每季度：**
- 重新评估域分类（6 个域是否合理）
- 审查空的 Skills 是否需要归档
- 更新架构文档
- 重新生成文件树图

---

## 第五部分：执行路线图

### Phase 1：紧急清理（本周）

**目标：** 解决 P0 问题，减少技术债务

| 任务 | 负责人 | 预计时间 | 风险 |
|-----|--------|---------|------|
| 移除 venv 从 Git | LiYe | 1 小时 | 🔴 高（重写历史）|
| 清理 .DS_Store | LiYe | 15 分钟 | 🟢 低 |
| 迁移数据文件到外部 | LiYe | 30 分钟 | 🟡 中 |
| 更新 .gitignore | LiYe | 15 分钟 | 🟢 低 |
| 测试 Clone 速度 | LiYe | 10 分钟 | 🟢 低 |

**验收标准：**
- [ ] Git 仓库 <200MB
- [ ] Clone 时间 <1 分钟
- [ ] 无 .DS_Store 文件
- [ ] 所有数据文件在 data_external/

### Phase 2：结构重组（本月）

**目标：** 执行目录重组，标准化命名

| 任务 | 预计时间 | 依赖 |
|-----|---------|------|
| 备份当前仓库 | 10 分钟 | - |
| 执行迁移脚本 | 30 分钟 | Phase 1 完成 |
| 更新所有文档链接 | 1 小时 | 迁移完成 |
| 更新 import 路径（Python） | 1 小时 | 迁移完成 |
| 测试 Systems 可运行性 | 30 分钟 | 路径更新 |
| 更新 CI/CD（如有） | 30 分钟 | 测试通过 |

**验收标准：**
- [ ] 所有目录小写+下划线
- [ ] Skills 缩减到 6 个域
- [ ] 无空的顶层目录
- [ ] Amazon Growth OS 可正常运行
- [ ] Notion Sync 可正常运行

### Phase 3：治理自动化（下月）

**目标：** 建立持续治理机制

| 任务 | 预计时间 |
|-----|---------|
| 配置 Git Hooks | 30 分钟 |
| 创建 CONTRIBUTING.md | 1 小时 |
| 设置 GitHub Actions（可选） | 2 小时 |
| 编写命名规范文档 | 1 小时 |
| 创建 Skill 创建向导 | 2 小时 |

**验收标准：**
- [ ] Pre-commit hook 阻止不良提交
- [ ] CONTRIBUTING.md 清晰定义标准
- [ ] 有 Skill 模板生成脚本
- [ ] 文档覆盖所有场景

---

## 第六部分：风险与应对

### 6.1 技术风险

| 风险 | 概率 | 影响 | 应对措施 |
|-----|------|------|---------|
| Git 历史重写失败 | 中 | 高 | 在分支测试、保留备份 |
| 路径引用断裂 | 高 | 中 | 全局搜索替换、充分测试 |
| 数据丢失 | 低 | 高 | 多重备份、逐步迁移 |
| 协作者 Clone 失败 | 高 | 低 | 提前通知、提供迁移指南 |

### 6.2 组织风险

| 风险 | 概率 | 影响 | 应对措施 |
|-----|------|------|---------|
| 用户习惯旧结构 | 高 | 低 | 提供迁移对照表、渐进式重构 |
| 文档更新不及时 | 中 | 中 | 自动化链接检查 |
| 新贡献者不遵守规范 | 高 | 中 | Pre-commit hook、清晰文档 |

### 6.3 回滚计划

如果重组失败：
```bash
# 1. 从备份恢复
rm -rf ~/github/liye_os
mv $BACKUP_DIR ~/github/liye_os

# 2. 强制推送旧版本
cd ~/github/liye_os
git reset --hard <commit-before-refactor>
git push origin --force

# 3. 通知所有协作者
```

---

## 第七部分：成功指标

### 7.1 量化指标

| 指标 | 当前 | 目标（1个月后） | 测量方法 |
|-----|------|----------------|---------|
| Git 仓库大小 | 1.8GB | <100MB | `du -sh .git/` |
| Clone 时间 | 5-10 分钟 | <30 秒 | `time git clone` |
| 空目录数量 | 17+ | 0-2 | `find . -type d -empty` |
| 命名一致性 | 70% | 95%+ | 手动审计 |
| 活跃 Skill 数量 | 3-4 | 6-8 | 目录计数 |
| 文档覆盖率 | 60% | 90%+ | 缺失 README 数量 |

### 7.2 质量指标

- [ ] 所有 Systems 可一键运行
- [ ] 新贡献者可在 15 分钟内理解结构
- [ ] CI/CD 通过率 100%
- [ ] 无重复命名冲突
- [ ] 跨平台兼容（Mac/Linux/Windows）

---

## 第八部分：附录

### 8.1 命名对照表

| 旧路径 | 新路径 | 状态 |
|-------|--------|------|
| `Skills/` | `skills/` | 重命名 |
| `Systems/` | `systems/` | 重命名 |
| `Skills/05_Medical_Intelligence/Medical_Research_Analyst/` | `skills/medical/medical_research_analyst/` | 重组+重命名 |
| `Skills/02_Operation_Intelligence/amazon-keyword-analysis/` | `skills/research/amazon_keyword_analysis/` | 迁移+重命名 |
| `Systems/amazon-growth-os/` | `systems/amazon_growth_os/` | 重命名 |
| `tools/notion-sync/` | `systems/notion_sync/` | 迁移 |
| `Glossaries/` | `_meta/glossary/` | 合并 |
| `Agents/` | (删除) | 移除空目录 |
| `Crews/` | (删除) | 移除空目录 |

### 8.2 参考资源

**内部文档：**
- `_meta/docs/ARCHITECTURE_CONSTITUTION.md` - 架构宪章
- `_meta/EVOLUTION_ROADMAP_2025.md` - 进化路线图
- `README.md` - 主文档

**外部标准：**
- [PEP 8](https://peps.python.org/pep-0008/) - Python 命名规范
- [Conventional Commits](https://www.conventionalcommits.org/) - 提交信息规范
- [Semantic Versioning](https://semver.org/) - 版本号规范

### 8.3 常见问题 FAQ

**Q: 为什么要重写 Git 历史？**
A: venv/ 占用 1.7GB，历史记录中每个提交都包含它，无法通过简单删除解决。重写历史是唯一彻底清理方法。

**Q: 重组会破坏现有功能吗？**
A: 可能会。建议先在备份分支测试，更新所有 import 路径后再合并。

**Q: 6 个域够用吗？未来会扩展吗？**
A: 基于当前 3-4 个活跃 Skill，6 个域已足够。可按需扩展，但避免过度规划。

**Q: 如何决定放 Skills 还是 Systems？**
A: Skill = 文档为主 + 可选脚本；System = 独立可执行代码库。当 Skill 成熟到需要完整工程结构时才迁移到 Systems。

**Q: 迁移需要多久？**
A: 清理（Phase 1）：2 小时；重组（Phase 2）：3-4 小时；自动化（Phase 3）：4-6 小时。总计 1-2 天。

---

## 决策与审批

**提议人：** Claude (File System Analyst)
**提议日期：** 2025-12-23
**审批人：** LiYe
**审批日期：** _待定_
**执行状态：** 🟡 待审批

**审批意见区：**

```
[ ] 同意全部方案，开始执行
[ ] 同意 Phase 1（紧急清理），暂缓 Phase 2-3
[ ] 需要修改：_______________________
[ ] 拒绝，原因：_______________________
```

---

**下一步行动：**
1. 审阅本文档
2. 在新分支测试 Phase 1 清理
3. 确认无误后执行 Phase 1
4. 评估 Phase 2 可行性后再决定

**联系方式：**
如有疑问，请在 GitHub Issues 讨论或联系维护者。
