#!/usr/bin/env python3
"""
Amazon Search Term Report 关键词级别分析工具
根据专家研讨会结论，进行精细化关键词优化

Author: Amazon Growth OS
Date: 2025-12-25
Version: 1.0
"""

import pandas as pd
import numpy as np
import glob
import os
from datetime import datetime
from pathlib import Path

# 配置路径
UPLOAD_DIR = Path("/Users/liye/Documents/amazon-runtime/uploads/Timo-US")
REPORT_DIR = Path("/Users/liye/github/liye_os/Systems/amazon-growth-os/reports/markdown")

def load_search_term_report(file_pattern="SearchTermReport*.csv"):
    """
    加载搜索词报告

    支持的文件名格式：
    - SearchTermReport-US-SP-20251126-20251225.csv
    - Sponsored-Products-Search-term-report*.csv
    """
    files = list(UPLOAD_DIR.glob(file_pattern))

    if not files:
        print(f"❌ 未找到搜索词报告文件")
        print(f"   查找路径: {UPLOAD_DIR}")
        print(f"   查找模式: {file_pattern}")
        print(f"\n💡 请先导出搜索词报告，参考教程: docs/tutorials/导出Amazon搜索词报告教程.md")
        return None

    # 取最新的文件
    latest_file = sorted(files)[-1]
    print(f"✅ 找到搜索词报告: {latest_file.name}")

    try:
        df = pd.read_csv(latest_file)
        print(f"   数据行数: {len(df)}")
        print(f"   列数: {len(df.columns)}")
        return df, latest_file
    except Exception as e:
        print(f"❌ 文件读取失败: {e}")
        return None, None


def standardize_columns(df):
    """
    标准化列名（兼容Amazon不同格式的搜索词报告）
    """
    # 列名映射表（Amazon的列名可能有变化）
    column_mapping = {
        'Customer Search Term': 'search_term',
        'Campaign Name': 'campaign',
        'Ad Group Name': 'ad_group',
        'Match Type': 'match_type',
        'Impressions': 'impressions',
        'Clicks': 'clicks',
        'Click-Thru Rate (CTR)': 'ctr',
        'Cost Per Click (CPC)': 'cpc',
        'Spend': 'spend',
        '7 Day Total Sales': 'sales',
        'Total Advertising Cost of Sales (ACoS)': 'acos',
        '7 Day Total Orders (#)': 'orders',
        '7 Day Conversion Rate': 'cvr',

        # 备用列名（有些报告用这些）
        'Search Term': 'search_term',
        'Sales': 'sales',
        'Orders': 'orders',
        'ACoS': 'acos',
        'Conversion Rate': 'cvr',
    }

    # 重命名列
    df_renamed = df.rename(columns=column_mapping)

    # 确保必需列存在
    required_cols = ['search_term', 'campaign', 'spend', 'sales', 'clicks']
    missing_cols = [col for col in required_cols if col not in df_renamed.columns]

    if missing_cols:
        print(f"⚠️ 缺少必需列: {missing_cols}")
        print(f"   可用列: {list(df_renamed.columns)}")
        return None

    # 计算ACoS（如果文件中没有）
    if 'acos' not in df_renamed.columns:
        df_renamed['acos'] = np.where(
            df_renamed['sales'] > 0,
            df_renamed['spend'] / df_renamed['sales'],
            999.99  # 无销售时设为极高值
        )
    else:
        # 如果ACoS是百分比格式（如 "34.5%"），需要转换
        if df_renamed['acos'].dtype == 'object':
            df_renamed['acos'] = df_renamed['acos'].str.replace('%', '').astype(float) / 100

    # 计算CVR（如果文件中没有）
    if 'cvr' not in df_renamed.columns and 'orders' in df_renamed.columns:
        df_renamed['cvr'] = np.where(
            df_renamed['clicks'] > 0,
            df_renamed['orders'] / df_renamed['clicks'],
            0
        )

    return df_renamed


