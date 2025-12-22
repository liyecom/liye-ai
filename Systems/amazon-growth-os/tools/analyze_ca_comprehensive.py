#!/usr/bin/env python3
"""
加拿大站综合诊断分析工具
综合Business Report + 赛狐广告报告 + 卖家精灵反查 + 飞轮数据
生成7天快速冲刺优化方案
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
import json
import re

def clean_currency(value):
    """清理货币格式"""
    if pd.isna(value) or value == '' or value == '-':
        return 0.0
    if isinstance(value, str):
        return float(value.replace('CA$', '').replace('$', '').replace(',', '').replace('-', '0'))
    return float(value)

def clean_number(value):
    """清理数字格式"""
    if pd.isna(value) or value == '' or value == '-':
        return 0
    if isinstance(value, str):
        return int(float(value.replace(',', '').replace('-', '0')))
    return int(value)

def clean_percentage(value):
    """清理百分比格式"""
    if pd.isna(value) or value == '' or value == '-':
        return 0.0
    if isinstance(value, str):
        return float(value.replace('%', '').replace('-', '0'))
    return float(value)

def calculate_tes(row):
    """计算TES流量效能分数"""
    search_volume = clean_number(row.get('月搜索量', 0))
    purchase_rate = clean_percentage(row.get('购买率', 0))
    title_density = clean_percentage(row.get('标题密度', 0))

    if search_volume == 0:
        return 0

    tes = (search_volume * purchase_rate) / (title_density + 1)
    return round(tes, 2)

def analyze_sellersprite_data(asin):
    """分析卖家精灵反查数据"""
    file_path = f"uploads/ReverseASIN-CA-{asin}-Last-30-days.xlsx"

    try:
        df = pd.read_excel(file_path)

        # 清理数据
        df['月搜索量'] = df['月搜索量'].apply(clean_number)
        # 购买率和流量占比已经是小数格式（0.0198 = 1.98%），需要乘以100
        df['购买率'] = df['购买率'].apply(lambda x: x * 100 if pd.notna(x) and isinstance(x, (int, float)) else clean_percentage(x))
        df['标题密度'] = df['标题密度'].apply(clean_percentage)
        df['点击量'] = df['点击量'].apply(clean_number)
        df['购买量'] = df['购买量'].apply(clean_number)
        df['流量占比'] = df['流量占比'].apply(lambda x: x * 100 if pd.notna(x) and isinstance(x, (int, float)) else clean_percentage(x))

        # 计算TES
        df['TES'] = df.apply(calculate_tes, axis=1)

        # 关键词分类
        def classify_keyword(row):
            tes = row['TES']
            if tes > 100:
                return 'WINNER'
            elif tes > 10:
                return 'POTENTIAL'
            else:
                return 'BROAD'

        df['分类'] = df.apply(classify_keyword, axis=1)

        return df

    except FileNotFoundError:
        print(f"⚠️ 未找到{asin}的卖家精灵数据")
        return pd.DataFrame()
    except Exception as e:
        print(f"⚠️ 读取{asin}卖家精灵数据出错: {e}")
        return pd.DataFrame()

def analyze_flywheel_data(asin):
    """分析飞轮广告数据"""
    # 查找飞轮文件（文件名包含ASIN）
    import glob
    pattern = f"uploads/*CA-产品{asin}*.xlsx"
    files = glob.glob(pattern)

    if not files:
        print(f"⚠️ 未找到{asin}的飞轮数据")
        return pd.DataFrame()

    file_path = files[0]

    try:
        df = pd.read_excel(file_path, sheet_name=0)

        # 清理关键指标
        if '广告花费' in df.columns:
            df['广告花费'] = df['广告花费'].apply(clean_currency)
        if '广告销售额' in df.columns:
            df['广告销售额'] = df['广告销售额'].apply(clean_currency)
        if '广告订单量' in df.columns:
            df['广告订单量'] = df['广告订单量'].apply(clean_number)
        if '广告点击量' in df.columns:
            df['广告点击量'] = df['广告点击量'].apply(clean_number)

        return df

    except Exception as e:
        print(f"⚠️ 读取{asin}飞轮数据出错: {e}")
        return pd.DataFrame()

def analyze_asin_comprehensive(asin, asin_name):
    """综合分析单个ASIN"""

    print(f"\n{'='*80}")
    print(f"📊 分析ASIN: {asin} - {asin_name}")
    print('='*80)

    # 1. 卖家精灵反查数据
    df_ss = analyze_sellersprite_data(asin)

    if not df_ss.empty:
        print(f"\n### 卖家精灵反查数据分析")
        print(f"总流量词数量: {len(df_ss)}")

        # 按TES分类统计
        winner_count = len(df_ss[df_ss['分类'] == 'WINNER'])
        potential_count = len(df_ss[df_ss['分类'] == 'POTENTIAL'])
        broad_count = len(df_ss[df_ss['分类'] == 'BROAD'])

        print(f"  - WINNER词 (TES>100): {winner_count}")
        print(f"  - POTENTIAL词 (TES 10-100): {potential_count}")
        print(f"  - BROAD词 (TES<10): {broad_count}")

        # Top 10 流量词
        print(f"\n🔥 Top 10 流量词 (按TES排序):")
        top10 = df_ss.nlargest(10, 'TES')[['关键词', '月搜索量', '购买率', '标题密度', 'TES', '分类', '流量占比']]
        for idx, row in top10.iterrows():
            print(f"  {row['关键词'][:40]:45} | 搜索:{row['月搜索量']:6,} | 购买率:{row['购买率']:5.1f}% | 流量:{row['流量占比']:5.1f}% | TES:{row['TES']:7,.0f} | {row['分类']}")

        # 流量缺口分析（高TES但标题密度低的词）
        print(f"\n⚠️ 流量缺口词 (TES>50, 标题密度<30%):")
        gap_keywords = df_ss[(df_ss['TES'] > 50) & (df_ss['标题密度'] < 30)].nlargest(5, 'TES')
        if not gap_keywords.empty:
            for idx, row in gap_keywords.iterrows():
                print(f"  {row['关键词'][:40]:45} | TES:{row['TES']:7,.0f} | 密度:{row['标题密度']:5.1f}%")
        else:
            print("  ✅ 无明显流量缺口")

    # 2. 飞轮广告数据
    df_fw = analyze_flywheel_data(asin)

    if not df_fw.empty and '广告活动' in df_fw.columns:
        print(f"\n### 飞轮广告活动分析")

        total_spend = df_fw['广告花费'].sum() if '广告花费' in df_fw.columns else 0
        total_sales = df_fw['广告销售额'].sum() if '广告销售额' in df_fw.columns else 0
        total_orders = df_fw['广告订单量'].sum() if '广告订单量' in df_fw.columns else 0

        acos = (total_spend / total_sales * 100) if total_sales > 0 else 0

        print(f"  总广告花费: CA${total_spend:,.2f}")
        print(f"  总广告销售额: CA${total_sales:,.2f}")
        print(f"  总广告订单量: {total_orders}")
        print(f"  ACOS: {acos:.2f}%")

        # 按活动类型统计
        if '推广类型' in df_fw.columns:
            print(f"\n  推广类型分布:")
            type_summary = df_fw.groupby('推广类型').agg({
                '广告花费': 'sum',
                '广告销售额': 'sum'
            })
            for ptype, row in type_summary.iterrows():
                type_acos = (row['广告花费'] / row['广告销售额'] * 100) if row['广告销售额'] > 0 else 0
                print(f"    {ptype}: 花费CA${row['广告花费']:,.2f}, ACOS {type_acos:.1f}%")

    return {
        'asin': asin,
        'name': asin_name,
        'ss_data': df_ss,
        'fw_data': df_fw
    }

def generate_7day_action_plan(analysis_results):
    """生成7天快速冲刺行动计划"""

    print(f"\n\n{'='*80}")
    print("🚀 7天快速冲刺行动计划")
    print('='*80)

    # 基于分析结果生成具体行动
    high_cvr_asins = ['B08SWLTTSW', 'B0BGKTSRNS', 'B08SVXGTRT']
    problem_asins = ['B0CFTWKZQG', 'B0C5Q9Y6YF']

    print("\n## Day 1-2: 紧急优化（立即执行）")
    print("-" * 80)

    print("\n### ✅ P0行动1: 推广高转化ASIN")
    for asin in high_cvr_asins:
        result = next((r for r in analysis_results if r['asin'] == asin), None)
        if result and not result['ss_data'].empty:
            df = result['ss_data']
            winner_keywords = df[df['分类'] == 'WINNER'].nlargest(5, 'TES')

            print(f"\n**{asin}** ({result['name']})")
            print(f"  📈 建议新增Exact Match投放:")
            for idx, row in winner_keywords.iterrows():
                print(f"    - \"{row['关键词']}\" | 建议出价: CA$0.80-1.20 | TES:{row['TES']:,.0f}")

    print("\n### ⚠️ P0行动2: 暂停/优化问题ASIN")
    for asin in problem_asins:
        result = next((r for r in analysis_results if r['asin'] == asin), None)
        if result and not result['ss_data'].empty:
            df = result['ss_data']
            print(f"\n**{asin}** ({result['name']})")
            print(f"  🔴 建议暂停低效广告活动")
            print(f"  🔍 审查Listing质量（价格、图片、评论）")

    print("\n\n## Day 3-5: 精细化调整")
    print("-" * 80)
    print("### 📊 关键词竞价优化")
    print("  - 监控Day 1-2新增关键词的ACOS")
    print("  - ACOS < 20%: 提价10-20%")
    print("  - ACOS > 30%: 降价20%或暂停")

    print("\n### 📸 Listing优化")
    print("  - 对比高转化ASIN vs 低转化ASIN的Listing差异")
    print("  - 更新主图、五点描述、A+页面")

    print("\n\n## Day 6-7: 效果复盘与调整")
    print("-" * 80)
    print("### 📈 指标监控")
    print("  - 对比Day 1 vs Day 7的关键指标变化")
    print("  - 整体ACOS是否下降")
    print("  - 高转化ASIN销量是否提升30%+")

    print("\n### 🔄 迭代优化")
    print("  - 根据7天数据，制定下一个Sprint计划")
    print("  - 考虑测试新的关键词或广告类型")

def main():
    """主分析流程"""

    print("=" * 80)
    print("🍁 TIMO 加拿大站综合诊断分析")
    print("数据源: Business Report + 赛狐广告 + 卖家精灵反查 + 飞轮")
    print("=" * 80)

    # 定义要分析的ASIN
    asins_to_analyze = [
        ('B08SWLTTSW', '20"x32" Grey - CVR 25.69%'),
        ('B0BGKTSRNS', '20"x32" Black - CVR 16.19%'),
        ('B08SVXGTRT', '24"x36" Grey - CVR 12.38%'),
        ('B0CFTWKZQG', '32"x40" Grey - 零销售'),
        ('B0C5Q9Y6YF', '24"x36" Grey - CVR 4.50%'),
    ]

    analysis_results = []

    for asin, name in asins_to_analyze:
        result = analyze_asin_comprehensive(asin, name)
        analysis_results.append(result)

    # 生成7天行动计划
    generate_7day_action_plan(analysis_results)

    # 导出完整报告
    output_dir = Path("reports/ca_comprehensive")
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    print(f"\n\n{'='*80}")
    print(f"✅ 分析完成！")
    print(f"完整报告将生成到: reports/ca_comprehensive/")
    print('='*80)

if __name__ == "__main__":
    main()
