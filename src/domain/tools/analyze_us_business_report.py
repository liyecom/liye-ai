#!/usr/bin/env python3
"""
美国站Business Report分析脚本
分析Timo美国站的整体业务健康度
"""

import pandas as pd
import sys
from pathlib import Path

def clean_number(value):
    """清理数字字符串，移除逗号和美元符号"""
    if pd.isna(value) or value == '':
        return 0
    if isinstance(value, (int, float)):
        return float(value)
    # 移除美元符号、逗号
    cleaned = str(value).replace('US$', '').replace('$', '').replace(',', '').strip()
    try:
        return float(cleaned)
    except:
        return 0

def clean_percentage(value):
    """清理百分比字符串"""
    if pd.isna(value) or value == '':
        return 0
    if isinstance(value, (int, float)):
        return float(value)
    # 移除百分号
    cleaned = str(value).replace('%', '').strip()
    try:
        return float(cleaned)
    except:
        return 0

def analyze_business_report(file_path, period_name):
    """分析Business Report数据"""
    print(f"\n{'='*60}")
    print(f"分析 {period_name} 数据")
    print(f"文件: {file_path}")
    print(f"{'='*60}\n")

    # 读取数据
    df = pd.read_csv(file_path, encoding='utf-8-sig')

    # 清理列名（去除BOM和空格）
    df.columns = df.columns.str.strip()

    # 数据清洗
    df['工作階段'] = df['工作階段 - 總計'].apply(clean_number)
    df['頁面瀏覽量'] = df['頁面瀏覽次數 - 總計'].apply(clean_number)
    df['商品工作階段百分比_cleaned'] = df['商品工作階段百分比'].apply(clean_percentage)
    df['訂購產品銷售額_cleaned'] = df['訂購產品銷售額'].apply(clean_number)
    df['訂單商品總數_cleaned'] = df['訂單商品總數'].apply(clean_number)
    df['已訂購單位數量_cleaned'] = df['已訂購單位數量'].apply(clean_number)

    # 移除无销售数据的行
    df = df[df['訂購產品銷售額_cleaned'] > 0].copy()

    # 计算CVR（如果为0，从订单/会话计算）
    df['CVR'] = df.apply(
        lambda row: row['商品工作階段百分比_cleaned'] if row['商品工作階段百分比_cleaned'] > 0
        else (row['訂單商品總數_cleaned'] / row['工作階段'] * 100 if row['工作階段'] > 0 else 0),
        axis=1
    )

    # 整体统计
    total_sessions = df['工作階段'].sum()
    total_pageviews = df['頁面瀏覽量'].sum()
    total_orders = df['訂單商品總數_cleaned'].sum()
    total_units = df['已訂購單位數量_cleaned'].sum()
    total_sales = df['訂購產品銷售額_cleaned'].sum()
    overall_cvr = (total_orders / total_sessions * 100) if total_sessions > 0 else 0

    print(f"📊 {period_name} 整体数据")
    print(f"-" * 60)
    print(f"总会话数: {total_sessions:,.0f}")
    print(f"总页面浏览量: {total_pageviews:,.0f}")
    print(f"总订单数: {total_orders:,.0f}")
    print(f"总销售件数: {total_units:,.0f}")
    print(f"总销售额: US${total_sales:,.2f}")
    print(f"整体CVR: {overall_cvr:.2f}%")
    print(f"平均客单价: US${(total_sales/total_orders if total_orders > 0 else 0):.2f}")
    print()

    # Top 10 ASIN by Sales
    top10_sales = df.nlargest(10, '訂購產品銷售額_cleaned')

    print(f"💰 {period_name} Top 10 ASIN (按销售额)")
    print(f"-" * 60)
    print(f"{'排名':<6}{'父ASIN':<15}{'销售额':<15}{'订单':<10}{'CVR':<10}{'流量':<10}")
    print(f"-" * 60)

    for idx, (i, row) in enumerate(top10_sales.iterrows(), 1):
        print(f"{idx:<6}{row['(父) ASIN']:<15}"
              f"US${row['訂購產品銷售額_cleaned']:>10,.2f}  "
              f"{row['訂單商品總數_cleaned']:>6.0f}  "
              f"{row['CVR']:>6.2f}%  "
              f"{row['工作階段']:>8,.0f}")

    print()

    # 分析变体分布（从子ASIN标题中提取尺寸）
    def extract_size_from_title(title):
        """从标题提取尺寸"""
        if pd.isna(title):
            return "未知"
        title_str = str(title)
        # 查找类似 20"x32" 或 24"x36" 的模式
        import re
        size_match = re.search(r'\d+["\']?\s*x\s*\d+["\']?', title_str, re.IGNORECASE)
        if size_match:
            return size_match.group().replace('"', '').replace("'", '').replace(' ', '')
        return "未知"

    def extract_color_from_title(title):
        """从标题提取颜色"""
        if pd.isna(title):
            return "未知"
        title_str = str(title).lower()
        colors = ['grey', 'gray', 'black', 'brown', 'beige', 'blue', 'red']
        for color in colors:
            if color in title_str:
                return color.capitalize()
        return "未知"

    df['尺寸'] = df['標題'].apply(extract_size_from_title)
    df['颜色'] = df['標題'].apply(extract_color_from_title)

    # 尺寸分布
    size_stats = df.groupby('尺寸').agg({
        '訂購產品銷售額_cleaned': 'sum',
        '訂單商品總數_cleaned': 'sum',
        '工作階段': 'sum'
    }).sort_values('訂購產品銷售額_cleaned', ascending=False)

    print(f"📏 {period_name} 尺寸分布")
    print(f"-" * 60)
    print(f"{'尺寸':<15}{'销售额':<15}{'占比':<10}{'订单':<10}{'CVR':<10}")
    print(f"-" * 60)

    for size, row in size_stats.iterrows():
        pct = row['訂購產品銷售額_cleaned'] / total_sales * 100
        cvr = (row['訂單商品總數_cleaned'] / row['工作階段'] * 100) if row['工作階段'] > 0 else 0
        print(f"{size:<15}US${row['訂購產品銷售額_cleaned']:>10,.2f}  "
              f"{pct:>6.2f}%  "
              f"{row['訂單商品總數_cleaned']:>6.0f}  "
              f"{cvr:>6.2f}%")

    print()

    # 颜色分布
    color_stats = df.groupby('颜色').agg({
        '訂購產品銷售額_cleaned': 'sum',
        '訂單商品總數_cleaned': 'sum',
        '工作階段': 'sum'
    }).sort_values('訂購產品銷售額_cleaned', ascending=False)

    print(f"🎨 {period_name} 颜色分布")
    print(f"-" * 60)
    print(f"{'颜色':<15}{'销售额':<15}{'占比':<10}{'订单':<10}{'CVR':<10}")
    print(f"-" * 60)

    for color, row in color_stats.iterrows():
        pct = row['訂購產品銷售額_cleaned'] / total_sales * 100
        cvr = (row['訂單商品總數_cleaned'] / row['工作階段'] * 100) if row['工作階段'] > 0 else 0
        print(f"{color:<15}US${row['訂購產品銷售額_cleaned']:>10,.2f}  "
              f"{pct:>6.2f}%  "
              f"{row['訂單商品總數_cleaned']:>6.0f}  "
              f"{cvr:>6.2f}%")

    print()

    return {
        'total_sales': total_sales,
        'total_orders': total_orders,
        'total_sessions': total_sessions,
        'overall_cvr': overall_cvr,
        'top10_asins': top10_sales['(父) ASIN'].tolist()
    }

