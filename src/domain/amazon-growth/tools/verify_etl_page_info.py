import duckdb
import pandas as pd
from src.data_lake.db_manager import get_db_connection

con = get_db_connection()

# Check if columns exist and have data
query = """
SELECT 
    keyword,
    organic_rank,
    organic_page_no,
    organic_page_pos,
    organic_page_total,
    traffic_share
FROM fact_keyword_snapshot
WHERE organic_page_no IS NOT NULL
LIMIT 20;
"""

try:
    df = con.execute(query).df()
    if df.empty:
        print("⚠️ No data found with populated Page Info columns.")
        # Check raw count
        print("Total rows:", con.execute("SELECT COUNT(*) FROM fact_keyword_snapshot").fetchone()[0])
    else:
        print("✅ Data Verification Successful:")
        print(df.to_string())
except Exception as e:
    print(f"❌ Query failed: {e}")
