import duckdb
import pandas as pd
from src.data_lake.db_manager import get_db_connection

con = get_db_connection()

# Check if columns exist and have data
query = """
SELECT 
    keyword,
    search_volume,
    organic_rank,
    aba_rank
FROM fact_keyword_snapshot
WHERE aba_rank IS NOT NULL
ORDER BY aba_rank ASC
LIMIT 20;
"""

try:
    df = con.execute(query).df()
    if df.empty:
        print("⚠️ No data found with populated ABA Rank columns.")
        # Check raw count
        print("Total rows:", con.execute("SELECT COUNT(*) FROM fact_keyword_snapshot").fetchone()[0])
    else:
        print("✅ ABA Rank Data Verification Successful:")
        print(df.to_string())
except Exception as e:
    print(f"❌ Query failed: {e}")
