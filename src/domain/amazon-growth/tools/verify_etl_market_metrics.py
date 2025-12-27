import duckdb
import pandas as pd
from src.data_lake.db_manager import get_db_connection

con = get_db_connection()

# Check if market columns exist and have data
query = """
SELECT 
    keyword,
    search_volume,
    market_total_impressions,
    market_total_clicks
FROM fact_keyword_snapshot
WHERE market_total_impressions IS NOT NULL OR market_total_clicks IS NOT NULL
ORDER BY search_volume DESC
LIMIT 10;
"""

try:
    df = con.execute(query).df()
    if df.empty:
        print("⚠️ No data found with populated Market Metrics columns.")
    else:
        print("✅ Market Metrics Verification Successful:")
        print(df.to_string())
except Exception as e:
    print(f"❌ Query failed: {e}")
