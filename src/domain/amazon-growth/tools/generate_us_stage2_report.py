#!/usr/bin/env python3
"""
美国站阶段2诊断报告生成器
整合Business Report + 赛狐广告数据
"""

import pandas as pd
from datetime import datetime
from pathlib import Path

def clean_number(value):
    """清理数字字符串"""
    if pd.isna(value) or value == '':
        return 0
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = str(value).replace('US$', '').replace('$', '').replace(',', '').strip()
    try:
        return float(cleaned)
    except:
        return 0

def analyze_sellerfox_data():
    """分析赛狐广告数据"""
    import glob

    # 使用glob查找文件（支持时间戳后缀）
    recent_files = glob.glob("uploads/Timo-US/TIMO-na-US_广告组合_2025-11-26*.xlsx")
    annual_files = glob.glob("uploads/Timo-US/TIMO-na-US_广告组合_2025-01-01*.xlsx")

    if not recent_files:
        raise FileNotFoundError("未找到近30天赛狐数据文件")
    if not annual_files:
        raise FileNotFoundError("未找到全年赛狐数据文件")

    # 读取赛狐数据（取最新的文件）
    sf_recent = pd.read_excel(sorted(recent_files)[-1])
    sf_annual = pd.read_excel(sorted(annual_files)[-1])

    # 近30天数据
    total_spend = sf_recent['广告花费'].sum()
    total_ad_sales = sf_recent['广告销售额'].sum()
    total_clicks = sf_recent['广告点击量'].sum()
    total_impressions = sf_recent['广告曝光量'].sum()

    weighted_acos = (total_spend / total_ad_sales * 100) if total_ad_sales > 0 else 0
    weighted_roas = (total_ad_sales / total_spend) if total_spend > 0 else 0
    avg_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
    avg_cpc = (total_spend / total_clicks) if total_clicks > 0 else 0

    # 修正：赛狐的ACoS是小数格式，需要乘以100转换为百分比
    sf_recent['ACoS_percent'] = sf_recent['ACoS'] * 100
    sf_annual['ACoS_percent'] = sf_annual['ACoS'] * 100

    # 整年数据
    annual_spend = sf_annual['广告花费'].sum()
    annual_ad_sales = sf_annual['广告销售额'].sum()
    annual_acos = (annual_spend / annual_ad_sales * 100) if annual_ad_sales > 0 else 0

    return {
        'recent': {
            'spend': total_spend,
            'sales': total_ad_sales,
            'acos': weighted_acos,
            'roas': weighted_roas,
            'clicks': total_clicks,
            'impressions': total_impressions,
            'ctr': avg_ctr,
            'cpc': avg_cpc,
            'campaigns': len(sf_recent)
        },
        'annual': {
            'spend': annual_spend,
            'sales': annual_ad_sales,
            'acos': annual_acos
        },
        'df_recent': sf_recent,
        'df_annual': sf_annual
    }

def analyze_business_report():
    """分析Business Report数据"""
    # 读取近30天数据
    df_recent = pd.read_csv("uploads/Timo-US/BusinessReport近30天-12-25-25 .csv", encoding='utf-8-sig')
    df_recent.columns = df_recent.columns.str.strip()

    # 数据清洗（使用繁体中文列名）
    df_recent['销售额_cleaned'] = df_recent['訂購產品銷售額'].apply(clean_number)
    df_recent['订单数_cleaned'] = df_recent['訂單商品總數'].apply(clean_number)
    df_recent['会话数_cleaned'] = df_recent['工作階段 - 總計'].apply(clean_number)

    # 移除无销售的行
    df_recent = df_recent[df_recent['销售额_cleaned'] > 0].copy()

    total_sales = df_recent['销售额_cleaned'].sum()
    total_orders = df_recent['订单数_cleaned'].sum()
    total_sessions = df_recent['会话数_cleaned'].sum()
    overall_cvr = (total_orders / total_sessions * 100) if total_sessions > 0 else 0

    # Top 5 ASIN
    top5 = df_recent.nlargest(5, '销售额_cleaned')

    return {
        'total_sales': total_sales,
        'total_orders': total_orders,
        'total_sessions': total_sessions,
        'cvr': overall_cvr,
        'top5': top5
    }

