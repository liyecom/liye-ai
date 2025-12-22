# 📚 SellersSprite Data Glossary & Parsing Logic

## 1. Keyword Ranking Metrics

### Natural Rank (自然排名)
*   **Definition**: The absolute position of the ASIN in organic search results.
*   **Source Field**: `自然排名`
*   **Value Format**: Integer (e.g., `40`) or String (`前3页无排名`).
*   **Logic**:
    *   If Integer: The exact rank.
    *   If `前3页无排名` (Unranked): Treat as `0` or `NULL` (Infinite).
    *   **Grey Color** in UI indicates Unranked or Pending Data.

### Ad Rank (广告排名)
*   **Definition**: The absolute position of the ASIN's ad slot.
*   **Source Field**: `广告排名`
*   **Logic**: Same as Natural Rank.

### Page Position (自然/广告排名页码)
*   **Introduction**: Applies to both Organic (`自然排名页码`) and Ad (`广告排名页码`) ranks.
*   **Source Field**: 
    *   Organic: `自然排名页码`
    *   Ad: `广告排名页码`
*   **Format**: `第{Page}页,{Pos}/{Total}` (e.g., `第2页,5/25`)
    *   `Page`: The page number (e.g., 2).
    *   `Pos`: The position count on that specific page (e.g., 5th item).
    *   `Total`: Total operational results on that page, including ads (e.g., 25).
*   **ETL Requirement**:
    *   Extract `page_number` from `第(\d+)页`.
    *   Extract `page_position` from `,(\d+)/`.
    *   Extract `page_total_results` from `/(\d+)`.

### Update Time (更新时间)
*   **Definition**: The timestamp when the ranking data was captured.
*   **Source Field**: `更新时间`
*   **Format**: Multiline string with dual timezones.
    *   Example: `中12.18 09:51\n美12.17 17:51`
*   **ETL Requirement**:
    *   Prioritize **China Time (中)** for consistency if server is CN-based, or **US Time (美)** to align with Amazon Ads US timezone.
    *   **Decision**: Use **US Time** to match `fact_keyword_entry_daily` (Amazon Ads reports).

## 2. Traffic Types

### Traffic Word Type (流量词类型)
*   **Definition**: Tags indicating which channel drives traffic for this keyword.
*   **Source Field**: `流量词类型`
*   **Format**: Slash-separated string (e.g., `自然搜索词/视频广告词`).
*   **Parsing Logic**:
    *   Contains `自然`: `is_organic_driver = True`
    *   Contains `视频`: `is_video_ad_driver = True`
    *   Contains `SP`: `is_sp_ad_driver = True`
    *   Contains `HR` (High Rating): `is_hr_recommendation = True`

## 3. Market Metrics

### Search Volume (月搜索量)
*   **Definition**: Estimated monthly search volume (Natural Month).
*   **UI Presentation**:
    *   **Upper Line**: Monthly Volume (Updates start of next month).
    *   **Lower Line**: Daily Average (`Volume / 30`).
*   **Data Logic (Stale Data Risk)**:
    *   If last month had no volume, it displays the *most recent month with volume*. // **Critical for Freshness Checks**
*   **Zero Handling**: 
    *   If `0` or `NULL`, it means the keyword volume is too small to reach the indexing threshold.
    *   For seasonal keywords, non-peak months are filled with `0`.
*   **Accuracy & Philosophy**:
    *   **Post-2019 Data**: AI Prediction (Big Data), ~90% accuracy.
    *   **High Volume Warning**: Top 200 keywords may have +/- 30% error.
    *   **Strategic Use**: Treat as a **Relative Index** for Trends (Vertical) and Weight (Horizontal). *Do not obsess over absolute numbers.*
