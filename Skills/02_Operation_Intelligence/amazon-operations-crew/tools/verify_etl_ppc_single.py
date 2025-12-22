import duckdb
from src.data_lake.db_manager import get_db_connection

con = get_db_connection()

query = """
SELECT 
    keyword,
    ppc_bid,
    ppc_bid_raw
FROM fact_keyword_snapshot
WHERE keyword = 'small area rug'
"""

try:
    df = con.execute(query).df()
    print(df.to_string())
except Exception as e:
    print(f"❌ Query failed: {e}")
