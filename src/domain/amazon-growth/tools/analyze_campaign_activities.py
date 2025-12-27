#!/usr/bin/env python3
"""
广告活动深度分析脚本
分析所有广告组合下的广告活动表现，识别烧钱问题活动
"""

import pandas as pd
import glob
from pathlib import Path
from datetime import datetime
import re

def extract_portfolio_name(filename):
    """从文件名提取广告组合名称"""
    # 匹配模式：TIMO-na-US-组合XX_广告活动 或 TIMO-na-US_广告活动-组合XX
    match1 = re.search(r'组合([^_]+)_广告活动', filename)
    match2 = re.search(r'广告活动-组合([^_]+)_', filename)

    if match1:
        return match1.group(1)
    elif match2:
        return match2.group(1)
    else:
        return "未知"

def load_all_campaign_data():
    """加载所有广告活动数据"""
    print("📊 开始加载广告活动数据...")

    all_files = glob.glob("uploads/Timo-US/*广告活动*.xlsx")

    # 分类为近30天和全年
    recent_files = [f for f in all_files if '20251126' in f or '20251125' in f]
    annual_files = [f for f in all_files if '20250101' in f]

    print(f"找到文件:")
    print(f"  - 近30天: {len(recent_files)} 个")
    print(f"  - 全年: {len(annual_files)} 个")

    recent_data = []
    annual_data = []

    # 加载近30天数据
    for file in recent_files:
        try:
            df = pd.read_excel(file)
            portfolio = extract_portfolio_name(Path(file).name)
            df['广告组合'] = portfolio
            df['时间周期'] = '近30天'
            df['ACoS_percent'] = df['ACoS'] * 100  # 转换为百分比
            recent_data.append(df)
        except Exception as e:
            print(f"⚠️ 读取失败: {Path(file).name} - {e}")

    # 加载全年数据
    for file in annual_files:
        try:
            df = pd.read_excel(file)
            portfolio = extract_portfolio_name(Path(file).name)
            df['广告组合'] = portfolio
            df['时间周期'] = '全年'
            df['ACoS_percent'] = df['ACoS'] * 100
            annual_data.append(df)
        except Exception as e:
            print(f"⚠️ 读取失败: {Path(file).name} - {e}")

    df_recent = pd.concat(recent_data, ignore_index=True) if recent_data else pd.DataFrame()
    df_annual = pd.concat(annual_data, ignore_index=True) if annual_data else pd.DataFrame()

    print(f"\n✅ 数据加载完成:")
    print(f"  - 近30天广告活动数: {len(df_recent)}")
    print(f"  - 全年广告活动数: {len(df_annual)}")

    return df_recent, df_annual

