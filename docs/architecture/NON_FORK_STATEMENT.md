# Non-Fork Statement

> **Version**: 1.0
> **Date**: 2025-12-27
> **Status**: Active

本声明用于明确 LiYe OS 与外部项目之间的技术关系边界。

---

## 1. 声明目的

消除对"Tri-Fork Fusion"的误解，明确 LiYe OS：
- **不包含** 任何第三方项目的源代码
- **不依赖** 第三方代码的直接拷贝
- **借鉴** 上游项目的设计理念和架构模式

---

## 2. 与上游项目的关系

### 2.1 BMad Method

| 项目 | 关系说明 |
|------|---------|
| **关系类型** | 理念借鉴 |
| **LiYe OS 包含其源代码？** | No |
| **具体借鉴内容** | Phase/Stage 概念、Persona 模板、Workflow DSL 思想 |
| **LiYe OS 实现** | `src/method/` 下的原创 YAML 规范 |

### 2.2 CrewAI

| 项目 | 关系说明 |
|------|---------|
| **关系类型** | pip 依赖 + 模式参考 |
| **LiYe OS 包含其源代码？** | No（通过 pip 安装调用） |
| **具体依赖** | `crewai==1.7.0` 用于 Python Crew 执行 |
| **LiYe OS 实现** | `src/runtime/` 下的原创 TypeScript 抽象层 |

### 2.3 Skill Forge

| 项目 | 关系说明 |
|------|---------|
| **关系类型** | 概念参考 |
| **LiYe OS 包含其源代码？** | No |
| **具体借鉴内容** | Skill 结构、Registry 模式 |
| **LiYe OS 实现** | `src/skill/` 下的原创 TypeScript 实现 |

---

## 3. 技术事实

### 3.1 代码统计

| 层级 | 语言 | 实现方式 |
|------|------|---------|
| Method Layer | YAML | LiYe OS 原创 |
| Runtime Layer | TypeScript | LiYe OS 原创 |
| Skill Layer | TypeScript | LiYe OS 原创 |
| Domain Layer | TypeScript + Python | LiYe OS 原创 + pip 依赖调用 |

### 3.2 外部依赖

LiYe OS 的唯一外部代码依赖是通过包管理器安装的标准依赖：
- `crewai` (pip) - 用于 Python Crew 执行
- 其他 npm/pip 依赖 - 见 package.json / requirements.txt

---

## 4. 许可证合规

| 上游项目 | 许可证 | LiYe OS 合规状态 |
|----------|--------|-----------------|
| BMad Method | Apache 2.0 | OK - 无源代码使用，无需合规 |
| CrewAI | MIT | OK - 作为 pip 依赖使用，MIT 允许 |
| Skill Forge | MIT | OK - 无源代码使用，无需合规 |

---

## 5. 总结声明

> **"Inspiration is allowed. Inheritance is not."**
>
> LiYe OS 的 "Tri-Fork Fusion" 指的是：
> - Fork **理念**，而非代码
> - **原创**实现，而非拼装系统
> - **依赖**调用，而非源码继承
>
> LiYe OS 是一个**架构独立、实现独立、演进独立**的 AI 原生操作系统。

---

## 6. 相关文档

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 主架构宪章
- [TRI_FORK_IMPLEMENTATION.md](./TRI_FORK_IMPLEMENTATION.md) - 实现细节
- [Glossaries/architecture.md](../../Glossaries/architecture.md) - 术语表

---

**Document Version**: 1.0
**Last Updated**: 2025-12-27
