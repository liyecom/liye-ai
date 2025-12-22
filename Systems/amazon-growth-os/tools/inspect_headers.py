import pandas as pd
import glob
import os

UPLOADS_DIR = "uploads"

def inspect():
    files = glob.glob(os.path.join(UPLOADS_DIR, "*.xlsx"))
    for file in files:
        if "Reverse" in file: continue # Skip verified
        print(f"--- Inspecting {os.path.basename(file)} ---")
        try:
            df = pd.read_excel(file, nrows=0) # Read only headers
            print(list(df.columns))
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    inspect()
