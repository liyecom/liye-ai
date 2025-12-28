# 00_Core_Utilities

> **状态**: `ACTIVE` - 核心工具域

## 定位

核心工具域 - 存放通用技能的物理层（后仓），按技术能力分类组织。

## 设计原则

LiYe OS 采用**分层设计**组织技能：

```
物理层（本域）                     逻辑层（业务域）
00_Core_Utilities/                 02_Operation_Intelligence/
├── document-processing/           └── index.yaml
│   ├── xlsx/     ◄──────────────────── ref: xlsx
│   └── pdf/                           usage: Amazon 数据分析
└── data-analysis/
    └── csv-summarizer/ ◄────────────── ref: csv-summarizer
```

**核心理念**：
- **物理层按技术分类**：便于维护、共享依赖
- **逻辑层按业务分类**：便于发现、按需引用
- **单一事实来源**：技能只存一份，多处引用

## 目录结构

```
00_Core_Utilities/
├── document-processing/     # 文档处理技能
│   ├── xlsx/                # Excel 操作
│   ├── pdf/                 # PDF 操作
│   ├── docx/                # Word 操作
│   └── pptx/                # PPT 操作
├── data-analysis/           # 数据分析技能
│   └── csv-summarizer/      # CSV 自动洞察
├── development-tools/       # 开发工具技能
│   ├── mcp-builder/         # MCP 服务器构建
│   ├── playwright/          # Web 自动化
│   └── artifacts-builder/   # 复杂前端构建
├── productivity/            # 生产力技能
│   └── kaizen/              # 持续改进方法论
├── creative/                # 创意技能
│   ├── canvas-design/       # 视觉设计
│   └── theme-factory/       # 主题系统
├── communication/           # 沟通技能
│   └── content-writer/      # 内容写作
└── meta/                    # 元技能
    ├── skill-creator/       # 技能创建
    ├── prompt-engineering/  # 提示工程
    └── software-architecture/ # 架构设计
```

## 技能引用方式

业务域通过 `index.yaml` 引用本域技能：

```yaml
# Skills/02_Operation_Intelligence/index.yaml
domain: 02_Operation_Intelligence
name: 运营智能
skills:
  - ref: 00_Core_Utilities/document-processing/xlsx
    alias: excel-analysis
    usage: Amazon 销售数据分析
```

## 来源

本域技能来自 [Awesome Claude Skills](https://github.com/ComposioHQ/awesome-claude-skills) 项目，经过 LiYe OS 三层架构适配。

## 参考

- 分层设计方案: `/Users/liye/.claude/plans/foamy-frolicking-eich.md`
- 技能规范: `/docs/architecture/SKILL_SPEC.md`
- 架构宪章: `/_meta/docs/ARCHITECTURE_CONSTITUTION.md`

---
**Created**: 2025-12-28 | **Status**: ACTIVE (核心工具域)
