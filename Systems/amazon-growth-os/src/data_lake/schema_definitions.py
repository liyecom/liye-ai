
# 🏗️ ROBUST Schema Definitions for Growth OS (Unified Metric Dictionary)
# See: unified_metric_dictionary.md

DDL_DIM_MARKETPLACE = """
CREATE TABLE IF NOT EXISTS dim_marketplace (
    marketplace_id VARCHAR PRIMARY KEY,
    country_code VARCHAR,
    currency_code VARCHAR
);
"""

DDL_DIM_ASIN = """
CREATE TABLE IF NOT EXISTS dim_asin (
    asin VARCHAR PRIMARY KEY,
    marketplace_id VARCHAR,
    title VARCHAR,
    brand VARCHAR,
    image_url VARCHAR,
    updated_at TIMESTAMP
);
"""

# Normalized Keyword Dimension
DDL_DIM_KEYWORD = """
CREATE TABLE IF NOT EXISTS dim_keyword (
    keyword_id VARCHAR PRIMARY KEY, -- Hash(normalized_text)
    keyword_text VARCHAR, -- Normalized
    keyword_raw VARCHAR, -- Original
    updated_at TIMESTAMP
);
"""

# --- MAIN FACT TABLE ---
# Grain: Date + ASIN + Keyword + Entry + Slot + AdType + Place + Match
DDL_FCT_KEYWORD_ENTRY_DAILY = """
CREATE TABLE IF NOT EXISTS fact_keyword_entry_daily (
    -- Keys
    dt DATE,
    marketplace VARCHAR,
    asin VARCHAR,
    keyword VARCHAR,
    campaign_id VARCHAR,       -- Added for granularity
    ad_group_id VARCHAR,       -- Added for granularity
    entry_type VARCHAR,        -- ORGANIC, RECOMMENDATION, AD
    recommendation_slot VARCHAR, -- AC, ER, FOUR_STAR, HR, NONE
    ad_type VARCHAR,           -- SP, SB, SD, VIDEO, NONE
    placement VARCHAR,         -- TOP_OF_SEARCH, REST, PRODUCT, UNKNOWN
    match_type VARCHAR,        -- EXACT, PHRASE, BROAD, AUTO, UNKNOWN
    
    -- Metrics (Official/Financial)
    impressions BIGINT,
    clicks BIGINT,
    spend DECIMAL(18,6),
    orders DECIMAL(18,6),      -- 7-day attributed
    units DECIMAL(18,6),
    sales DECIMAL(18,6),
    
    -- Metrics (Derived/Ranking)
    organic_rank INTEGER,      -- Nullable
    ad_rank INTEGER,          -- Nullable
    
    -- Governance
    data_source VARCHAR,       -- AMAZON_ADS, SELLERSPRITE, SAIHU, FLYWHEEL
    source_file_id VARCHAR,
    data_confidence VARCHAR,   -- HIGH, MED, LOW
    ingested_at TIMESTAMP,
    
    PRIMARY KEY (dt, marketplace, asin, keyword, entry_type, recommendation_slot, ad_type, placement, match_type)
);
"""

# --- SUPPLEMENT A: CAMPAIGN FACT (No ASIN) ---
DDL_FCT_ADS_CAMPAIGN_DAILY = """
CREATE TABLE IF NOT EXISTS fact_ads_keyword_daily_campaign (
    dt DATE,
    marketplace VARCHAR,
    campaign_id VARCHAR,
    ad_group_id VARCHAR,
    keyword VARCHAR,
    ad_type VARCHAR,
    match_type VARCHAR,
    
    impressions BIGINT,
    clicks BIGINT,
    spend DECIMAL(18,6),
    orders DECIMAL(18,6),
    units DECIMAL(18,6),
    sales DECIMAL(18,6),
    
    data_source VARCHAR,
    ingested_at TIMESTAMP
);
"""

