
import duckdb
import os
import pandas as pd
from src.data_lake.db_manager import get_db_connection

con = get_db_connection()
print("\n--- Row Count ---")
print(con.execute("SELECT COUNT(*) FROM fact_keyword_snapshot").fetchone()[0])
print("\n--- Sample Data ---")
df = con.execute("SELECT keyword, search_volume, traffic_share, organic_rank FROM fact_keyword_snapshot LIMIT 10").df()
print(df.to_string())
print("\n--- Check Keyword Match ---")
# Check if 'non slip rug' is in snapshot
res = con.execute("SELECT * FROM fact_keyword_snapshot WHERE keyword = 'non slip rug'").fetchall()
print(f"non slip rug found: {len(res)}")
