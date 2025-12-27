
from src.data_lake.db_manager import get_db_connection
from src.data_lake.schema_definitions import ALL_DDL

def init_db():
    print("🚀 Initializing Database Schema...")
    con = get_db_connection()
    
    for ddl in ALL_DDL:
        # Simple extraction of table name for logging
        try:
            table_name = ddl.split("TABLE IF NOT EXISTS")[1].split("(")[0].strip()
        except:
            table_name = "Unknown"
            
        print(f"Applying Schema for: {table_name}")
        con.execute(ddl)
        
    print("✅ All schemas applied successfully.")

if __name__ == "__main__":
    init_db()
