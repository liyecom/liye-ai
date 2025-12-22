# Context Pack: Operations（跨境/亚马逊/运营）

**加载条件：** 涉及 Amazon/ASIN/Listing/PPC/关键词/跨境/Timo/运营系统时加载。

## Amazon Growth OS

**位置：** `Systems/amazon-growth-os/`

**用途：** 新品 Launch、老品 Optimize、关键词策略、PPC 分层优化、竞品与漏斗诊断

**架构组件：**
- 数据采集：广告报表、BSR、评论、竞品监控
- 分析引擎：关键词分层、流量漏斗、品牌健康度评分
- 策略引擎：出价优化、预算分配、A/B测试
- 执行系统：批量操作、自动化报告、告警通知

**常用入口（从 repo 根目录）：**

```bash
cd Systems/amazon-growth-os

# 新品 Launch 模式
./run.sh --mode launch --product "XXX" --market "Amazon US"

# 老品优化模式
./run.sh --mode optimize --asin "B0XXXXXXX"

# 关键词审查
python src/keyword_analyzer.py --asin B0XXX --output reports/

# PPC 优化
python src/bidding/bid_engine.py --campaign-id XXX
```

**数据目录：**
- `data/inputs/` - 原始数据（广告报表、BSR等）
- `data/outputs/` - 分析结果
- `data/databases/` - DuckDB 数据库
- `uploads/` - 临时上传文件（应 gitignore）

**环境配置：**
```bash
# 复制环境变量模板
cp .env.example .env

# 必需变量
AMAZON_API_KEY=...
OPENAI_API_KEY=...
```

## amazon-keyword-analysis（TES 框架）

**位置：** `Skills/02_Operation_Intelligence/amazon-keyword-analysis/`

**核心方法论：** TES（Test-养-榨-守-删）关键词生命周期管理

### TES 框架详解

| 阶段 | 目标 | 动作 | 退出条件 |
|-----|------|------|---------|
| **Test** 测试期 | 验证流量质量 | 广泛匹配低出价 | 7天有转化 OR 100次曝光无转化 |
| **养** 成长期 | 提升自然排名 | 词组/精准，提升出价 | 自然排名进前20 OR ACOS>50% |
| **榨** 收割期 | 最大化利润 | 降低出价，监控ACOS | ACOS>目标OR自然排名掉出前30 |
| **守** 防御期 | 保持排名 | 低出价防守 | 竞品威胁OR预算不足 |
| **删** 淘汰 | 停止浪费 | 停用/删除 | - |

**关键原则：**
1. 不要只看单一 ACOS - 要看关键词的"生命周期价值"
2. 测试期允许高 ACOS（投资未来排名）
3. 成长期关注自然排名提升速度
4. 收割期严格控制 ACOS 目标
5. 定期审查（每月）将关键词在 TES 阶段间流转

### 常用分析维度

```python
# 关键词分层
- Tier 1: 核心转化词（ACOS <30%, 周转化>5）
- Tier 2: 潜力词（ACOS 30-50%, 周转化1-5）
- Tier 3: 测试词（ACOS >50% OR 无转化）

# 流量质量评估
CTR（点击率）→ CVR（转化率）→ ACOS → 利润率

# 竞品对标
份额占比 → 排名变化 → 流量截流
```

## 运营 SOP（标准操作流程）

### 新品 Launch 检查清单

```markdown
- [ ] Listing 优化完成（标题、5点、A+、视频）
- [ ] 关键词库建立（核心词50+长尾词200）
- [ ] 广告架构搭建（自动+手动+品牌+展示）
- [ ] 预算分配计划（测试期 vs 成长期）
- [ ] 竞品监控设置（价格、排名、评论）
- [ ] 数据看板配置（转化漏斗、健康度评分）
```

### 老品优化检查清单

```markdown
- [ ] 诊断：流量/转化/利润三大漏斗
- [ ] 关键词：TES 阶段审查和调整
- [ ] 广告：出价优化、否词更新、预算再分配
- [ ] Listing：CTR/CVR 优化（图片、视频、评论）
- [ ] 库存：避免断货、控制冗余
- [ ] 竞品：份额变化、策略调整
```

## Evolution / 复盘沉淀

**原则：** 交付物归档 + 洞察提炼 + 方法更新（不要把长记录塞回 CLAUDE.md）

**流程：**
1. 每次运营动作记录到 `Artifacts_Vault/by_project/`
2. 月度复盘提炼洞察到 `methods.md`
3. 成功案例沉淀到 `templates/`
4. 失败教训更新到 `guardrails.md`

**示例结构：**
```
Artifacts_Vault/by_project/
└── timo_canada_q4_2024/
    ├── README.md              # 项目概览
    ├── listing_optimization/  # Listing 优化记录
    ├── ppc_campaigns/         # 广告优化记录
    ├── insights.md            # 关键洞察
    └── results.csv            # 数据结果
```

## 数据隐私和安全

**敏感数据：** 不要提交到 Git
- `.env` - API 密钥
- `uploads/` - 原始广告报表
- `data/databases/*.duckdb` - 数据库文件
- 任何包含 ASIN、销售额、利润的原始文件

**处理方式：**
1. 在 `.gitignore` 中明确排除
2. 使用 `data_external/` 软链接指向 Git 外部存储
3. 分享时脱敏（替换 ASIN、金额等）

---

**Char Count:** ~4,800 / 15,000 ✅