# --- SUPPLEMENT B: SNAPSHOT FACT (Intelligence) ---
DDL_FCT_KEYWORD_SNAPSHOT = """
CREATE TABLE IF NOT EXISTS fact_keyword_snapshot (
    captured_at TIMESTAMP,
    snapshot_date DATE,
    marketplace VARCHAR,
    asin VARCHAR,
    keyword VARCHAR,
    
    organic_rank INTEGER,
    ad_rank INTEGER,
    aba_rank INTEGER,          -- Amazon Search Frequency Rank
    
    -- SellersSprite Metrics
    search_volume BIGINT,
    search_volume_growth DECIMAL(10,4),
    traffic_share DECIMAL(10,4),
    conversion_share DECIMAL(10,4),
    title_density DECIMAL(10,2),
    spr DECIMAL(10,2),
    supply_demand_ratio DECIMAL(10,2), -- 需供比
    product_count BIGINT,              -- 商品数 (Supply)
    monthly_purchases BIGINT,          -- 月购买量
    purchase_rate DECIMAL(10,4),       -- 购买率 (0.0123)
    market_total_impressions BIGINT,   -- 展示量 (Market Size Exposure)
    market_total_clicks BIGINT,        -- 点击量 (Market Size Clicks)
    advertised_product_count INTEGER,  -- 近7天广告竞品数 (Ads Density)
    aba_top3_click_share DECIMAL(10,4),      -- 点击总占比 (Monopoly Click)
    aba_top3_conversion_share DECIMAL(10,4), -- 转化总占比 (Monopoly Conv)
    ppc_bid DECIMAL(10,2),                   -- PPC价格 (Median)
    ppc_bid_raw VARCHAR,                     -- 建议竞价范围 (Raw Check)
    
    -- Ranking Detail (New V3)
    organic_page_no INTEGER,   -- 第X页
    organic_page_pos INTEGER,  -- X/50
    organic_page_total INTEGER, -- 10/X
    
    ad_page_no INTEGER,        -- 第X页 (Ad)
    ad_page_pos INTEGER,       -- X/50 (Ad)
    ad_page_total INTEGER,     -- 10/X (Ad)
    
    badge_flags JSON,         -- {is_ac: true, is_best_seller: false}
    recommendation_slot VARCHAR,
    snapshot_context JSON,
    
    data_updated_at TIMESTAMP, -- Parsed from source file
    
    -- Metadata
    data_source VARCHAR
);
"""

# Staging Table (Generic) for Raw CSV Loads
DDL_STAGING_GENERIC = """
CREATE TABLE IF NOT EXISTS staging_generic_import (
    row_id UUID,
    source_file_id VARCHAR,
    raw_data JSON,            -- Full row as JSON
    parsed_date DATE,
    parsed_metrics JSON,
    ingest_status VARCHAR,    -- PENDING, PROCESSED, ERROR
    snapshot_date DATE,
    ingested_at TIMESTAMP
);
"""

DDL_FCT_ASIN_DAILY = """
CREATE TABLE IF NOT EXISTS fact_asin_daily (
    marketplace VARCHAR,
    asin VARCHAR,
    dt DATE,
    
    sessions BIGINT,
    page_views BIGINT,
    buy_box_percentage DECIMAL(10,2),
    units_ordered BIGINT,
    sales DECIMAL(18,6),
    unit_session_percentage DECIMAL(10,2),
    
    data_source VARCHAR,
    source_file_id VARCHAR,
    ingested_at TIMESTAMP,
    
    PRIMARY KEY (dt, marketplace, asin)
);
"""

# --- TRAFFIC OS: SERP TOP 10 FACT ---
DDL_FCT_SERP_TOP10 = """
CREATE TABLE IF NOT EXISTS fact_serp_top10 (
    id INTEGER PRIMARY KEY, -- Auto-increment handled by DuckDB sequence or UUID if needed (but raw int is fine for landing)
    keyword VARCHAR,
    marketplace VARCHAR,
    asin VARCHAR,
    rank INTEGER,
    organic_rank INTEGER,
    sponsored_rank INTEGER,
    brand VARCHAR,
    price DECIMAL(10,2),
    rating DECIMAL(3,1),
    reviews INTEGER,
    capture_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

ALL_DDL = [
    DDL_DIM_MARKETPLACE,
    DDL_DIM_ASIN,
    DDL_DIM_KEYWORD,
    DDL_FCT_KEYWORD_ENTRY_DAILY,
    DDL_FCT_ADS_CAMPAIGN_DAILY,
    DDL_FCT_KEYWORD_SNAPSHOT,
    DDL_STAGING_GENERIC,
    DDL_FCT_ASIN_DAILY,
    DDL_FCT_SERP_TOP10
]
