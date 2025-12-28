---
name: software-architecture
description: 软件架构设计模式与最佳实践
domain: 00_Core_Utilities
category: meta
version: 1.0.0
status: active
source: awesome-claude-skills
source_url: https://github.com/ComposioHQ/awesome-claude-skills
license: Apache-2.0
---

# Software Architecture

> **来源**: ComposioHQ/awesome-claude-skills
> **适配**: LiYe OS 三层架构

实现设计模式，包括 Clean Architecture、SOLID 原则、GoF 设计模式等软件设计最佳实践。

## When to Use This Skill

当需要架构设计指导时：
- 设计新系统架构
- 重构现有代码结构
- 应用设计模式
- 编写架构决策记录 (ADR)
- 评审代码架构质量

## Core Capabilities

### 1. Clean Architecture
```
┌─────────────────────────────────────────┐
│           External Interfaces           │
│  (UI, DB, Web, Devices, External APIs)  │
├─────────────────────────────────────────┤
│          Interface Adapters             │
│   (Controllers, Gateways, Presenters)   │
├─────────────────────────────────────────┤
│           Application Layer             │
│          (Use Cases, Services)          │
├─────────────────────────────────────────┤
│            Domain Layer                 │
│     (Entities, Business Rules)          │
└─────────────────────────────────────────┘
```

### 2. SOLID 原则

| 原则 | 含义 | 示例 |
|------|------|------|
| **S**ingle Responsibility | 单一职责 | 一个类只做一件事 |
| **O**pen/Closed | 开闭原则 | 对扩展开放，对修改关闭 |
| **L**iskov Substitution | 里氏替换 | 子类可替换父类 |
| **I**nterface Segregation | 接口隔离 | 细粒度接口 |
| **D**ependency Inversion | 依赖倒置 | 依赖抽象而非实现 |

### 3. GoF 设计模式

**创建型模式**:
- Factory, Abstract Factory
- Builder, Prototype
- Singleton

**结构型模式**:
- Adapter, Bridge, Composite
- Decorator, Facade
- Flyweight, Proxy

**行为型模式**:
- Chain of Responsibility
- Command, Iterator
- Observer, Strategy
- Template Method, Visitor

### 4. 架构决策记录 (ADR)
```markdown
# ADR-001: 选择 PostgreSQL 作为主数据库

## 状态
已接受

## 背景
需要选择生产环境数据库...

## 决策
选择 PostgreSQL 因为...

## 后果
正面: ...
负面: ...
```

### 5. 代码组织模式
- 分层架构 (Layered)
- 六边形架构 (Hexagonal)
- 微服务架构
- 事件驱动架构
- CQRS 模式

## Usage Examples

### 示例 1: 新项目架构
```
用户: 帮我设计一个电商后端的架构
Claude: [使用 software-architecture 设计分层结构、定义边界、选择模式]
```

### 示例 2: 代码重构
```
用户: 这个模块太复杂了，帮我重构
Claude: [使用 software-architecture 识别问题、应用 SOLID、提取模式]
```

### 示例 3: 架构评审
```
用户: 帮我评审这个项目的架构
Claude: [使用 software-architecture 检查依赖方向、职责划分、扩展性]
```

## Dependencies

无外部依赖，纯方法论技能。

## LiYe OS Integration

### 业务域引用
此技能被以下业务域引用：
- **06_Technical_Development**: 软件架构（主域）
- **12_Meta_Cognition**: 系统性思维

### 与 LiYe OS 架构的关系
本技能的原则与 LiYe OS 架构宪章一致：
- 四层架构 (METHOD → RUNTIME → SKILL → DOMAIN)
- 依赖方向单向性
- 职责边界清晰

### 三层架构位置
- **物理层 (本文件)**: Skills/00_Core_Utilities/meta/software-architecture/
- **逻辑层索引**: Skills/{domain}/index.yaml
- **L3 指令层**: .claude/skills/{domain}/software-architecture/

---
**Created**: 2025-12-28 | **Adapted for LiYe OS**
