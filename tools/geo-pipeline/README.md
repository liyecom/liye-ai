# GEO OS v0.1 - Knowledge Engine

> Core System of LiYe OS
> Layer: Core Infrastructure
> Status: 🚧 In Development (多数据源支持已实现)

## 📋 Purpose

将散落的原始文档（PDF、DOCX等）转换为结构化、可被系统消费的知识单元。

**GEO OS在LiYe OS中的定位**：

```
Application Systems (Amazon OS, Research OS, etc.)
           ↓ (consumes geo_units.json)
       GEO OS ← YOU ARE HERE
           ↓ (processes)
      Truth Sources (~/data/archives/)
        ├── geo_seo      [Priority 1] GEO-SEO 知识库
        ├── shengcai     [Priority 2] 生财有术知识库
        └── ...          [扩展中]
```

---

## 🎯 What v0.1 Does

### ✅ 核心功能

1. **Normalize**: 各类文档 → Markdown
   - 复用 `tools/converters/` 现有工具
   - 支持 PDF, DOCX, 等多种格式
   - 输出标准化的 Markdown

2. **Chunk**: 长文档 → 固定大小chunks
   - 滑动窗口分块（可配置大小和重叠）
   - 保持语义完整性
   - 输出 chunks JSON

3. **Extract**: 提取结构
   - 提取 Markdown 标题（H1-H3）
   - 提取列表项
   - 生成结构化 metadata

4. **Export**: 输出JSON
   - 统一的 `geo_units.json` 格式
   - 系统可直接消费
   - 创建 `latest` 软链接

### ❌ What v0.1 Does NOT Do

- ❌ 向量化（留给v0.2）
- ❌ AI生成（留给v0.2）
- ❌ 知识图谱（留给v0.2）
- ❌ 实体识别（留给v0.2）

**原则**：v0.1只做确定性处理，无AI依赖。

---

## 🚀 Quick Start

### Installation

```bash
# 1. 确保在LiYe OS根目录
cd ~/github/liye_os

# 2. 安装依赖
pip3 install --break-system-packages PyYAML

# 3. 验证架构
python3 _meta/governance/validator.py
```

### Basic Usage

```bash
# 进入GEO OS目录
cd src/domain/geo

# 列出所有数据源
python3 run.py --list-sources

# 干运行（查看会处理什么）
python3 run.py --dry-run

# 处理所有启用的数据源
python3 run.py

# 只处理指定数据源
python3 run.py --source geo_seo

# 详细输出
python3 run.py --verbose
```

### Check Output

```bash
# TODO: 查看生成的units
# cat ~/data/exports/shengcai/geo_units_v0.1.json | python3 -m json.tool | head -50

# TODO: 查看统计
# cat ~/data/exports/shengcai/geo_units_v0.1.json | python3 -c "import sys, json; d=json.load(sys.stdin); print(f\"Units: {d['unit_count']}\")"
```

---

## 📂 Directory Structure

```
geo/
├── README.md                    # 本文件
├── run.py                       # ⭐ 主入口
├── config/
│   └── geo.yaml                 # 配置文件
├── ingestion/
│   ├── __init__.py
│   └── normalize.py             # Step 1: 标准化
├── processing/
│   ├── __init__.py
│   ├── chunk.py                 # Step 2: 分块
│   └── extract.py               # Step 3: 提取结构
├── outputs/
│   ├── __init__.py
│   └── export_json.py           # Step 4: 导出JSON
├── examples/
│   └── amazon_integration.py    # 集成示例
└── tests/
    └── __init__.py
```

---

## 🔧 Configuration

配置文件位于 `config/geo.yaml`：

```yaml
# 真相源定义
sources:
  geo_seo:
    name: GEO-SEO Knowledge Base
    path: ~/data/archives/geo_seo
    priority: 1
    enabled: true

  shengcai:
    name: ShengCai Library
    path: ~/data/archives/shengcai
    priority: 2
    enabled: true

# 路径模板
paths:
  source_template: ~/data/archives/{source}
  processed_template: ~/data/processed/{source}
  exports_template: ~/data/exports/{source}
  merged_exports: ~/data/exports/_merged

# 处理参数
processing:
  chunk_size: 600        # 分块大小
  chunk_overlap: 100     # 重叠大小
  max_heading_level: 3   # 最大标题层级
```

---

## 📊 Output Format

GEO OS输出的 `geo_units_v0.1.json` 格式：

```json
{
  "version": "0.1.0",
  "source": "~/data/archives/shengcai",
  "processed_at": "2025-12-23T14:00:00",
  "unit_count": 1234,
  "units": [
    {
      "id": "unit_000001",
      "source_file": "/path/to/original.pdf",
      "chunk_index": 0,
      "content": "实际内容...",
      "metadata": {
        "headings": [
          {"level": 1, "text": "标题"},
          {"level": 2, "text": "子标题"}
        ],
        "bullets": ["要点1", "要点2"],
        "char_count": 600
      },
      "embeddings": null,    // v0.2
      "entities": null,      // v0.2
      "claims": null         // v0.2
    }
  ]
}
```

---

## 🔗 Integration

### 在Application Systems中使用

参考 `examples/amazon_integration.py`：

```python
from Systems.geo_os.examples.amazon_integration import GEOKnowledgeReader

# 初始化reader
reader = GEOKnowledgeReader()

# 搜索知识
results = reader.search("亚马逊")

# 按主题查询
results = reader.get_by_topic("选品")

# 获取统计
stats = reader.stats()
```

---

## 📝 Development Status

### ✅ Phase 0: 架构准备 (已完成)
- [x] 创建 Systems/REGISTRY.yaml
- [x] 创建 _meta/governance/validator.py
- [x] 创建数据目录
- [x] 通过架构验证

### 🚧 Phase 1: 目录结构 (当前)
- [x] 创建完整目录结构
- [x] 创建配置文件
- [x] 创建代码文件骨架
- [x] 创建README
- [ ] **TODO: 实现核心代码**

### ⏳ Phase 2: 实现和测试 (待开始)
- [ ] 实现 normalize.py
- [ ] 实现 chunk.py
- [ ] 实现 extract.py
- [ ] 实现 export_json.py
- [ ] 小规模测试
- [ ] 全量处理

### ⏳ Phase 3: 集成 (待开始)
- [ ] Amazon Growth OS 集成
- [ ] 更新 CLAUDE.md
- [ ] 文档完善

---

## 🎓 Architecture Compliance

GEO OS遵守LiYe OS架构宪法：

- ✅ 注册在 `Systems/REGISTRY.yaml` (layer: core)
- ✅ 不依赖 Application Systems
- ✅ 数据边界清晰（processed/, exports/）
- ✅ 通过 `_meta/governance/validator.py` 验证

### Dependencies

```yaml
geo:
  layer: core
  dependencies: []        # 无依赖
  provides:
    - geo_units.json
  consumes:
    - ~/data/archives/*
```

---

## 📚 Next Steps

1. **实现代码**
   - 按TODO标记逐步实现
   - 每个模块独立测试
   - 保持代码简洁

2. **测试**
   - 小数据集测试
   - 验证输出格式
   - 性能评估

3. **集成**
   - Amazon Growth OS集成
   - 文档更新
   - 用户指南

---

## 🤝 Contributing

代码风格：
- 遵循PEP 8
- 清晰的TODO标记
- 充分的注释
- 简洁优于复杂

---

**Version**: 0.1.0  
**Status**: In Development  
**Last Updated**: 2025-12-23
