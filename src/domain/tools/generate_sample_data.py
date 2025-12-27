
import pandas as pd
import os

def create_sample_data():
    data = {
        "Keyword": [
            "laptop stand", "ergonomic laptop stand", "aluminum laptop riser", 
            "portable computer stand", "macbook pro stand", 
            "gaming laptop stand cooling", "adjustable laptop holder", 
            "desk accessories", "stand for laptop"
        ],
        "月搜索量": [50000, 12000, 8000, 25000, 30000, 15000, 10000, 100000, 45000],
        "自然排名": [5, 12, 18, 25, 3, 55, 9, 0, 7],
        "流量占比": ["5.2%", "3.1%", "1.5%", "0.0%", "8.5%", "0.0%", "4.2%", "0.0%", "6.1%"],
        "ASIN": ["B0C5Q9Y6YF"] * 9
    }
    
    df = pd.DataFrame(data)
    
    # Save to a temporary location that sellersprite_tools would read
    # But wait, sellersprite_tools reads raw excel/csv.
    # Let's save to 'uploads/test_data.csv' (simulating user upload)
    
    upload_dir = os.path.join(os.path.dirname(__file__), '../uploads')
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, 'test_sellersprite_data.csv')
    
    df.to_csv(file_path, index=False)
    print(f"✅ Sample data created at: {file_path}")
    return file_path

if __name__ == "__main__":
    create_sample_data()
