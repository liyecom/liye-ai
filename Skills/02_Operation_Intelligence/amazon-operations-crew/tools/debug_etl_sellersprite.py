
import os
import yaml
import pandas as pd
import duckdb
from src.data_lake.db_manager import get_db_connection
from src.data_lake.etl_loader import process_file

def debug_load():
    con = get_db_connection()
    
    # 1. Config
    with open('config/mapping.yaml', 'r') as f:
        config = yaml.safe_load(f)
        
    profile = next(p for p in config['mappings'] if p['profile_name'] == 'sellersprite_reverse_asin_xlsx')
    file_path = os.path.join('uploads', 'ReverseASIN-US-B08SWLTTSW-Last-30-days.xlsx')
    
    print(f"Debugging Profile: {profile}")
    print(f"File Path: {file_path}")
    
    # 2. Process
    process_file(file_path, profile, con)
    
    # 3. Verify
    count = con.execute("SELECT COUNT(*) FROM fact_keyword_snapshot").fetchone()[0]
    print(f"Final Count: {count}")

if __name__ == "__main__":
    debug_load()
