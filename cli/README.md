# LiYe CLI

> LiYe OS 的命令行入口工具

## 安装

```bash
# 全局安装
npm install -g liye-ai

# 或在项目内使用
npm link
```

## 快速使用

```bash
# 最常用：一句话编译专家上下文
liye "帮我分析亚马逊关键词"
liye "帮我建个网站"
liye "帮我分析比特币行情"
```

## 命令列表

### 快捷命令

```bash
liye "任务描述"              # 根据任务自动编译专家上下文
```

### Agent 命令

```bash
liye agent list              # 列出所有智能体
liye agent validate <name>   # 验证智能体配置
liye agent scaffold v5 --from <source>  # 从 v3 迁移到 v5
```

### Skill 命令

```bash
liye skill list              # 列出所有技能
liye skill validate <name>   # 验证技能配置
```

### Report 命令

```bash
liye report architecture           # 生成架构合规报告
liye report architecture --json    # JSON 格式输出
liye report architecture --fail-only  # 只显示失败项
liye report architecture --domain amazon  # 指定领域
```

### 帮助

```bash
liye --help                  # 显示帮助
liye --version               # 显示版本号
```

## 职责边界

### CLI 做什么

| ✅ 做的事 | 说明 |
|----------|------|
| 解析命令行参数 | 理解用户输入 |
| 路由到正确处理器 | 分发到 agent/skill/report 模块 |
| 调用 assembler.mjs | 触发上下文编译 |
| 提供治理工具 | validate, report, scaffold |
| 输出彩色日志 | 友好的用户体验 |

### CLI 不做什么

| ❌ 不做的事 | 由谁负责 |
|-----------|----------|
| 编译上下文 | assembler.mjs（OS 组件） |
| 执行 Agent | Runtime 层 |
| 定义业务逻辑 | Domain 层 |
| 管理知识资产 | OS（Packs/Skills/Agents） |

## 与 LiYe OS 的关系

```
CLI (入口) → assembler.mjs (编译) → context.md (输出)
                  ↓
         读取 OS 资产（Packs/Skills/Roles）
```

**关键点**：
- CLI 是入口，OS 是能力
- CLI 不包含业务逻辑
- assembler.mjs 属于 OS，不是 CLI 组件

## 开发

### 目录结构

```
cli/
├── index.js           # 主入口（命令路由）
├── commands/          # 命令实现
│   ├── agent-validate.js
│   ├── agent-scaffold.js
│   ├── agent-list.js
│   ├── skill-validate.js
│   └── skill-list.js
├── validators/        # 验证器
│   └── agent-v5.js
└── report/            # 报告生成
    └── architecture.js
```

### 添加新命令

1. 在 `commands/` 创建新文件
2. 在 `index.js` 的 `handleXxx()` 中添加路由
3. 导出异步函数 `module.exports = async (target, repoRoot) => { ... }`

## 版本

- CLI 版本：v5.0
- 代码量：~1,600 行
- 依赖：Node.js 18+（无第三方框架）

---

*LiYe CLI 是 LiYe OS 的一部分，遵循 Apache License 2.0*
