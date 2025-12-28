---
name: artifacts-builder
description: 复杂前端 Artifacts 构建工具
domain: 00_Core_Utilities
category: development-tools
version: 1.0.0
status: active
source: awesome-claude-skills
source_url: https://github.com/ComposioHQ/awesome-claude-skills
license: Apache-2.0
---

# Artifacts Builder

> **来源**: ComposioHQ/awesome-claude-skills
> **适配**: LiYe OS 三层架构

创建复杂多组件 HTML artifacts，使用现代前端技术栈 (React, Tailwind CSS, shadcn/ui)。

## When to Use This Skill

当需要构建复杂前端界面时：
- 创建交互式仪表盘
- 构建数据展示界面
- 开发多组件 React 应用
- 实现复杂的 UI 布局
- 使用 shadcn/ui 组件库

## Core Capabilities

### 1. React 组件开发
```jsx
// 组件结构
const Dashboard = () => {
  const [data, setData] = useState([]);

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>销售概览</CardTitle>
        </CardHeader>
        <CardContent>
          <Chart data={data} />
        </CardContent>
      </Card>
    </div>
  );
};
```

### 2. Tailwind CSS 样式
- 原子化 CSS 类
- 响应式设计 (sm, md, lg, xl)
- 暗色模式支持
- 自定义主题

### 3. shadcn/ui 组件库
常用组件：
- `Button`, `Card`, `Dialog`
- `Table`, `Tabs`, `Form`
- `Select`, `Input`, `Checkbox`
- `Chart`, `Progress`, `Badge`

### 4. 多组件协调
- 状态管理
- 组件通信
- 数据流设计
- 性能优化

### 5. 响应式设计
- 移动优先
- 断点设计
- 弹性布局
- 自适应组件

## Usage Examples

### 示例 1: 销售仪表盘
```
用户: 帮我创建一个 Amazon 销售数据仪表盘
Claude: [使用 artifacts-builder 构建包含图表、表格、筛选器的仪表盘]
```

### 示例 2: 数据输入表单
```
用户: 创建一个关键词研究的数据录入界面
Claude: [使用 artifacts-builder 构建表单，包含验证和提交逻辑]
```

### 示例 3: 交互式报告
```
用户: 把这份报告做成一个可交互的网页
Claude: [使用 artifacts-builder 创建带导航、筛选、图表的交互报告]
```

## Dependencies

- React 18+
- Tailwind CSS 3+
- shadcn/ui 组件库
- Lucide React (图标)

## LiYe OS Integration

### 业务域引用
此技能被以下业务域引用：
- **06_Technical_Development**: 前端开发（主域）
- **02_Operation_Intelligence**: 运营仪表盘
- **07_Data_Science**: 数据可视化界面

### 三层架构位置
- **物理层 (本文件)**: Skills/00_Core_Utilities/development-tools/artifacts-builder/
- **逻辑层索引**: Skills/{domain}/index.yaml
- **L3 指令层**: .claude/skills/{domain}/artifacts-builder/

---
**Created**: 2025-12-28 | **Adapted for LiYe OS**
