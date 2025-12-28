# 📊 Excel Data Analysis Skill

**Version**: 1.0
**Created**: 2025-12-28
**Last Updated**: 2025-12-28
**Status**: Active
**Source**: Awesome Claude Skills → LiYe OS Adapted

---

## 🔹01. Skill Identity（技能身份）

**Skill Name**: Excel Data Analysis / 电子表格数据分析

**Core Mission**:
通过 Excel/CSV 数据处理能力，为 Amazon 跨境电商运营提供数据驱动的决策支持，包括销售数据分析、关键词研究、PPC 广告优化等场景。

**Capability Domain**: Operation Intelligence
- 销售数据清洗与分析
- 关键词报表处理
- PPC 广告数据透视
- 库存与供应链数据处理
- 财务报表生成

**Target Scenarios**:
- Amazon 销售日报/周报/月报生成
- 关键词排名趋势分析（SellerSprite 数据）
- PPC 广告 ACoS/TACoS 分析
- 库存周转率计算
- 利润率分析与成本核算

---

## 🔹02. Capability Model（能力模型）

### Key Competencies（核心能力维度）

#### A. 数据读取与解析
- 读取 .xlsx/.xlsm/.csv/.tsv 格式
- 处理多 Sheet 工作簿
- 识别数据类型（日期、货币、百分比）
- 处理合并单元格与复杂表头

#### B. 数据清洗与转换
- 缺失值处理（填充/删除/插值）
- 异常值检测与处理
- 数据类型转换
- 列拆分/合并/重命名

#### C. 公式与计算
- 基础聚合（SUM, AVERAGE, COUNT）
- 条件计算（SUMIF, COUNTIF, AVERAGEIF）
- 查找匹配（VLOOKUP, INDEX-MATCH）
- 日期函数（DATEDIF, WORKDAY, EOMONTH）

#### D. 数据透视与分析
- 数据透视表创建
- 分组汇总
- 趋势分析
- 同比/环比计算

#### E. 可视化输出
- 图表生成（柱状图、折线图、饼图）
- 条件格式（数据条、色阶、图标集）
- 迷你图（Sparklines）

---

## 🔹03. Mental Models / Principles（思维模型 / 原则）

### Core Thinking Frameworks

#### 1. MECE 原则（数据分类）
- **M**utually **E**xclusive: 分类不重叠
- **C**ollectively **E**xhaustive: 分类完整无遗漏

#### 2. 数据质量三角
```
         准确性
           △
          / \
         /   \
        /     \
       /_______\
    完整性    一致性
```

#### 3. 分析漏斗
```
原始数据 → 清洗 → 聚合 → 分析 → 洞察 → 行动
```

### Unbreakable Principles（不可违反原则）

1. **数据完整性**：不丢失原始数据，保留操作日志
2. **公式透明性**：复杂计算需注释说明
3. **格式一致性**：同类数据保持统一格式
4. **来源可追溯**：标注数据来源和更新时间

---

## 🔹04. Methods & SOPs（方法论 / 操作手册）

### Standard Operating Procedure: Excel Data Analysis

#### Phase 1: 数据获取与预检
```
Step 1.1 确认数据来源
  - 数据来源（Amazon 后台、SellerSprite、广告报表）
  - 数据时间范围
  - 数据完整性检查

Step 1.2 初步探索
  - 查看行数、列数
  - 识别数据类型
  - 发现明显异常
```

#### Phase 2: 数据清洗
```
Step 2.1 结构标准化
  - 统一列名（英文或中文）
  - 删除空行/空列
  - 处理合并单元格

Step 2.2 数据质量修复
  - 缺失值处理策略
  - 异常值标记或修正
  - 重复值去除

Step 2.3 类型转换
  - 日期格式统一
  - 数值格式统一
  - 文本清理（去空格、统一大小写）
```

#### Phase 3: 分析计算
```
Step 3.1 基础统计
  - 汇总统计（总计、平均、最大/最小）
  - 分布分析
  - 趋势识别

Step 3.2 高级分析
  - 透视表构建
  - 同比/环比计算
  - 关键指标计算（ACoS, TACoS, ROI）

Step 3.3 关联分析
  - 多表关联（VLOOKUP/关系）
  - 交叉分析
  - 归因分析
```

