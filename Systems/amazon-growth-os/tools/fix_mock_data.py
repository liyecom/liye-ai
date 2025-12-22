
import json
import pandas as pd
import os
import glob

def fix_csv_data():
    # 1. Find the real JSON data we fetched earlier
    raw_dir = "reports/raw_data"
    # Look for the B08SWLTTSW files
    pattern = os.path.join(raw_dir, "B08SWLTTSW_*.json")
    files = sorted(glob.glob(pattern), reverse=True)
    
    if not files:
        print("Error: No real API data found to fix the CSV.")
        return

    real_data_file = files[0]
    print(f"Reading real data from: {real_data_file}")
    
    with open(real_data_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    # Extract items
    items = []
    if "data" in data and isinstance(data["data"], dict) and "items" in data["data"]:
        items = data["data"]["items"]
    elif "data" in data and isinstance(data["data"], list):
        items = data["data"]
        
    if not items:
        print("No items found in JSON.")
        return

    # 2. Convert to DataFrame matching the CSV structure
    # Expected: Keyword,Search Volume,Organic Rank,Traffic Share,Purchase Rate,Title Density
    
    rows = []
    for item in items:
        # Organic Rank is nested in 'rankPosition' -> 'index' or just 'rank' depending on API
        # The JSON sample showed "rankPosition": { "index": 51 ... }
        rank = 0
        if item.get("rankPosition"):
            rank = item["rankPosition"].get("index", 0)
            
        # Safe conversions
        p_rate = item.get('purchaseRate')
        p_rate = float(p_rate) if p_rate is not None else 0.0
        
        t_share = item.get('trafficPercentage')
        t_share = float(t_share) if t_share is not None else 0.0
        
        searches = item.get('searches')
        searches = int(searches) if searches is not None else 0

        rows.append({
            "Keyword": item.get("keyword"),
            "Search Volume": searches,
            "Organic Rank": rank,
            "Traffic Share": f"{t_share*100:.2f}%",
            "Purchase Rate": f"{p_rate*100:.2f}%",
            "Title Density": item.get("titleDensity", 0)
        })
        
    df = pd.DataFrame(rows)
    
    # Sort by Search Volume
    df = df.sort_values(by="Search Volume", ascending=False)
    
    # 3. Overwrite the bad CSV
    target_csv = "uploads/B08SWLTTSW_reverse.csv"
    df.to_csv(target_csv, index=False)
    print(f"✅ Successfully corrected {target_csv} with {len(df)} real records.")
    print("Top 5 Corrected Keywords:")
    print(df.head(5)[["Keyword", "Search Volume"]])

if __name__ == "__main__":
    fix_csv_data()
