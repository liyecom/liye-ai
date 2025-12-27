import duckdb
import pandas as pd
from src.data_lake.db_manager import get_db_connection

con = get_db_connection()

# Find High Precision Keywords (> 10%)
query = """
SELECT 
    keyword,
    search_volume,
    monthly_purchases,
    purchase_rate,
    spr,
    supply_demand_ratio
FROM fact_keyword_snapshot
WHERE purchase_rate >= 0.10
ORDER BY purchase_rate DESC;
"""

try:
    df = con.execute(query).df()
    if df.empty:
        print("⚠️ No keywords found with Purchase Rate > 10%.")
    else:
        print(f"✅ Found {len(df)} High-Precision Keywords (>10%):")
        print(df.to_string())
except Exception as e:
    print(f"❌ Query failed: {e}")
