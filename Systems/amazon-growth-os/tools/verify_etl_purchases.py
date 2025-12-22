import duckdb
import pandas as pd
from src.data_lake.db_manager import get_db_connection

con = get_db_connection()

# Check if columns exist and have data
query = """
SELECT 
    keyword,
    search_volume,
    monthly_purchases,
    purchase_rate
FROM fact_keyword_snapshot
WHERE monthly_purchases IS NOT NULL OR purchase_rate IS NOT NULL
ORDER BY monthly_purchases DESC
LIMIT 10;
"""

try:
    df = con.execute(query).df()
    if df.empty:
        print("⚠️ No data found with populated Purchase columns.")
    else:
        print("✅ Purchase Data Verification Successful:")
        print(df.to_string())
except Exception as e:
    print(f"❌ Query failed: {e}")
