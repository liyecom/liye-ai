import duckdb
import pandas as pd
from tabulate import tabulate

DB_PATH = "data/growth_os.duckdb"

def analyze_annual():
    con = duckdb.connect(DB_PATH)
    
    # 1. Get Top YTD ASINs
    print("\nXXX ANNUAL PERFORMANCE LEADERBOARD (YTD) XXX")
    query_ytd = """
        SELECT 
            child_asin, 
            sessions as sessions_ytd, 
            unit_session_percentage as cvr_ytd,
            units_ordered as units_ytd,
            ordered_product_sales as sales_ytd
        FROM factor_traffic_daily
        WHERE report_type = 'YTD'
        ORDER BY sessions DESC
        LIMIT 10
    """
    df_ytd = con.execute(query_ytd).df()
    print(df_ytd.to_markdown(index=False))
    
    # 2. Compare YTD vs 30-Day (The "Decline" Diagnosis)
    # common ASINs
    print("\nXXX TREND DIAGNOSIS: ANNUAL VS LAST 30 DAYS XXX")
    query_compare = """
        WITH ytd AS (
            SELECT child_asin, 
                   CAST(REPLACE(unit_session_percentage, '%', '') AS FLOAT) as cvr_ytd_val,
                   sessions as sessions_ytd
            FROM factor_traffic_daily WHERE report_type = 'YTD'
        ),
        recent AS (
            SELECT child_asin, 
                   CAST(REPLACE(unit_session_percentage, '%', '') AS FLOAT) as cvr_30d_val,
                   sessions as sessions_30d
            FROM factor_traffic_daily WHERE report_type = '30Day'
        )
        SELECT 
            ytd.child_asin,
            ytd.cvr_ytd_val as "CVR (Year)",
            recent.cvr_30d_val as "CVR (Now)",
            ROUND(recent.cvr_30d_val - ytd.cvr_ytd_val, 2) as "CVR Change",
            CASE WHEN recent.cvr_30d_val < ytd.cvr_ytd_val THEN 'DECLINING 🔻' ELSE 'STABLE/UP 🟢' END as Status
        FROM ytd
        JOIN recent ON ytd.child_asin = recent.child_asin
        WHERE recent.sessions_30d > 50 -- Filter for active items
        ORDER BY "CVR Change" ASC
    """
    df_compare = con.execute(query_compare).df()
    print(df_compare.to_markdown(index=False))

    con.close()

if __name__ == "__main__":
    analyze_annual()
