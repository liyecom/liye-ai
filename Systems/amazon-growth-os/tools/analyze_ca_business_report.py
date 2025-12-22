#!/usr/bin/env python3
"""
加拿大站 Business Report 分析工具
分析Timo加拿大站的流量、转化和销售表现
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
import json

def clean_currency(value):
    """清理货币格式"""
    if pd.isna(value) or value == '':
        return 0.0
    if isinstance(value, str):
        return float(value.replace('CA$', '').replace(',', ''))
    return float(value)

def clean_number(value):
    """清理数字格式"""
    if pd.isna(value) or value == '':
        return 0
    if isinstance(value, str):
        return int(value.replace(',', ''))
    return int(value)

def clean_percentage(value):
    """清理百分比格式"""
    if pd.isna(value) or value == '':
        return 0.0
    if isinstance(value, str):
        return float(value.replace('%', ''))
    return float(value)

def analyze_business_report(recent_file, yearly_file):
    """分析Business Report数据"""

    print("=" * 80)
    print("🍁 TIMO 加拿大站 Business Report 深度分析")
    print("=" * 80)
    print()

    # 读取数据
    df_recent = pd.read_csv(recent_file)
    df_yearly = pd.read_csv(yearly_file)

    # 清理列名（去除BOM和空格）
    df_recent.columns = df_recent.columns.str.strip().str.replace('﻿', '')
    df_yearly.columns = df_yearly.columns.str.strip().str.replace('﻿', '')

    # 数据清理
    for df in [df_recent, df_yearly]:
        df['会话数'] = df['会话数 - 总计'].apply(clean_number)
        df['销售额'] = df['已订购商品销售额'].apply(clean_currency)
        df['订单数'] = df['订单商品总数'].apply(clean_number)
        df['转化率'] = df['转化率 - 总计'].apply(clean_percentage)
        df['页面浏览量'] = df['页面浏览量 - 总计'].apply(clean_number)

    print("## 📊 数据概览")
    print("-" * 80)
    print(f"最近期数据: {len(df_recent)} 个ASIN")
    print(f"全年数据: {len(df_yearly)} 个ASIN")
    print()

    # 1. 整体表现分析
    print("## 1️⃣ 整体表现对比（最近期 vs 全年）")
    print("-" * 80)

    recent_totals = {
        '总会话数': df_recent['会话数'].sum(),
        '总页面浏览量': df_recent['页面浏览量'].sum(),
        '总销售额': df_recent['销售额'].sum(),
        '总订单数': df_recent['订单数'].sum(),
        '整体转化率': (df_recent['订单数'].sum() / df_recent['会话数'].sum() * 100) if df_recent['会话数'].sum() > 0 else 0
    }

    yearly_totals = {
        '总会话数': df_yearly['会话数'].sum(),
        '总页面浏览量': df_yearly['页面浏览量'].sum(),
        '总销售额': df_yearly['销售额'].sum(),
        '总订单数': df_yearly['订单数'].sum(),
        '整体转化率': (df_yearly['订单数'].sum() / df_yearly['会话数'].sum() * 100) if df_yearly['会话数'].sum() > 0 else 0
    }

    print(f"最近期:")
    print(f"  - 总会话数: {recent_totals['总会话数']:,}")
    print(f"  - 总页面浏览量: {recent_totals['总页面浏览量']:,}")
    print(f"  - 总销售额: CA${recent_totals['总销售额']:,.2f}")
    print(f"  - 总订单数: {recent_totals['总订单数']:,}")
    print(f"  - 整体转化率: {recent_totals['整体转化率']:.2f}%")
    print()

    print(f"全年:")
    print(f"  - 总会话数: {yearly_totals['总会话数']:,}")
    print(f"  - 总页面浏览量: {yearly_totals['总页面浏览量']:,}")
    print(f"  - 总销售额: CA${yearly_totals['总销售额']:,.2f}")
    print(f"  - 总订单数: {yearly_totals['总订单数']:,}")
    print(f"  - 整体转化率: {yearly_totals['整体转化率']:.2f}%")
    print()

    # 2. Top 5 表现最佳ASIN（按销售额）
    print("## 2️⃣ Top 5 销售冠军 ASIN（最近期）")
    print("-" * 80)

    top_sellers_recent = df_recent.nlargest(5, '销售额')[['（子）ASIN', '标题', '会话数', '转化率', '销售额', '订单数']]
    for idx, row in top_sellers_recent.iterrows():
        title_short = row['标题'][:60] + "..." if len(row['标题']) > 60 else row['标题']
        print(f"{idx}. {row['（子）ASIN']}")
        print(f"   标题: {title_short}")
        print(f"   会话数: {row['会话数']:,} | 转化率: {row['转化率']:.2f}% | 销售额: CA${row['销售额']:,.2f} | 订单: {row['订单数']}")
        print()

    # 3. 流量健康度诊断
    print("## 3️⃣ 流量健康度诊断")
    print("-" * 80)

    # 有流量但零销售的ASIN
    zero_sales = df_recent[(df_recent['会话数'] > 50) & (df_recent['销售额'] == 0)]
    print(f"⚠️ 有流量但零销售的ASIN: {len(zero_sales)} 个")
    if len(zero_sales) > 0:
        for idx, row in zero_sales.iterrows():
            title_short = row['标题'][:60] + "..." if len(row['标题']) > 60 else row['标题']
            print(f"  - {row['（子）ASIN']}: {row['会话数']:,} 会话，0销售")
            print(f"    {title_short}")
        print()

    # 低转化率ASIN（有订单但转化率<5%）
    low_cvr = df_recent[(df_recent['订单数'] > 0) & (df_recent['转化率'] < 5) & (df_recent['会话数'] > 100)]
    print(f"⚠️ 低转化率ASIN (CVR < 5%): {len(low_cvr)} 个")
    if len(low_cvr) > 0:
        for idx, row in low_cvr.iterrows():
            title_short = row['标题'][:60] + "..." if len(row['标题']) > 60 else row['标题']
            print(f"  - {row['（子）ASIN']}: CVR={row['转化率']:.2f}%, 会话={row['会话数']:,}, 订单={row['订单数']}")
            print(f"    {title_short}")
        print()

    # 4. 尺寸和颜色表现分析
    print("## 4️⃣ 产品变体表现分析")
    print("-" * 80)

    # 提取尺寸信息
    def extract_size(title):
        import re
        match = re.search(r'(\d+)"?\s*x\s*(\d+)"?', title)
        if match:
            return f"{match.group(1)}x{match.group(2)}"
        return "Unknown"

    # 提取颜色信息
    def extract_color(title):
        colors = ['Grey', 'Black', 'Beige', 'Coffee', 'Light Grey', 'Striped Grey']
        for color in colors:
            if color in title:
                return color
        return "Unknown"

    df_recent['尺寸'] = df_recent['标题'].apply(extract_size)
    df_recent['颜色'] = df_recent['标题'].apply(extract_color)

    # 按尺寸统计
    size_performance = df_recent.groupby('尺寸').agg({
        '会话数': 'sum',
        '销售额': 'sum',
        '订单数': 'sum'
    }).sort_values('销售额', ascending=False)

    print("### 按尺寸分析 (Top 5):")
    for size, row in size_performance.head(5).iterrows():
        avg_order_value = row['销售额'] / row['订单数'] if row['订单数'] > 0 else 0
        print(f"  {size}: CA${row['销售额']:,.2f} (订单: {row['订单数']}, 客单价: CA${avg_order_value:.2f})")
    print()

    # 按颜色统计
    color_performance = df_recent.groupby('颜色').agg({
        '会话数': 'sum',
        '销售额': 'sum',
        '订单数': 'sum'
    }).sort_values('销售额', ascending=False)

    print("### 按颜色分析:")
    for color, row in color_performance.iterrows():
        cvr = (row['订单数'] / row['会话数'] * 100) if row['会话数'] > 0 else 0
        print(f"  {color}: CA${row['销售额']:,.2f} (CVR: {cvr:.2f}%, 订单: {row['订单数']})")
    print()

    # 5. 优化建议
    print("## 5️⃣ 优化建议")
    print("-" * 80)

    # 建议1: 推广高转化ASIN
    high_cvr = df_recent[(df_recent['转化率'] > 15) & (df_recent['会话数'] > 100)].sort_values('销售额', ascending=False)
    if len(high_cvr) > 0:
        print("✅ 建议1: 加大推广高转化ASIN")
        for idx, row in high_cvr.head(3).iterrows():
            print(f"  - {row['（子）ASIN']}: CVR={row['转化率']:.2f}%, 销售额=CA${row['销售额']:,.2f}")
            print(f"    建议: 增加PPC预算，争取更多流量")
        print()

    # 建议2: 优化或下架零销售ASIN
    if len(zero_sales) > 0:
        print("⚠️ 建议2: 优化或下架零销售ASIN")
        for idx, row in zero_sales.head(3).iterrows():
            print(f"  - {row['（子）ASIN']}: {row['会话数']:,} 会话，0销售")
            print(f"    建议: 检查Listing质量、价格竞争力、图片和评论")
        print()

    # 建议3: 颜色和尺寸策略
    print("✅ 建议3: 颜色和尺寸优化策略")
    best_color = color_performance.index[0]
    best_size = size_performance.index[0]
    print(f"  - 最佳颜色: {best_color} (CA${color_performance.loc[best_color, '销售额']:,.2f})")
    print(f"  - 最佳尺寸: {best_size} (CA${size_performance.loc[best_size, '销售额']:,.2f})")
    print(f"  - 建议: 优先推广 {best_color} 颜色和 {best_size} 尺寸的组合")
    print()

    # 6. 导出详细报告
    output_dir = Path("reports/ca_analysis")
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # 导出分析结果
    analysis_results = {
        "analysis_time": timestamp,
        "recent_totals": recent_totals,
        "yearly_totals": yearly_totals,
        "top_sellers": top_sellers_recent.to_dict('records'),
        "zero_sales_asins": zero_sales['（子）ASIN'].tolist(),
        "low_cvr_asins": low_cvr['（子）ASIN'].tolist(),
        "best_color": best_color,
        "best_size": best_size
    }

    with open(output_dir / f"ca_analysis_{timestamp}.json", 'w', encoding='utf-8') as f:
        json.dump(analysis_results, f, ensure_ascii=False, indent=2)

    print(f"📁 详细分析结果已保存到: {output_dir / f'ca_analysis_{timestamp}.json'}")
    print()

    return analysis_results

if __name__ == "__main__":
    recent_file = "uploads/BusinessReport-21-12-25-CA.csv"
    yearly_file = "uploads/BusinessReport-全年-21-12-25-CA.csv"

    results = analyze_business_report(recent_file, yearly_file)

    print("=" * 80)
    print("✅ 分析完成！")
    print("=" * 80)
