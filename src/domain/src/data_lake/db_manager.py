"""
DuckDB Database Manager for Amazon Growth OS Data Lake
Version: 2.1 (Enhanced with incremental loading & health checks)
"""

import duckdb
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

# Configure logging
logger = logging.getLogger(__name__)

# Database path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, 'data', 'amazon_growth_os.db')

# Data retention settings (days)
RETENTION_POLICIES = {
    'fact_keyword_entry_daily': 90,      # 90 days of ad data
    'fact_keyword_snapshot': 180,         # 180 days of snapshots
    'fact_asin_daily': 90,                # 90 days of ASIN metrics
    'fact_ads_keyword_daily_campaign': 90,
    'fact_serp_top10': 30,                # 30 days of SERP data
    'staging_generic_import': 7,          # 7 days staging
}


def get_db_path() -> str:
    """Get the database file path."""
    return DB_PATH


def get_db_connection() -> duckdb.DuckDBPyConnection:
    """
    Returns a connection to the DuckDB database with optimized settings.
    """
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    try:
        con = duckdb.connect(DB_PATH)
        # Performance pragmas
        con.execute("PRAGMA checkpoint_threshold='16MB'")
        con.execute("PRAGMA memory_limit='2GB'")
        con.execute("PRAGMA threads=4")
        return con
    except Exception as e:
        logger.error(f"Connection Error: {e}")
        raise e


# ============================================
# Incremental Loading Helpers
# ============================================

def get_max_date(con: duckdb.DuckDBPyConnection, table: str,
                 date_column: str = 'dt') -> Optional[str]:
    """
    Get the maximum date in a table for incremental loading.
    Returns None if table is empty or doesn't exist.
    """
    try:
        result = con.execute(f"""
            SELECT MAX({date_column})::VARCHAR
            FROM {table}
        """).fetchone()
        return result[0] if result and result[0] else None
    except Exception as e:
        logger.warning(f"Could not get max date from {table}: {e}")
        return None


def get_existing_keys(con: duckdb.DuckDBPyConnection, table: str,
                      key_columns: List[str],
                      filter_date: Optional[str] = None) -> set:
    """
    Get existing primary key combinations for deduplication.
    """
    try:
        key_str = ", ".join(key_columns)
        query = f"SELECT DISTINCT {key_str} FROM {table}"

        if filter_date and 'dt' in key_columns:
            query += f" WHERE dt >= '{filter_date}'"

        result = con.execute(query).fetchall()
        return set(result)
    except Exception as e:
        logger.warning(f"Could not get existing keys from {table}: {e}")
        return set()


def deduplicate_dataframe(df, key_columns: List[str],
                          existing_keys: set) -> 'pd.DataFrame':
    """
    Remove rows from DataFrame that already exist in database.
    """
    import pandas as pd

    if not existing_keys:
        return df

    # Create composite key for comparison
    if len(key_columns) == 1:
        mask = ~df[key_columns[0]].isin([k[0] for k in existing_keys])
    else:
        df_keys = df[key_columns].apply(tuple, axis=1)
        mask = ~df_keys.isin(existing_keys)

    removed = (~mask).sum()
    if removed > 0:
        logger.info(f"    Deduplicated {removed} existing rows")

    return df[mask]


# ============================================
# Data Retention & Cleanup
# ============================================

def apply_retention_policy(con: duckdb.DuckDBPyConnection,
                          table: str,
                          date_column: str = 'dt') -> int:
    """
    Delete old data based on retention policy.
    Returns number of rows deleted.
    """
    retention_days = RETENTION_POLICIES.get(table, 90)
    cutoff_date = (datetime.now() - timedelta(days=retention_days)).strftime('%Y-%m-%d')

    try:
        # Count rows to delete
        count_result = con.execute(f"""
            SELECT COUNT(*) FROM {table}
            WHERE {date_column} < '{cutoff_date}'
        """).fetchone()
        rows_to_delete = count_result[0] if count_result else 0

        if rows_to_delete > 0:
            con.execute(f"""
                DELETE FROM {table}
                WHERE {date_column} < '{cutoff_date}'
            """)
            logger.info(f"Retention cleanup: deleted {rows_to_delete} rows from {table} (older than {retention_days} days)")

        return rows_to_delete
    except Exception as e:
        logger.warning(f"Retention policy failed for {table}: {e}")
        return 0