def classify_keywords(df):
    """
    按照专家研讨会标准，进行关键词分层

    分层标准（张伟PPC专家）:
    - S级（明星词）：ACOS < 30%，销售 > $100 → 提高竞价20%
    - A级（优秀词）：ACOS 30-40%，销售 > $50 → 保持竞价
    - B级（观察词）：ACOS 40-60%，销售 > $20 → 降低竞价30%
    - C级（问题词）：ACOS > 60%，或转化率 < 2% → 否定
    - D级（垃圾词）：花费 > $5，销售 = $0 → 立即否定
    """
    def get_tier(row):
        spend = row['spend']
        sales = row['sales']
        acos = row['acos']
        cvr = row.get('cvr', 0)

        # D级：花费 > $5，销售 = $0 → 立即否定
        if spend > 5 and sales == 0:
            return 'D'

        # C级：ACOS > 60%，或转化率 < 2% → 否定
        if acos > 0.60 or (cvr > 0 and cvr < 0.02):
            return 'C'

        # S级：ACOS < 30%，销售 > $100 → 提高竞价20%
        if acos < 0.30 and sales > 100:
            return 'S'

        # A级：ACOS 30-40%，销售 > $50 → 保持竞价
        if 0.30 <= acos <= 0.40 and sales > 50:
            return 'A'

        # B级：ACOS 40-60%，销售 > $20 → 降低竞价30%
        if 0.40 < acos <= 0.60 and sales > 20:
            return 'B'

        # 其他情况默认为B级（观察）
        return 'B'

    df['tier'] = df.apply(get_tier, axis=1)
    return df


def generate_negative_keyword_lists(df):
    """
    生成否定关键词列表

    返回：
    - exact_negatives: 精准否定（Negative Exact）
    - phrase_negatives: 词组否定（Negative Phrase）
    """
    # C级和D级需要否定
    to_negate = df[df['tier'].isin(['C', 'D'])].copy()

    # 按花费排序（优先否定高花费的垃圾词）
    to_negate = to_negate.sort_values('spend', ascending=False)

    # 精准否定：D级（完全浪费）
    exact_negatives = to_negate[to_negate['tier'] == 'D']['search_term'].tolist()

    # 词组否定：C级中的高频词根（可选，需要人工判断）
    phrase_negatives = []

    # 识别常见的无效词根（例如"free", "cheap", "tutorial"等）
    useless_patterns = ['free', 'cheap', 'tutorial', 'diy', 'how to', 'review']
    c_tier = to_negate[to_negate['tier'] == 'C']

    for pattern in useless_patterns:
        matching = c_tier[c_tier['search_term'].str.contains(pattern, case=False, na=False)]
        if len(matching) >= 3:  # 至少3个C级词包含该词根
            phrase_negatives.append(pattern)

    return {
        'exact': exact_negatives,
        'phrase': phrase_negatives,
        'to_negate_df': to_negate
    }


def calculate_optimization_impact(df, negatives):
    """
    计算优化后的预期效果
    """
    # 当前状态
    current_spend = df['spend'].sum()
    current_sales = df['sales'].sum()
    current_acos = (current_spend / current_sales * 100) if current_sales > 0 else 0

    # 否定后的状态（移除C级和D级）
    after_negate = df[~df['tier'].isin(['C', 'D'])].copy()
    spend_after_negate = after_negate['spend'].sum()
    sales_after_negate = after_negate['sales'].sum()
    acos_after_negate = (spend_after_negate / sales_after_negate * 100) if sales_after_negate > 0 else 0

    # S级词提高竞价20%后的预估（假设销售增长15%）
    s_tier = df[df['tier'] == 'S']
    s_sales_increase = s_tier['sales'].sum() * 0.15
    s_spend_increase = s_tier['spend'].sum() * 0.20

    # 最终预估
    final_spend = spend_after_negate + s_spend_increase
    final_sales = sales_after_negate + s_sales_increase
    final_acos = (final_spend / final_sales * 100) if final_sales > 0 else 0

    return {
        'current': {
            'spend': current_spend,
            'sales': current_sales,
            'acos': current_acos
        },
        'after_negate': {
            'spend': spend_after_negate,
            'sales': sales_after_negate,
            'acos': acos_after_negate,
            'saved_spend': current_spend - spend_after_negate,
            'lost_sales': current_sales - sales_after_negate
        },
        'final': {
            'spend': final_spend,
            'sales': final_sales,
            'acos': final_acos,
            'net_saved_spend': current_spend - final_spend,
            'net_sales_change': final_sales - current_sales
        }
    }


