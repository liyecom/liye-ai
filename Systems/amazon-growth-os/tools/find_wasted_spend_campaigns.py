import duckdb
import pandas as pd

DB_PATH = "data/growth_os.duckdb"

def find_targets():
    con = duckdb.connect(DB_PATH)
    
    keyword = "indoor door mat"
    print(f"XXX CAMPAIGNS TO BLOCK '{keyword}' IN XXX")
    print("(Criteria: Sales = 0 OR ROAS < 1.2)")
    
    query = f"""
        SELECT 
            campaign_name as "Campaign Name",
            ad_group_name as "Ad Group Name",
            spend as "Spend ($)",
            sales as "Sales ($)",
            round(sales / nullif(spend, 0), 2) as "ROAS"
        FROM factor_search_term_performance
        WHERE customer_search_term = '{keyword}'
          AND (sales = 0 OR (sales / nullif(spend, 0)) < 1.2)
        ORDER BY spend DESC
    """
    df = con.execute(query).df()
    print(df.to_markdown(index=False))
    con.close()

if __name__ == "__main__":
    find_targets()
