"""
ETL Loader for Amazon Growth OS Data Lake
Version: 2.1 (Enhanced with incremental loading & data quality)
"""

import os
import re
import yaml
import duckdb
import pandas as pd
import hashlib
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

from src.data_lake.db_manager import (
    get_db_connection,
    get_existing_keys,
    deduplicate_dataframe,
    run_all_retention_policies,
    vacuum_database
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('logs/etl_loader.log', mode='a', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)


# Config Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
MAPPING_CONFIG = os.path.join(BASE_DIR, "config", "mapping.yaml")
STATE_FILE = os.path.join(BASE_DIR, "data", ".etl_state.json")

# Ensure logs directory exists
os.makedirs(os.path.join(BASE_DIR, "logs"), exist_ok=True)

# ============================================
# State Management (Incremental Loading)
# ============================================

def load_etl_state() -> Dict[str, Any]:
    """Load ETL state for incremental processing."""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load ETL state: {e}")
    return {"processed_files": {}, "last_run": None}

def save_etl_state(state: Dict[str, Any]):
    """Save ETL state after processing."""
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    state["last_run"] = datetime.now().isoformat()
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)
    logger.info(f"ETL state saved: {len(state['processed_files'])} files tracked")

def get_file_hash(file_path: str) -> str:
    """Generate hash of file for change detection."""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def should_process_file(file_path: str, state: Dict[str, Any]) -> bool:
    """Check if file should be processed (new or modified)."""
    filename = os.path.basename(file_path)
    current_hash = get_file_hash(file_path)

    if filename in state["processed_files"]:
        if state["processed_files"][filename]["hash"] == current_hash:
            logger.debug(f"Skipping unchanged file: {filename}")
            return False
        logger.info(f"File modified, will reprocess: {filename}")
    return True

def mark_file_processed(filename: str, file_hash: str, state: Dict[str, Any],
                        rows_loaded: int, status: str = "SUCCESS"):
    """Mark file as processed in state."""
    state["processed_files"][filename] = {
        "hash": file_hash,
        "processed_at": datetime.now().isoformat(),
        "rows_loaded": rows_loaded,
        "status": status
    }

# ============================================
# Dynamic Value Extraction
# ============================================

def extract_asin_from_filename(filename: str) -> Optional[str]:
    """Extract ASIN from filename pattern like 'ReverseASIN-B0C5Q9Y6YF.xlsx'."""
    match = re.search(r'ReverseASIN[-_]?([A-Z0-9]{10})', filename, re.IGNORECASE)
    if match:
        return match.group(1).upper()
    return None

def extract_date_from_filename(filename: str) -> Optional[str]:
    """Extract date from filename patterns like '2024-12-20' or '20241220'."""
    # Pattern 1: YYYY-MM-DD
    match = re.search(r'(\d{4}-\d{2}-\d{2})', filename)
    if match:
        return match.group(1)
    # Pattern 2: YYYYMMDD
    match = re.search(r'(\d{8})', filename)
    if match:
        date_str = match.group(1)
        return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    return None

# ============================================
# Data Quality Checks
# ============================================

def run_data_quality_checks(df: pd.DataFrame, profile: Dict) -> Dict[str, Any]:
    """Run data quality checks and return results."""
    checks = {
        "row_count": len(df),
        "null_count": df.isnull().sum().to_dict(),
        "warnings": [],
        "errors": []
    }

    # Check 1: Empty DataFrame
    if len(df) == 0:
        checks["errors"].append("DataFrame is empty")
        return checks

    # Check 2: Critical columns have data
    critical_cols = ['keyword', 'search_volume', 'spend', 'sales']
    for col in critical_cols:
        if col in df.columns:
            null_pct = df[col].isnull().sum() / len(df)
            if null_pct > 0.5:
                checks["warnings"].append(f"{col} has {null_pct*100:.1f}% null values")

    # Check 3: Numeric columns are in reasonable range
    if 'search_volume' in df.columns:
        max_sv = df['search_volume'].max()
        if max_sv > 10_000_000:
            checks["warnings"].append(f"search_volume max={max_sv}, may be data error")

    # Check 4: Duplicate rows
    if 'keyword' in df.columns:
        dup_count = df.duplicated(subset=['keyword']).sum()
        if dup_count > 0:
            checks["warnings"].append(f"{dup_count} duplicate keyword rows found")

    return checks

def load_config():
    with open(MAPPING_CONFIG, 'r') as f:
        return yaml.safe_load(f)

def generate_hash(text):
    if pd.isna(text) or text == '':
        return None
    return hashlib.md5(str(text).strip().lower().encode('utf-8')).hexdigest()

