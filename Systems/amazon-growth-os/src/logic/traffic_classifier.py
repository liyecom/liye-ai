
import duckdb
import pandas as pd
import os
from src.data_lake.db_manager import get_db_connection

class TrafficClassifier:
    def __init__(self):
        self.con = get_db_connection()

    def get_traffic_structure(self, marketplace='US'):
        """
        Calculates the high-level Organic vs Ad traffic split for the ASIN.
        Uses Fact ASIN Daily (Total Sessions) vs Fact Ads Campaign (Total Clicks).
        """
        query = f"""
        WITH organic_stats AS (
            SELECT 
                SUM(sessions) as total_sessions,
                SUM(units_ordered) as total_units
            FROM fact_asin_daily
            WHERE marketplace = '{marketplace}'
        ),
        ad_stats AS (
            SELECT 
                SUM(clicks) as total_ad_clicks,
                SUM(orders) as total_ad_orders
            FROM fact_ads_keyword_daily_campaign
            WHERE data_source = 'AMAZON_ADS'  -- Only count official ad clicks
        )
        SELECT 
            o.total_sessions,
            a.total_ad_clicks,
            CASE WHEN o.total_sessions > 0 
                 THEN CAST(a.total_ad_clicks AS FLOAT) / o.total_sessions 
                 ELSE 0 END as ad_traffic_share_internal,
            (o.total_sessions - a.total_ad_clicks) as est_organic_traffic,
            o.total_units,
            a.total_ad_orders
        FROM organic_stats o, ad_stats a
        """
        return self.con.execute(query).df()

    def classify_keywords(self, marketplace='US'):
        """
        Joins Market Data (Snapshot) with Ad Data (Search Term) to classify keywords.
        """
        # Latest Snapshot Date
        snapshot_date = self.con.execute("SELECT MAX(snapshot_date) FROM fact_keyword_snapshot").fetchone()[0]
        
        query = f"""
        WITH market_data AS (
            SELECT 
                keyword,
                search_volume,
                organic_rank,
                traffic_share,
                title_density,
                spr
            FROM fact_keyword_snapshot
            WHERE snapshot_date = '{snapshot_date}'
        ),
        ad_data AS (
            SELECT 
                keyword,
                SUM(spend) as ad_spend,
                SUM(sales) as ad_sales,
                SUM(clicks) as ad_clicks,
                SUM(orders) as ad_orders,
                CASE WHEN SUM(sales) > 0 THEN SUM(spend)/SUM(sales) ELSE 0 END as acos
            FROM fact_keyword_entry_daily
            WHERE entry_type = 'AD'
            GROUP BY 1
        )
        SELECT 
            COALESCE(m.keyword, a.keyword) as keyword,
            m.search_volume,
            m.organic_rank,
            m.traffic_share,
            a.ad_spend,
            a.ad_sales,
            a.acos,
            
            -- Logic: Traffic Classification (US Standard)
            -- Note: organic_rank 0 means Unranked (Infinite). We must exclude 0 from <= 8 checks.
            CASE 
                WHEN (m.traffic_share >= 0.05 AND m.organic_rank > 0 AND m.organic_rank <= 8) OR (m.traffic_share >= 0.10) THEN 'MAIN_TRAFFIC'
                WHEN m.search_volume >= 2000 AND m.organic_rank > 0 AND m.organic_rank <= 8 THEN 'PRECISE_TRAFFIC'
                WHEN m.search_volume >= 500 AND m.organic_rank > 0 AND m.organic_rank <= 8 THEN 'PRECISE_LONG_TAIL'
                WHEN m.organic_rank > 0 AND m.organic_rank <= 20 THEN 'POTENTIAL'
                ELSE 'OTHER'
            END as traffic_class,
            
            -- Logic: Strategy Label
            CASE
                WHEN a.ad_spend > 50 AND a.ad_sales = 0 THEN 'WASTED_SPEND'
                WHEN m.organic_rank > 0 AND m.organic_rank <= 10 AND a.ad_sales > 0 THEN 'DEFENSE'
                WHEN (m.organic_rank > 10 OR m.organic_rank = 0) AND m.search_volume > 1000 AND a.ad_sales > 0 THEN 'ATTACK'
                ELSE 'MAINTAIN'
            END as strategy_label
            
        FROM market_data m
        FULL OUTER JOIN ad_data a ON m.keyword = a.keyword
        ORDER BY m.traffic_share DESC NULLS LAST, a.ad_spend DESC NULLS LAST
        """
        return self.con.execute(query).df()

if __name__ == "__main__":
    classifier = TrafficClassifier()
    
    print("--- 🌍 Traffic Structure (ASIN Level) ---")
    print(classifier.get_traffic_structure().to_string(index=False))
    
    print("\n--- 🏷️ Keyword Classification (Top 20) ---")
    df = classifier.classify_keywords()
    print(df.head(20).to_string(index=False))
