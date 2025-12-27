
import os
import sys
import pandas as pd
import datetime
import json

def read_file_for_archive(file_path: str):
    try:
        if not os.path.exists(file_path):
            print(f"Error: File not found at {file_path}")
            return
        
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
        
        # Archive Manual Data to Data Lake
        try:
            data_records = df.to_dict(orient='records')
            archive_data = {
                "source": "manual_upload",
                "original_file": os.path.basename(file_path),
                "import_time": datetime.datetime.now().isoformat(),
                "data": data_records
            }
            
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            # Navigate to reports/raw_data relative to this script
            raw_dir = os.path.join(os.path.dirname(__file__), "../reports/raw_data")
            os.makedirs(raw_dir, exist_ok=True)
            
            base_name = os.path.splitext(os.path.basename(file_path))[0]
            raw_file = os.path.join(raw_dir, f"MANUAL_{base_name}_{timestamp}.json")
            
            with open(raw_file, "w", encoding="utf-8") as f:
                json.dump(archive_data, f, ensure_ascii=False, indent=2)
            print(f"💾 Manual Data Archived to: {raw_file}")
            return raw_file
        except Exception as e:
            print(f"⚠️ Failed to archive manual data: {e}")

    except Exception as e:
        print(f"Error reading file: {str(e)}")

def archive_manual_data():
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
    else:
        file_path = os.path.join(os.path.dirname(__file__), '../uploads/test_sellersprite_data.csv')
    
    print(f"🔄 Reading and Archiving: {file_path}")
    if os.path.exists(file_path):
        read_file_for_archive(file_path)
        print("✅ Archive process triggered.")
    else:
        print(f"❌ File not found: {file_path}")

if __name__ == "__main__":
    archive_manual_data()
