import duckdb
import pandas as pd
from src.data_lake.db_manager import get_db_connection

con = get_db_connection()

# Check PPC columns and Validate Strategy (Low Bid + High Vol)
query = """
SELECT 
    keyword,
    search_volume,
    ppc_bid,
    ppc_bid_raw,
    aba_top3_click_share,
    CASE 
        WHEN ppc_bid < 0.80 AND search_volume > 3000 THEN '💎 Low Cost Gem'
        ELSE 'Normal' 
    END as opportunity_tag
FROM fact_keyword_snapshot
WHERE ppc_bid IS NOT NULL
ORDER BY ppc_bid ASC
LIMIT 15;
"""

try:
    df = con.execute(query).df()
    if df.empty:
        print("⚠️ No data found with populated PPC columns.")
    else:
        print("✅ PPC Verification & Strategy Check:")
        print(df.to_string())
except Exception as e:
    print(f"❌ Query failed: {e}")
