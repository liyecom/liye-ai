#!/usr/bin/env python3
"""
广告活动深度分析脚本 v2.0
修正版：区分活跃/已暂停状态，正确处理ACOS小数格式
"""

import pandas as pd
import glob
from pathlib import Path
from datetime import datetime
import re

def extract_portfolio_name(filename):
    """从文件名提取广告组合名称"""
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

            # 修正：ACOS小数格式转百分比
            if 'ACoS' in df.columns:
                df['ACoS_percent'] = df['ACoS'] * 100

            # 标准化状态列名
            status_cols = [col for col in df.columns if '状态' in col and '有效' in col]
            if status_cols:
                df['活动状态'] = df[status_cols[0]]

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

            if 'ACoS' in df.columns:
                df['ACoS_percent'] = df['ACoS'] * 100

            status_cols = [col for col in df.columns if '状态' in col and '有效' in col]
            if status_cols:
                df['活动状态'] = df[status_cols[0]]

            annual_data.append(df)
        except Exception as e:
            print(f"⚠️ 读取失败: {Path(file).name} - {e}")

    df_recent = pd.concat(recent_data, ignore_index=True) if recent_data else pd.DataFrame()
    df_annual = pd.concat(annual_data, ignore_index=True) if annual_data else pd.DataFrame()

    print(f"\n✅ 数据加载完成:")
    print(f"  - 近30天总活动数: {len(df_recent)}")
    print(f"  - 全年总活动数: {len(df_annual)}")

    # 状态分布
    if '活动状态' in df_recent.columns:
        print(f"\n📊 近30天活动状态分布:")
        print(df_recent['活动状态'].value_counts())

        print(f"\n🔥 关键区分:")
        active = df_recent[df_recent['活动状态'] == '已开启']
        paused = df_recent[df_recent['活动状态'] == '已暂停']

        print(f"  - 已开启活动: {len(active)} 个")
        print(f"  - 已暂停活动: {len(paused)} 个")
        print(f"  - 已开启且有花费: {len(active[active['广告花费'] > 0])} 个")
        print(f"  - 已暂停但有花费: {len(paused[paused['广告花费'] > 0])} 个（近期才暂停）")

    return df_recent, df_annual

