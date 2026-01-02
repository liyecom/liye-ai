#!/usr/bin/env python3
"""
SellerSprite Data Import Script
================================

Imports SellerSprite keyword data from CSV/XLSX into DuckDB.
Supports batch import of multiple files.

Usage:
    python scripts/import_sellersprite_data.py              # Import all xlsx files
    python scripts/import_sellersprite_data.py -f file.xlsx # Import single file
"""

import sys
import re
from pathlib import Path
from datetime import datetime

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Column mapping (Chinese -> English)
COLUMN_MAPPING = {
    '关键词': 'keyword',
    '月搜索量': 'search_volume',
    '购买率': 'conversion_rate',
    '关键词翻译': 'keyword_translation',
    '流量占比': 'traffic_share',
    '预估周曝光量': 'weekly_impressions',
    '自然排名': 'organic_rank',
    '广告排名': 'ad_rank',
    'ABA周排名': 'aba_rank',
    'SPR': 'spr',
    '标题密度': 'title_density',
    '购买量': 'purchase_count',
    '展示量': 'impressions',
    '点击量': 'clicks',
    '商品数': 'product_count',
    '需供比': 'demand_supply_ratio',
    '点击总占比': 'click_share',
    '转化总占比': 'conversion_share',
    'PPC价格': 'ppc_bid',
    '建议竞价范围': 'suggested_bid_range',
    '前十ASIN': 'top10_asins',
    '近7天广告竞品数': 'ad_competitors_7d',
    '关键词类型': 'keyword_type',
    '转化效果': 'conversion_effect',
    '流量词类型': 'traffic_type',
    '自然流量占比': 'organic_traffic_share',
    '广告流量占比': 'ad_traffic_share',
    '自然排名页码': 'organic_rank_page',
    '广告排名页码': 'ad_rank_page',
    '更新时间': 'update_time',
}


def extract_asin_from_filename(filename: str) -> str:
    """Extract ASIN from filename."""
    match = re.search(r'B[0-9A-Z]{9}', filename)
    return match.group(0) if match else None


def read_and_transform_file(file_path: Path) -> 'pd.DataFrame':
    """Read file and transform columns."""
    import pandas as pd

    # Read file
    if file_path.suffix.lower() == '.xlsx':
        df = pd.read_excel(file_path)
    else:
        df = pd.read_csv(file_path)

    # Rename columns
    df = df.rename(columns={k: v for k, v in COLUMN_MAPPING.items() if k in df.columns})

    # Add ASIN from filename
    asin = extract_asin_from_filename(file_path.name)
    if asin and 'asin' not in df.columns:
        df['asin'] = asin

    # Add source file
    df['source_file'] = file_path.name

    return df


def import_sellersprite_data(file_path_arg: str = None):
    """Import SellerSprite data (single file or batch)."""
    print("=" * 60)
    print("SellerSprite Data Import")
    print("=" * 60)

    import pandas as pd
    import duckdb

    db_path = project_root / "src" / "domain" / "data" / "growth_os.duckdb"
    data_dir = project_root / "data" / "sellersprite"

    # Find files
    if file_path_arg:
        file_path = Path(file_path_arg)
        if not file_path.is_absolute():
            file_path = project_root / file_path_arg
        files = [file_path] if file_path.exists() else []
    else:
        files = sorted(data_dir.glob("*.xlsx"))

    if not files:
        print("❌ No files found")
        return False

    # Show files
    print(f"\n📄 Files to import: {len(files)}")
    for f in files:
        asin = extract_asin_from_filename(f.name)
        print(f"   • {f.name} (ASIN: {asin})")

    # Read and merge all files
    print("\n📋 Reading files...")
    all_dfs = []
    for f in files:
        try:
            df = read_and_transform_file(f)
            all_dfs.append(df)
            print(f"   ✓ {f.name}: {len(df)} rows")
        except Exception as e:
            print(f"   ✗ {f.name}: {e}")

    if not all_dfs:
        print("❌ No data loaded")
        return False

    # Merge all DataFrames
    print("\n🔄 Merging data...")
    merged_df = pd.concat(all_dfs, ignore_index=True)

    # Add metadata
    merged_df['snapshot_date'] = datetime.now().strftime('%Y-%m-%d')
    merged_df['import_date'] = datetime.now().strftime('%Y-%m-%d')

    print(f"   Total rows: {len(merged_df)}")
    print(f"   Unique ASINs: {merged_df['asin'].nunique()}")

    # Import to DuckDB
    print("\n🔧 Importing to DuckDB...")
    conn = duckdb.connect(str(db_path))

    try:
        conn.execute("DROP TABLE IF EXISTS fact_keyword_snapshot")
        conn.register('merged_df', merged_df)
        conn.execute("CREATE TABLE fact_keyword_snapshot AS SELECT * FROM merged_df")

        # Verify
        count = conn.execute("SELECT COUNT(*) FROM fact_keyword_snapshot").fetchone()[0]
        asins = conn.execute("SELECT DISTINCT asin FROM fact_keyword_snapshot").fetchdf()

        print(f"\n✅ Imported {count} rows")
        print(f"\n📊 ASINs in database:")
        for asin in asins['asin'].tolist():
            asin_count = conn.execute(f"SELECT COUNT(*) FROM fact_keyword_snapshot WHERE asin = '{asin}'").fetchone()[0]
            print(f"   • {asin}: {asin_count} keywords")

        # Sample
        print("\n📋 Sample data:")
        sample = conn.execute("""
            SELECT asin, keyword, search_volume, conversion_rate
            FROM fact_keyword_snapshot
            ORDER BY TRY_CAST(search_volume AS DOUBLE) DESC NULLS LAST
            LIMIT 5
        """).fetchdf()
        print(sample)

        print("\n" + "=" * 60)
        print("✅ Import Complete!")
        print("=" * 60)
        return True

    except Exception as e:
        print(f"❌ Import failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        conn.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Import SellerSprite data")
    parser.add_argument("--file", "-f", type=str, help="Single file to import")
    args = parser.parse_args()

    success = import_sellersprite_data(args.file)
    sys.exit(0 if success else 1)
