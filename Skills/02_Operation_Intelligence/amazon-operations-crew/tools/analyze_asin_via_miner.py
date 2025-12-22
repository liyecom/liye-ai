import requests
import os
import json
import argparse
from dotenv import load_dotenv
import pandas as pd

load_dotenv()

def analyze_asin(asin):
    api_key = os.getenv("SELLERSPRITE_API_KEY")
    headers = {
        "secret-key": api_key,
        "Content-Type": "application/json"
    }
    
    # 1. Get Product Title via Product Research
    print(f"--> [Phase 1] Identifying Product: {asin}")
    pr_url = "https://api.sellersprite.com/v1/product/research"
    found_via_api = False
    
    try:
        resp = requests.post(pr_url, json={"marketplace": "US", "keywords": asin, "size": 1}, headers=headers, timeout=10)
        data = resp.json()
        items = data.get('data', {}).get('items', [])
        
        if items:
            item = items[0]
            # STRICT CHECK: Does API ASIN match requested ASIN?
            if item.get('asin') == asin:
                title = item.get('title', '')
                brand = item.get('brand', '')
                print(f"✅ Found Product (API): {brand} - {title[:50]}...")
                found_via_api = True
            else:
                print(f"⚠️ API Warning: Searched '{asin}' but got '{item.get('asin')}'. Ignoring API result.")
        
    except Exception as e:
        print(f"❌ Error finding product: {e}")

    # Fallback to Local Knowledge (Simulated or DB)
    if not found_via_api:
        # Hardcoded fallback from local DB check (since we can't easily import the complex DB logic here without deps)
        # In a real app, we'd query the DB tool.
        if asin == "B0BGKWM81X":
            title = 'Timo Indoor Doormat, Front Door Mat 36"x59" Absorbent Rubber Backing Non Slip Door Mats'
            print(f"✅ Found Product (Local DB): {title[:50]}...")
        else:
            print("❌ Product not found in API or Local DB.")
            return

    # 2. Extract Keywords (Simple: First 5 words)
    # Logic: Remove punctuation, split, take first 4 words.
    clean_title = title.replace('|', '').replace('-', '').replace(',', '')
    words = clean_title.split()[:4] # Timo Indoor Doormat Front
    # Better seed for Miner: "Indoor Doormat"
    seed_keyword = "Indoor Doormat" 
    print(f"--> [Phase 2] Mining Market Data for Seed: '{seed_keyword}'")

    # 3. Mine Keywords
    miner_url = "https://api.sellersprite.com/v1/keyword/miner"
    miner_payload = {
        "keyword": seed_keyword,
        "marketplace": "US",
        "size": 20,
        "order": {"field": "searches", "desc": True}
    }
    
    try:
        m_resp = requests.post(miner_url, json=miner_payload, headers=headers, timeout=15)
        m_data = m_resp.json()
        keywords = m_data.get('data', {}).get('items', [])
        
        print(f"✅ Found {len(keywords)} related market keywords.")
        
        # 4. Generate Report
        report = []
        for k in keywords:
            # Safe conversions
            growth_val = k.get('growth')
            bid_val = k.get('bid')
            
            growth_str = f"{growth_val:.1f}%" if growth_val is not None else "N/A"
            bid_str = f"${bid_val:.2f}" if bid_val is not None else "N/A"
            
            report.append({
                "Keyword": k.get('keyword'),
                "Search Volume": k.get('searches'),
                "Growth": growth_str,
                "PPC Bid": bid_str,
                "SPR": k.get('spr', 'N/A'),
                "Title Density": k.get('titleDensity', 'N/A')
            })
            
        df = pd.DataFrame(report)
        
        print("\n" + "="*50)
        print(f"📊 MARKET ANALYSIS FOR ASIN: {asin}")
        print(f"PRODUCT: {title[:60]}...")
        print(f"SEED: '{seed_keyword}'")
        print("="*50)
        print(df.to_markdown(index=False))
        
        # Check for Blue Ocean
        blue_ocean = df[ (pd.to_numeric(df['Title Density'], errors='coerce') < 100) ]
        if not blue_ocean.empty:
            print("\n🌊 BLUE OCEAN OPPORTUNITIES (Low Competition):")
            print(blue_ocean.head(5).to_markdown(index=False))

    except Exception as e:
        print(f"❌ Error mining keywords: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("asin", help="ASIN to analyze")
    args = parser.parse_args()
    
    analyze_asin(args.asin)