def main():
    # 文件路径
    base_path = Path("uploads/Timo-US")
    recent_file = base_path / "BusinessReport近30天-12-25-25 .csv"
    annual_file = base_path / "BusinessReport年度-12-25-25.csv"

    # 检查文件
    if not recent_file.exists():
        print(f"❌ 未找到文件: {recent_file}")
        return

    if not annual_file.exists():
        print(f"❌ 未找到文件: {annual_file}")
        return

    # 分析数据
    recent_stats = analyze_business_report(recent_file, "近30天")
    annual_stats = analyze_business_report(annual_file, "整年")

    # 对比分析
    print(f"\n{'='*60}")
    print("📈 近期表现 vs 整年表现")
    print(f"{'='*60}\n")

    print(f"CVR对比:")
    print(f"  整年CVR: {annual_stats['overall_cvr']:.2f}%")
    print(f"  近30天CVR: {recent_stats['overall_cvr']:.2f}%")
    cvr_diff = recent_stats['overall_cvr'] - annual_stats['overall_cvr']
    print(f"  差异: {cvr_diff:+.2f}% {'✅ 改善' if cvr_diff > 0 else '⚠️ 下降'}")
    print()

    print(f"Top 10 ASIN (按近30天销售额):")
    print(f"建议对以下5个ASIN进行深度关键词反查：")
    for i, asin in enumerate(recent_stats['top10_asins'][:5], 1):
        print(f"  {i}. {asin}")
    print()

    print("✅ 分析完成！")
    print()
    print("📋 下一步:")
    print("1. 使用卖家精灵对以上5个ASIN进行反查")
    print("2. 导出格式: ReverseASIN-US-[ASIN]-Last-30-days.xlsx")
    print("3. 上传到 uploads/Timo-US/ 目录")

if __name__ == "__main__":
    main()
