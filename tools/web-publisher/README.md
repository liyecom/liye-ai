# GEO OS Web Publisher

**网站生成工具套件** - 将 GEO OS 处理的知识内容转化为垂类网站

---

## 📋 目录结构

```
web-publisher/
├── enhance.py              # AI 元数据增强脚本
├── json_to_astro.py        # JSON → Astro Markdown 转换器（待开发）
├── categorize.py           # 垂类分类脚本（待开发）
├── deploy.sh               # 批量部署脚本（待开发）
├── config/                 # 配置文件
│   ├── categories.yaml     # 垂类分类定义
│   └── affiliate.yaml      # 联盟产品库
└── requirements.txt        # Python 依赖
```

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd ~/github/liye_os/tools/web-publisher
pip3 install -r requirements.txt
```

### 2. 设置 API Key

```bash
export ANTHROPIC_API_KEY='your-api-key-here'
```

### 3. 测试 AI 增强（10 个 units）

```bash
python enhance.py --test --verbose
```

### 4. 全量处理

```bash
python enhance.py \
  --input ~/data/exports/shengcai/geo_units_v0.1.json \
  --output ~/data/exports/shengcai/enhanced_units.json
```

---

## 📖 工具说明

### enhance.py - AI 元数据增强

**功能：**
- 为每个 unit 生成完整的 SEO 元数据
- 推荐适合的联盟产品
- 生成 Call-to-Action 文案
- 推断用户意图（informational/commercial/transactional）

**用法：**
```bash
# 测试模式（只处理前 10 个）
python enhance.py --test

# 全量处理
python enhance.py --input /path/to/input.json --output /path/to/output.json

# 断点续传（从缓存恢复）
python enhance.py --resume

# 显示详细信息
python enhance.py --verbose
```

**输出示例：**
```json
{
  "id": "unit_000000",
  "content": "...",
  "title": "如何从0到1建立跨境电商业务",
  "description": "详细讲解跨境电商选品、供应链、营销的完整流程",
  "category": "跨境电商",
  "keywords": ["跨境电商", "选品", "供应链", "Amazon", "独立站"],
  "slug": "how-to-start-cross-border-ecommerce",
  "affiliate_products": ["amazon_seller_tools", "ecommerce_platforms"],
  "cta_text": "查看最佳 Amazon 卖家工具",
  "intent": "commercial"
}
```

**成本：**
- 模型：Claude 3.5 Sonnet
- 每个 unit：~600 tokens 输入 + ~300 tokens 输出 ≈ $0.0063
- 588 units：≈ $3.70

---

### categorize.py - 垂类分类（待开发）

**功能：**
- 根据关键词将 units 分配到不同的垂类网站
- 生成每个垂类的独立 JSON

**用法：**
```bash
python categorize.py \
  --input ~/data/exports/shengcai/enhanced_units.json \
  --output-dir ~/data/exports/shengcai/categories/
```

---

### json_to_astro.py - Astro 转换器（待开发）

**功能：**
- 将增强后的 JSON 转为 Astro Markdown 文件
- 生成 frontmatter（元数据）
- 插入联盟营销组件

**用法：**
```bash
python json_to_astro.py \
  --input ~/data/exports/shengcai/categories/amazon-optimization.json \
  --output ~/github/liye_os/websites/amazon-optimization/src/content/posts/
```

---

## 📝 配置文件

### categories.yaml - 垂类分类

定义 10 个垂类网站的分类规则：
- 关键词匹配
- 目标内容数
- 域名
- 主打联盟产品

### affiliate.yaml - 联盟产品库

定义可推广的联盟产品：
- Amazon 卖家工具（Jungle Scout, Helium 10, 卖家精灵）
- 电商平台（Shopify, WooCommerce）
- AI 写作工具（Jasper, Copy.ai）
- 营销软件（SEMrush, Ahrefs）
- 在线课程（Coursera, Udemy）
- 书籍（Amazon 联盟）

---

## 🔄 完整流水线

```bash
# Step 1: AI 增强
python enhance.py --input ~/data/exports/shengcai/geo_units_v0.1.json

# Step 2: 垂类分类（待开发）
python categorize.py --input ~/data/exports/shengcai/enhanced_units.json

# Step 3: 生成 Astro 网站（待开发）
python json_to_astro.py --category amazon-optimization

# Step 4: 批量部署（待开发）
bash deploy.sh
```

---

## 📊 成本估算

| 阶段 | 数量 | 单价 | 总成本 |
|------|------|------|--------|
| AI 增强（588 units） | 588 | $0.0063 | $3.70 |
| AI 增强（9,400 units） | 9,400 | $0.0063 | $59.22 |

---

## 🔗 参考文档

- [GEO OS 实施计划](../../.claude/plans/swirling-dancing-hummingbird.md)
- [架构宪法](../../_meta/docs/DIRECTORY_NAMING_CONSTITUTION.md)

---

**版本：** 0.1.0
**最后更新：** 2025-12-25
