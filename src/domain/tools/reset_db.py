
import duckdb
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'amazon_growth_os.db')

def reset_db():
    print(f"🔥 Resetting Database at: {DB_PATH}")
    try:
        con = duckdb.connect(DB_PATH)
        tables = con.execute("SHOW TABLES").fetchall()
        for t in tables:
            table_name = t[0]
            print(f"   Dropping {table_name}...", end=" ")
            con.execute(f"DROP TABLE {table_name}")
            print("🗑️")
        print("✅ Database wiped clean.")
        con.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    reset_db()