def run_all_retention_policies(con: Optional[duckdb.DuckDBPyConnection] = None) -> Dict[str, int]:
    """
    Apply retention policies to all tables.
    """
    close_con = False
    if con is None:
        con = get_db_connection()
        close_con = True

    results = {}
    for table, days in RETENTION_POLICIES.items():
        try:
            # Check if table exists
            exists = con.execute(f"""
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_name = '{table}'
            """).fetchone()[0] > 0

            if exists:
                # Determine the correct date column for each table
                if 'snapshot' in table:
                    date_col = 'snapshot_date'
                elif table == 'fact_serp_top10':
                    date_col = 'capture_date'
                elif table == 'staging_generic_import':
                    date_col = 'ingested_at'
                else:
                    date_col = 'dt'
                results[table] = apply_retention_policy(con, table, date_col)
        except Exception as e:
            logger.warning(f"Skipping retention for {table}: {e}")
            results[table] = -1

    if close_con:
        con.close()

    return results


# ============================================
# Database Health & Statistics
# ============================================

def get_table_stats(con: Optional[duckdb.DuckDBPyConnection] = None) -> Dict[str, Dict]:
    """
    Get statistics for all tables in the database.
    """
    close_con = False
    if con is None:
        con = get_db_connection()
        close_con = True

    stats = {}

    try:
        # Get all tables
        tables = con.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'main'
        """).fetchall()

        for (table_name,) in tables:
            try:
                row_count = con.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]

                # Get date range if applicable
                date_cols = ['dt', 'snapshot_date', 'capture_date', 'ingested_at']
                date_range = None
                for dc in date_cols:
                    try:
                        result = con.execute(f"""
                            SELECT MIN({dc})::VARCHAR, MAX({dc})::VARCHAR
                            FROM {table_name}
                        """).fetchone()
                        if result[0]:
                            date_range = {'min': result[0], 'max': result[1]}
                            break
                    except:
                        continue

                stats[table_name] = {
                    'row_count': row_count,
                    'date_range': date_range
                }
            except Exception as e:
                stats[table_name] = {'error': str(e)}

    except Exception as e:
        logger.error(f"Failed to get table stats: {e}")

    if close_con:
        con.close()

    return stats


def get_database_size() -> Dict[str, Any]:
    """
    Get database file size and related info.
    """
    if os.path.exists(DB_PATH):
        size_bytes = os.path.getsize(DB_PATH)
        size_mb = size_bytes / (1024 * 1024)
        return {
            'path': DB_PATH,
            'size_bytes': size_bytes,
            'size_mb': round(size_mb, 2),
            'exists': True
        }
    return {
        'path': DB_PATH,
        'exists': False
    }


def vacuum_database(con: Optional[duckdb.DuckDBPyConnection] = None) -> bool:
    """
    Vacuum the database to reclaim space and optimize.
    """
    close_con = False
    if con is None:
        con = get_db_connection()
        close_con = True

    try:
        con.execute("CHECKPOINT")
        logger.info("Database vacuumed successfully")
        success = True
    except Exception as e:
        logger.error(f"Vacuum failed: {e}")
        success = False

    if close_con:
        con.close()

    return success


# ============================================
# Query Helpers
# ============================================

def execute_query(query: str, params: Optional[tuple] = None) -> List[tuple]:
    """
    Execute a query and return results.
    """
    con = get_db_connection()
    try:
        if params:
            result = con.execute(query, params).fetchall()
        else:
            result = con.execute(query).fetchall()
        return result
    finally:
        con.close()


def execute_query_df(query: str, params: Optional[tuple] = None) -> 'pd.DataFrame':
    """
    Execute a query and return results as DataFrame.
    """
    con = get_db_connection()
    try:
        if params:
            result = con.execute(query, params).df()
        else:
            result = con.execute(query).df()
        return result
    finally:
        con.close()


# ============================================
# Health Check Report
# ============================================

def generate_health_report() -> Dict[str, Any]:
    """
    Generate a comprehensive health report for the data lake.
    """
    report = {
        'generated_at': datetime.now().isoformat(),
        'database': get_database_size(),
        'tables': get_table_stats(),
        'retention_policies': RETENTION_POLICIES
    }

    # Calculate totals
    total_rows = sum(
        t.get('row_count', 0)
        for t in report['tables'].values()
        if isinstance(t, dict) and 'row_count' in t
    )
    report['summary'] = {
        'total_tables': len(report['tables']),
        'total_rows': total_rows
    }

    return report


# ============================================
# CLI Support
# ============================================

if __name__ == "__main__":
    import sys
    import json

    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "stats":
            print(json.dumps(get_table_stats(), indent=2, default=str))

        elif command == "size":
            print(json.dumps(get_database_size(), indent=2))

        elif command == "retention":
            results = run_all_retention_policies()
            print(json.dumps(results, indent=2))

        elif command == "vacuum":
            success = vacuum_database()
            print("Vacuum completed" if success else "Vacuum failed")

        elif command == "health":
            report = generate_health_report()
            print(json.dumps(report, indent=2, default=str))

        else:
            print("Usage: python db_manager.py [stats|size|retention|vacuum|health]")
    else:
        # Default: show health report
        report = generate_health_report()
        print(json.dumps(report, indent=2, default=str))
