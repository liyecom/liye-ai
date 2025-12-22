
import requests
import pandas as pd
import duckdb
from datetime import datetime
from typing import List, Dict, Optional
import os
import json
from src.data_lake.db_manager import get_db_connection

class SerpPipeline:
    """
    Traffic OS: SERP Top 10 ETL Pipeline.
    Extracts SERP data from SellersSprite, clean/transforms it, and loads into DuckDB.
    """
    
    API_ENDPOINT = "https://api.sellersprite.com/openapi/keyword/srank"
    
    def __init__(self, api_key: str = None, mock: bool = False):
        self.api_key = api_key or os.getenv("SELLERSPRITE_API_KEY")
        self.mock = mock
        self.con = get_db_connection()

    def run(self, keywords: List[str]):
        """
        Main execution method.
        """
        print(f"🚀 Starting SERP Pipeline for {len(keywords)} keywords...")
        
        all_results = []
        for kw in keywords:
            raw_data = self.extract(kw)
            if raw_data:
                clean_data = self.transform(kw, raw_data)
                all_results.extend(clean_data)
        
        if all_results:
            self.load(all_results)
            print("✅ Pipeline Completed Successfully.")
        else:
            print("⚠️ No data to load.")

    def extract(self, keyword: str) -> Optional[List[Dict]]:
        """
        Extracts SERP data for a keyword.
        """
        if self.mock:
            return self._mock_response(keyword)
        
        if not self.api_key:
            print("❌ API Key missing. Skipping real API call.")
            return None
            
        params = {
            "keyword": keyword,
            "marketplace": "US",
            "size": 20 # Get top 20 to filter reliable top 10 after de-duplication
        }
        headers = {"secret-key": self.api_key}
        
        try:
            print(f"--> Fetching SERP for: {keyword}")
            # Note: In real API, endpoint might vary. Assuming /keyword/srank logic provided by user.
            # If actual endpoint differs, this needs adjustment.
            # Using placeholder logic below since exact API Key behaviour is not tested here.
            # For now, we simulate success if API key is present or fallback to mock if requested.
            
            # Real API Call
            response = requests.get(self.API_ENDPOINT, params=params, headers=headers, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if data.get('code') != 200:
                print(f"❌ API Error for {keyword}: {data}") # Print full JSON
                return None
                
            return data.get('data', {}).get('items', [])
            
        except Exception as e:
            print(f"❌ Error fetching {keyword}: {e}")
            return None

    def _mock_response(self, keyword: str) -> List[Dict]:
        """
        Mock data generator for development/verification.
        """
        return [
            {
                "asin": "B08SWLTTSW",
                "rank": 1,
                "type": "organic",
                "brand": "Gorilla Grip",
                "price": 19.99,
                "rating": 4.5,
                "reviews": 12000
            },
            {
                "asin": "B07XXXXXX1",
                "rank": 2,
                "type": "organic",
                "brand": "Color G",
                "price": 24.99,
                "rating": 4.4,
                "reviews": 8000
            },
            {
                "asin": "B07XXXXXX2",
                "rank": 3,
                "type": "sponsored",
                "brand": "Sierra Concepts",
                "price": 28.99,
                "rating": 4.3,
                "reviews": 5000
            }
        ]

    def transform(self, keyword: str, items: List[Dict]) -> List[Dict]:
        """
        Cleans and standardizes the data.
        """
        transformed = []
        
        # Sort by rank
        sorted_items = sorted(items, key=lambda x: x.get('rank', 999))
        
        # Keep track of ranks
        current_rank = 1
        
        for item in sorted_items:
            if current_rank > 10:
                break
                
            is_sponsored = item.get('type') == 'sponsored'
            
            row = {
                "keyword": keyword.strip().lower(),
                "marketplace": "US",
                "asin": item.get('asin'),
                "rank": current_rank, # Normalized display rank
                "organic_rank": item.get('rank') if not is_sponsored else None,
                "sponsored_rank": item.get('rank') if is_sponsored else None,
                "brand": str(item.get('brand', '')).strip().title(),
                "price": float(item.get('price', 0.0)),
                "rating": float(item.get('rating', 0.0)),
                "reviews": int(item.get('reviews', 0)),
                "capture_date": datetime.utcnow().date()
            }
            transformed.append(row)
            current_rank += 1
            
        return transformed

    def load(self, data: List[Dict]):
        """
        Loads data into DuckDB.
        """
        if not data:
            return

        df = pd.DataFrame(data)
        
        # Ensure table exists
        # In main flow, db_manager initializes schema, but valid check:
        self.con.execute("CREATE SEQUENCE IF NOT EXISTS seq_serp_id START 1")
        
        # Simple Append using DuckDB
        # We handle ID auto-generation. 
        # Since 'id' is in schema but not in DF, we can let DuckDB sequence handle it or ignore it if using INSERT specific columns.
        
        # Clean Load:
        # 1. Create temporary table
        self.con.register('df_staging', df)
        
        insert_sql = """
        INSERT INTO fact_serp_top10 (
            id, keyword, marketplace, asin, rank, organic_rank, sponsored_rank, 
            brand, price, rating, reviews, capture_date
        )
        SELECT 
            nextval('seq_serp_id'), keyword, marketplace, asin, rank, organic_rank, sponsored_rank, 
            brand, price, rating, reviews, capture_date
        FROM df_staging
        """
        
        self.con.execute(insert_sql)
        print(f"📥 Loaded {len(df)} rows into 'fact_serp_top10'.")
        self.con.unregister('df_staging')

