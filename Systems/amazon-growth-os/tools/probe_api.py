import requests
import os
import json
from dotenv import load_dotenv

load_dotenv()

def probe_endpoints():
    api_key = os.getenv("SELLERSPRITE_API_KEY")
    asin = "B0BGKWM81X"
    
    headers = {
        "secret-key": api_key,
        "Content-Type": "application/json"
    }
    
    print(f"--- Probing Known Endpoints with ASIN: {asin} ---")
    
    # 1. Product Research - Search by ASIN?
    pr_url = "https://api.sellersprite.com/v1/product/research"
    pr_payload = {
        "marketplace": "US",
        "keywords": asin, # Try ASIN as keyword
        "size": 1
    }
    print(f"\nTrying Product Research (Search by ASIN): {pr_url}")
    try:
        resp = requests.post(pr_url, json=pr_payload, headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            print(f"Response: {resp.text[:500]}")
    except Exception as e:
        print(f"Error: {e}")

    # 2. Keyword Miner - Search by ASIN?
    miner_url = "https://api.sellersprite.com/v1/keyword/miner"
    miner_payload = {
        "keyword": asin, # Try ASIN as keyword
        "marketplace": "US",
        "size": 5
    }
    print(f"\nTrying Keyword Miner (Search by ASIN): {miner_url}")
    try:
        resp = requests.post(miner_url, json=miner_payload, headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            print(f"Response: {resp.text[:500]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    probe_endpoints()
