import requests
import os
import json
import argparse
from dotenv import load_dotenv

load_dotenv()

def fetch_asin_keywords(asin):
    api_key = os.getenv("SELLERSPRITE_API_KEY")
    if not api_key:
        print("❌ Error: SELLERSPRITE_API_KEY not found in .env")
        return

    url = "https://api.sellersprite.com/v1/market/reverse-asin"
    
    # Try typical payload pattern for SellersSprite
    payload = {
        "asin": asin,
        "marketplace": "US",
        "size": 50, # Get top 50 keywords
        # "sort": {"field": "traffic_score", "desc": True} # Optional, might not be needed
    }
    
    headers = {
        "secret-key": api_key,
        "Content-Type": "application/json"
    }
    
    print(f"--> Fetching Reverse ASIN data for {asin}...")
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('code') != 200:
            print(f"❌ API Error: {data.get('message', 'Unknown Error')}")
            print(json.dumps(data, indent=2))
            return
            
        items = data.get('data', {}).get('items', [])
        print(f"✅ Success! Found {len(items)} keywords.")
        
        if not items:
            print("No keywords found for this ASIN.")
            return

        # Simple Markdown Report
        print(f"\n### 🔍 Analysis for ASIN: {asin}")
        print("| Keyword | Search Vol | Rank | Traffic Share | Type |")
        print("|:---|---:|---:|---:|:---|")
        
        for item in items[:20]: # Show top 20
            kw = item.get('keyword', 'N/A')
            sv = item.get('searches', 0)
            rank = item.get('organic_rank', 'N/A')
            share = item.get('traffic_share', 0)
            # Try to guess type based on rank
            k_type = "Organic" if isinstance(rank, int) and rank < 5 else "Long-tail"
            
            print(f"| {kw} | {sv:,} | {rank} | {share}% | {k_type} |")

    except Exception as e:
        print(f"❌ Connection Error: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("asin", help="ASIN to analyze")
    args = parser.parse_args()
    
    fetch_asin_keywords(args.asin)
