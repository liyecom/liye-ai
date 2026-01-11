# Context Pack: Protocols（协作/交付协议）

**加载条件：** 涉及"多人/多模型/多智能体协同"、交付标准、质量门禁、复盘流程时加载。

## 协作分工原则

### Claude 的角色定位

**擅长：**
- 编排和调度（orchestration）
- 文件系统操作（读写、重组、重构）
- 质量门禁（检查、验证、确保一致性）
- 集成落地（把方案变成可执行代码）
- 上下文管理（加载相关 Packs、Skill 文档）

**不擅长（应委托）：**
- 大批量重复性任务（如处理 100+ 个文件）
- 超大上下文摘要（如一次性读取 50 篇论文）
- 实时数据抓取（应使用 API 或爬虫工具）

### 多模型协作分工

| 模型 | 定位 | 典型任务 | 调用方式 |
|-----|------|---------|---------|
| **Claude Sonnet** | 编排者 | Crew 设计、质量门禁、文件操作 | 主控 |
| **Claude Opus** | 深度思考 | 复杂策略设计、架构决策 | Claude 调用（关键决策点）|
| **Gemini 2.0 Flash** | 大上下文 | 50+ 文献摘要、大规模数据分析 | Claude 委托（批量任务）|
| **GPT-4** | 工具调用 | API 调用、结构化输出 | Claude 委托（精确格式）|
| **Gemini 2.0 Flash Thinking** | 复杂推理 | 多步骤逻辑链、数学证明 | 特殊任务 |

**协作流程示例：**

```
用户：分析 Amazon Q4 广告数据并生成优化方案

Claude (Sonnet):
  1. 理解需求 → 拆解任务
  2. 加载 .claude/packs/operations.md
  3. 设计 Crew：DataCollector → Analyzer → Strategist → Reporter
  4. 委托 Gemini：批量处理 100+ 个广告组的数据
  5. 调用 Opus：设计优化策略（关键决策）
  6. 自己执行：生成报告、归档到 Artifacts_Vault
  7. 质检：验证数据完整性、格式正确性
  8. 交付：向用户展示结果 + 归档路径
```

## 输出契约（最重要）

### 交付物标准

**每次交付必须包含 5 个要素：**

1. **目标（Objective）**
   ```
   什么任务？为什么做？成功的定义是什么？
   ```

2. **输入（Input）**
   ```
   数据源、配置文件、依赖文件的路径
   ```

3. **步骤（Steps）**
   ```
   详细的执行过程（可复现）
   ```

4. **产出（Output）**
   ```
   最终文件的路径、格式、大小
   ```

5. **风险/回滚（Risk & Rollback）**
   ```
   可能的问题、如何回滚、备份位置
   ```

### 交付物示例

```markdown
# Amazon Listing Optimization Report

## Objective
优化 Acme Canada ASIN B0XXX 的 Listing，目标提升 CTR 10%，CVR 5%

## Input
- 数据源：`Systems/a private repository/data/inputs/campaign_report_20240115.csv`
- 配置：`Systems/a private repository/config/optimization.yaml`
- 参考：`Skills/02_Operation_Intelligence/amazon-keyword-analysis/templates/listing_template.md`

## Steps
1. 数据加载：读取广告报表（2024-01-01 至 2024-01-15）
2. 关键词分析：提取 CTR Top 10 和 CVR Top 10
3. 竞品对标：分析前 3 名竞品的 Listing
4. 生成建议：标题、5点、A+ 内容优化
5. 归档产出：保存到 Artifacts_Vault

## Output
- 报告：`Artifacts_Vault/by_project/acme_canada_q4/listing_optimization_20240120.md`
- 数据附件：`Artifacts_Vault/by_project/acme_canada_q4/data/keyword_analysis.csv`

## Risk & Rollback
- 风险：优化后可能影响现有排名（建议 A/B 测试）
- 回滚：保留原 Listing 截图于 `Artifacts_Vault/.../backup/`
- 备份：原始数据已备份到 `~/data/amazon_reports/backup_20240120/`
```

### 禁止模式

**❌ 不允许：只给结论不落地**
```
用户：优化这个 Listing
Claude：我建议你优化标题，增加关键词密度...

问题：没有具体建议、没有文件输出、无法追溯
```

**✅ 正确方式：**
```
用户：优化这个 Listing
Claude：
  1. 已读取当前 Listing（Tools/Read）
  2. 已分析关键词（TES 框架）
  3. 已生成优化方案（Tools/Write → Artifacts_Vault/...）
  4. 请查看：[文件路径]
```

## 质量门禁

### 提交前检查清单

```bash
# 自动检查（pre-commit hook）
node .claude/scripts/guardrail.mjs

# 手动检查清单
- [ ] CLAUDE.md ≤ 10,000 chars
- [ ] 每个 Pack ≤ 15,000 chars
- [ ] .env 文件已在 .gitignore
- [ ] 数据文件已移出 repo（或在 .gitignore）
- [ ] Artifacts 有完整元数据（日期、来源、输入输出）
- [ ] 提交信息遵循 Conventional Commits
```

### 代码质量标准

**Python（Amazon Growth Engine）：**
```bash
# Linting
black src/
flake8 src/

# Type checking
mypy src/

# Tests
pytest tests/
```

**JavaScript（Notion Sync）：**
```bash
# Linting
eslint tools/notion-sync/

# Tests
npm test
```

### 文档完整性

**每个 Skill 必须有：**
- [ ] `README.md`（快速开始）
- [ ] `skill_definition.md`（核心定义）
- [ ] `methods.md`（方法论详解）
- [ ] `templates/`（至少 1 个模板）

