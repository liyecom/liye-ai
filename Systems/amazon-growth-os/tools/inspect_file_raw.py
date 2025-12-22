import pandas as pd
import glob
import os

UPLOADS_DIR = "uploads"

def inspect_raw():
    # Find the search term report
    files = glob.glob(os.path.join(UPLOADS_DIR, "商品推廣_搜尋字詞_報告.xlsx"))
    if not files:
        print("File not found!")
        return
        
    file = files[0]
    print(f"--- Inspecting Raw File: {file} ---")
    
    df = pd.read_excel(file)
    # Print columns to be sure
    # print(df.columns)
    
    # Filter for the campaign
    # Column names might be Chinese
    # 廣告活動名稱 / Campaign Name
    camp_col = next((c for c in df.columns if '廣告活動名稱' in c or 'Campaign Name' in c), None)
    sales_col = next((c for c in df.columns if '7 天總銷售額' in c or 'Sales' in c), None)
    term_col = next((c for c in df.columns if '客戶搜尋字詞' in c or 'Customer Search Term' in c), None)
    
    if not camp_col:
        print("Could not find Campaign Name column")
        return

    target_camp = "B0C5B0C5Q9Y6YF-GoldenKeywords-1214-LIYE"
    
    print(f"Looking for campaign: {target_camp}")
    
    subset = df[df[camp_col] == target_camp]
    
    if subset.empty:
        print("Campaign NOT FOUND in the file.")
    else:
        print(f"Found {len(subset)} rows for this campaign.")
        # Show relevant columns
        cols_to_show = [c for c in [camp_col, term_col, sales_col] if c]
        print(subset[cols_to_show].to_markdown(index=False))

if __name__ == "__main__":
    inspect_raw()
