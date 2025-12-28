# Tri-Fork Fusion: Implementation Details

> **Version**: 1.0
> **Date**: 2025-12-27
> **Status**: Active
> **Parent**: [ARCHITECTURE.md](./ARCHITECTURE.md) (FROZEN v3.1)

本文档详细说明 ARCHITECTURE.md 中定义的 Tri-Fork Fusion 架构的**实际实现状态**和**调用方式**。

---

## 1. Tri-Fork 实现状态总览

### 1.1 核心结论

| 上游项目 | Fork 方式 | 实现状态 |
|----------|----------|----------|
| **BMad Method** | 理念借鉴 | ✅ 原创 YAML 规范 |
| **CrewAI** | pip 依赖 + 原创抽象层 | ✅ TypeScript Runtime + Python 执行 |
| **Skill Forge** | Claude Code 工具 + 原创实现 | ✅ TypeScript Skill 层 |

### 1.2 关键原则

```
Tri-Fork ≠ Copy Source Code
Tri-Fork = 借鉴理念 + 原创实现 + 依赖调用
```

---

## 2. BMad Method 融合详情

### 2.1 实现方式

- **不包含** BMad Method 源代码
- **借鉴** 其方法论理念（Phase/Stage、Persona、Workflow DSL）
- **原创实现** `src/method/` 下的 YAML 规范

### 2.2 文件位置

```
src/method/                 # LiYe OS 原创 Method 层
├── personas/               # Agent 人设定义（借鉴 BMad Persona 概念）
├── workflows/              # 工作流定义（借鉴 BMad Workflow 概念）
├── phases/                 # 阶段定义（借鉴 BMad Phase 概念）
├── tracks/                 # 轨道规则
└── evolution/              # 进化协议
```

### 2.3 外部资源（不在 liye_os 中）

```
~/websites/banfan.net/.bmad-core/    # BMad 原始 fork（用于其他项目）
~/websites/ceshibao.com/.bmad-core/  # BMad 原始 fork
```

### 2.4 调用关系

```
LiYe OS 不直接调用 BMad
         │
         └──→ 只借鉴其设计理念，用于 src/method/ 的规范设计
```

---

## 3. CrewAI 融合详情

### 3.1 实现方式

- **不包含** CrewAI 源代码
- **pip 依赖** 用于实际执行 Python Crew
- **原创实现** TypeScript Runtime 层（借鉴 CrewAI 模式）
- **Claude 技能** 用于设计指导

### 3.2 文件位置

```
LiYe OS 内部
├── src/runtime/                      # ⭐ 原创 TypeScript Runtime
│   ├── executor/
│   │   ├── agent.ts                  # Agent 执行器（注释标注 "← CrewAI pattern"）
│   │   └── types.ts
│   ├── scheduler/
│   │   └── dag.ts                    # DAG 调度器
│   ├── memory/
│   │   └── context.ts                # 上下文管理
│   └── evolution/
│
└── src/domain/venv/                  # ⭐ Python 虚拟环境
    └── lib/python3.13/site-packages/
        ├── crewai/                   # pip install crewai==1.7.0
        └── crewai_tools/             # pip install crewai-tools

外部资源（Home 目录）
├── ~/.claude/skills/crewai/          # ⭐ Claude Code 技能
│   ├── SKILL.md                      # 技能定义
│   └── references/                   # 参考文档
│       ├── overview.md               # 概述
│       ├── agents-and-tasks.md       # Agent/Task 详解
│       ├── crews-and-flows.md        # Crew/Flow 详解
│       ├── configuration-guide.md    # 配置指南
│       └── api-examples.md           # API 示例
│
├── ~/.config/crewai/                 # CrewAI CLI 配置
└── ~/Library/Application Support/crewai/  # CrewAI 应用数据
```

### 3.3 调用方式

#### 方式 1：Python venv 直接执行（用于实际任务）

```bash
# 激活虚拟环境
cd ~/github/liye_os/src/domain
source venv/bin/activate

# 使用 CrewAI CLI
crewai create crew my_crew
crewai run

# Python 代码调用
python3 << 'EOF'
from crewai import Agent, Task, Crew

agent = Agent(
    role="Researcher",
    goal="Find information",
    backstory="Expert researcher"
)
# ...
EOF
```

#### 方式 2：Claude Code 技能（用于设计指导）

```bash
# 在 Claude Code 中
/crewai 设计一个医疗研究的多智能体团队
/crewai 生成 agents.yaml 配置
/crewai 解释 Crew 和 Flow 的区别
```

#### 方式 3：TypeScript Runtime 调用 Python（系统集成）

```typescript
// src/runtime/executor/agent.ts
import { spawn } from 'child_process';

async function executeCrewAI(config: CrewConfig): Promise<CrewResult> {
  const venvPython = path.join(__dirname, '../../domain/venv/bin/python3');

  const process = spawn(venvPython, [
    '-c',
    `from crewai import Crew; Crew.from_yaml('${config}').kickoff()`
  ]);

  // ...
}
```

---

## 4. Skill Forge 融合详情

### 4.1 实现方式

