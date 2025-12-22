
import json
import os
import sys
import datetime
import pandas as pd

def generate_report():
    # Find the latest JSON for B08SWLTTSW
    raw_dir = "reports/raw_data"
    files = [f for f in os.listdir(raw_dir) if f.startswith("B08SWLTTSW") and f.endswith(".json")]
    if not files:
        print("No raw data found.")
        return
    
    # Sort by time
    files.sort(reverse=True)
    target_file = os.path.join(raw_dir, files[0])
    print(f"Reading data from: {target_file}")
    
    with open(target_file, 'r') as f:
        raw_obj = json.load(f)
        
    # Handle API structure (data -> items)
    items = []
    if "data" in raw_obj:
        d = raw_obj["data"]
        if isinstance(d, list):
            items = d
        elif isinstance(d, dict) and "items" in d:
            items = d["items"]
        elif isinstance(d, dict) and "keyword" in d:
             # Single item? unlikely but possible
             items = [d]
             
    if not items:
        print("No items found in JSON.")
        return

    # Convert to DF for easier sorting
    df = pd.DataFrame(items)
    
    # Clean/Rename columns if needed
    # Map API keys to standard names
    # keyword, keywordCn, searches, products, purchases, purchaseRate
    
    # Sort by Search Volume
    df['searches'] = pd.to_numeric(df['searches'], errors='coerce').fillna(0)
    df['purchases'] = pd.to_numeric(df['purchases'], errors='coerce').fillna(0)
    df = df.sort_values(by='searches', ascending=False)
    
    # Report Content
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M")
    report_file = f"reports/markdown/B08SWLTTSW_Optimization_{timestamp}.md"
    
    with open(report_file, "w", encoding='utf-8') as f:
        f.write(f"# PPC 广告优化建议书 (Fallback Generated)\n")
        f.write(f"## ASIN: B08SWLTTSW\n\n")
        
        f.write(f"## 📊 反查数据核心发现\n")
        f.write(f"- **关键词总数**: {len(df)}\n")
        f.write(f"- **总搜索量**: {int(df['searches'].sum()):,}\n")
        f.write(f"- **分析时间**: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n")
        
        f.write(f"## 🎯 一、建议新增的 Exact 精准投放词 (Top Opportunities)\n")
        f.write(f"### A级优先（立即执行）- 高搜索 & 高转化\n")
        
        # Logic: Searches > 5000 AND Purchase Rate > 1% (0.01)
        # Note: API purchaseRate might be 0.0114 (1.14%)
        
        top_opps = df[ (df['searches'] > 5000) & (df['purchaseRate'] > 0.01) ].head(10)
        
        if top_opps.empty:
            f.write("暂无完全符合A级标准的词，建议查看B级。\n")
        else:
            for _, row in top_opps.iterrows():
                kw_cn = f" ({row.get('keywordCn', '')})" if row.get('keywordCn') else ""
                rate = float(row.get('purchaseRate', 0)) * 100
                f.write(f"#### 1. **{row['keyword']}**{kw_cn}\n")
                f.write(f"- **理由**: 月搜索量 {int(row['searches']):,}，购买率 {rate:.2f}%\n")
                f.write(f"- **建议出价**: ${row.get('bid', 'N/A')}\n\n")
                
        f.write(f"## 🚀 二、潜在机会词 (Traffic Drivers)\n")
        f.write(f"### B级优先 - 搜索量巨大\n")
        
        traffic_drivers = df[ (df['searches'] > 10000) ].head(5)
        for _, row in traffic_drivers.iterrows():
             # Avoid dupe if already in A
             f.write(f"- **{row['keyword']}**: 搜索量 {int(row['searches']):,}, 供需比 {row.get('supplyDemandRatio', 'N/A')}\n")

        f.write(f"\n## ⛔ 三、建议否定的词 (Negative Candidates)\n")
        f.write(f"### 低相关性或低转化警报\n")
        
        # Logic: High impressions potential (Searches > 2000) but Purchase Rate < 0.2%
        negatives = df[ (df['searches'] > 2000) & (df['purchaseRate'] < 0.002) ].head(5)
        
        if negatives.empty:
             f.write("暂无明显的高流量低转化词。\n")
        else:
            for _, row in negatives.iterrows():
                f.write(f"- **{row['keyword']}**: 搜索量 {int(row['searches']):,}, 购买率仅 {float(row['purchaseRate'])*100:.2f}%\n")

    print(f"Report generated: {report_file}")
    # Print preview
    with open(report_file, 'r') as f:
        print(f.read())

if __name__ == "__main__":
    generate_report()
