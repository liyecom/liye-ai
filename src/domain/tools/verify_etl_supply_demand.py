import duckdb
import pandas as pd
from src.data_lake.db_manager import get_db_connection

con = get_db_connection()

# Check if product_count exists and verify Ratio Logic
query = """
SELECT 
    keyword,
    search_volume,
    product_count,
    supply_demand_ratio,
    CASE 
        WHEN product_count > 0 THEN ROUND(search_volume / product_count, 2)
        ELSE NULL 
    END as calculated_ratio,
    (supply_demand_ratio - (search_volume / product_count)) as diff
FROM fact_keyword_snapshot
WHERE product_count IS NOT NULL AND supply_demand_ratio IS NOT NULL
ORDER BY search_volume DESC
LIMIT 10;
"""

try:
    df = con.execute(query).df()
    if df.empty:
        print("⚠️ No data found with populated Product Count columns.")
    else:
        print("✅ Supply/Demand Verification Successful:")
        print(df.to_string())
except Exception as e:
    print(f"❌ Query failed: {e}")
