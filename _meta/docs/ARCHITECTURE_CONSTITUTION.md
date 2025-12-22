# LiYe OS 架构宪法

> **版本**: 1.0
> **生效日期**: 2025-12-22
> **状态**: 已冻结
> **修订权限**: 需架构委员会（即你自己）正式评审

---

## 第一章：基本原则

### 第 1 条：第一性原理

LiYe OS 的架构基于一个核心洞察：

> **知识和执行是两个不同的层次。**

- **知识（Knowledge）**：被动的，供人学习
- **执行（Execution）**：主动的，能自动干活

### 第 2 条：最小完备原则

架构应保持**不可再简化**的状态：

- 不为假想的未来增加复杂度（YAGNI）
- 每一层有且只有一个职责（Single Responsibility）
- 可逆决策优先于完美设计

### 第 3 条：术语冻结

以下术语在 LiYe OS 中有明确定义，**不得混用**：

### 第 4 条：工具不可反向定义架构

> LiYe OS 的架构以**系统抽象层级**为核心，而非任何具体工具或框架。

**规则**：
- Claude、CrewAI、Skill Forge、MCP 等均属于**实现或扩展工具**
- 工具不得反向决定目录结构或术语定义
- 当工具概念与架构概念冲突时，以架构宪法为准

**示例**：
- CrewAI 的 `Crew` 类 ≠ LiYe OS 的 `Crews/` 目录（前者是代码实现，后者是架构概念）
- Skill Forge 创建的 "skill" ≠ LiYe OS 的 `Skills/`（前者是 Claude 插件，后者是方法论）

| 术语 | 定义 | 比喻 |
|------|------|------|
| **Skill** | 方法论、SOP、模板（被动知识） | 菜谱 |
| **Agent** | 单个 AI 角色定义（原子能力） | 单个员工 |
| **Crew** | 多 Agent 协作编排（组合结构） | 项目小组 |
| **System** | 完整可部署平台（一等公民） | 整个部门 |
| **Extension** | 能力扩展插件（依赖特定运行时） | 外挂工具 |

---

## 第二章：目录结构

### 第 4 条：顶层架构

```
LiYe_OS/
│
├── _meta/                    # 系统元信息
│   ├── templates/            # 各类模板
│   │   ├── skill_template/
│   │   ├── agent_template/
│   │   ├── crew_template/
│   │   └── system_template/
│   └── docs/                 # 架构文档
│       └── ARCHITECTURE_CONSTITUTION.md
│
├── Skills/                   # 方法论（给人看）
│
├── Glossaries/               # 术语表
│
├── Agents/                   # 智能体定义（原子）
│
├── Crews/                    # 团队定义（组合）
│
├── Systems/                  # 可部署系统（一等公民）
│
├── Extensions/               # 能力扩展
│   ├── claude-skills/        # Claude Code Skills
│   └── mcp-servers/          # MCP 服务器
│
├── Artifacts_Vault/          # 成果库
│
└── Projects_Engine/          # 项目引擎
```

### 第 5 条：层级职责

| 层级 | 职责 | 能否独立运行 | 文件类型 |
|------|------|-------------|----------|
| **Skills** | 传递"怎么做" | ❌ | `.md` |
| **Glossaries** | 定义术语 | ❌ | `.md` |
| **Agents** | 定义"谁来做" | ⚠️ 需运行环境 | `.yaml` |
| **Crews** | 定义"如何协作" | ⚠️ 需运行环境 | `.yaml` |
| **Systems** | 负责"把事做完" | ✅ | 完整项目 |
| **Extensions** | 扩展 Claude/MCP 能力 | ⚠️ 需特定运行时 | 按规范 |

### 第 6 条：不引入 Knowledge 层的决定

**决策**：不在 Skills 和 Glossaries 上增加 `Knowledge/` 父目录。

**理由**：
1. 目前只有 Skills 和 Glossaries 两个稳定子类型
2. 过早抽象违反 YAGNI 原则
3. 未来如需调整，迁移成本极低（纯目录级）
4. 路径简短利于日常使用

**复议条件**：当出现第三个稳定的知识子类型时，可重新评估。

---

## 第三章：分类决策规则

