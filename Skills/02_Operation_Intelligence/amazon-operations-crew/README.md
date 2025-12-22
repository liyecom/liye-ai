# Amazon Operations Crew (v2.0)

本 Skill 是一个基于 CrewAI 的亚马逊运营智能体，具备「新品开发」和「老品诊断」双重能力。它集成了 SellersSprite (卖家精灵) API，可实现全自动流量分析与 Listing 优化。

## 🌟 核心功能
*   **Launch Mode (新品开发)**: 挖掘高潜力市场词，通过 TES 模型筛选，自动撰写高转化 Listing。
*   **Optimize Mode (Listing 诊断)**: 反查 ASIN 流量词，对比现有 Listing，识别错过的流量入口并提出 PPC 建议。

## 📂 目录结构
```text
amazon-operations-crew/
├── config/             # 任务与 Agent 配置文件
├── data/inputs/        # [手工模式] 存放卖家精灵导出的 Excel/CSV 文件
├── reports/            # [自动归档] 存放分析报告与原始数据
│   ├── markdown/       # 可读报告 (.md)
│   └── raw_data/       # API 原始数据 (.json)
├── tools/              # 工具代码 (SellersSprite API 封装)
├── main.py             # 主程序
└── run.sh              # 启动脚本
```

## 🚀 快速开始

### 1. 环境准备
确保已配置 `.env` 文件并填入 `SELLERSPRITE_API_KEY`。

### 2. 运行模式

#### 🅰️ API 全自动模式 (推荐)
无需下载文件，智能体直接联网获取近 30 天精准数据。
```bash
# 诊断/优化老品
./run.sh --mode optimize --asin "B0C5Q9Y6YF"
```

#### 🅱️ 手动文件模式 (Manual File Mode)
当 API 不可用或需分析特定历史数据时使用。

1.  **导出数据**: 从卖家精灵下载表格。
2.  **存入目录**: 放入 `data/inputs/` (例如 `data/inputs/my_keywords.xlsx`)。
3.  **运行命令**:
    ```bash
    ./run.sh --mode optimize --asin "B0C5Q9Y6YF" --file_path "data/inputs/my_keywords.xlsx"
    ```

## 📊 输出结果
运行完成后，请在其下目录查看：
*   最新结果: `optimized_listing.md` (会被覆盖)
*   **历史归档**: `reports/markdown/{ASIN}_{Time}.md` (永久保存)
