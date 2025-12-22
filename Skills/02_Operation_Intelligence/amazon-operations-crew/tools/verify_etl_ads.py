import duckdb
import pandas as pd
from src.data_lake.db_manager import get_db_connection

con = get_db_connection()

# Check if ads count exists and have data
query = """
SELECT 
    keyword,
    search_volume,
    product_count,
    advertised_product_count,
    CASE 
        WHEN product_count > 0 THEN ROUND(advertised_product_count / product_count * 100, 2)
        ELSE NULL 
    END as ads_ratio_pct
FROM fact_keyword_snapshot
WHERE advertised_product_count IS NOT NULL
ORDER BY search_volume DESC
LIMIT 10;
"""

try:
    df = con.execute(query).df()
    if df.empty:
        print("⚠️ No data found with populated Advertised Product Count columns.")
    else:
        print("✅ Ads Count Verification Successful:")
        print(df.to_string())
except Exception as e:
    print(f"❌ Query failed: {e}")
