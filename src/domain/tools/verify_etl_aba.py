import duckdb
import pandas as pd
from src.data_lake.db_manager import get_db_connection

con = get_db_connection()

# Check if ABA columns exist and have data
query = """
SELECT 
    keyword,
    search_volume,
    product_count,
    aba_top3_click_share,
    aba_top3_conversion_share
FROM fact_keyword_snapshot
WHERE aba_top3_click_share IS NOT NULL OR aba_top3_conversion_share IS NOT NULL
ORDER BY search_volume DESC
LIMIT 10;
"""

try:
    df = con.execute(query).df()
    if df.empty:
        print("⚠️ No data found with populated ABA columns.")
    else:
        print("✅ ABA Verification Successful:")
        print(df.to_string())
except Exception as e:
    print(f"❌ Query failed: {e}")
