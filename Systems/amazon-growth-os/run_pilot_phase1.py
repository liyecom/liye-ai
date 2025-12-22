
import duckdb
import pandas as pd
import os
import sys
from datetime import datetime

# Path setup
sys.path.append(os.path.dirname(__file__))
from src.strategy.keyword_governance import KeywordBucketer

DB_PATH = os.path.join(os.path.dirname(__file__), 'data/amazon_growth_os.db')
PILOT_ASIN = 'B0C5Q9Y6YF'
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'reports/pilot_v1')

def run_pilot_classification():
    print(f"🚀 Starting Pilot Run for ASIN: {PILOT_ASIN}")
    
    # 1. Connect to Data Lake
    if not os.path.exists(DB_PATH):
        print(f"❌ DB not found at {DB_PATH}")
        return
        
    con = duckdb.connect(DB_PATH)
    
    # 2. Fetch Traffic Data (Fact joined with Dim)
    # Get latest date partition
    try:
        query = f"""
            SELECT 
                f.dt,
                f.asin,
                k.keyword_text,
                k.search_volume_30d,
                f.organic_rank,
                f.traffic_share
            FROM fct_asin_keyword_30d f
            JOIN dim_keyword k ON f.keyword_id = k.keyword_id
            WHERE f.asin = '{PILOT_ASIN}'
            ORDER BY k.search_volume_30d DESC
        """
        df = con.execute(query).df()
    except Exception as e:
        print(f"❌ Query failed: {e}")
        con.close()
        return

    con.close()
    
    if df.empty:
        print("⚠️ No data found for Pilot ASIN.")
        return

    print(f"📊 Loaded {len(df)} keywords from Data Lake.")
    
    # 3. Apply Strategy Engine
    # Configuring 'laptop' as a pseudo-brand term just for testing logic if needed, 
    # but strictly BUCKET_DEFEND usually implies own brand name. 
    # For this ASIN B0C5Q9Y6YF (Omoton Laptop Stand), brand is OMOTON.
    bucketer = KeywordBucketer(brand_terms=['OMOTON', 'Omoton'])
    
    df_classified = bucketer.process_dataframe(df)
    
    # 4. Generate Report
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = os.path.join(OUTPUT_DIR, f"pilot_strategy_{PILOT_ASIN}_{timestamp}.csv")
    
    df_classified.to_csv(report_file, index=False)
    
    print("\n✅ Pilot Classification Complete!")
    print(f"📄 Report saved to: {report_file}")
    
    # 5. Show Summary
    summary = df_classified['bucket'].value_counts()
    print("\n📈 Bucket Distribution:")
    print(summary)
    
    # Verify Logic check
    grow_dataset = df_classified[df_classified['bucket'] == 'GROW']
    if not grow_dataset.empty:
        print(f"\n💪 Identified {len(grow_dataset)} 'GROW' opportunities (Rank 8-20).")
        print(grow_dataset[['keyword_text', 'organic_rank', 'search_volume_30d']].head().to_string())

if __name__ == "__main__":
    run_pilot_classification()
