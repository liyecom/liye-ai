#!/usr/bin/env python3
"""
TIMO 美国站关键词维度深度分析
整合: 卖家精灵P2反查 + 飞轮3维度（广告活动/投放/搜索词）
"""

import pandas as pd
import glob
from pathlib import Path
from datetime import datetime

# 数据路径
UPLOADS_DIR = Path("/Users/liye/Documents/amazon-runtime/uploads/Timo-US")
REPORTS_DIR = Path("/Users/liye/Documents/amazon-runtime/reports/markdown")

# 5个ASIN列表
ASINS = [
    "B08SVXGTRT",
    "B08SWLTTSW",
    "B09PQJ8SW8",
    "B08SW4Z85K",  # 无广告数据
    "B09PQPYDBM"
]

def load_sellersprite_data(asin):
    """加载卖家精灵P2反查数据"""
    pattern = f"ReverseASIN-US-{asin}-*.xlsx"
    files = list(UPLOADS_DIR.glob(pattern))

    if not files:
        print(f"⚠️ 未找到{asin}的卖家精灵数据")
        return None

    file = files[0]
    print(f"  ✓ 加载卖家精灵: {file.name}")

    try:
        df = pd.read_excel(file)
        # 清理列名
        df.columns = df.columns.str.strip()
        return df
    except Exception as e:
        print(f"  ❌ 读取失败: {e}")
        return None

def load_flywheel_campaign_data(asin):
    """加载飞轮-广告活动重构数据"""
    pattern = f"*产品{asin}-广告活动重构-*.xlsx"
    files = list(UPLOADS_DIR.glob(pattern))

    if not files:
        print(f"  ⚠️ 未找到{asin}的飞轮广告活动数据")
        return None

    file = files[0]
    print(f"  ✓ 加载飞轮-广告活动: {file.name}")

    try:
        df = pd.read_excel(file)
        df.columns = df.columns.str.strip()
        return df
    except Exception as e:
        print(f"  ❌ 读取失败: {e}")
        return None

def load_flywheel_targeting_data(asin):
    """加载飞轮-投放重构数据"""
    pattern = f"*产品{asin}-投放重构-*.xlsx"
    files = list(UPLOADS_DIR.glob(pattern))

    if not files:
        print(f"  ⚠️ 未找到{asin}的飞轮投放数据")
        return None

    file = files[0]
    print(f"  ✓ 加载飞轮-投放: {file.name}")

    try:
        df = pd.read_excel(file)
        df.columns = df.columns.str.strip()
        return df
    except Exception as e:
        print(f"  ❌ 读取失败: {e}")
        return None

def load_flywheel_searchterm_data(asin):
    """加载飞轮-搜索词重构数据"""
    pattern = f"*产品{asin}-搜索词重构-*.xlsx"
    files = list(UPLOADS_DIR.glob(pattern))

    if not files:
        print(f"  ⚠️ 未找到{asin}的飞轮搜索词数据")
        return None

    file = files[0]
    print(f"  ✓ 加载飞轮-搜索词: {file.name}")

    try:
        df = pd.read_excel(file)
        df.columns = df.columns.str.strip()
        return df
    except Exception as e:
        print(f"  ❌ 读取失败: {e}")
        return None

def calculate_tes(row):
    """
    计算TES (Traffic Efficiency Score)
    TES = (月搜索量 × 购买率) / (标题密度 + 1)
    """
    try:
        search_volume = float(row.get('月搜索量', 0) or 0)
        purchase_rate = float(row.get('购买率', 0) or 0)
        title_density = float(row.get('标题密度', 0) or 0)

        tes = (search_volume * purchase_rate) / (title_density + 1)
        return round(tes, 2)
    except:
        return 0

def classify_keyword_by_tes(tes):
    """根据TES分类关键词"""
    if tes > 100:
        return "🏆 WINNER"
    elif tes >= 10:
        return "💎 POTENTIAL"
    else:
        return "📊 BROAD"

