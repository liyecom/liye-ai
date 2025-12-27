# 🎯 Amazon Operations Crew Skill (亚马逊全案运营智能体)

**Version**: v1.0
**Created**: 2025-12-19
**Domain**: 02_Operation_Intelligence
**Status**: ✅ Active

---

## 🔹01. Skill Identity

**Skill Name**: Amazon Operations Crew / 亚马逊运营智能体战队

**Core Mission**:
利用多智能体协作 (Multi-Agent Collaboration) 深度分析亚马逊市场数据，自动执行从关键词研究、Listing 撰写到竞品分析的全链路运营任务。

**Key Value Proposition**:
- **全案闭环**: 实现 "数据 -> 策略 -> 文案" 的端到端自动化。
- **双脑协同**: 左脑(分析师)处理数据，右脑(文案专家)生成创意。
- **本地化输出**: 支持 "Chinese Thinking, English Writing" (中文策略思考，英文内容交付)。

**Applicable Scenarios**:
1.  **新品上架**: 一键生成高质量的 Listing 文案。
2.  **老品优化**: 基于最新关键词数据重写 Title 和 Bullet Points。
3.  **竞品调研**: 快速生成 Top 10 竞品的优劣势分析报告。

---

## 🔹02. Capability Model

### Key Competencies

#### A. 关键词挖掘 (Keyword Discovery)
- **Agent**: Amazon Keyword Research Specialist
- **能力**: 读取卖家精灵/Helium10 数据，计算 TES 效能分，识别 Winner/Potential 关键词。

#### B. Listing 优化 (Listing Optimization)
- **Agent**: Amazon Listing Optimization Expert
- **能力**: 将高权重关键词自然埋入标题和五点描述，运用销售心理学提升转化率。

#### C. 竞品情报 (Competitive Intelligence)
- **Agent**: Amazon Competitor Intelligence Analyst
- **能力**: 监控竞品动向，发现市场空白点 (需配置相应任务)。

---

## 🔹03. Inputs & Outputs

### Inputs (运行参数)
| 参数名 | 说明 | 示例 |
| :--- | :--- | :--- |
| `product` | 产品名称或核心词 | "Washable Runner Rug" |
| `market` | 目标市场 | "Amazon US" |
| `file_path` | (可选) 数据源文件路径 | "data/sellersprite.xlsx" |

### Outputs (交付物)
- **`optimized_listing.md`**: 最终交付的 Listing 文案 (中英双语)。

---

## 🔹04. Execution Protocols

### Environment
- **Python**: 3.10+ (推荐 3.13)
- **Framework**: CrewAI 1.7.0
- **Model**: Claude 3.5 Sonnet / 4.5 (via Anthropic API)

### Usage

```bash
# 激活环境并运行
./run.sh --product "Running Shoes"
```

---

## 🔹05. Evolution Log

- **v1.0 (2025-12-19)**: Initial release. Migrated from `crewai-demo`.
    - Integrated Keyword Analyst & Listing Optimizer.
    - Standardized bilingual output format.

---

*This Skill is part of LiYe OS - A self-evolving personal AI capability system.*
