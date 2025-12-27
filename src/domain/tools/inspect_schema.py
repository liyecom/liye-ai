
import duckdb
from src.data_lake.db_manager import get_db_connection

con = get_db_connection()
print(con.execute("PRAGMA table_info(fact_keyword_entry_daily)").df().to_string())