#### Phase 4: 输出交付
```
Step 4.1 结果呈现
  - 关键指标汇总表
  - 趋势图表
  - 数据透视视图

Step 4.2 报告生成
  - Executive Summary
  - 详细数据表
  - 附录（原始数据链接）
```

---

## 🔹05. Execution Protocols（执行协议）

### Pre-Execution Checklist

**必须确认的问题**：
1. ✓ 数据来源是什么？（Amazon 后台、第三方工具、手工录入）
2. ✓ 分析目标是什么？（趋势分析、异常检测、对比分析）
3. ✓ 关键指标有哪些？（销售额、订单量、ACoS、转化率）
4. ✓ 时间范围是什么？（日/周/月/季度/年）
5. ✓ 输出格式要求？（表格、图表、报告）

### Decision-Making Logic

**数据量大时**：
→ 优先使用数据透视表
→ 考虑分批处理

**多表关联时**：
→ 确定主键/外键
→ 检查数据一致性

**发现异常值时**：
→ 先标记，后确认
→ 与业务方核实

---

## 🔹06. Output Structure（标准化交付格式）

### Template: Amazon 销售周报

```markdown
# Amazon 销售周报

## 📊 核心指标
| 指标 | 本周 | 上周 | 环比 | 目标 | 达成率 |
|------|------|------|------|------|--------|
| 销售额 | $XX,XXX | $XX,XXX | +X% | $XX,XXX | X% |
| 订单数 | XXX | XXX | +X% | XXX | X% |
| 转化率 | X.X% | X.X% | +X% | X% | - |

## 📈 趋势分析
[7日趋势折线图]

## 🔍 Top 5 ASIN 表现
| 排名 | ASIN | 产品名称 | 销售额 | 同比 |
|------|------|----------|--------|------|

## ⚠️ 异常与风险
- [异常点1]
- [异常点2]

## 💡 下周行动建议
1. [建议1]
2. [建议2]
```

---

## 🔹07. Templates & Prompts（模板库）

### 激活 Prompt

```
激活 Excel Data Analysis Skill

数据文件：[文件名/路径]
分析目标：[具体目标]
关键指标：[指标列表]
输出要求：[表格/图表/报告]

请按照 skill_definition.md 的 SOP 执行分析。
```

### 常用公式模板

```excel
# 同比增长率
=(当期-同期)/同期

# ACoS 计算
=广告花费/广告销售额

# TACoS 计算
=广告花费/总销售额

# 库存周转天数
=平均库存/(销售成本/天数)
```

---

## 🔹08. Tools Access / Knowledge Assets（工具 & 知识接口）

### Required Dependencies
- openpyxl (Python)
- pandas (Python)
- xlsxwriter (Python)
- 或 xlsx-populate (Node.js)

### LiYe OS Integration Points

**数据来源**：
- SellerSprite 导出数据
- Amazon Seller Central 报表
- 广告控制台报表

**输出路径**：
- `Artifacts_Vault/reports/weekly/`
- `Artifacts_Vault/analysis/`

---

## 🔹09. Evaluation & Scoring（绩效 & 质量指标）

### Output Quality Metrics

| 维度 | 权重 | 评分标准 |
|------|------|----------|
| 数据准确性 | 40% | 计算结果无误，与原始数据一致 |
| 分析深度 | 25% | 不仅汇总，还有洞察 |
| 可视化质量 | 20% | 图表清晰，格式规范 |
| 可操作性 | 15% | 有明确的行动建议 |

### Self-Evaluation Checklist

- [ ] 原始数据已备份？
- [ ] 公式逻辑正确？
- [ ] 边界情况已处理？
- [ ] 输出格式符合要求？

---

## 🔹10. Feedback / Evolution Loop（进化循环机制）

### 持续改进触发条件

1. **新数据源接入**：更新 Phase 1 数据预检流程
2. **新指标需求**：扩充 Phase 3 计算公式库
3. **用户反馈**：优化输出格式和可视化

### 版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2025-12-28 | 初始版本创建 |

---

**END OF SKILL DEFINITION**