def analyze_campaigns(df_recent, df_annual):
    """深度分析广告活动"""
    print("\n" + "="*80)
    print("🔍 开始深度分析广告活动")
    print("="*80)

    analysis = {}

    # 1. 识别高ACOS烧钱活动（近30天）
    high_acos = df_recent[
        (df_recent['ACoS_percent'] > 50) & (df_recent['广告花费'] > 10)
    ].sort_values('广告花费', ascending=False)

    analysis['high_acos_campaigns'] = high_acos

    print(f"\n🔴 高ACOS烧钱活动（ACOS > 50% 且花费 > $10）: {len(high_acos)} 个")
    if len(high_acos) > 0:
        print(f"总花费: ${high_acos['广告花费'].sum():,.2f}")
        print(f"总销售: ${high_acos['广告销售额'].sum():,.2f}")
        print(f"平均ACOS: {high_acos['ACoS_percent'].mean():.2f}%")

    # 2. 识别零销售活动（近30天有花费但零销售）
    zero_sales = df_recent[
        (df_recent['广告花费'] > 5) & (df_recent['广告销售额'] == 0)
    ].sort_values('广告花费', ascending=False)

    analysis['zero_sales_campaigns'] = zero_sales

    print(f"\n❌ 零销售烧钱活动（花费 > $5 但销售 = $0）: {len(zero_sales)} 个")
    if len(zero_sales) > 0:
        print(f"浪费花费: ${zero_sales['广告花费'].sum():,.2f}")

    # 3. 识别低效活动（ACOS > 40% 且花费 > $50）
    inefficient = df_recent[
        (df_recent['ACoS_percent'] > 40) &
        (df_recent['ACoS_percent'] <= 50) &
        (df_recent['广告花费'] > 50)
    ].sort_values('广告花费', ascending=False)

    analysis['inefficient_campaigns'] = inefficient

    print(f"\n⚠️ 低效活动（40% < ACOS <= 50% 且花费 > $50）: {len(inefficient)} 个")
    if len(inefficient) > 0:
        print(f"总花费: ${inefficient['广告花费'].sum():,.2f}")

    # 4. 识别优秀活动（ACOS < 30% 且销售额 > $100）
    excellent = df_recent[
        (df_recent['ACoS_percent'] < 30) & (df_recent['广告销售额'] > 100)
    ].sort_values('广告销售额', ascending=False)

    analysis['excellent_campaigns'] = excellent

    print(f"\n✅ 优秀活动（ACOS < 30% 且销售 > $100）: {len(excellent)} 个")
    if len(excellent) > 0:
        print(f"总销售: ${excellent['广告销售额'].sum():,.2f}")
        print(f"平均ACOS: {excellent['ACoS_percent'].mean():.2f}%")

    # 5. 按广告组合分组统计
    portfolio_stats = df_recent.groupby('广告组合').agg({
        '广告花费': 'sum',
        '广告销售额': 'sum',
        '广告活动': 'count'
    }).reset_index()

    portfolio_stats['ACOS'] = (portfolio_stats['广告花费'] / portfolio_stats['广告销售额'] * 100).fillna(0)
    portfolio_stats = portfolio_stats.sort_values('广告花费', ascending=False)
    portfolio_stats.columns = ['广告组合', '总花费', '总销售', '活动数', 'ACOS']

    analysis['portfolio_stats'] = portfolio_stats

    print(f"\n📊 按广告组合汇总（近30天）:")
    print(portfolio_stats.to_string(index=False))

    # 6. 趋势分析（对比近30天 vs 全年）
    if len(df_annual) > 0:
        trend_analysis = []

        for portfolio in df_recent['广告组合'].unique():
            recent_portfolio = df_recent[df_recent['广告组合'] == portfolio]
            annual_portfolio = df_annual[df_annual['广告组合'] == portfolio]

            if len(annual_portfolio) > 0:
                recent_acos = (recent_portfolio['广告花费'].sum() / recent_portfolio['广告销售额'].sum() * 100) if recent_portfolio['广告销售额'].sum() > 0 else 0
                annual_acos = (annual_portfolio['广告花费'].sum() / annual_portfolio['广告销售额'].sum() * 100) if annual_portfolio['广告销售额'].sum() > 0 else 0

                trend_analysis.append({
                    '广告组合': portfolio,
                    '近30天ACOS': recent_acos,
                    '全年ACOS': annual_acos,
                    '变化': recent_acos - annual_acos,
                    '趋势': '🔴 恶化' if recent_acos > annual_acos else '✅ 改善'
                })

        df_trend = pd.DataFrame(trend_analysis).sort_values('变化', ascending=False)
        analysis['trend_analysis'] = df_trend

        print(f"\n📈 ACOS趋势分析（近30天 vs 全年）:")
        print(df_trend.to_string(index=False))

    return analysis