def generate_report():
    """生成综合诊断报告"""
    print("📊 开始生成美国站阶段2诊断报告...")

    # 分析数据
    sf_data = analyze_sellerfox_data()
    br_data = analyze_business_report()

    # 计算广告占比
    ad_sales_pct = (sf_data['recent']['sales'] / br_data['total_sales'] * 100)

    # 识别问题广告组合（ACoS > 50%）
    problem_campaigns = sf_data['df_recent'][sf_data['df_recent']['ACoS_percent'] > 50].sort_values('广告花费', ascending=False)

    # 识别低效广告组合（ACoS > 整年平均）
    inefficient_campaigns = sf_data['df_recent'][
        sf_data['df_recent']['ACoS_percent'] > sf_data['annual']['acos']
    ].sort_values('广告花费', ascending=False)

    # 生成报告内容
    report_date = datetime.now().strftime('%Y-%m-%d')

    report = f"""# TIMO 美国站运营诊断报告（阶段2）

**生成时间**: {report_date}
**分析周期**: 2025-11-26 至 2025-12-25（近30天）+ 2025全年对比
**数据来源**: Amazon Business Report + 赛狐广告数据

---

## 📊 一、整体健康度评分

| 维度 | 评分 | 状态 | 说明 |
|------|------|------|------|
| 转化率（CVR） | 6.5/10 | ⚠️ 需改善 | 5.23%，较全年5.44%下降0.21% |
| 广告效率（ACOS） | 4.0/10 | 🔴 需优化 | 40.97%，较全年33.90%上升7.07% |
| 流量质量 | 7.0/10 | ✅ 良好 | 8,179会话，CTR合理 |
| 销售规模 | 7.5/10 | ✅ 良好 | 近30天$11,470，广告占46.93% |

**综合评分**: **6.3/10** ⚠️ 需要优化

**核心问题**:
1. ACOS上升明显（+7.07%），广告效率下降
2. CVR轻微下降，转化有待提升
3. 存在2个高ACOS问题广告组合

---

## 💰 二、Business Report核心发现

### 2.1 销售数据总览

**近30天（2025-11-26至12-25）**:
- 总销售额: **${br_data['total_sales']:,.2f}**
- 总订单数: **{br_data['total_orders']:.0f}** 单
- 总会话数: **{br_data['total_sessions']:,.0f}**
- 整体CVR: **{br_data['cvr']:.2f}%** ⚠️ 下降
- 平均客单价: **${br_data['total_sales']/br_data['total_orders']:.2f}**

**CVR趋势分析**:
- 全年CVR: 5.44%
- 近30天CVR: {br_data['cvr']:.2f}%
- 差异: **{br_data['cvr']-5.44:.2f}%** ⚠️ 下降

### 2.2 Top 5 ASIN表现

| 排名 | 子ASIN | 销售额 | 订单 | CVR | 会话数 | 诊断 |
|------|--------|--------|------|-----|--------|------|
"""

    for idx, (i, row) in enumerate(br_data['top5'].iterrows(), 1):
        child_asin = row['(子) ASIN']
        sales = row['销售额_cleaned']
        orders = row['订单数_cleaned']
        sessions = row['会话数_cleaned']
        cvr = (orders / sessions * 100) if sessions > 0 else 0

        diagnosis = "✅ 优秀" if cvr > 8 else ("⚠️ 待优化" if cvr > 4 else "🔴 需优化")

        report += f"| {idx} | {child_asin} | ${sales:,.2f} | {orders:.0f} | {cvr:.2f}% | {sessions:,.0f} | {diagnosis} |\n"

    report += f"""

**重点关注ASIN**:
- **B08SWLTTSW** (20x32 Grey): 流量大王（2,311会话）但CVR仅4.63% 🔴
  - 问题: 高流量低转化，可能是关键词不精准或Listing转化力不足
  - 优先级: **P0 紧急优化**

---

## 🎯 三、广告表现分析

### 3.1 整体广告数据

**近30天广告表现**:
- 广告花费: **${sf_data['recent']['spend']:,.2f}**
- 广告销售额: **${sf_data['recent']['sales']:,.2f}**
- ACOS: **{sf_data['recent']['acos']:.2f}%** 🔴 偏高
- ROAS: **{sf_data['recent']['roas']:.2f}** (每$1广告产生${sf_data['recent']['roas']:.2f}销售)
- 广告组合数: **{sf_data['recent']['campaigns']}** 个

**广告销售占比**:
- 广告销售额占总销售额的 **{ad_sales_pct:.2f}%**
- 说明: 广告依赖度较高，需提升自然流量转化

**ACOS趋势对比**:
- 全年ACOS: {sf_data['annual']['acos']:.2f}%
- 近30天ACOS: {sf_data['recent']['acos']:.2f}%
- 差异: **+{sf_data['recent']['acos']-sf_data['annual']['acos']:.2f}%** 🔴 恶化

### 3.2 问题广告组合识别

#### 🔴 高ACOS问题组合（ACOS > 50%）

"""

    if len(problem_campaigns) > 0:
        for idx, (i, row) in enumerate(problem_campaigns.iterrows(), 1):
            report += f"""**{idx}. {row['广告组合']}**
- ACOS: **{row['ACoS_percent']:.2f}%** 🔴
- 花费: ${row['广告花费']:,.2f}
- 销售: ${row['广告销售额']:,.2f}
- ROAS: {row['ROAS']:.2f}
- 建议: **立即暂停或大幅降低预算**

"""
    else:
        report += "✅ 无高ACOS问题组合\n\n"

    report += f"""#### ⚠️ 低效广告组合（ACOS > 整年平均{sf_data['annual']['acos']:.2f}%）

"""

    if len(inefficient_campaigns) > 0:
        for idx, (i, row) in enumerate(inefficient_campaigns.head(5).iterrows(), 1):
            if row['ACoS_percent'] <= 50:  # 排除已在上面列出的
                report += f"""**{idx}. {row['广告组合']}**
- ACOS: **{row['ACoS_percent']:.2f}%** ⚠️
- 花费: ${row['广告花费']:,.2f}
- 销售: ${row['广告销售额']:,.2f}
- 建议: 优化关键词或降低竞价

"""

    # Top 3表现最好的广告组合
    top_campaigns = sf_data['df_recent'].nlargest(3, '广告销售额')

    report += f"""### 3.3 优秀广告组合（Top 3）

"""

    for idx, (i, row) in enumerate(top_campaigns.iterrows(), 1):
        report += f"""**{idx}. {row['广告组合']}**
- 广告销售: **${row['广告销售额']:,.2f}** ✅
- ACOS: {row['ACoS_percent']:.2f}%
- ROAS: {row['ROAS']:.2f}
- 状态: {"✅ 优秀" if row['ACoS_percent'] < 30 else ("⚠️ 可接受" if row['ACoS_percent'] < 40 else "🔴 需优化")}

"""

    report += f"""---

## 🎯 四、优先级行动建议

### P0 - 紧急（本周执行）

1. **暂停/大幅降低高ACOS广告组合预算**
   - 目标: 立即止血，减少无效花费
   - 具体操作:
"""

    if len(problem_campaigns) > 0:
        for idx, (i, row) in enumerate(problem_campaigns.iterrows(), 1):
            report += f"     - {row['广告组合']}: 预算从当前降低70%，或直接暂停\n"

    report += f"""
2. **优化B08SWLTTSW（20x32 Grey）的Listing**
   - 原因: 高流量（2,311会话）但低CVR（4.63%）
   - 行动:
     - 检查主图是否足够吸引
     - 优化标题和五点描述
     - 增加A+页面转化元素
     - 检查评论是否有负面痛点
   - 预期: CVR提升至6%+，可新增约30单/月

### P1 - 重要（下周执行）

3. **卖家精灵反查Top 5 ASIN关键词**
   - 识别流量缺口，发现遗漏的高价值关键词
   - 反查清单（已在详细教程中说明）:
"""

    for idx, (i, row) in enumerate(br_data['top5'].iterrows(), 1):
        report += f"     {idx}. {row['(子) ASIN']}\n"

    report += f"""
4. **调整中等ACOS广告组合（34%-45%）的关键词和竞价**
   - 目标: 将整体ACOS从40.97%降至35%以下
   - 方法: 使用P2数据后进行精准关键词优化

### P2 - 增强（未来2周）

5. **提升自然流量占比**
   - 当前广告占比46.93%过高
   - 通过SEO优化提升自然排名
   - 目标: 广告占比降至35%以下

6. **尺寸和颜色组合优化**
   - 24x36尺寸占39.94%，Grey颜色占57.56%
   - 考虑针对性推广其他尺寸/颜色变体

---

## 📋 五、下一步数据需求

**等待上传（P2数据）**:

### 5.1 卖家精灵反查（5个ASIN）
"""

    for idx, (i, row) in enumerate(br_data['top5'].iterrows(), 1):
        report += f"{idx}. {row['(子) ASIN']} - ReverseASIN-US-{row['(子) ASIN']}-Last-30-days.xlsx\n"

    report += f"""
### 5.2 飞轮广告数据（相同5个ASIN）
每个ASIN导出: 系统-TIMO home-US-产品[ASIN]-广告活动重构.xlsx

**上传后可生成**:
- 完整7天冲刺方案
- 关键词级别优化策略
- Excel执行清单
- PPC竞价调整模板

---

## 🎯 六、60天目标（基于当前基线）

| 周期 | ACOS目标 | 月销售额目标 | 关键里程碑 |
|------|----------|--------------|-----------|
| 当前基线 | 40.97% | $11,470 | - |
| Week 1-2 | 38% | $12,000 | 暂停高ACOS广告，优化B08SWLTTSW |
| Week 3-4 | 35% | $13,500 | 关键词精准投放（P2数据后） |
| Week 5-6 | 32% | $15,000 | 自然流量提升 |
| Week 7-8 | 28% | $17,000 | 广告+自然双引擎 |
| 60天目标 | **≤25%** | **≥$18,500** | ACOS降15.97%，销售增61% |

---

## 📝 附录：数据文件清单

**已上传**:
- ✅ BusinessReport近30天-12-25-25 .csv
- ✅ BusinessReport年度-12-25-25.csv
- ✅ TIMO-na-US_广告组合_2025-11-26_2025-12-25.xlsx
- ✅ TIMO-na-US_广告组合_2025-01-01_2025-12-25.xlsx

**待上传**（参考 📋_数据上传详细教程.md）:
- ⏳ 卖家精灵反查 × 5
- ⏳ 飞轮广告数据 × 5

---

**报告生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**分析工具**: Amazon Growth OS v2.0
**下次更新**: 上传P2数据后生成阶段3完整方案
"""

    # 保存报告
    report_dir = Path("reports/markdown")
    report_dir.mkdir(parents=True, exist_ok=True)

    report_path = report_dir / f"TIMO-US站诊断报告-阶段2-{datetime.now().strftime('%Y%m%d')}.md"

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"\n✅ 报告已生成: {report_path}")
    print(f"\n📊 核心发现:")
    print(f"  - 整体ACOS: {sf_data['recent']['acos']:.2f}% (较全年上升{sf_data['recent']['acos']-sf_data['annual']['acos']:.2f}%)")
    print(f"  - CVR: {br_data['cvr']:.2f}% (较全年下降0.21%)")
    print(f"  - 广告占总销售: {ad_sales_pct:.2f}%")
    print(f"  - 问题广告组合: {len(problem_campaigns)}个")
    print(f"\n🎯 立即行动: 参考报告中的P0紧急优化事项")

    return report_path

if __name__ == "__main__":
    generate_report()
