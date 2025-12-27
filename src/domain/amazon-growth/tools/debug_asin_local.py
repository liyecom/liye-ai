import duckdb
import pandas as pd

DB_PATH = "data/growth_os.duckdb"

def debug_asin_local():
    con = duckdb.connect(DB_PATH)
    target_asin = "B0BGKWM81X"
    
    print(f"--- Checking Local Data for {target_asin} ---")
    
    # Check Traffic Table (Business Reports)
    df_traffic = con.execute(f"SELECT * FROM factor_traffic_daily WHERE child_asin = '{target_asin}' LIMIT 1").df()
    if not df_traffic.empty:
        print(f"✅ Found in Business Reports:")
        print(f"Title: {df_traffic.iloc[0]['title']}")
    else:
        print("❌ Not found in Business Reports.")

    # Check Search Term Reports (Ad Spend)
    # Note: Search Term reports usually don't have ASIN column unless we parsed the Campaign Name structure
    # But let's check if it appears in any text fields if possible, or just skip.
    
    con.close()

if __name__ == "__main__":
    debug_asin_local()
