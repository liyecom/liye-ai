# Skill Forge 使用指南

## 📋 概述

Skill Forge 是一个为 Claude Code 设计的自动化技能创建工作坊，可以将外部资源（GitHub 仓库、在线文档、PDF、本地目录）转换为结构良好、可重用的 Claude Code Skills。

**安装位置**: `~/.claude/skills/skill-forge/`
**配置日期**: 2025-12-19
**版本**: Latest from GitHub

---

## ✅ 系统环境

已验证的系统环境：
- ✅ Python 3.9.6（需求：3.8+）
- ✅ git 2.49.0
- ✅ pip3 21.2.4
- ✅ markitdown 0.0.1a1

---

## 🎯 核心功能

### 1. 智能源检测
自动识别并处理多种资源类型：
- GitHub 仓库（自动克隆）
- 文档网站（支持 llms.txt 快速获取）
- PDF 文件（自动转换为 markdown）
- Office 文档（DOCX/PPTX/XLSX）
- 本地目录

### 2. 零配置使用
开箱即用，无需复杂设置。只需对 Claude 说：
```
"从 [URL/路径] 创建一个 skill"
```

### 3. 渐进式加载系统
三级加载架构，优化上下文使用：
1. **元数据**（name + description）- 始终加载（~100 词）
2. **SKILL.md 主体** - 技能触发时加载（<5k 词）
3. **打包资源** - 按需加载（无限制）

### 4. 智能路径管理
- **临时材料**：自动保存到 `.claude/temp-materials/`（项目）或 `~/skill-materials/`（全局）
- **技能安装**：用户选择 `.claude/skills/`（项目）或 `~/.claude/skills/`（全局）
- **打包文件**：创建在技能目录内

---

## 📖 使用方法

### 快速示例

#### 示例 1：从 GitHub 仓库创建技能
```
你：从 https://github.com/joaomdmoura/crewAI 创建一个 skill
```

Claude 会自动：
1. 检测 GitHub URL
2. 克隆仓库到临时目录
3. 引导你完成技能创建流程
4. 安装到 `~/.claude/skills/crewai/`
5. 可选：打包为 `crewai.zip` 用于分享

#### 示例 2：从文档网站创建技能
```
你：把 https://docs.crewai.com/ 转成一个 skill
```

Claude 会自动：
1. 检测是否支持 llms.txt（速度快 10 倍）
2. 获取文档到临时目录
3. 帮助组织成技能结构
4. 安装到技能目录
5. 可选：创建 .zip 分发包

#### 示例 3：从 PDF 创建技能
```
你：从 ~/Documents/manual.pdf 创建一个 skill
```

Claude 会自动：
1. 使用 markitdown 将 PDF 转换为 markdown
2. 引导技能创建
3. 安装到技能目录
4. 可选：打包用于分享

---

## 🔧 技能创建工作流程

### Step 0: 获取源材料（自动）
当你提供外部资源时，Claude 会自动执行：

**GitHub 仓库**：
```bash
scripts/fetch_source.py --git https://github.com/user/repo
```

**文档网站**（优先检测 llms.txt）：
```bash
# 先检测 llms.txt
scripts/detect_llms_txt.py https://docs.example.com

# 如果有 llms.txt，快速获取
scripts/fetch_source.py --docs https://docs.example.com/llms-full.txt --name project

# 否则，常规抓取
scripts/fetch_source.py --docs https://docs.example.com --name project
```

**PDF 文档**：
```bash
scripts/fetch_source.py --docs /path/to/document.pdf --name manual
```

### Step 1: 理解技能用途
Claude 会通过具体示例了解：
- 技能应该支持什么功能？
- 用户会说什么来触发这个技能？
- 具体的使用场景是什么？