### 第 7 条：30 秒决策流程图

```
你创建了一个新东西
         │
         ▼
┌─────────────────────────────┐
│ Q1: 它是给人看的文档/方法论吗？│
└─────────────────────────────┘
         │
    ┌────┴────┐
    Yes       No
    │         │
    ▼         ▼
 Skills/   ┌─────────────────────────────┐
           │ Q2: 它定义了单个 AI 角色吗？  │
           │    （有 role/goal/backstory）│
           └─────────────────────────────┘
                      │
                 ┌────┴────┐
                Yes       No
                 │         │
                 ▼         ▼
             Agents/   ┌─────────────────────────────┐
                       │ Q3: 它是多 Agent 协作编排吗？│
                       └─────────────────────────────┘
                                  │
                             ┌────┴────┐
                            Yes       No
                             │         │
                             ▼         ▼
                         Crews/   ┌─────────────────────────────┐
                                  │ Q4: 它是完整可部署的系统吗？ │
                                  │   （有代码+工具+基础设施）   │
                                  └─────────────────────────────┘
                                             │
                                        ┌────┴────┐
                                       Yes       No
                                        │         │
                                        ▼         ▼
                                   Systems/  Extensions/
```

### 第 8 条：Skills vs Extensions 判定矩阵

当不确定应该放 `Skills/` 还是 `Extensions/` 时，使用此矩阵：

| 判断问题 | Yes → | No → |
|----------|-------|------|
| 脱离 Claude 仍然有完整价值？ | Skills | Extensions |
| 可以被人类照着手动执行？ | Skills | Extensions |
| 是否依赖 Claude Skill / MCP 协议？ | Extensions | Skills |
| 是否主要解决"Claude 能干什么"？ | Extensions | Skills |
| 是否主要解决"人该怎么想/怎么做"？ | Skills | Extensions |

**规则**：只要有 **2 条以上**落在 Extensions，一定不要放 Skills。

### 第 8.1 条：Extensions → Skills 沉淀路径

当一个 Extension 满足以下条件时，**应当**提取其核心逻辑沉淀为 Skill：

1. **脱离运行时仍有价值**：方法论可以被人类手动执行
2. **稳定性验证**：已在 3+ 个不同场景中复用
3. **知识资产化**：核心逻辑可以文档化为 SOP/模板

**沉淀流程**：
```
Extensions/claude-skills/listing-writer/
    ↓ 提取方法论
Skills/amazon-operations/listing-psychology.md
    ↓ 保留技术实现
Extensions/claude-skills/listing-writer/ (继续存在)
```

**注意**：沉淀是**复制**而非**移动**，Extension 和 Skill 可以共存。

### 第 9 条：边界案例处理

**案例类型**：内容同时包含"给人的知识"和"给 Claude 的能力"

**处理原则**：**拆分是最优解**

```
例如："Listing 写作心理学原则 + Claude Prompt"

正确处理：
├── Skills/amazon-operations/listing-psychology.md    # 原则
└── Extensions/claude-skills/listing-writer/          # Prompt
```

**禁止**：将依赖特定运行时的内容放入 Skills（防止 Skills 被"插件化污染"）

---

## 第四章：System 特别条款

### 第 10 条：System 是一等公民

**定义**：System 是 LiYe OS 中**唯一可独立部署、产生业务价值**的单元。

**零歧义工程判据**：
> 如果一个东西能用 `docker run` / `make run` / `python main.py` 启动，
> 并且**独立完成一个业务目标**（不需要人工介入中间步骤），
> 那它**必须**是 System，不能是其他任何类型。

**特征**：
- 包含 Crews + Tools + Infrastructure
- 有完整的 `src/`、`config/`、`Dockerfile` 等
- 可通过 Docker 或命令行独立运行
- 有用户界面（CLI / Dashboard / API）

**命名规范**：`{domain}-{function}-os` 或 `{domain}-{function}`

```
✅ 正确命名：
- amazon-growth-os
- medical-research-os
- content-factory

❌ 错误命名：
- amazon-operations-crew （暴露实现细节）
- my-cool-project （无意义）
```

### 第 11 条：System 内部结构标准

