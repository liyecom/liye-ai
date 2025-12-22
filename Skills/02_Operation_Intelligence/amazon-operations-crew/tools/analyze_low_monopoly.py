import duckdb
import pandas as pd
from src.data_lake.db_manager import get_db_connection

con = get_db_connection()

# Find Blue Ocean Keywords (Vol > 5000 AND Click Share < 30%)
query = """
SELECT 
    keyword,
    search_volume,
    aba_top3_click_share as monopoly_index,
    aba_top3_conversion_share,
    spr,
    monthly_purchases
FROM fact_keyword_snapshot
WHERE search_volume > 5000 
  AND aba_top3_click_share < 0.30
  AND aba_top3_click_share > 0 -- Exclude nulls/zeros
ORDER BY aba_top3_click_share ASC
LIMIT 15;
"""

try:
    df = con.execute(query).df()
    if df.empty:
        print("⚠️ No keywords found with Low Monopoly (<30%).")
    else:
        print(f"✅ Found {len(df)} Blue Ocean Keywords (<30% Monopoly):")
        print(df.to_string())
except Exception as e:
    print(f"❌ Query failed: {e}")
