import duckdb
import pandas as pd

DB_PATH = "data/growth_os.duckdb"

def debug_specific_campaign():
    con = duckdb.connect(DB_PATH)
    
    camp_name = "B0C5B0C5Q9Y6YF-GoldenKeywords-1214-LIYE"
    print(f"--- Deep Dive for Campaign: {camp_name} ---")
    
    # Check ALL sales in this campaign
    print(f"\n--- ALL SALES in {camp_name} ---")
    query_all = f"""
        SELECT 
            customer_search_term,
            spend,
            sales,
            clicks,
            impressions
        FROM factor_search_term_performance
        WHERE campaign_name = '{camp_name}'
          AND sales > 0
        ORDER BY sales DESC
    """
    df_all = con.execute(query_all).df()
    if df_all.empty:
        print("NO SALES FOUND IN THIS CAMPAIGN FOR THE UPLOADED PERIOD.")
    else:
        print(df_all.to_markdown(index=False))
    
    con.close()

if __name__ == "__main__":
    debug_specific_campaign()
