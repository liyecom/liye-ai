# Intelligent Agent Design (智能体设计)

**领域**: 06_Technical_Development (技术开发)
**状态**: ✅ 已激活 (由全局 CrewAI 技能驱动)
**类型**: 方法论框架 & 工具集

## 🔹 技能身份 (Skill Identity)

本技能提供设计、编排和部署基于 **CrewAI** 框架的多智能体系统的能力。它是 LiYe OS 智能自动化策略的"技术实现层"。

## 🔗 全局技能引用

本技能由通过 Skill Forge 安装的强大 **CrewAI Skill** 提供支持。

- **全局位置**: `~/.claude/skills/crewai/`
- **定义文件**: `~/.claude/skills/crewai/SKILL.md`

## 📂 包含的行业模板

全局技能包含与 LiYe OS 领域对齐的预置模板：

| 模板名称 | LiYe OS 领域映射 | 实现内容 |
|---------|-----------------|---------|
| **ecommerce-operations** | `02_Operation_Intelligence` | 亚马逊关键词分析 (TES 模型), Listing 优化 |
| **medical-research** | `05_Medical_Intelligence` | 循证医学, 临床报告生成 |
| **content-creation** | `03_Creative_Production` | SEO 内容策略, SERP 分析 |
| **business-analysis** | `02_Analysis_Strategy` | 战略分析, 报告生成 |

## 🚀 如何使用 (How to Use)

### 环境要求 (Prerequisites)
- **Python**: `>=3.10` (推荐 Python 3.13)
- **API Key**: Anthropic API Key (需支持 Claude 3.5/4.5)

### 验证过的运行方式 (Run in `venv`)
由于系统环境限制，强烈建议使用虚拟环境运行：

```bash
# 1. 准备目录
mkdir my-amazon-crew && cd my-amazon-crew

# 2. 从模板初始化 (以亚马逊运营为例)
# (假设模板已就位，或从 github/skill-forge 复制)

# 3. 创建并激活 Python 3.13 环境
python3.13 -m venv venv
source venv/bin/activate

# 4. 安装核心依赖
pip install crewai litellm python-dotenv anthropic httpx[socks]

# 5. 配置环境
# 创建 .env 并填入 ANTHROPIC_API_KEY=<YOUR_ANTHROPIC_API_KEY>

# 6. 运行
python main.py
```

## 📚 演化日志 (Evolution Log)

- **2025-12-19**: 技能正式集成到 LiYe OS。通过 Skill Forge 自动安装，包含 4 个行业模板。
- **2025-12-19**: 验证了 Python 3.13 + CrewAI 1.7.0 的兼容性，解决了 `BaseTool` 导入和 SOCKS 代理问题。成功实现了中英双语输出 (Chinese Reasoning, English Content)。
