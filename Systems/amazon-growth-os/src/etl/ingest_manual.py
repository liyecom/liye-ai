import duckdb
import pandas as pd
import os
import glob
from pathlib import Path
from datetime import datetime

# Database Path
DB_PATH = "data/growth_os.duckdb"
UPLOADS_DIR = "uploads"

def init_db(con):
    """Initialize tables for manual data."""
    # 1. Traffic Table (From Business Report)
    con.execute("DROP TABLE IF EXISTS factor_traffic_daily")
    con.execute("""
        CREATE TABLE IF NOT EXISTS factor_traffic_daily (
            parent_asin VARCHAR,
            child_asin VARCHAR,
            title VARCHAR,
            sessions INTEGER,
            sessions_b2b INTEGER,
            session_percentage VARCHAR,
            page_views INTEGER,
            buy_box_percentage VARCHAR,
            units_ordered INTEGER,
            unit_session_percentage VARCHAR, -- Conversion Rate
            ordered_product_sales VARCHAR,
            total_order_items INTEGER,
            report_date DATE,
            report_type VARCHAR
        )
    """)
    
    # 2. Search Term Table (From Advertising Report)
    con.execute("DROP TABLE IF EXISTS factor_search_term_performance")
    con.execute("""
        CREATE TABLE IF NOT EXISTS factor_search_term_performance (
            campaign_name VARCHAR,
            ad_group_name VARCHAR,
            targeting VARCHAR,
            match_type VARCHAR,
            customer_search_term VARCHAR,
            impressions INTEGER,
            clicks INTEGER,
            ctr DOUBLE,
            spend DOUBLE,
            cpc DOUBLE,
            orders INTEGER,
            sales DOUBLE,
            acos DOUBLE,
            roas DOUBLE,
            report_date DATE
        )
    """)

    # 3. Competitor Keywords (From SellersSprite Reverse ASIN)
    con.execute("DROP TABLE IF EXISTS factor_competitor_keywords")
    con.execute("""
        CREATE TABLE IF NOT EXISTS factor_competitor_keywords (
            asin VARCHAR,
            keyword VARCHAR,
            search_volume INTEGER,
            sales_volume INTEGER,
            organic_rank INTEGER,
            sponsored_rank INTEGER,
            traffic_share VARCHAR,
            market_analysis VARCHAR,
            ingestion_date DATE
        )
    """)
    print("✅ Database schema initialized.")

def clean_money(val):
    if isinstance(val, str):
        return float(val.replace('US$', '').replace('$', '').replace(',', '').strip() or 0)
    return float(val or 0)

def clean_int(val):
    if val is None: return 0
    # Handle NaN (float('nan') != float('nan'))
    if isinstance(val, float) and val != val: return 0
    
    if isinstance(val, (int, float)): return int(val)
    
    val_str = str(val).strip()
    if not val_str or val_str in ['-', 'N/A', 'nan', '前3页无排名', '前3页无广告', '前3頁無排名', '前3頁無廣告']: return 0
    # Common cleaning
    val_str = val_str.replace(',', '').replace('>', '').replace('<', '')
    try:
        return int(float(val_str))
    except:
        return 0

def ingest_business_report(con):
    """Ingest Amazon Business Reports (CSV)"""
    files = glob.glob(os.path.join(UPLOADS_DIR, "BusinessReport*.csv"))
    for file in files:
        print(f"--> Processing Business Report: {file}")
        try:
            # Amazon reports often have a header description in the first few lines or just start with headers
            # We try reading normally first
            df = pd.read_csv(file)
            
            # Sanitizing column names
            df.columns = [c.strip() for c in df.columns]
            
            # Map Chinese/English Headers
            # Key mappings based on your 'head' output
            # (父) ASIN -> parent_asin
            # (子) ASIN -> child_asin
            # 標題 -> title
            # 工作階段 - 總計 -> sessions
            # 頁面瀏覽次數 - 總計 -> page_views
            # 已訂購單位數量 -> units_ordered (Units Ordered)
            # 商品工作階段百分比 -> unit_session_percentage (Unit Session Percentage / CVR)
            # 訂購產品銷售額 -> ordered_product_sales
            
            for _, row in df.iterrows():
                parent = row.get('(父) ASIN') or row.get('Parent ASIN')
                child = row.get('(子) ASIN') or row.get('Child ASIN')
                if not child: continue

                con.execute(f"""
                    INSERT INTO factor_traffic_daily VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE, ?
                    )
                """, (
                    parent,
                    child,
                    row.get('標題', '') or row.get('Title', ''),
                    clean_int(row.get('工作階段 - 總計') or row.get('Sessions - Total')),
                    clean_int(row.get('工作階段數 – 總計 – B2B') or row.get('Sessions - Total - B2B')),
                    row.get('工作階段百分比 – 總計', ''),
                    clean_int(row.get('頁面瀏覽次數 - 總計') or row.get('Page Views - Total')),
                    row.get('精選優惠 (報價顯示) 百分比', ''),
                    clean_int(row.get('已訂購單位數量') or row.get('Units Ordered')),
                    row.get('商品工作階段百分比') or row.get('Unit Session Percentage'),
                    row.get('訂購產品銷售額') or row.get('Ordered Product Sales'),
                    clean_int(row.get('訂單商品總數') or row.get('Total Order Items')),
                    'YTD' if '年度' in file else '30Day'
                ))
            print(f"✅ Ingested {len(df)} rows from {file}")
            
        except Exception as e:
            print(f"❌ Error reading {file}: {e}")