def analyze_campaigns_v2(df_recent, df_annual):
    """深度分析广告活动 v2.0 - 区分活跃/暂停状态"""
    print("\n" + "="*80)
    print("🔍 开始深度分析广告活动（v2.0 - 修正版）")
    print("="*80)

    analysis = {}

    # 区分活跃和已暂停活动
    if '活动状态' in df_recent.columns:
        df_active = df_recent[df_recent['活动状态'] == '已开启']
        df_paused = df_recent[df_recent['活动状态'] == '已暂停']
    else:
        df_active = df_recent[df_recent['广告花费'] > 0]  # 降级方案
        df_paused = df_recent[df_recent['广告花费'] == 0]

    analysis['active_campaigns'] = df_active
    analysis['paused_campaigns'] = df_paused

    print(f"\n📊 活动状态概览:")
    print(f"  - 总活动数: {len(df_recent)}")
    print(f"  - 已开启: {len(df_active)} 个")
    print(f"  - 已暂停: {len(df_paused)} 个")
    print(f"  - 已开启且有花费: {len(df_active[df_active['广告花费'] > 0])} 个")

    # 1. 识别**已开启**的高ACOS烧钱活动
    high_acos_active = df_active[
        (df_active['ACoS_percent'] > 50) & (df_active['广告花费'] > 10)
    ].sort_values('广告花费', ascending=False)

    analysis['high_acos_active'] = high_acos_active

    print(f"\n🔴 已开启的高ACOS烧钱活动（ACOS > 50%，花费 > $10）: {len(high_acos_active)} 个")
    if len(high_acos_active) > 0:
        print(f"   总花费: ${high_acos_active['广告花费'].sum():,.2f}")
        print(f"   平均ACOS: {high_acos_active['ACoS_percent'].mean():.2f}%")

    # 2. 识别**已开启**的零销售活动
    zero_sales_active = df_active[
        (df_active['广告花费'] > 5) & (df_active['广告销售额'] == 0)
    ].sort_values('广告花费', ascending=False)

    analysis['zero_sales_active'] = zero_sales_active

    print(f"\n❌ 已开启的零销售活动（花费 > $5，销售 = $0）: {len(zero_sales_active)} 个")
    if len(zero_sales_active) > 0:
        print(f"   浪费花费: ${zero_sales_active['广告花费'].sum():,.2f}")

    # 3. 识别**已开启**的低效活动
    inefficient_active = df_active[
        (df_active['ACoS_percent'] > 40) &
        (df_active['ACoS_percent'] <= 50) &
        (df_active['广告花费'] > 50)
    ].sort_values('广告花费', ascending=False)

    analysis['inefficient_active'] = inefficient_active

    print(f"\n⚠️ 已开启的低效活动（40% < ACOS <= 50%，花费 > $50）: {len(inefficient_active)} 个")
    if len(inefficient_active) > 0:
        print(f"   总花费: ${inefficient_active['广告花费'].sum():,.2f}")

    # 4. 识别**已开启**的优秀活动
    excellent_active = df_active[
        (df_active['ACoS_percent'] < 30) & (df_active['广告销售额'] > 100)
    ].sort_values('广告销售额', ascending=False)

    analysis['excellent_active'] = excellent_active

    print(f"\n✅ 已开启的优秀活动（ACOS < 30%，销售 > $100）: {len(excellent_active)} 个")
    if len(excellent_active) > 0:
        print(f"   总销售: ${excellent_active['广告销售额'].sum():,.2f}")
        print(f"   平均ACOS: {excellent_active['ACoS_percent'].mean():.2f}%")

    # 5. 挖掘**已暂停**活动中的价值（曾经表现好的）
    paused_valuable = df_paused[
        (df_paused['ACoS_percent'] > 0) &  # 有历史数据
        (df_paused['ACoS_percent'] < 30) &  # 曾经表现好
        (df_paused['广告销售额'] > 100)  # 有实质销售
    ].sort_values('广告销售额', ascending=False)

    analysis['paused_valuable'] = paused_valuable

    print(f"\n💎 已暂停但曾表现优秀的活动（可考虑重启）: {len(paused_valuable)} 个")
    if len(paused_valuable) > 0:
        print(f"   历史总销售: ${paused_valuable['广告销售额'].sum():,.2f}")
        print(f"   平均ACOS: {paused_valuable['ACoS_percent'].mean():.2f}%")

    # 6. 按广告组合分组统计（仅已开启活动）
    portfolio_stats = df_active.groupby('广告组合').agg({
        '广告花费': 'sum',
        '广告销售额': 'sum',
        '广告活动': 'count'
    }).reset_index()

    portfolio_stats['ACOS'] = (portfolio_stats['广告花费'] / portfolio_stats['广告销售额'] * 100).fillna(0)
    portfolio_stats = portfolio_stats.sort_values('广告花费', ascending=False)
    portfolio_stats.columns = ['广告组合', '总花费', '总销售', '活动数', 'ACOS']

    analysis['portfolio_stats_active'] = portfolio_stats

    print(f"\n📊 按广告组合汇总（仅已开启活动）:")
    print(portfolio_stats.to_string(index=False))

    return analysis

