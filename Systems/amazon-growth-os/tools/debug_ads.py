import duckdb

def probe():
    con = duckdb.connect("data/growth_os.duckdb")
    print("--- Row Count ---")
    print(con.execute("SELECT count(*) FROM factor_search_term_performance").fetchall())
    
    print("\n--- Max Spend ---")
    print(con.execute("SELECT MAX(spend) FROM factor_search_term_performance").fetchall())

    print("\n--- Sample Data ---")
    print(con.execute("SELECT customer_search_term, spend, sales FROM factor_search_term_performance LIMIT 5").df().to_markdown())
    
    con.close()

if __name__ == "__main__":
    probe()