def ingest_search_term_report(con):
    """Ingest Flywheel/Amazon Search Term Reports (XLSX/CSV)"""
    files = glob.glob(os.path.join(UPLOADS_DIR, "*商品推廣*搜尋字詞*.xlsx")) + \
            glob.glob(os.path.join(UPLOADS_DIR, "*SearchTerm*.xlsx")) + \
            glob.glob(os.path.join(UPLOADS_DIR, "*系统-TIMO*.xlsx")) # Catch Flywheel/Saihu
    
    unique_files = list(set(files))
    
    for file in files:
        print(f"--> Processing Search Term Report: {file}")
        try:
            df = pd.read_excel(file)
            df.columns = [c.strip() for c in df.columns]
            
            count = 0
            for _, row in df.iterrows():
                # Flexible column fetch
                term = row.get('Customer Search Term') or row.get('客戶搜尋詞') or row.get('关键词') or row.get('搜索词') or row.get('客户搜索词') or row.get('客戶搜尋字詞')
                if not term: continue
                
                con.execute("""
                    INSERT INTO factor_search_term_performance (
                        campaign_name, ad_group_name, customer_search_term, impressions, clicks, spend, sales, report_date
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)
                """, (
                    row.get('Campaign Name') or row.get('广告活动名称') or row.get('廣告活動名稱'),
                    row.get('Ad Group Name') or row.get('广告组名称') or row.get('廣告群組名稱'),
                    term,
                    clean_int(row.get('Impressions') or row.get('展示次数') or row.get('曝光數') or row.get('廣告曝光')),
                    clean_int(row.get('Clicks') or row.get('点击量') or row.get('點擊次數') or row.get('點擊')),
                    clean_money(row.get('Spend') or row.get('花费') or row.get('花費') or row.get('支出')),
                    clean_money(row.get('Sales') or row.get('7 Day Total Sales') or row.get('7天总销售额') or row.get('7 天總銷售額') or row.get('7 天总销售额') or row.get('7 天總銷售額 '))
                ))
                count += 1
            print(f"✅ Ingested {count} search terms from {file}")
            
        except Exception as e:
            print(f"❌ Error reading {file}: {e}")

def ingest_sellersprite_reverse(con):
    """Ingest SellersSprite Reverse ASIN Report"""
    files = glob.glob(os.path.join(UPLOADS_DIR, "*ReverseASIN*.xlsx"))
    
    for file in files:
        print(f"--> Processing SellersSprite: {file}")
        try:
            df = pd.read_excel(file)
            df.columns = [c.strip() for c in df.columns]
            
            # Infer ASIN from filename
            current_asin = "B08SWLTTSW" # Default/Fallback
            if "B0D1FN69FC" in file: current_asin = "B0D1FN69FC"
            elif "B0FJF79MMS" in file: current_asin = "B0FJF79MMS"
            
            count = 0
            for _, row in df.iterrows():
                keyword = row.get('Keyword') or row.get('关键词')
                if not keyword: continue
                
                con.execute("""
                    INSERT INTO factor_competitor_keywords (
                        asin, keyword, search_volume, sales_volume, organic_rank, sponsored_rank, traffic_share, market_analysis, ingestion_date
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)
                """, (
                    current_asin,
                    keyword,
                    clean_int(row.get('Search Volume') or row.get('月搜索量')),
                    clean_int(row.get('Sales Volume') or row.get('月购买量')), # Assuming this field exists, else 0
                    clean_int(row.get('Organic Rank') or row.get('自然排名')),
                    clean_int(row.get('Sponsored Rank') or row.get('广告排名')),
                    # Traffic Share might need string cleaning if it has %
                    str(row.get('Traffic Share') or row.get('流量占比')),
                    file 
                ))
                count += 1
            print(f"✅ Ingested {count} keywords from {file}")
            
        except Exception as e:
            print(f"❌ Error reading {file}: {e}")

def main():
    con = duckdb.connect(DB_PATH)
    init_db(con)
    ingest_business_report(con)
    ingest_search_term_report(con)
    ingest_sellersprite_reverse(con)
    con.close()
    print("🚀 All Data Ingestion Complete!")

if __name__ == "__main__":
    main()