def generate_markdown_report(df, negatives, impact, output_file):
    """
    生成Markdown格式的优化报告
    """
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 统计各层级关键词
    tier_stats = df.groupby('tier').agg({
        'search_term': 'count',
        'spend': 'sum',
        'sales': 'sum',
        'clicks': 'sum'
    }).reset_index()
    tier_stats['acos'] = tier_stats['spend'] / tier_stats['sales'] * 100

    report = f"""# TIMO-US 关键词级别优化方案

**生成时间**: {timestamp}
**数据来源**: Amazon Search Term Report
**分析关键词数**: {len(df)} 个
**优化方法**: 专家研讨会共识（关键词分层 + 否定词策略）

---

## 📊 一、关键词健康度诊断

### 1.1 关键词分层统计

| 层级 | 数量 | 总花费 | 总销售 | ACOS | 占比 | 策略 |
|------|------|--------|--------|------|------|------|
"""

    tier_order = ['S', 'A', 'B', 'C', 'D']
    tier_names = {
        'S': '⭐ S级-明星词',
        'A': '✅ A级-优秀词',
        'B': '⚠️ B级-观察词',
        'C': '🔴 C级-问题词',
        'D': '❌ D级-垃圾词'
    }
    tier_actions = {
        'S': '提高竞价20%',
        'A': '保持竞价',
        'B': '降低竞价30%',
        'C': '否定关键词',
        'D': '立即否定'
    }

    for tier in tier_order:
        if tier in tier_stats['tier'].values:
            row = tier_stats[tier_stats['tier'] == tier].iloc[0]
            report += f"| {tier_names[tier]} | {int(row['search_term'])} | ${row['spend']:.2f} | ${row['sales']:.2f} | {row['acos']:.1f}% | {row['search_term']/len(df)*100:.1f}% | {tier_actions[tier]} |\n"

    report += f"""

### 1.2 核心问题识别

**🔴 浪费花费的关键词** (C级 + D级):
- 数量: {len(df[df['tier'].isin(['C', 'D'])])} 个
- 浪费花费: ${df[df['tier'].isin(['C', 'D'])]['spend'].sum():.2f}
- 无效销售: ${df[df['tier'].isin(['C', 'D'])]['sales'].sum():.2f}
- **建议**: 立即否定这些关键词

**⭐ 明星关键词** (S级):
- 数量: {len(df[df['tier'] == 'S'])} 个
- 贡献销售: ${df[df['tier'] == 'S']['sales'].sum():.2f}
- 平均ACOS: {(df[df['tier'] == 'S']['spend'].sum() / df[df['tier'] == 'S']['sales'].sum() * 100) if df[df['tier'] == 'S']['sales'].sum() > 0 else 0:.1f}%
- **建议**: 提高竞价20%，加大投入

---

## 🎯 二、优化前后对比

### 2.1 当前状态（优化前）

- 总花费: **${impact['current']['spend']:.2f}**
- 总销售: **${impact['current']['sales']:.2f}**
- 整体ACOS: **{impact['current']['acos']:.2f}%**

### 2.2 否定C/D级词后

- 总花费: **${impact['after_negate']['spend']:.2f}** (↓ ${impact['after_negate']['saved_spend']:.2f})
- 总销售: **${impact['after_negate']['sales']:.2f}** (↓ ${impact['after_negate']['lost_sales']:.2f})
- ACOS: **{impact['after_negate']['acos']:.2f}%** (↓ {impact['current']['acos'] - impact['after_negate']['acos']:.2f}%)

### 2.3 提高S级词竞价后（最终预估）

- 总花费: **${impact['final']['spend']:.2f}**
- 总销售: **${impact['final']['sales']:.2f}** (↑ ${impact['final']['net_sales_change']:.2f})
- ACOS: **{impact['final']['acos']:.2f}%** (↓ {impact['current']['acos'] - impact['final']['acos']:.2f}%)

**💰 预计效果**:
- ACOS降低: **{impact['current']['acos'] - impact['final']['acos']:.2f}%**
- 销售提升: **${impact['final']['net_sales_change']:.2f}**
- 投入效率: **提升 {(impact['current']['acos'] / impact['final']['acos'] - 1) * 100 if impact['final']['acos'] > 0 else 0:.1f}%**

---

## ❌ 三、否定关键词清单

### 3.1 D级-立即否定（花费 > $5，销售 = $0）

**数量**: {len(negatives['exact'])} 个
**浪费花费**: ${df[df['tier'] == 'D']['spend'].sum():.2f}

**前20个高花费垃圾词**:

"""

    # D级词列表（按花费排序）
    d_tier = negatives['to_negate_df'][negatives['to_negate_df']['tier'] == 'D'].head(20)
    for idx, row in d_tier.iterrows():
        report += f"- **{row['search_term']}** (花费: ${row['spend']:.2f}, 点击: {int(row['clicks'])}, 销售: $0)\n"

    report += f"""

### 3.2 C级-建议否定（ACOS > 60% 或 CVR < 2%）

**数量**: {len(negatives['to_negate_df'][negatives['to_negate_df']['tier'] == 'C'])} 个
**浪费花费**: ${df[df['tier'] == 'C']['spend'].sum():.2f}

**前20个高花费问题词**:

"""

    # C级词列表（按花费排序）
    c_tier = negatives['to_negate_df'][negatives['to_negate_df']['tier'] == 'C'].head(20)
    for idx, row in c_tier.iterrows():
        report += f"- **{row['search_term']}** (花费: ${row['spend']:.2f}, ACOS: {row['acos']*100:.1f}%, 销售: ${row['sales']:.2f})\n"

    report += f"""

### 3.3 可复制粘贴的否定词列表

**Negative Exact（精准否定）** - 直接复制到Amazon后台:

```
{', '.join(negatives['exact'][:50])}
```

**Negative Phrase（词组否定）** - 慎用，先人工判断:

```
{', '.join(negatives['phrase']) if negatives['phrase'] else '（暂无推荐）'}
```

---

## ⭐ 四、加大投入的明星词

### 4.1 S级-明星词列表（建议提高竞价20%）

**数量**: {len(df[df['tier'] == 'S'])} 个
**贡献销售**: ${df[df['tier'] == 'S']['sales'].sum():.2f}
**平均ACOS**: {(df[df['tier'] == 'S']['spend'].sum() / df[df['tier'] == 'S']['sales'].sum() * 100) if df[df['tier'] == 'S']['sales'].sum() > 0 else 0:.1f}%

**明星词明细**:

| 排名 | 关键词 | 当前花费 | 销售 | ACOS | 点击 | 订单 | 建议竞价调整 |
|------|--------|----------|------|------|------|------|-------------|
"""

    s_tier = df[df['tier'] == 'S'].sort_values('sales', ascending=False)
    for idx, (i, row) in enumerate(s_tier.iterrows(), 1):
        report += f"| {idx} | {row['search_term']} | ${row['spend']:.2f} | ${row['sales']:.2f} | {row['acos']*100:.1f}% | {int(row['clicks'])} | {int(row.get('orders', 0))} | **+20%** |\n"

    report += f"""

---

## ✅ 五、A级-优秀词列表（保持当前竞价）

**数量**: {len(df[df['tier'] == 'A'])} 个
**贡献销售**: ${df[df['tier'] == 'A']['sales'].sum():.2f}
**平均ACOS**: {(df[df['tier'] == 'A']['spend'].sum() / df[df['tier'] == 'A']['sales'].sum() * 100) if df[df['tier'] == 'A']['sales'].sum() > 0 else 0:.1f}%

**优秀词明细**:

| 排名 | 关键词 | 花费 | 销售 | ACOS | 建议 |
|------|--------|------|------|------|------|
"""

    a_tier = df[df['tier'] == 'A'].sort_values('sales', ascending=False).head(10)
    for idx, (i, row) in enumerate(a_tier.iterrows(), 1):
        report += f"| {idx} | {row['search_term']} | ${row['spend']:.2f} | ${row['sales']:.2f} | {row['acos']*100:.1f}% | 保持竞价 |\n"

    report += f"""

---

## ⚠️ 六、B级-观察词列表（建议降低竞价30%）

**数量**: {len(df[df['tier'] == 'B'])} 个
**花费**: ${df[df['tier'] == 'B']['spend'].sum():.2f}
**平均ACOS**: {(df[df['tier'] == 'B']['spend'].sum() / df[df['tier'] == 'B']['sales'].sum() * 100) if df[df['tier'] == 'B']['sales'].sum() > 0 else 0:.1f}%

**观察词明细**（仅显示前10个）:

| 排名 | 关键词 | 花费 | 销售 | ACOS | 建议 |
|------|--------|------|------|------|------|
"""

    b_tier = df[df['tier'] == 'B'].sort_values('spend', ascending=False).head(10)
    for idx, (i, row) in enumerate(b_tier.iterrows(), 1):
        report += f"| {idx} | {row['search_term']} | ${row['spend']:.2f} | ${row['sales']:.2f} | {row['acos']*100:.1f}% | 降低竞价30% |\n"

    report += f"""

---

## 🎯 七、执行检查清单

### 7.1 立即执行（P0-紧急）

- [ ] **暂停D级垃圾词** ({len(negatives['exact'])} 个)
  - 路径: 广告活动 → 否定关键词 → 添加
  - 操作: 复制上方"Negative Exact"列表，粘贴到Amazon后台
  - 预计节省: **${df[df['tier'] == 'D']['spend'].sum():.2f}/月**

- [ ] **否定C级问题词** ({len(negatives['to_negate_df'][negatives['to_negate_df']['tier'] == 'C'])} 个)
  - 同上操作
  - 预计节省: **${df[df['tier'] == 'C']['spend'].sum():.2f}/月**

### 7.2 3天内执行（P1-重要）

- [ ] **提高S级明星词竞价20%** ({len(df[df['tier'] == 'S'])} 个)
  - 路径: 广告活动 → 关键词 → 调整竞价
  - 预计销售提升: **${df[df['tier'] == 'S']['sales'].sum() * 0.15:.2f}/月**

- [ ] **降低B级观察词竞价30%** ({len(df[df['tier'] == 'B'])} 个)
  - 同上操作
  - 预计节省: **${df[df['tier'] == 'B']['spend'].sum() * 0.30:.2f}/月**

### 7.3 1周内执行（P2-可选）

- [ ] **为S级明星词单独创建Exact广告活动**
  - 目的: 更精准控制竞价和预算
  - 建议活动名: "Exact-{关键词简称}-高ROI"

- [ ] **监控效果并复盘**
  - 7天后重新导出Search Term Report
  - 对比ACOS变化
  - 识别新的S级词

---

## 📞 需要支持？

**如果遇到问题**:
1. 否定词操作不熟悉 → 提供详细操作教程
2. 某些词不确定是否否定 → 我帮你人工判断
3. 预期效果未达成 → 深度诊断原因

---

**报告生成时间**: {timestamp}
**分析工具**: Amazon Growth OS v2.0 - Keyword Level Optimizer
**数据来源**: {len(df)} 个搜索词，{len(df['campaign'].unique())} 个广告活动
"""

    # 保存报告
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"\n✅ 报告已生成: {output_file}")
    return report


