import duckdb
import pandas as pd

DB_PATH = "data/growth_os.duckdb"

def diagnose_waste_source():
    con = duckdb.connect(DB_PATH)
    
    keyword = "indoor door mat"
    print(f"--- Diagnosing Waste for: '{keyword}' ---")
    
    query = f"""
        SELECT 
            campaign_name,
            ad_group_name,
            spend,
            sales,
            clicks,
            impressions
        FROM factor_search_term_performance
        WHERE customer_search_term = '{keyword}'
        ORDER BY spend DESC
    """
    df = con.execute(query).df()
    print(df.to_markdown(index=False))
    con.close()

if __name__ == "__main__":
    diagnose_waste_source()