- **不包含** Skill Forge 源代码
- **Claude 技能** 用于创建新技能
- **原创实现** TypeScript Skill 层

### 4.2 文件位置

```
LiYe OS 内部
└── src/skill/                        # ⭐ 原创 TypeScript Skill 层
    ├── types.ts                      # 类型定义
    ├── atomic/                       # 原子技能
    │   ├── market_research.ts
    │   ├── keyword_research.ts
    │   ├── competitor_analysis.ts
    │   └── content_optimization.ts
    ├── composite/                    # 组合技能
    ├── registry/
    │   └── index.ts                  # 技能注册表
    └── loader/
        └── index.ts                  # 技能加载器

外部资源（Home 目录）
├── ~/.claude/skills/skill-forge/     # ⭐ Claude Code 技能
│   ├── SKILL.md                      # 技能定义
│   ├── references/                   # 参考文档
│   │   ├── path-management.md
│   │   ├── source-detection.md
│   │   └── workflow-guide.md
│   └── scripts/                      # 可执行脚本
│
└── ~/.claude/plugins/marketplaces/anthropic-agent-skills/
    └── skills/                       # Anthropic 官方技能库
        ├── pdf/
        ├── docx/
        ├── xlsx/
        ├── pptx/
        └── ... (16 个官方技能)
```

### 4.3 调用方式

#### 方式 1：Claude Code 技能（创建新技能）

```bash
# 从 GitHub 仓库创建技能
/skill-forge 从 https://github.com/some/repo 创建技能

# 从在线文档创建技能
/skill-forge 从 https://docs.example.com 创建技能

# 从本地目录创建技能
/skill-forge 从 ~/my-project 创建技能
```

#### 方式 2：使用 LiYe OS Skill 层

```typescript
// 在 LiYe OS 代码中使用 Skill
import { loader } from './src/skill/loader';
import { Skill } from './src/skill/types';

const skill = loader.load('market_research') as Skill;
const result = await skill.execute({ query: 'amazon keywords' });
```

---

## 5. 资源地图总览

```
/Users/liye/
│
├── github/liye_os/                   # LiYe OS 主仓库
│   ├── src/
│   │   ├── method/                   # ① 原创 Method 层
│   │   ├── runtime/                  # ② 原创 Runtime 层 (TypeScript)
│   │   ├── skill/                    # ③ 原创 Skill 层 (TypeScript)
│   │   └── domain/
│   │       └── venv/                 # Python 虚拟环境
│   │           └── site-packages/
│   │               └── crewai/       # pip 依赖
│   │
│   └── docs/architecture/            # 架构文档
│       ├── ARCHITECTURE.md           # 主架构（FROZEN）
│       └── TRI_FORK_IMPLEMENTATION.md # 本文档
│
├── .claude/
│   ├── skills/
│   │   ├── crewai/                   # CrewAI 指导技能
│   │   └── skill-forge/              # Skill Forge 技能
│   │
│   └── plugins/marketplaces/
│       └── anthropic-agent-skills/   # Anthropic 官方技能
│
└── websites/
    └── *.com/.bmad-*/                # BMad fork（其他项目用）
```

---

## 6. 调用场景速查表

| 需求 | 推荐方式 | 具体命令/路径 |
|------|---------|--------------|
| **执行 AI Agent 任务** | Python venv | `cd src/domain && source venv/bin/activate && crewai run` |
| **学习 CrewAI 概念** | Claude Code | `/crewai 解释 Agent 的配置` |
| **设计 Agent 架构** | Claude Code | `/crewai 设计一个 [领域] 团队` |
| **生成 YAML 配置** | Claude Code | `/crewai 生成 agents.yaml` |
| **创建新技能** | Claude Code | `/skill-forge 从 [源] 创建技能` |
| **使用原子技能** | TypeScript | `import { loader } from './src/skill/loader'` |
| **系统级集成** | Runtime 层 | `src/runtime/executor/agent.ts` |

---

## 7. 设计决策记录

### 7.1 为什么不直接 fork 源代码？

| 考量 | fork 源代码 | 当前方案 |
|------|------------|----------|
| **维护成本** | 需同步上游更新 | pip 依赖自动更新 |
| **语言一致性** | Python + TypeScript 混合 | TypeScript 为主 + Python 调用 |
| **架构清晰度** | 边界模糊 | 四层分离清晰 |
| **许可证风险** | 需严格合规 | 依赖调用无风险 |

### 7.2 为什么选择 TypeScript + Python 混合？

- **TypeScript**：适合 Method、Skill 层的声明性定义
- **Python**：CrewAI 生态成熟，直接复用其执行能力
- **桥接**：Runtime 层通过子进程调用 Python

---

## 8. 相关文档

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 主架构宪章（FROZEN）
- [SKILL_SPEC.md](./SKILL_SPEC.md) - Skill 规范
- [AGENT_SPEC.md](./AGENT_SPEC.md) - Agent YAML 规范
- [WORKFLOW_DSL.md](./WORKFLOW_DSL.md) - Workflow DSL 规范

---

**Document Version**: 1.0
**Last Updated**: 2025-12-27
**Author**: LiYe OS Architecture Team
