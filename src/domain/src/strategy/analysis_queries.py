import duckdb
import pandas as pd

DB_PATH = "data/growth_os.duckdb"

def run_analysis():
    con = duckdb.connect(DB_PATH)
    
    print("\nXXX DIAGNOSIS 1: TRAFFIC HEALTH (30 Days vs Annual) XXX")
    # We compare 30Day average vs Annual average if possible, or just look at current status
    # Since we have raw numbers, we'll just show the top ASINs for the last 30 days
    query_traffic = """
        SELECT 
            child_asin, 
            sessions, 
            unit_session_percentage as cvr,
            units_ordered as units,
            ordered_product_sales as sales
        FROM factor_traffic_daily
        WHERE report_type = '30Day'
        ORDER BY sessions DESC
        LIMIT 10
    """
    print(con.execute(query_traffic).df().to_markdown())

    print("\nXXX DIAGNOSIS 2: CONVERSION RED FLAGS (< 5% CVR) XXX")
    query_low_cvr = """
        SELECT child_asin, sessions, unit_session_percentage as cvr 
        FROM factor_traffic_daily 
        WHERE report_type = '30Day' AND CAST(REPLACE(unit_session_percentage, '%', '') AS FLOAT) < 5.0
        ORDER BY sessions DESC
    """
    print(con.execute(query_low_cvr).df().to_markdown())

    print("\nXXX DIAGNOSIS 3: AD SPEND TOP BURNERS (Spend > $5) XXX")
    query_ads = """
        SELECT 
            customer_search_term, 
            impressions, 
            clicks, 
            spend, 
            sales, 
            round(sales / nullif(spend, 0), 2) as roas,
            round(spend / nullif(sales, 0), 2) as acos 
        FROM factor_search_term_performance
        WHERE spend > 5
        ORDER BY spend DESC
        LIMIT 15
    """
    print(con.execute(query_ads).df().to_markdown())
    
    print("\nXXX DIAGNOSIS 4: ZERO SALE BLEEDERS (Spend > $5, 0 Sales) XXX")
    query_bleeders = """
        SELECT customer_search_term, spend, clicks 
        FROM factor_search_term_performance 
        WHERE sales = 0 AND spend > 5
        ORDER BY spend DESC
        LIMIT 10
    """
    print(con.execute(query_bleeders).df().to_markdown())

    print("\nXXX DIAGNOSIS 5: COMPETITOR KEYWORDS (SellersSprite B08SWLTTSW) XXX")
    query_competitor = """
        SELECT 
            keyword, 
            search_volume, 
            organic_rank, 
            sponsored_rank 
        FROM factor_competitor_keywords
        WHERE organic_rank < 10 OR search_volume > 1000
        ORDER BY search_volume DESC
        LIMIT 15
    """
    print(con.execute(query_competitor).df().to_markdown())

    con.close()

if __name__ == "__main__":
    run_analysis()