```
Systems/{system-name}/
├── README.md                 # 必须：项目说明
├── SOP_操作手册.md            # 必须：傻瓜式操作指南
├── .env.example              # 必须：环境变量模板
├── requirements.txt          # 必须：依赖声明
├── Dockerfile                # 推荐：容器化支持
├── docker-compose.yaml       # 推荐：编排配置
│
├── config/                   # 配置目录
│   ├── agents.yaml           # Agent 定义（系统内部）
│   ├── tasks_*.yaml          # 任务定义
│   └── *.yaml                # 其他配置
│
├── src/                      # 源代码
│   └── ...
│
├── tools/                    # 系统工具
│   └── ...
│
├── dashboard/                # UI（如有）
│   └── ...
│
├── data/                     # 数据目录（.gitignore）
│   ├── .gitkeep
│   └── ...
│
├── reports/                  # 报告目录（.gitignore）
│   ├── .gitkeep
│   └── ...
│
└── logs/                     # 日志目录（.gitignore）
    └── .gitkeep
```

---

## 第五章：扩展与演进

### 第 12 条：新增顶层目录的条件

只有满足以下**全部条件**时，才可新增顶层目录：

1. 无法归入现有任何目录
2. 预计未来 2 年内会有 3+ 个稳定子项
3. 与现有目录职责无重叠
4. 经架构委员会正式评审

### 第 13 条：废弃目录的流程

1. 标记为 `DEPRECATED`（在目录下创建 `DEPRECATED.md`）
2. 保留 6 个月迁移期
3. 迁移完成后删除

### 第 14 条：宪法修订流程

1. 提出修订提案（说明原因、影响范围）
2. 评估向后兼容性
3. 如涉及术语变更，需更新所有相关文档
4. 更新宪法版本号和生效日期

---

## 第六章：快速参考

### 附录 A：分类速查卡

```
┌────────────────────────────────────────────────────────────┐
│                  我创建的东西放哪里？                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  📖 给人学习的方法论/SOP         → Skills/                  │
│                                                            │
│  📚 术语定义/数据字典            → Glossaries/              │
│                                                            │
│  🤖 单个 AI 角色定义             → Agents/                  │
│                                                            │
│  👥 多 AI 协作流程               → Crews/                   │
│                                                            │
│  🏭 完整可运行的系统             → Systems/                 │
│                                                            │
│  🔌 Claude Code 能力扩展         → Extensions/claude-skills/│
│                                                            │
│  🔗 MCP 服务器                   → Extensions/mcp-servers/  │
│                                                            │
│  📦 执行产出的归档               → Artifacts_Vault/         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 附录 B：命名规范

| 类型 | 格式 | 示例 |
|------|------|------|
| Skills 目录 | `{domain}/` 或 `{domain}-{topic}/` | `amazon-operations/`, `medical-research/` |
| Agent 文件 | `{role}.yaml` | `keyword-analyst.yaml` |
| Crew 文件 | `{domain}-{purpose}-crew.yaml` | `amazon-launch-crew.yaml` |
| System 目录 | `{domain}-{function}-os/` 或 `{domain}-{function}/` | `amazon-growth-os/` |
| Extension 目录 | `{capability}/` | `crewai/`, `sellersprite-api/` |

### 附录 C：禁止事项

1. ❌ **禁止**在 Skills 中放依赖特定运行时的内容
2. ❌ **禁止**在 Agents 目录下嵌套 crews 子目录
3. ❌ **禁止**将完整 System 放在 Skills 或 Agents 下
4. ❌ **禁止**使用 `Knowledge/` 作为 Skills 的父目录（除非第 12 条条件满足）
5. ❌ **禁止**混用术语（Agent ≠ Crew ≠ System）

---

## 签署

本宪法由 LiYe OS 架构委员会于 2025-12-22 正式通过。

**架构决策参与者**：
- 产品专家组
- 技术专家组
- Claude Opus 4.5（AI 协作者）

**生效声明**：
> 自本宪法生效之日起，所有 LiYe OS 的新建内容必须遵循本宪法。
> 现有内容应在合理时间内迁移至符合本宪法的结构。

---

*宪法版本: 1.0*
*最后更新: 2025-12-22*