def normalize_keyword(text):
    if pd.isna(text): 
        return None
    # Lowercase, trim, collapse spaces
    return " ".join(str(text).strip().lower().split())

def process_file(file_path: str, profile: Dict, con) -> Dict[str, Any]:
    """
    Process a single data file and load into DuckDB.
    Returns processing result with status and row count.
    """
    filename = os.path.basename(file_path)
    logger.info(f"Processing {filename} with profile [{profile['profile_name']}]")

    result = {"status": "FAILED", "rows_loaded": 0, "errors": []}

    # 1. Read File
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path, sheet_name=profile.get('sheet_name', 0))
        logger.info(f"    Read {len(df)} rows from file")
    except Exception as e:
        logger.error(f"Read Error: {e}")
        result["errors"].append(str(e))
        return result

    # 2. Map Columns
    canonical_df = pd.DataFrame()
    
    # Apply Field Mappings
    mapped_count = 0
    for src_col, target_col in profile['field_map'].items():
        if src_col in df.columns:
            canonical_df[target_col] = df[src_col]
            mapped_count += 1
        elif target_col == 'spend': 
            # Fallback for spend synonyms if specific mapping failed
            if '支出' in df.columns: canonical_df['spend'] = df['支出']
            elif '花費' in df.columns: canonical_df['spend'] = df['花費']
            elif 'Cost' in df.columns: canonical_df['spend'] = df['Cost']
            
    logger.info(f"    Mapped {mapped_count} columns")

    # 3. Apply Static/Derived Values (with dynamic overrides)
    if 'static_values' in profile:
        for k, v in profile['static_values'].items():
            canonical_df[k] = v

    # Dynamic ASIN extraction from filename (overrides static value)
    if profile.get('source_system') == 'SELLERSPRITE':
        extracted_asin = extract_asin_from_filename(filename)
        if extracted_asin:
            canonical_df['asin'] = extracted_asin
            logger.info(f"    Extracted ASIN from filename: {extracted_asin}")

    # Dynamic date extraction from filename
    extracted_date = extract_date_from_filename(filename)
    if extracted_date:
        canonical_df['snapshot_date'] = extracted_date
        logger.info(f"    Extracted date from filename: {extracted_date}")

    # 4. Data Enrichment & Cleaning
    # Date (Default to today if missing, or parse from filename in future)
    if 'date' not in canonical_df.columns:
        canonical_df['dt'] = datetime.now().date()
    else:
        canonical_df.rename(columns={'date': 'dt'}, inplace=True)
        
    # Marketplace (Default US)
    if 'marketplace' not in canonical_df.columns:
        canonical_df['marketplace'] = 'US'
        
    # Keyword Normalization
    if 'keyword' in canonical_df.columns:
        canonical_df['keyword'] = canonical_df['keyword'].apply(normalize_keyword)
        
    if 'keyword' in canonical_df.columns:
        canonical_df['keyword'] = canonical_df['keyword'].apply(normalize_keyword)
        
    # Snapshot Date (Alias dt if missing)
    if 'snapshot_date' not in canonical_df.columns and 'dt' in canonical_df.columns:
        canonical_df['snapshot_date'] = canonical_df['dt']
        
    # Campaign Hash
    if 'campaign_name_raw' in canonical_df.columns and 'campaign_id' not in canonical_df.columns:
        canonical_df['campaign_id'] = canonical_df['campaign_name_raw'].apply(generate_hash)
        
    for col in ['spend', 'sales', 'cpc', 'cpa', 'search_volume', 'title_density', 'spr', 'organic_rank', 'ad_rank', 'ppc_bid']:
        if col in canonical_df.columns:
             def clean_numeric_zh(x):
                 s = str(x)
                 if '无排名' in s or 'Unranked' in s:
                     return 0
                 # Remove non-numeric chars except dot
                 val = pd.to_numeric(pd.Series([s]).str.replace(r'[^\d.]', '', regex=True), errors='coerce').iloc[0]
                 return val if pd.notnull(val) else 0
                 
             canonical_df[col] = canonical_df[col].apply(clean_numeric_zh)

    
    for col in ['impressions', 'clicks', 'orders', 'units', 'sessions', 'page_views', 'units_ordered']:
        if col in canonical_df.columns:
             canonical_df[col] = pd.to_numeric(canonical_df[col].astype(str).str.replace(',', ''), errors='coerce').fillna(0).astype(int)

    # Percentage Cleaning
    # If standardizing to 0.05 (5%), checking input type
    for col in ['traffic_share', 'conversion_share', 'click_share', 'buy_box_percentage', 'unit_session_percentage']:
        if col in canonical_df.columns:
             def clean_pct(x):
                 if pd.isna(x): return 0
                 s = str(x)
                 if '%' in s:
                     return float(s.replace('%', ''))
                 try:
                     return float(s)
                 except:
                     return 0
             
             canonical_df[col] = canonical_df[col].apply(clean_pct)
             
    # Parsing Page Info (SellersSprite Specific)
    # Format: "第1页,40/53" -> Page 1, Pos 40, Total 53
    if 'rank_page_info_raw' in canonical_df.columns:
        import re
        def parse_page_info(s):
            # Returns (page, pos, total)
            s = str(s)
            if not s or s == 'nan': return None, None, None
            
            # Regex: 第(\d+)页,(\d+)/(\d+)
            match = re.search(r'第(\d+)页,(\d+)/(\d+)', s)
            if match:
                return int(match.group(1)), int(match.group(2)), int(match.group(3))
            
            # Fallback for "前3页无排名" etc
            return None, None, None

        # Apply and split
        parsed_data = canonical_df['rank_page_info_raw'].apply(parse_page_info)
        
        # Unpack into new columns
        canonical_df['organic_page_no'] = parsed_data.apply(lambda x: x[0])
        canonical_df['organic_page_pos'] = parsed_data.apply(lambda x: x[1])
        canonical_df['organic_page_total'] = parsed_data.apply(lambda x: x[2])
        
    # Parsing Ad Page Info (SellersSprite Specific)
    if 'ad_rank_page_info_raw' in canonical_df.columns:
        # Use same parser function if possible, or redefine locally
        # Since local defs are scoped, just reuse the logic pattern.
        # Format: "第3页,52/52"
        # Since 'parse_page_info' was defined in the previous block scope, we need to redefine or move it up.
        # But for safety in this robust script, let's just re-instantiate logic or use strict regex.
        import re
        def parse_page_info_ad(s):
             s = str(s)
             if not s or s == 'nan': return None, None, None
             match = re.search(r'第(\d+)页,(\d+)/(\d+)', s)
             if match:
                 return int(match.group(1)), int(match.group(2)), int(match.group(3))
             return None, None, None

        parsed_data_ad = canonical_df['ad_rank_page_info_raw'].apply(parse_page_info_ad)
        canonical_df['ad_page_no'] = parsed_data_ad.apply(lambda x: x[0])
        canonical_df['ad_page_pos'] = parsed_data_ad.apply(lambda x: x[1])
        canonical_df['ad_page_total'] = parsed_data_ad.apply(lambda x: x[2])
        
    # Parsing Timestamp (SellersSprite Specific)
    # Format: "中12.18 09:51\n美12.17 17:51"
    # Goal: Extract US Time for consistency with Amazon Ads
    if 'source_updated_at_raw' in canonical_df.columns:
        import re
        # datetime is already imported at top level
        
        def parse_sellersprite_time(s):
            # Prioritize US time: "美12.17 17:51"
            # If missing, fallback to CN or return None
            s = str(s)
            
            # Try matching US time first
            # Pattern: 美(\d+\.\d+ \d+:\d+)
            match_us = re.search(r'美(\d+\.\d+ \d+:\d+)', s)
            if match_us:
                dt_str = match_us.group(1)
                # Format: MM.DD HH:MM -> need current year? 
                # Assumption: Report is recent. Append current year or infer?
                # Safer: Just store as is? No, database needs Timestamp.
                # Heuristic: If current month < extracted month, it's last year.
                try:
                    current_year = datetime.now().year
                    # parse 12.17 17:51
                    dt = datetime.strptime(f"{current_year}.{dt_str}", "%Y.%m.%d %H:%M")
                    # Check for future date (if report is from Dec and now is Jan)
                    if dt > datetime.now() + pd.Timedelta(days=1):
                         dt = datetime.strptime(f"{current_year-1}.{dt_str}", "%Y.%m.%d %H:%M")
                    return dt
                except:
                    return None
            
            # Fallback to CN time
            match_cn = re.search(r'中(\d+\.\d+ \d+:\d+)', s)
            if match_cn:
                 try:
                    current_year = datetime.now().year
                    dt_str = match_cn.group(1)
                    dt = datetime.strptime(f"{current_year}.{dt_str}", "%Y.%m.%d %H:%M")
                    # CN is 12-16 hours ahead of US. Subtract 1 day roughly? 
                    # For now just return the time.
                    return dt
                 except:
                    return None
            
            return None

        canonical_df['data_updated_at'] = canonical_df['source_updated_at_raw'].apply(parse_sellersprite_time)

    # 5. Load to DuckDB
    target_table = profile['target_table']
    
    # Add Governance
    canonical_df['data_source'] = profile['source_system']
    canonical_df['source_file_id'] = os.path.basename(file_path)
    canonical_df['ingested_at'] = datetime.now()
    
    # Smart Schema Alignment: Add missing columns as Null to match DB schema
    # (This assumes the DB table exists and we want to fit the DF into it)
    # For Pilot, we'll try an APPEND using DuckDB's flexible ingest
    
    # Run Data Quality Checks before loading
    quality_checks = run_data_quality_checks(canonical_df, profile)
    if quality_checks["errors"]:
        for err in quality_checks["errors"]:
            logger.error(f"    Data Quality Error: {err}")
        result["errors"].extend(quality_checks["errors"])
        return result
    if quality_checks["warnings"]:
        for warn in quality_checks["warnings"]:
            logger.warning(f"    Data Quality Warning: {warn}")

    # Deduplication for tables with primary keys
    target_table = profile['target_table']
    pk_columns_map = {
        'fact_keyword_entry_daily': ['dt', 'marketplace', 'asin', 'keyword', 'entry_type', 'ad_type'],
        'fact_asin_daily': ['dt', 'marketplace', 'asin'],
        'fact_keyword_snapshot': ['snapshot_date', 'marketplace', 'asin', 'keyword'],
    }

    if target_table in pk_columns_map:
        pk_cols = pk_columns_map[target_table]
        available_cols = [c for c in pk_cols if c in canonical_df.columns]
        if len(available_cols) >= 2:  # Need at least 2 key columns
            existing_keys = get_existing_keys(con, target_table, available_cols)
            original_count = len(canonical_df)
            canonical_df = deduplicate_dataframe(canonical_df, available_cols, existing_keys)
            if len(canonical_df) < original_count:
                logger.info(f"    Deduplication: {original_count} -> {len(canonical_df)} rows")

    # Skip if no new data after deduplication
    if len(canonical_df) == 0:
        logger.info(f"    No new data to load after deduplication")
        result["status"] = "SUCCESS"
        result["rows_loaded"] = 0
        return result

    try:
        # Create temp view
        con.register('df_view', canonical_df)

        # INSERT INTO target (matching columns only)
        # Get target columns
        db_cols = [r[1] for r in con.execute(f"PRAGMA table_info({target_table})").fetchall()]

        # Intersect columns
        common_cols = [c for c in canonical_df.columns if c in db_cols]

        if not common_cols:
            logger.error("No matching columns found between DF and Table")
            result["errors"].append("No matching columns")
            return result

        # Smart Upsert / Aggregation Logic
        # 1. Identify PK columns for ON CONFLICT clause
        pk_info = con.execute(f"PRAGMA table_info({target_table})").fetchall()
        pk_cols = [r[1] for r in pk_info if r[5] > 0]  # r[5] is 'pk' boolean/index

        # 2. Identify Metric columns to SUM (heuristic: numeric types that typically accumulate)
        metric_cols = ['impressions', 'clicks', 'spend', 'orders', 'units', 'sales',
                       'new_to_brand_orders', 'new_to_brand_sales', 'new_to_brand_units',
                       'sessions', 'page_views', 'units_ordered']

        col_str = ", ".join(common_cols)

        if not pk_cols:
            # Fallback to simple insert if no PK defined (e.g. logging tables, snapshots)
            query = f"INSERT INTO {target_table} ({col_str}) SELECT {col_str} FROM df_view"
            logger.info(f"    Using simple INSERT (no PK defined for {target_table})")
        else:
            # Construct ON CONFLICT clause
            pk_str = ", ".join(pk_cols)

            # Update clause: Sum metrics, Replace others (to update last_seen info)
            update_parts = []
            for col in common_cols:
                if col in pk_cols:
                    continue
                if col in metric_cols:
                    update_parts.append(f"{col} = {target_table}.{col} + EXCLUDED.{col}")
                else:
                    update_parts.append(f"{col} = EXCLUDED.{col}")

            update_str = ", ".join(update_parts) if update_parts else ""
            if update_str:
                query = f"INSERT INTO {target_table} ({col_str}) SELECT {col_str} FROM df_view ON CONFLICT ({pk_str}) DO UPDATE SET {update_str}"
            else:
                query = f"INSERT INTO {target_table} ({col_str}) SELECT {col_str} FROM df_view ON CONFLICT ({pk_str}) DO NOTHING"

        con.execute(query)
        logger.info(f"✅ Successfully loaded {len(canonical_df)} rows into {target_table}")

        result["status"] = "SUCCESS"
        result["rows_loaded"] = len(canonical_df)

    except Exception as e:
        logger.error(f"DB Load Error: {e}")
        result["errors"].append(str(e))

    return result