def analyze_asin(asin):
    """分析单个ASIN的关键词维度"""
    print(f"\n{'='*80}")
    print(f"📊 分析ASIN: {asin}")
    print(f"{'='*80}")

    # 加载卖家精灵数据
    ss_data = load_sellersprite_data(asin)

    # 加载飞轮3维度数据
    fw_campaign = load_flywheel_campaign_data(asin)
    fw_targeting = load_flywheel_targeting_data(asin)
    fw_searchterm = load_flywheel_searchterm_data(asin)

    results = {
        'asin': asin,
        'sellersprite': ss_data,
        'flywheel_campaign': fw_campaign,
        'flywheel_targeting': fw_targeting,
        'flywheel_searchterm': fw_searchterm
    }

    # 分析卖家精灵关键词
    if ss_data is not None and not ss_data.empty:
        print(f"\n📈 卖家精灵关键词分析:")
        print(f"  总关键词数: {len(ss_data)}")

        # 计算TES
        ss_data['TES'] = ss_data.apply(calculate_tes, axis=1)
        ss_data['分类'] = ss_data['TES'].apply(classify_keyword_by_tes)

        # 统计分类
        category_counts = ss_data['分类'].value_counts()
        print(f"\n  关键词分类:")
        for category, count in category_counts.items():
            print(f"    {category}: {count}个")

        # Top关键词
        top_keywords = ss_data.nlargest(10, 'TES')[['关键词', 'TES', '月搜索量', '购买率', '标题密度', '分类']]
        print(f"\n  Top 10关键词（按TES排序）:")
        print(top_keywords.to_string(index=False))

        # 流量缺口词（高TES但低标题密度）
        gap_keywords = ss_data[(ss_data['TES'] > 50) & (ss_data['标题密度'] < 30)]
        if not gap_keywords.empty:
            print(f"\n  🎯 流量缺口词（TES>50 且标题密度<30%）: {len(gap_keywords)}个")
            print(gap_keywords[['关键词', 'TES', '月搜索量', '标题密度']].head(10).to_string(index=False))

        results['top_keywords'] = top_keywords
        results['gap_keywords'] = gap_keywords

    # 分析飞轮搜索词数据
    if fw_searchterm is not None and not fw_searchterm.empty:
        print(f"\n🔍 飞轮搜索词分析:")
        print(f"  总搜索词数: {len(fw_searchterm)}")

        # 显示列名以便调试
        print(f"\n  可用列: {list(fw_searchterm.columns)}")

        # 尝试找到花费、销售、ACOS相关列
        cost_cols = [col for col in fw_searchterm.columns if '花费' in col or 'cost' in col.lower() or '支出' in col]
        sales_cols = [col for col in fw_searchterm.columns if '销售' in col or 'sales' in col.lower() or '收入' in col]
        acos_cols = [col for col in fw_searchterm.columns if 'ACOS' in col or 'acos' in col.lower()]

        print(f"\n  花费相关列: {cost_cols}")
        print(f"  销售相关列: {sales_cols}")
        print(f"  ACOS相关列: {acos_cols}")

        # 如果有搜索词列，显示前几个
        keyword_cols = [col for col in fw_searchterm.columns if '关键词' in col or 'keyword' in col.lower() or '搜索词' in col]
        if keyword_cols:
            print(f"\n  关键词列: {keyword_cols}")
            print(f"\n  前10个搜索词:")
            print(fw_searchterm[keyword_cols[:1]].head(10).to_string(index=False))

    # 分析飞轮投放数据
    if fw_targeting is not None and not fw_targeting.empty:
        print(f"\n🎯 飞轮投放数据分析:")
        print(f"  总投放数: {len(fw_targeting)}")
        print(f"  可用列: {list(fw_targeting.columns)}")

    # 分析飞轮广告活动数据
    if fw_campaign is not None and not fw_campaign.empty:
        print(f"\n📢 飞轮广告活动分析:")
        print(f"  总活动数: {len(fw_campaign)}")
        print(f"  可用列: {list(fw_campaign.columns)}")

    return results