### Step 2: 规划可重用内容
识别要打包的资源：
- **scripts/** - 重复编写的代码（如 `rotate_pdf.py`）
- **references/** - 需要参考的文档（如 API 文档、数据库模式）
- **assets/** - 用于输出的文件（如模板、图片、样板代码）

### Step 3: 初始化技能
选择技能安装位置：
```
1. 项目技能 (.claude/skills/) - 仅当前项目可用
2. 全局技能 (~/.claude/skills/) - 所有项目可用
3. 自定义路径 - 指定自己的位置
```

初始化命令：
```bash
scripts/init_skill.py <skill-name> --path <user-chosen-path>
```

### Step 4: 编辑技能
1. 实现 `scripts/`、`references/`、`assets/` 中的资源
2. 删除初始化时的示例文件
3. 编写 SKILL.md 指令（使用祈使语气，而非第二人称）

**大型文档处理**：
- 如果文档 >50KB 或 >10,000 词，拆分为逻辑部分：
  - `references/overview.md` - 概述和入门
  - `references/core-concepts.md` - 核心概念
  - `references/api-reference.md` - API 文档
  - `references/advanced.md` - 高级用法

### Step 5: 完成和可选打包
技能创建完成后：
1. ✅ 自动清理临时材料（无需用户操作）
2. ✅ 自动删除临时辅助脚本
3. ✅ 通知用户技能已安装并可用
4. ❓ 询问是否打包为 .zip（可选）

**打包命令**（如果需要分享）：
```bash
scripts/package_skill.py <path/to/skill-folder>
```

### Step 6: 迭代改进
在实际使用中：
1. 使用技能完成真实任务
2. 注意遇到的困难和低效
3. 更新 SKILL.md 或打包资源
4. 再次测试

---

## 🗂️ 技能结构规范

### 标准目录结构
```
skill-name/
├── SKILL.md          # 必需：元数据和指令
├── scripts/          # 可选：可执行工具
│   └── example.py
├── references/       # 可选：参考文档
│   ├── overview.md
│   └── api.md
└── assets/           # 可选：输出资源
    ├── template/
    └── logo.png
```

### SKILL.md 格式
```yaml
---
name: skill-name
description: 详细描述技能用途和触发时机（使用第三人称）
---

# 技能名称

技能目的说明...

## 何时使用

触发模式说明...

## 如何使用

引用打包资源的指令...
```

### 编写风格指南
- ✅ 使用祈使/不定式语气："To accomplish X, do Y"
- ❌ 避免第二人称："You should do X"
- 重点：包含其他 Claude 实例能受益的程序性知识和领域细节

---

## 🛠️ 可用脚本

所有脚本位于 `~/.claude/skills/skill-forge/scripts/`：

| 脚本 | 功能 | 示例用法 |
|------|------|----------|
| `fetch_source.py` | 获取 Git/文档/PDF 材料 | `python3 fetch_source.py --git <url>` |
| `detect_llms_txt.py` | 检测 llms.txt 可用性 | `python3 detect_llms_txt.py <url>` |
| `init_skill.py` | 初始化技能目录结构 | `python3 init_skill.py <name> --path <path>` |
| `package_skill.py` | 验证并打包技能 | `python3 package_skill.py <skill-path>` |
| `cleanup_materials.py` | 清理临时材料 | `python3 cleanup_materials.py <skill-name>` |
| `quick_validate.py` | 快速验证技能结构 | `python3 quick_validate.py` |

---

## 🔗 与 LiYe OS 的集成

### 1. 创建 LiYe OS 技能时使用 Skill Forge

当需要将外部资源（如医疗领域的专业文档、跨境电商平台的官方文档等）转换为 LiYe OS 技能时：

```
你：从 https://docs.stripe.com/ 创建一个支付集成技能
```

Claude 会自动：
1. 使用 Skill Forge 获取和组织 Stripe 文档
2. 按照 LiYe OS 的 10 模块标准结构创建技能
3. 将技能安装到 `Documents/liye_workspace/LiYe_OS/Skills/` 的适当领域目录

### 2. 技能存储位置建议

**全局通用技能** → `~/.claude/skills/`
- 适用于所有项目的通用工具和框架

**LiYe OS 领域技能** → `Documents/liye_workspace/LiYe_OS/Skills/<领域>/`
- 按照 LiYe OS 的领域分类存储
- 遵循 10 模块标准结构

**项目特定技能** → `Documents/出海跨境/.claude/skills/`
- 仅用于特定项目的专业技能

### 3. 从 Skill Forge 输出升级到 LiYe OS 标准

Skill Forge 创建的基础技能可以进一步扩展为 LiYe OS 的完整技能：

**基础 Skill Forge 结构**：
```
skill-name/
├── SKILL.md
├── scripts/
├── references/
└── assets/
```

**升级为 LiYe OS 标准**（参考模板：`Documents/liye_workspace/LiYe_OS/_meta/skill_template/`）：
```
skill-name/
├── SKILL.md                    # 保留
├── 01_capability_model.md      # 新增：能力模型
├── 02_mental_models.md         # 新增：思维框架
├── 03_methods_sops.md          # 新增：方法流程
├── 04_execution_protocols.md   # 新增：执行协议
├── 05_output_structure.md      # 新增：输出结构
├── 06_evaluation.md            # 新增：评估打分
├── scripts/                    # 保留并扩展
├── templates/                  # 新增：至少 3 个模板
├── references/                 # 保留
├── assets/                     # 保留
└── evolution_log.md           # 新增：演化日志
```

---

## 📚 支持的资源类型

| 类型 | 示例 | 自动检测 | 依赖 |
|------|------|----------|------|
| GitHub 仓库 | `github.com/user/repo` | ✅ | git |
| 文档网站 | `docs.example.com` | ✅ | markitdown |
| llms.txt | `docs.site.com/llms.txt` | ✅ 自动检测 | - |
| PDF 文件 | `file.pdf` 或路径 | ✅ | markitdown |
| Office 文档 | `.docx/.pptx/.xlsx` | ✅ | markitdown |
| 本地目录 | `~/my-project/` | ✅ | - |

---

## 💡 最佳实践

### 1. 选择合适的资源类型
- **scripts/** - 用于重复编写的确定性代码
- **references/** - 用于需要加载到上下文的文档
- **assets/** - 用于在输出中使用的文件（不加载到上下文）

### 2. 保持 SKILL.md 简洁
- 核心指令和工作流程 → SKILL.md
- 详细参考资料 → references/
- 大型文档（>50KB）→ 拆分为多个 references 文件

### 3. 利用 llms.txt
在获取文档前，始终先检测 llms.txt：
```bash
scripts/detect_llms_txt.py https://docs.example.com
```
速度可提升 10 倍！

### 4. 渐进式披露原则
按需加载资源，避免占用过多上下文：
- 元数据（~100 词）→ 始终加载
- SKILL.md（<5k 词）→ 技能触发时加载
- references/（无限制）→ 按需加载

### 5. 清理临时材料
技能创建完成后，Skill Forge 会自动清理临时材料，无需手动操作。

---

## 🚨 常见问题

### Q1: markitdown 安装警告
```
WARNING: markitdown 0.0.1a1 does not provide the extra 'all'
```
**答**: 这是正常的，基础包已安装，功能不受影响。

### Q2: urllib3 警告
```
NotOpenSSLWarning: urllib3 v2 only supports OpenSSL 1.1.1+
```
**答**: 这是兼容性警告，不影响功能。可以忽略。

### Q3: 技能安装位置选择
**答**:
- 通用工具和框架 → `~/.claude/skills/`（全局）
- LiYe OS 领域技能 → `Documents/liye_workspace/LiYe_OS/Skills/<领域>/`
- 项目特定技能 → `<项目目录>/.claude/skills/`

### Q4: 大型文档处理
**答**: Skill Forge 会自动建议拆分 >50KB 的文档为多个逻辑部分，存放在 references/ 目录。

---

## 📝 使用检查清单

创建技能前：
- [ ] 确认 Python 3.8+ 已安装
- [ ] 确认 git 已安装（如需获取 GitHub 仓库）
- [ ] 确认 markitdown 已安装（如需处理文档/PDF）
- [ ] 明确技能的用途和使用场景
- [ ] 准备好源材料（URL 或本地路径）

创建技能时：
- [ ] 让 Claude 自动检测源类型
- [ ] 提供具体的使用示例
- [ ] 明确需要打包的资源类型（scripts/references/assets）
- [ ] 选择合适的技能安装位置
- [ ] 如果是 LiYe OS 技能，考虑升级到 10 模块标准

技能创建后：
- [ ] 验证技能已安装并可用
- [ ] 在实际任务中测试技能
- [ ] 根据使用反馈迭代改进
- [ ] 如需分享，打包为 .zip 文件
- [ ] 记录到 LiYe OS 的技能索引（如适用）

---

## 🔄 更新和维护

### 更新 Skill Forge
```bash
cd ~/.claude/skills/skill-forge
git pull origin main
```

### 更新 markitdown
```bash
pip3 install --upgrade markitdown
```

### 验证安装
```bash
# 检查 Python
python3 --version

# 检查 git
git --version

# 检查 markitdown
python3 -c "from markitdown import MarkItDown; print('✅ MarkItDown is installed')"
```

---

## 📖 参考资源

**官方文档**：
- [Skill Forge GitHub](https://github.com/WilliamSaysX/skill-forge)
- [llms.txt 标准](https://llmstxt.org/)
- [markitdown](https://github.com/microsoft/markitdown)

**LiYe OS 相关**：
- 技能模板：`Documents/liye_workspace/LiYe_OS/_meta/skill_template/`
- 示例技能：`Documents/liye_workspace/LiYe_OS/Skills/05_Medical_Intelligence/Medical_Research_Analyst/`
- Evolution Lite：`Documents/出海跨境/.liye_evolution/`

---

**配置完成时间**: 2025-12-19
**配置者**: Claude Code
**维护者**: LiYe

---

**使用建议**:
- 优先使用 llms.txt 获取文档（速度快 10 倍）
- 大型文档拆分为多个 references 文件
- LiYe OS 技能考虑升级到 10 模块标准
- 定期更新 Skill Forge 以获取新功能