def generate_audit_report(analysis, df_recent, df_annual):
    """生成广告活动审计报告"""
    print("\n📝 开始生成审计报告...")

    report_date = datetime.now().strftime('%Y-%m-%d')

    report = f"""# TIMO 美国站广告活动深度审计报告

**生成时间**: {report_date}
**分析周期**: 近30天（2025-11-26至12-25）+ 全年对比
**数据来源**: 赛狐广告活动层级数据

---

## 📊 一、总体概况

### 1.1 数据概览

**近30天**:
- 总广告活动数: **{len(df_recent)}** 个
- 活跃活动（有花费）: **{len(df_recent[df_recent['广告花费'] > 0])}** 个
- 总花费: **${df_recent['广告花费'].sum():,.2f}**
- 总销售: **${df_recent['广告销售额'].sum():,.2f}**
- 整体ACOS: **{(df_recent['广告花费'].sum() / df_recent['广告销售额'].sum() * 100) if df_recent['广告销售额'].sum() > 0 else 0:.2f}%**

**全年**:
- 总广告活动数: **{len(df_annual)}** 个
- 总花费: **${df_annual['广告花费'].sum():,.2f}**
- 总销售: **${df_annual['广告销售额'].sum():,.2f}**
- 整体ACOS: **{(df_annual['广告花费'].sum() / df_annual['广告销售额'].sum() * 100) if df_annual['广告销售额'].sum() > 0 else 0:.2f}%**

---

## 🔴 二、问题广告活动识别（P0紧急）

### 2.1 高ACOS烧钱活动（ACOS > 50%，花费 > $10）

**数量**: {len(analysis['high_acos_campaigns'])} 个
**浪费花费**: ${analysis['high_acos_campaigns']['广告花费'].sum():,.2f}
**产生销售**: ${analysis['high_acos_campaigns']['广告销售额'].sum():,.2f}
**建议**: **立即暂停或大幅降低预算**

"""

    # 高ACOS活动明细
    if len(analysis['high_acos_campaigns']) > 0:
        report += "\n#### 高ACOS活动明细（按花费排序）\n\n"
        report += "| 排名 | 广告组合 | 广告活动 | ACOS | 花费 | 销售 | ROAS | 建议 |\n"
        report += "|------|---------|---------|------|------|------|------|------|\n"

        for idx, (i, row) in enumerate(analysis['high_acos_campaigns'].head(20).iterrows(), 1):
            report += f"| {idx} | {row['广告组合']} | {row['广告活动'][:40]}... | **{row['ACoS_percent']:.2f}%** | ${row['广告花费']:.2f} | ${row['广告销售额']:.2f} | {row['ROAS']:.2f} | 立即暂停 |\n"

    # 零销售活动
    report += f"\n### 2.2 零销售烧钱活动（花费 > $5，销售 = $0）\n\n"
    report += f"**数量**: {len(analysis['zero_sales_campaigns'])} 个  \n"
    report += f"**浪费花费**: ${analysis['zero_sales_campaigns']['广告花费'].sum():,.2f}  \n"
    report += f"**建议**: **立即暂停**\n\n"

    if len(analysis['zero_sales_campaigns']) > 0:
        report += "#### 零销售活动明细\n\n"
        report += "| 排名 | 广告组合 | 广告活动 | 花费 | 曝光 | 点击 | 建议 |\n"
        report += "|------|---------|---------|------|------|------|------|\n"

        for idx, (i, row) in enumerate(analysis['zero_sales_campaigns'].head(15).iterrows(), 1):
            impressions = row.get('广告曝光量', 0)
            clicks = row.get('广告点击量', 0)
            report += f"| {idx} | {row['广告组合']} | {row['广告活动'][:40]}... | ${row['广告花费']:.2f} | {impressions:,.0f} | {clicks:,.0f} | 立即暂停 |\n"

    # 低效活动
    report += f"\n### 2.3 低效活动（40% < ACOS <= 50%，花费 > $50）\n\n"
    report += f"**数量**: {len(analysis['inefficient_campaigns'])} 个  \n"
    report += f"**总花费**: ${analysis['inefficient_campaigns']['广告花费'].sum():,.2f}  \n"
    report += f"**建议**: 降低预算50%或优化关键词\n\n"

    if len(analysis['inefficient_campaigns']) > 0:
        report += "#### 低效活动明细（Top 10）\n\n"
        report += "| 排名 | 广告组合 | 广告活动 | ACOS | 花费 | 销售 | 建议 |\n"
        report += "|------|---------|---------|------|------|------|------|\n"

        for idx, (i, row) in enumerate(analysis['inefficient_campaigns'].head(10).iterrows(), 1):
            report += f"| {idx} | {row['广告组合']} | {row['广告活动'][:40]}... | {row['ACoS_percent']:.2f}% | ${row['广告花费']:.2f} | ${row['广告销售额']:.2f} | 降低预算50% |\n"

    # 优秀活动
    report += f"\n---\n\n## ✅ 三、优秀广告活动（值得加大投入）\n\n"
    report += f"### 3.1 高效活动（ACOS < 30%，销售 > $100）\n\n"
    report += f"**数量**: {len(analysis['excellent_campaigns'])} 个  \n"
    report += f"**总销售**: ${analysis['excellent_campaigns']['广告销售额'].sum():,.2f}  \n"
    report += f"**平均ACOS**: {analysis['excellent_campaigns']['ACoS_percent'].mean():.2f}%  \n"
    report += f"**建议**: 加大预算，扩大规模\n\n"

    if len(analysis['excellent_campaigns']) > 0:
        report += "#### 优秀活动明细（Top 10）\n\n"
        report += "| 排名 | 广告组合 | 广告活动 | ACOS | 花费 | 销售 | ROAS | 建议 |\n"
        report += "|------|---------|---------|------|------|------|------|------|\n"

        for idx, (i, row) in enumerate(analysis['excellent_campaigns'].head(10).iterrows(), 1):
            report += f"| {idx} | {row['广告组合']} | {row['广告活动'][:40]}... | {row['ACoS_percent']:.2f}% | ${row['广告花费']:.2f} | ${row['广告销售额']:.2f} | {row['ROAS']:.2f} | 加大预算 |\n"

    # 按广告组合汇总
    report += f"\n---\n\n## 📊 四、按广告组合深度诊断\n\n"

    for portfolio in analysis['portfolio_stats']['广告组合']:
        portfolio_data = df_recent[df_recent['广告组合'] == portfolio]

        total_spend = portfolio_data['广告花费'].sum()
        total_sales = portfolio_data['广告销售额'].sum()
        portfolio_acos = (total_spend / total_sales * 100) if total_sales > 0 else 0
        num_campaigns = len(portfolio_data)

        # 问题活动统计
        high_acos_count = len(portfolio_data[portfolio_data['ACoS_percent'] > 50])
        zero_sales_count = len(portfolio_data[(portfolio_data['广告花费'] > 5) & (portfolio_data['广告销售额'] == 0)])

        status = "✅ 优秀" if portfolio_acos < 30 else ("⚠️ 可接受" if portfolio_acos < 40 else "🔴 需优化")

        report += f"\n### 4.{analysis['portfolio_stats'][analysis['portfolio_stats']['广告组合'] == portfolio].index[0] + 1} {portfolio} {status}\n\n"
        report += f"**整体表现**:\n"
        report += f"- 广告活动数: {num_campaigns} 个\n"
        report += f"- 总花费: ${total_spend:,.2f}\n"
        report += f"- 总销售: ${total_sales:,.2f}\n"
        report += f"- ACOS: **{portfolio_acos:.2f}%**\n\n"

        report += f"**问题活动**:\n"
        report += f"- 高ACOS活动（>50%）: {high_acos_count} 个\n"
        report += f"- 零销售活动: {zero_sales_count} 个\n\n"

        # Top 3 烧钱活动
        top_spend = portfolio_data.nlargest(3, '广告花费')
        if len(top_spend) > 0:
            report += f"**Top 3 花费活动**:\n"
            for idx, (i, row) in enumerate(top_spend.iterrows(), 1):
                report += f"{idx}. {row['广告活动'][:50]} - ACOS: {row['ACoS_percent']:.2f}%, 花费: ${row['广告花费']:.2f}\n"
        report += "\n"

    # ACOS趋势分析
    if 'trend_analysis' in analysis and len(analysis['trend_analysis']) > 0:
        report += f"\n---\n\n## 📈 五、ACOS趋势分析（近30天 vs 全年）\n\n"
        report += "| 广告组合 | 近30天ACOS | 全年ACOS | 变化 | 趋势 |\n"
        report += "|---------|-----------|---------|------|------|\n"

        for idx, row in analysis['trend_analysis'].iterrows():
            report += f"| {row['广告组合']} | {row['近30天ACOS']:.2f}% | {row['全年ACOS']:.2f}% | {row['变化']:+.2f}% | {row['趋势']} |\n"

    # 行动建议
    total_waste = analysis['high_acos_campaigns']['广告花费'].sum() + analysis['zero_sales_campaigns']['广告花费'].sum()
    potential_savings = total_waste * 0.7  # 假设暂停70%预算

    report += f"\n---\n\n## 🎯 六、立即行动计划（P0紧急）\n\n"
    report += f"### 6.1 止血行动（预计节省 ${potential_savings:,.2f}/月）\n\n"
    report += f"**1. 立即暂停高ACOS活动**\n"
    report += f"   - 数量: {len(analysis['high_acos_campaigns'])} 个\n"
    report += f"   - 当前浪费: ${analysis['high_acos_campaigns']['广告花费'].sum():,.2f}/月\n"
    report += f"   - 行动: 点击上述列表中的活动名称 → 暂停\n\n"

    report += f"**2. 立即暂停零销售活动**\n"
    report += f"   - 数量: {len(analysis['zero_sales_campaigns'])} 个\n"
    report += f"   - 当前浪费: ${analysis['zero_sales_campaigns']['广告花费'].sum():,.2f}/月\n"
    report += f"   - 行动: 批量选中 → 暂停\n\n"

    report += f"**3. 降低低效活动预算**\n"
    report += f"   - 数量: {len(analysis['inefficient_campaigns'])} 个\n"
    report += f"   - 当前花费: ${analysis['inefficient_campaigns']['广告花费'].sum():,.2f}/月\n"
    report += f"   - 行动: 预算降低50%\n\n"

    report += f"### 6.2 加码优秀活动（预计增加销售 ${analysis['excellent_campaigns']['广告销售额'].sum() * 0.5:,.2f}/月）\n\n"
    report += f"将节省的预算转移到优秀活动（{len(analysis['excellent_campaigns'])}个），预算增加30-50%\n\n"

    report += f"---\n\n"
    report += f"**报告生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    report += f"**分析工具**: Amazon Growth OS v2.0 - Campaign Activity Auditor\n"
    report += f"**下次审计**: 执行P0行动后7天复盘\n"

    # 保存报告
    report_dir = Path("reports/markdown")
    report_dir.mkdir(parents=True, exist_ok=True)

    report_path = report_dir / f"TIMO-US广告活动审计报告-{datetime.now().strftime('%Y%m%d')}.md"

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"\n✅ 审计报告已生成: {report_path}")

    return report_path