def run_etl(force_reprocess: bool = False):
    """
    Run ETL pipeline with incremental loading support.

    Args:
        force_reprocess: If True, reprocess all files regardless of state.
    """
    import fnmatch

    logger.info("=" * 50)
    logger.info("Starting ETL Pipeline")
    logger.info("=" * 50)

    config = load_config()
    con = get_db_connection()
    state = load_etl_state()

    if force_reprocess:
        logger.info("Force reprocess enabled - will process all files")
        state["processed_files"] = {}

    # Initialize Tables (Idempotent)
    import src.data_lake.schema_definitions as schema
    for ddl in schema.ALL_DDL:
        con.execute(ddl)
    logger.info("Database tables initialized")

    # Ensure upload directory exists
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)
        logger.warning(f"Created upload directory: {UPLOAD_DIR}")

    # Scan Uploads
    processed_count = 0
    skipped_count = 0
    error_count = 0
    total_rows = 0

    for filename in sorted(os.listdir(UPLOAD_DIR)):
        file_path = os.path.join(UPLOAD_DIR, filename)

        # Skip directories
        if os.path.isdir(file_path):
            continue

        # Skip hidden files
        if filename.startswith('.'):
            continue

        # Check if file should be processed (incremental)
        if not should_process_file(file_path, state):
            skipped_count += 1
            continue

        # Match Profile
        matched_profile = None
        for profile in config['mappings']:
            if fnmatch.fnmatch(filename, profile['file_pattern']):
                matched_profile = profile
                break

        if not matched_profile:
            logger.warning(f"No matching profile for: {filename}")
            continue

        # Process file
        file_hash = get_file_hash(file_path)
        result = process_file(file_path, matched_profile, con)

        # Update state
        if result["status"] == "SUCCESS":
            mark_file_processed(filename, file_hash, state, result["rows_loaded"], "SUCCESS")
            processed_count += 1
            total_rows += result["rows_loaded"]
        else:
            mark_file_processed(filename, file_hash, state, 0, "FAILED")
            error_count += 1

    # Save state
    save_etl_state(state)

    # Apply retention policies (cleanup old data)
    logger.info("Applying data retention policies...")
    retention_results = run_all_retention_policies(con)
    total_deleted = sum(v for v in retention_results.values() if v > 0)
    if total_deleted > 0:
        logger.info(f"  Retention cleanup: deleted {total_deleted} old rows")

    # Vacuum database to reclaim space
    if processed_count > 0 or total_deleted > 0:
        vacuum_database(con)

    # Summary
    logger.info("=" * 50)
    logger.info("ETL Pipeline Complete")
    logger.info(f"  Processed: {processed_count} files ({total_rows} rows)")
    logger.info(f"  Skipped (unchanged): {skipped_count} files")
    logger.info(f"  Errors: {error_count} files")
    logger.info(f"  Retention cleanup: {total_deleted} rows deleted")
    logger.info("=" * 50)

    con.close()

    return {
        "processed": processed_count,
        "skipped": skipped_count,
        "errors": error_count,
        "total_rows": total_rows,
        "retention_deleted": total_deleted
    }


def run_etl_for_file(file_path: str):
    """
    Run ETL for a single file (useful for API/CLI integration).
    """
    import fnmatch

    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        return {"status": "FAILED", "error": "File not found"}

    config = load_config()
    con = get_db_connection()

    # Initialize Tables
    import src.data_lake.schema_definitions as schema
    for ddl in schema.ALL_DDL:
        con.execute(ddl)

    filename = os.path.basename(file_path)

    # Match Profile
    matched_profile = None
    for profile in config['mappings']:
        if fnmatch.fnmatch(filename, profile['file_pattern']):
            matched_profile = profile
            break

    if not matched_profile:
        logger.error(f"No matching profile for: {filename}")
        con.close()
        return {"status": "FAILED", "error": "No matching profile"}

    result = process_file(file_path, matched_profile, con)
    con.close()

    return result


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        if sys.argv[1] == "--force":
            run_etl(force_reprocess=True)
        elif sys.argv[1] == "--file" and len(sys.argv) > 2:
            result = run_etl_for_file(sys.argv[2])
            print(json.dumps(result, indent=2))
        else:
            print("Usage: python etl_loader.py [--force] [--file <filepath>]")
    else:
        run_etl()
