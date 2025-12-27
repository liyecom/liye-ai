
import json
import os
import glob
import pandas as pd

def load_latest_json(pattern):
    files = sorted(glob.glob(pattern), reverse=True)
    if not files:
        return None, None
    with open(files[0], 'r', encoding='utf-8') as f:
        return files[0], json.load(f)

def extract_items(data, source_type):
    if not data: return []
    
    # API Structure: data -> items (list) OR data (list)
    # Manual (Archive) Structure: data (list of records)
    
    items = []
    if source_type == 'api':
        if "data" in data:
            d = data["data"]
            if isinstance(d, dict) and "items" in d:
                items = d["items"]
            elif isinstance(d, list):
                items = d
    elif source_type == 'manual':
        if "data" in data:
            items = data["data"]
            
    # Normalize to a simple dict: Keyword -> Data
    normalized = {}
    for item in items:
        # Handle field mapping differences
        # API: 'keyword', 'searches', 'rankPosition'->'index'
        # Manual: 'Keyword', 'Search Volume', 'Organic Rank'
        
        kw = item.get('keyword') or item.get('Keyword') or item.get('关键词')
        if not kw: continue
        
        # Vol
        vol = item.get('searches') or item.get('Search Volume') or item.get('月搜索量')
        try: vol = int(str(vol).replace(',',''))
        except: vol = 0
            
        # Rank
        rank = 0
        if 'rankPosition' in item and isinstance(item['rankPosition'], dict):
            rank = item['rankPosition'].get('index', 0)
        elif 'Organic Rank' in item:
            rank = item['Organic Rank']
        elif '自然排名' in item:
            rank = item['自然排名']
            
        try: rank = int(str(rank).replace(',',''))
        except: rank = 0
            
        normalized[kw] = {
            "vol": vol,
            "rank": rank
        }
    return normalized

def compare():
    print("🔍 Comparing Data Sources...")
    
    # 1. Load API Data
    api_file, api_data = load_latest_json("reports/raw_data/B08SWLTTSW_*.json")
    print(f"📄 API File: {os.path.basename(api_file) if api_file else 'NOT FOUND'}")
    
    # 2. Load Manual Data
    # Exclude the ones starting with MANUAL_B08... created by my mock script if possible, 
    # prefer the one from 'ReverseASIN...' which is the real user upload
    manual_file, manual_data = load_latest_json("reports/raw_data/MANUAL_ReverseASIN-US-B08*.json")
    print(f"📄 Manual File: {os.path.basename(manual_file) if manual_file else 'NOT FOUND'}")
    
    if not api_data or not manual_data:
        print("❌ Cannot proceed: Missing one or both data sources.")
        return

    api_dict = extract_items(api_data, 'api')
    manual_dict = extract_items(manual_data, 'manual')
    
    print(f"\n📊 Counts:")
    print(f"   API Keywords: {len(api_dict)}")
    print(f"   Manual Keywords: {len(manual_dict)}")
    
    # Overlap
    api_keys = set(api_dict.keys())
    manual_keys = set(manual_dict.keys())
    
    common = api_keys.intersection(manual_keys)
    missing_in_api = manual_keys - api_keys
    missing_in_manual = api_keys - manual_keys
    
    print(f"\n🔗 Overlap: {len(common)} keywords found in both.")
    print(f"⚠️ Missing in API: {len(missing_in_api)} (Likely due to pagination)")
    print(f"❓ Missing in Manual: {len(missing_in_manual)}")
    
    # Value Comparison on Sample
    print(f"\n📉 Data Accuracy Check (Top 5 Common Keywords):")
    print(f"{'Keyword':<30} | {'API Vol':<10} | {'Manual Vol':<10} | {'Diff'}")
    print("-" * 65)
    
    sorted_common = sorted(list(common), key=lambda x: manual_dict[x]['vol'], reverse=True)[:5]
    for kw in sorted_common:
        v1 = api_dict[kw]['vol']
        v2 = manual_dict[kw]['vol']
        match = "✅" if v1 == v2 else "❌"
        print(f"{kw[:30]:<30} | {v1:<10} | {v2:<10} | {match}")

if __name__ == "__main__":
    compare()