**每个 System 必须有：**
- [ ] `README.md`（安装和使用）
- [ ] `.env.example`（环境变量模板）
- [ ] `requirements.txt` 或 `package.json`（依赖）

## 复盘流程（Evolution Loop）

### 触发条件

**必须复盘：**
- 项目完成（交付）
- 重大失败（ACOS 超标 >20%、系统错误导致数据丢失等）
- 新方法验证（A/B 测试结果）

**可选复盘：**
- 每月定期（月度回顾）
- 用户反馈（建议/抱怨）

### 复盘模板

```markdown
# 复盘报告：[项目名称]

## 基本信息
- 项目：Acme Canada Q4 Launch
- 时间：2024-01-01 至 2024-01-20
- 目标：新品破冰，达到日销 50 单
- 实际：日销 45 单（90% 达成）

## 成功要素（Keep）
1. 关键词策略：TES 框架有效，测试期快速筛选出高转化词
2. 广告结构：自动+手动组合，覆盖面广
3. 数据看板：实时监控，快速响应

## 失败教训（Problem）
1. 库存管理：第 10 天断货 2 天，损失销售
2. 竞品监控：未及时发现竞品降价，被抢走流量
3. Listing 优化：A+ 内容上线晚了 1 周

## 改进方案（Try）
1. 库存预警：设置安全库存阈值（14 天销量）
2. 竞品爬虫：每日自动抓取前 5 名竞品价格
3. Listing SOP：Launch 前 7 天必须完成所有内容

## 知识沉淀（Archive）
- 方法更新：`Skills/.../methods.md` 增加"库存管理最佳实践"
- 模板更新：`Skills/.../templates/launch_checklist.md` 增加库存检查项
- 案例归档：`Artifacts_Vault/by_project/acme_canada_q4/retrospective.md`
```

### 知识沉淀流程

```
1. Artifacts（交付物）
   ↓
2. Retrospective（复盘）
   ↓
3. Insights（洞察提炼）
   ↓
4. Methods Update（方法更新）
   ↓
5. Template Enrichment（模板丰富）
   ↓
6. Knowledge Graph（知识图谱）
```

**具体操作：**

```bash
# 1. 归档 Artifacts
mv reports/listing_optimization_20240120.md Artifacts_Vault/by_project/acme_canada_q4/

# 2. 撰写复盘
vim Artifacts_Vault/by_project/acme_canada_q4/retrospective.md

# 3. 更新 Methods
vim Skills/02_Operation_Intelligence/amazon-keyword-analysis/methods.md
# 增加："库存管理最佳实践"章节

# 4. 更新 Templates
vim Skills/02_Operation_Intelligence/amazon-keyword-analysis/templates/launch_checklist.md
# 增加：库存预警设置步骤

# 5. 提交变更
git add -A
git commit -m "feat(amazon-keyword): add inventory management best practices from Acme Q4 project"
```

## 协作协议（多人场景）

### 角色定义

| 角色 | 职责 | 权限 |
|-----|------|------|
| **Architect** | 架构设计、技术决策 | 修改 _meta/, .claude/, 核心文档 |
| **Operator** | 执行运营任务、数据分析 | 修改 Systems/, Projects_Engine/ |
| **Researcher** | 研究分析、知识沉淀 | 修改 Skills/, Artifacts_Vault/ |
| **Reviewer** | 质量审查、合并 PR | 审批所有变更 |

### 分支策略

```
main              # 主分支（稳定版本）
├── develop       # 开发分支
│   ├── feature/amazon-bid-optimizer
│   ├── feature/notion-sync-v2
│   └── fix/keyword-analysis-bug
└── hotfix/       # 紧急修复
```

### Pull Request 检查清单

```markdown
## PR Title
feat(notion-sync): add bidirectional sync with conflict resolution

## Description
添加双向同步功能，支持冲突检测和解决策略（ask/local-wins/notion-wins）

## Changes
- [ ] 新增 `scripts/sync.js`
- [ ] 更新 `README.md` 文档
- [ ] 添加单元测试
- [ ] 通过 Guardrail 检查

## Testing
- [x] 本地测试通过
- [x] 与真实 Notion 数据库测试通过
- [ ] 多人协作场景测试（待验证）

## Checklist
- [x] 代码遵循命名规范
- [x] 无敏感数据（.env 已 gitignore）
- [x] 文档已更新
- [x] Guardrail 检查通过
```

## 紧急响应

### 问题分级

| 级别 | 定义 | 响应时间 | 示例 |
|-----|------|---------|------|
| **P0** | 系统崩溃、数据丢失 | 1 小时内 | 数据库损坏、API 密钥泄漏 |
| **P1** | 核心功能不可用 | 4 小时内 | Notion 同步失败、广告系统停止 |
| **P2** | 功能受损但可 workaround | 1 天内 | 部分数据缺失、性能下降 |
| **P3** | 小问题、优化需求 | 1 周内 | UI 优化、文档错误 |

### 回滚策略

**Git 回滚：**
```bash
# 查看最近提交
git log --oneline -10

# 回滚到指定提交
git reset --hard <commit-hash>

# 如果已推送，需要强制推送（谨慎！）
git push origin --force
```

**数据回滚：**
```bash
# 从备份恢复
cp ~/data/amazon_reports/backup_20240120/*.csv Systems/a private repository/data/inputs/

# 从 Notion 重新同步
cd tools/notion-sync
npm run pull -- --force
```

**配置回滚：**
```bash
# 恢复 .env（从 .env.example）
cp tools/notion-sync/.env.example tools/notion-sync/.env
vim tools/notion-sync/.env  # 重新配置
```

---

**Char Count:** ~8,500 / 15,000 ✅