*   **Source**: [Accuracy Verification](https://www.sellersprite.com/v3/knowledge/feature/how-to-verify-searches-accuracy) (User Provided)
*   **Trend Data**:
    *   UI provides 2-3 years trend.
    *   *Source*: [How to Understand Trends](https://www.sellersprite.com/v3/knowledge/feature/how-to-understand-trends) (User Provided)
    *   *Self-Correction*: Current flat export only contains the *snapshot* volume. If historical data is needed, we must ingest "Market Analysis" exports or accumulate daily snapshots.

### SPR (SellerSprite Product Rank / 排名预估单量)
*   **Definition**: Est. 8-day sales volume required to maintain Page 1 ranking.
*   **User Logic**: "How many units do I need to sell in 8 days to be on Page 1?"
*   **Correction**: **NOT** Supply/Demand Ratio.
*   **Value Logic**:
    *   Higher = Harder (High Velocity Barrier).
    *   e.g., SPR=280 means you need ~35 units/day for 8 days to stay on Page 1.

### Supply/Demand (需供比 & 商品数)
*   **Supply/Demand Ratio (需供比)**:
    *   **Definition**: Ratio of Demand (Search Volume) to Supply (Product Count).
    *   **Formula**: `Search Volume / Product Count`.
    *   **Logic**: Higher = Better (Stronger Demand relative to Supply).
        *   e.g., `phone holder`: 69,465 / 14,875 = 4.7.
*   **Product Count (商品数)**:
    *   **Definition**: Number of search results (supply) for this keyword.
    *   **Nuance**: Varies by user IP/Region (e.g., "1-48 of over 1,000 results").
    *   **Source**: [Amazon Search Results](https://www.sellersprite.com/v3/knowledge/feature/amazon-search-results) (User Provided)

### Monthly Purchases & Rate (月购买量 & 购买率)
*   **Monthly Purchases (月购买量)**: 
    *   **Definition**: Est. sales volume in a natural month.
    *   **Logic**: `Search Volume * Purchase Rate`. (Includes related/recommended sales).
*   **Purchase Rate (购买率)**: 
    *   **Definition**: Conversion Rate at keyword level (`Purchases / Searches`).
    *   **Value Logic**: Higher = Better Precision.
        *   Reflects "Product-Keyword Match" and "User Decision Speed".
    *   **Strategic Threshold**: `Rate > 10%` indicates a High-Conversion/Precise Niche (Golden Segment).
    *   **Source**: [Purchase Rate Understanding](https://www.sellersprite.com/v3/knowledge/feature/how-to-understand-purchase-rate) (User Provided)

### Market Exposure (展示量 & 点击量)
*   **Market Total Impressions (展示量)**:
    *   **Definition**: Total impressions of ALL ASINs on this keyword's search result page in a natural month.
    *   **Scope**: **MARKET LEVEL** (Not single ASIN).
*   **Market Total Clicks (点击量)**:
    *   **Definition**: Total clicks of ALL ASINs on this keyword's search result page.
    *   **Scope**: **MARKET LEVEL**.
*   **Strategic Use**: "Market Cap" or "Traffic Pool Size".

### Advertised Competitors (广告竞品数)
*   **Advertised Product Count (近7天广告竞品数)**:
    *   **Definition**: Count of products advertised in Top 3 Pages over last 7 days.
    *   **Scope**: Includes SP, HR, Brand, and Video Ads.
    *   **Logic**: Higher = Fiercer "Pay-to-Play" Competition.
    *   **Source**: [Sellersprite Knowledge](https://www.sellersprite.com/v3/knowledge/feature/amazon-search-results) (User Provided)

### ABA Concentration (ABA 集中度)
*   **ABA Click Share (点击总占比)**:
    *   **Definition**: Sum of Click Share of Top 3 ASINs.
    *   **Logic**: Higher = Higher Monopoly (Head-heavy market).
        *   e.g., `37.4%` means Top 3 take >1/3 of traffic.
        *   **Strategic Threshold**: `Share < 30%` = Fragmented Market (Blue Ocean Opportunity).
*   **ABA Conversion Share (转化总占比)**:
    *   **Definition**: Sum of Conversion Share of Top 3 ASINs.
    *   **Logic**: Higher = Sales are concentrated in Top 3.
    *   **Time Scope**: Weekly data (if Monthly view selected).

### PPC Metrics (广告竞价)
*   **PPC Suggested Bid (建议竞价)**:
    *   **Definition**: Range (Min, Median, Max) for Exact Match 7-day average.
    *   **Logic**: Reflection of Market Maturity & Competition cost.
    *   **Strategy**: Low Bid + High Volume = Cost-effective Opportunity.
        *   e.g., `PPC < $1.0` combined with `Vol > 5000`.

### Title Density (标题密度)
*   **Definition**: The number of Page 1 products that contain this keyword in their title.
*   **Logic**:
    *   High Density (e.g., 50+): Highly optimized ecosystem, hard to rank.
    *   Low Density (e.g., <10): Blue ocean, easy to rank if relevancy is high.
*   **Strategic Use**: "Low density" + "High Volume" = **Golden Opportunity**.

### ABA Search Frequency Rank (ABA周排名)
*   **Definition**: Amazon Search Frequency Rank (SFR).
*   **Logic**: Lower number = Higher Search Volume (Rank #1 is top).
*   **Timeframe**: Represents the *latest week's* data.
*   **Metric Type**: Relative Ranking (Proxy for Volume).

### Traffic Share (流量占比)
*   **Definition**: Estimated % of click share this ASIN gets from this keyword.
*   **Note**: Precision matters. 5.4% is exported as `0.054` or `5.4` depending on file version.
*   **Current State**: Stored as Decimal Ratio (0.054).

## 4. Derived Classifications (Growth OS)

| Classification | Logic (v2.0) |
| :--- | :--- |
| **MAIN_TRAFFIC** | `traffic_share >= 5%` (0.05) OR (`share >= 10%`) |
| **PRECISE_TRAFFIC** | `search_volume >= 2000` AND `rank <= 8` |
| **POTENTIAL** | `rank <= 20` (Page 1 Bottom) |
| **ATTACK** | `rank = 0` (Unranked) AND `ad_sales > 0` |
| **WASTED** | `rank = 0` AND `ad_spend > $50` AND `ad_sales = 0` |