def generate_audit_report_v2(analysis, df_recent, df_annual):
    """生成广告活动审计报告 v2.0"""
    print("\n📝 开始生成审计报告 v2.0...")

    report_date = datetime.now().strftime('%Y-%m-%d')

    df_active = analysis['active_campaigns']
    df_paused = analysis['paused_campaigns']

    report = f"""# TIMO 美国站广告活动深度审计报告 v2.0（修正版）

**生成时间**: {report_date}
**分析周期**: 近30天（2025-11-26至12-25）+ 全年对比
**数据来源**: 赛狐广告活动层级数据
**修正内容**: 区分活跃/已暂停状态，修正ACOS小数格式

---

## 📊 一、总体概况（修正后）

### 1.1 活动状态分布

**近30天总活动数**: **{len(df_recent)}** 个

| 状态 | 数量 | 占比 | 有花费活动 |
|------|------|------|-----------|
| **已开启** | **{len(df_active)}** | {len(df_active)/len(df_recent)*100:.1f}% | {len(df_active[df_active['广告花费'] > 0])} 个 |
| 已暂停 | {len(df_paused)} | {len(df_paused)/len(df_recent)*100:.1f}% | {len(df_paused[df_paused['广告花费'] > 0])} 个 |
| 其他 | {len(df_recent) - len(df_active) - len(df_paused)} | {(len(df_recent) - len(df_active) - len(df_paused))/len(df_recent)*100:.1f}% | - |

**关键洞察**:
- ⚠️ **仅{len(df_active)/len(df_recent)*100:.1f}%的活动处于开启状态**
- 已暂停活动中有{len(df_paused[df_paused['广告花费'] > 0])}个仍有花费（近期才暂停）

### 1.2 已开启活动表现（核心数据）

**近30天已开启活动**:
- 活动数: **{len(df_active)}** 个
- 有花费活动: **{len(df_active[df_active['广告花费'] > 0])}** 个
- 总花费: **${df_active['广告花费'].sum():,.2f}**
- 总销售: **${df_active['广告销售额'].sum():,.2f}**
- 整体ACOS: **{(df_active['广告花费'].sum() / df_active['广告销售额'].sum() * 100) if df_active['广告销售额'].sum() > 0 else 0:.2f}%**

**全年对比**:
- 全年总花费: ${df_annual['广告花费'].sum():,.2f}
- 全年总销售: ${df_annual['广告销售额'].sum():,.2f}
- 全年ACOS: {(df_annual['广告花费'].sum() / df_annual['广告销售额'].sum() * 100) if df_annual['广告销售额'].sum() > 0 else 0:.2f}%

---

## 🔴 二、已开启活动的问题识别（P0紧急）

### 2.1 高ACOS烧钱活动（ACOS > 50%，花费 > $10）

**数量**: {len(analysis['high_acos_active'])} 个
**浪费花费**: ${analysis['high_acos_active']['广告花费'].sum():,.2f}/月
**产生销售**: ${analysis['high_acos_active']['广告销售额'].sum():,.2f}/月
**状态**: ⚠️ **当前仍在运行，持续烧钱中**
**建议**: **立即暂停**

"""

    # 高ACOS活动明细
    if len(analysis['high_acos_active']) > 0:
        report += "\n#### 高ACOS活动明细（按花费排序）\n\n"
        report += "| 排名 | 广告组合 | 广告活动 | ACOS | 花费 | 销售 | ROAS | 状态 | 紧急度 |\n"
        report += "|------|---------|---------|------|------|------|------|------|--------|\n"

        for idx, (i, row) in enumerate(analysis['high_acos_active'].head(20).iterrows(), 1):
            urgency = "🔥 紧急" if row['ACoS_percent'] > 100 else "🔴 高优"
            report += f"| {idx} | {row['广告组合']} | {row['广告活动'][:40]}... | **{row['ACoS_percent']:.2f}%** | ${row['广告花费']:.2f} | ${row['广告销售额']:.2f} | {row.get('ROAS', 0):.2f} | 已开启 | {urgency} |\n"

    # 零销售活动
    report += f"\n### 2.2 零销售烧钱活动（花费 > $5，销售 = $0）\n\n"
    report += f"**数量**: {len(analysis['zero_sales_active'])} 个  \n"
    report += f"**浪费花费**: ${analysis['zero_sales_active']['广告花费'].sum():,.2f}/月  \n"
    report += f"**状态**: ⚠️ **当前仍在运行**  \n"
    report += f"**建议**: **立即暂停**\n\n"

    if len(analysis['zero_sales_active']) > 0:
        report += "#### 零销售活动明细\n\n"
        report += "| 排名 | 广告组合 | 广告活动 | 花费 | 曝光 | 点击 | CTR | 状态 |\n"
        report += "|------|---------|---------|------|------|------|-----|------|\n"

        for idx, (i, row) in enumerate(analysis['zero_sales_active'].head(15).iterrows(), 1):
            impressions = row.get('广告曝光量', 0)
            clicks = row.get('广告点击量', 0)
            ctr = (clicks / impressions * 100) if impressions > 0 else 0
            report += f"| {idx} | {row['广告组合']} | {row['广告活动'][:40]}... | ${row['广告花费']:.2f} | {impressions:,.0f} | {clicks:,.0f} | {ctr:.2f}% | 已开启 |\n"

    # 低效活动
    report += f"\n### 2.3 低效活动（40% < ACOS <= 50%，花费 > $50）\n\n"
    report += f"**数量**: {len(analysis['inefficient_active'])} 个  \n"
    report += f"**总花费**: ${analysis['inefficient_active']['广告花费'].sum():,.2f}/月  \n"
    report += f"**建议**: 降低预算50%或优化关键词\n\n"

    if len(analysis['inefficient_active']) > 0:
        report += "#### 低效活动明细\n\n"
        report += "| 排名 | 广告组合 | 广告活动 | ACOS | 花费 | 销售 | 建议 |\n"
        report += "|------|---------|---------|------|------|------|------|\n"

        for idx, (i, row) in enumerate(analysis['inefficient_active'].head(10).iterrows(), 1):
            report += f"| {idx} | {row['广告组合']} | {row['广告活动'][:40]}... | {row['ACoS_percent']:.2f}% | ${row['广告花费']:.2f} | ${row['广告销售额']:.2f} | 降低预算50% |\n"

    # 优秀活动
    report += f"\n---\n\n## ✅ 三、已开启的优秀活动（值得加大投入）\n\n"
    report += f"### 3.1 高效活动（ACOS < 30%，销售 > $100）\n\n"
    report += f"**数量**: {len(analysis['excellent_active'])} 个  \n"
    report += f"**总销售**: ${analysis['excellent_active']['广告销售额'].sum():,.2f}/月  \n"
    report += f"**平均ACOS**: {analysis['excellent_active']['ACoS_percent'].mean():.2f}%  \n"
    report += f"**建议**: 加大预算30-50%\n\n"

    if len(analysis['excellent_active']) > 0:
        report += "#### 优秀活动明细\n\n"
        report += "| 排名 | 广告组合 | 广告活动 | ACOS | 花费 | 销售 | ROAS | 建议 |\n"
        report += "|------|---------|---------|------|------|------|------|------|\n"

        for idx, (i, row) in enumerate(analysis['excellent_active'].head(10).iterrows(), 1):
            report += f"| {idx} | {row['广告组合']} | {row['广告活动'][:40]}... | {row['ACoS_percent']:.2f}% | ${row['广告花费']:.2f} | ${row['广告销售额']:.2f} | {row.get('ROAS', 0):.2f} | 加大预算 |\n"

    # 已暂停但有价值的活动
    report += f"\n---\n\n## 💎 四、已暂停活动中的宝藏（可考虑重启）\n\n"
    report += f"### 4.1 曾表现优秀的已暂停活动（ACOS < 30%，历史销售 > $100）\n\n"
    report += f"**数量**: {len(analysis['paused_valuable'])} 个  \n"
    report += f"**历史总销售**: ${analysis['paused_valuable']['广告销售额'].sum():,.2f}  \n"
    report += f"**平均ACOS**: {analysis['paused_valuable']['ACoS_percent'].mean():.2f}%  \n"
    report += f"**建议**: 评估后重启，扩大销售规模\n\n"

    if len(analysis['paused_valuable']) > 0:
        report += "#### 有价值的已暂停活动（Top 10）\n\n"
        report += "| 排名 | 广告组合 | 广告活动 | 历史ACOS | 历史花费 | 历史销售 | 建议 |\n"
        report += "|------|---------|---------|---------|---------|---------|------|\n"

        for idx, (i, row) in enumerate(analysis['paused_valuable'].head(10).iterrows(), 1):
            report += f"| {idx} | {row['广告组合']} | {row['广告活动'][:40]}... | {row['ACoS_percent']:.2f}% | ${row['广告花费']:.2f} | ${row['广告销售额']:.2f} | 考虑重启 |\n"

    # 按广告组合汇总
    report += f"\n---\n\n## 📊 五、按广告组合深度诊断（仅已开启活动）\n\n"

    for idx, row in analysis['portfolio_stats_active'].iterrows():
        portfolio = row['广告组合']

        status = "✅ 优秀" if row['ACOS'] < 30 else ("⚠️ 可接受" if row['ACOS'] < 40 else "🔴 需优化")

        report += f"\n### 5.{idx + 1} {portfolio} {status}\n\n"
        report += f"**已开启活动表现**:\n"
        report += f"- 活动数: {row['活动数']:.0f} 个\n"
        report += f"- 总花费: ${row['总花费']:,.2f}\n"
        report += f"- 总销售: ${row['总销售']:,.2f}\n"
        report += f"- ACOS: **{row['ACOS']:.2f}%**\n\n"

    # 行动建议
    total_waste = analysis['high_acos_active']['广告花费'].sum() + analysis['zero_sales_active']['广告花费'].sum()
    potential_savings = total_waste * 0.7

    report += f"\n---\n\n## 🎯 六、立即行动计划（P0紧急 - 修正版）\n\n"
    report += f"### 6.1 止血行动（预计节省 ${potential_savings:,.2f}/月）\n\n"
    report += f"**1. 立即暂停高ACOS活动**\n"
    report += f"   - 数量: {len(analysis['high_acos_active'])} 个（**当前仍在运行**）\n"
    report += f"   - 当前浪费: ${analysis['high_acos_active']['广告花费'].sum():,.2f}/月\n"
    report += f"   - 行动: 赛狐后台 → 批量选中 → 暂停\n\n"

    report += f"**2. 立即暂停零销售活动**\n"
    report += f"   - 数量: {len(analysis['zero_sales_active'])} 个（**当前仍在运行**）\n"
    report += f"   - 当前浪费: ${analysis['zero_sales_active']['广告花费'].sum():,.2f}/月\n"
    report += f"   - 行动: 批量选中 → 暂停\n\n"

    report += f"**3. 降低低效活动预算**\n"
    report += f"   - 数量: {len(analysis['inefficient_active'])} 个\n"
    report += f"   - 当前花费: ${analysis['inefficient_active']['广告花费'].sum():,.2f}/月\n"
    report += f"   - 行动: 预算降低50%\n\n"

    report += f"### 6.2 加码优秀活动\n\n"
    report += f"将节省的预算转移到{len(analysis['excellent_active'])}个优秀活动，预算增加30-50%\n\n"

    report += f"### 6.3 重启宝藏活动（中期优化）\n\n"
    report += f"评估{len(analysis['paused_valuable'])}个曾表现优秀的已暂停活动，选择性重启\n\n"

    report += f"---\n\n"
    report += f"**报告生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    report += f"**版本**: v2.0（修正版 - 区分活跃/暂停状态）\n"
    report += f"**分析工具**: Amazon Growth OS v2.0 - Campaign Activity Auditor\n"

    # 保存报告
    report_dir = Path("reports/markdown")
    report_dir.mkdir(parents=True, exist_ok=True)

    report_path = report_dir / f"TIMO-US广告活动审计报告-v2修正版-{datetime.now().strftime('%Y%m%d')}.md"

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"\n✅ 审计报告v2.0已生成: {report_path}")

    return report_path

