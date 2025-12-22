
import duckdb
import os
import pandas as pd

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'amazon_growth_os.db')

def verify_etl():
    print(f"🧐 Verifying Data Lake at: {DB_PATH}")
    con = duckdb.connect(DB_PATH)
    
    # 1. Row Counts
    print("\n📊 Table Row Counts:")
    tables = ['fact_keyword_entry_daily', 'fact_ads_keyword_daily_campaign']
    for t in tables:
        count = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        print(f"   - {t}: {count} rows")
        
    # 2. Data Source Distribution
    print("\n🌐 Data Source Distribution (Ads Campaign):")
    sources = con.execute("SELECT data_source, COUNT(*) as cnt FROM fact_ads_keyword_daily_campaign GROUP BY 1").df()
    print(sources.to_string(index=False))
    
    # 3. Top Keywords by Spend (Traffic Deep Dive)
    print("\n💰 Top 5 Search Terms by Spend (All Sources):")
    top_kw = con.execute("""
        SELECT keyword, ad_type, SUM(impressions) as impr, SUM(clicks) as clicks, SUM(spend) as spend, SUM(sales) as sales 
        FROM fact_keyword_entry_daily 
        GROUP BY 1, 2 
        ORDER BY spend DESC 
        LIMIT 5
    """).df()
    print(top_kw.to_string(index=False))
    
    # 4. Campaign Performance (Financials)
    print("\n📈 Campaign Financials (Top 5 by Sales):")
    top_camp = con.execute("""
        SELECT campaign_id, data_source, SUM(spend) as spend, SUM(sales) as sales, 
               CASE WHEN SUM(sales) > 0 THEN ROUND(SUM(spend)/SUM(sales)*100, 2) ELSE 0 END as acos
        FROM fact_ads_keyword_daily_campaign
        GROUP BY 1, 2
        ORDER BY sales DESC
        LIMIT 5
    """).df()
    print(top_camp.to_string(index=False))
    
    con.close()

if __name__ == "__main__":
    verify_etl()
