---
name: playwright
description: Web 自动化测试与浏览器控制
domain: 00_Core_Utilities
category: development-tools
version: 1.0.0
status: active
source: awesome-claude-skills
source_url: https://github.com/ComposioHQ/awesome-claude-skills
license: Apache-2.0

# SFC v0.1 Required Fields
skeleton: "workflow"
triggers:
  commands: ["/playwright"]
  patterns: ["playwright"]
inputs:
  required: []
  optional: []
outputs:
  artifacts: ["SKILL.md"]
failure_modes:
  - symptom: "Missing required inputs or context"
    recovery: "Provide the missing info and retry"
  - symptom: "Unexpected tool/runtime failure"
    recovery: "Rerun with minimal steps; escalate after 3 failures"
verification:
  evidence_required: true
  how_to_verify: ["node .claude/scripts/sfc_lint.mjs <skill_dir>"]
governance:
  constitution: "_meta/governance/SKILL_CONSTITUTION_v0.1.md"
  policy: "_meta/policies/DEFAULT_SKILL_POLICY.md"
---

# Playwright Browser Automation

> **来源**: ComposioHQ/awesome-claude-skills
> **适配**: LiYe OS 三层架构

基于 Playwright 的 Web 自动化测试，验证前端功能、调试 UI 行为、截图。

## When to Use This Skill

当需要 Web 自动化时：
- 自动化测试 Web 应用
- 验证前端功能
- 调试 UI 行为
- 截图和录屏
- 跨浏览器测试

## Core Capabilities

### 1. 浏览器自动化
```typescript
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://example.com');
await page.click('button#submit');
await browser.close();
```

### 2. 元素交互
```typescript
// 点击
await page.click('button.primary');

// 填写表单
await page.fill('input[name="email"]', 'user@example.com');

// 选择下拉
await page.selectOption('select#country', 'US');

// 等待元素
await page.waitForSelector('.loading', { state: 'hidden' });
```

### 3. 截图与录屏
```typescript
// 截图
await page.screenshot({ path: 'screenshot.png' });

// 全页面截图
await page.screenshot({ path: 'full.png', fullPage: true });

// 录制视频
const context = await browser.newContext({
  recordVideo: { dir: 'videos/' }
});
```

### 4. 断言与验证
```typescript
import { expect } from '@playwright/test';

// 文本断言
await expect(page.locator('h1')).toHaveText('Welcome');

// 可见性断言
await expect(page.locator('.modal')).toBeVisible();

// URL 断言
await expect(page).toHaveURL(/.*dashboard/);
```

### 5. 跨浏览器测试
- Chromium (Chrome, Edge)
- Firefox
- WebKit (Safari)
- 移动设备模拟

## Usage Examples

### 示例 1: 测试登录流程
```
用户: 帮我自动化测试网站的登录流程
Claude: [使用 playwright 编写登录测试脚本，验证成功和失败场景]
```

### 示例 2: 网页截图
```
用户: 帮我截取这个页面在不同设备上的样子
Claude: [使用 playwright 模拟手机、平板、桌面，分别截图]
```

### 示例 3: 表单自动填写
```
用户: 帮我自动填写这个复杂的表单
Claude: [使用 playwright 定位元素并填写表单数据]
```

## Dependencies

- Node.js 16+
- Playwright 库
- 浏览器引擎 (Chromium/Firefox/WebKit)

## LiYe OS Integration

### 业务域引用
此技能被以下业务域引用：
- **06_Technical_Development**: Web 自动化（主域）
- **02_Operation_Intelligence**: 竞品页面监控

### 与其他技能的配合
- **artifacts-builder**: 测试构建的前端组件
- **mcp-builder**: 为 MCP 工具提供浏览器能力

### 三层架构位置
- **物理层 (本文件)**: Skills/00_Core_Utilities/development-tools/playwright/
- **逻辑层索引**: Skills/{domain}/index.yaml
- **L3 指令层**: .claude/skills/{domain}/playwright/

---
**Created**: 2025-12-28 | **Adapted for LiYe OS**