def main():
    print("="*80)
    print("🚀 TIMO 美国站广告活动深度审计 v2.0（修正版）")
    print("="*80)

    # 加载数据
    df_recent, df_annual = load_all_campaign_data()

    if len(df_recent) == 0:
        print("❌ 未找到近30天数据，请检查文件")
        return

    # 分析数据
    analysis = analyze_campaigns_v2(df_recent, df_annual)

    # 生成报告
    report_path = generate_audit_report_v2(analysis, df_recent, df_annual)

    print("\n" + "="*80)
    print("✅ 分析完成！（v2.0修正版）")
    print("="*80)
    print(f"\n📄 报告位置: {report_path}")
    print(f"\n🎯 关键发现（修正后）:")
    print(f"  - 总活动数: {len(df_recent)}")
    print(f"  - **已开启活动**: {len(analysis['active_campaigns'])} 个（仅{len(analysis['active_campaigns'])/len(df_recent)*100:.1f}%）")
    print(f"  - 已开启的高ACOS烧钱活动: {len(analysis['high_acos_active'])} 个，浪费 ${analysis['high_acos_active']['广告花费'].sum():,.2f}/月")
    print(f"  - 已开启的零销售活动: {len(analysis['zero_sales_active'])} 个，浪费 ${analysis['zero_sales_active']['广告花费'].sum():,.2f}/月")
    print(f"  - 已开启的优秀活动: {len(analysis['excellent_active'])} 个，销售 ${analysis['excellent_active']['广告销售额'].sum():,.2f}/月")
    print(f"  - 已暂停但有价值的活动: {len(analysis['paused_valuable'])} 个（可考虑重启）")
    print(f"\n💰 预计每月可节省: ${(analysis['high_acos_active']['广告花费'].sum() + analysis['zero_sales_active']['广告花费'].sum()) * 0.7:,.2f}")
    print(f"\n🚀 下一步: 参考报告中的P0紧急行动计划")

if __name__ == "__main__":
    main()