def main():
    print("="*80)
    print("🚀 TIMO 美国站广告活动深度审计")
    print("="*80)

    # 加载数据
    df_recent, df_annual = load_all_campaign_data()

    if len(df_recent) == 0:
        print("❌ 未找到近30天数据，请检查文件")
        return

    # 分析数据
    analysis = analyze_campaigns(df_recent, df_annual)

    # 生成报告
    report_path = generate_audit_report(analysis, df_recent, df_annual)

    print("\n" + "="*80)
    print("✅ 分析完成！")
    print("="*80)
    print(f"\n📄 报告位置: {report_path}")
    print(f"\n🎯 关键发现:")
    print(f"  - 高ACOS烧钱活动: {len(analysis['high_acos_campaigns'])} 个，浪费 ${analysis['high_acos_campaigns']['广告花费'].sum():,.2f}")
    print(f"  - 零销售活动: {len(analysis['zero_sales_campaigns'])} 个，浪费 ${analysis['zero_sales_campaigns']['广告花费'].sum():,.2f}")
    print(f"  - 优秀活动: {len(analysis['excellent_campaigns'])} 个，销售 ${analysis['excellent_campaigns']['广告销售额'].sum():,.2f}")
    print(f"\n💰 预计每月可节省: ${(analysis['high_acos_campaigns']['广告花费'].sum() + analysis['zero_sales_campaigns']['广告花费'].sum()) * 0.7:,.2f}")
    print(f"\n🚀 下一步: 参考报告中的P0紧急行动计划")

if __name__ == "__main__":
    main()
