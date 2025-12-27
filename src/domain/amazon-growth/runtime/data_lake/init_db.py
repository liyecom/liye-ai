
import duckdb
import os
import sys

# Add src to path to import schema
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from src.data_lake.schema_definitions import ALL_DDL

DB_PATH = os.path.join(os.path.dirname(__file__), '../../data/amazon_growth_os.db')

def init_database():
    print(f"🚀 Initializing Data Lake at: {DB_PATH}")
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    con = duckdb.connect(DB_PATH)
    
    try:
        # Enable auto-checkpointing
        con.execute("PRAGMA checkpoint_threshold='16MB'")
        
        for ddl in ALL_DDL:
            table_name = ddl.split("TABLE IF NOT EXISTS")[1].split("(")[0].strip()
            print(f"   Building table: {table_name}...", end=" ")
            con.execute(ddl)
            print("✅")
            
        print("\n🎉 Database initialization complete!")
        
        # Verify
        tables = con.execute("SHOW TABLES").fetchall()
        print(f"📊 Current Tables: {[t[0] for t in tables]}")
        
    except Exception as e:
        print(f"\n❌ Error initializing database: {e}")
    finally:
        con.close()

if __name__ == "__main__":
    init_database()