def main():
    """
    主函数
    """
    print("=" * 80)
    print("🚀 Amazon Search Term Report 关键词级别分析工具")
    print("=" * 80)

    # 1. 加载搜索词报告
    print("\n📂 步骤1: 加载搜索词报告...")
    result = load_search_term_report()

    if result is None:
        print("\n❌ 未找到搜索词报告文件，程序退出")
        print("💡 请先参考教程导出: docs/tutorials/导出Amazon搜索词报告教程.md")
        return

    df, source_file = result

    # 2. 标准化列名
    print("\n🔄 步骤2: 标准化数据格式...")
    df = standardize_columns(df)

    if df is None:
        print("❌ 数据格式不符合要求，程序退出")
        return

    print(f"   ✅ 数据标准化完成")
    print(f"   分析关键词: {len(df)} 个")
    print(f"   覆盖广告活动: {len(df['campaign'].unique())} 个")

    # 3. 关键词分层
    print("\n🎯 步骤3: 关键词分层分析...")
    df = classify_keywords(df)

    tier_counts = df['tier'].value_counts()
    print(f"   ⭐ S级-明星词: {tier_counts.get('S', 0)} 个")
    print(f"   ✅ A级-优秀词: {tier_counts.get('A', 0)} 个")
    print(f"   ⚠️ B级-观察词: {tier_counts.get('B', 0)} 个")
    print(f"   🔴 C级-问题词: {tier_counts.get('C', 0)} 个")
    print(f"   ❌ D级-垃圾词: {tier_counts.get('D', 0)} 个")

    # 4. 生成否定关键词列表
    print("\n❌ 步骤4: 生成否定关键词列表...")
    negatives = generate_negative_keyword_lists(df)

    print(f"   Negative Exact: {len(negatives['exact'])} 个")
    print(f"   Negative Phrase: {len(negatives['phrase'])} 个")
    print(f"   需否定总数: {len(negatives['to_negate_df'])} 个")

    # 5. 计算优化效果
    print("\n💰 步骤5: 计算优化预期效果...")
    impact = calculate_optimization_impact(df, negatives)

    print(f"   当前ACOS: {impact['current']['acos']:.2f}%")
    print(f"   优化后ACOS: {impact['final']['acos']:.2f}%")
    print(f"   ACOS降低: {impact['current']['acos'] - impact['final']['acos']:.2f}%")
    print(f"   预计销售增长: ${impact['final']['net_sales_change']:.2f}")

    # 6. 生成报告
    print("\n📝 步骤6: 生成优化报告...")
    timestamp = datetime.now().strftime("%Y%m%d")
    output_file = REPORT_DIR / f"TIMO-US关键词优化方案-{timestamp}.md"

    generate_markdown_report(df, negatives, impact, output_file)

    print("\n" + "=" * 80)
    print("✅ 分析完成！")
    print(f"📄 报告路径: {output_file}")
    print("=" * 80)

    # 7. 输出关键行动项
    print("\n🎯 下一步行动:")
    print(f"   1. 打开报告: {output_file}")
    print(f"   2. 复制 Section 3.3 的否定词列表")
    print(f"   3. 在Amazon后台添加否定关键词")
    print(f"   4. 调整S级词竞价 +20%")
    print(f"   5. 7天后重新导出Search Term Report，对比效果")
    print()


if __name__ == "__main__":
    main()
