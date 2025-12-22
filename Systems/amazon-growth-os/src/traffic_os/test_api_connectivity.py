
import requests
import os
from dotenv import load_dotenv
import json

load_dotenv()

API_KEY = os.getenv("SELLERSPRITE_API_KEY")

def test_connection():
    if not API_KEY:
        print("❌ No API Key found.")
        return

    print(f"🔑 Testing API Key: {API_KEY[:4]}...")
    
    headers = {
        "secret-key": API_KEY,
        "Content-Type": "application/json"
    }

    # Test 1: Miner - Known Good
    print(f"--- Testing Miner (POST) ---")
    miner_url = "https://api.sellersprite.com/v1/keyword/miner"
    miner_payload = {
        "keyword": "door mat",
        "marketplace": "US",
        "size": 1,
        "desc": True,
        "order": {"field":"searches", "desc":True}
    }
    try:
        resp = requests.post(miner_url, json=miner_payload, headers=headers, timeout=10)
        print(f"Miner status: {resp.status_code}")
        print(f"Miner response: {resp.text[:300]}")
    except Exception as e:
        print(f"Miner error: {e}")

    # Test 2: Product Research (Alternative for SERP)
    print(f"\n--- Testing Product Research (POST: /v1/product/research) ---")
    pr_url = "https://api.sellersprite.com/v1/product/research"
    # Using 'keywords' as it's common for search. If doc says 'excludeKeywords', likely 'keywords' or 'keyword' exists.
    # Trying "keywords" first.
    pr_payload = {
        "marketplace": "US", 
        "keywords": "door mat", 
        "size": 10, 
        "sort": {"field": "sales", "desc": True}
    }
    
    try:
        resp = requests.post(pr_url, json=pr_payload, headers=headers, timeout=10)
        print(f"PR status: {resp.status_code}")
        print(f"PR response: {resp.text[:500]}")
        
        if resp.status_code == 200:
             data = resp.json()
             if data.get('code') == 200:
                 items = data.get('data', {}).get('items', [])
                 print(f"✅ Product Research Success! Found {len(items)} items.")
                 if items:
                     print(f"First Item: {items[0].get('asin')} - {items[0].get('brand')}")
    except Exception as e:
        print(f"PR error: {e}")

if __name__ == "__main__":
    test_connection()
