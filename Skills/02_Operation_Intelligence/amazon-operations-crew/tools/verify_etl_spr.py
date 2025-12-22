import duckdb
import pandas as pd
from src.data_lake.db_manager import get_db_connection

con = get_db_connection()

# Check if columns exist and have data
query = """
SELECT 
    keyword,
    search_volume,
    spr,
    supply_demand_ratio
FROM fact_keyword_snapshot
WHERE spr IS NOT NULL
ORDER BY spr DESC
LIMIT 10;
"""

try:
    df = con.execute(query).df()
    if df.empty:
        print("⚠️ No data found with populated SPR/Supply columns.")
        # Check raw count
        print("Total rows:", con.execute("SELECT COUNT(*) FROM fact_keyword_snapshot").fetchone()[0])
    else:
        print("✅ SPR & Supply/Demand Data Verification Successful:")
        print(df.to_string())
except Exception as e:
    print(f"❌ Query failed: {e}")
