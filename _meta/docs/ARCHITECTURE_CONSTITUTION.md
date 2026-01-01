# LiYe OS 架构宪法

> **版本**: 1.6
> **生效日期**: 2025-12-22
> **最后修订**: 2026-01-01 (v6.2.1: Mainline Version Policy)
> **状态**: 生效中
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
├── _meta/                    # 系统元信息（整合 governance/schemas/templates）
│   ├── templates/            # 各类模板
│   ├── governance/           # 治理规则
│   ├── schemas/              # 数据结构定义
│   └── docs/                 # 架构文档
│
├── Skills/                   # 方法论（给人看）
├── Glossaries/               # 术语表
├── Agents/                   # 智能体定义（原子）【SSOT】
├── Crews/                    # 团队定义（组合）
├── Systems/                  # 可部署系统（一等公民）
│
├── src/                      # 源代码（运行时实现）
│   ├── domain/               # 领域层（amazon-growth, geo-os 等）
│   ├── runtime/              # 运行时层（MCP, executor）
│   ├── kernel/               # 内核层（T1/T2/T3 World Model）
│   ├── brokers/              # LLM 调度器
│   └── adapters/             # 外部适配器
│
├── data/                     # 运行时数据
│   ├── stats/                # 统计数据
│   ├── traces/               # 执行轨迹
│   └── missions/             # 任务记录
│
├── tools/                    # 开发工具（整合 scripts）
│   ├── notion-sync/          # Notion 同步
│   ├── converters/           # 格式转换
│   └── web-publisher/        # 网站发布
│
├── tests/                    # 测试套件
├── docs/                     # 用户文档
├── examples/                 # 示例
│
├── Extensions/               # 能力扩展
│   ├── claude-skills/        # Claude Code Skills
│   └── mcp-servers/          # MCP 服务器
│
├── .claude/                  # Claude Code 集成
│   ├── packs/                # 按需加载上下文
│   └── scripts/              # 工具脚本
│
├── Artifacts_Vault/          # 成果库（整合 reports）
└── Projects_Engine/          # 项目引擎
```

### 第 4.1 条：SSOT（单一真相源）原则

**定义**：每种资源类型在系统中只能有一个权威定义位置。

**SSOT 映射表**：

| 资源类型 | SSOT 位置 | 禁止位置 |
|----------|-----------|----------|
| Agent 定义 | `Agents/` | `src/domain/*/agents/`, `config/agents.yaml` |
| Crew 定义 | `Crews/` | `src/domain/*/crews/` |
| 方法论 | `Skills/` | 散落的 `.md` 文件 |
| 架构文档 | `_meta/docs/` | 其他位置的架构说明 |

**运行时加载规则**：
- `src/domain/*/main.py` 必须从 SSOT 位置加载资源
- 使用 `agent_loader.py` 从 `Agents/` 动态加载
- 禁止在 `config/` 中维护 Agent 副本

**违规处理**：发现 SSOT 违规时，立即删除非权威副本。

### 第 4.2 条：Symlink 治理

**定义**：Symlinks 是**临时兼容层**，用于平滑迁移，不是永久架构。

**核心规则**：
1. **禁止新增**：新增 symlink 必须通过 RFC 审批
2. **必须退役**：每个 symlink 必须指定退役版本（通常 3 个次版本内）
3. **新代码禁用**：新代码禁止使用 symlink 路径，必须使用真实路径

**登记要求**：
- 所有 symlinks 必须在 `_meta/docs/SYMLINKS.md` 中登记
- 未登记的 symlink 视为违规，必须删除或补登

**当前 symlinks**（v6.1.1）：
| Symlink | 目标 | 退役版本 |
|---------|------|----------|
| governance | _meta/governance | v6.3.0 |
| schemas | _meta/schemas | v6.3.0 |
| templates | _meta/templates | v6.3.0 |
| stats | data/stats | v6.3.0 |
| traces | data/traces | v6.3.0 |
| adapters | src/adapters | v6.3.0 |
| reports | Artifacts_Vault/reports | v6.3.0 |
| scripts | tools | v6.3.0 |

### 第 4.3 条：生成产物治理

**定义**：Generated artifacts 是运行时产生的文件，不应入库。

**规则**：
1. `.claude/.compiled/` 目录不入库（已在 .gitignore）
2. `data/traces/` 中的运行时轨迹不入库（按需）
3. `Artifacts_Vault/reports/` 中的自动生成报告不入库（按需）

**例外**：
- 手动创建的配置文件可入库
- 版本发布的快照可入库

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

## 修订记录（Amendments）

### Amendment 2026-01-01-A: Symlink Retirement Enforcement

**版本**: v1.3
**生效日期**: 2026-01-01
**关联条款**: 第 4.2 条

**内容**：

1. **Symlink 必须包含 retire_by 版本**
   - 每个 symlink 在 `EXPECTED_SYMLINKS` 配置中必须声明 `retire_by` 字段
   - 格式：`vMAJOR.MINOR.PATCH`（如 `v6.3.0`）

2. **verify_v6_1.py 强制执行退役检查**
   - 当 `current_version >= retire_by` 时，验证脚本必须返回 exit code 1（FAIL）
   - CI 将因此阻止合并到主线

3. **OVERDUE 时的强制整改清单**
   - 验证脚本必须输出：
     - 需删除的 symlink 名称与目标路径
     - 建议的迁移动作（旧路径 → 新路径）
     - 受影响的代码引用（file:line，最多 30 条）

4. **Symlink 是临时兼容层**
   - OVERDUE 的 symlinks 是被禁止的
   - 必须在退役版本前完成迁移

**验证方式**：
```bash
# 正常运行（应 PASS）
python tools/audit/verify_v6_1.py

# 测试 OVERDUE 行为（应 FAIL）
LIYE_OS_VERSION=v6.3.0 python tools/audit/verify_v6_1.py

# 自测脚本
bash tools/audit/selftest_symlink_retire.sh
```

---

### Amendment 2026-01-01-B: Rollback Policy Hardening

**版本**: v1.3
**生效日期**: 2026-01-01
**关联条款**: 新增

**内容**：

1. **推荐的回滚方式是 tag/SHA checkout**
   - 确保可复现性和可追溯性
   - 格式：`git checkout v6.1.0` 或 `git checkout <sha>`

2. **紧急回滚使用 git revert**
   - 保留完整历史记录
   - 适用于已推送到远程的分支
   - 格式：`git revert HEAD~N..HEAD --no-commit`

3. **回滚后必须运行验证脚本**
   - 确认治理合规性
   - 命令：`python tools/audit/verify_v6_1.py`

4. **回滚操作必须记录**
   - 创建 issue 说明回滚原因
   - 记录影响范围和恢复时间

**理由**：
- `git checkout <branch>` 不够严谨，分支可能已变更
- Tag/SHA 提供精确的版本锁定
- Git revert 保留历史，便于审计

---

### Amendment 2026-01-01-C: Version SSOT for Governance

**版本**: v1.4
**生效日期**: 2026-01-01
**关联条款**: 第 4.1 条（SSOT 原则）

**内容**：

1. **current_version 必须来自 `config/version.txt`**
   - 该文件是 LiYe OS 当前版本的唯一权威源（SSOT）
   - 格式：`vMAJOR.MINOR.PATCH`（如 `v6.1.1`），无其他内容
   - 禁止在脚本中硬编码版本号

2. **verify 可允许环境变量覆盖，仅用于测试/自检**
   - 环境变量：`LIYE_OS_VERSION`
   - 当设置时，覆盖 `config/version.txt` 的值
   - 仅用于 selftest 和 CI 测试场景

3. **版本来源必须在输出中披露**
   - verify 脚本的所有输出必须显示版本来源
   - 格式：`source: file:config/version.txt` 或 `source: env:LIYE_OS_VERSION`
   - 确保透明度和可审计性

4. **版本文件缺失时必须立即失败**
   - 如果 `config/version.txt` 不存在或格式无效，verify 必须 exit 1
   - 不允许回退到默认值或硬编码值

**SSOT 映射表更新**：

| 资源类型 | SSOT 位置 | 禁止位置 |
|----------|-----------|----------|
| 系统版本 | `config/version.txt` | 脚本中的硬编码、其他配置文件 |

**验证方式**：
```bash
# 正常运行（显示 source: file:config/version.txt）
python tools/audit/verify_v6_1.py

# 环境变量覆盖（显示 source: env:LIYE_OS_VERSION）
LIYE_OS_VERSION=v6.3.0 python tools/audit/verify_v6_1.py

# 自测脚本
bash tools/audit/selftest_symlink_retire.sh
```

---

### Amendment 2026-01-01-D: World Model Gate for Domain Execution

**版本**: v1.5
**生效日期**: 2026-01-01
**关联条款**: 第 1 条（第一性原理）, 第 5 条（执行层规则）

**内容**：

1. **Domain 执行必须先通过 World Model Gate**
   - 任何 domain（如 amazon-growth）的执行必须先生成 WorldModelResult
   - WorldModelResult 必须包含 T1（失败模式）、T2（状态维度）、T3（动态模式）
   - validate_world_model_result() 必须通过，否则阻断执行

2. **World Model Trace/Artifact 是一级公民**
   - 每次执行必须写入 trace JSON：`data/traces/world_model/<trace_id>.json`
   - 每次执行必须写入 report MD：`Artifacts_Vault/reports/WORLD_MODEL_<trace_id>.md`
   - trace_id 格式：`wm_YYYYMMDD_HHMMSS_<uuid8>`

3. **禁止绕过 Gate**
   - 代码中禁止出现以下旁路标记（tests/ 目录除外）：
     - `skip_world_model`
     - `bypass_gate`
     - `WORLD_MODEL_DISABLED`
   - CI 扫描强制执行，违规阻断合并

4. **Dry-Run 模式必须存在**
   - 每个 domain 入口必须支持 `--dry-run` 参数
   - dry-run 只生成 World Model，不执行实际操作
   - 用于预览和审计

5. **"Not Telling You" 必须显式存在**
   - WorldModelResult 必须包含 `not_telling_you` 列表（>= 2 条）
   - 记录模型的盲点和限制
   - 禁止删除或隐藏此字段

**必填字段清单（MVP）**：
- `version`: "v1"
- `domain`: 域标识
- `task`: 任务描述
- `t1.failure_modes`: >= 3 条
- `t1.not_telling_you`: >= 2 条
- `t2.*`: 5 个维度（liquidity, correlation, expectation, leverage, uncertainty）
- `t3.dynamics`: >= 1 个
- `allowed_actions.allowed`: >= 3 条
- `allowed_actions.not_allowed`: >= 3 条
- `audit.trace_id`: 必填

**验证方式**：
```bash
# v6.2 验证（包含 World Model Gate）
python tools/audit/verify_v6_2.py

# dry-run 模式
python src/domain/amazon-growth/main.py --mode launch --product "Test" --dry-run
```

**参考文档**：
- `docs/architecture/WORLD_MODEL_CONSTITUTION.md`

---

### Amendment 2026-01-01-E: Mainline Version Policy

**版本**: v1.6
**生效日期**: 2026-01-01
**关联条款**: 第 4.1 条（SSOT 原则）, Amendment C

**内容**：

1. **main 分支禁止 RC 版本**
   - `config/version.txt` 在 main 分支上禁止包含 `-rc` 后缀
   - 允许的格式：`vX.Y.Z-dev`（开发版）、`vX.Y.Z`（正式版）
   - 错误码：`MAINLINE_RC_VERSION_FORBIDDEN`

2. **RC 版本的正确位置**
   - RC 版本通过 Git tag 冻结（如 `v6.2.0-rc1`）
   - 或在 release 分支上进行（如 `release/v6.2.0`）
   - main 分支保持滚动开发状态

3. **机器强制执行**
   - `tools/audit/verify_v6_2.py` CHECK F 在 CI 中阻断违规
   - 检查仅在 main 分支上执行，feature/release 分支豁免
   - 分支检测优先使用 CI 环境变量（`GITHUB_REF_NAME`），本地回退到 git

4. **版本生命周期**
   ```
   main (v6.2.1-dev)  →  feature/xxx  →  main (v6.2.1-dev)
                                              ↓
                                         tag v6.2.1-rc1
                                              ↓
                                         tag v6.2.1 (release)
                                              ↓
                                         main (v6.2.2-dev)
   ```

**验证方式**：
```bash
# 正常运行（非 main 分支时 SKIP，main 分支时检查）
python tools/audit/verify_v6_2.py

# 模拟 main 分支上有 RC 版本（应 FAIL）
GITHUB_REF_NAME=main LIYE_OS_VERSION=v6.2.0-rc1 python tools/audit/verify_v6_2.py
```

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

*宪法版本: 1.6*
*最后更新: 2026-01-01*
