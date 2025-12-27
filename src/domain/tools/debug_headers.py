import pandas as pd
import glob
import os

def debug():
    file = "uploads/商品推廣_搜尋字詞_報告.xlsx"
    try:
        df = pd.read_excel(file, nrows=0)
        print(f"File: {file}")
        print("Columns:", [repr(c) for c in df.columns])
    except Exception as e:
        print(e)
        
    file2 = "uploads/系统-TIMO home-US-广告活动-202512201926152382.xlsx"
    try:
        df = pd.read_excel(file2, nrows=0)
        print(f"File: {file2}")
        print("Columns:", [repr(c) for c in df.columns])
    except Exception as e:
        print(e)

if __name__ == "__main__":
    debug()