def generate_comprehensive_report(all_results):
    """生成综合优化报告"""
    timestamp = datetime.now().strftime("%Y%m%d")
    report_file = REPORTS_DIR / f"TIMO-US关键词维度深度诊断-{timestamp}.md"

    with open(report_file, 'w', encoding='utf-8') as f:
        f.write("# TIMO 美国站关键词维度深度诊断报告\n\n")
        f.write(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
        f.write(f"**数据源**: 卖家精灵P2反查 + 飞轮3维度（广告活动/投放/搜索词）\n\n")
        f.write("---\n\n")

        # 整体摘要
        f.write("## 📊 整体摘要\n\n")
        f.write(f"分析ASIN数: {len(all_results)}\n\n")

        total_keywords = 0
        total_winner = 0
        total_potential = 0
        total_gap = 0

        for result in all_results:
            if result['sellersprite'] is not None:
                total_keywords += len(result['sellersprite'])
                ss_data = result['sellersprite']
                if 'TES' in ss_data.columns:
                    total_winner += len(ss_data[ss_data['TES'] > 100])
                    total_potential += len(ss_data[(ss_data['TES'] >= 10) & (ss_data['TES'] <= 100)])
                if 'gap_keywords' in result and result['gap_keywords'] is not None:
                    total_gap += len(result['gap_keywords'])

        f.write(f"- **总关键词数**: {total_keywords}\n")
        f.write(f"- **🏆 WINNER关键词** (TES>100): {total_winner}个\n")
        f.write(f"- **💎 POTENTIAL关键词** (10≤TES≤100): {total_potential}个\n")
        f.write(f"- **🎯 流量缺口词** (TES>50 且标题密度<30%): {total_gap}个\n\n")

        f.write("---\n\n")

        # 按ASIN详细分析
        for result in all_results:
            asin = result['asin']
            f.write(f"## ASIN: {asin}\n\n")

            # 卖家精灵关键词
            if result['sellersprite'] is not None and 'top_keywords' in result:
                f.write(f"### 📈 Top 10关键词（卖家精灵P2）\n\n")
                f.write("```\n")
                f.write(result['top_keywords'].to_string(index=False))
                f.write("\n```\n\n")

                if 'gap_keywords' in result and result['gap_keywords'] is not None and not result['gap_keywords'].empty:
                    f.write(f"### 🎯 流量缺口词（优化机会）\n\n")
                    f.write("```\n")
                    f.write(result['gap_keywords'][['关键词', 'TES', '月搜索量', '标题密度']].head(10).to_string(index=False))
                    f.write("\n```\n\n")

            f.write("---\n\n")

        # 综合优化建议
        f.write("## 🚀 综合优化建议\n\n")
        f.write("### P0 紧急行动（Day 1-2）\n\n")
        f.write("1. **标题优化**：将流量缺口词加入标题（优先TES>100的WINNER词）\n")
        f.write("2. **广告投放**：对WINNER词提高竞价20-30%\n")
        f.write("3. **新增关键词**：将POTENTIAL词加入广告组\n\n")

        f.write("### P1 中期优化（Day 3-7）\n\n")
        f.write("1. **监控ACOS**：新增词ACOS>40%则降价或暂停\n")
        f.write("2. **A+页面**：在A+页面中嵌入高TES关键词\n")
        f.write("3. **五点描述**：将流量缺口词自然融入产品描述\n\n")

        f.write("### P2 长期策略（Week 2+）\n\n")
        f.write("1. **持续监控**：每周复查TES变化，调整策略\n")
        f.write("2. **竞品分析**：对比竞品标题密度，寻找新机会\n")
        f.write("3. **测试迭代**：A/B测试不同关键词组合\n\n")

    print(f"\n✅ 综合报告已生成: {report_file}")
    return report_file

def main():
    print("="*80)
    print("🚀 TIMO 美国站关键词维度深度分析")
    print("="*80)

    all_results = []

    for asin in ASINS:
        result = analyze_asin(asin)
        all_results.append(result)

    # 生成综合报告
    report_file = generate_comprehensive_report(all_results)

    print(f"\n{'='*80}")
    print("✅ 分析完成！")
    print(f"{'='*80}")
    print(f"\n📄 报告位置: {report_file}")

if __name__ == "__main__":
    main()
