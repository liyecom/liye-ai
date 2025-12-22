import duckdb
import pandas as pd
from src.data_lake.db_manager import get_db_connection

con = get_db_connection()

# Check if columns exist and have data
query = """
SELECT 
    keyword,
    organic_rank,
    data_updated_at
FROM fact_keyword_snapshot
WHERE data_updated_at IS NOT NULL
LIMIT 10;
"""

try:
    df = con.execute(query).df()
    if df.empty:
        print("⚠️ No data found with populated data_updated_at columns.")
        # Check raw count
        print("Total rows:", con.execute("SELECT COUNT(*) FROM fact_keyword_snapshot").fetchone()[0])
    else:
        print("✅ Data Verification Successful:")
        print(df.to_string())
except Exception as e:
    print(f"❌ Query failed: {e}")
