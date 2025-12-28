#!/usr/bin/env python3
"""
SellerSprite Data Import Script
================================

Imports SellerSprite keyword data from CSV into DuckDB.

Usage:
    python scripts/import_sellersprite_data.py

Expected CSV location:
    data/sellersprite/sellersprite_keyword_snapshot.csv

Required CSV columns (per SellerSprite_DATA_CONTRACT.md):
    - asin: Amazon product ASIN
    - keyword: Search keyword
    - search_volume: Monthly search volume
    - competition: Competition index (0-1)
    - conversion_rate: Purchase rate percentage
    - snapshot_date: Data snapshot date (YYYY-MM-DD)

Optional columns:
    - monopoly_pct: Top 3 ASIN market share
    - ppc_bid: Suggested PPC bid
    - spr: Sales per review
    - ranking: Keyword ranking for ASIN
"""

import sys
from pathlib import Path
from datetime import datetime

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


def import_sellersprite_data(csv_file: str = None):
    """Import SellerSprite CSV data into DuckDB.

    Args:
        csv_file: Optional CSV file path. If not provided, uses default location.
    """
    print("=" * 60)
    print("SellerSprite Data Import")
    print("=" * 60)

    # Paths
    if csv_file:
        csv_path = Path(csv_file)
        if not csv_path.is_absolute():
            csv_path = project_root / csv_file
    else:
        csv_path = project_root / "data" / "sellersprite" / "sellersprite_keyword_snapshot.csv"

    db_path = project_root / "src" / "domain" / "data" / "growth_os.duckdb"

    # Check CSV exists
    if not csv_path.exists():
        print(f"\n❌ CSV file not found: {csv_path}")
        print("\nPlease export your SellerSprite data and save it as:")
        print(f"  {csv_path}")
        print("\nRequired columns:")
        print("  - asin, keyword, search_volume, competition, conversion_rate, snapshot_date")
        return False

    print(f"\n📂 CSV file: {csv_path}")
    print(f"📂 Database: {db_path}")

    # Import duckdb
    try:
        import duckdb
    except ImportError:
        print("\n❌ DuckDB not installed. Run: pip install duckdb")
        return False

    # Connect to database
    conn = duckdb.connect(str(db_path))

    try:
        # Preview CSV
        print("\n📋 Previewing CSV...")
        preview = conn.execute(f"""
            SELECT * FROM read_csv_auto('{csv_path}') LIMIT 5
        """).fetchdf()
        print(preview)

        # Get column names
        columns = list(preview.columns)
        print(f"\n📊 Columns found: {columns}")

        # Check required columns
        required = ['asin', 'keyword', 'search_volume']
        missing = [c for c in required if c.lower() not in [col.lower() for col in columns]]
        if missing:
            print(f"\n⚠️  Missing required columns: {missing}")
            print("   Will attempt import anyway...")

        # Create table
        print("\n🔧 Creating fact_keyword_snapshot table...")

        # Drop existing table if exists
        conn.execute("DROP TABLE IF EXISTS fact_keyword_snapshot")

        # Create table from CSV
        conn.execute(f"""
            CREATE TABLE fact_keyword_snapshot AS
            SELECT
                *,
                CURRENT_DATE as import_date
            FROM read_csv_auto('{csv_path}')
        """)

        # Verify import
        count = conn.execute("SELECT COUNT(*) FROM fact_keyword_snapshot").fetchone()[0]
        print(f"\n✅ Imported {count} rows into fact_keyword_snapshot")

        # Show sample
        print("\n📋 Sample data:")
        sample = conn.execute("""
            SELECT * FROM fact_keyword_snapshot LIMIT 5
        """).fetchdf()
        print(sample)

        # Show table schema
        print("\n📐 Table schema:")
        schema = conn.execute("""
            DESCRIBE fact_keyword_snapshot
        """).fetchdf()
        print(schema)

        print("\n" + "=" * 60)
        print("✅ Import Complete!")
        print("=" * 60)
        print(f"\nTable: fact_keyword_snapshot")
        print(f"Rows: {count}")
        print(f"Database: {db_path}")
        print("\nYou can now run MCP verification to unlock Phase 3:")
        print("  python src/domain/amazon-growth/scripts/verify_mcp_integration.py")

        return True

    except Exception as e:
        print(f"\n❌ Import failed: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        conn.close()


def create_sample_csv():
    """Create a sample CSV for testing."""
    sample_path = project_root / "data" / "sellersprite" / "sellersprite_keyword_snapshot_sample.csv"

    sample_data = """asin,keyword,search_volume,competition,conversion_rate,snapshot_date,monopoly_pct,ppc_bid,ranking
B08N5WRWNW,wireless earbuds,150000,0.85,3.2,2025-12-28,0.45,2.50,5
B08N5WRWNW,bluetooth earbuds,120000,0.78,2.8,2025-12-28,0.38,2.20,8
B08N5WRWNW,earbuds wireless,95000,0.72,3.5,2025-12-28,0.42,1.95,12
B09XYZ1234,phone case,200000,0.65,4.1,2025-12-28,0.25,1.50,3
B09XYZ1234,iphone case,180000,0.70,3.8,2025-12-28,0.30,1.75,6
"""

    with open(sample_path, 'w') as f:
        f.write(sample_data)

    print(f"✅ Sample CSV created: {sample_path}")
    print("\nTo test import, rename it to:")
    print(f"  mv {sample_path} {sample_path.parent}/sellersprite_keyword_snapshot.csv")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Import SellerSprite data")
    parser.add_argument("--sample", action="store_true", help="Create sample CSV for testing")
    parser.add_argument("--file", "-f", type=str, help="CSV file path (default: data/sellersprite/sellersprite_keyword_snapshot.csv)")
    args = parser.parse_args()

    if args.sample:
        create_sample_csv()
    else:
        success = import_sellersprite_data(csv_file=args.file)
        sys.exit(0 if success else 1)
